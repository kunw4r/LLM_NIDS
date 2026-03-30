#!/usr/bin/env python3
"""
Agent Reasoning Analysis for AMATAS

Analyses the reasoning patterns, feature focus, agreement dynamics, and
effectiveness of the six AMATAS agents across all Stage 1 experiment results.

Produces:
  1. Feature focus by agent — what flow features each agent references most
  2. Agent agreement matrix — pairwise agreement rates
  3. Swing vote analysis — which agent tips borderline verdicts
  4. Faithfulness by attack type — are agents more faithful on clear vs ambiguous signals
  5. Reasoning length analysis — token/word counts and correlation with accuracy
  6. Devil's Advocate effectiveness — DA impact on true positives vs false negatives

Usage:
    python scripts/agent_reasoning_analysis.py

Output:
    results/analysis/reasoning_analysis.json — all analysis results
    Printed summary of key findings to stdout
"""

import json
import re
import sys
from pathlib import Path
from collections import defaultdict, Counter

RESULTS_DIR = Path(__file__).resolve().parent.parent / "results" / "stage1"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "results" / "analysis"

SPECIALIST_AGENTS = ["protocol", "statistical", "behavioural", "temporal"]
ALL_AGENTS = SPECIALIST_AGENTS + ["devils_advocate", "orchestrator"]

# Feature keywords to search for in reasoning text
FEATURE_KEYWORDS = {
    "port": [r"\bport\s+\d+", r"L4_(?:SRC|DST)_PORT", r"\b(?:FTP|SSH|HTTP|HTTPS|DNS|SMB|NTP|RDP)\b"],
    "protocol": [r"\b(?:TCP|UDP|ICMP)\b", r"\bPROTOCOL\s+\d+"],
    "tcp_flags": [r"\b(?:SYN|ACK|RST|FIN|PSH|URG)\b", r"TCP_FLAGS", r"\bflag"],
    "duration": [r"\bduration\b", r"\b\d+\s*ms\b", r"FLOW_DURATION", r"\bshort\s+(?:flow|duration|connection)"],
    "bytes": [r"\bbytes?\b", r"IN_BYTES", r"OUT_BYTES", r"\bdata\s+transfer"],
    "packets": [r"\bpackets?\b", r"IN_PKTS", r"OUT_PKTS"],
    "ip_address": [r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b", r"IPV4_(?:SRC|DST)_ADDR", r"\bsource\s+IP\b", r"\bdestination\s+IP\b"],
    "temporal_pattern": [r"\brepetitive\b", r"\bperiodic\b", r"\bburst\b", r"\bpattern\b", r"\bfrequen"],
    "ip_history": [r"\bhistory\b", r"\bprevious\s+flows?\b", r"\bconnected\s+flows?\b", r"\bother\s+flows?\b", r"\bsame\s+(?:source|IP)\b"],
    "iat": [r"\binter.?arrival\b", r"IAT", r"SRC_TO_DST_IAT", r"DST_TO_SRC_IAT"],
    "mitre": [r"\bT\d{4}\b", r"\bMITRE\b", r"\bATT&CK\b"],
}

VERDICT_MAP = {"BENIGN": 0, "SUSPICIOUS": 1, "MALICIOUS": 2}


def load_all_results():
    """Load all Stage 1 result files, returning LLM-analysed flows only."""
    result_files = sorted(RESULTS_DIR.glob("*_results.json"))
    result_files = [f for f in result_files
                    if "overlap" not in f.name
                    and "validation" not in f.name
                    and "gpt4o" not in f.name
                    and "tier1_gpt4o" not in f.name]

    flows = []
    for fpath in result_files:
        attack_type = fpath.stem.replace("_results", "")
        with open(fpath) as f:
            data = json.load(f)
        for flow in data["results"]:
            if flow.get("tier1_filtered", False):
                continue
            flow["_attack_type"] = attack_type
            flows.append(flow)

    return flows


def get_agent_text(flow, agent_name):
    """Get all reasoning text for an agent from a flow."""
    parts = []
    if agent_name in ("protocol", "statistical", "behavioural", "temporal"):
        agent_data = flow.get("specialist_results", {}).get(agent_name, {})
        if agent_data.get("reasoning"):
            parts.append(agent_data["reasoning"])
        for ev in agent_data.get("key_evidence", []):
            parts.append(str(ev))
    elif agent_name == "devils_advocate":
        da = flow.get("devils_advocate", {})
        for key in ["counter_argument", "strongest_benign_indicator"]:
            if da.get(key) and da[key] != "Tier 1 pre-filter":
                parts.append(str(da[key]))
        for alt in da.get("alternative_explanations", []):
            parts.append(str(alt))
        for w in da.get("weaknesses_in_malicious_case", []):
            parts.append(str(w))
    elif agent_name == "orchestrator":
        if flow.get("reasoning") and "Tier 1 RF pre-filter" not in flow["reasoning"]:
            parts.append(flow["reasoning"])
    return " ".join(parts)


def get_agent_verdict(flow, agent_name):
    """Get the verdict for an agent."""
    if agent_name in SPECIALIST_AGENTS:
        agent_data = flow.get("specialist_results", {}).get(agent_name, {})
        return agent_data.get("verdict", "UNKNOWN")
    elif agent_name == "devils_advocate":
        return "BENIGN"  # DA always argues benign
    elif agent_name == "orchestrator":
        return flow.get("verdict", "UNKNOWN")
    return "UNKNOWN"


def get_agent_confidence(flow, agent_name):
    """Get confidence for an agent."""
    if agent_name in SPECIALIST_AGENTS:
        agent_data = flow.get("specialist_results", {}).get(agent_name, {})
        return agent_data.get("confidence", 0)
    elif agent_name == "devils_advocate":
        da = flow.get("devils_advocate", {})
        return da.get("confidence", da.get("confidence_benign", 0))
    elif agent_name == "orchestrator":
        return flow.get("confidence", 0)
    return 0


# ---------------------------------------------------------------------------
# Analysis 1: Feature focus by agent
# ---------------------------------------------------------------------------

def analyse_feature_focus(flows):
    """For each agent, count how often each feature category is mentioned."""
    agent_feature_counts = {a: Counter() for a in ALL_AGENTS}
    agent_flow_counts = {a: 0 for a in ALL_AGENTS}

    for flow in flows:
        for agent in ALL_AGENTS:
            text = get_agent_text(flow, agent)
            if not text:
                continue
            agent_flow_counts[agent] += 1
            for feature, patterns in FEATURE_KEYWORDS.items():
                for pattern in patterns:
                    if re.search(pattern, text, re.IGNORECASE):
                        agent_feature_counts[agent][feature] += 1
                        break  # count each feature category once per flow

    # Convert to percentages
    result = {}
    for agent in ALL_AGENTS:
        total = agent_flow_counts[agent]
        if total == 0:
            continue
        features_pct = {}
        for feature in FEATURE_KEYWORDS:
            count = agent_feature_counts[agent][feature]
            features_pct[feature] = {
                "count": count,
                "pct": round(100.0 * count / total, 1),
            }
        # Sort by percentage descending
        sorted_features = sorted(features_pct.items(), key=lambda x: -x[1]["pct"])
        result[agent] = {
            "flows_analysed": total,
            "features": dict(sorted_features),
        }

    return result


# ---------------------------------------------------------------------------
# Analysis 2: Agent agreement matrix
# ---------------------------------------------------------------------------

def analyse_agreement(flows):
    """Compute pairwise agreement rates between specialist agents."""
    pairs = []
    for i, a1 in enumerate(SPECIALIST_AGENTS):
        for a2 in SPECIALIST_AGENTS[i+1:]:
            pairs.append((a1, a2))

    pair_stats = {f"{a1}_vs_{a2}": {"agree": 0, "disagree": 0, "total": 0}
                  for a1, a2 in pairs}

    for flow in flows:
        verdicts = {}
        for agent in SPECIALIST_AGENTS:
            v = get_agent_verdict(flow, agent)
            if v != "UNKNOWN":
                verdicts[agent] = v

        for a1, a2 in pairs:
            if a1 in verdicts and a2 in verdicts:
                key = f"{a1}_vs_{a2}"
                pair_stats[key]["total"] += 1
                if verdicts[a1] == verdicts[a2]:
                    pair_stats[key]["agree"] += 1
                else:
                    pair_stats[key]["disagree"] += 1

    # Compute rates
    result = {}
    for key, stats in pair_stats.items():
        if stats["total"] > 0:
            result[key] = {
                "agree": stats["agree"],
                "disagree": stats["disagree"],
                "total": stats["total"],
                "agreement_pct": round(100.0 * stats["agree"] / stats["total"], 1),
            }

    return result


# ---------------------------------------------------------------------------
# Analysis 3: Swing vote analysis
# ---------------------------------------------------------------------------

def analyse_swing_votes(flows):
    """On borderline flows, which agent tipped the final verdict?

    A "swing" occurs when the final verdict differs from what the majority
    of specialists voted for, or when a single agent's verdict aligns with
    the final but others disagree.
    """
    swing_counts = Counter()
    borderline_flows = 0

    for flow in flows:
        # Collect specialist verdicts
        specialist_verdicts = {}
        for agent in SPECIALIST_AGENTS:
            v = get_agent_verdict(flow, agent)
            if v != "UNKNOWN":
                specialist_verdicts[agent] = VERDICT_MAP.get(v, 1)

        if len(specialist_verdicts) < 3:
            continue

        final_verdict = VERDICT_MAP.get(flow.get("verdict", ""), 1)
        consensus = flow.get("consensus_score", 1.0)

        # Borderline: consensus < 0.7 or mixed specialist verdicts
        verdict_values = list(specialist_verdicts.values())
        if len(set(verdict_values)) > 1 or (consensus is not None and consensus < 0.7):
            borderline_flows += 1
            # Which agents aligned with final verdict?
            for agent, v in specialist_verdicts.items():
                if v == final_verdict:
                    swing_counts[agent] += 1

            # Check DA influence
            da_conf = get_agent_confidence(flow, "devils_advocate")
            if da_conf > 0.6 and final_verdict == 0:  # DA pushed toward BENIGN
                swing_counts["devils_advocate"] += 1

    return {
        "borderline_flows": borderline_flows,
        "swing_counts": dict(swing_counts),
        "swing_pct": {a: round(100.0 * c / max(borderline_flows, 1), 1)
                      for a, c in swing_counts.items()},
    }


# ---------------------------------------------------------------------------
# Analysis 4: Faithfulness by attack type
# ---------------------------------------------------------------------------

def analyse_faithfulness_by_attack(flows):
    """Load faithfulness audit results and cross-reference with attack types.

    Uses the faithfulness_summary.json if available, otherwise returns empty.
    """
    summary_path = OUTPUT_DIR / "faithfulness_summary.json"
    if summary_path.exists():
        with open(summary_path) as f:
            summary = json.load(f)
        return summary.get("per_attack_type", [])

    # Fall back: load from legacy location
    legacy_path = RESULTS_DIR / "faithfulness_audit.json"
    if legacy_path.exists():
        with open(legacy_path) as f:
            data = json.load(f)
        per_attack = data.get("per_attack_type", {})
        result = []
        for at, stats in sorted(per_attack.items()):
            verifiable = stats.get("verifiable", stats.get("claims", 0))
            correct = stats.get("correct", 0)
            pct = 100.0 * correct / verifiable if verifiable > 0 else 0
            result.append({
                "attack_type": at,
                "claims": verifiable,
                "correct": correct,
                "faithfulness_pct": round(pct, 1),
            })
        return result

    return []


# ---------------------------------------------------------------------------
# Analysis 5: Reasoning length analysis
# ---------------------------------------------------------------------------

def analyse_reasoning_length(flows):
    """Measure reasoning length per agent and correlate with accuracy."""
    agent_lengths = {a: [] for a in ALL_AGENTS}
    correct_lengths = {a: [] for a in ALL_AGENTS}
    incorrect_lengths = {a: [] for a in ALL_AGENTS}

    for flow in flows:
        final_verdict = flow.get("verdict", "UNKNOWN")
        actual_label = flow.get("label_actual", 0)
        is_correct_final = (
            (final_verdict == "BENIGN" and actual_label == 0) or
            (final_verdict in ("SUSPICIOUS", "MALICIOUS") and actual_label == 1)
        )

        for agent in ALL_AGENTS:
            text = get_agent_text(flow, agent)
            if not text:
                continue
            word_count = len(text.split())
            agent_lengths[agent].append(word_count)
            if is_correct_final:
                correct_lengths[agent].append(word_count)
            else:
                incorrect_lengths[agent].append(word_count)

    result = {}
    for agent in ALL_AGENTS:
        lengths = agent_lengths[agent]
        if not lengths:
            continue
        c_lens = correct_lengths[agent]
        i_lens = incorrect_lengths[agent]
        result[agent] = {
            "flows": len(lengths),
            "mean_words": round(sum(lengths) / len(lengths), 1),
            "min_words": min(lengths),
            "max_words": max(lengths),
            "median_words": sorted(lengths)[len(lengths) // 2],
            "correct_mean_words": round(sum(c_lens) / len(c_lens), 1) if c_lens else None,
            "incorrect_mean_words": round(sum(i_lens) / len(i_lens), 1) if i_lens else None,
        }

    return result


# ---------------------------------------------------------------------------
# Analysis 6: Devil's Advocate effectiveness
# ---------------------------------------------------------------------------

def analyse_da_effectiveness(flows):
    """Analyse DA's impact on true positives and false negatives.

    For true positives: how strong was DA's counter-argument?
    For false negatives: was DA the tipping point?
    """
    tp_da_confidence = []
    fn_da_confidence = []
    fp_da_confidence = []
    tn_da_confidence = []

    # Track DA influence on misclassifications
    fn_da_strong = 0  # FN where DA confidence > 0.6
    fn_total = 0

    for flow in flows:
        final_verdict = flow.get("verdict", "UNKNOWN")
        actual_label = flow.get("label_actual", 0)
        da = flow.get("devils_advocate", {})
        da_conf = da.get("confidence", da.get("confidence_benign", 0))

        if actual_label == 1:  # actual attack
            if final_verdict in ("SUSPICIOUS", "MALICIOUS"):
                tp_da_confidence.append(da_conf)
            else:
                fn_da_confidence.append(da_conf)
                fn_total += 1
                if da_conf > 0.6:
                    fn_da_strong += 1
        else:  # actual benign
            if final_verdict == "BENIGN":
                tn_da_confidence.append(da_conf)
            else:
                fp_da_confidence.append(da_conf)

    def _stats(values):
        if not values:
            return {"count": 0, "mean": None, "median": None}
        return {
            "count": len(values),
            "mean": round(sum(values) / len(values), 3),
            "median": round(sorted(values)[len(values) // 2], 3),
        }

    return {
        "true_positives": _stats(tp_da_confidence),
        "false_negatives": _stats(fn_da_confidence),
        "true_negatives": _stats(tn_da_confidence),
        "false_positives": _stats(fp_da_confidence),
        "fn_with_strong_da": fn_da_strong,
        "fn_total": fn_total,
        "fn_strong_da_pct": round(100.0 * fn_da_strong / fn_total, 1) if fn_total > 0 else 0,
        "interpretation": (
            f"Of {fn_total} false negatives, {fn_da_strong} ({round(100.0 * fn_da_strong / max(fn_total,1), 1)}%) "
            f"had DA confidence > 0.6, suggesting the DA's counter-argument may have "
            f"contributed to suppressing correct detections."
        ),
    }


# ---------------------------------------------------------------------------
# Print summary
# ---------------------------------------------------------------------------

def print_findings(analysis):
    """Print key findings to stdout."""
    print("\n" + "=" * 72)
    print("AGENT REASONING ANALYSIS — KEY FINDINGS")
    print("=" * 72)

    # Feature focus
    print(f"\n{'─' * 72}")
    print("1. FEATURE FOCUS BY AGENT (% of flows mentioning each feature)")
    print(f"{'─' * 72}")
    ff = analysis["feature_focus"]
    print(f"  {'Agent':<18}", end="")
    top_features = ["port", "protocol", "tcp_flags", "duration", "bytes", "ip_history", "temporal_pattern"]
    for feat in top_features:
        print(f" {feat:<12}", end="")
    print()
    print(f"  {'─'*18}", end="")
    for _ in top_features:
        print(f" {'─'*12}", end="")
    print()
    for agent in ALL_AGENTS:
        if agent not in ff:
            continue
        print(f"  {agent:<18}", end="")
        for feat in top_features:
            pct = ff[agent]["features"].get(feat, {}).get("pct", 0)
            print(f" {pct:>6.1f}%     ", end="")
        print()

    # Agreement matrix
    print(f"\n{'─' * 72}")
    print("2. AGENT AGREEMENT RATES (pairwise)")
    print(f"{'─' * 72}")
    ag = analysis["agreement_matrix"]
    for pair, stats in sorted(ag.items(), key=lambda x: -x[1]["agreement_pct"]):
        print(f"  {pair:<35} {stats['agreement_pct']:>5.1f}% ({stats['agree']}/{stats['total']})")

    # Swing votes
    print(f"\n{'─' * 72}")
    print("3. SWING VOTE ANALYSIS (borderline flows)")
    print(f"{'─' * 72}")
    sv = analysis["swing_votes"]
    print(f"  Borderline flows (mixed verdicts): {sv['borderline_flows']}")
    for agent, pct in sorted(sv["swing_pct"].items(), key=lambda x: -x[1]):
        count = sv["swing_counts"][agent]
        print(f"  {agent:<24} aligned with final verdict {pct:>5.1f}% ({count}x)")

    # Reasoning length
    print(f"\n{'─' * 72}")
    print("4. REASONING LENGTH (mean words per flow)")
    print(f"{'─' * 72}")
    rl = analysis["reasoning_length"]
    print(f"  {'Agent':<24} {'Mean':>6} {'Correct':>10} {'Incorrect':>10}")
    print(f"  {'─'*24} {'─'*6} {'─'*10} {'─'*10}")
    for agent in ALL_AGENTS:
        if agent not in rl:
            continue
        s = rl[agent]
        c_mean = f"{s['correct_mean_words']:.0f}" if s['correct_mean_words'] else "—"
        i_mean = f"{s['incorrect_mean_words']:.0f}" if s['incorrect_mean_words'] else "—"
        print(f"  {agent:<24} {s['mean_words']:>6.0f} {c_mean:>10} {i_mean:>10}")

    # DA effectiveness
    print(f"\n{'─' * 72}")
    print("5. DEVIL'S ADVOCATE EFFECTIVENESS")
    print(f"{'─' * 72}")
    da = analysis["da_effectiveness"]
    print(f"  True Positives  — DA confidence mean: {da['true_positives']['mean']}")
    print(f"  False Negatives — DA confidence mean: {da['false_negatives']['mean']}")
    print(f"  True Negatives  — DA confidence mean: {da['true_negatives']['mean']}")
    print(f"  False Positives — DA confidence mean: {da['false_positives']['mean']}")
    print(f"\n  {da['interpretation']}")

    print("\n" + "=" * 72)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    print("Loading Stage 1 results...")
    flows = load_all_results()
    print(f"Loaded {len(flows)} LLM-analysed flows from {RESULTS_DIR}")

    analysis = {}

    print("\n1/6 Analysing feature focus...")
    analysis["feature_focus"] = analyse_feature_focus(flows)

    print("2/6 Computing agreement matrix...")
    analysis["agreement_matrix"] = analyse_agreement(flows)

    print("3/6 Analysing swing votes...")
    analysis["swing_votes"] = analyse_swing_votes(flows)

    print("4/6 Loading faithfulness by attack type...")
    analysis["faithfulness_by_attack_type"] = analyse_faithfulness_by_attack(flows)

    print("5/6 Analysing reasoning length...")
    analysis["reasoning_length"] = analyse_reasoning_length(flows)

    print("6/6 Analysing Devil's Advocate effectiveness...")
    analysis["da_effectiveness"] = analyse_da_effectiveness(flows)

    # Metadata
    analysis["metadata"] = {
        "total_flows": len(flows),
        "results_dir": str(RESULTS_DIR),
    }

    # Save
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_DIR / "reasoning_analysis.json"
    with open(output_path, "w") as f:
        json.dump(analysis, f, indent=2, default=str)
    print(f"\nSaved full analysis to {output_path}")

    # Print findings
    print_findings(analysis)

    return analysis


if __name__ == "__main__":
    main()
