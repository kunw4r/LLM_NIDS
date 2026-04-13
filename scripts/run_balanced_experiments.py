#!/usr/bin/env python3
"""
Balanced batch experiments: AMATAS multi-agent vs vanilla single-LLM.

Creates balanced batches (25 attack + 25 benign = 50 flows each) for:
  1. 14 individual attack-type batches
  2. 1 mixed-attack batch (≈2 attacks per type + benign)

Runs each batch through:
  A. Full 6-agent AMATAS pipeline (no Tier 1 RF pre-filter)
  B. Vanilla single-LLM baseline (one GPT-4o call per flow, engineered prompt)

Compares multi-agent vs single-agent detection performance on identical data.

Usage:
    python scripts/run_balanced_experiments.py                  # run everything
    python scripts/run_balanced_experiments.py --create-only    # just create batches
    python scripts/run_balanced_experiments.py --only Bot       # single attack type
    python scripts/run_balanced_experiments.py --vanilla-only   # skip AMATAS, run vanilla only
    python scripts/run_balanced_experiments.py --amatas-only    # skip vanilla, run AMATAS only
"""

import argparse
import json
import os
import sys
import time
import numpy as np
import pandas as pd
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

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

# ── Paths ────────────────────────────────────────────────────────────────────

VALIDATION_CSV = PROJECT_ROOT / "data" / "datasets" / "validation.csv"
BATCHES_DIR = PROJECT_ROOT / "data" / "batches" / "balanced"
RESULTS_DIR = PROJECT_ROOT / "results" / "balanced"

# ── Configuration ────────────────────────────────────────────────────────────

SEED = 42
N_ATTACK = 25
N_BENIGN = 25
MODEL = "gpt-4o"
PROVIDER = "openai"
DA_WEIGHT = 30
COST_LIMIT_PER_BATCH = 5.00

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

ALL_ATTACK_TYPES = [
    "Bot", "Brute_Force_-Web", "Brute_Force_-XSS",
    "DDOS_attack-HOIC", "DDOS_attack-LOIC-UDP", "DDoS_attacks-LOIC-HTTP",
    "DoS_attacks-GoldenEye", "DoS_attacks-Hulk",
    "DoS_attacks-SlowHTTPTest", "DoS_attacks-Slowloris",
    "FTP-BruteForce", "Infilteration", "SQL_Injection", "SSH-Bruteforce",
]

# ── Vanilla single-LLM prompt (from MCP Config B — best single-agent) ───────

VANILLA_SYSTEM_PROMPT = """You are an expert network intrusion detection analyst. Analyse the given NetFlow record and classify it as BENIGN, SUSPICIOUS, or MALICIOUS.

IMPORTANT CONTEXT:
- This is CICIDS2018 dataset traffic. All IPs are anonymised (private RFC1918 ranges).
- Most traffic (~95%) is benign. Require POSITIVE evidence of anomaly before flagging.
- Do NOT flag traffic as suspicious simply because it uses private IPs.

KNOWN ATTACK PATTERNS:

1. BRUTE FORCE (FTP/SSH):
   - Repeated connections to port 21 (FTP) or 22 (SSH)
   - Small packet sizes (credentials are short)
   - Short flow durations (rapid login attempts)
   - TCP RST/FIN flags (rejected attempts)

2. DENIAL OF SERVICE:
   - GoldenEye: HTTP flood, many connections to port 80/443
   - Slowloris: Partial HTTP requests, long-duration with minimal data
   - SlowHTTPTest: Slow POST/read attacks, similar to Slowloris
   - Hulk: Rapid HTTP GET/POST flood, high volume short-duration
   - LOIC-HTTP: High-volume HTTP flood, many packets, large byte counts
   - LOIC-UDP: UDP flood (protocol 17), high packet count
   - HOIC: HTTP flood with boosted throughput

3. WEB APPLICATION ATTACKS:
   - Brute Force Web: HTTP port, repeated small auth requests
   - XSS: HTTP traffic with unusual packet patterns
   - SQL Injection: HTTP with potentially larger request sizes

4. BOTNET:
   - Periodic connections (regular IAT patterns)
   - Consistent packet sizes (beaconing)

5. INFILTRATION:
   - Lateral movement patterns
   - Internal-to-internal on unusual ports
   - Small, periodic data transfers (C2 heartbeats)

BENIGN INDICATORS:
- Standard web browsing: port 80/443, moderate packet sizes
- DNS queries: port 53, small packets, short duration
- Email: ports 25/465/587/993/995
- Normal file transfers with proportional byte counts

PROTOCOL NUMBERS: 6=TCP, 17=UDP, 1=ICMP
TCP FLAGS: Common values — 0=none/null, 2=SYN, 16=ACK, 18=SYN-ACK, 17=FIN-ACK, 24=PSH-ACK

Respond with ONLY a JSON object:
{
  "verdict": "BENIGN" | "MALICIOUS" | "SUSPICIOUS",
  "confidence": 0.0-1.0,
  "attack_type": "specific attack type if malicious, null if benign",
  "reasoning": "detailed analysis citing specific flow features",
  "key_findings": ["finding1", "finding2"]
}"""

MODEL_PRICING = {
    "gpt-4o": (2.50 / 1e6, 10.0 / 1e6),
    "gpt-4o-mini": (0.15 / 1e6, 0.60 / 1e6),
}


# ── Utility ─────────────────────────────────���────────────────────────────────

def log(msg):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def clean_value(v):
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return 0 if np.isnan(v) else float(v)
    if isinstance(v, float) and np.isnan(v):
        return 0
    return v


# ── Batch Creation ───────────────────────────────���───────────────────────────

def load_validation_data():
    """Load validation CSV once."""
    log("Loading validation.csv...")
    chunks = []
    for chunk in pd.read_csv(VALIDATION_CSV, chunksize=500_000, usecols=READ_COLS):
        chunks.append(chunk)
    df = pd.concat(chunks, ignore_index=True)
    log(f"  Loaded {len(df):,} flows")
    return df


def create_balanced_batch(attack_type, df, rng):
    """Create a 50-flow batch: 25 attack + 25 benign."""
    batch_dir = BATCHES_DIR / attack_type
    batch_dir.mkdir(parents=True, exist_ok=True)

    if (batch_dir / "flows.json").exists():
        log(f"  Batch {attack_type} exists, reusing.")
        return batch_dir

    attack_df = df[df["Attack"] == attack_type]
    benign_df = df[df["Attack"] == "Benign"]

    n_attack = min(N_ATTACK, len(attack_df))
    if n_attack < N_ATTACK:
        log(f"  WARNING: Only {len(attack_df)} {attack_type} flows, using all")

    sampled_attack = attack_df.sample(n=n_attack, random_state=rng)
    sampled_benign = benign_df.sample(n=N_BENIGN, random_state=rng)

    combined = pd.concat([sampled_attack, sampled_benign], ignore_index=True)
    combined = combined.sort_values(
        ["IPV4_SRC_ADDR", "FLOW_START_MILLISECONDS"]
    ).reset_index(drop=True)

    flows = []
    ground_truth = []
    for idx, (_, row) in enumerate(combined.iterrows()):
        flow = {"flow_id": idx}
        for col in EXTRACT_COLS:
            flow[col] = clean_value(row.get(col, 0))
        flows.append(flow)

        is_attack = row["Attack"] != "Benign"
        ground_truth.append({
            "flow_id": str(idx),
            "label": 1 if is_attack else 0,
            "label_name": "Attack" if is_attack else "Benign",
            "attack_type": row["Attack"],
        })

    with open(batch_dir / "flows.json", "w") as f:
        json.dump(flows, f)
    with open(batch_dir / "ground_truth.json", "w") as f:
        json.dump({"ground_truth": ground_truth}, f, indent=2)
    with open(batch_dir / "batch_metadata.json", "w") as f:
        json.dump({
            "batch_name": attack_type,
            "attack_type": attack_type,
            "n_attack": n_attack,
            "n_benign": N_BENIGN,
            "total_flows": len(flows),
            "seed": SEED,
            "source": "validation.csv",
            "class_balance": "50/50 (balanced)",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }, f, indent=2)

    log(f"  Created batch: {n_attack}a + {N_BENIGN}b = {len(flows)} flows")
    return batch_dir


def create_mixed_batch(df, rng):
    """Create a mixed-attack batch: ~2 per attack type + benign to fill 50."""
    batch_dir = BATCHES_DIR / "mixed_all"
    batch_dir.mkdir(parents=True, exist_ok=True)

    if (batch_dir / "flows.json").exists():
        log("  Mixed batch exists, reusing.")
        return batch_dir

    # 2 flows per attack type = 28 attack flows, 22 benign → 50 total
    n_per_type = 2
    n_benign_mixed = 50 - (n_per_type * len(ALL_ATTACK_TYPES))

    parts = []
    type_counts = {}
    for at in ALL_ATTACK_TYPES:
        at_df = df[df["Attack"] == at]
        n = min(n_per_type, len(at_df))
        if n > 0:
            parts.append(at_df.sample(n=n, random_state=rng))
            type_counts[at] = n
        else:
            log(f"  WARNING: No {at} flows in validation.csv")
            type_counts[at] = 0

    n_attack_actual = sum(type_counts.values())
    n_benign_actual = 50 - n_attack_actual

    benign_df = df[df["Attack"] == "Benign"]
    parts.append(benign_df.sample(n=n_benign_actual, random_state=rng))

    combined = pd.concat(parts, ignore_index=True)
    combined = combined.sort_values(
        ["IPV4_SRC_ADDR", "FLOW_START_MILLISECONDS"]
    ).reset_index(drop=True)

    flows = []
    ground_truth = []
    for idx, (_, row) in enumerate(combined.iterrows()):
        flow = {"flow_id": idx}
        for col in EXTRACT_COLS:
            flow[col] = clean_value(row.get(col, 0))
        flows.append(flow)

        is_attack = row["Attack"] != "Benign"
        ground_truth.append({
            "flow_id": str(idx),
            "label": 1 if is_attack else 0,
            "label_name": "Attack" if is_attack else "Benign",
            "attack_type": row["Attack"],
        })

    with open(batch_dir / "flows.json", "w") as f:
        json.dump(flows, f)
    with open(batch_dir / "ground_truth.json", "w") as f:
        json.dump({"ground_truth": ground_truth}, f, indent=2)
    with open(batch_dir / "batch_metadata.json", "w") as f:
        json.dump({
            "batch_name": "mixed_all",
            "attack_types": type_counts,
            "n_attack": n_attack_actual,
            "n_benign": n_benign_actual,
            "total_flows": len(flows),
            "seed": SEED,
            "source": "validation.csv",
            "class_balance": f"{n_attack_actual}a/{n_benign_actual}b mixed",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }, f, indent=2)

    log(f"  Created mixed batch: {n_attack_actual}a ({len(ALL_ATTACK_TYPES)} types) + {n_benign_actual}b = {len(flows)} flows")
    return batch_dir


# ── AMATAS Multi-Agent Pipeline ──────────────────────────────────────────────

def init_amatas_agents(api_key):
    return {
        "protocol": ProtocolAgent(MODEL, api_key, provider=PROVIDER),
        "statistical": StatisticalAgent(MODEL, api_key, provider=PROVIDER),
        "behavioural": BehaviouralAgent(MODEL, api_key, provider=PROVIDER),
        "temporal": TemporalAgent(MODEL, api_key, provider=PROVIDER),
        "da": DevilsAdvocateAgent(MODEL, api_key, provider=PROVIDER),
        "orchestrator": OrchestratorAgent(MODEL, api_key, da_weight=DA_WEIGHT, provider=PROVIDER),
    }


def run_amatas_flow(flow_idx, flow, flows, ip_groups, agents):
    """Run full 6-agent pipeline on one flow."""
    start_time = time.time()

    src_ip = flow.get("IPV4_SRC_ADDR", "unknown")
    co_ip_indices = ip_groups.get(src_ip, [])
    co_ip_flows = [flows[i] for i in co_ip_indices]

    # Phase 1: 4 specialists in parallel
    with ThreadPoolExecutor(max_workers=4) as executor:
        f_proto = executor.submit(agents["protocol"].analyze, flow)
        f_stat = executor.submit(agents["statistical"].analyze, flow)
        f_behav = executor.submit(agents["behavioural"].analyze, flow)
        f_temp = executor.submit(agents["temporal"].analyze, flow, ip_flows=co_ip_flows)

        specialist_results = {
            "protocol": f_proto.result(),
            "statistical": f_stat.result(),
            "behavioural": f_behav.result(),
            "temporal": f_temp.result(),
        }

    # Phase 2: Devil's Advocate
    da_result = agents["da"].analyze(flow, specialist_results=specialist_results)

    # Phase 3: Orchestrator
    orch_result = agents["orchestrator"].analyze(
        flow, specialist_results=specialist_results,
        devils_advocate_result=da_result,
    )

    elapsed = time.time() - start_time
    all_results = list(specialist_results.values()) + [da_result, orch_result]
    total_cost = sum(r.get("cost", 0) for r in all_results)

    agent_costs = {}
    for name, r in specialist_results.items():
        agent_costs[name] = r.get("cost", 0)
    agent_costs["devils_advocate"] = da_result.get("cost", 0)
    agent_costs["orchestrator"] = orch_result.get("cost", 0)

    return {
        "flow_idx": flow_idx,
        "verdict": orch_result.get("verdict", "ERROR"),
        "confidence": orch_result.get("confidence", 0.0),
        "attack_type_predicted": orch_result.get("attack_type"),
        "reasoning": orch_result.get("reasoning", ""),
        "specialist_results": {
            name: {
                "verdict": r.get("verdict"),
                "confidence": r.get("confidence"),
                "attack_type": r.get("attack_type"),
                "key_findings": r.get("key_findings", []),
                "reasoning": r.get("reasoning", ""),
            }
            for name, r in specialist_results.items()
        },
        "devils_advocate": {
            "confidence_benign": da_result.get("confidence_benign", 0.0),
            "strongest_benign_indicator": da_result.get("strongest_benign_indicator", ""),
            "counter_argument": da_result.get("counter_argument", da_result.get("reasoning", "")),
        },
        "cost_usd": total_cost,
        "agent_costs": agent_costs,
        "time_seconds": elapsed,
    }


# ── Vanilla Single-LLM Pipeline ─────────────────────────────��───────────────

def call_vanilla_llm(flow, api_key):
    """Single GPT-4o call per flow — the vanilla baseline."""
    import openai
    client = openai.OpenAI(api_key=api_key, timeout=120.0)

    flow_features = {k: v for k, v in flow.items() if k != "flow_id"}
    user_prompt = f"Analyze this NetFlow record:\n\n{json.dumps(flow_features, indent=2)}"

    t0 = time.time()
    try:
        response = client.chat.completions.create(
            model=MODEL,
            max_tokens=1024,
            messages=[
                {"role": "system", "content": VANILLA_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )

        in_tok = response.usage.prompt_tokens
        out_tok = response.usage.completion_tokens
        pricing = MODEL_PRICING[MODEL]
        cost = in_tok * pricing[0] + out_tok * pricing[1]
        text = response.choices[0].message.content or ""
        parsed = _parse_json(text)

    except Exception as e:
        log(f"    ERROR: {e}")
        parsed = {"verdict": "SUSPICIOUS", "confidence": 0.3, "reasoning": f"Error: {e}"}
        cost = 0.0
        in_tok = out_tok = 0

    elapsed = time.time() - t0

    return {
        "verdict": parsed.get("verdict", "SUSPICIOUS").upper(),
        "confidence": parsed.get("confidence", 0.5),
        "attack_type_predicted": parsed.get("attack_type"),
        "reasoning": parsed.get("reasoning", ""),
        "key_findings": parsed.get("key_findings", []),
        "cost_usd": cost,
        "tokens": {"input": in_tok, "output": out_tok},
        "time_seconds": elapsed,
    }


def _parse_json(text):
    """Extract JSON from LLM response."""
    import re
    m = re.search(r'```(?:json)?\s*\n(.*?)\n```', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    stripped = text.strip()
    if stripped.startswith('{'):
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            pass
    # Find largest JSON object
    depth = 0
    start = None
    best = None
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                candidate = text[start:i + 1]
                try:
                    parsed = json.loads(candidate)
                    if best is None or len(candidate) > len(best[1]):
                        best = (parsed, candidate)
                except json.JSONDecodeError:
                    pass
                start = None
    return best[0] if best else {"verdict": "SUSPICIOUS", "confidence": 0.3, "reasoning": "Failed to parse"}


# ── Experiment Runner ────────────────────────────────────────────────────────

def run_experiment(batch_name, batch_dir, mode, agents_or_key):
    """Run AMATAS or vanilla on a batch. Returns metrics dict."""
    with open(batch_dir / "flows.json") as f:
        flows = json.load(f)
    with open(batch_dir / "ground_truth.json") as f:
        gt_data = json.load(f)
    gt_entries = gt_data["ground_truth"]

    # Check for existing results
    result_file = RESULTS_DIR / f"{batch_name}_{mode}_results.json"
    if result_file.exists():
        log(f"  {mode} results exist for {batch_name}, skipping.")
        with open(result_file) as f:
            data = json.load(f)
        return data.get("metrics", {})

    ip_groups = defaultdict(list)
    for i, flow in enumerate(flows):
        ip_groups[flow.get("IPV4_SRC_ADDR", "unknown")].append(i)

    results = []
    total_cost = 0.0
    tp = fp = fn = tn = 0

    log(f"  Running {mode} on {batch_name} ({len(flows)} flows)...")

    for i, (flow, gt) in enumerate(zip(flows, gt_entries)):
        if total_cost >= COST_LIMIT_PER_BATCH:
            log(f"    BUDGET LIMIT at flow {i}. Stopping.")
            break

        if mode == "amatas":
            result = run_amatas_flow(i, flow, flows, ip_groups, agents_or_key)
        else:
            result = call_vanilla_llm(flow, agents_or_key)

        result["flow_idx"] = i
        result["label_actual"] = gt["label"]
        result["attack_type_actual"] = gt["attack_type"]

        results.append(result)
        total_cost += result["cost_usd"]

        pred_pos = result["verdict"] in ("MALICIOUS", "SUSPICIOUS")
        act_pos = gt["label"] == 1
        if pred_pos and act_pos: tp += 1
        elif pred_pos and not act_pos: fp += 1
        elif not pred_pos and act_pos: fn += 1
        else: tn += 1

        # Progress every 10 flows
        if (i + 1) % 10 == 0 or i == len(flows) - 1:
            status_char = "+" if (pred_pos and act_pos) else "." if (not pred_pos and not act_pos) else "!" if (not pred_pos and act_pos) else "X"
            log(f"    [{i+1}/{len(flows)}] {gt['attack_type'][:20]:<20} → {result['verdict']:<12} {status_char} ${total_cost:.3f}")

    # Metrics
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    fpr_val = fp / (fp + tn) if (fp + tn) > 0 else 0

    metrics = {
        "batch": batch_name,
        "mode": mode,
        "model": MODEL,
        "total_flows": len(results),
        "recall": round(recall * 100, 1),
        "precision": round(precision * 100, 1),
        "f1": round(f1 * 100, 1),
        "fpr": round(fpr_val * 100, 1),
        "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
        "total_cost": round(total_cost, 4),
        "cost_per_flow": round(total_cost / len(results), 4) if results else 0,
    }

    # Save
    with open(result_file, "w") as f:
        json.dump({"metrics": metrics, "results": results}, f, indent=2)

    log(f"    → Recall={metrics['recall']}% FPR={metrics['fpr']}% F1={metrics['f1']}% Cost=${metrics['total_cost']}")
    return metrics


# ── Summary ────────────────────────────────���─────────────────────────��───────

def build_summary():
    """Aggregate all balanced experiment results."""
    all_metrics = []
    for f in sorted(RESULTS_DIR.iterdir()):
        if f.name.endswith("_results.json"):
            with open(f) as fh:
                data = json.load(fh)
            if "metrics" in data:
                all_metrics.append(data["metrics"])

    # Group by mode
    amatas_metrics = [m for m in all_metrics if m["mode"] == "amatas"]
    vanilla_metrics = [m for m in all_metrics if m["mode"] == "vanilla"]

    def avg(lst, key):
        vals = [m[key] for m in lst if key in m]
        return round(sum(vals) / len(vals), 2) if vals else 0

    summary = {
        "description": "Balanced batch experiments (25a+25b) — AMATAS vs vanilla single-LLM",
        "model": MODEL,
        "batch_size": 50,
        "class_balance": "50/50",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "amatas_aggregate": {
            "n_experiments": len(amatas_metrics),
            "avg_recall": avg(amatas_metrics, "recall"),
            "avg_f1": avg(amatas_metrics, "f1"),
            "avg_fpr": avg(amatas_metrics, "fpr"),
            "total_cost": round(sum(m["total_cost"] for m in amatas_metrics), 2),
        },
        "vanilla_aggregate": {
            "n_experiments": len(vanilla_metrics),
            "avg_recall": avg(vanilla_metrics, "recall"),
            "avg_f1": avg(vanilla_metrics, "f1"),
            "avg_fpr": avg(vanilla_metrics, "fpr"),
            "total_cost": round(sum(m["total_cost"] for m in vanilla_metrics), 2),
        },
        "per_experiment": all_metrics,
    }

    with open(RESULTS_DIR / "balanced_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    # Print comparison table
    print(f"\n{'='*100}")
    print(f"{'Batch':<25} | {'AMATAS Recall':>13} | {'AMATAS F1':>9} | {'Vanilla Recall':>14} | {'Vanilla F1':>10} | {'Δ F1':>6}")
    print(f"{'-'*100}")

    for at in ALL_ATTACK_TYPES + ["mixed_all"]:
        am = next((m for m in amatas_metrics if m["batch"] == at), None)
        va = next((m for m in vanilla_metrics if m["batch"] == at), None)
        am_r = f"{am['recall']}%" if am else "—"
        am_f = f"{am['f1']}%" if am else "—"
        va_r = f"{va['recall']}%" if va else "—"
        va_f = f"{va['f1']}%" if va else "—"
        delta = f"{am['f1'] - va['f1']:+.1f}" if (am and va) else "—"
        print(f"{at:<25} | {am_r:>13} | {am_f:>9} | {va_r:>14} | {va_f:>10} | {delta:>6}")

    print(f"{'-'*100}")
    if amatas_metrics and vanilla_metrics:
        print(f"{'AVERAGE':<25} | {avg(amatas_metrics, 'recall'):>12}% | {avg(amatas_metrics, 'f1'):>8}% | {avg(vanilla_metrics, 'recall'):>13}% | {avg(vanilla_metrics, 'f1'):>9}% | {avg(amatas_metrics, 'f1') - avg(vanilla_metrics, 'f1'):>+5.1f}")
        print(f"{'TOTAL COST':<25} | ${sum(m['total_cost'] for m in amatas_metrics):>12.2f} | {'':>9} | ${sum(m['total_cost'] for m in vanilla_metrics):>13.2f}")
    print(f"{'='*100}")

    return summary


# ── Main ────────────────────────────────────────────────────────────��────────

def main():
    parser = argparse.ArgumentParser(description="Balanced batch experiments")
    parser.add_argument("--create-only", action="store_true", help="Only create batches")
    parser.add_argument("--only", type=str, help="Run only this attack type")
    parser.add_argument("--vanilla-only", action="store_true", help="Run vanilla experiments only")
    parser.add_argument("--amatas-only", action="store_true", help="Run AMATAS experiments only")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    BATCHES_DIR.mkdir(parents=True, exist_ok=True)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key and not args.create_only:
        log("ERROR: OPENAI_API_KEY not set")
        return 1

    # ── Step 1: Create all batches ────────────────���──────────────────────
    log(f"{'='*60}")
    log("BALANCED BATCH EXPERIMENTS")
    log(f"Model: {MODEL} | Batch size: {N_ATTACK + N_BENIGN} | Balance: 50/50")
    log(f"{'='*60}")

    df = load_validation_data()
    rng = np.random.RandomState(SEED)

    attack_types = [args.only] if args.only else ALL_ATTACK_TYPES

    log("\nStep 1: Creating batches...")
    batch_dirs = {}
    for at in attack_types:
        batch_dirs[at] = create_balanced_batch(at, df, rng)

    if not args.only:
        batch_dirs["mixed_all"] = create_mixed_batch(df, rng)

    if args.create_only:
        log("\nBatches created. Use --create-only=false to run experiments.")
        return 0

    # ── Step 2: Run experiments ──────────────────────────────────────────

    # Initialize AMATAS agents once (reused across all batches)
    amatas_agents = None
    if not args.vanilla_only:
        log("\nInitializing AMATAS agents...")
        amatas_agents = init_amatas_agents(api_key)

    all_batches = list(attack_types)
    if not args.only:
        all_batches.append("mixed_all")

    for batch_name in all_batches:
        batch_dir = batch_dirs[batch_name]
        if not batch_dir:
            continue

        log(f"\n{'─'*60}")
        log(f"Batch: {batch_name}")
        log(f"{'─'*60}")

        # Run AMATAS (multi-agent)
        if not args.vanilla_only and amatas_agents:
            run_experiment(batch_name, batch_dir, "amatas", amatas_agents)

        # Run Vanilla (single-LLM)
        if not args.amatas_only:
            run_experiment(batch_name, batch_dir, "vanilla", api_key)

        # Update summary after each batch
        build_summary()

    # ── Step 3: Final summary ───────────────────────────��────────────────
    log(f"\n{'='*60}")
    log("FINAL SUMMARY")
    log(f"{'='*60}")
    build_summary()

    log(f"\nResults saved to: {RESULTS_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
