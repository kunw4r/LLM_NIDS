"""
Tier 1 pre-filter for AMATAS pipeline.

Loads the trained Random Forest model and filters flows into two groups:
- send_to_llm: flows that need LLM analysis (predicted attack or uncertain)
- skip_list: flows confidently classified as benign (skip LLM, save cost)

Usage:
    from scripts.tier1_filter import filter_flows

    send_to_llm, skip_list = filter_flows(flows)
    # send_to_llm: list of flow dicts to analyze with LLM
    # skip_list: list of (flow_dict, confidence) tuples safely skipped
"""

import os
import joblib
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(ROOT, "models", "tier1_rf.pkl")

FEATURES = [
    "L4_SRC_PORT",
    "L4_DST_PORT",
    "PROTOCOL",
    "FLOW_DURATION_MILLISECONDS",
    "SRC_TO_DST_IAT_MAX",
    "DST_TO_SRC_IAT_MAX",
    "IN_BYTES",
    "OUT_BYTES",
    "IN_PKTS",
    "OUT_PKTS",
    "TCP_FLAGS",
    "DNS_QUERY_ID",
]

_model_cache = None


def _load_model():
    global _model_cache
    if _model_cache is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(
                f"Tier 1 model not found at {MODEL_PATH}. "
                "Run: python scripts/train_tier1.py"
            )
        _model_cache = joblib.load(MODEL_PATH)
    return _model_cache


def filter_flows(flows, confidence_threshold=None):
    """
    Filter flows using the Tier 1 Random Forest classifier.

    Args:
        flows: list of flow dicts (must contain the 12 numeric features)
        confidence_threshold: minimum attack probability to send to LLM.
                              If None, uses the threshold saved during training.

    Returns:
        (send_to_llm, skip_list) where:
          send_to_llm: list of flow dicts that need LLM analysis
          skip_list: list of (flow_dict, benign_confidence) tuples to skip
    """
    if not flows:
        return [], []

    bundle = _load_model()
    clf = bundle["model"]
    if confidence_threshold is None:
        confidence_threshold = bundle.get("threshold", 0.15)

    # Build feature matrix
    X = np.array([
        [float(flow.get(feat, 0) or 0) for feat in FEATURES]
        for flow in flows
    ])

    # Get attack probabilities
    probs = clf.predict_proba(X)[:, 1]  # P(attack)

    send_to_llm = []
    skip_list = []

    for flow, attack_prob in zip(flows, probs):
        if attack_prob >= confidence_threshold:
            send_to_llm.append(flow)
        else:
            benign_conf = 1.0 - attack_prob
            skip_list.append((flow, round(benign_conf, 4)))

    return send_to_llm, skip_list
