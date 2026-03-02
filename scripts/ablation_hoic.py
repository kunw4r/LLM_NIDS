#!/usr/bin/env python3
"""
Agent Ablation Study — DDoS-HOIC Extension

Runs 5 ablation conditions on the HOIC batch (hardest successfully-detected attack,
F1=72%, recall=58%) to test whether agents that showed no impact on brute force
attacks contribute on a genuinely ambiguous attack type.

Uses existing ablation_study.py infrastructure.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.ablation_study import (
    ABLATION_CONDITIONS,
    run_condition,
)

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

RESULTS_DIR = PROJECT_ROOT / "results" / "ablation"


def main():
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    hoic_batch = PROJECT_ROOT / "data" / "batches" / "stage1" / "DDOS_attack-HOIC"
    if not hoic_batch.exists():
        print(f"ERROR: HOIC batch not found at {hoic_batch}")
        return 1

    # Load HOIC baseline from existing Stage 1 results
    baseline_path = PROJECT_ROOT / "results" / "stage1" / "DDOS_attack-HOIC_results.json"
    if not baseline_path.exists():
        print(f"ERROR: HOIC baseline not found at {baseline_path}")
        return 1

    with open(baseline_path) as f:
        baseline = json.load(f)

    bm = baseline["evaluation_metadata"]["metrics"]
    baseline_cost = baseline["evaluation_metadata"]["total_cost_usd"]
    bcm = bm["confusion"]
    total_neg = bcm["fp"] + bcm["tn"]

    print("=" * 70)
    print("AGENT ABLATION STUDY — DDoS-HOIC")
    print("=" * 70)
    print(f"Baseline (Full AMATAS on DDOS-HOIC):")
    print(f"  Recall: {bm['recall']:.0%}")
    print(f"  FPR:    {bcm['fp'] / total_neg:.1%}" if total_neg > 0 else "  FPR:    0.0%")
    print(f"  F1:     {bm['f1']:.0%}")
    print(f"  Cost:   ${baseline_cost:.2f}")
    print()

    # Start with baseline in summaries
    all_summaries = {}

    # Load existing FTP and SSH results to preserve them
    existing_summary_path = RESULTS_DIR / "ablation_summary.json"
    if existing_summary_path.exists():
        with open(existing_summary_path) as f:
            existing = json.load(f)
        all_summaries = existing.get("conditions", {})
        print(f"Loaded {len(all_summaries)} existing conditions from ablation_summary.json")

    # Add HOIC baseline
    all_summaries["full_amatas_hoic"] = {
        "label": "Full AMATAS (6 agents)",
        "attack_type": "DDOS_attack-HOIC",
        "disabled_agents": [],
        "recall": bm["recall"],
        "precision": bm["precision"],
        "f1": bm["f1"],
        "fpr": bcm["fp"] / total_neg if total_neg > 0 else 0,
        "confusion": bcm,
        "cost": baseline_cost,
    }

    # Run all 5 conditions on HOIC
    cost_limit = 2.50  # HOIC has 59 LLM flows, ~$1.80 each condition
    conditions_to_run = list(ABLATION_CONDITIONS.keys())

    for cond_name in conditions_to_run:
        cond = ABLATION_CONDITIONS[cond_name]

        print(f"\n{'='*70}")
        print(f"Running: {cond['label']} on DDOS-HOIC")
        print(f"{'='*70}")

        output = run_condition(cond_name, cond, hoic_batch, cost_limit, "DDOS_attack-HOIC")

        # Save individual result
        output_path = RESULTS_DIR / f"{cond_name}_hoic.json"
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\nSaved: {output_path}")

        m = output["metrics"]
        cm = m["confusion"]
        tn = cm["fp"] + cm["tn"]
        all_summaries[f"{cond_name}_hoic"] = {
            "label": cond["label"],
            "attack_type": "DDOS_attack-HOIC",
            "disabled_agents": sorted(cond["disabled"]),
            "recall": m["recall"],
            "precision": m["precision"],
            "f1": m["f1"],
            "fpr": cm["fp"] / tn if tn > 0 else 0,
            "confusion": cm,
            "cost": output["evaluation_metadata"]["total_cost_usd"],
        }

    # Save updated summary (preserves FTP + SSH + adds HOIC)
    summary = {
        "experiment": "Agent Ablation Study",
        "date": datetime.now().isoformat(),
        "description": "Quantify each agent's contribution by systematically disabling agents",
        "conditions": all_summaries,
    }

    summary_path = RESULTS_DIR / "ablation_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    print(f"\nUpdated ablation summary: {summary_path}")

    # Print HOIC comparison table
    print("\n" + "=" * 80)
    print("ABLATION STUDY — COMPARISON TABLE (DDOS-HOIC)")
    print("=" * 80)
    print(f"{'Condition':<35} {'Recall':>8} {'FPR':>8} {'F1':>8} {'Cost':>8}")
    print("-" * 80)

    for key, s in all_summaries.items():
        if s["attack_type"] != "DDOS_attack-HOIC":
            continue
        print(f"{s['label']:<35} {s['recall']:>7.0%} {s['fpr']:>7.1%} {s['f1']:>7.0%} ${s['cost']:>6.2f}")

    # Copy to docs for dashboard
    import shutil
    docs_dir = PROJECT_ROOT / "docs" / "results" / "ablation"
    docs_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(summary_path, docs_dir / "ablation_summary.json")
    print(f"\nCopied to dashboard: {docs_dir / 'ablation_summary.json'}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
