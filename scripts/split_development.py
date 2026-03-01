#!/usr/bin/env python3
"""
Split development.csv into dev_train.csv (80%) and dev_eval.csv (20%).

Stratified by attack type to ensure all 7 dev-split attack types
appear in both splits proportionally.

This fixes within-split RF overlap: train RF on dev_train only,
source evaluation batches from dev_eval only.
"""

import os
import time
import pandas as pd
from sklearn.model_selection import train_test_split

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEV_CSV = os.path.join(ROOT, "data", "datasets", "development.csv")
TRAIN_CSV = os.path.join(ROOT, "data", "datasets", "dev_train.csv")
EVAL_CSV = os.path.join(ROOT, "data", "datasets", "dev_eval.csv")


def main():
    print("=" * 60)
    print("Splitting development.csv → dev_train (80%) + dev_eval (20%)")
    print("=" * 60)

    print(f"\nLoading {DEV_CSV} ...")
    t0 = time.time()
    df = pd.read_csv(DEV_CSV)
    print(f"  Loaded {len(df):,} rows in {time.time() - t0:.1f}s")

    # Use 'Attack' column for stratification (or 'Label' if Attack doesn't exist)
    strat_col = "Attack" if "Attack" in df.columns else "Label"
    print(f"  Stratifying on: {strat_col}")

    # Show class distribution
    dist = df[strat_col].value_counts()
    print(f"\n  Class distribution:")
    for cls, count in dist.items():
        print(f"    {cls}: {count:,} ({count/len(df)*100:.1f}%)")

    # Split 80/20 stratified
    print(f"\nSplitting 80/20 (seed=42, stratified) ...")
    t0 = time.time()
    train_df, eval_df = train_test_split(
        df, test_size=0.2, random_state=42, stratify=df[strat_col]
    )
    print(f"  Split in {time.time() - t0:.1f}s")
    print(f"  Train: {len(train_df):,} rows")
    print(f"  Eval:  {len(eval_df):,} rows")

    # Verify stratification
    print(f"\n  Eval split distribution:")
    eval_dist = eval_df[strat_col].value_counts()
    for cls, count in eval_dist.items():
        if cls != "Benign":
            print(f"    {cls}: {count:,}")

    # Save
    print(f"\nSaving {TRAIN_CSV} ...")
    t0 = time.time()
    train_df.to_csv(TRAIN_CSV, index=False)
    print(f"  Saved in {time.time() - t0:.1f}s")

    print(f"Saving {EVAL_CSV} ...")
    t0 = time.time()
    eval_df.to_csv(EVAL_CSV, index=False)
    print(f"  Saved in {time.time() - t0:.1f}s")

    print(f"\nDone! Files:")
    print(f"  {TRAIN_CSV} ({len(train_df):,} rows)")
    print(f"  {EVAL_CSV} ({len(eval_df):,} rows)")


if __name__ == "__main__":
    main()
