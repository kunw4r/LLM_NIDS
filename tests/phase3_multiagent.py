#!/usr/bin/env python3
"""
Phase 3: Multi-Agent NIDS Evaluation

6-agent architecture:
- Protocol Agent: Protocol validity analysis
- Statistical Agent: Statistical anomaly detection
- Behavioural Agent: Attack pattern matching with MITRE mapping
- Temporal Agent: IP-level temporal batch analysis
- Devil's Advocate: Counter-argument for benign interpretation
- Orchestrator: Weighted consensus (Devil's Advocate at 30% weight)

No MCP server. No external API calls. Pure LLM reasoning on flow features.

Usage:
    python tests/phase3_multiagent.py
    python tests/phase3_multiagent.py --sample 3
    python tests/phase3_multiagent.py --resume
"""

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from agents.protocol_agent import ProtocolAgent
from agents.statistical_agent import StatisticalAgent
from agents.behavioural_agent import BehaviouralAgent
from agents.temporal_agent import TemporalAgent
from agents.devils_advocate_agent import DevilsAdvocateAgent
from agents.orchestrator_agent import OrchestratorAgent

# Try loading .env
try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

# Paths
BATCH_DIR = PROJECT_ROOT / "data" / "batches" / "final_mcp_test_mini"
RESULTS_DIR = PROJECT_ROOT / "results"
RESULTS_FILE = RESULTS_DIR / "phase3_multiagent_results.json"
CHECKPOINT_FILE = RESULTS_DIR / "phase3_multiagent_checkpoint.json"

# Cost constants (Claude Sonnet 4 pricing)
COST_INPUT = 3.0 / 1_000_000    # $3 per 1M input tokens
COST_OUTPUT = 15.0 / 1_000_000  # $15 per 1M output tokens


# ── Data Loading ─────────────────────────────────────────────────────────────

def load_batch_data(batch_dir: Path, labels_file: Path = None):
    """Load flows, ground truth, and metadata from batch directory.

    Supports two formats:
    - Standard: flows.json (flat array), ground_truth.json, batch_metadata.json
    - Medium:   flows.json (dict with nested all_features), separate labels file
    """
    with open(batch_dir / "flows.json") as f:
        raw_flows = json.load(f)

    # Detect format: standard (list) vs medium (dict with "flows" key)
    if isinstance(raw_flows, list):
        # Standard format — flat array of flow dicts
        flows = raw_flows
    else:
        # Medium format — dict with "flows" containing nested all_features
        flows = []
        for i, entry in enumerate(raw_flows.get("flows", [])):
            flat = dict(entry.get("all_features", {}))
            flat["flow_id"] = i  # re-index to sequential
            flat.setdefault("IPV4_SRC_ADDR", entry.get("src_ip", "unknown"))
            flat.setdefault("IPV4_DST_ADDR", entry.get("dst_ip", "unknown"))
            flat.setdefault("L4_SRC_PORT", entry.get("src_port", 0))
            flat.setdefault("L4_DST_PORT", entry.get("dst_port", 0))
            flat.setdefault("PROTOCOL", entry.get("protocol", 0))
            flows.append(flat)

    # Load ground truth
    gt_path = labels_file or batch_dir / "ground_truth.json"
    if not gt_path.exists():
        # Try finding labels in parent's labels dir (medium batch layout)
        batch_name = batch_dir.name
        candidate = batch_dir.parent.parent / "labels" / f"{batch_name}_labels.json"
        if candidate.exists():
            gt_path = candidate

    with open(gt_path) as f:
        gt_data = json.load(f)

    # Build gt_by_id: map sequential index to ground truth
    gt_entries = gt_data.get("ground_truth", [])
    gt_by_id = {}
    for i, entry in enumerate(gt_entries):
        # Normalize: use sequential index as key (matches re-indexed flow_id)
        entry_copy = dict(entry)
        if entry_copy.get("attack_type") is None:
            entry_copy["attack_type"] = "Benign"
        gt_by_id[str(i)] = entry_copy

    # Load metadata (may not exist for medium batches)
    meta_by_idx = {}
    metadata = {"flows": [], "total_flows": len(flows)}
    meta_path = batch_dir / "batch_metadata.json"
    if meta_path.exists():
        with open(meta_path) as f:
            metadata = json.load(f)
        meta_by_idx = {e["flow_idx"]: e for e in metadata.get("flows", [])}
    else:
        # Generate minimal metadata from ground truth
        for i, entry in enumerate(gt_entries):
            attack_type = entry.get("attack_type") or "Benign"
            meta_by_idx[i] = {"flow_idx": i, "tier": 0, "attack_type": attack_type}

    return flows, gt_by_id, meta_by_idx, metadata


def group_flows_by_ip(flows: list) -> dict:
    """Group flow indices by source IP for temporal analysis."""
    ip_groups = defaultdict(list)
    for i, flow in enumerate(flows):
        src_ip = flow.get("IPV4_SRC_ADDR", "unknown")
        ip_groups[src_ip].append(i)
    return ip_groups


# ── Single Flow Analysis ─────────────────────────────────────────────────────

def analyze_flow(
    flow_idx: int,
    flow: dict,
    flows: list,
    ip_groups: dict,
    protocol_agent: ProtocolAgent,
    statistical_agent: StatisticalAgent,
    behavioural_agent: BehaviouralAgent,
    temporal_agent: TemporalAgent,
    da_agent: DevilsAdvocateAgent,
    orchestrator_agent: OrchestratorAgent,
) -> dict:
    """Run the full 6-agent pipeline on a single flow."""
    start_time = time.time()

    # Get co-IP flows for temporal agent
    src_ip = flow.get("IPV4_SRC_ADDR", "unknown")
    co_ip_indices = ip_groups.get(src_ip, [])
    co_ip_flows = [flows[i] for i in co_ip_indices]

    # Phase 1: Run 4 specialist agents in parallel
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_protocol = executor.submit(protocol_agent.analyze, flow)
        future_statistical = executor.submit(statistical_agent.analyze, flow)
        future_behavioural = executor.submit(behavioural_agent.analyze, flow)
        future_temporal = executor.submit(
            temporal_agent.analyze, flow, ip_flows=co_ip_flows
        )

        protocol_result = future_protocol.result()
        statistical_result = future_statistical.result()
        behavioural_result = future_behavioural.result()
        temporal_result = future_temporal.result()

    specialist_results = {
        "protocol": protocol_result,
        "statistical": statistical_result,
        "behavioural": behavioural_result,
        "temporal": temporal_result,
    }

    # Phase 2: Devil's advocate reviews specialist findings
    da_result = da_agent.analyze(flow, specialist_results=specialist_results)

    # Phase 3: Orchestrator makes final consensus
    orchestrator_result = orchestrator_agent.analyze(
        flow,
        specialist_results=specialist_results,
        devils_advocate_result=da_result,
    )

    elapsed = time.time() - start_time

    # Aggregate token/cost across all 6 agents
    all_results = list(specialist_results.values()) + [da_result, orchestrator_result]
    total_input = sum(r.get("tokens", {}).get("input", 0) for r in all_results)
    total_output = sum(r.get("tokens", {}).get("output", 0) for r in all_results)
    total_cost = sum(r.get("cost", 0) for r in all_results)

    # Per-agent cost breakdown
    agent_costs = {}
    for name, r in specialist_results.items():
        agent_costs[name] = r.get("cost", 0)
    agent_costs["devils_advocate"] = da_result.get("cost", 0)
    agent_costs["orchestrator"] = orchestrator_result.get("cost", 0)

    # Build agents_agreed/disagreed from specialist + DA verdicts vs final
    final_verdict = orchestrator_result.get("verdict", "ERROR")
    agents_agreed = orchestrator_result.get("agents_agreed", [])
    agents_disagreed = orchestrator_result.get("agents_disagreed", [])
    # If LLM didn't provide these, compute from specialist verdicts
    if not agents_agreed and not agents_disagreed:
        for name, r in specialist_results.items():
            sv = r.get("verdict", "")
            if sv == final_verdict or (final_verdict in ("MALICIOUS", "SUSPICIOUS") and sv in ("MALICIOUS", "SUSPICIOUS")):
                agents_agreed.append(name)
            else:
                agents_disagreed.append(name)
        if da_result.get("confidence_benign", 0) > 0.5 and final_verdict != "BENIGN":
            agents_disagreed.append("devils_advocate")
        else:
            agents_agreed.append("devils_advocate")

    return {
        "flow_idx": flow_idx,
        "verdict": final_verdict,
        "confidence": orchestrator_result.get("confidence", 0.0),
        "attack_type_predicted": orchestrator_result.get("attack_type"),
        "attack_category": orchestrator_result.get("attack_category"),
        "reasoning": orchestrator_result.get("reasoning", ""),
        "consensus_score": orchestrator_result.get("consensus_score", 0.0),
        "agents_agreed": agents_agreed,
        "agents_disagreed": agents_disagreed,
        "specialist_results": {
            name: {
                "verdict": r.get("verdict"),
                "confidence": r.get("confidence"),
                "attack_type": r.get("attack_type"),
                "reasoning": r.get("reasoning", ""),
                "key_evidence": r.get("key_findings", []),
                "agent_name": name,
                "temporal_summary": r.get("temporal_summary") if name == "temporal" else None,
                "connected_flows": r.get("connected_flows") if name == "temporal" else None,
                "ip_history_summary": r.get("ip_history_summary") if name == "temporal" else None,
                "temporal_pattern": r.get("temporal_pattern") if name == "temporal" else None,
            }
            for name, r in specialist_results.items()
        },
        "devils_advocate": {
            "verdict": "BENIGN",
            "confidence": da_result.get("confidence_benign", 0.0),
            "counter_argument": da_result.get("benign_argument", ""),
            "strongest_benign_indicator": da_result.get("strongest_benign_indicator", ""),
            "alternative_explanations": da_result.get("alternative_explanations", []),
            "weaknesses_in_malicious_case": da_result.get("weaknesses_in_malicious_case", []),
        },
        "mitre_techniques": orchestrator_result.get("mitre_techniques", []),
        "tokens": {
            "input": total_input,
            "output": total_output,
            "total": total_input + total_output,
        },
        "cost_usd": total_cost,
        "agent_costs": agent_costs,
        "time_seconds": elapsed,
    }


# ── Checkpoint ────────────────────────────────────────────────────────────────

def load_checkpoint() -> list:
    """Load checkpoint if it exists."""
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE) as f:
            data = json.load(f)
        return data.get("results", [])
    return []


def save_checkpoint(results: list, metadata: dict):
    """Save checkpoint after each flow."""
    data = {"metadata": metadata, "results": results}
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ── Progress Display ──────────────────────────────────────────────────────────

def print_progress_header():
    print(
        "\n%8s | %4s | %-25s | %-12s | %5s | %5s | %6s | %7s"
        % ("Flow", "Tier", "Actual", "Verdict", "Conf", "Cons", "Time", "Cost")
    )
    print("-" * 95)
    sys.stdout.flush()


def print_progress_row(result: dict, gt: dict, meta: dict):
    actual = gt.get("attack_type", "Unknown")[:25]
    verdict = result["verdict"][:12]
    label = gt.get("label", -1)

    if verdict.startswith("BENIGN") and label == 0:
        status = "."   # correct benign
    elif verdict in ("MALICIOUS", "SUSPICIOUS") and label == 1:
        status = "+"   # correct attack
    elif verdict.startswith("BENIGN") and label == 1:
        status = "!"   # missed attack (FN)
    elif verdict in ("MALICIOUS", "SUSPICIOUS") and label == 0:
        status = "X"   # false positive (FP)
    else:
        status = "?"

    print(
        "%7d%s | T%3d | %-25s | %-12s | %5.2f | %5.2f | %5.1fs | $%6.3f"
        % (
            result["flow_idx"], status,
            meta.get("tier", 0),
            actual,
            verdict,
            result["confidence"],
            result.get("consensus_score", 0.0),
            result["time_seconds"],
            result["cost_usd"],
        )
    )
    sys.stdout.flush()


# ── Metrics Calculation ───────────────────────────────────────────────────────

def calculate_metrics(results: list, gt_by_id: dict, meta_by_idx: dict) -> dict:
    """Calculate comprehensive evaluation metrics."""
    tp = fp = tn = fn = 0
    per_attack = defaultdict(lambda: {"tp": 0, "fp": 0, "tn": 0, "fn": 0})
    per_tier = defaultdict(lambda: {"tp": 0, "fp": 0, "tn": 0, "fn": 0})

    for r in results:
        idx = r["flow_idx"]
        gt = gt_by_id.get(str(idx), {})
        meta = meta_by_idx.get(idx, {})
        label = gt.get("label", -1)
        attack_type = gt.get("attack_type", "Unknown")
        tier = meta.get("tier", 0)
        verdict = r.get("verdict", "ERROR")

        predicted_positive = verdict in ("MALICIOUS", "SUSPICIOUS")
        actual_positive = label == 1

        if predicted_positive and actual_positive:
            tp += 1
            per_attack[attack_type]["tp"] += 1
            per_tier[tier]["tp"] += 1
        elif predicted_positive and not actual_positive:
            fp += 1
            per_attack[attack_type]["fp"] += 1
            per_tier[tier]["fp"] += 1
        elif not predicted_positive and actual_positive:
            fn += 1
            per_attack[attack_type]["fn"] += 1
            per_tier[tier]["fn"] += 1
        else:
            tn += 1
            per_attack[attack_type]["tn"] += 1
            per_tier[tier]["tn"] += 1

    total = tp + fp + tn + fn
    accuracy = (tp + tn) / total if total > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0

    # Per-attack-type metrics
    attack_metrics = {}
    for attack_type, counts in sorted(per_attack.items()):
        a_tp, a_fp, a_fn = counts["tp"], counts["fp"], counts["fn"]
        a_tn = counts["tn"]
        a_total = a_tp + a_fp + a_tn + a_fn
        a_prec = a_tp / (a_tp + a_fp) if (a_tp + a_fp) > 0 else 0
        a_rec = a_tp / (a_tp + a_fn) if (a_tp + a_fn) > 0 else 0
        a_f1 = 2 * a_prec * a_rec / (a_prec + a_rec) if (a_prec + a_rec) > 0 else 0
        attack_metrics[attack_type] = {
            "tp": a_tp, "fp": a_fp, "tn": a_tn, "fn": a_fn,
            "total": a_total, "precision": a_prec, "recall": a_rec, "f1": a_f1,
        }

    # Per-tier metrics
    tier_metrics = {}
    for tier, counts in sorted(per_tier.items()):
        t_tp, t_fp, t_fn = counts["tp"], counts["fp"], counts["fn"]
        t_tn = counts["tn"]
        t_total = t_tp + t_fp + t_tn + t_fn
        t_acc = (t_tp + t_tn) / t_total if t_total > 0 else 0
        t_prec = t_tp / (t_tp + t_fp) if (t_tp + t_fp) > 0 else 0
        t_rec = t_tp / (t_tp + t_fn) if (t_tp + t_fn) > 0 else 0
        t_f1 = 2 * t_prec * t_rec / (t_prec + t_rec) if (t_prec + t_rec) > 0 else 0
        tier_metrics[str(tier)] = {
            "tp": t_tp, "fp": t_fp, "tn": t_tn, "fn": t_fn,
            "total": t_total, "accuracy": t_acc,
            "precision": t_prec, "recall": t_rec, "f1": t_f1,
        }

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "per_attack_type": attack_metrics,
        "per_tier": tier_metrics,
    }


def print_metrics(metrics: dict, results: list):
    """Print formatted evaluation metrics."""
    sep = "=" * 70
    print("\n" + sep)
    print("Phase 3: Multi-Agent NIDS — Evaluation Results")
    print(sep)

    cm = metrics["confusion"]
    print("\nConfusion Matrix:")
    print("                 Predicted Positive  Predicted Negative")
    print("  Actual Positive      TP=%-4d             FN=%-4d" % (cm["tp"], cm["fn"]))
    print("  Actual Negative      FP=%-4d             TN=%-4d" % (cm["fp"], cm["tn"]))

    print("\nOverall Metrics:")
    print("  Accuracy:  %.1f%%" % (metrics["accuracy"] * 100))
    print("  Precision: %.1f%%" % (metrics["precision"] * 100))
    print("  Recall:    %.1f%%" % (metrics["recall"] * 100))
    print("  F1 Score:  %.1f%%" % (metrics["f1"] * 100))

    # Per-tier
    print("\nPer-Tier Breakdown:")
    print("  %-6s | %5s | %5s | %6s | %6s | %5s" % ("Tier", "Total", "Acc", "Prec", "Recall", "F1"))
    print("  " + "-" * 50)
    for tier in sorted(metrics["per_tier"].keys()):
        t = metrics["per_tier"][tier]
        print(
            "  T%-5s | %5d | %4.1f%% | %5.1f%% | %5.1f%% | %4.1f%%"
            % (tier, t["total"], t["accuracy"] * 100,
               t["precision"] * 100, t["recall"] * 100, t["f1"] * 100)
        )

    # Per-attack-type
    print("\nPer-Attack-Type Breakdown:")
    print(
        "  %-28s | %3s | %3s | %3s | %6s | %6s | %5s"
        % ("Attack Type", "TP", "FP", "FN", "Prec", "Recall", "F1")
    )
    print("  " + "-" * 75)
    for attack_type in sorted(metrics["per_attack_type"].keys()):
        a = metrics["per_attack_type"][attack_type]
        print(
            "  %-28s | %3d | %3d | %3d | %5.1f%% | %5.1f%% | %4.1f%%"
            % (attack_type[:28], a["tp"], a["fp"], a["fn"],
               a["precision"] * 100, a["recall"] * 100, a["f1"] * 100)
        )

    # Cost breakdown
    total_cost = sum(r["cost_usd"] for r in results)
    total_tokens = sum(r["tokens"]["total"] for r in results)
    total_time = sum(r["time_seconds"] for r in results)

    # Per-agent cost
    agent_totals = defaultdict(float)
    for r in results:
        for agent_name, cost in r.get("agent_costs", {}).items():
            agent_totals[agent_name] += cost

    print("\nCost Summary:")
    print("  Total cost:   $%.2f" % total_cost)
    print("  Total tokens: %s" % "{:,}".format(total_tokens))
    print("  Total time:   %.1fs (%.1f min)" % (total_time, total_time / 60))
    print("  Avg per flow: $%.3f, %.1fs" % (total_cost / len(results), total_time / len(results)))

    print("\n  Per-Agent Costs:")
    for agent_name in sorted(agent_totals.keys()):
        print("    %-20s $%.3f" % (agent_name, agent_totals[agent_name]))

    # Specialist agreement analysis
    agreement_counts = defaultdict(int)
    for r in results:
        specs = r.get("specialist_results", {})
        malicious_count = sum(
            1 for s in specs.values()
            if s.get("verdict") in ("MALICIOUS", "SUSPICIOUS")
        )
        agreement_counts[malicious_count] += 1

    print("\n  Specialist Agreement (how many of 4 say MALICIOUS/SUSPICIOUS):")
    for count in sorted(agreement_counts.keys()):
        print("    %d/4 agents: %d flows" % (count, agreement_counts[count]))

    print(sep)


# ── Main Evaluation Loop ─────────────────────────────────────────────────────

def make_tier1_result(flow_idx: int, flow: dict, benign_confidence: float) -> dict:
    """Create an auto-classified BENIGN result for a Tier 1 filtered flow."""
    return {
        "flow_idx": flow_idx,
        "verdict": "BENIGN",
        "confidence": benign_confidence,
        "attack_type_predicted": None,
        "reasoning": "Tier 1 RF pre-filter: classified as obviously benign",
        "consensus_score": 0.0,
        "specialist_results": {},
        "devils_advocate": {
            "confidence_benign": benign_confidence,
            "strongest_benign_indicator": "Tier 1 pre-filter",
        },
        "mitre_techniques": [],
        "tokens": {"input": 0, "output": 0, "total": 0},
        "cost_usd": 0.0,
        "agent_costs": {},
        "time_seconds": 0.0,
        "tier1_filtered": True,
    }


def generate_batch_summary(results: list, metrics: dict, eval_metadata: dict) -> dict:
    """Generate orchestrator batch summary from completed results."""
    total = len(results)
    tier1_count = sum(1 for r in results if r.get("tier1_filtered"))
    llm_count = total - tier1_count

    # Count attack types predicted
    attack_types_found = defaultdict(int)
    for r in results:
        pred = r.get("attack_type_predicted")
        if pred:
            attack_types_found[pred] += 1

    # Confidence breakdown
    high = medium = low = 0
    for r in results:
        if r.get("tier1_filtered"):
            continue
        c = r.get("confidence", 0)
        if c >= 0.8:
            high += 1
        elif c >= 0.5:
            medium += 1
        else:
            low += 1

    # Count verdicts
    verdict_counts = defaultdict(int)
    for r in results:
        verdict_counts[r.get("verdict", "UNKNOWN")] += 1

    cm = metrics.get("confusion", {})
    tp = cm.get("tp", 0)
    fp = cm.get("fp", 0)
    fn = cm.get("fn", 0)

    return {
        "architecture": "AMATAS v2 (ML Head + Multi-Agent)",
        "total_flows": total,
        "flows_auto_confirmed": tier1_count,
        "flows_manually_reviewed": llm_count,
        "verdict_distribution": dict(verdict_counts),
        "attack_types_found": dict(attack_types_found),
        "confidence_summary": {
            "high": high,
            "medium": medium,
            "low": low,
        },
        "detection_summary": {
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "recall": metrics.get("recall", 0),
            "precision": metrics.get("precision", 0),
            "f1": metrics.get("f1", 0),
        },
        "cost_summary": {
            "total_cost": eval_metadata.get("total_cost_usd", 0),
            "cost_per_flow": eval_metadata.get("total_cost_usd", 0) / total if total else 0,
            "cost_per_llm_flow": eval_metadata.get("total_cost_usd", 0) / llm_count if llm_count else 0,
        },
        "batch_narrative": (
            f"In this batch of {total} flows, the ML pre-filter auto-confirmed "
            f"{tier1_count} as benign and sent {llm_count} to the 6-agent LLM pipeline. "
            f"The agents identified {tp} true attacks with {fp} false positives and "
            f"missed {fn} attacks (recall={metrics.get('recall', 0):.0%}, "
            f"F1={metrics.get('f1', 0):.0%}). "
            f"Total cost: ${eval_metadata.get('total_cost_usd', 0):.2f}."
        ),
    }


def run_evaluation(args):
    """Main evaluation loop."""
    batch_dir = Path(args.batch)

    # Load batch data
    labels_path = Path(args.labels) if args.labels else None
    print("Loading batch data from %s..." % batch_dir)
    flows, gt_by_id, meta_by_idx, metadata = load_batch_data(batch_dir, labels_path)
    total_flows = len(flows)
    print("Loaded %d flows" % total_flows)

    # ── Tier 1 Pre-Filter ────────────────────────────────────────────────
    tier1_filtered_indices = set()  # indices auto-classified as BENIGN
    tier1_results = {}              # flow_idx → auto-classified result
    tier1_confidence = {}           # flow_idx → benign confidence

    if args.tier1:
        from scripts.tier1_filter import filter_flows as tier1_filter

        print("\n── Tier 1 RF Pre-Filter ─────────────────────────────")
        send_to_llm, skip_list = tier1_filter(flows)

        # Build set of flow_ids that were sent to LLM
        sent_ids = set()
        for flow in send_to_llm:
            sent_ids.add(int(flow.get("flow_id", -1)))

        # Map list indices → tier 1 outcome
        for i, flow in enumerate(flows):
            fid = int(flow.get("flow_id", i))
            if fid not in sent_ids:
                tier1_filtered_indices.add(i)

        # Get confidence from skip_list
        skip_by_id = {}
        for flow, conf in skip_list:
            skip_by_id[int(flow.get("flow_id", -1))] = conf

        for i in tier1_filtered_indices:
            fid = int(flows[i].get("flow_id", i))
            conf = skip_by_id.get(fid, 0.99)
            tier1_confidence[i] = conf
            tier1_results[i] = make_tier1_result(i, flows[i], conf)

        n_filtered = len(tier1_filtered_indices)
        n_sent = total_flows - n_filtered
        print("  Total flows:       %d" % total_flows)
        print("  Filtered (benign): %d (%.0f%%)" % (n_filtered, n_filtered / total_flows * 100))
        print("  Sent to LLM:      %d (%.0f%%)" % (n_sent, n_sent / total_flows * 100))
        print("─" * 53)

    # Group flows by source IP for temporal agent
    ip_groups = group_flows_by_ip(flows)
    print("\nUnique source IPs: %d" % len(ip_groups))
    for ip, indices in sorted(ip_groups.items(), key=lambda x: -len(x[1]))[:5]:
        print("  %s: %d flows" % (ip, len(indices)))

    # Determine flow range
    if args.sample > 0:
        end_idx = min(args.sample, total_flows)
        print("\nSample mode: analyzing first %d flows only" % end_idx)
    else:
        end_idx = total_flows

    # Check for checkpoint / resume
    existing_results = []
    start_idx = 0
    if args.resume:
        existing_results = load_checkpoint()
        if existing_results:
            start_idx = len(existing_results)
            print("Resuming from checkpoint: %d/%d already done" % (start_idx, end_idx))

    # API key — resolve per provider
    api_key = args.api_key or os.getenv("ANTHROPIC_API_KEY")
    specialist_provider = args.specialist_provider
    main_provider = args.provider

    # Validate API keys for chosen providers
    if specialist_provider == "openai" or main_provider == "openai":
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key:
            print("ERROR: OPENAI_API_KEY env var required for openai provider")
            return 1
    if specialist_provider == "anthropic" or main_provider == "anthropic":
        if not api_key:
            print("ERROR: No Anthropic API key. Set ANTHROPIC_API_KEY or use --api-key")
            return 1

    # Initialize 6 agents
    specialist_model = args.specialist_model or args.model
    print("\nInitializing 6 agents:")
    print("  Specialist model:      %s (%s)" % (specialist_model, specialist_provider))
    print("  Orchestrator/DA model: %s (%s)" % (args.model, main_provider))
    protocol_agent = ProtocolAgent(specialist_model, api_key, provider=specialist_provider)
    statistical_agent = StatisticalAgent(specialist_model, api_key, provider=specialist_provider)
    behavioural_agent = BehaviouralAgent(specialist_model, api_key, provider=specialist_provider)
    temporal_agent = TemporalAgent(specialist_model, api_key, provider=specialist_provider)
    da_agent = DevilsAdvocateAgent(args.model, api_key, provider=main_provider)
    da_weight = args.da_weight
    orchestrator_agent = OrchestratorAgent(args.model, api_key, da_weight=da_weight, provider=main_provider)
    print("  Devil's Advocate weight: %d%%" % da_weight)

    agents = [
        protocol_agent, statistical_agent, behavioural_agent,
        temporal_agent, da_agent, orchestrator_agent,
    ]

    eval_metadata = {
        "model": args.model,
        "specialist_model": specialist_model,
        "provider": main_provider,
        "specialist_provider": specialist_provider,
        "batch_dir": str(batch_dir),
        "total_flows": total_flows,
        "evaluated_flows": end_idx,
        "started_at": datetime.now().isoformat(),
        "architecture": "Phase 3: 6-Agent Multi-Agent NIDS",
        "agents": [
            "protocol", "statistical", "behavioural",
            "temporal", "devils_advocate", "orchestrator",
        ],
        "da_weight": "%d%%" % da_weight,
        "specialist_parallel": True,
        "cost_rates": {
            "input_per_1m_tokens": COST_INPUT * 1_000_000,
            "output_per_1m_tokens": COST_OUTPUT * 1_000_000,
        },
    }

    cost_limit = args.cost_limit

    # Count how many flows actually go to LLM
    llm_indices = [i for i in range(start_idx, end_idx) if i not in tier1_filtered_indices]
    tier1_in_range = [i for i in range(start_idx, end_idx) if i in tier1_filtered_indices]

    if args.tier1:
        print("\nStarting evaluation (%d to %d) — %d via LLM, %d auto-BENIGN..."
              % (start_idx, end_idx - 1, len(llm_indices), len(tier1_in_range)))
    else:
        print("\nStarting evaluation (%d to %d)..." % (start_idx, end_idx - 1))
    print_progress_header()

    results = list(existing_results)
    running_cost = sum(r["cost_usd"] for r in results)

    for i in range(start_idx, end_idx):
        flow = flows[i]
        gt = gt_by_id.get(str(i), {"label": -1, "attack_type": "Unknown"})
        meta = meta_by_idx.get(i, {"tier": 0, "attack_type": "Unknown"})

        # Tier 1: auto-classify filtered flows
        if i in tier1_filtered_indices:
            result = tier1_results[i]
            result["tier"] = meta.get("tier", 0)
            result["attack_type_actual"] = gt.get("attack_type", meta.get("attack_type", "Unknown"))
            result["label_actual"] = gt.get("label", -1)
            results.append(result)
            print_progress_row(result, gt, meta)
            continue

        # Cost limit check before LLM call
        if cost_limit > 0 and running_cost >= cost_limit:
            print("\n  COST LIMIT ($%.2f) reached at flow %d. Stopping." % (cost_limit, i))
            break

        result = analyze_flow(
            flow_idx=i,
            flow=flow,
            flows=flows,
            ip_groups=ip_groups,
            protocol_agent=protocol_agent,
            statistical_agent=statistical_agent,
            behavioural_agent=behavioural_agent,
            temporal_agent=temporal_agent,
            da_agent=da_agent,
            orchestrator_agent=orchestrator_agent,
        )

        # Enrich with ground truth for checkpoint
        result["tier"] = meta.get("tier", 0)
        result["attack_type_actual"] = gt.get("attack_type", meta.get("attack_type", "Unknown"))
        result["label_actual"] = gt.get("label", -1)

        running_cost += result["cost_usd"]
        results.append(result)
        print_progress_row(result, gt, meta)

        save_checkpoint(results, eval_metadata)

    # ── Final Summary ─────────────────────────────────────────────────────

    eval_metadata["completed_at"] = datetime.now().isoformat()
    eval_metadata["total_time_seconds"] = sum(r["time_seconds"] for r in results)
    eval_metadata["total_cost_usd"] = sum(r["cost_usd"] for r in results)
    eval_metadata["total_tokens"] = {
        "input": sum(r["tokens"]["input"] for r in results),
        "output": sum(r["tokens"]["output"] for r in results),
        "total": sum(r["tokens"]["total"] for r in results),
    }

    # Per-agent stats
    eval_metadata["agent_stats"] = {a.agent_name: a.get_stats() for a in agents}

    # Tier 1 metadata
    if args.tier1:
        n_filtered = len(tier1_filtered_indices)
        n_sent = len(results) - n_filtered
        llm_cost = sum(r["cost_usd"] for r in results if not r.get("tier1_filtered"))
        eval_metadata["tier1"] = {
            "enabled": True,
            "threshold": 0.15,
            "flows_filtered": n_filtered,
            "flows_sent_to_llm": n_sent,
            "filter_rate": n_filtered / len(results) if results else 0,
            "llm_cost": llm_cost,
            "estimated_cost_without_tier1": len(results) * (llm_cost / n_sent) if n_sent else 0,
        }

    # Calculate metrics
    metrics = calculate_metrics(results, gt_by_id, meta_by_idx)
    eval_metadata["metrics"] = metrics

    # Generate batch summary
    batch_summary = generate_batch_summary(results, metrics, eval_metadata)
    eval_metadata["batch_summary"] = batch_summary

    # Save batch summary to separate file if output is in stage1 dir
    output_file = Path(args.output)
    if "stage1" in str(output_file):
        # Derive attack type from output filename
        stem = output_file.stem.replace("_results", "")
        summary_path = output_file.parent / f"{stem}_batch_summary.json"
        with open(summary_path, "w") as f:
            json.dump(batch_summary, f, indent=2)
        print("Batch summary saved to: %s" % summary_path)

    # Save final results
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    final_output = {"evaluation_metadata": eval_metadata, "results": results}

    with open(output_file, "w") as f:
        json.dump(final_output, f, indent=2)

    # Remove checkpoint on successful completion
    if CHECKPOINT_FILE.exists() and args.sample == 0:
        CHECKPOINT_FILE.unlink()

    # Print metrics
    print_metrics(metrics, results)

    # Tier 1 cost comparison
    if args.tier1:
        tier1_meta = eval_metadata["tier1"]
        sep = "=" * 70
        print("\n" + sep)
        print("Tier 1 Pre-Filter — Cost Comparison")
        print(sep)
        print("  Flows filtered (auto-BENIGN): %d / %d (%.0f%%)"
              % (tier1_meta["flows_filtered"], len(results), tier1_meta["filter_rate"] * 100))
        print("  Flows sent to LLM:           %d" % tier1_meta["flows_sent_to_llm"])
        print("  Actual LLM cost:             $%.2f" % tier1_meta["llm_cost"])
        est = tier1_meta["estimated_cost_without_tier1"]
        print("  Est. cost without Tier 1:    $%.2f" % est)
        saved = est - tier1_meta["llm_cost"]
        pct = saved / est * 100 if est > 0 else 0
        print("  Savings:                     $%.2f (%.0f%%)" % (saved, pct))
        print(sep)

    print("\nResults saved to: %s" % output_file)

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Phase 3: Multi-Agent NIDS Evaluation"
    )
    parser.add_argument(
        "--batch", default=str(BATCH_DIR),
        help="Path to batch directory",
    )
    parser.add_argument(
        "--output", default=str(RESULTS_FILE),
        help="Output JSON path",
    )
    parser.add_argument(
        "--model", default="claude-sonnet-4-20250514",
        help="Model for orchestrator + DA (default: claude-sonnet-4-20250514)",
    )
    parser.add_argument(
        "--specialist-model", default=None,
        help="Model for 4 specialist agents (default: same as --model)",
    )
    parser.add_argument(
        "--specialist-provider", default="anthropic",
        choices=["anthropic", "openai"],
        help="LLM provider for specialist agents (default: anthropic)",
    )
    parser.add_argument(
        "--provider", default="anthropic",
        choices=["anthropic", "openai"],
        help="LLM provider for orchestrator + DA (default: anthropic)",
    )
    parser.add_argument(
        "--api-key", default=None,
        help="Anthropic API key (default: ANTHROPIC_API_KEY env var)",
    )
    parser.add_argument(
        "--sample", type=int, default=0,
        help="Analyze first N flows only (0 = all)",
    )
    parser.add_argument(
        "--da-weight", type=int, default=30,
        help="Devil's Advocate weight percentage (default: 30)",
    )
    parser.add_argument(
        "--labels", default=None,
        help="Path to labels/ground truth file (auto-detected if not provided)",
    )
    parser.add_argument(
        "--resume", action="store_true",
        help="Resume from checkpoint",
    )
    parser.add_argument(
        "--tier1", action="store_true",
        help="Enable Tier 1 RF pre-filter (auto-classify obvious benign flows)",
    )
    parser.add_argument(
        "--cost-limit", type=float, default=0,
        help="Hard cost limit in USD (0 = no limit)",
    )
    args = parser.parse_args()

    return run_evaluation(args)


if __name__ == "__main__":
    sys.exit(main())
