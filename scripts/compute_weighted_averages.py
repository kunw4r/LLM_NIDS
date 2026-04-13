#!/usr/bin/env python3
"""
Compute weighted and unweighted averages across 14 attack types.

Weights are based on dataset prevalence (number of flows per attack type
in the combined CICIDS2018 dataset).

Outputs a summary JSON and prints a formatted table.

Usage:
    python scripts/compute_weighted_averages.py
"""

import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# ── Load data ────────────────────────────────────────────────────────────────

INVENTORY_FILE = PROJECT_ROOT / "results" / "stage1" / "inventory.json"
TEST_SUMMARY = PROJECT_ROOT / "results" / "stage1_test" / "running_summary_test.json"
OUTPUT_FILE = PROJECT_ROOT / "results" / "stage1_test" / "weighted_averages.json"

with open(INVENTORY_FILE) as f:
    inventory = json.load(f)

with open(TEST_SUMMARY) as f:
    test_data = json.load(f)

combined_counts = inventory["combined"]
experiments = test_data["experiments"]

# ── Compute ──────────────────────────────────────────────────────────────────

# Total attack flows (excluding benign)
total_attack_flows = sum(v for k, v in combined_counts.items() if k != "Benign")

print(f"{'Attack Type':<30} | {'Recall':>7} | {'F1':>5} | {'FPR':>5} | {'Weight':>8} | {'Flows':>10}")
print("-" * 85)

weighted_recall = 0.0
weighted_f1 = 0.0
weighted_fpr = 0.0
unweighted_recall = 0.0
unweighted_f1 = 0.0
unweighted_fpr = 0.0

# Micro-average accumulators (pooled confusion matrix)
total_tp = 0
total_fp = 0
total_fn = 0
total_tn = 0

rows = []
for exp in sorted(experiments, key=lambda e: e["recall"], reverse=True):
    at = exp["attack_type"]
    prevalence = combined_counts.get(at, 0)
    weight = prevalence / total_attack_flows if total_attack_flows > 0 else 1 / 14

    recall = exp["recall"]  # already in percentage
    f1 = exp["f1"]
    fpr = exp["fpr"]

    weighted_recall += recall * weight
    weighted_f1 += f1 * weight
    weighted_fpr += fpr * weight

    unweighted_recall += recall
    unweighted_f1 += f1
    unweighted_fpr += fpr

    # Micro-average: pool confusion matrices
    cm = exp["confusion"]
    total_tp += cm["tp"]
    total_fp += cm["fp"]
    total_fn += cm["fn"]
    total_tn += cm["tn"]

    rows.append({
        "attack_type": at,
        "recall": recall,
        "f1": f1,
        "fpr": fpr,
        "weight": round(weight, 4),
        "dataset_flows": prevalence,
    })

    print(f"{at:<30} | {recall:>6}% | {f1:>4}% | {fpr:>4}% | {weight:>7.2%} | {prevalence:>10,}")

n = len(experiments)
unweighted_recall /= n
unweighted_f1 /= n
unweighted_fpr /= n

# Micro-average metrics (pooled across all experiments)
micro_precision = total_tp / (total_tp + total_fp) if (total_tp + total_fp) > 0 else 0
micro_recall = total_tp / (total_tp + total_fn) if (total_tp + total_fn) > 0 else 0
micro_f1 = 2 * micro_precision * micro_recall / (micro_precision + micro_recall) if (micro_precision + micro_recall) > 0 else 0
micro_fpr = total_fp / (total_fp + total_tn) if (total_fp + total_tn) > 0 else 0

print("-" * 85)
print(f"\n{'Averaging Method':<35} | {'Recall':>7} | {'F1':>5} | {'FPR':>5}")
print("-" * 60)
print(f"{'Macro (unweighted) average':<35} | {unweighted_recall:>6.1f}% | {unweighted_f1:>4.1f}% | {unweighted_fpr:>4.2f}%")
print(f"{'Weighted average (by prevalence)':<35} | {weighted_recall:>6.1f}% | {weighted_f1:>4.1f}% | {weighted_fpr:>4.2f}%")
print(f"{'Micro average (pooled confusion)':<35} | {micro_recall*100:>6.1f}% | {micro_f1*100:>4.1f}% | {micro_fpr*100:>4.2f}%")

print(f"\nTotal attack flows in dataset: {total_attack_flows:,}")
print(f"Pooled confusion: TP={total_tp} FP={total_fp} FN={total_fn} TN={total_tn}")
print(f"Total test-set cost: ${sum(e['cost'] for e in experiments):.2f}")

# ── Save ─────────────────────────────────────────────────────────────────────

output = {
    "description": "Weighted and unweighted averages across 14 attack types (test-set evaluation)",
    "source": "results/stage1_test/running_summary_test.json",
    "n_attack_types": n,
    "total_attack_flows_in_dataset": total_attack_flows,
    "macro_average": {
        "recall": round(unweighted_recall, 2),
        "f1": round(unweighted_f1, 2),
        "fpr": round(unweighted_fpr, 3),
        "description": "Simple arithmetic mean across 14 attack types (each type weighted equally)",
    },
    "weighted_average": {
        "recall": round(weighted_recall, 2),
        "f1": round(weighted_f1, 2),
        "fpr": round(weighted_fpr, 3),
        "description": "Weighted by dataset prevalence (more common attacks have more influence)",
    },
    "micro_average": {
        "precision": round(micro_precision * 100, 2),
        "recall": round(micro_recall * 100, 2),
        "f1": round(micro_f1 * 100, 2),
        "fpr": round(micro_fpr * 100, 3),
        "pooled_confusion": {
            "tp": total_tp, "fp": total_fp, "fn": total_fn, "tn": total_tn,
        },
        "description": "Pooled confusion matrix across all 14 experiments (700 attack + 13300 benign flows)",
    },
    "per_attack": rows,
}

with open(OUTPUT_FILE, "w") as f:
    json.dump(output, f, indent=2)

print(f"\nSaved to {OUTPUT_FILE}")
