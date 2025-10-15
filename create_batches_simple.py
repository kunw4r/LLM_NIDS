#!/usr/bin/env python3
"""
Create small NetFlow batches for Cline testing.
Works with CICIDS2018 dataset (Label: 0=Benign, 1=Attack)
"""

import pandas as pd
import json
import os

BATCH_SIZE = 10
OUTPUT_DIR = 'netflow_batches'

def save_batch(df, filename, description):
    """Save batch in both txt and json formats"""
    txt_file = os.path.join(OUTPUT_DIR, filename)
    json_file = os.path.join(OUTPUT_DIR, filename.replace('.txt', '.json'))
    
    # Save as formatted text
    with open(txt_file, 'w') as f:
        f.write(f"# {description}\n")
        f.write(f"# {len(df)} NetFlow records\n")
        f.write("=" * 80 + "\n\n")
        
        for idx, row in df.iterrows():
            f.write(f"Flow #{idx}\n")
            f.write("-" * 40 + "\n")
            for col, val in row.items():
                f.write(f"{col:25s}: {val}\n")
            f.write("\n")
    
    # Save as JSON
    records = df.to_dict('records')
    with open(json_file, 'w') as f:
        json.dump({
            'description': description,
            'count': len(records),
            'flows': records
        }, f, indent=2)
    
    print(f"✅ Created {filename} - {description}")

def create_batch_files():
    """Create batch files for testing"""
    
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Load development dataset
    print("🔄 Loading dataset...")
    df = pd.read_csv('datasets/development.csv')
    print(f"📊 Total flows: {len(df):,}")
    
    # Get attack and benign flows
    attack_flows = df[df['Label'] == 1]
    benign_flows = df[df['Label'] == 0]
    
    print(f"  - Attacks: {len(attack_flows):,}")
    print(f"  - Benign: {len(benign_flows):,}\n")
    
    # Batch 1: First 10 attacks
    save_batch(
        attack_flows.head(BATCH_SIZE),
        'batch_01_attacks.txt',
        'First 10 Attack Flows'
    )
    
    # Batch 2: First 10 benign
    save_batch(
        benign_flows.head(BATCH_SIZE),
        'batch_02_benign.txt',
        'First 10 Benign Flows'
    )
    
    # Batch 3: Random attacks
    save_batch(
        attack_flows.sample(n=BATCH_SIZE, random_state=42),
        'batch_03_random_attacks.txt',
        'Random 10 Attack Flows'
    )
    
    # Batch 4: Mixed (5 attack + 5 benign)
    mixed_df = pd.concat([
        attack_flows.head(5),
        benign_flows.head(5)
    ])
    save_batch(
        mixed_df,
        'batch_04_mixed.txt',
        'Mixed: 5 Attacks + 5 Benign'
    )
    
    # Batch 5: High-port attacks (common in certain attack types)
    high_port_attacks = attack_flows[attack_flows['DST_PORT'] > 1024].head(BATCH_SIZE)
    if len(high_port_attacks) >= BATCH_SIZE:
        save_batch(
            high_port_attacks,
            'batch_05_high_port_attacks.txt',
            'Attacks on High Ports (>1024)'
        )
    
    print(f"\n✨ Done! Created batches in '{OUTPUT_DIR}/' directory")
    print(f"\n💡 To test with Cline:")
    print(f"   1. Open batch_01_attacks.txt")
    print(f"   2. Ask Cline to analyze these flows for attacks")
    print(f"   3. See which MCP tools it calls automatically")

if __name__ == "__main__":
    create_batch_files()
