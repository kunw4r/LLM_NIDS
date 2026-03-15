#!/usr/bin/env python3
"""
SHAP vs AMATAS Comparison for Thesis

Runs SHAP on the Tier 1 Random Forest for 5 selected flows, then extracts
the corresponding AMATAS agent reasoning from results files. Outputs:
  1. A human-readable comparison table
  2. A JSON file with structured data for thesis inclusion
"""

import json
import joblib
import numpy as np
import shap
from pathlib import Path

ROOT = Path(__file__).parent.parent
MODEL_PATH = ROOT / "models" / "tier1_rf.pkl"
RESULTS_DIR = ROOT / "results" / "stage1"

FEATURES = [
    "L4_SRC_PORT", "L4_DST_PORT", "PROTOCOL",
    "FLOW_DURATION_MILLISECONDS", "SRC_TO_DST_IAT_MAX", "DST_TO_SRC_IAT_MAX",
    "IN_BYTES", "OUT_BYTES", "IN_PKTS", "OUT_PKTS", "TCP_FLAGS", "DNS_QUERY_ID",
]

# 5 selected flows: (results_file, flow_idx)
SELECTED_FLOWS = [
    ("FTP-BruteForce_results.json", 783, "FTP-BruteForce"),
    ("SSH-Bruteforce_results.json", 29, "SSH-Bruteforce"),
    ("DoS_attacks-Slowloris_results.json", 763, "DoS-Slowloris"),
    ("Bot_results.json", 709, "Bot"),
    ("DDOS_attack-HOIC_results.json", 756, "DDoS-HOIC"),
]


def load_flow_from_results(filename, flow_idx):
    """Load a specific flow from a results file."""
    with open(RESULTS_DIR / filename) as f:
        data = json.load(f)
    for r in data["results"]:
        if r["flow_idx"] == flow_idx:
            return r
    raise ValueError(f"Flow {flow_idx} not found in {filename}")


def get_shap_explanation(flow_features, model, explainer):
    """Get SHAP values for a single flow."""
    X = np.array([[float(flow_features.get(f, 0) or 0) for f in FEATURES]])
    shap_values = explainer.shap_values(X)

    # Handle different SHAP output formats
    if isinstance(shap_values, list):
        # List of [class0_array, class1_array]
        sv = shap_values[1][0]  # class 1, first sample
    elif shap_values.ndim == 3:
        # Shape (n_samples, n_features, n_classes)
        sv = shap_values[0, :, 1]  # first sample, all features, class 1
    else:
        sv = shap_values[0]

    # Build ranked feature importance
    ranked = sorted(zip(FEATURES, sv.tolist(), X[0].tolist()),
                    key=lambda x: abs(x[1]), reverse=True)
    return ranked


def summarise_amatas(flow_result):
    """Extract concise AMATAS reasoning summary."""
    summary = {}

    for agent_name, agent_data in flow_result.get("specialist_results", {}).items():
        if not isinstance(agent_data, dict):
            continue
        verdict = agent_data.get("verdict", "?")
        conf = agent_data.get("confidence", 0)
        reasoning = agent_data.get("reasoning", "")
        # Take first 2 sentences of reasoning
        sentences = reasoning.replace(". ", ".\n").split("\n")
        short = ". ".join(s.strip() for s in sentences[:2] if s.strip())
        if not short.endswith("."):
            short += "."
        summary[agent_name] = {
            "verdict": verdict,
            "confidence": conf,
            "reasoning_excerpt": short,
        }

    da = flow_result.get("devils_advocate", {})
    if isinstance(da, dict) and da.get("strongest_benign_indicator"):
        summary["devils_advocate"] = {
            "verdict": "BENIGN (counter-argument)",
            "confidence": da.get("confidence", da.get("confidence_benign", 0)),
            "reasoning_excerpt": da["strongest_benign_indicator"],
        }

    return summary


def main():
    # Load RF model
    bundle = joblib.load(MODEL_PATH)
    clf = bundle["model"]

    # Create SHAP explainer with a small background dataset
    # Use a simple sample rather than full training data
    print("Creating SHAP TreeExplainer...")
    explainer = shap.TreeExplainer(clf)

    comparisons = []

    for filename, flow_idx, attack_label in SELECTED_FLOWS:
        print(f"\nProcessing {attack_label} (flow {flow_idx})...")

        flow_result = load_flow_from_results(filename, flow_idx)
        flow_features = flow_result["flow_features"]

        # SHAP explanation
        ranked_shap = get_shap_explanation(flow_features, clf, explainer)

        # AMATAS explanation
        amatas_summary = summarise_amatas(flow_result)

        # RF prediction
        X = np.array([[float(flow_features.get(f, 0) or 0) for f in FEATURES]])
        rf_prob = clf.predict_proba(X)[0]

        comparison = {
            "attack_type": attack_label,
            "flow_idx": flow_idx,
            "actual_label": flow_result.get("attack_type_actual", ""),
            "amatas_verdict": flow_result.get("verdict", ""),
            "amatas_confidence": flow_result.get("confidence", 0),
            "rf_attack_prob": round(float(rf_prob[1]), 4),
            "rf_benign_prob": round(float(rf_prob[0]), 4),
            "shap_top5": [
                {"feature": f, "shap_value": round(float(sv), 4), "actual_value": float(v)}
                for f, sv, v in ranked_shap[:5]
            ],
            "amatas_agents": amatas_summary,
            "flow_features": {k: flow_features.get(k) for k in FEATURES},
        }
        comparisons.append(comparison)

    # ── Print human-readable output ───────────────────────────────────────
    print("\n" + "=" * 80)
    print("  SHAP vs AMATAS COMPARISON")
    print("=" * 80)

    for comp in comparisons:
        print(f"\n{'─' * 80}")
        print(f"  {comp['attack_type']} — Flow {comp['flow_idx']}")
        print(f"  Ground truth: {comp['actual_label']}")
        print(f"  RF: P(attack) = {comp['rf_attack_prob']:.3f}")
        print(f"  AMATAS: {comp['amatas_verdict']} (conf {comp['amatas_confidence']:.2f})")
        print(f"{'─' * 80}")

        print(f"\n  SHAP Explanation (top 5 features):")
        for s in comp["shap_top5"]:
            direction = "+" if s["shap_value"] > 0 else ""
            print(f"    {s['feature']:<35} {direction}{s['shap_value']:.4f}  (value: {s['actual_value']:.0f})")

        print(f"\n  AMATAS Explanation (6 agents):")
        for agent, data in comp["amatas_agents"].items():
            print(f"    {agent}: {data['verdict']} ({data['confidence']:.2f})")
            # Wrap reasoning to 70 chars
            reasoning = data["reasoning_excerpt"]
            words = reasoning.split()
            line = "      "
            for w in words:
                if len(line) + len(w) + 1 > 78:
                    print(line)
                    line = "      " + w
                else:
                    line += " " + w if line.strip() else w
            if line.strip():
                print(line)

    # ── Generate LaTeX table ──────────────────────────────────────────────
    print("\n\n" + "=" * 80)
    print("  LaTeX TABLE (copy into thesis)")
    print("=" * 80)

    for comp in comparisons:
        print(f"\n% {comp['attack_type']} — Flow {comp['flow_idx']}")
        shap_str = "; ".join(
            f"{s['feature']}: {'+'if s['shap_value']>0 else ''}{s['shap_value']:.3f}"
            for s in comp["shap_top5"][:3]
        )
        # Get the most informative agent excerpt
        agents = comp["amatas_agents"]
        # Pick the agent with highest confidence that said something interesting
        best_agent = None
        best_conf = 0
        for aname, adata in agents.items():
            if aname == "devils_advocate":
                continue
            if adata["confidence"] > best_conf and adata["verdict"] != "BENIGN":
                best_conf = adata["confidence"]
                best_agent = aname

        if best_agent:
            excerpt = agents[best_agent]["reasoning_excerpt"][:200]
        else:
            # All benign — use temporal or first available
            best_agent = list(agents.keys())[0]
            excerpt = agents[best_agent]["reasoning_excerpt"][:200]

        print(f"  SHAP: {shap_str}")
        print(f"  AMATAS ({best_agent}): {excerpt}")

    # ── Save JSON ─────────────────────────────────────────────────────────
    output_path = RESULTS_DIR / "shap_comparison.json"
    with open(output_path, "w") as f:
        json.dump(comparisons, f, indent=2, default=str)
    print(f"\n\nFull comparison saved to: {output_path}")


if __name__ == "__main__":
    main()
