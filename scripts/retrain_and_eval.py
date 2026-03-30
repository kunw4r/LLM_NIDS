#!/usr/bin/env python3
"""
Retrain RF on dev+validation, evaluate all 14 types on held-out test split.

This is the gold-standard evaluation:
  1. RF trained on development + validation (12M flows, all 14 attack types)
  2. Stage 1 evaluation on test split (8M flows, never seen by RF)
  3. No data leakage possible — test split is completely held out

Usage:
    python scripts/retrain_and_eval.py              # full pipeline
    python scripts/retrain_and_eval.py --skip-train  # reuse model, just eval
    python scripts/retrain_and_eval.py --only Bot    # single type
"""

import json
import os
import subprocess
import sys
import time
import numpy as np
import pandas as pd
import joblib
from datetime import datetime, timezone
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

# ── Paths ─────────────────────────────────────────────────────────────────────
DEV_CSV = PROJECT_ROOT / "data" / "datasets" / "development.csv"
VAL_CSV = PROJECT_ROOT / "data" / "datasets" / "validation.csv"
TEST_CSV = PROJECT_ROOT / "data" / "datasets" / "test.csv"

MODEL_DIR = PROJECT_ROOT / "models"
NEW_MODEL_PATH = MODEL_DIR / "tier1_rf_allattacks.pkl"
ORIG_MODEL_PATH = MODEL_DIR / "tier1_rf.pkl"

RESULTS_DIR = PROJECT_ROOT / "results" / "stage1_test"
BATCHES_DIR = PROJECT_ROOT / "data" / "batches" / "stage1_test"
SUMMARY_FILE = RESULTS_DIR / "running_summary_test.json"

PYTHON = sys.executable

# ── Config ────────────────────────────────────────────────────────────────────
SEED = 42
N_ATTACK = 50
N_BENIGN = 950
BATCH_COST_LIMIT = 5.00
RF_THRESHOLD = 0.15

# RF features (must match tier1_filter.py)
RF_FEATURES = [
    "L4_SRC_PORT", "L4_DST_PORT", "PROTOCOL",
    "FLOW_DURATION_MILLISECONDS", "SRC_TO_DST_IAT_MAX", "DST_TO_SRC_IAT_MAX",
    "IN_BYTES", "OUT_BYTES", "IN_PKTS", "OUT_PKTS",
    "TCP_FLAGS", "DNS_QUERY_ID",
]

# Batch features
EXTRACT_COLS = [
    "FLOW_START_MILLISECONDS",
    "IPV4_SRC_ADDR", "IPV4_DST_ADDR", "L4_SRC_PORT", "L4_DST_PORT",
    "PROTOCOL", "FLOW_DURATION_MILLISECONDS",
    "SRC_TO_DST_IAT_MAX", "DST_TO_SRC_IAT_MAX",
    "IN_BYTES", "OUT_BYTES", "IN_PKTS", "OUT_PKTS",
    "TCP_FLAGS", "DNS_QUERY_ID",
]
LABEL_COLS = ["Label", "Attack"]
READ_COLS = EXTRACT_COLS + LABEL_COLS

ATTACK_TYPES = [
    "FTP-BruteForce", "SSH-Bruteforce", "DDoS_attacks-LOIC-HTTP",
    "DoS_attacks-Hulk", "DoS_attacks-SlowHTTPTest", "DoS_attacks-GoldenEye",
    "DoS_attacks-Slowloris", "DDOS_attack-HOIC", "DDOS_attack-LOIC-UDP",
    "Bot", "Infilteration", "Brute_Force_-Web", "Brute_Force_-XSS", "SQL_Injection",
]


def log(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", flush=True)


# ══════════════════════════════════════════════════════════════════════════════
# STEP 1: RETRAIN RF ON DEV + VALIDATION
# ══════════════════════════════════════════════════════════════════════════════

def train_rf():
    """Train a new RF on development + validation combined."""
    log("STEP 1: Training RF on development + validation")
    log(f"  Loading development.csv...")
    dev = pd.read_csv(DEV_CSV)
    log(f"  Loaded {len(dev):,} dev flows")

    log(f"  Loading validation.csv...")
    val = pd.read_csv(VAL_CSV)
    log(f"  Loaded {len(val):,} val flows")

    combined = pd.concat([dev, val], ignore_index=True)
    log(f"  Combined: {len(combined):,} flows")

    # Show attack distribution
    attack_counts = combined[combined["Attack"] != "Benign"]["Attack"].value_counts()
    log(f"  Attack types in training data:")
    for at, count in attack_counts.items():
        log(f"    {at:30s} {count:>8,}")
    log(f"  Benign: {(combined['Attack'] == 'Benign').sum():,}")

    # Prepare features and labels
    X = combined[RF_FEATURES].fillna(0).values.astype(np.float32)
    y = (combined["Attack"] != "Benign").astype(int).values

    log(f"  Training RandomForest (n_estimators=100, max_depth=20)...")
    t0 = time.time()
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=20,
        min_samples_split=10,
        min_samples_leaf=5,
        max_features="sqrt",
        class_weight="balanced",
        random_state=SEED,
        n_jobs=-1,
    )
    clf.fit(X, y)
    elapsed = time.time() - t0
    log(f"  Training complete in {elapsed:.0f}s")

    # Quick validation on training data
    y_pred = clf.predict(X)
    train_acc = (y_pred == y).mean()
    log(f"  Training accuracy: {train_acc:.4f}")

    # Check threshold on training data
    probs = clf.predict_proba(X)[:, 1]
    attack_mask = y == 1
    benign_mask = y == 0
    attacks_below_threshold = (probs[attack_mask] < RF_THRESHOLD).sum()
    benign_above_threshold = (probs[benign_mask] >= RF_THRESHOLD).sum()
    log(f"  At threshold {RF_THRESHOLD}:")
    log(f"    Attacks missed (P < {RF_THRESHOLD}): {attacks_below_threshold} / {attack_mask.sum()} ({attacks_below_threshold/attack_mask.sum()*100:.2f}%)")
    log(f"    Benign flagged (P >= {RF_THRESHOLD}): {benign_above_threshold} / {benign_mask.sum()} ({benign_above_threshold/benign_mask.sum()*100:.2f}%)")

    # Save model
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model": clf,
        "features": RF_FEATURES,
        "threshold": RF_THRESHOLD,
        "training_source": "development.csv + validation.csv",
        "training_flows": len(combined),
        "training_attacks": int(attack_mask.sum()),
        "training_benign": int(benign_mask.sum()),
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    joblib.dump(bundle, NEW_MODEL_PATH)
    log(f"  Model saved to {NEW_MODEL_PATH}")

    # Quick test-set preview
    log(f"\n  Quick preview on test set...")
    test_sample = pd.read_csv(TEST_CSV, nrows=50000)
    X_test = test_sample[RF_FEATURES].fillna(0).values.astype(np.float32)
    y_test = (test_sample["Attack"] != "Benign").astype(int).values
    probs_test = clf.predict_proba(X_test)[:, 1]

    test_attacks = y_test == 1
    test_benign = y_test == 0
    test_attacks_caught = (probs_test[test_attacks] >= RF_THRESHOLD).sum()
    test_benign_flagged = (probs_test[test_benign] >= RF_THRESHOLD).sum()
    log(f"    Test attacks caught at 0.15: {test_attacks_caught} / {test_attacks.sum()} ({test_attacks_caught/max(test_attacks.sum(),1)*100:.1f}%)")
    log(f"    Test benign flagged at 0.15: {test_benign_flagged} / {test_benign.sum()} ({test_benign_flagged/max(test_benign.sum(),1)*100:.1f}%)")

    return NEW_MODEL_PATH


# ══════════════════════════════════════════════════════════════════════════════
# STEP 2: CREATE BATCHES FROM TEST SPLIT
# ══════════════════════════════════════════════════════════════════════════════

def create_batch(attack_type):
    """Create a 1000-flow batch from test.csv."""
    batch_dir = BATCHES_DIR / attack_type
    batch_dir.mkdir(parents=True, exist_ok=True)

    flows_file = batch_dir / "flows.json"
    if flows_file.exists():
        log(f"  Batch {attack_type} exists, reusing.")
        return batch_dir

    rng = np.random.RandomState(SEED)

    log(f"  Sourcing from test.csv...")
    # Sample attack flows
    attack_rows = []
    for chunk in pd.read_csv(TEST_CSV, chunksize=500_000, usecols=READ_COLS):
        mask = chunk["Attack"] == attack_type
        if mask.any():
            attack_rows.append(chunk[mask])
        if sum(len(df) for df in attack_rows) >= N_ATTACK * 3:
            break

    if not attack_rows:
        log(f"  ERROR: No {attack_type} flows in test.csv")
        return None

    attack_df = pd.concat(attack_rows, ignore_index=True)
    n_attack = min(N_ATTACK, len(attack_df))
    if n_attack < N_ATTACK:
        log(f"  WARNING: Only {len(attack_df)} {attack_type} flows, using all")
    sampled_attack = attack_df.sample(n=n_attack, random_state=rng)

    # Sample benign flows from same test split
    benign_rows = []
    for chunk in pd.read_csv(TEST_CSV, chunksize=500_000, usecols=READ_COLS):
        mask = chunk["Attack"] == "Benign"
        if mask.any():
            benign_rows.append(chunk[mask])
        if sum(len(df) for df in benign_rows) >= N_BENIGN * 3:
            break

    benign_df = pd.concat(benign_rows, ignore_index=True)
    sampled_benign = benign_df.sample(n=N_BENIGN, random_state=rng)

    # Combine and sort by IP then timestamp
    combined = pd.concat([sampled_attack, sampled_benign], ignore_index=True)
    combined = combined.sort_values(
        ["IPV4_SRC_ADDR", "FLOW_START_MILLISECONDS"],
        ascending=[True, True]
    ).reset_index(drop=True)

    # Write flows.json (features ONLY — no labels)
    flows = []
    for i, row in combined.iterrows():
        flow = {"flow_id": int(i)}
        for col in EXTRACT_COLS:
            val = row[col]
            if pd.isna(val):
                val = 0
            elif isinstance(val, (np.integer,)):
                val = int(val)
            elif isinstance(val, (np.floating,)):
                val = float(val)
            flow[col] = val
        flows.append(flow)

    with open(flows_file, "w") as f:
        json.dump(flows, f)

    # Write ground_truth.json (labels ONLY)
    gt = {"ground_truth": []}
    for i, row in combined.iterrows():
        is_attack = row["Attack"] != "Benign"
        gt["ground_truth"].append({
            "flow_id": str(int(i)),
            "label": 1 if is_attack else 0,
            "label_name": "Attack" if is_attack else "Benign",
            "attack_type": row["Attack"] if is_attack else "Benign",
        })

    with open(batch_dir / "ground_truth.json", "w") as f:
        json.dump(gt, f, indent=2)

    # Write metadata
    meta = {
        "batch_name": attack_type,
        "attack_type": attack_type,
        "source_csv": "test.csv",
        "attack_source": "test",
        "benign_source": "test",
        "n_attack": n_attack,
        "n_benign": N_BENIGN,
        "total_flows": len(combined),
        "seed": SEED,
        "rf_model": str(NEW_MODEL_PATH.name),
        "rf_trained_on": "development.csv + validation.csv",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "data_separation": "CLEAN — all flows from held-out test split, RF trained on dev+val",
    }
    with open(batch_dir / "batch_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    log(f"  Created: {n_attack} {attack_type} + {N_BENIGN} benign = {len(combined)} flows")
    return batch_dir


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3: RUN EXPERIMENTS
# ══════════════════════════════════════════════════════════════════════════════

def run_experiment(attack_type, batch_dir):
    """Run phase3_multiagent.py with the new RF model."""
    output_file = RESULTS_DIR / f"{attack_type}_results.json"

    if output_file.exists():
        log(f"  Result exists, skipping: {output_file.name}")
        return output_file

    cmd = [
        PYTHON, str(PROJECT_ROOT / "tests" / "phase3_multiagent.py"),
        "--batch", str(batch_dir),
        "--model", "gpt-4o",
        "--provider", "openai",
        "--specialist-model", "gpt-4o",
        "--specialist-provider", "openai",
        "--tier1",
        "--cost-limit", str(BATCH_COST_LIMIT),
        "--output", str(output_file),
    ]

    log(f"  Running experiment...")
    result = subprocess.run(cmd, capture_output=False, text=True)

    if result.returncode != 0:
        log(f"  ERROR: return code {result.returncode}")
        return None

    return output_file


def update_summary():
    """Aggregate results into summary file."""
    experiments = []
    for fname in sorted(RESULTS_DIR.iterdir()):
        if not fname.name.endswith("_results.json"):
            continue
        with open(fname) as f:
            data = json.load(f)

        results = data.get("results", [])
        if not results:
            continue

        tp = fp = fn = tn = 0
        for r in results:
            actual = r.get("label_actual", 0)
            predicted_pos = r.get("verdict", "BENIGN") in ("MALICIOUS", "SUSPICIOUS")
            if predicted_pos and actual == 1: tp += 1
            elif predicted_pos and actual == 0: fp += 1
            elif not predicted_pos and actual == 1: fn += 1
            else: tn += 1

        recall = tp / (tp + fn) * 100 if (tp + fn) > 0 else 0
        precision = tp / (tp + fp) * 100 if (tp + fp) > 0 else 0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
        fpr = fp / (fp + tn) * 100 if (fp + tn) > 0 else 0
        cost = sum(r.get("cost_usd", 0) for r in results)
        cost_per_tp = cost / tp if tp > 0 else float("inf")

        at = fname.name.replace("_results.json", "")
        experiments.append({
            "attack_type": at,
            "status": "complete",
            "recall": round(recall),
            "fpr": round(fpr, 1),
            "f1": round(f1),
            "cost": round(cost, 2),
            "cost_per_tp": round(cost_per_tp, 2) if cost_per_tp != float("inf") else None,
            "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
            "source": "test.csv (held-out)",
            "rf_model": "tier1_rf_allattacks.pkl (dev+val)",
        })

    summary = {
        "experiments": experiments,
        "metadata": {
            "description": "Stage 1 final evaluation — RF trained on dev+val, evaluated on held-out test",
            "rf_trained_on": "development.csv + validation.csv (12M flows)",
            "evaluated_on": "test.csv (8M flows, held-out)",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    }

    with open(SUMMARY_FILE, "w") as f:
        json.dump(summary, f, indent=2)

    log(f"Summary: {len(experiments)} experiments in {SUMMARY_FILE.name}")


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-train", action="store_true", help="Skip RF training, reuse existing model")
    parser.add_argument("--only", type=str, help="Run only this attack type")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    BATCHES_DIR.mkdir(parents=True, exist_ok=True)

    log("=" * 60)
    log("AMATAS Stage 1 — Final Test-Set Evaluation")
    log("RF: trained on dev+val | Eval: held-out test split")
    log("=" * 60)

    # Step 1: Train RF
    if args.skip_train and NEW_MODEL_PATH.exists():
        log(f"Skipping RF training — using {NEW_MODEL_PATH.name}")
        model_path = NEW_MODEL_PATH
    else:
        model_path = train_rf()

    # Check tier1_filter can use custom model
    # phase3_multiagent.py needs --tier1-model flag support
    # Let's check if it exists, otherwise swap the model file
    import subprocess as sp
    help_text = sp.run([PYTHON, str(PROJECT_ROOT / "tests" / "phase3_multiagent.py"), "--help"],
                       capture_output=True, text=True).stdout
    has_tier1_model_flag = "--tier1-model" in help_text

    if not has_tier1_model_flag:
        log("phase3_multiagent.py doesn't support --tier1-model flag")
        log("Swapping model files: backing up original, installing new model")
        backup_path = MODEL_DIR / "tier1_rf_original.pkl"
        if not backup_path.exists():
            os.rename(ORIG_MODEL_PATH, backup_path)
            log(f"  Backed up original to {backup_path.name}")
        else:
            log(f"  Backup already exists at {backup_path.name}")
        # Copy new model to original location
        import shutil
        shutil.copy2(NEW_MODEL_PATH, ORIG_MODEL_PATH)
        log(f"  Installed {NEW_MODEL_PATH.name} as {ORIG_MODEL_PATH.name}")

    # Step 2 & 3: Create batches and run experiments
    attack_types = [args.only] if args.only else ATTACK_TYPES
    total = len(attack_types)
    total_cost = 0

    for i, attack_type in enumerate(attack_types):
        log(f"\n{'─' * 60}")
        log(f"[{i+1}/{total}] {attack_type}")

        batch_dir = create_batch(attack_type)
        if not batch_dir:
            continue

        result_file = run_experiment(attack_type, batch_dir)
        if result_file and result_file.exists():
            with open(result_file) as f:
                rdata = json.load(f)
            cost = rdata.get("evaluation_metadata", {}).get("total_cost_usd", 0)
            total_cost += cost

            # Quick result
            meta = rdata.get("evaluation_metadata", {}).get("metrics", {})
            tier1 = rdata.get("evaluation_metadata", {}).get("tier1", {})
            log(f"  Recall: {meta.get('recall', 0)*100:.0f}%  F1: {meta.get('f1', 0)*100:.0f}%  "
                f"FPR: {meta.get('confusion', {}).get('fp', 0)} FP  "
                f"Cost: ${cost:.2f}  "
                f"RF filtered: {tier1.get('flows_filtered', 0)}  LLM: {tier1.get('flows_sent_to_llm', 0)}")

        update_summary()

    # Restore original model if we swapped
    if not has_tier1_model_flag:
        backup_path = MODEL_DIR / "tier1_rf_original.pkl"
        if backup_path.exists():
            os.rename(backup_path, ORIG_MODEL_PATH)
            log(f"\nRestored original RF model from backup")

    log(f"\n{'=' * 60}")
    log(f"All experiments complete. Total cost: ${total_cost:.2f}")
    log(f"Results: {RESULTS_DIR}")
    log(f"Summary: {SUMMARY_FILE}")
    log(f"{'=' * 60}")


if __name__ == "__main__":
    main()
