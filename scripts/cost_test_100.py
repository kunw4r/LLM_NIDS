#!/usr/bin/env python3
"""
Cost test: run 100-flow batches (5 attack + 95 benign) for the 7 dev-split
attack types using dev_eval.csv (20% holdout the RF never saw).

Estimates cost for full 1000-flow reruns before committing budget.
Expected: ~$0.40-0.50 per 100-flow batch → ~$4-5 per 1000-flow batch.

Usage:
    python scripts/cost_test_100.py
"""

import json
import os
import sys
import time
import numpy as np
import pandas as pd
import subprocess
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

EVAL_CSV = PROJECT_ROOT / "data" / "datasets" / "dev_eval.csv"
RESULTS_DIR = PROJECT_ROOT / "results" / "stage1" / "cost_test"
BATCHES_DIR = PROJECT_ROOT / "data" / "batches" / "stage1" / "cost_test"
PYTHON = str(PROJECT_ROOT / ".venv" / "bin" / "python")

# 7 dev-split attack types
DEV_ATTACK_TYPES = [
    "FTP-BruteForce",
    "SSH-Bruteforce",
    "DDoS_attacks-LOIC-HTTP",
    "DoS_attacks-Hulk",
    "DoS_attacks-SlowHTTPTest",
    "DoS_attacks-GoldenEye",
    "DoS_attacks-Slowloris",
]

# Columns matching stage1_pipeline.py exactly
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
SEED = 42
N_ATTACK = 5
N_BENIGN = 95
BATCH_COST_LIMIT = 2.00  # Lower limit for cost test


def log(msg):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def create_batch(attack_type, eval_df, rng):
    """Create a 100-flow batch from dev_eval.csv."""
    slug = attack_type.replace(" ", "_")
    batch_dir = BATCHES_DIR / slug
    batch_dir.mkdir(parents=True, exist_ok=True)

    if (batch_dir / "flows.json").exists():
        log(f"  Batch {slug} already exists, reusing.")
        return batch_dir

    # Sample attack flows
    attack_df = eval_df[eval_df["Attack"] == attack_type]
    if len(attack_df) < N_ATTACK:
        log(f"  WARNING: Only {len(attack_df)} {attack_type} flows in eval split")
        return None
    sampled_attack = attack_df.sample(n=N_ATTACK, random_state=rng)

    # Sample benign flows
    benign_df = eval_df[eval_df["Attack"] == "Benign"]
    sampled_benign = benign_df.sample(n=N_BENIGN, random_state=rng)

    combined = pd.concat([sampled_attack, sampled_benign], ignore_index=True)

    # Sort by SRC_ADDR then timestamp
    combined = combined.sort_values(["IPV4_SRC_ADDR", "FLOW_START_MILLISECONDS"]).reset_index(drop=True)

    # Build flows.json — use EXTRACT_COLS (same as stage1_pipeline.py)
    flows = []
    for idx, (_, row) in enumerate(combined.iterrows()):
        flow = {"flow_id": idx}
        for f in EXTRACT_COLS:
            if f in row.index:
                val = row[f]
                if pd.isna(val):
                    val = 0
                elif isinstance(val, (np.integer,)):
                    val = int(val)
                elif isinstance(val, (np.floating,)):
                    val = float(val)
                flow[f] = val
        flows.append(flow)

    # Build ground_truth.json
    labels = []
    for _, row in combined.iterrows():
        labels.append({
            "label": 0 if row["Attack"] == "Benign" else 1,
            "attack_type": row["Attack"] if row["Attack"] != "Benign" else "Benign",
        })

    with open(batch_dir / "flows.json", "w") as f:
        json.dump(flows, f, indent=2)
    with open(batch_dir / "ground_truth.json", "w") as f:
        json.dump({"ground_truth": labels}, f, indent=2)

    log(f"  Created batch: {N_ATTACK} {attack_type} + {N_BENIGN} benign = {len(combined)} flows")
    return batch_dir


def run_experiment(attack_type, batch_dir):
    """Run phase3_multiagent.py for one attack type."""
    slug = attack_type.replace(" ", "_")
    output_file = RESULTS_DIR / f"{slug}_cost_test.json"

    if output_file.exists():
        log(f"  Result already exists, loading.")
        with open(output_file) as f:
            data = json.load(f)
        return data

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

    log(f"  Running {attack_type}...")
    start_time = time.time()
    result = subprocess.run(cmd, capture_output=False, timeout=3600)
    elapsed = time.time() - start_time
    log(f"  Finished in {elapsed / 60:.1f} min (exit code {result.returncode})")

    if not output_file.exists():
        log(f"  ERROR: No output produced")
        return None

    with open(output_file) as f:
        return json.load(f)


def extract_cost_metrics(data):
    """Extract cost-relevant metrics from result."""
    results = data.get("results", [])
    total_cost = sum(r.get("cost_usd", 0) for r in results)
    tier1_filtered = sum(1 for r in results if r.get("tier1_filtered"))
    llm_analysed = len(results) - tier1_filtered

    tp = sum(1 for r in results if r.get("verdict", "").upper() in ("MALICIOUS", "SUSPICIOUS") and r.get("label_actual") == 1)
    fn = sum(1 for r in results if r.get("verdict", "").upper() == "BENIGN" and r.get("label_actual") == 1)
    fp = sum(1 for r in results if r.get("verdict", "").upper() in ("MALICIOUS", "SUSPICIOUS") and r.get("label_actual") == 0)

    return {
        "total_flows": len(results),
        "total_cost": total_cost,
        "cost_per_flow": total_cost / len(results) if results else 0,
        "tier1_filtered": tier1_filtered,
        "llm_analysed": llm_analysed,
        "tp": tp, "fn": fn, "fp": fp,
        "recall": tp / (tp + fn) if (tp + fn) > 0 else 0,
    }


def main():
    log("=" * 60)
    log("COST TEST: 100-flow batches for 7 dev-split attack types")
    log(f"Source: dev_eval.csv (20% holdout, RF never saw)")
    log("=" * 60)

    if not EVAL_CSV.exists():
        log(f"ERROR: {EVAL_CSV} not found. Run scripts/split_development.py first.")
        return 1

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    BATCHES_DIR.mkdir(parents=True, exist_ok=True)

    log(f"Using {len(EXTRACT_COLS)} features + {len(LABEL_COLS)} label columns")

    # Load eval CSV
    log(f"Loading dev_eval.csv ...")
    t0 = time.time()
    eval_df = pd.read_csv(EVAL_CSV, usecols=READ_COLS)
    log(f"  Loaded {len(eval_df):,} rows in {time.time() - t0:.1f}s")

    rng = np.random.RandomState(SEED)
    total_cost = 0.0
    results_summary = []

    for i, attack_type in enumerate(DEV_ATTACK_TYPES):
        log(f"\n{'='*50}")
        log(f"[{i+1}/{len(DEV_ATTACK_TYPES)}] {attack_type}")
        log(f"{'='*50}")

        # Create batch
        batch_dir = create_batch(attack_type, eval_df, rng)
        if batch_dir is None:
            log(f"  Skipping {attack_type}")
            continue

        # Run experiment
        data = run_experiment(attack_type, batch_dir)
        if data is None:
            continue

        metrics = extract_cost_metrics(data)
        metrics["attack_type"] = attack_type
        total_cost += metrics["total_cost"]
        results_summary.append(metrics)

        log(f"  Cost: ${metrics['total_cost']:.2f} | Tier1 filtered: {metrics['tier1_filtered']} | LLM: {metrics['llm_analysed']}")
        log(f"  Recall: {metrics['recall']*100:.0f}% (TP={metrics['tp']}, FN={metrics['fn']}, FP={metrics['fp']})")

    # Summary
    log(f"\n{'='*60}")
    log("COST TEST SUMMARY")
    log(f"{'='*60}")

    print(f"\n{'Attack Type':<30} | {'Cost':>8} | {'$/flow':>8} | {'T1 Filt':>7} | {'LLM':>4} | {'Recall':>7}")
    print("-" * 85)
    for m in results_summary:
        print(f"{m['attack_type']:<30} | ${m['total_cost']:>7.2f} | ${m['cost_per_flow']:>7.4f} | {m['tier1_filtered']:>7} | {m['llm_analysed']:>4} | {m['recall']*100:>6.0f}%")
    print("-" * 85)

    avg_cost = total_cost / len(results_summary) if results_summary else 0
    print(f"\nTotal cost: ${total_cost:.2f}")
    print(f"Avg cost per 100-flow batch: ${avg_cost:.2f}")
    print(f"Estimated cost per 1000-flow batch: ${avg_cost * 10:.2f}")
    print(f"Estimated total for 7 types (1000 flows each): ${avg_cost * 10 * 7:.2f}")

    # Save summary
    summary_file = RESULTS_DIR / "cost_test_summary.json"
    with open(summary_file, "w") as f:
        json.dump({
            "results": results_summary,
            "total_cost": total_cost,
            "avg_cost_per_100": avg_cost,
            "estimated_per_1000": avg_cost * 10,
            "estimated_total_7_types": avg_cost * 10 * 7,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }, f, indent=2)
    log(f"\nSummary saved to {summary_file}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
