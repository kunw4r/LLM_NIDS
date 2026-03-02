#!/usr/bin/env python3
"""Generate comprehensive run_log.txt from all experiment result files.

Reads Stage 1, MCP, Infiltration, and Ablation results and produces
a chronologically ordered, human-readable audit log.
"""

import json
from pathlib import Path
from datetime import datetime

RESULTS_DIR = Path(__file__).parent.parent / "results"
OUTPUT = RESULTS_DIR / "stage1" / "run_log.txt"

# Read only the ORIGINAL header (setup + batch creation, before experiment log)
if OUTPUT.exists():
    full_text = OUTPUT.read_text()
    # Cut off at the experiment execution log marker if present
    marker = "=" * 70 + "\nEXPERIMENT EXECUTION LOG"
    idx = full_text.find(marker)
    existing = full_text[:idx].rstrip() if idx >= 0 else full_text.rstrip()
else:
    existing = ""


def fmt_ts(iso_str):
    """Format ISO timestamp to readable form."""
    if not iso_str:
        return "unknown"
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    except Exception:
        return iso_str


def fmt_duration(seconds):
    """Format seconds to human readable."""
    if not seconds:
        return "unknown"
    m, s = divmod(int(seconds), 60)
    if m > 60:
        h, m = divmod(m, 60)
        return f"{h}h {m}m {s}s"
    return f"{m}m {s}s"


def fmt_cost(cost):
    """Format cost."""
    if cost is None:
        return "N/A"
    return f"${cost:.4f}"


def load_json(path):
    with open(path) as f:
        return json.load(f)


entries = []  # (timestamp_sortkey, text)

# ── Stage 1 experiments ──────────────────────────────────────────────
stage1_dir = RESULTS_DIR / "stage1"
for f in sorted(stage1_dir.glob("*_results.json")):
    if "overlap" in f.name or "validation" in f.name:
        continue  # skip overlap/validation variants (already in header)

    data = load_json(f)
    meta = data.get("evaluation_metadata", {})
    tier1 = meta.get("tier1", {})
    batch_summary = data.get("batch_summary", {})
    cost_summary = batch_summary.get("cost_summary", {})

    attack_type = f.stem.replace("_results", "")
    started = meta.get("started_at", "")
    completed = meta.get("completed_at", "")
    duration = meta.get("total_time_seconds", 0)
    model = meta.get("model", "unknown")
    total_flows = meta.get("total_flows", 0)
    total_cost = meta.get("total_cost_usd", 0)

    # Compute metrics from per-flow results
    results = data.get("results", [])
    tp = fp = fn = tn = 0
    verdicts = {"BENIGN": 0, "SUSPICIOUS": 0, "MALICIOUS": 0}
    for r in results:
        label = r.get("label_actual", 0)
        verdict = r.get("verdict", "BENIGN")
        verdicts[verdict] = verdicts.get(verdict, 0) + 1
        is_flagged = verdict in ("SUSPICIOUS", "MALICIOUS")
        is_attack = label == 1
        if is_attack and is_flagged:
            tp += 1
        elif not is_attack and is_flagged:
            fp += 1
        elif is_attack and not is_flagged:
            fn += 1
        else:
            tn += 1

    n_attack = tp + fn
    n_benign = fp + tn
    recall = tp / n_attack if n_attack > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    fpr = fp / n_benign * 100 if n_benign > 0 else 0

    flows_filtered = tier1.get("flows_filtered", 0)
    flows_to_llm = tier1.get("flows_sent_to_llm", 0)
    filter_rate = tier1.get("filter_rate", 0)

    # Count tier1-filtered vs LLM-analyzed from results if not in metadata
    if not flows_filtered and not flows_to_llm:
        flows_to_llm = sum(1 for r in results if r.get("tier", 0) == 0 and r.get("tier1_filtered") is not True)
        flows_filtered = total_flows - flows_to_llm

    # Agent cost breakdown
    agent_stats = meta.get("agent_stats", {})
    agent_lines = []
    if isinstance(agent_stats, dict):
        for name, a in agent_stats.items():
            cost = a.get("total_cost", 0)
            tokens = a.get("total_input_tokens", 0) + a.get("total_output_tokens", 0)
            agent_lines.append(f"    {name:20s} ${cost:.4f}  ({tokens:,} tokens)")
    elif isinstance(agent_stats, list):
        for a in agent_stats:
            name = a.get("agent_name", "?")
            cost = a.get("total_cost", 0)
            tokens = a.get("total_input_tokens", 0) + a.get("total_output_tokens", 0)
            agent_lines.append(f"    {name:20s} ${cost:.4f}  ({tokens:,} tokens)")

    # Use computed verdict distribution
    verdict_dist = verdicts

    text = f"""
======================================================================
[{fmt_ts(started)}] EXPERIMENT: {attack_type}
======================================================================
  Model: {model} | Provider: {meta.get('provider', 'openai')}
  Architecture: {meta.get('architecture', 'AMATAS v2')}
  DA Weight: {meta.get('da_weight', '30%')}
  Total Flows: {total_flows:,} ({n_attack} attack + {n_benign} benign)
  Started: {fmt_ts(started)}
  Completed: {fmt_ts(completed)}
  Duration: {fmt_duration(duration)}

  ── Tier 1 Pre-Filter ──
  Flows filtered (auto-benign): {flows_filtered} ({flows_filtered/total_flows*100:.1f}% filter rate)
  Flows sent to LLM pipeline:  {flows_to_llm}

  ── Detection Results ──
  TP: {tp:4d}  |  FP: {fp:4d}  |  FN: {fn:4d}  |  TN: {tn:4d}
  Recall:    {recall*100:.1f}%
  Precision: {precision*100:.1f}%
  F1 Score:  {f1*100:.1f}%
  FPR:       {fpr:.1f}%

  ── Verdict Distribution ──
  BENIGN: {verdict_dist.get('BENIGN', 0)}  |  SUSPICIOUS: {verdict_dist.get('SUSPICIOUS', 0)}  |  MALICIOUS: {verdict_dist.get('MALICIOUS', 0)}

  ── Cost Breakdown ──
  Total cost: {fmt_cost(total_cost)}
  Cost/flow (all):  {fmt_cost(cost_summary.get('cost_per_flow', 0))}
  Cost/flow (LLM):  {fmt_cost(cost_summary.get('cost_per_llm_flow', 0))}
  Est. cost without Tier 1: {fmt_cost(tier1.get('estimated_cost_without_tier1', 0))}
"""
    if agent_lines:
        text += "  ── Per-Agent Costs ──\n"
        text += "\n".join(agent_lines) + "\n"

    text += f"""
  ── Verification ──
  Result file: {f.name}
  Batch dir: {meta.get('batch_dir', 'N/A')}
  Status: COMPLETE ({meta.get('evaluated_flows', 0)}/{total_flows} flows evaluated)
"""

    sort_key = started or "9999"
    entries.append((sort_key, text))

# ── MCP Comparison ───────────────────────────────────────────────────
mcp_summary = RESULTS_DIR / "mcp" / "comparison_summary.json"
if mcp_summary.exists():
    data = load_json(mcp_summary)
    timestamp = data.get("timestamp", "")
    batch_info = data.get("batch", {})

    text = f"""
######################################################################
[{fmt_ts(timestamp)}] MCP COMPARISON EXPERIMENT
######################################################################
  Batch: {batch_info.get('total_flows', 100)} flows ({batch_info.get('attack_flows', 30)} attack + {batch_info.get('benign_flows', 70)} benign)
  Attack types: {', '.join(batch_info.get('attack_types', []))}
  Total cost: {fmt_cost(data.get('total_cost', 0))}

"""
    for cfg in data.get("configs", []):
        c = cfg.get("config", "?")
        text += f"""  ── Config {c}: {cfg.get('model', '?')} ──
  Recall: {cfg.get('recall', 0):.1f}%  |  Precision: {cfg.get('precision', 0):.1f}%  |  F1: {cfg.get('f1', 0):.1f}%
  FPR: {cfg.get('fpr', 0):.1f}%  |  Cost: {fmt_cost(cfg.get('total_cost', 0))}  |  Cost/flow: {fmt_cost(cfg.get('cost_per_flow', 0))}
  Confusion: TP={cfg['confusion']['tp']}  FP={cfg['confusion']['fp']}  FN={cfg['confusion']['fn']}  TN={cfg['confusion']['tn']}

"""

    amatas = data.get("amatas_baseline", {})
    if amatas:
        text += f"""  ── AMATAS v2 Baseline (for comparison) ──
  Recall: {amatas.get('recall', 0)}%  |  F1: {amatas.get('f1', 0)}%  |  FPR: {amatas.get('fpr', 0)}%
  Architecture: {amatas.get('architecture', 'N/A')}
"""

    entries.append((timestamp or "9999", text))

# ── Infiltration Clustering ──────────────────────────────────────────
infil_summary = RESULTS_DIR / "infiltration" / "comparison_summary.json"
if infil_summary.exists():
    data = load_json(infil_summary)
    timestamp = data.get("timestamp", "")

    text = f"""
######################################################################
[{fmt_ts(timestamp)}] INFILTRATION CLUSTERING EXPERIMENT (v3)
######################################################################
  Model: {data.get('model', 'gpt-4o')}
  Total cost: {fmt_cost(data.get('total_cost', 0))}
  Batch: 1000 flows (50 attack + 950 benign)

"""
    for cond_key in ["A", "B", "C"]:
        cond = data["conditions"].get(cond_key, {})
        m = cond.get("metrics", {})
        text += f"""  ── Condition {cond_key}: {cond.get('label', '?')} ──
  TP: {m.get('tp', 0)}  |  FP: {m.get('fp', 0)}  |  FN: {m.get('fn', 0)}  |  TN: {m.get('tn', 0)}
  Recall: {m.get('recall', 0)*100:.1f}%  |  FPR: {m.get('false_positive_rate', 0)*100:.1f}%  |  F1: {m.get('f1', 0)*100:.1f}%
  Cost: {fmt_cost(m.get('total_cost', 0))}  |  Flows to LLM: {m.get('flows_analyzed_by_llm', 0)}

"""
    entries.append((timestamp or "9999", text))

# ── Ablation Study ───────────────────────────────────────────────────
ablation_summary = RESULTS_DIR / "ablation" / "ablation_summary.json"
if ablation_summary.exists():
    data = load_json(ablation_summary)
    timestamp = data.get("date", "")

    text = f"""
######################################################################
[{fmt_ts(timestamp)}] AGENT ABLATION STUDY
######################################################################
  {data.get('description', '')}

"""
    for cond_key, cond in data.get("conditions", {}).items():
        conf = cond.get("confusion", {})
        text += f"""  ── {cond.get('label', cond_key)} ──
  Disabled: {', '.join(cond.get('disabled_agents', [])) or 'none'}
  TP: {conf.get('tp', 0)}  |  FP: {conf.get('fp', 0)}  |  FN: {conf.get('fn', 0)}  |  TN: {conf.get('tn', 0)}
  Recall: {cond.get('recall', 0)*100:.1f}%  |  F1: {cond.get('f1', 0)*100:.1f}%  |  FPR: {cond.get('fpr', 0)*100:.1f}%
  Cost: {fmt_cost(cond.get('cost', 0))}

"""
    entries.append((timestamp or "9999", text))

# ── Sort chronologically and write ───────────────────────────────────
entries.sort(key=lambda e: e[0])

# Build final log: existing header + all experiment entries
output_lines = existing.rstrip()
output_lines += "\n\n"
output_lines += "=" * 70 + "\n"
output_lines += "EXPERIMENT EXECUTION LOG\n"
output_lines += "=" * 70 + "\n"
output_lines += "Generated from result files for verification.\n"
output_lines += f"Log generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n"

for _, text in entries:
    output_lines += text

# ── Overall Summary ──────────────────────────────────────────────────
summary_path = stage1_dir / "running_summary.json"
if summary_path.exists():
    summary = load_json(summary_path)
    overall = summary.get("overall", {})
    experiments = summary.get("experiments", [])

    output_lines += "\n" + "=" * 70 + "\n"
    output_lines += "STAGE 1 AGGREGATE SUMMARY\n"
    output_lines += "=" * 70 + "\n"
    output_lines += f"  Total experiments: {len(experiments)}\n"
    output_lines += f"  Total flows: {overall.get('total_flows', 0):,}\n"
    output_lines += f"  Total cost: ${overall.get('total_cost', 0):.2f}\n"
    output_lines += f"  Best detected: {overall.get('best_detected', 'N/A')} (F1={overall.get('best_f1', 0)}%)\n"
    output_lines += f"  Hardest: {overall.get('hardest', 'N/A')} (Recall={overall.get('hardest_recall', 0)}%)\n"
    output_lines += f"  Average FPR: {overall.get('avg_fpr', 0)}%\n\n"

    output_lines += "  ┌─────────────────────────┬────────┬────────┬────────┬──────────┐\n"
    output_lines += "  │ Attack Type             │ Recall │ FPR    │ F1     │ Cost     │\n"
    output_lines += "  ├─────────────────────────┼────────┼────────┼────────┼──────────┤\n"
    for exp in sorted(experiments, key=lambda e: e.get("f1", 0), reverse=True):
        at = exp.get("attack_type", "?")[:23]
        output_lines += f"  │ {at:23s} │ {exp.get('recall', 0):5.1f}% │ {exp.get('fpr', 0):5.1f}% │ {exp.get('f1', 0):5.1f}% │ ${exp.get('cost', 0):7.2f} │\n"
    output_lines += "  └─────────────────────────┴────────┴────────┴────────┴──────────┘\n"

OUTPUT.write_text(output_lines)
print(f"Run log written to {OUTPUT}")
print(f"Total entries: {len(entries)} experiments")
print(f"File size: {len(output_lines):,} bytes")
