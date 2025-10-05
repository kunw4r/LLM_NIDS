#!/usr/bin/env python3
"""
Dataset Splitter for CICIDS2018 NetFlow Data
Splits the dataset into development, validation, and test sets with stratified sampling
"""

import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split

# Configuration
INPUT_FILE = "f78acbaa2afe1595_NFV3DATA-A11964_A11964/data/NF-CICIDS2018-v3.csv"
OUTPUT_DIR = Path("datasets")

# Split ratios
DEV_RATIO = 0.35      # Development set (tools can access during building)
VAL_RATIO = 0.25      # Validation set (for tuning)
TEST_RATIO = 0.40     # Test set (final evaluation only - NEVER touch!)

# Random seed for reproducibility
RANDOM_STATE = 42

def load_and_analyze_data(filepath):
    """Load the dataset and show statistics"""
    print(f"📊 Loading dataset from: {filepath}")
    df = pd.read_csv(filepath)
    
    print(f"\n✅ Loaded {len(df):,} flows")
    print(f"📏 Features: {len(df.columns)}")
    
    # Show attack distribution
    print("\n🎯 Attack Type Distribution:")
    attack_counts = df['Attack'].value_counts()
    for attack, count in attack_counts.items():
        percentage = (count / len(df)) * 100
        print(f"  {attack:30s}: {count:10,} ({percentage:5.2f}%)")
    
    return df

def stratified_split(df):
    """Split dataset with stratification to preserve attack type ratios"""
    print(f"\n🔀 Splitting dataset...")
    print(f"  Development: {DEV_RATIO*100:.0f}%")
    print(f"  Validation:  {VAL_RATIO*100:.0f}%")
    print(f"  Test:        {TEST_RATIO*100:.0f}%")
    
    # First split: separate test set
    train_val_df, test_df = train_test_split(
        df,
        test_size=TEST_RATIO,
        stratify=df['Attack'],
        random_state=RANDOM_STATE
    )
    
    # Second split: separate dev and validation from remaining data
    dev_size = DEV_RATIO / (DEV_RATIO + VAL_RATIO)
    dev_df, val_df = train_test_split(
        train_val_df,
        train_size=dev_size,
        stratify=train_val_df['Attack'],
        random_state=RANDOM_STATE
    )
    
    return dev_df, val_df, test_df

def verify_splits(dev_df, val_df, test_df):
    """Verify that splits maintain attack type distributions"""
    print("\n✓ Verifying splits...")
    
    total = len(dev_df) + len(val_df) + len(test_df)
    print(f"\n  Development: {len(dev_df):10,} flows ({len(dev_df)/total*100:5.2f}%)")
    print(f"  Validation:  {len(val_df):10,} flows ({len(val_df)/total*100:5.2f}%)")
    print(f"  Test:        {len(test_df):10,} flows ({len(test_df)/total*100:5.2f}%)")
    
    # Check each attack type is represented
    print("\n  Attack type representation:")
    all_attacks = set(dev_df['Attack'].unique()) | set(val_df['Attack'].unique()) | set(test_df['Attack'].unique())
    
    for attack in sorted(all_attacks):
        dev_count = len(dev_df[dev_df['Attack'] == attack])
        val_count = len(val_df[val_df['Attack'] == attack])
        test_count = len(test_df[test_df['Attack'] == attack])
        total_attack = dev_count + val_count + test_count
        
        print(f"    {attack:30s}: Dev={dev_count:7,} Val={val_count:7,} Test={test_count:7,}")

def save_splits(dev_df, val_df, test_df, output_dir):
    """Save the splits to separate CSV files"""
    output_dir.mkdir(exist_ok=True)
    
    print(f"\n💾 Saving splits to: {output_dir}/")
    
    dev_path = output_dir / "development.csv"
    val_path = output_dir / "validation.csv"
    test_path = output_dir / "test.csv"
    
    dev_df.to_csv(dev_path, index=False)
    print(f"  ✓ Development set: {dev_path}")
    
    val_df.to_csv(val_path, index=False)
    print(f"  ✓ Validation set:  {val_path}")
    
    test_df.to_csv(test_path, index=False)
    print(f"  ✓ Test set:        {test_path}")
    
    # Create a README
    readme_path = output_dir / "README.md"
    with open(readme_path, 'w') as f:
        f.write(f"""# CICIDS2018 NetFlow Dataset Splits

Generated on: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}
Random seed: {RANDOM_STATE}

## Split Ratios
- **Development** ({DEV_RATIO*100:.0f}%): {len(dev_df):,} flows - Use for building tools and understanding patterns
- **Validation** ({VAL_RATIO*100:.0f}%): {len(val_df):,} flows - Use for tuning thresholds and testing
- **Test** ({TEST_RATIO*100:.0f}%): {len(test_df):,} flows - **NEVER use during development!** Final evaluation only

## Important Rules
1. ⚠️ **NEVER** let the LLM or tools see the test set during development
2. Build all detection rules using only the development set
3. Tune thresholds using the validation set
4. Evaluate final performance on the test set once at the end

## Attack Distribution
All three sets maintain the same proportions of each attack type (stratified split).

## Files
- `development.csv` - For tool development and pattern learning
- `validation.csv` - For threshold tuning and intermediate testing
- `test.csv` - For final evaluation (🔒 DO NOT TOUCH until ready!)
""")
    print(f"  ✓ README:          {readme_path}")

def main():
    print("=" * 70)
    print("  CICIDS2018 Dataset Splitter for NIDS Research")
    print("=" * 70)
    
    # Load data
    df = load_and_analyze_data(INPUT_FILE)
    
    # Split
    dev_df, val_df, test_df = stratified_split(df)
    
    # Verify
    verify_splits(dev_df, val_df, test_df)
    
    # Save
    save_splits(dev_df, val_df, test_df, OUTPUT_DIR)
    
    print("\n" + "=" * 70)
    print("✅ Dataset split complete!")
    print("=" * 70)
    print("\n💡 Next steps:")
    print("  1. Use 'datasets/development.csv' when building MCP tools")
    print("  2. Use 'datasets/validation.csv' for testing and tuning")
    print("  3. Keep 'datasets/test.csv' locked until final evaluation!")
    print()

if __name__ == "__main__":
    main()
