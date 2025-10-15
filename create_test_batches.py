#!/usr/bin/env python3
"""
Create NetFlow test batches with separated labels.
- batch_data/ contains unlabeled flows (for LLM analysis)
- labels/ contains ground truth (for evaluation)
"""

import pandas as pd
import json
import os

BATCH_SIZE = 10
BASE_DIR = 'netflow_batches'
DATA_DIR = os.path.join(BASE_DIR, 'batch_data')
LABELS_DIR = os.path.join(BASE_DIR, 'labels')

def create_directories():
    """Create directory structure"""
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(LABELS_DIR, exist_ok=True)

def save_batch_data(df, batch_num, description):
    """Save batch WITHOUT labels (for LLM to analyze)"""
    batch_folder = os.path.join(DATA_DIR, f'batch_{batch_num:02d}')
    os.makedirs(batch_folder, exist_ok=True)
    
    # Remove label columns from data
    data_df = df.drop(columns=['Label', 'Attack'], errors='ignore')
    
    # Save as text (human-readable)
    txt_file = os.path.join(batch_folder, 'flows.txt')
    with open(txt_file, 'w') as f:
        f.write(f"# {description}\n")
        f.write(f"# {len(data_df)} NetFlow records\n")
        f.write("=" * 80 + "\n\n")
        
        for idx, row in data_df.iterrows():
            f.write(f"Flow #{idx}\n")
            f.write("-" * 40 + "\n")
            for col, val in row.items():
                f.write(f"{col:30s}: {val}\n")
            f.write("\n")
    
    # Save as JSON
    json_file = os.path.join(batch_folder, 'flows.json')
    with open(json_file, 'w') as f:
        json.dump({
            'description': description,
            'count': len(data_df),
            'flows': data_df.to_dict('records')
        }, f, indent=2)
    
    # Save README
    readme_file = os.path.join(batch_folder, 'README.md')
    with open(readme_file, 'w') as f:
        f.write(f"# Batch {batch_num:02d}: {description}\n\n")
        f.write(f"**Total Flows**: {len(data_df)}\n\n")
        f.write("## Files\n")
        f.write("- `flows.txt` - Human-readable NetFlow records\n")
        f.write("- `flows.json` - Machine-readable JSON format\n\n")
        f.write("## Task\n")
        f.write("Analyze these NetFlow records and identify:\n")
        f.write("1. Which flows are malicious (if any)\n")
        f.write("2. What type of attack (if detected)\n")
        f.write("3. Confidence level for each prediction\n")
        f.write("4. MITRE ATT&CK techniques used\n\n")
        f.write("**Note**: Labels are hidden for blind evaluation\n")
    
    return data_df

def save_batch_labels(df, batch_num, description):
    """Save ground truth labels (separate from data)"""
    labels_file = os.path.join(LABELS_DIR, f'batch_{batch_num:02d}_labels.json')
    
    # Extract labels and create ground truth
    ground_truth = []
    for idx, row in df.iterrows():
        ground_truth.append({
            'flow_id': idx,
            'label': int(row['Label']),
            'label_name': 'Attack' if row['Label'] == 1 else 'Benign',
            'attack_type': row.get('Attack', 'N/A') if row['Label'] == 1 else None
        })
    
    # Save labels
    with open(labels_file, 'w') as f:
        json.dump({
            'batch': batch_num,
            'description': description,
            'total_flows': len(ground_truth),
            'attack_count': sum(1 for gt in ground_truth if gt['label'] == 1),
            'benign_count': sum(1 for gt in ground_truth if gt['label'] == 0),
            'ground_truth': ground_truth
        }, f, indent=2)
    
    print(f"✅ Batch {batch_num:02d}: {description}")
    print(f"   📁 Data: batch_data/batch_{batch_num:02d}/")
    print(f"   🏷️  Labels: labels/batch_{batch_num:02d}_labels.json")
    print(f"   📊 {len(ground_truth)} flows ({sum(1 for gt in ground_truth if gt['label'] == 1)} attacks, {sum(1 for gt in ground_truth if gt['label'] == 0)} benign)\n")

def create_batches():
    """Create all test batches"""
    
    print("🔄 Loading dataset...\n")
    df = pd.read_csv('datasets/development.csv')
    
    attack_flows = df[df['Label'] == 1]
    benign_flows = df[df['Label'] == 0]
    
    print(f"📊 Dataset loaded:")
    print(f"   Total: {len(df):,} flows")
    print(f"   Attacks: {len(attack_flows):,}")
    print(f"   Benign: {len(benign_flows):,}\n")
    
    create_directories()
    
    # Batch 1: Pure Attacks (first 10)
    batch_df = attack_flows.head(BATCH_SIZE)
    save_batch_data(batch_df, 1, "Pure Attacks (First 10)")
    save_batch_labels(batch_df, 1, "Pure Attacks (First 10)")
    
    # Batch 2: Pure Benign (first 10)
    batch_df = benign_flows.head(BATCH_SIZE)
    save_batch_data(batch_df, 2, "Pure Benign (First 10)")
    save_batch_labels(batch_df, 2, "Pure Benign (First 10)")
    
    # Batch 3: Random Attacks
    batch_df = attack_flows.sample(n=BATCH_SIZE, random_state=42)
    save_batch_data(batch_df, 3, "Random Attacks")
    save_batch_labels(batch_df, 3, "Random Attacks")
    
    # Batch 4: Mixed (5 attacks + 5 benign)
    batch_df = pd.concat([
        attack_flows.head(5),
        benign_flows.head(5)
    ])
    save_batch_data(batch_df, 4, "Mixed (5 Attacks + 5 Benign)")
    save_batch_labels(batch_df, 4, "Mixed (5 Attacks + 5 Benign)")
    
    # Batch 5: Harder Mixed (random interleaved)
    attack_sample = attack_flows.sample(n=5, random_state=99)
    benign_sample = benign_flows.sample(n=5, random_state=99)
    batch_df = pd.concat([attack_sample, benign_sample]).sample(frac=1, random_state=99)
    save_batch_data(batch_df, 5, "Random Mixed (Shuffled)")
    save_batch_labels(batch_df, 5, "Random Mixed (Shuffled)")
    
    # Batch 6: Mostly Benign (8 benign, 2 attacks)
    batch_df = pd.concat([
        benign_flows.head(8),
        attack_flows.head(2)
    ])
    save_batch_data(batch_df, 6, "Mostly Benign (8 Benign + 2 Attacks)")
    save_batch_labels(batch_df, 6, "Mostly Benign (8 Benign + 2 Attacks)")
    
    # Batch 7: Mostly Attacks (8 attacks, 2 benign)
    batch_df = pd.concat([
        attack_flows.head(8),
        benign_flows.head(2)
    ])
    save_batch_data(batch_df, 7, "Mostly Attacks (8 Attacks + 2 Benign)")
    save_batch_labels(batch_df, 7, "Mostly Attacks (8 Attacks + 2 Benign)")
    
    print("\n✨ Done!")
    print(f"\n📂 Structure created:")
    print(f"   {BASE_DIR}/")
    print(f"   ├── batch_data/        ← Give these to Cline (no labels)")
    print(f"   │   ├── batch_01/")
    print(f"   │   ├── batch_02/")
    print(f"   │   └── ...")
    print(f"   └── labels/            ← Ground truth (keep hidden)")
    print(f"       ├── batch_01_labels.json")
    print(f"       ├── batch_02_labels.json")
    print(f"       └── ...")
    
    print(f"\n💡 Next steps:")
    print(f"   1. Open batch_data/batch_01/flows.txt")
    print(f"   2. Ask Cline to analyze for attacks")
    print(f"   3. Record Cline's predictions")
    print(f"   4. Compare with labels/batch_01_labels.json")
    print(f"   5. Calculate accuracy metrics")

if __name__ == "__main__":
    create_batches()
