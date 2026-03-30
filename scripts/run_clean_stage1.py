#!/usr/bin/env python3
"""
Rerun all 14 Stage 1 experiments with clean data separation.

Ensures NO data leakage:
- RF was trained on dev_train.csv (80% of development split)
- For dev-split attack types: attacks from dev_eval.csv, benign from VALIDATION
- For val-split attack types: both from validation.csv
- For test-split attack types: both from test.csv
- XSS uses test split (only 19 flows in validation, 461 in test)

This eliminates the within-distribution benign filtering advantage that
produced artificially low FPR in the original Stage 1 results.

Usage:
    python scripts/run_clean_stage1.py
    python scripts/run_clean_stage1.py --dry-run    # just create batches
    python scripts/run_clean_stage1.py --only Bot    # run single type
"""

import json
import os
import subprocess
import sys
import time
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

# ── Data sources ──────────────────────────────────────────────────────────────
DEV_EVAL_CSV = PROJECT_ROOT / "data" / "datasets" / "dev_eval.csv"
VALIDATION_CSV = PROJECT_ROOT / "data" / "datasets" / "validation.csv"
TEST_CSV = PROJECT_ROOT / "data" / "datasets" / "test.csv"
DEVELOPMENT_CSV = PROJECT_ROOT / "data" / "datasets" / "development.csv"

RESULTS_DIR = PROJECT_ROOT / "results" / "stage1_clean"
BATCHES_DIR = PROJECT_ROOT / "data" / "batches" / "stage1_clean"
STATUS_FILE = RESULTS_DIR / "live_status.json"
SUMMARY_FILE = RESULTS_DIR / "running_summary_clean.json"

PYTHON = sys.executable

# ── Configuration ─────────────────────────────────────────────────────────────
SEED = 42
N_ATTACK = 50
N_BENIGN = 950
BATCH_COST_LIMIT = 5.00

# Feature columns to extract (must match phase3_multiagent.py expectations)
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

# ── Attack type → source split mapping ────────────────────────────────────────
# Key principle: benign flows MUST come from a split the RF never trained on
ATTACK_CONFIG = {
    # Dev-split types: attacks from dev_eval, benign from VALIDATION (not dev_eval!)
    "FTP-BruteForce":           {"attack_csv": "dev_eval",   "benign_csv": "validation"},
    "SSH-Bruteforce":           {"attack_csv": "dev_eval",   "benign_csv": "validation"},
    "DDoS_attacks-LOIC-HTTP":   {"attack_csv": "dev_eval",   "benign_csv": "validation"},
    "DoS_attacks-Hulk":         {"attack_csv": "dev_eval",   "benign_csv": "validation"},
    "DoS_attacks-SlowHTTPTest": {"attack_csv": "dev_eval",   "benign_csv": "validation"},
    "DoS_attacks-GoldenEye":    {"attack_csv": "dev_eval",   "benign_csv": "validation"},
    "DoS_attacks-Slowloris":    {"attack_csv": "dev_eval",   "benign_csv": "validation"},
    # Validation-split types: both from validation
    "DDOS_attack-HOIC":         {"attack_csv": "validation", "benign_csv": "validation"},
    "DDOS_attack-LOIC-UDP":     {"attack_csv": "validation", "benign_csv": "validation"},
    "Brute_Force_-Web":         {"attack_csv": "validation", "benign_csv": "validation"},
    "SQL_Injection":            {"attack_csv": "validation", "benign_csv": "validation"},
    # XSS: only 19 in validation, use test (461 available)
    "Brute_Force_-XSS":         {"attack_csv": "test",       "benign_csv": "test"},
    # Test-split types: both from test
    "Bot":                      {"attack_csv": "test",       "benign_csv": "test"},
    "Infilteration":            {"attack_csv": "test",       "benign_csv": "test"},
}

CSV_MAP = {
    "dev_eval": DEV_EVAL_CSV,
    "validation": VALIDATION_CSV,
    "test": TEST_CSV,
    "development": DEVELOPMENT_CSV,
}


def log(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", flush=True)


def create_batch(attack_type, config):
    """Create a 1000-flow batch with clean data separation."""
    slug = attack_type
    batch_dir = BATCHES_DIR / slug
    batch_dir.mkdir(parents=True, exist_ok=True)

    flows_file = batch_dir / "flows.json"
    if flows_file.exists():
        log(f"  Batch {slug} already exists, reusing.")
        return batch_dir

    rng = np.random.RandomState(SEED)
    attack_csv_path = CSV_MAP[config["attack_csv"]]
    benign_csv_path = CSV_MAP[config["benign_csv"]]

    log(f"  Attack source: {config['attack_csv']} ({attack_csv_path.name})")
    log(f"  Benign source: {config['benign_csv']} ({benign_csv_path.name})")

    if not attack_csv_path.exists():
        log(f"  ERROR: {attack_csv_path} not found!")
        return None
    if not benign_csv_path.exists():
        log(f"  ERROR: {benign_csv_path} not found!")
        return None

    # Sample attack flows
    attack_rows = []
    for chunk in pd.read_csv(attack_csv_path, chunksize=500_000, usecols=READ_COLS):
        mask = chunk["Attack"] == attack_type
        if mask.any():
            attack_rows.append(chunk[mask])
        if sum(len(df) for df in attack_rows) >= N_ATTACK * 3:
            break

    if not attack_rows:
        log(f"  ERROR: No {attack_type} flows found in {config['attack_csv']}")
        return None

    attack_df = pd.concat(attack_rows, ignore_index=True)
    n_attack = min(N_ATTACK, len(attack_df))
    if n_attack < N_ATTACK:
        log(f"  WARNING: Only {len(attack_df)} {attack_type} flows available, using all")
    sampled_attack = attack_df.sample(n=n_attack, random_state=rng)

    # Sample benign flows
    benign_rows = []
    for chunk in pd.read_csv(benign_csv_path, chunksize=500_000, usecols=READ_COLS):
        mask = chunk["Attack"] == "Benign"
        if mask.any():
            benign_rows.append(chunk[mask])
        if sum(len(df) for df in benign_rows) >= N_BENIGN * 3:
            break

    benign_df = pd.concat(benign_rows, ignore_index=True)
    sampled_benign = benign_df.sample(n=N_BENIGN, random_state=rng)

    # Combine and sort chronologically by source IP
    combined = pd.concat([sampled_attack, sampled_benign], ignore_index=True)
    combined = combined.sort_values(
        ["IPV4_SRC_ADDR", "FLOW_START_MILLISECONDS"],
        ascending=[True, True]
    ).reset_index(drop=True)

    # Write flows.json (features only — NO labels)
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

    # Write ground_truth.json (labels only — separate file)
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

    # Write batch_metadata.json (provenance)
    meta = {
        "batch_name": slug,
        "attack_type": attack_type,
        "attack_source_csv": config["attack_csv"],
        "benign_source_csv": config["benign_csv"],
        "n_attack": n_attack,
        "n_benign": N_BENIGN,
        "total_flows": len(combined),
        "seed": SEED,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "data_separation": "CLEAN — benign from different split than RF training data",
    }
    with open(batch_dir / "batch_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)

    log(f"  Created batch: {n_attack} {attack_type} + {N_BENIGN} benign = {len(combined)} flows")
    return batch_dir


def run_experiment(attack_type, batch_dir):
    """Run phase3_multiagent.py with --tier1 on the batch."""
    output_file = RESULTS_DIR / f"{attack_type}_results.json"

    if output_file.exists():
        log(f"  Result file exists, skipping: {output_file.name}")
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

    log(f"  Running: {' '.join(cmd[-8:])}")
    result = subprocess.run(cmd, capture_output=False, text=True)

    if result.returncode != 0:
        log(f"  ERROR: Experiment failed with return code {result.returncode}")
        return None

    return output_file


def update_summary():
    """Aggregate all clean results into running_summary_clean.json."""
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
        config = ATTACK_CONFIG.get(at, {})

        experiments.append({
            "attack_type": at,
            "status": "complete",
            "recall": round(recall),
            "fpr": round(fpr, 1),
            "f1": round(f1),
            "cost": round(cost, 2),
            "cost_per_tp": round(cost_per_tp, 2) if cost_per_tp != float("inf") else None,
            "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
            "attack_source": config.get("attack_csv", "unknown"),
            "benign_source": config.get("benign_csv", "unknown"),
        })

    summary = {
        "experiments": experiments,
        "metadata": {
            "description": "Stage 1 clean rerun — no within-distribution benign leakage",
            "rf_trained_on": "dev_train.csv (80% of development)",
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    }

    with open(SUMMARY_FILE, "w") as f:
        json.dump(summary, f, indent=2)

    log(f"Summary updated: {len(experiments)} experiments in {SUMMARY_FILE.name}")
    return summary


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Clean Stage 1 rerun")
    parser.add_argument("--dry-run", action="store_true", help="Create batches only, don't run experiments")
    parser.add_argument("--only", type=str, help="Run only this attack type")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    BATCHES_DIR.mkdir(parents=True, exist_ok=True)

    attack_types = [args.only] if args.only else list(ATTACK_CONFIG.keys())
    total = len(attack_types)
    total_cost = 0

    log(f"{'='*60}")
    log(f"AMATAS Stage 1 — Clean Rerun ({total} attack types)")
    log(f"Data separation: benign from different split than RF training")
    log(f"{'='*60}")

    # Check CSV availability
    for name, path in CSV_MAP.items():
        exists = path.exists()
        log(f"  {name}: {'OK' if exists else 'MISSING'} ({path.name})")
        if not exists and name in ("dev_eval", "validation", "test"):
            log(f"  ERROR: Required CSV missing. Run split_development.py first?")

    for i, attack_type in enumerate(attack_types):
        config = ATTACK_CONFIG.get(attack_type)
        if not config:
            log(f"\nSkipping {attack_type}: not in ATTACK_CONFIG")
            continue

        log(f"\n{'─'*60}")
        log(f"[{i+1}/{total}] {attack_type}")
        log(f"  Attack from: {config['attack_csv']}, Benign from: {config['benign_csv']}")

        # Create batch
        batch_dir = create_batch(attack_type, config)
        if not batch_dir:
            continue

        if args.dry_run:
            log(f"  Dry run — batch created, skipping experiment")
            continue

        # Run experiment
        result_file = run_experiment(attack_type, batch_dir)
        if result_file and result_file.exists():
            with open(result_file) as f:
                data = json.load(f)
            cost = data.get("evaluation_metadata", {}).get("total_cost_usd", 0)
            total_cost += cost
            log(f"  Complete: ${cost:.2f}")

        # Update summary after each experiment
        update_summary()

    log(f"\n{'='*60}")
    log(f"All experiments complete. Total cost: ${total_cost:.2f}")
    log(f"Results in: {RESULTS_DIR}")
    log(f"Summary: {SUMMARY_FILE}")
    log(f"{'='*60}")


if __name__ == "__main__":
    main()
