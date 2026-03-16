#!/usr/bin/env python3
"""
Agent Ablation Study — Bot + DoS-Slowloris Extension

Runs 5 ablation conditions on two new attack types:
- Bot: RF-invisible (99.5% benign confidence), temporal agent critical
- DoS-Slowloris: 100% recall baseline, slow-and-low HTTP attack

Uses existing ablation_study.py infrastructure.
Preserves all existing results (FTP, SSH, HOIC) in ablation_summary.json.

NOTE: Uses the original Stage 1 results to determine which flows go to LLM,
ensuring the ablation evaluates the same flows as the baseline.
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from scripts.ablation_study import (
    ABLATION_CONDITIONS,
    analyze_flow_ablation,
    make_stub_result,
)
from tests.phase3_multiagent import (
    load_batch_data,
    group_flows_by_ip,
    make_tier1_result,
    calculate_metrics,
    generate_batch_summary,
    print_progress_header,
    print_progress_row,
    print_metrics,
)
from agents.protocol_agent import ProtocolAgent
from agents.statistical_agent import StatisticalAgent
from agents.behavioural_agent import BehaviouralAgent
from agents.temporal_agent import TemporalAgent
from agents.devils_advocate_agent import DevilsAdvocateAgent
from agents.orchestrator_agent import OrchestratorAgent

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

RESULTS_DIR = PROJECT_ROOT / "results" / "ablation"

ATTACK_CONFIGS = [
    {
        "name": "Bot",
        "batch_dir": "Bot",
        "baseline_file": "Bot_results.json",
        "suffix": "bot",
        "cost_limit": 3.00,
    },
    {
        "name": "DoS_attacks-Slowloris",
        "batch_dir": "DoS_attacks-Slowloris",
        "baseline_file": "DoS_attacks-Slowloris_results.json",
        "suffix": "slowloris",
        "cost_limit": 3.00,
    },
]


def get_llm_flow_indices(baseline_path):
    """Get indices of flows that went to LLM in the original Stage 1 run."""
    with open(baseline_path) as f:
        baseline = json.load(f)
    llm_indices = set()
    for r in baseline["results"]:
        if not r.get("tier1_filtered", False):
            llm_indices.add(r["flow_idx"])
    return llm_indices


def run_condition_with_baseline_routing(
    condition_name, condition, batch_dir, cost_limit, attack_type_label, llm_indices
):
    """Run a single ablation condition, using baseline routing to determine which flows go to LLM."""
    disabled = condition["disabled"]
    label = condition["label"]

    print("\n" + "=" * 70)
    print(f"ABLATION: {label}")
    print(f"  Disabled: {', '.join(sorted(disabled))}")
    print(f"  Batch: {batch_dir}")
    print("=" * 70)

    # Load data
    flows, gt_by_id, meta_by_idx, metadata = load_batch_data(batch_dir)
    total_flows = len(flows)

    # Use baseline routing instead of running Tier 1
    tier1_filtered_indices = set()
    tier1_results = {}

    for i in range(total_flows):
        if i not in llm_indices:
            tier1_filtered_indices.add(i)
            tier1_results[i] = make_tier1_result(i, flows[i], 0.99)

    n_filtered = len(tier1_filtered_indices)
    n_sent = total_flows - n_filtered
    print(f"  Routing (from baseline): {n_filtered} filtered, {n_sent} to LLM")

    ip_groups = group_flows_by_ip(flows)

    # Initialize agents
    model = "gpt-4o"
    provider = "openai"
    api_key = os.getenv("OPENAI_API_KEY")

    protocol_agent = ProtocolAgent(model, api_key, provider=provider)
    statistical_agent = StatisticalAgent(model, api_key, provider=provider)
    behavioural_agent = BehaviouralAgent(model, api_key, provider=provider)
    temporal_agent = TemporalAgent(model, api_key, provider=provider)
    da_agent = DevilsAdvocateAgent(model, api_key, provider=provider)
    orchestrator_agent = OrchestratorAgent(model, api_key, da_weight=30, provider=provider)

    agents = [protocol_agent, statistical_agent, behavioural_agent,
              temporal_agent, da_agent, orchestrator_agent]

    print_progress_header()

    results = []
    running_cost = 0.0

    for i in range(total_flows):
        flow = flows[i]
        gt = gt_by_id.get(str(i), {"label": -1, "attack_type": "Unknown"})
        meta = meta_by_idx.get(i, {"tier": 0, "attack_type": "Unknown"})

        if i in tier1_filtered_indices:
            result = tier1_results[i]
            result["tier"] = meta.get("tier", 0)
            result["attack_type_actual"] = gt.get("attack_type", meta.get("attack_type", "Unknown"))
            result["label_actual"] = gt.get("label", -1)
            results.append(result)
            continue

        if cost_limit > 0 and running_cost >= cost_limit:
            print(f"\n  COST LIMIT (${cost_limit:.2f}) reached at flow {i}. Stopping.")
            break

        result = analyze_flow_ablation(
            flow_idx=i, flow=flow, flows=flows, ip_groups=ip_groups,
            protocol_agent=protocol_agent, statistical_agent=statistical_agent,
            behavioural_agent=behavioural_agent, temporal_agent=temporal_agent,
            da_agent=da_agent, orchestrator_agent=orchestrator_agent,
            disabled_agents=disabled,
        )

        result["tier"] = meta.get("tier", 0)
        result["attack_type_actual"] = gt.get("attack_type", meta.get("attack_type", "Unknown"))
        result["label_actual"] = gt.get("label", -1)

        running_cost += result["cost_usd"]
        results.append(result)
        print_progress_row(result, gt, meta)

    # Metrics
    metrics = calculate_metrics(results, gt_by_id, meta_by_idx)
    print_metrics(metrics, results)

    # Build metadata
    eval_metadata = {
        "model": model,
        "provider": provider,
        "batch_dir": str(batch_dir),
        "total_flows": total_flows,
        "evaluated_flows": len(results),
        "ablation_condition": condition_name,
        "ablation_label": label,
        "disabled_agents": sorted(disabled),
        "active_agents": sorted(
            set(["protocol", "statistical", "behavioural", "temporal", "devils_advocate", "orchestrator"]) - disabled
        ),
        "started_at": datetime.now().isoformat(),
        "completed_at": datetime.now().isoformat(),
        "total_cost_usd": sum(r.get("cost_usd", 0) for r in results),
        "total_tokens": {
            "input": sum(r.get("tokens", {}).get("input", 0) for r in results),
            "output": sum(r.get("tokens", {}).get("output", 0) for r in results),
            "total": sum(r.get("tokens", {}).get("total", 0) for r in results),
        },
        "agent_stats": {a.agent_name: a.get_stats() for a in agents},
        "metrics": metrics,
        "tier1": {
            "enabled": True,
            "threshold": 0.15,
            "flows_filtered": n_filtered,
            "flows_sent_to_llm": n_sent,
            "routing_source": "baseline_results",
        },
    }

    batch_summary = generate_batch_summary(results, metrics, eval_metadata)
    eval_metadata["batch_summary"] = batch_summary

    return {"evaluation_metadata": eval_metadata, "results": results, "metrics": metrics}


def run_attack_ablation(attack_cfg, all_summaries):
    """Run all 5 ablation conditions for one attack type."""
    name = attack_cfg["name"]
    suffix = attack_cfg["suffix"]

    batch_dir = PROJECT_ROOT / "data" / "batches" / "stage1" / attack_cfg["batch_dir"]
    if not batch_dir.exists():
        print(f"ERROR: Batch not found at {batch_dir}")
        return False

    baseline_path = PROJECT_ROOT / "results" / "stage1" / attack_cfg["baseline_file"]
    if not baseline_path.exists():
        print(f"ERROR: Baseline not found at {baseline_path}")
        return False

    # Get which flows went to LLM in the original run
    llm_indices = get_llm_flow_indices(baseline_path)

    with open(baseline_path) as f:
        baseline = json.load(f)

    bm = baseline["evaluation_metadata"]["metrics"]
    baseline_cost = baseline["evaluation_metadata"]["total_cost_usd"]
    bcm = bm["confusion"]
    total_neg = bcm["fp"] + bcm["tn"]

    print("=" * 70)
    print(f"AGENT ABLATION STUDY — {name.upper()}")
    print("=" * 70)
    print(f"Baseline (Full AMATAS on {name}):")
    print(f"  Recall: {bm['recall']:.0%}")
    print(f"  FPR:    {bcm['fp'] / total_neg:.1%}" if total_neg > 0 else "  FPR:    0.0%")
    print(f"  F1:     {bm['f1']:.0%}")
    print(f"  Cost:   ${baseline_cost:.2f}")
    print(f"  LLM flows: {len(llm_indices)} (from baseline)")
    print()

    # Add baseline
    all_summaries[f"full_amatas_{suffix}"] = {
        "label": "Full AMATAS (6 agents)",
        "attack_type": name,
        "disabled_agents": [],
        "recall": bm["recall"],
        "precision": bm["precision"],
        "f1": bm["f1"],
        "fpr": bcm["fp"] / total_neg if total_neg > 0 else 0,
        "confusion": bcm,
        "cost": baseline_cost,
    }

    # Run all 5 conditions
    for cond_name in ABLATION_CONDITIONS:
        cond = ABLATION_CONDITIONS[cond_name]

        print(f"\n{'='*70}")
        print(f"Running: {cond['label']} on {name}")
        print(f"{'='*70}")

        output = run_condition_with_baseline_routing(
            cond_name, cond, batch_dir, attack_cfg["cost_limit"], name, llm_indices
        )

        # Save individual result
        output_path = RESULTS_DIR / f"{cond_name}_{suffix}.json"
        with open(output_path, "w") as f:
            json.dump(output, f, indent=2)
        print(f"\nSaved: {output_path}")

        m = output["metrics"]
        cm = m["confusion"]
        tn = cm["fp"] + cm["tn"]
        all_summaries[f"{cond_name}_{suffix}"] = {
            "label": cond["label"],
            "attack_type": name,
            "disabled_agents": sorted(cond["disabled"]),
            "recall": m["recall"],
            "precision": m["precision"],
            "f1": m["f1"],
            "fpr": cm["fp"] / tn if tn > 0 else 0,
            "confusion": cm,
            "cost": output["evaluation_metadata"]["total_cost_usd"],
        }

    # Print comparison table
    print(f"\n{'='*80}")
    print(f"ABLATION STUDY — COMPARISON TABLE ({name.upper()})")
    print("=" * 80)
    print(f"{'Condition':<35} {'Recall':>8} {'FPR':>8} {'F1':>8} {'Cost':>8}")
    print("-" * 80)

    for key, s in all_summaries.items():
        if s["attack_type"] != name:
            continue
        print(
            f"{s['label']:<35} {s['recall']:>7.0%} {s['fpr']:>7.1%} "
            f"{s['f1']:>7.0%} ${s['cost']:>6.2f}"
        )

    return True


def main():
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    # Load existing summary (preserve FTP, SSH, HOIC results)
    all_summaries = {}
    existing_summary_path = RESULTS_DIR / "ablation_summary.json"
    if existing_summary_path.exists():
        with open(existing_summary_path) as f:
            existing = json.load(f)
        all_summaries = existing.get("conditions", {})
        print(f"Loaded {len(all_summaries)} existing conditions from ablation_summary.json\n")

    # Run both attack types
    for attack_cfg in ATTACK_CONFIGS:
        success = run_attack_ablation(attack_cfg, all_summaries)
        if not success:
            print(f"FAILED: {attack_cfg['name']}")

    # Save updated summary
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
    print(f"Total conditions: {len(all_summaries)}")

    # Copy to docs for dashboard
    import shutil
    docs_dir = PROJECT_ROOT / "docs" / "results" / "ablation"
    docs_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(summary_path, docs_dir / "ablation_summary.json")
    print(f"Copied to dashboard: {docs_dir / 'ablation_summary.json'}")

    # Final cross-attack comparison
    print(f"\n{'='*90}")
    print("FULL ABLATION SUMMARY — ALL ATTACK TYPES")
    print("=" * 90)

    attack_types = sorted(set(s["attack_type"] for s in all_summaries.values()))
    for at in attack_types:
        print(f"\n  {at}:")
        for key, s in all_summaries.items():
            if s["attack_type"] != at:
                continue
            print(
                f"    {s['label']:<35} R={s['recall']:>5.0%}  "
                f"F1={s['f1']:>5.0%}  ${s['cost']:>5.2f}"
            )

    return 0


if __name__ == "__main__":
    sys.exit(main())
