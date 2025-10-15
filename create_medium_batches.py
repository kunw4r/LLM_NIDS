#!/usr/bin/env python3
"""
Create medium-sized batches for Tier 2 testing (100-1000 flows)
Uses stratified sampling to preserve attack/benign ratio
"""

import pandas as pd
import json
import os
from pathlib import Path

# Configuration
BATCH_CONFIGS = [
    {'size': 100, 'name': 'batch_100', 'desc': '100 flows (stratified sample)'},
    {'size': 500, 'name': 'batch_500', 'desc': '500 flows (stratified sample)'},
    {'size': 1000, 'name': 'batch_1000', 'desc': '1000 flows (stratified sample)'},
]

BASE_DIR = 'medium_batches'
RANDOM_SEED = 42

def create_directories():
    """Create directory structure"""
    Path(BASE_DIR).mkdir(exist_ok=True)
    Path(f"{BASE_DIR}/batch_data").mkdir(exist_ok=True)
    Path(f"{BASE_DIR}/labels").mkdir(exist_ok=True)

def stratified_sample(df, n_samples, random_state=42):
    """Sample flows while preserving attack/benign ratio"""
    attack_ratio = (df['Label'] == 1).sum() / len(df)
    
    n_attacks = int(n_samples * attack_ratio)
    n_benign = n_samples - n_attacks
    
    attacks = df[df['Label'] == 1].sample(n=n_attacks, random_state=random_state)
    benign = df[df['Label'] == 0].sample(n=n_benign, random_state=random_state)
    
    # Combine and shuffle
    sample_df = pd.concat([attacks, benign]).sample(frac=1, random_state=random_state)
    
    return sample_df

def save_batch_data(df, batch_name, description):
    """Save batch WITHOUT labels"""
    batch_dir = Path(f"{BASE_DIR}/batch_data/{batch_name}")
    batch_dir.mkdir(exist_ok=True)
    
    # Remove labels
    data_df = df.drop(columns=['Label', 'Attack'], errors='ignore')
    
    # Save as text (optimized for Cline)
    txt_file = batch_dir / 'flows.txt'
    with open(txt_file, 'w') as f:
        f.write(f"# {description}\n")
        f.write(f"# Total flows: {len(data_df):,}\n")
        f.write(f"# Analyze for malicious activity\n")
        f.write("=" * 80 + "\n\n")
        
        for idx, (flow_id, row) in enumerate(data_df.iterrows(), 1):
            f.write(f"Flow #{idx} (ID: {flow_id})\n")
            f.write("-" * 40 + "\n")
            # Write key features (most important for analysis)
            key_features = [
                'IPV4_SRC_ADDR', 'L4_SRC_PORT', 'IPV4_DST_ADDR', 'L4_DST_PORT',
                'PROTOCOL', 'L7_PROTO', 'IN_BYTES', 'IN_PKTS', 'OUT_BYTES', 'OUT_PKTS',
                'TCP_FLAGS', 'FLOW_DURATION_MILLISECONDS'
            ]
            for col in key_features:
                if col in row.index:
                    f.write(f"{col:30s}: {row[col]}\n")
            f.write("\n")
    
    # Save as JSON (compact version)
    json_file = batch_dir / 'flows.json'
    flows_data = []
    for flow_id, row in data_df.iterrows():
        flows_data.append({
            'flow_id': int(flow_id),
            'src_ip': row['IPV4_SRC_ADDR'],
            'src_port': int(row['L4_SRC_PORT']),
            'dst_ip': row['IPV4_DST_ADDR'],
            'dst_port': int(row['L4_DST_PORT']),
            'protocol': int(row['PROTOCOL']),
            'bytes_in': int(row['IN_BYTES']),
            'bytes_out': int(row['OUT_BYTES']),
            'packets_in': int(row['IN_PKTS']),
            'packets_out': int(row['OUT_PKTS']),
            'duration_ms': int(row['FLOW_DURATION_MILLISECONDS']),
            'all_features': row.to_dict()
        })
    
    with open(json_file, 'w') as f:
        json.dump({
            'description': description,
            'count': len(flows_data),
            'flows': flows_data
        }, f, indent=2)
    
    # Save README
    readme_file = batch_dir / 'README.md'
    with open(readme_file, 'w') as f:
        f.write(f"# {batch_name.replace('_', ' ').title()}\n\n")
        f.write(f"**{description}**\n\n")
        f.write(f"## Statistics\n")
        f.write(f"- Total flows: {len(data_df):,}\n")
        f.write(f"- Features per flow: {len(data_df.columns)}\n\n")
        f.write(f"## Task\n")
        f.write(f"Analyze these NetFlow records and:\n")
        f.write(f"1. Identify malicious flows\n")
        f.write(f"2. Classify attack types\n")
        f.write(f"3. Provide confidence scores\n")
        f.write(f"4. Map to MITRE ATT&CK\n\n")
        f.write(f"## Files\n")
        f.write(f"- `flows.txt` - Human-readable (optimized for LLM)\n")
        f.write(f"- `flows.json` - Machine-readable (structured data)\n\n")
        f.write(f"**Note**: Labels hidden for blind evaluation\n")

def save_batch_labels(df, batch_name, description):
    """Save ground truth labels"""
    labels_file = Path(f"{BASE_DIR}/labels/{batch_name}_labels.json")
    
    ground_truth = []
    for flow_id, row in df.iterrows():
        ground_truth.append({
            'flow_id': int(flow_id),
            'label': int(row['Label']),
            'label_name': 'Attack' if row['Label'] == 1 else 'Benign',
            'attack_type': str(row.get('Attack', 'N/A')) if row['Label'] == 1 else None
        })
    
    attack_count = sum(1 for gt in ground_truth if gt['label'] == 1)
    benign_count = len(ground_truth) - attack_count
    
    with open(labels_file, 'w') as f:
        json.dump({
            'batch_name': batch_name,
            'description': description,
            'total_flows': len(ground_truth),
            'attack_count': attack_count,
            'benign_count': benign_count,
            'attack_ratio': attack_count / len(ground_truth),
            'ground_truth': ground_truth
        }, f, indent=2)
    
    print(f"✅ {batch_name:15s} | {len(ground_truth):4d} flows | {attack_count:4d} attacks ({attack_count/len(ground_truth)*100:.1f}%) | {benign_count:4d} benign")

def create_medium_batches():
    """Create all medium-sized batches"""
    
    print("🔄 Loading development dataset...\n")
    df = pd.read_csv('datasets/development.csv')
    
    total_flows = len(df)
    attack_flows = (df['Label'] == 1).sum()
    benign_flows = (df['Label'] == 0).sum()
    attack_ratio = attack_flows / total_flows
    
    print(f"📊 Dataset Statistics:")
    print(f"   Total flows:   {total_flows:,}")
    print(f"   Attacks:       {attack_flows:,} ({attack_ratio*100:.1f}%)")
    print(f"   Benign:        {benign_flows:,} ({(1-attack_ratio)*100:.1f}%)")
    print(f"\n📦 Creating medium batches (stratified sampling)...\n")
    
    create_directories()
    
    for config in BATCH_CONFIGS:
        # Stratified sample
        sample_df = stratified_sample(df, config['size'], RANDOM_SEED)
        
        # Save data and labels
        save_batch_data(sample_df, config['name'], config['desc'])
        save_batch_labels(sample_df, config['name'], config['desc'])
    
    print(f"\n✨ Done!\n")
    print(f"📂 Structure created:")
    print(f"   {BASE_DIR}/")
    print(f"   ├── batch_data/")
    print(f"   │   ├── batch_100/")
    print(f"   │   ├── batch_500/")
    print(f"   │   └── batch_1000/")
    print(f"   └── labels/")
    print(f"       ├── batch_100_labels.json")
    print(f"       ├── batch_500_labels.json")
    print(f"       └── batch_1000_labels.json")
    
    print(f"\n💡 Next steps:")
    print(f"   1. Open medium_batches/batch_data/batch_100/flows.txt")
    print(f"   2. Ask Cline to analyze (larger scale test)")
    print(f"   3. Compare with labels/batch_100_labels.json")
    print(f"   4. Scale up to batch_500, then batch_1000")

if __name__ == "__main__":
    create_medium_batches()
