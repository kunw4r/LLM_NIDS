#!/usr/bin/env python3
"""Stage 1 Inventory Scan — count flows per attack type across all 3 CSVs."""
import pandas as pd
import json
from pathlib import Path
from collections import Counter

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASETS = {
    "development": PROJECT_ROOT / "data" / "datasets" / "development.csv",
    "validation": PROJECT_ROOT / "data" / "datasets" / "validation.csv",
    "test": PROJECT_ROOT / "data" / "datasets" / "test.csv",
}

results = {}
for name, path in DATASETS.items():
    print(f"Scanning {name}...")
    counts = Counter()
    total = 0
    for chunk in pd.read_csv(path, chunksize=500_000, usecols=["Attack"]):
        total += len(chunk)
        counts.update(chunk["Attack"].value_counts().to_dict())
    results[name] = {"total": total, "attacks": dict(counts)}
    print(f"  {name}: {total:,} flows, {len(counts)} attack types")

# Combine across all splits
combined = Counter()
for name, data in results.items():
    combined.update(data["attacks"])

# Print table
print("\n" + "=" * 100)
print(f"{'Attack Type':<30} | {'development':>12} | {'validation':>12} | {'test':>12} | {'TOTAL':>12} | {'>=50?':>6}")
print("-" * 100)
all_types = sorted(combined.keys())
for attack in all_types:
    dev = results["development"]["attacks"].get(attack, 0)
    val = results["validation"]["attacks"].get(attack, 0)
    tst = results["test"]["attacks"].get(attack, 0)
    tot = combined[attack]
    enough = "YES" if tot >= 50 else "NO"
    print(f"{attack:<30} | {dev:>12,} | {val:>12,} | {tst:>12,} | {tot:>12,} | {enough:>6}")

print("-" * 100)
dev_tot = results["development"]["total"]
val_tot = results["validation"]["total"]
tst_tot = results["test"]["total"]
grand = dev_tot + val_tot + tst_tot
print(f"{'TOTAL':<30} | {dev_tot:>12,} | {val_tot:>12,} | {tst_tot:>12,} | {grand:>12,} |")
print("=" * 100)

# Summary
sufficient = [a for a, c in combined.items() if c >= 50 and a != "Benign"]
insufficient = [a for a, c in combined.items() if c < 50 and a != "Benign"]
print(f"\nSufficient attack types (>=50 flows): {len(sufficient)}")
for a in sorted(sufficient):
    print(f"  {a}: {combined[a]:,}")
if insufficient:
    print(f"\nINSUFFICIENT attack types (<50 flows): {len(insufficient)}")
    for a in sorted(insufficient):
        print(f"  {a}: {combined[a]:,} — SKIPPED")

# Save for downstream
output = {
    "per_split": results,
    "combined": dict(combined),
    "sufficient": sorted(sufficient),
    "insufficient": sorted(insufficient),
}
out_path = PROJECT_ROOT / "results" / "stage1" / "inventory.json"
with open(out_path, "w") as f:
    json.dump(output, f, indent=2)
print(f"\nInventory saved to {out_path}")
