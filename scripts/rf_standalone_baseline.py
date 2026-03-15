#!/usr/bin/env python3
"""
RF Standalone Baseline — Run the Tier 1 Random Forest as a standalone
classifier on all 14 Stage 1 batches and report per-attack F1/recall/FPR.

This provides the head-to-head comparison that RQ1 needs: how does the
cheap ML classifier compare to the full AMATAS 6-agent LLM pipeline?
"""

import json
import joblib
import numpy as np
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).parent.parent
MODEL_PATH = ROOT / "models" / "tier1_rf.pkl"
BATCHES_DIR = ROOT / "data" / "batches" / "stage1"
RESULTS_DIR = ROOT / "results" / "stage1"

FEATURES = [
    "L4_SRC_PORT", "L4_DST_PORT", "PROTOCOL",
    "FLOW_DURATION_MILLISECONDS", "SRC_TO_DST_IAT_MAX", "DST_TO_SRC_IAT_MAX",
    "IN_BYTES", "OUT_BYTES", "IN_PKTS", "OUT_PKTS", "TCP_FLAGS", "DNS_QUERY_ID",
]

# AMATAS Stage 1 results for comparison
AMATAS_RESULTS = {
    "FTP-BruteForce": {"recall": 100.0, "fpr": 0.0, "f1": 100.0},
    "SSH-Bruteforce": {"recall": 98.0, "fpr": 0.0, "f1": 99.0},
    "DoS_attacks-SlowHTTPTest": {"recall": 100.0, "fpr": 0.0, "f1": 100.0},
    "DoS_attacks-Slowloris": {"recall": 100.0, "fpr": 0.0, "f1": 100.0},
    "DoS_attacks-Hulk": {"recall": 92.0, "fpr": 0.0, "f1": 96.0},
    "DoS_attacks-GoldenEye": {"recall": 92.0, "fpr": 0.0, "f1": 96.0},
    "DDoS_attacks-LOIC-HTTP": {"recall": 82.0, "fpr": 0.0, "f1": 90.0},
    "DDOS_attack-HOIC": {"recall": 58.0, "fpr": 0.0, "f1": 72.0},
    "DDOS_attack-LOIC-UDP": {"recall": 100.0, "fpr": 0.0, "f1": 96.0},
    "Bot": {"recall": 82.0, "fpr": 1.0, "f1": 85.0},
    "Infilteration": {"recall": 0.0, "fpr": 0.0, "f1": 0.0},
    "Brute_Force_-Web": {"recall": 86.0, "fpr": 0.0, "f1": 89.0},
    "Brute_Force_-XSS": {"recall": 84.0, "fpr": 0.0, "f1": 89.0},
    "SQL_Injection": {"recall": 98.0, "fpr": 0.0, "f1": 96.0},
}


def evaluate_rf_on_batch(clf, batch_dir):
    """Run RF as standalone binary classifier on a batch."""
    flows_path = batch_dir / "flows.json"
    gt_path = batch_dir / "ground_truth.json"

    if not flows_path.exists() or not gt_path.exists():
        return None

    with open(flows_path) as f:
        flows = json.load(f)
    with open(gt_path) as f:
        gt_data = json.load(f)

    # Handle ground truth format
    if isinstance(gt_data, dict) and "ground_truth" in gt_data:
        gt_list = gt_data["ground_truth"]
    elif isinstance(gt_data, list):
        gt_list = gt_data
    else:
        return None

    # Build label lookup
    labels = {}
    for entry in gt_list:
        fid = str(entry.get("flow_id", ""))
        labels[fid] = int(entry.get("label", 0))

    # Build feature matrix
    X = []
    y_true = []
    for flow in flows:
        fid = str(flow.get("flow_id", ""))
        if fid not in labels:
            continue
        row = [float(flow.get(feat, 0) or 0) for feat in FEATURES]
        X.append(row)
        y_true.append(labels[fid])

    X = np.array(X)
    y_true = np.array(y_true)

    # RF predictions (binary: class 1 = attack)
    y_pred = clf.predict(X)
    probs = clf.predict_proba(X)[:, 1]

    # Confusion matrix
    tp = int(((y_pred == 1) & (y_true == 1)).sum())
    fp = int(((y_pred == 1) & (y_true == 0)).sum())
    fn = int(((y_pred == 0) & (y_true == 1)).sum())
    tn = int(((y_pred == 0) & (y_true == 0)).sum())

    n_attack = int(y_true.sum())
    n_benign = int((y_true == 0).sum())

    recall = tp / n_attack * 100 if n_attack > 0 else 0
    fpr = fp / n_benign * 100 if n_benign > 0 else 0
    precision = tp / (tp + fp) * 100 if (tp + fp) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    return {
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "recall": round(recall, 1),
        "fpr": round(fpr, 1),
        "precision": round(precision, 1),
        "f1": round(f1, 1),
        "n_attack": n_attack,
        "n_benign": n_benign,
        "mean_attack_prob": round(float(probs[y_true == 1].mean()), 4) if n_attack > 0 else 0,
        "mean_benign_prob": round(float(probs[y_true == 0].mean()), 4) if n_benign > 0 else 0,
    }


def main():
    bundle = joblib.load(MODEL_PATH)
    clf = bundle["model"]

    print("=" * 90)
    print("  RF STANDALONE BASELINE vs AMATAS")
    print("=" * 90)

    # Find all batch directories
    batch_dirs = sorted([d for d in BATCHES_DIR.iterdir()
                         if d.is_dir() and (d / "flows.json").exists()
                         and d.name != "validation" and d.name != "cost_test"])

    results = {}
    for batch_dir in batch_dirs:
        attack_type = batch_dir.name
        result = evaluate_rf_on_batch(clf, batch_dir)
        if result:
            results[attack_type] = result

    # Print comparison table
    print(f"\n  {'Attack Type':<30} {'RF F1':>7} {'RF Rec':>7} {'RF FPR':>7} | {'AMA F1':>7} {'AMA Rec':>7} | {'F1 Diff':>8}")
    print(f"  {'─'*30} {'─'*7} {'─'*7} {'─'*7}   {'─'*7} {'─'*7}   {'─'*8}")

    rf_f1s = []
    ama_f1s = []
    rf_recalls = []
    ama_recalls = []

    for attack_type in sorted(results.keys()):
        r = results[attack_type]
        a = AMATAS_RESULTS.get(attack_type, {})
        ama_f1 = a.get("f1", 0)
        ama_rec = a.get("recall", 0)
        f1_diff = r["f1"] - ama_f1

        rf_f1s.append(r["f1"])
        ama_f1s.append(ama_f1)
        rf_recalls.append(r["recall"])
        ama_recalls.append(ama_rec)

        marker = "←RF" if r["f1"] > ama_f1 else "←AMA" if ama_f1 > r["f1"] else "  TIE"
        print(f"  {attack_type:<30} {r['f1']:>6.1f}% {r['recall']:>6.1f}% {r['fpr']:>6.1f}% | {ama_f1:>6.1f}% {ama_rec:>6.1f}% | {f1_diff:>+7.1f}% {marker}")

    # Averages
    if rf_f1s:
        print(f"  {'─'*30} {'─'*7} {'─'*7} {'─'*7}   {'─'*7} {'─'*7}   {'─'*8}")
        rf_mean_f1 = np.mean(rf_f1s)
        ama_mean_f1 = np.mean(ama_f1s)
        rf_mean_rec = np.mean(rf_recalls)
        ama_mean_rec = np.mean(ama_recalls)
        print(f"  {'MEAN':<30} {rf_mean_f1:>6.1f}% {rf_mean_rec:>6.1f}% {'':>7} | {ama_mean_f1:>6.1f}% {ama_mean_rec:>6.1f}% | {rf_mean_f1-ama_mean_f1:>+7.1f}%")

        # Exclude infiltration
        rf_no_inf = [f for f, at in zip(rf_f1s, sorted(results.keys())) if at != "Infilteration"]
        ama_no_inf = [f for f, at in zip(ama_f1s, sorted(results.keys())) if at != "Infilteration"]
        if rf_no_inf:
            print(f"  {'MEAN (excl. Infiltration)':<30} {np.mean(rf_no_inf):>6.1f}% {'':>7} {'':>7} | {np.mean(ama_no_inf):>6.1f}% {'':>7} | {np.mean(rf_no_inf)-np.mean(ama_no_inf):>+7.1f}%")

    # Count wins
    rf_wins = sum(1 for r, a in zip(rf_f1s, ama_f1s) if r > a)
    ama_wins = sum(1 for r, a in zip(rf_f1s, ama_f1s) if a > r)
    ties = sum(1 for r, a in zip(rf_f1s, ama_f1s) if r == a)
    print(f"\n  Wins: RF={rf_wins}, AMATAS={ama_wins}, Ties={ties}")

    # Save JSON
    output = {
        "per_attack": results,
        "amatas_comparison": AMATAS_RESULTS,
        "summary": {
            "rf_mean_f1": round(float(np.mean(rf_f1s)), 1),
            "amatas_mean_f1": round(float(np.mean(ama_f1s)), 1),
            "rf_wins": rf_wins,
            "amatas_wins": ama_wins,
            "ties": ties,
        }
    }
    output_path = RESULTS_DIR / "rf_standalone_baseline.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n  Results saved to: {output_path}")


if __name__ == "__main__":
    main()
