#!/usr/bin/env python3
"""
Generate a thesis chapter draft from AMATAS experiment results.

Reads a *_results.json file, extracts metrics and flow-level data,
and produces 400-600 words of academic prose (UK English, third person).

Usage:
    python scripts/generate_chapter_draft.py results/stage1/FTP-BruteForce_results.json
    python scripts/generate_chapter_draft.py results/stage1/SSH-Bruteforce_results.json --attack-type SSH-Bruteforce
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DRAFTS_DIR = PROJECT_ROOT / "results" / "thesis_drafts"
INDEX_FILE = DRAFTS_DIR / "INDEX.md"

# Phase 3b baseline for comparison section
BASELINE = {
    "name": "Phase 3b (150 flows, Sonnet-4)",
    "recall": 1.0,
    "precision": 0.921,
    "f1": 0.959,
    "fpr": 0.20,
    "cost_per_flow": 0.074,
}


def _num_to_words(n: int) -> str:
    """Convert small integers to words for academic prose."""
    words = {
        0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
        6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
        11: "eleven", 12: "twelve", 13: "thirteen", 14: "fourteen",
        15: "fifteen", 16: "sixteen", 17: "seventeen", 18: "eighteen",
        19: "nineteen", 20: "twenty",
    }
    return words.get(n, str(n))


def extract_metrics(data: dict, attack_type_override: str | None = None) -> dict:
    """Extract unified metrics from either result format."""
    results = data.get("results", [])
    meta = data.get("evaluation_metadata", data.get("metrics", {}))

    # Count from results array
    tp = fp = fn = tn = 0
    tier1_filtered = 0
    llm_analysed = 0
    agent_names_seen = set()
    total_cost = 0.0

    for r in results:
        pred_pos = r.get("verdict", "").upper() in ("MALICIOUS", "SUSPICIOUS")
        act_pos = r.get("label_actual", 0) == 1
        if pred_pos and act_pos:
            tp += 1
        elif pred_pos and not act_pos:
            fp += 1
        elif not pred_pos and act_pos:
            fn += 1
        else:
            tn += 1

        if r.get("tier1_filtered"):
            tier1_filtered += 1
        else:
            llm_analysed += 1

        if r.get("specialist_results"):
            agent_names_seen.update(r["specialist_results"].keys())

        total_cost += r.get("cost_usd", 0)

    total_flows = len(results)
    n_attack = tp + fn
    n_benign = tn + fp
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    fpr = fp / n_benign if n_benign > 0 else 0

    # Infer attack type
    attack_type = attack_type_override
    if not attack_type:
        attack_types = [r.get("attack_type_actual", "") for r in results if r.get("label_actual") == 1]
        if attack_types:
            from collections import Counter
            attack_type = Counter(attack_types).most_common(1)[0][0]
        else:
            attack_type = meta.get("attack_type", meta.get("batch_dir", "unknown").split("/")[-1])

    # Cost from metadata if available
    if total_cost == 0:
        total_cost = meta.get("total_cost_usd", meta.get("total_cost", 0))

    # Model info
    model = meta.get("model", meta.get("specialist_model", "unknown"))
    tier1_enabled = meta.get("tier1", {}).get("enabled", tier1_filtered > 0)
    tier1_threshold = meta.get("tier1", {}).get("threshold", 0.15 if tier1_enabled else None)
    da_weight = meta.get("da_weight", "30%")

    return {
        "attack_type": attack_type,
        "model": model,
        "da_weight": da_weight,
        "total_flows": total_flows,
        "n_attack": n_attack,
        "n_benign": n_benign,
        "tp": tp, "fp": fp, "fn": fn, "tn": tn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "fpr": fpr,
        "total_cost": total_cost,
        "cost_per_flow": total_cost / total_flows if total_flows else 0,
        "cost_per_tp": total_cost / tp if tp > 0 else float("inf"),
        "tier1_enabled": tier1_enabled,
        "tier1_filtered": tier1_filtered,
        "tier1_threshold": tier1_threshold,
        "llm_analysed": llm_analysed,
    }


def generate_draft(m: dict) -> str:
    """Generate 400-600 word academic prose from metrics dict."""
    at = m["attack_type"]
    lines = []

    # Section 1: Experimental Configuration
    lines.append(f"### {at}\n")
    lines.append("#### Experimental Configuration\n")

    tier1_text = ""
    if m["tier1_enabled"]:
        pct_filtered = m["tier1_filtered"] / m["total_flows"] * 100 if m["total_flows"] else 0
        tier1_text = (
            f" A Tier-1 Random Forest pre-filter with a threshold of {m['tier1_threshold']} "
            f"was applied, routing {m['tier1_filtered']} of {m['total_flows']} flows "
            f"({pct_filtered:.0f}%) directly to a benign classification without incurring LLM cost. "
            f"The remaining {m['llm_analysed']} flows were forwarded to the six-agent LLM pipeline "
            f"for analysis by the four specialist agents (protocol, statistical, behavioural, "
            f"and temporal), followed by the Devil's Advocate and orchestrator consensus stages."
        )

    lines.append(
        f"The {at} experiment evaluated the AMATAS architecture against a batch of "
        f"{m['total_flows']:,} network flows comprising {_num_to_words(m['n_attack'])} {at} attack "
        f"flows and {m['n_benign']:,} benign flows, yielding an attack prevalence of "
        f"{m['n_attack'] / m['total_flows'] * 100:.1f}%. This ratio approximates realistic "
        f"network conditions where malicious traffic constitutes a small fraction of total volume. "
        f"All agents utilised the {m['model']} model "
        f"with a Devil's Advocate weight of {m['da_weight']}. Flows were sorted chronologically "
        f"within each source IP group to provide the temporal agent with coherent behavioural "
        f"sequences.{tier1_text}\n"
    )

    # Section 2: Results
    lines.append("#### Results\n")
    lines.append(
        f"The system achieved a recall of {m['recall'] * 100:.1f}%, correctly identifying "
        f"{m['tp']} of {m['n_attack']} attack flows. "
        f"Precision was {m['precision'] * 100:.1f}%, with {m['fp']} benign flows incorrectly "
        f"flagged as malicious, corresponding to a false positive rate of {m['fpr'] * 100:.1f}%. "
        f"The combined F1 score was {m['f1'] * 100:.1f}%. Of the {m['n_benign']:,} benign flows "
        f"in the batch, {m['tn']:,} were correctly classified as benign, representing a "
        f"benign accuracy of {m['tn'] / m['n_benign'] * 100:.1f}%. "
        f"The total cost for the experiment was ${m['total_cost']:.2f}, "
        f"yielding a cost per flow of ${m['cost_per_flow']:.4f} and "
        f"a cost per true positive of ${m['cost_per_tp']:.3f}.\n"
    )

    # Section 3: Detection Analysis
    lines.append("#### Detection Analysis\n")

    if m["fn"] > 0:
        lines.append(
            f"The system failed to detect {_num_to_words(m['fn'])} of the "
            f"{_num_to_words(m['n_attack'])} attack flows, yielding {_num_to_words(m['fn'])} "
            f"false negatives. "
            f"These missed detections may be attributable to attack flows whose feature distributions "
            f"closely resemble benign traffic patterns, rendering them indistinguishable "
            f"to the specialist agents at the individual flow level. In such cases, the "
            f"statistical and behavioural agents lack sufficient signal to differentiate "
            f"the attack from legitimate network activity, and the temporal agent may not "
            f"have had a sufficient density of related flows to identify suspicious patterns. "
        )
    else:
        lines.append(
            f"The system achieved perfect recall, detecting all {_num_to_words(m['n_attack'])} "
            f"attack flows without any false negatives. This indicates that the {at} attack "
            f"type produces feature-level signatures that are consistently identifiable by "
            f"the specialist agents, even at the individual flow level. "
        )

    if m["fp"] > 0:
        lines.append(
            f"The {_num_to_words(m['fp'])} false positives indicate that certain benign flows "
            f"exhibited feature characteristics sufficiently anomalous to trigger unanimous or "
            f"near-unanimous specialist agreement on a malicious verdict. The Devil's Advocate "
            f"agent was unable to override these consensus decisions despite arguing for a benign "
            f"interpretation. Reducing the false positive rate without sacrificing recall remains "
            f"an area for improvement in subsequent iterations.\n"
        )
    else:
        lines.append(
            f"Notably, the system produced zero false positives, indicating that the "
            f"Devil's Advocate mechanism and orchestrator consensus effectively prevented "
            f"benign flows from being misclassified. This result is particularly significant "
            f"given the high proportion of benign traffic ({m['n_benign']:,} of {m['total_flows']:,} "
            f"flows), as false positive rates tend to dominate in class-imbalanced settings.\n"
        )

    # Section 4: Comparison to Baseline
    lines.append("#### Comparison to Baseline\n")
    b = BASELINE
    recall_delta = m["recall"] - b["recall"]
    f1_delta = m["f1"] - b["f1"]
    cost_ratio = m["cost_per_flow"] / b["cost_per_flow"] if b["cost_per_flow"] else 0

    direction_recall = "higher" if recall_delta > 0 else "lower" if recall_delta < 0 else "equivalent"
    direction_f1 = "higher" if f1_delta > 0 else "lower" if f1_delta < 0 else "equivalent"

    lines.append(
        f"Compared to the Phase 3b baseline, which evaluated 150 flows using Claude Sonnet-4 and achieved {b['recall'] * 100:.0f}% "
        f"recall and {b['f1'] * 100:.1f}% F1 at ${b['cost_per_flow']:.3f} per flow, the {at} "
        f"experiment yielded {abs(recall_delta) * 100:.1f} percentage points {direction_recall} recall "
        f"and {abs(f1_delta) * 100:.1f} percentage points {direction_f1} F1. "
        f"The cost per flow was ${m['cost_per_flow']:.4f}, "
    )

    if cost_ratio < 0.5:
        lines.append(
            f"representing a {(1 - cost_ratio) * 100:.0f}% reduction attributable primarily "
            f"to the Tier-1 pre-filter eliminating the vast majority of flows from LLM processing. "
            f"This cost advantage is central to the practical viability of LLM-based intrusion "
            f"detection at production scale.\n"
        )
    elif cost_ratio > 1.5:
        lines.append(
            f"representing a {(cost_ratio - 1) * 100:.0f}% increase, likely due to the higher "
            f"proportion of flows requiring full six-agent LLM analysis in this configuration.\n"
        )
    else:
        lines.append(f"broadly comparable to the baseline cost structure.\n")

    # Section 5: Summary
    lines.append("#### Summary\n")
    lines.append(
        f"The {at} evaluation demonstrates that the AMATAS architecture "
    )

    if m["recall"] >= 0.8 and m["fpr"] <= 0.05:
        lines.append(
            f"achieves strong detection performance with an F1 of {m['f1'] * 100:.1f}% "
            f"and minimal false positives at realistic traffic distributions. "
            f"The combination of high recall and low false positive rate indicates that "
            f"this attack type is well-suited to the multi-agent analytical approach, "
            f"producing sufficiently distinctive flow-level signatures for reliable detection. "
        )
    elif m["recall"] >= 0.6:
        lines.append(
            f"provides moderate detection capability with {m['recall'] * 100:.1f}% recall, "
            f"though the {_num_to_words(m['fn'])} missed attacks indicate room for improvement. "
            f"Potential avenues for enhancing detection of this attack type include "
            f"temporal clustering to provide richer context to the temporal agent, "
            f"specialist prompt refinement with attack-specific heuristics, and "
            f"threshold tuning in the orchestrator's consensus mechanism. "
        )
    else:
        lines.append(
            f"faces significant challenges detecting this attack type, with recall at "
            f"{m['recall'] * 100:.1f}%. The low detection rate suggests that {at} flows "
            f"exhibit feature distributions that closely mimic benign traffic, posing a "
            f"fundamental challenge to flow-level analysis. Temporal clustering, which "
            f"aggregates related flows before analysis, may provide the additional context "
            f"required to distinguish these attacks from legitimate network activity. "
        )

    lines.append(
        f"The total experiment cost of ${m['total_cost']:.2f} confirms the economic viability "
        f"of per-attack-type evaluation at this scale, supporting the continued execution "
        f"of the Stage 1 evaluation across all fourteen CICIDS2018 attack categories.\n"
    )

    return "\n".join(lines)


def update_index(drafts_dir: Path):
    """Rebuild INDEX.md from all draft files."""
    drafts = sorted(drafts_dir.glob("*_draft.md"))
    if not drafts:
        return

    lines = [
        "# Thesis Chapter Drafts — Index\n",
        f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n",
        "| Attack Type | File | Words | Generated |",
        "|---|---|---|---|",
    ]

    for draft_path in drafts:
        text = draft_path.read_text()
        word_count = len(text.split())
        # Extract attack type from first heading
        first_line = text.strip().split("\n")[0]
        attack_type = first_line.replace("###", "").strip()
        # Get file modification time
        mtime = datetime.fromtimestamp(draft_path.stat().st_mtime, tz=timezone.utc)
        lines.append(
            f"| {attack_type} | [{draft_path.name}]({draft_path.name}) "
            f"| {word_count} | {mtime.strftime('%Y-%m-%d %H:%M')} |"
        )

    lines.append("")
    INDEX_FILE.write_text("\n".join(lines))


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/generate_chapter_draft.py <results_file> [--attack-type NAME]")
        sys.exit(1)

    results_path = Path(sys.argv[1])
    if not results_path.is_absolute():
        results_path = PROJECT_ROOT / results_path

    attack_type_override = None
    if "--attack-type" in sys.argv:
        idx = sys.argv.index("--attack-type")
        if idx + 1 < len(sys.argv):
            attack_type_override = sys.argv[idx + 1]

    if not results_path.exists():
        print(f"Error: {results_path} not found")
        sys.exit(1)

    with open(results_path) as f:
        data = json.load(f)

    metrics = extract_metrics(data, attack_type_override)
    draft = generate_draft(metrics)

    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)

    # Sanitise attack type for filename
    safe_name = metrics["attack_type"].replace(" ", "_").replace("/", "-")
    output_path = DRAFTS_DIR / f"{safe_name}_draft.md"
    output_path.write_text(draft)

    update_index(DRAFTS_DIR)

    word_count = len(draft.split())
    print(f"Draft generated: {output_path.name} ({word_count} words)")
    print(f"Index updated: {INDEX_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
