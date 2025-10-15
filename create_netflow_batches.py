#!/usr/bin/env python3
"""
Create NetFlow batch files for Cline testing

This script reads the CICIDS2018 dataset and creates small batch files
with 10 flows each for manual testing with Cline.
"""

import pandas as pd
import json
from pathlib import Path

# Configuration
DATASET_PATH = "datasets/development.csv"
OUTPUT_DIR = "netflow_batches"
BATCH_SIZE = 10

def create_batch_files():
    """Create batch files with different attack scenarios."""
    
    print("🔄 Loading dataset...")
    df = pd.read_csv(DATASET_PATH)
    
    # Create output directory
    output_path = Path(OUTPUT_DIR)
    output_path.mkdir(exist_ok=True)
    
    print(f"📊 Total flows in dataset: {len(df):,}")
    print(f"📋 Attack labels: {df['Label'].unique()}\n")
    
    # Get attack type distribution
    label_counts = df['Label'].value_counts()
    print("Attack distribution:")
    for label, count in label_counts.items():
        print(f"  - {label}: {count:,} flows")
    
    print(f"\n📦 Creating batch files in '{OUTPUT_DIR}/'...\n")
    
    # 1. SSH Bruteforce batch (if exists)
    if 'SSH-Bruteforce' in df['Label'].values:
        ssh_flows = df[df['Label'] == 'SSH-Bruteforce'].head(BATCH_SIZE)
        save_batch(ssh_flows, 'batch_01_ssh_bruteforce.txt', 'SSH-Bruteforce')
    
    # 2. DDoS batch (if exists)
    ddos_labels = [label for label in df['Label'].unique() if 'DDoS' in label or 'DoS' in label]
    if ddos_labels:
        ddos_flows = df[df['Label'] == ddos_labels[0]].head(BATCH_SIZE)
        save_batch(ddos_flows, 'batch_02_ddos.txt', ddos_labels[0])
    
    # 3. Port Scan batch (if exists)
    portscan_labels = [label for label in df['Label'].unique() if 'portscan' in label.lower()]
    if portscan_labels:
        scan_flows = df[df['Label'] == portscan_labels[0]].head(BATCH_SIZE)
        save_batch(scan_flows, 'batch_03_portscan.txt', portscan_labels[0])
    
    # 4. Benign traffic batch
    benign_flows = df[df['Label'] == 'Benign'].head(BATCH_SIZE)
    save_batch(benign_flows, 'batch_04_benign.txt', 'Benign')
    
    # 5. Mixed batch (different attack types)
    mixed_flows = []
    for label in df['Label'].unique()[:5]:  # First 5 different labels
        flows = df[df['Label'] == label].head(2)  # 2 flows each
        mixed_flows.append(flows)
    if mixed_flows:
        mixed_df = pd.concat(mixed_flows)
        save_batch(mixed_df, 'batch_05_mixed.txt', 'Mixed')
    
    print(f"\n✅ Batch files created in '{OUTPUT_DIR}/' directory")
    print(f"\nTo test with Cline:")
    print(f"1. Ask Cline to read one of the batch files")
    print(f"2. Ask it to analyze the flows for attacks")
    print(f"3. See which tools it uses and what it detects!")


def save_batch(flows_df, filename, label):
    """Save flows to a readable text file."""
    
    filepath = Path(OUTPUT_DIR) / filename
    
    with open(filepath, 'w') as f:
        f.write(f"# NetFlow Batch: {label}\n")
        f.write(f"# Total Flows: {len(flows_df)}\n")
        f.write(f"# Attack Type: {label}\n")
        f.write("# " + "="*70 + "\n\n")
        
        for idx, flow in flows_df.iterrows():
            f.write(f"Flow {idx + 1}:\n")
            f.write(f"  Source IP: {flow.get('Src IP', 'N/A')}\n")
            f.write(f"  Destination IP: {flow.get('Dst IP', 'N/A')}\n")
            f.write(f"  Source Port: {flow.get('Src Port', 'N/A')}\n")
            f.write(f"  Destination Port: {flow.get('Dst Port', 'N/A')}\n")
            f.write(f"  Protocol: {flow.get('Protocol', 'N/A')}\n")
            f.write(f"  Duration: {flow.get('Flow Duration', 'N/A')} ms\n")
            f.write(f"  Forward Packets: {flow.get('Tot Fwd Pkts', 'N/A')}\n")
            f.write(f"  Backward Packets: {flow.get('Tot Bwd Pkts', 'N/A')}\n")
            f.write(f"  Flow Bytes/s: {flow.get('Flow Byts/s', 'N/A')}\n")
            f.write(f"  Flow Packets/s: {flow.get('Flow Pkts/s', 'N/A')}\n")
            f.write(f"  Label: {flow.get('Label', 'N/A')}\n")
            f.write("\n")
    
    print(f"✅ Created: {filename} ({len(flows_df)} flows, label: {label})")
    
    # Also create JSON version for programmatic access
    json_filepath = filepath.with_suffix('.json')
    flows_json = flows_df.to_dict('records')
    with open(json_filepath, 'w') as f:
        json.dump({
            'batch_name': filename,
            'attack_type': label,
            'flow_count': len(flows_df),
            'flows': flows_json
        }, f, indent=2)
    
    print(f"✅ Created: {json_filepath.name} (JSON format)")


if __name__ == "__main__":
    create_batch_files()
