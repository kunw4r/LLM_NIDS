"""
Train Tier 1 Random Forest classifier for AMATAS pre-filtering.

Uses the 12 numeric Stage 1 features from development.csv to train a binary
classifier (Benign=0, Attack=1). Saves the model to models/tier1_rf.pkl,
then evaluates on the validation batch.

Usage:
    python scripts/train_tier1.py
"""

import json
import os
import sys
import time
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report, confusion_matrix, f1_score,
    precision_score, recall_score, accuracy_score,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The 12 numeric features from EXTRACT_COLS (excluding IPs and timestamp)
FEATURES = [
    "L4_SRC_PORT",
    "L4_DST_PORT",
    "PROTOCOL",
    "FLOW_DURATION_MILLISECONDS",
    "SRC_TO_DST_IAT_MAX",
    "DST_TO_SRC_IAT_MAX",
    "IN_BYTES",
    "OUT_BYTES",
    "IN_PKTS",
    "OUT_PKTS",
    "TCP_FLAGS",
    "DNS_QUERY_ID",
]

TRAIN_CSV = os.path.join(ROOT, "data", "datasets", "dev_train.csv")
MASTER_CSV = os.path.join(ROOT, "data", "f78acbaa2afe1595_NFV3DATA-A11964_A11964", "data", "NF-CICIDS2018-v3.csv")
MODEL_PATH = os.path.join(ROOT, "models", "tier1_rf.pkl")
VAL_FLOWS = os.path.join(ROOT, "data", "batches", "stage1", "validation", "flows.json")
VAL_LABELS = os.path.join(ROOT, "data", "batches", "stage1", "validation", "ground_truth.json")

# Estimated cost per flow for LLM analysis (from Phase 3 experiments)
LLM_COST_PER_FLOW = 0.065  # ~$6.50 per 100 flows


def train():
    print("=" * 60)
    print("STEP 1: Training Tier 1 Random Forest")
    print("=" * 60)

    csv_path = TRAIN_CSV
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Training data not found: {csv_path}. Must train on dev_train.csv (80% of development split) to avoid within-split overlap.")
    print(f"\nLoading {csv_path} ...")
    t0 = time.time()
    df = pd.read_csv(csv_path, usecols=FEATURES + ["Label"])
    print(f"  Loaded {len(df):,} rows in {time.time() - t0:.1f}s")

    # Fill NaN with 0 (some fields like DNS_QUERY_ID are often 0/NaN)
    df[FEATURES] = df[FEATURES].fillna(0)

    X = df[FEATURES].values
    y = df["Label"].values

    n_benign = (y == 0).sum()
    n_attack = (y == 1).sum()
    print(f"  Benign: {n_benign:,} ({n_benign/len(y)*100:.1f}%)")
    print(f"  Attack: {n_attack:,} ({n_attack/len(y)*100:.1f}%)")

    print(f"\nTraining RandomForest(n_estimators=100) ...")
    t0 = time.time()
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=20,
        min_samples_leaf=10,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    clf.fit(X, y)
    print(f"  Trained in {time.time() - t0:.1f}s")

    # Feature importance
    print("\nFeature importance:")
    for name, imp in sorted(
        zip(FEATURES, clf.feature_importances_), key=lambda x: -x[1]
    ):
        print(f"  {name:35s} {imp:.4f}")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump({"model": clf, "features": FEATURES}, MODEL_PATH)
    print(f"\nModel saved to {MODEL_PATH}")

    return clf


def evaluate(clf):
    print("\n" + "=" * 60)
    print("STEP 2: Evaluate on validation batch")
    print("=" * 60)

    with open(VAL_FLOWS) as f:
        flows = json.load(f)
    with open(VAL_LABELS) as f:
        gt_data = json.load(f)

    # Build label lookup
    gt_lookup = {}
    for entry in gt_data["ground_truth"]:
        gt_lookup[int(entry["flow_id"])] = {
            "label": int(entry["label"]),
            "label_name": entry["label_name"],
            "attack_type": entry.get("attack_type", "Unknown"),
        }

    # Build feature matrix from flows
    X_val = []
    y_true = []
    flow_ids = []
    for flow in flows:
        fid = int(flow["flow_id"])
        row = [float(flow.get(feat, 0) or 0) for feat in FEATURES]
        X_val.append(row)
        y_true.append(gt_lookup[fid]["label"])
        flow_ids.append(fid)

    X_val = np.array(X_val)
    y_true = np.array(y_true)

    y_prob = clf.predict_proba(X_val)[:, 1]  # attack probability

    n_total = len(y_true)
    n_attacks = (y_true == 1).sum()
    n_benign = (y_true == 0).sum()

    print(f"\nValidation batch: {n_total} flows ({n_attacks} attacks, {n_benign} benign)")

    # Show attack probability distribution
    print(f"\n--- Attack Probability Distribution ---")
    attack_probs = y_prob[y_true == 1]
    benign_probs = y_prob[y_true == 0]
    print(f"  Attack flows:  min={attack_probs.min():.3f}  "
          f"mean={attack_probs.mean():.3f}  max={attack_probs.max():.3f}")
    print(f"  Benign flows:  min={benign_probs.min():.3f}  "
          f"mean={benign_probs.mean():.3f}  max={benign_probs.max():.3f}")

    # Evaluate at multiple thresholds to find optimal
    # For Tier 1 pre-filter: we want HIGH recall (catch all attacks)
    # and accept more false positives (benign sent to LLM is OK, missing attacks is not)
    thresholds = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50]

    print(f"\n--- Threshold Sweep (Tier 1 = pre-filter, goal: recall ≥ 95%) ---")
    print(f"  {'Thresh':>7s}  {'Recall':>7s}  {'Filtered':>9s}  "
          f"{'→ LLM':>6s}  {'Missed':>7s}  {'Savings':>8s}")
    print(f"  {'-'*7}  {'-'*7}  {'-'*9}  {'-'*6}  {'-'*7}  {'-'*8}")

    best_threshold = 0.5
    best_savings_at_full_recall = 0

    for t in thresholds:
        y_pred_t = (y_prob >= t).astype(int)
        tp = ((y_pred_t == 1) & (y_true == 1)).sum()
        fn = ((y_pred_t == 0) & (y_true == 1)).sum()
        sent = (y_pred_t == 1).sum()
        filtered = n_total - sent
        recall = tp / n_attacks if n_attacks else 0
        savings_pct = filtered / n_total * 100

        marker = ""
        if recall >= 0.95 and savings_pct > best_savings_at_full_recall:
            best_savings_at_full_recall = savings_pct
            best_threshold = t
            marker = " ← best"

        print(f"  {t:7.2f}  {recall:6.1%}  {filtered:5d}/{n_total:3d}  "
              f"{sent:5d}  {fn:5d}    {savings_pct:5.1f}%{marker}")

    # Use the best threshold for detailed report
    print(f"\n{'='*60}")
    print(f"Detailed results at threshold = {best_threshold}")
    print(f"{'='*60}")

    y_pred = (y_prob >= best_threshold).astype(int)

    filtered_benign = (y_pred == 0).sum()
    sent_to_llm = (y_pred == 1).sum()
    attacks_sent = ((y_pred == 1) & (y_true == 1)).sum()
    attacks_missed = ((y_pred == 0) & (y_true == 1)).sum()
    benign_filtered = ((y_pred == 0) & (y_true == 0)).sum()
    benign_sent = ((y_pred == 1) & (y_true == 0)).sum()

    print(f"\n--- Tier 1 Filtering Results (threshold={best_threshold}) ---")
    print(f"  Filtered as benign (skip LLM):    {filtered_benign:4d} / {n_total}")
    print(f"  Sent to LLM for analysis:         {sent_to_llm:4d} / {n_total}")
    print(f"  Attacks correctly sent to LLM:     {attacks_sent:4d} / {n_attacks}  (recall)")
    print(f"  Attacks wrongly filtered out:      {attacks_missed:4d} / {n_attacks}  (MISSED!)")
    print(f"  Benign correctly filtered:         {benign_filtered:4d} / {n_benign}")
    print(f"  Benign unnecessarily sent to LLM:  {benign_sent:4d} / {n_benign}")

    filter_recall = attacks_sent / n_attacks if n_attacks else 0
    filter_rate = filtered_benign / n_total
    print(f"\n--- Key Metrics ---")
    print(f"  Filter recall (attacks passed through): {filter_recall:.1%}")
    print(f"  Filter rate (flows skipped):            {filter_rate:.1%}")
    print(f"  Accuracy:   {accuracy_score(y_true, y_pred):.3f}")
    print(f"  Precision:  {precision_score(y_true, y_pred, zero_division=0):.3f}")
    print(f"  Recall:     {recall_score(y_true, y_pred, zero_division=0):.3f}")
    print(f"  F1:         {f1_score(y_true, y_pred, zero_division=0):.3f}")

    print(f"\n--- Cost Estimate ---")
    cost_all = n_total * LLM_COST_PER_FLOW
    cost_filtered = sent_to_llm * LLM_COST_PER_FLOW
    savings = cost_all - cost_filtered
    print(f"  Without Tier 1: ${cost_all:.2f} ({n_total} flows x ${LLM_COST_PER_FLOW})")
    print(f"  With Tier 1:    ${cost_filtered:.2f} ({sent_to_llm} flows x ${LLM_COST_PER_FLOW})")
    print(f"  Savings:        ${savings:.2f} ({savings/cost_all*100:.0f}%)")

    print(f"\n--- Confusion Matrix (threshold={best_threshold}) ---")
    cm = confusion_matrix(y_true, y_pred)
    print(f"  {'':15s} Pred Benign  Pred Attack")
    print(f"  {'True Benign':15s} {cm[0][0]:11d}  {cm[0][1]:11d}")
    print(f"  {'True Attack':15s} {cm[1][0]:11d}  {cm[1][1]:11d}")

    # Show missed attacks detail
    if attacks_missed > 0:
        print(f"\n--- Missed Attacks (filtered out incorrectly) ---")
        for i, fid in enumerate(flow_ids):
            if y_true[i] == 1 and y_pred[i] == 0:
                gt = gt_lookup[fid]
                print(f"  Flow {fid}: {gt['attack_type']} "
                      f"(attack_prob={y_prob[i]:.3f})")

    print(f"\n{classification_report(y_true, y_pred, target_names=['Benign', 'Attack'], zero_division=0)}")

    # Save the recommended threshold
    joblib.dump({"model": clf, "features": FEATURES, "threshold": best_threshold},
                MODEL_PATH)
    print(f"Updated model with threshold={best_threshold} → {MODEL_PATH}")


if __name__ == "__main__":
    clf = train()
    evaluate(clf)
