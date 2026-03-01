#!/usr/bin/env python3
"""
Rerun the 7 dev-split attack types with clean data separation.

Previous runs used batches from development.csv — the same CSV the Tier-1 RF
was trained on (within-split overlap). This script sources batches from
dev_eval.csv (20% holdout the RF never saw) to eliminate overlap.

Attack types: FTP-BruteForce, SSH-Bruteforce, DDoS_attacks-LOIC-HTTP,
DoS_attacks-Hulk, DoS_attacks-SlowHTTPTest, DoS_attacks-GoldenEye,
DoS_attacks-Slowloris.

Usage:
    python scripts/run_devsplit_clean.py
"""

import json
import os
import shutil
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

EVAL_CSV = PROJECT_ROOT / "data" / "datasets" / "dev_eval.csv"
RESULTS_DIR = PROJECT_ROOT / "results" / "stage1"
BATCHES_DIR = PROJECT_ROOT / "data" / "batches" / "stage1"
SUMMARY_FILE = RESULTS_DIR / "running_summary.json"
STATUS_FILE = RESULTS_DIR / "live_status.json"
PYTHON = str(PROJECT_ROOT / ".venv" / "bin" / "python")

# The 7 dev-split attack types (RF was trained on these from dev_train.csv)
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
N_ATTACK = 50
N_BENIGN = 950
BATCH_COST_LIMIT = 5.00
TOTAL_COST_LIMIT = 25.00


def log(msg):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def update_live_status(current, completed, remaining, total_cost):
    """Update live_status.json for dashboard banner."""
    status = {
        "current_experiment": current or "complete",
        "stage": "Stage 1 (clean rerun)",
        "status": "all_done" if not current else "running",
        "experiments_completed": completed,
        "experiments_queued": remaining,
        "total_cost_so_far": round(total_cost, 2),
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    with open(STATUS_FILE, "w") as f:
        json.dump(status, f, indent=2)


def create_batch(attack_type, eval_df, rng):
    """Create a 1000-flow batch from dev_eval.csv."""
    slug = attack_type.replace(" ", "_")
    batch_dir = BATCHES_DIR / slug
    batch_dir.mkdir(parents=True, exist_ok=True)

    if (batch_dir / "flows.json").exists():
        log(f"  Batch {slug} already exists, reusing.")
        return batch_dir

    # Sample attack flows
    attack_df = eval_df[eval_df["Attack"] == attack_type]
    n_attack = N_ATTACK
    if len(attack_df) < N_ATTACK:
        log(f"  WARNING: Only {len(attack_df)} {attack_type} flows in eval split, using all")
        n_attack = len(attack_df)
    sampled_attack = attack_df.sample(n=n_attack, random_state=rng)

    # Sample benign flows
    benign_df = eval_df[eval_df["Attack"] == "Benign"]
    sampled_benign = benign_df.sample(n=N_BENIGN, random_state=rng)

    combined = pd.concat([sampled_attack, sampled_benign], ignore_index=True)

    # Sort by SRC_ADDR then timestamp
    combined = combined.sort_values(
        ["IPV4_SRC_ADDR", "FLOW_START_MILLISECONDS"]
    ).reset_index(drop=True)

    # Build flows.json
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
    for idx, (_, row) in enumerate(combined.iterrows()):
        labels.append({
            "flow_id": str(idx),
            "label": 0 if row["Attack"] == "Benign" else 1,
            "label_name": "Benign" if row["Attack"] == "Benign" else "Attack",
            "attack_type": row["Attack"],
        })

    with open(batch_dir / "flows.json", "w") as f:
        json.dump(flows, f, indent=2)
    with open(batch_dir / "ground_truth.json", "w") as f:
        json.dump({"ground_truth": labels}, f, indent=2)

    log(f"  Created batch: {n_attack} {attack_type} + {N_BENIGN} benign = {len(combined)} flows")
    return batch_dir


def run_experiment(attack_type, batch_dir):
    """Run phase3_multiagent.py for one attack type."""
    slug = attack_type.replace(" ", "_")
    output_file = RESULTS_DIR / f"{slug}_results.json"

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

    log(f"  Running {attack_type} (1000 flows)...")
    start_time = time.time()
    result = subprocess.run(cmd, capture_output=False, timeout=7200)
    elapsed = time.time() - start_time
    log(f"  Finished in {elapsed / 60:.1f} min (exit code {result.returncode})")

    if not output_file.exists():
        log(f"  ERROR: No output produced")
        return None

    with open(output_file) as f:
        return json.load(f)


def extract_metrics(data, attack_type):
    """Extract metrics from result file."""
    results = data.get("results", [])

    tp = fp = fn = tn = 0
    total_cost = 0.0
    tier1_filtered = 0

    for r in results:
        pred_pos = r.get("verdict", "").upper() in ("MALICIOUS", "SUSPICIOUS")
        act_pos = r.get("label_actual", 0) == 1
        if pred_pos and act_pos: tp += 1
        elif pred_pos and not act_pos: fp += 1
        elif not pred_pos and act_pos: fn += 1
        else: tn += 1
        total_cost += r.get("cost_usd", 0)
        if r.get("tier1_filtered"):
            tier1_filtered += 1

    total_flows = len(results)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    n_benign = tn + fp
    fpr = fp / n_benign if n_benign > 0 else 0
    cost_per_tp = total_cost / tp if tp > 0 else float("inf")

    return {
        "attack_type": attack_type,
        "status": "complete",
        "recall": round(recall * 100),
        "fpr": round(fpr * 100),
        "f1": round(f1 * 100),
        "cost": round(total_cost, 2),
        "cost_per_tp": round(cost_per_tp, 2),
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        # Extra fields for logging
        "_recall": recall,
        "_f1": f1,
        "_fpr": fpr,
        "_total_cost": total_cost,
        "_tier1_filtered": tier1_filtered,
        "_llm_analysed": total_flows - tier1_filtered,
    }


def update_summary(new_metrics):
    """Update running_summary.json, replacing dev-split entries with clean ones."""
    if SUMMARY_FILE.exists():
        with open(SUMMARY_FILE) as f:
            summary = json.load(f)
    else:
        summary = {"experiments": [], "overall": {}}

    # Remove old entries for dev-split types
    dev_set = set(DEV_ATTACK_TYPES)
    # Also handle name variants (DoS-SlowHTTPTest vs DoS_attacks-SlowHTTPTest)
    kept = [e for e in summary["experiments"]
            if e["attack_type"] not in dev_set
            and e["attack_type"] != "DoS-SlowHTTPTest"]

    # Add new clean entries
    for m in new_metrics:
        clean = {k: v for k, v in m.items() if not k.startswith("_")}
        kept.append(clean)

    # Rebuild overall
    all_exps = kept
    if all_exps:
        best = max(all_exps, key=lambda e: e.get("f1", 0))
        hardest = min(all_exps, key=lambda e: e.get("recall", 0))
        summary["experiments"] = all_exps
        summary["overall"] = {
            "best_f1": best.get("f1", 0),
            "total_flows": len(all_exps) * 1000,
            "total_cost": round(sum(e.get("cost", 0) for e in all_exps), 2),
            "best_detected": best["attack_type"],
            "best_recall": best.get("recall", 0),
            "hardest": hardest["attack_type"],
            "hardest_recall": hardest.get("recall", 0),
            "avg_fpr": round(sum(e.get("fpr", 0) for e in all_exps) / len(all_exps)),
        }

    with open(SUMMARY_FILE, "w") as f:
        json.dump(summary, f, indent=2)
    log(f"  Updated running_summary.json ({len(all_exps)} experiments)")


def git_commit_and_push(attack_type, metrics):
    """Commit results and push."""
    recall = metrics["recall"]
    f1 = metrics["f1"]
    msg = f"Stage 1 clean: {attack_type} - Recall:{recall}% F1:{f1}%"
    try:
        subprocess.run(
            ["git", "add", "results/stage1/"],
            cwd=str(PROJECT_ROOT), capture_output=True, timeout=30,
        )
        subprocess.run(
            ["git", "commit", "-m", msg],
            cwd=str(PROJECT_ROOT), capture_output=True, timeout=30,
        )
        subprocess.run(
            ["git", "push"],
            cwd=str(PROJECT_ROOT), capture_output=True, timeout=60,
        )
        log(f"  Git: committed and pushed — {msg}")
    except Exception as e:
        log(f"  Git push failed: {e}")


def main():
    log("=" * 60)
    log("CLEAN RERUN: 7 dev-split attack types from dev_eval.csv")
    log(f"RF trained on dev_train.csv (80%), batches from dev_eval.csv (20%)")
    log(f"Config: Tier 1 + GPT-4o | Limit: ${BATCH_COST_LIMIT}/batch")
    log("=" * 60)

    if not EVAL_CSV.exists():
        log(f"ERROR: {EVAL_CSV} not found. Run scripts/split_development.py first.")
        return 1

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # Step 1: Back up existing results for dev-split types
    log("\nStep 1: Backing up existing overlap results...")
    for attack_type in DEV_ATTACK_TYPES:
        slug = attack_type.replace(" ", "_")
        result_file = RESULTS_DIR / f"{slug}_results.json"
        overlap_file = RESULTS_DIR / f"{slug}_overlap_results.json"
        if result_file.exists() and not overlap_file.exists():
            shutil.copy2(result_file, overlap_file)
            log(f"  Backed up {result_file.name} → {overlap_file.name}")
            # Delete the original so it gets rerun
            result_file.unlink()
            log(f"  Deleted {result_file.name} for rerun")

    # Step 2: Delete old batches (they were sourced from development.csv)
    log("\nStep 2: Removing old batches (sourced from development.csv)...")
    for attack_type in DEV_ATTACK_TYPES:
        slug = attack_type.replace(" ", "_")
        batch_dir = BATCHES_DIR / slug
        if batch_dir.exists():
            shutil.rmtree(batch_dir)
            log(f"  Removed batch: {slug}/")

    # Step 3: Load eval CSV
    log(f"\nStep 3: Loading dev_eval.csv...")
    t0 = time.time()
    eval_df = pd.read_csv(EVAL_CSV, usecols=READ_COLS)
    log(f"  Loaded {len(eval_df):,} rows in {time.time() - t0:.1f}s")

    rng = np.random.RandomState(SEED)
    total_cost = 0.0
    new_metrics = []

    # Step 4: Create batches and run experiments
    for i, attack_type in enumerate(DEV_ATTACK_TYPES):
        log(f"\n{'='*60}")
        log(f"[{i+1}/{len(DEV_ATTACK_TYPES)}] {attack_type}")
        log(f"Budget remaining: ${TOTAL_COST_LIMIT - total_cost:.2f}")
        log(f"{'='*60}")

        if total_cost >= TOTAL_COST_LIMIT:
            log(f"BUDGET LIMIT reached. Stopping.")
            break

        # Update live status
        completed_names = [m["attack_type"] for m in new_metrics]
        remaining_names = DEV_ATTACK_TYPES[i+1:]
        update_live_status(attack_type, completed_names, remaining_names, total_cost)

        # Create batch from dev_eval.csv
        batch_dir = create_batch(attack_type, eval_df, rng)
        if batch_dir is None:
            log(f"  Skipping {attack_type}")
            continue

        # Run experiment
        data = run_experiment(attack_type, batch_dir)
        if data is None:
            continue

        metrics = extract_metrics(data, attack_type)
        total_cost += metrics["_total_cost"]
        new_metrics.append(metrics)

        log(f"  Cost: ${metrics['_total_cost']:.2f} | T1 filtered: {metrics['_tier1_filtered']} | LLM: {metrics['_llm_analysed']}")
        log(f"  Recall: {metrics['recall']}% | F1: {metrics['f1']}% | FPR: {metrics['fpr']}%")
        log(f"  TP={metrics['confusion']['tp']} FP={metrics['confusion']['fp']} FN={metrics['confusion']['fn']} TN={metrics['confusion']['tn']}")

        # Update summary and push after each experiment
        update_summary(new_metrics)
        git_commit_and_push(attack_type, metrics)

    # Mark all done
    all_completed = [m["attack_type"] for m in new_metrics]
    update_live_status(None, all_completed, [], total_cost)

    # Final summary
    log(f"\n{'='*60}")
    log("CLEAN RERUN COMPLETE")
    log(f"{'='*60}")

    print(f"\n{'Attack Type':<30} | {'Cost':>8} | {'T1':>4} | {'LLM':>4} | {'Recall':>7} | {'F1':>5} | {'FPR':>5}")
    print("-" * 90)
    for m in new_metrics:
        print(f"{m['attack_type']:<30} | ${m['_total_cost']:>7.2f} | {m['_tier1_filtered']:>4} | {m['_llm_analysed']:>4} | {m['recall']:>6}% | {m['f1']:>4}% | {m['fpr']:>4}%")
    print("-" * 90)
    print(f"Total cost: ${total_cost:.2f}")
    print(f"Experiments completed: {len(new_metrics)}/{len(DEV_ATTACK_TYPES)}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
