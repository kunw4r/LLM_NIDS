#!/usr/bin/env python3
"""
Run all 11 remaining Stage 1 experiments sequentially.

Uses Tier 1 + GPT-4o for each (same config as FTP-BruteForce experiment #7).
Creates batches, runs phase3_multiagent.py, updates summaries, commits.

Hard limits: $5.00 per batch, $25.00 total.
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

RESULTS_DIR = PROJECT_ROOT / "results" / "stage1"
BATCHES_DIR = PROJECT_ROOT / "data" / "batches" / "stage1"
SUMMARY_FILE = RESULTS_DIR / "running_summary.json"
STATUS_FILE = RESULTS_DIR / "live_status.json"
PYTHON = str(PROJECT_ROOT / ".venv" / "bin" / "python")

# Attack types to run — using EXACT names from inventory.json
ATTACK_TYPES = [
    "DDoS_attacks-LOIC-HTTP",
    "DoS_attacks-Hulk",
    "DoS_attacks-GoldenEye",
    "DoS_attacks-Slowloris",
    "DDOS_attack-HOIC",
    "DDOS_attack-LOIC-UDP",
    "Bot",
    "Infilteration",
    "Brute_Force_-Web",
    "Brute_Force_-XSS",
    "SQL_Injection",
]

BATCH_COST_LIMIT = 5.00
TOTAL_COST_LIMIT = 40.00
SEED = 42


def log(msg):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    line = f"[{ts}] {msg}"
    print(line, flush=True)


def safe_slug(attack_type):
    """Convert attack type to filesystem-safe slug."""
    return attack_type.replace(" ", "_").replace("(", "").replace(")", "")


def create_batch(attack_type):
    """Create batch using stage1_pipeline.py's create_batch function."""
    slug = safe_slug(attack_type)
    batch_dir = BATCHES_DIR / slug

    # Check if already exists
    if (batch_dir / "flows.json").exists() and (batch_dir / "ground_truth.json").exists():
        log(f"  Batch {slug} already exists, reusing.")
        return batch_dir

    log(f"  Creating batch for {attack_type}...")
    from scripts.stage1_pipeline import create_batch as _create_batch
    return _create_batch(attack_type, n_attack=50, n_benign=950, seed=SEED, batch_name=slug)


def run_experiment(attack_type, batch_dir):
    """Run phase3_multiagent.py for one attack type."""
    slug = safe_slug(attack_type)
    output_file = RESULTS_DIR / f"{slug}_results.json"

    # Skip if already completed
    if output_file.exists():
        log(f"  Result file {output_file.name} already exists, skipping.")
        with open(output_file) as f:
            data = json.load(f)
        return extract_metrics(data)

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

    log(f"  Running: {' '.join(cmd[-10:])}")
    start_time = time.time()

    result = subprocess.run(cmd, capture_output=False, timeout=7200)  # 2hr timeout

    elapsed = time.time() - start_time
    log(f"  Finished in {elapsed/60:.1f} minutes (exit code {result.returncode})")

    if not output_file.exists():
        log(f"  ERROR: No output file produced for {attack_type}")
        return None

    with open(output_file) as f:
        data = json.load(f)
    return extract_metrics(data)


def extract_metrics(data):
    """Extract key metrics from result file."""
    results = data.get("results", [])
    meta = data.get("evaluation_metadata", {})

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
    n_attack = tp + fn
    n_benign = tn + fp
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    fpr = fp / n_benign if n_benign > 0 else 0
    cost_per_tp = total_cost / tp if tp > 0 else float("inf")

    return {
        "experiment": safe_slug(data.get("evaluation_metadata", {}).get("batch_dir", "").split("/")[-1]),
        "attack_type": "",  # filled in by caller
        "total_flows": total_flows,
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "accuracy": (tp + tn) / total_flows if total_flows else 0,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "false_positive_rate": fpr,
        "total_cost": total_cost,
        "cost_per_tp": cost_per_tp,
        "tier1_filtered": tier1_filtered,
        "llm_analysed": total_flows - tier1_filtered,
        "total_tokens": sum(r.get("tokens", {}).get("total", 0) for r in results),
    }


def update_running_summary(all_metrics):
    """Update running_summary.json with all completed experiments."""
    summary = {
        "experiments": [],
        "overall": {},
    }

    for m in all_metrics:
        summary["experiments"].append({
            "attack_type": m["attack_type"],
            "status": "complete",
            "recall": round(m["recall"] * 100),
            "fpr": round(m["false_positive_rate"] * 100),
            "f1": round(m["f1"] * 100),
            "cost": round(m["total_cost"], 2),
            "cost_per_tp": round(m["cost_per_tp"], 2),
            "confusion": {"tp": m["tp"], "fp": m["fp"], "tn": m["tn"], "fn": m["fn"]},
        })

    if all_metrics:
        best = max(all_metrics, key=lambda m: m["f1"])
        hardest = min(all_metrics, key=lambda m: m["recall"])
        summary["overall"] = {
            "best_f1": round(best["f1"] * 100),
            "total_flows": sum(m["total_flows"] for m in all_metrics),
            "total_cost": round(sum(m["total_cost"] for m in all_metrics), 2),
            "best_detected": best["attack_type"],
            "best_recall": round(best["recall"] * 100),
            "hardest": hardest["attack_type"],
            "hardest_recall": round(hardest["recall"] * 100),
            "avg_fpr": round(sum(m["false_positive_rate"] for m in all_metrics) / len(all_metrics) * 100),
        }

    with open(SUMMARY_FILE, "w") as f:
        json.dump(summary, f, indent=2)


def update_live_status(attack_type, status, completed, queued, metrics=None):
    """Update live_status.json."""
    data = {
        "current_experiment": attack_type,
        "stage": "Stage 1",
        "status": status,
        "experiments_completed": [m["attack_type"] for m in completed],
        "experiments_queued": queued,
        "total_cost_so_far": round(sum(m["total_cost"] for m in completed), 2),
        "updated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    if metrics:
        data["last_result"] = {
            "attack_type": metrics["attack_type"],
            "recall": round(metrics["recall"] * 100),
            "f1": round(metrics["f1"] * 100),
            "fpr": round(metrics["false_positive_rate"] * 100),
            "cost": round(metrics["total_cost"], 2),
        }
    with open(STATUS_FILE, "w") as f:
        json.dump(data, f, indent=2)


def generate_thesis_draft(attack_type):
    """Run generate_chapter_draft.py for this attack type."""
    slug = safe_slug(attack_type)
    result_file = RESULTS_DIR / f"{slug}_results.json"
    try:
        subprocess.run(
            [PYTHON, str(PROJECT_ROOT / "scripts" / "generate_chapter_draft.py"),
             str(result_file), "--attack-type", attack_type],
            timeout=30, capture_output=True,
        )
        log(f"  Thesis draft generated for {attack_type}")
    except Exception as e:
        log(f"  Thesis draft generation failed: {e}")


def git_commit_and_push(attack_type, metrics):
    """Commit results and push."""
    f1_val = round(metrics["f1"] * 100)
    recall_val = round(metrics["recall"] * 100)
    msg = f"Stage 1: {attack_type} complete - Recall:{recall_val}% F1:{f1_val}%"
    try:
        subprocess.run(
            ["git", "add", "results/", "data/batches/stage1/"],
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


def print_comparison_table(all_metrics):
    """Print a running comparison table."""
    sep = "-" * 100
    print(f"\n{sep}")
    print(f"{'Attack Type':<30} | {'Recall':>7} | {'Prec':>7} | {'F1':>7} | {'FPR':>7} | {'Cost':>8} | {'$/TP':>8} | {'LLM':>4}")
    print(sep)
    for m in sorted(all_metrics, key=lambda x: x["f1"], reverse=True):
        name = m["attack_type"][:30]
        cpt = f"${m['cost_per_tp']:.2f}" if m["cost_per_tp"] < 100 else "N/A"
        print(
            f"{name:<30} | {m['recall']*100:>6.1f}% | {m['precision']*100:>6.1f}% | "
            f"{m['f1']*100:>6.1f}% | {m['false_positive_rate']*100:>6.1f}% | "
            f"${m['total_cost']:>7.2f} | {cpt:>8} | {m['llm_analysed']:>4}"
        )

    total_cost = sum(m["total_cost"] for m in all_metrics)
    avg_recall = sum(m["recall"] for m in all_metrics) / len(all_metrics) * 100
    avg_f1 = sum(m["f1"] for m in all_metrics) / len(all_metrics) * 100
    print(sep)
    print(f"{'AVERAGE':<30} | {avg_recall:>6.1f}% | {'':>7} | {avg_f1:>6.1f}% | {'':>7} | ${total_cost:>7.2f} |")
    print(sep)
    print(f"  Budget remaining: ${TOTAL_COST_LIMIT - total_cost:.2f} / ${TOTAL_COST_LIMIT:.2f}")
    print(flush=True)


def main():
    log("=" * 70)
    log("AMATAS Stage 1 — Running 11 remaining experiments")
    log(f"Config: Tier 1 + GPT-4o | Cost limit: ${BATCH_COST_LIMIT}/batch, ${TOTAL_COST_LIMIT} total")
    log("=" * 70)

    # Load existing completed experiments from running_summary.json
    existing_metrics = []
    if SUMMARY_FILE.exists():
        with open(SUMMARY_FILE) as f:
            summary = json.load(f)
        # Handle both old format (list) and new format (dict with experiments key)
        if isinstance(summary, list):
            for exp in summary:
                existing_metrics.append({
                    "attack_type": exp.get("attack_type", ""),
                    "total_flows": 1000,
                    "tp": exp.get("confusion", exp).get("tp", 0),
                    "fp": exp.get("confusion", exp).get("fp", 0),
                    "fn": exp.get("confusion", exp).get("fn", 0),
                    "tn": exp.get("confusion", exp).get("tn", 0),
                    "accuracy": 0,
                    "precision": 0,
                    "recall": exp.get("recall", 0) / 100 if exp.get("recall", 0) > 1 else exp.get("recall", 0),
                    "f1": exp.get("f1", 0) / 100 if exp.get("f1", 0) > 1 else exp.get("f1", 0),
                    "false_positive_rate": exp.get("fpr", 0) / 100 if exp.get("fpr", 0) > 1 else exp.get("fpr", 0),
                    "total_cost": exp.get("cost", exp.get("total_cost", 0)),
                    "cost_per_tp": exp.get("cost_per_tp", 0),
                    "tier1_filtered": 0,
                    "llm_analysed": 0,
                    "total_tokens": 0,
                })
        elif isinstance(summary, dict) and "experiments" in summary:
            for exp in summary["experiments"]:
                existing_metrics.append({
                    "attack_type": exp.get("attack_type", ""),
                    "total_flows": 1000,
                    "tp": exp.get("confusion", {}).get("tp", 0),
                    "fp": exp.get("confusion", {}).get("fp", 0),
                    "fn": exp.get("confusion", {}).get("fn", 0),
                    "tn": exp.get("confusion", {}).get("tn", 0),
                    "accuracy": 0,
                    "precision": 0,
                    "recall": exp.get("recall", 0) / 100 if exp.get("recall", 0) > 1 else exp.get("recall", 0),
                    "f1": exp.get("f1", 0) / 100 if exp.get("f1", 0) > 1 else exp.get("f1", 0),
                    "false_positive_rate": exp.get("fpr", 0) / 100 if exp.get("fpr", 0) > 1 else exp.get("fpr", 0),
                    "total_cost": exp.get("cost", exp.get("total_cost", 0)),
                    "cost_per_tp": exp.get("cost_per_tp", 0),
                    "tier1_filtered": 0,
                    "llm_analysed": 0,
                    "total_tokens": 0,
                })

    completed_types = {m["attack_type"] for m in existing_metrics}
    log(f"Previously completed: {completed_types or 'none'}")

    # Also check for individual result files (FTP-BruteForce was run separately)
    for f in RESULTS_DIR.glob("*_results.json"):
        stem = f.stem.replace("_results", "")
        # Check if this matches any attack type
        for at in ATTACK_TYPES + ["FTP-BruteForce", "SSH-Bruteforce", "DoS_attacks-SlowHTTPTest"]:
            slug = safe_slug(at)
            if stem == slug and at not in completed_types:
                log(f"  Found existing result: {f.name}")
                with open(f) as fh:
                    data = json.load(fh)
                m = extract_metrics(data)
                m["attack_type"] = at
                existing_metrics.append(m)
                completed_types.add(at)

    all_metrics = list(existing_metrics)
    total_cost_so_far = sum(m["total_cost"] for m in all_metrics)
    log(f"Total cost so far: ${total_cost_so_far:.2f}")

    # Filter to remaining attack types
    remaining = [at for at in ATTACK_TYPES if at not in completed_types]
    log(f"Remaining experiments: {len(remaining)}")
    for at in remaining:
        log(f"  - {at}")

    if not remaining:
        log("All experiments already completed!")
        print_comparison_table(all_metrics)
        return 0

    # Run each experiment
    for i, attack_type in enumerate(remaining):
        # Budget check
        if total_cost_so_far >= TOTAL_COST_LIMIT:
            log(f"TOTAL BUDGET LIMIT (${TOTAL_COST_LIMIT}) reached. Stopping.")
            break

        remaining_budget = TOTAL_COST_LIMIT - total_cost_so_far
        log(f"\n{'='*70}")
        log(f"Experiment {i+1}/{len(remaining)}: {attack_type}")
        log(f"Budget remaining: ${remaining_budget:.2f}")
        log(f"{'='*70}")

        queued = remaining[i+1:]
        update_live_status(attack_type, "creating_batch", all_metrics, queued)

        # Step 1: Create batch
        try:
            batch_dir = create_batch(attack_type)
        except Exception as e:
            log(f"  ERROR creating batch: {e}")
            continue

        # Step 2: Run experiment
        update_live_status(attack_type, "running", all_metrics, queued)
        metrics = run_experiment(attack_type, batch_dir)

        if metrics is None:
            log(f"  FAILED — no metrics produced for {attack_type}")
            continue

        metrics["attack_type"] = attack_type
        all_metrics.append(metrics)
        total_cost_so_far += metrics["total_cost"]

        log(f"\n  Results for {attack_type}:")
        log(f"    Recall: {metrics['recall']*100:.1f}% | F1: {metrics['f1']*100:.1f}% | FPR: {metrics['false_positive_rate']*100:.1f}%")
        log(f"    TP={metrics['tp']} FP={metrics['fp']} FN={metrics['fn']} TN={metrics['tn']}")
        log(f"    Cost: ${metrics['total_cost']:.2f} | LLM flows: {metrics['llm_analysed']}")

        # Step 3: Post-experiment tasks
        update_running_summary(all_metrics)
        update_live_status(attack_type, "complete", all_metrics, queued, metrics)
        generate_thesis_draft(attack_type)
        git_commit_and_push(attack_type, metrics)

        # Step 4: Print comparison table
        print_comparison_table(all_metrics)

    # Final summary
    log(f"\n{'='*70}")
    log("STAGE 1 COMPLETE — FINAL SUMMARY")
    log(f"{'='*70}")
    log(f"Total experiments: {len(all_metrics)}")
    log(f"Total cost: ${sum(m['total_cost'] for m in all_metrics):.2f}")
    log(f"Average recall: {sum(m['recall'] for m in all_metrics)/len(all_metrics)*100:.1f}%")
    log(f"Average F1: {sum(m['f1'] for m in all_metrics)/len(all_metrics)*100:.1f}%")

    print_comparison_table(all_metrics)

    # Update final status
    update_live_status("complete", "all_done", all_metrics, [])
    update_running_summary(all_metrics)

    return 0


if __name__ == "__main__":
    sys.exit(main())
