#!/usr/bin/env python3
"""
Large Sample Generator for LLM-NIDS Testing
============================================

Creates random samples from CICIDS-2018 NetFlow datasets for testing Cline at scale.

Usage:
    python create_large_sample.py <dataset_name> <num_flows> <output_dir>

Example:
    python create_large_sample.py development.csv 1600 large_samples/sample_1600

Features:
- Random sampling from any dataset (development/test/validation)
- Preserves NetFlow format for Cline analysis
- Stores ground truth labels separately for later verification
- Creates both flows.txt (human-readable) and flows.json (structured)
- Generates README with sample statistics
"""

import pandas as pd
import json
import argparse
import os
import sys
from pathlib import Path
from datetime import datetime


def load_dataset(dataset_path: str) -> pd.DataFrame:
    """Load CICIDS-2018 NetFlow dataset."""
    print(f"📂 Loading dataset: {dataset_path}")
    
    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")
    
    df = pd.read_csv(dataset_path)
    print(f"✅ Loaded {len(df)} flows from {os.path.basename(dataset_path)}")
    
    return df


def random_sample(df: pd.DataFrame, n: int, seed: int = 42) -> pd.DataFrame:
    """Randomly sample N flows from dataset."""
    print(f"🎲 Randomly sampling {n} flows (seed={seed})")
    
    if n > len(df):
        print(f"⚠️  Warning: Requested {n} flows but dataset only has {len(df)}. Using all flows.")
        return df
    
    sampled = df.sample(n=n, random_state=seed)
    print(f"✅ Sampled {len(sampled)} flows")
    
    return sampled


def extract_netflow_features(row) -> dict:
    """Extract NetFlow features from a dataframe row (NFv3 format)."""
    return {
        'flow_id': int(row.name),  # Use index as flow_id
        'src_ip': row['IPV4_SRC_ADDR'],
        'dst_ip': row['IPV4_DST_ADDR'],
        'src_port': int(row['L4_SRC_PORT']),
        'dst_port': int(row['L4_DST_PORT']),
        'protocol': int(row['PROTOCOL']),
        'flow_duration': float(row['FLOW_DURATION_MILLISECONDS']),
        'in_bytes': float(row['IN_BYTES']),
        'out_bytes': float(row['OUT_BYTES']),
        'in_pkts': int(row['IN_PKTS']),
        'out_pkts': int(row['OUT_PKTS']),
        'tcp_flags': int(row['TCP_FLAGS']),
        'client_tcp_flags': int(row['CLIENT_TCP_FLAGS']),
        'server_tcp_flags': int(row['SERVER_TCP_FLAGS']),
        'duration_in': float(row['DURATION_IN']),
        'duration_out': float(row['DURATION_OUT']),
        'min_ttl': int(row['MIN_TTL']),
        'max_ttl': int(row['MAX_TTL']),
        'min_ip_pkt_len': int(row['MIN_IP_PKT_LEN']),
        'max_ip_pkt_len': int(row['MAX_IP_PKT_LEN']),
        'src_to_dst_avg_throughput': float(row['SRC_TO_DST_AVG_THROUGHPUT']),
        'dst_to_src_avg_throughput': float(row['DST_TO_SRC_AVG_THROUGHPUT']),
        'tcp_win_max_in': int(row['TCP_WIN_MAX_IN']),
        'tcp_win_max_out': int(row['TCP_WIN_MAX_OUT']),
        'src_to_dst_iat_min': float(row['SRC_TO_DST_IAT_MIN']),
        'src_to_dst_iat_max': float(row['SRC_TO_DST_IAT_MAX']),
        'src_to_dst_iat_avg': float(row['SRC_TO_DST_IAT_AVG']),
        'dst_to_src_iat_min': float(row['DST_TO_SRC_IAT_MIN']),
        'dst_to_src_iat_max': float(row['DST_TO_SRC_IAT_MAX']),
        'dst_to_src_iat_avg': float(row['DST_TO_SRC_IAT_AVG'])
    }


def extract_ground_truth(row) -> dict:
    """Extract ground truth label from a dataframe row (NFv3 format)."""
    return {
        'flow_id': int(row.name),
        'label': row['Label'] if 'Label' in row.index else 'UNKNOWN',
        'attack_cat': row['Attack'] if 'Attack' in row.index else None
    }


def create_flows_txt(flows: list, output_path: str):
    """Create human-readable flows.txt file."""
    print(f"📝 Creating flows.txt...")
    
    with open(output_path, 'w') as f:
        f.write("# NetFlow Data for Analysis\n")
        f.write(f"# Total Flows: {len(flows)}\n")
        f.write(f"# Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write("#" + "="*80 + "\n\n")
        
        for i, flow in enumerate(flows, 1):
            f.write(f"Flow {i}/{len(flows)} (ID: {flow['flow_id']})\n")
            f.write("-" * 80 + "\n")
            f.write(f"Source IP:           {flow['src_ip']}\n")
            f.write(f"Destination IP:      {flow['dst_ip']}\n")
            f.write(f"Source Port:         {flow['src_port']}\n")
            f.write(f"Destination Port:    {flow['dst_port']}\n")
            f.write(f"Protocol:            {flow['protocol']}\n")
            f.write(f"Duration:            {flow['flow_duration']:.2f} ms\n")
            f.write(f"Inbound Packets:     {flow['in_pkts']}\n")
            f.write(f"Outbound Packets:    {flow['out_pkts']}\n")
            f.write(f"Inbound Bytes:       {flow['in_bytes']:.0f}\n")
            f.write(f"Outbound Bytes:      {flow['out_bytes']:.0f}\n")
            f.write(f"TCP Flags:           {flow['tcp_flags']}\n")
            f.write(f"Client TCP Flags:    {flow['client_tcp_flags']}\n")
            f.write(f"Server TCP Flags:    {flow['server_tcp_flags']}\n")
            f.write(f"Min TTL:             {flow['min_ttl']}\n")
            f.write(f"Max TTL:             {flow['max_ttl']}\n")
            f.write(f"TCP Win Max In:      {flow['tcp_win_max_in']}\n")
            f.write(f"TCP Win Max Out:     {flow['tcp_win_max_out']}\n")
            f.write("\n")
    
    print(f"✅ Created {output_path}")


def create_flows_json(flows: list, output_path: str):
    """Create structured flows.json file."""
    print(f"📝 Creating flows.json...")
    
    with open(output_path, 'w') as f:
        json.dump(flows, f, indent=2)
    
    print(f"✅ Created {output_path}")


def save_ground_truth(labels: list, output_path: str):
    """Save ground truth labels for later verification."""
    print(f"🏷️  Saving ground truth labels...")
    
    with open(output_path, 'w') as f:
        json.dump(labels, f, indent=2)
    
    print(f"✅ Created {output_path}")


def generate_readme(dataset_name: str, num_flows: int, df_sample: pd.DataFrame, output_dir: str):
    """Generate README with sample statistics."""
    print(f"📄 Generating README...")
    
    # Calculate statistics
    label_counts = df_sample['Label'].value_counts()
    attack_counts = df_sample['Attack'].value_counts() if 'Attack' in df_sample.columns else None
    
    readme_content = f"""# Large Sample Analysis - {num_flows} Flows

## Sample Information

- **Source Dataset:** {dataset_name}
- **Sample Size:** {num_flows} flows
- **Sampling Method:** Random (seed=42)
- **Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Files

- `flows.txt` - Human-readable NetFlow data for Cline analysis
- `flows.json` - Structured JSON format of NetFlow data
- `ground_truth.json` - Actual labels (stored separately for verification)
- `README.md` - This file

## Sample Composition

### By Label
"""
    
    for label, count in label_counts.items():
        percentage = (count / num_flows) * 100
        readme_content += f"- **{label}:** {count} flows ({percentage:.1f}%)\n"
    
    if attack_counts is not None:
        readme_content += "\n### By Attack Category\n"
        for attack, count in attack_counts.items():
            percentage = (count / num_flows) * 100
            readme_content += f"- **{attack}:** {count} flows ({percentage:.1f}%)\n"
    
    readme_content += f"""

## Expected Behavior

This sample contains **{label_counts.get('ATTACK', 0)} attack flows** and **{label_counts.get('BENIGN', 0)} benign flows**.

### Success Criteria
Based on previous batch testing (Precision: 100%, Recall: 40%):

- **Expected True Positives:** ~{int(label_counts.get('ATTACK', 0) * 0.4)} attacks detected (40% recall)
- **Expected False Negatives:** ~{int(label_counts.get('ATTACK', 0) * 0.6)} attacks missed (60% of attacks)
- **Expected False Positives:** 0 (100% precision maintained)
- **Expected True Negatives:** {label_counts.get('BENIGN', 0)} (all benign correctly identified)

### Known Detection Patterns
- ✅ **Will detect:** Brute force attacks (FTP/SSH with RST flags)
- ❌ **Will miss:** DDoS, DoS, Botnet traffic (behavioral anomalies)

## Testing Instructions

### 1. Provide to Cline
Give Cline the `flows.txt` file with this prompt:

```
Analyze these {num_flows} NetFlow records and provide your verdict for each flow.
Use your MCP server tools as needed (IP reputation, geolocation, MITRE mapping).
Output CSV format: flow_id,verdict,confidence,attack_type,key_indicators,mitre,recommendation,tools_used
```

### 2. Save Cline's Output
Save Cline's predictions to `predictions.csv`

### 3. Calculate Metrics
```bash
python calculate_metrics.py predictions.csv ground_truth.json
```

### 4. Analyze Cost
Check API usage to determine cost per flow at scale.

## Research Questions

1. **Does recall improve/degrade with larger samples?**
2. **Does cost per flow decrease with batch processing?**
3. **Are there any false positives at scale?**
4. **What is the detection rate for each attack category?**
5. **How does confidence distribution change?**

---

**Note:** Ground truth labels are stored in `ground_truth.json` - DO NOT provide this to Cline during analysis.
"""
    
    readme_path = os.path.join(output_dir, 'README.md')
    with open(readme_path, 'w') as f:
        f.write(readme_content)
    
    print(f"✅ Created {readme_path}")


def main():
    parser = argparse.ArgumentParser(
        description='Create random sample from CICIDS-2018 NetFlow dataset',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Sample 1600 flows from development set
  python create_large_sample.py development.csv 1600 large_samples/sample_1600
  
  # Sample 500 flows from test set
  python create_large_sample.py test.csv 500 large_samples/sample_500
  
  # Sample 100 flows from validation set
  python create_large_sample.py validation.csv 100 large_samples/sample_100
        """
    )
    
    parser.add_argument('dataset', help='Dataset filename (development.csv, test.csv, or validation.csv)')
    parser.add_argument('num_flows', type=int, help='Number of flows to sample')
    parser.add_argument('output_dir', help='Output directory for sample files')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducibility (default: 42)')
    
    args = parser.parse_args()
    
    # Build full dataset path
    dataset_path = os.path.join('datasets', args.dataset)
    
    print("="*80)
    print("🚀 Large Sample Generator for LLM-NIDS Testing")
    print("="*80)
    print(f"Dataset:      {args.dataset}")
    print(f"Sample Size:  {args.num_flows} flows")
    print(f"Output Dir:   {args.output_dir}")
    print(f"Random Seed:  {args.seed}")
    print("="*80 + "\n")
    
    try:
        # Load dataset
        df = load_dataset(dataset_path)
        
        # Random sample
        df_sample = random_sample(df, args.num_flows, seed=args.seed)
        
        # Create output directory
        os.makedirs(args.output_dir, exist_ok=True)
        print(f"📁 Created output directory: {args.output_dir}\n")
        
        # Extract flows and labels
        print("🔄 Processing flows...")
        flows = []
        labels = []
        
        for idx, row in df_sample.iterrows():
            flows.append(extract_netflow_features(row))
            labels.append(extract_ground_truth(row))
        
        print(f"✅ Processed {len(flows)} flows\n")
        
        # Create output files
        flows_txt_path = os.path.join(args.output_dir, 'flows.txt')
        flows_json_path = os.path.join(args.output_dir, 'flows.json')
        labels_path = os.path.join(args.output_dir, 'ground_truth.json')
        
        create_flows_txt(flows, flows_txt_path)
        create_flows_json(flows, flows_json_path)
        save_ground_truth(labels, labels_path)
        
        # Generate README
        generate_readme(args.dataset, args.num_flows, df_sample, args.output_dir)
        
        print("\n" + "="*80)
        print("✅ SUCCESS! Sample created successfully")
        print("="*80)
        print(f"\n📂 Output Location: {args.output_dir}/")
        print(f"   - flows.txt ({os.path.getsize(flows_txt_path) / 1024:.1f} KB)")
        print(f"   - flows.json ({os.path.getsize(flows_json_path) / 1024:.1f} KB)")
        print(f"   - ground_truth.json ({os.path.getsize(labels_path) / 1024:.1f} KB)")
        print(f"   - README.md\n")
        
        # Sample composition summary
        label_counts = df_sample['Label'].value_counts()
        print("📊 Sample Composition:")
        for label, count in label_counts.items():
            percentage = (count / args.num_flows) * 100
            print(f"   - {label}: {count} ({percentage:.1f}%)")
        
        print("\n🎯 Next Steps:")
        print(f"   1. Open {args.output_dir}/flows.txt")
        print(f"   2. Provide to Cline for analysis")
        print(f"   3. Save Cline's output as predictions.csv")
        print(f"   4. Run: python calculate_metrics.py {args.output_dir}/predictions.csv {args.output_dir}/ground_truth.json")
        print("")
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
