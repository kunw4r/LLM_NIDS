"""
Lightweight Flask server for the AMATAS research dashboard.

Serves the built dashboard and provides API endpoints for:
- Reading live experiment status (transformed to dashboard format)
- Reading completed experiment summaries
- Reading and writing pipeline control commands
- Scanning all historical result files

Usage:
    python server.py              # Serves on port 5001
    python server.py --port 8080  # Custom port
"""

import json
import os
import time
import argparse
import glob as glob_module
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

ROOT = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(ROOT, "..", "..", "docs")
RESULTS_DIR = os.path.join(ROOT, "..", "..", "results", "stage1")
RESULTS_ROOT = os.path.join(ROOT, "..", "..", "results")

app = Flask(__name__, static_folder=DOCS_DIR, static_url_path="/")
CORS(app)


# ── Transform pipeline data ──────────────────────────────────────────────────

AGENT_MAP = {
    "protocol": "Protocol",
    "statistical": "Statistical",
    "behavioural": "Behavioral",
    "behavioral": "Behavioral",
    "temporal": "Temporal",
    "devils_advocate": "Devil's Advocate",
    "orchestrator": "Orchestrator",
}


def transform_live_status(raw):
    """Transform pipeline's flat live_status.json to dashboard format."""
    if not raw:
        return None

    # Transform agent verdicts from flat strings to objects
    agents = {}
    last = raw.get("last_flow") or {}
    if last.get("agents"):
        for key, val in last["agents"].items():
            name = AGENT_MAP.get(key, key)
            if isinstance(val, str):
                agents[name] = {"verdict": val, "confidence": None}
            else:
                agents[name] = val
    # Set orchestrator confidence from flow-level confidence
    if "Orchestrator" in agents and last.get("confidence"):
        agents["Orchestrator"]["confidence"] = last["confidence"]

    completed = raw.get("experiments_completed", [])
    queued = raw.get("experiments_queued", [])

    # Build queue list
    queue = [{"name": n, "status": "complete"} for n in completed]
    queue.append({
        "name": raw.get("current_experiment", "unknown"),
        "status": "running",
        "progress": round(raw.get("pct_complete", 0)),
    })
    queue.extend({"name": n, "status": "queued"} for n in queued)

    benign_total = (raw.get("false_positives_so_far", 0)
                    + raw.get("benign_correct_so_far", 0))

    return {
        "experiment": {
            "name": raw.get("current_experiment"),
            "stage": raw.get("stage", "Stage 1"),
            "number": len(completed) + 1,
            "total": len(completed) + 1 + len(queued),
        },
        "progress": {
            "flows_done": raw.get("flows_done"),
            "flows_total": raw.get("flows_total"),
            "cost": raw.get("cost_so_far"),
            "eta": (f"${raw['estimated_total_cost']:.2f} est. total"
                    if raw.get("estimated_total_cost") else None),
        },
        "last_flow": {
            "number": last.get("flow_number"),
            "actual": last.get("actual_label"),
            "verdict": last.get("verdict"),
            "correct": last.get("correct"),
            "agents": agents,
        } if last else None,
        "metrics": {
            "attacks_detected": raw.get("attacks_detected", 0),
            "attacks_seen": raw.get("attacks_seen", 0),
            "false_positives": raw.get("false_positives_so_far", 0),
            "benign_seen": benign_total,
        },
        "recent": [
            {
                "flow": (raw.get("flows_done", 0)) - i,
                "actual": v.get("actual"),
                "verdict": v.get("verdict"),
                "correct": v.get("correct"),
            }
            for i, v in enumerate(raw.get("recent_verdicts", []))
        ],
        "queue": queue,
    }


# ── Experiment scanner ────────────────────────────────────────────────────────

_experiments_cache = None
_cache_time = 0


def scan_all_experiments():
    """Scan results/ for all experiment files and extract metrics."""
    global _experiments_cache, _cache_time

    now = time.time()
    if _experiments_cache is not None and now - _cache_time < 120:
        return _experiments_cache

    experiments = []
    for fpath in sorted(glob_module.glob(
            os.path.join(RESULTS_ROOT, "**/*.json"), recursive=True)):
        # Skip stage1 operational files and aggregates
        rel = os.path.relpath(fpath, RESULTS_ROOT)
        if rel.startswith("stage1"):
            continue

        try:
            with open(fpath) as f:
                data = json.load(f)

            # Files have evaluation_metadata at top level
            if "evaluation_metadata" not in data:
                continue

            meta = data["evaluation_metadata"]
            # Metrics can be at top level OR nested in evaluation_metadata
            metrics = (data.get("metrics")
                       or meta.get("metrics")
                       or {})
            if not metrics.get("f1"):
                continue

            experiments.append({
                "file": rel,
                "model": meta.get("model"),
                "architecture": meta.get("architecture"),
                "da_weight": meta.get("da_weight"),
                "flows": (meta.get("evaluated_flows")
                          or meta.get("total_flows")),
                "cost": meta.get("total_cost_usd"),
                "time_seconds": meta.get("total_time_seconds"),
                "started_at": meta.get("started_at"),
                "completed_at": meta.get("completed_at"),
                "accuracy": metrics.get("accuracy"),
                "precision": metrics.get("precision"),
                "recall": metrics.get("recall"),
                "f1": metrics.get("f1"),
                "confusion": metrics.get("confusion"),
                "per_attack_type": metrics.get("per_attack_type"),
            })
        except (json.JSONDecodeError, IOError, KeyError):
            continue

    _experiments_cache = experiments
    _cache_time = now
    return experiments


# ── Static dashboard ─────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(DOCS_DIR, "index.html")


# ── API: Live status (transformed) ───────────────────────────────────────────

@app.route("/api/status")
def get_status():
    path = os.path.join(RESULTS_DIR, "live_status.json")
    if not os.path.exists(path):
        return "", 404
    with open(path) as f:
        raw = json.load(f)
    return jsonify(transform_live_status(raw))


@app.route("/api/summary")
def get_summary():
    path = os.path.join(RESULTS_DIR, "running_summary.json")
    if not os.path.exists(path):
        return "", 404
    with open(path) as f:
        return jsonify(json.load(f))


# ── API: All historical experiments ──────────────────────────────────────────

@app.route("/api/all-experiments")
def get_all_experiments():
    return jsonify(scan_all_experiments())


# ── API: Pipeline control ────────────────────────────────────────────────────

@app.route("/api/control", methods=["GET"])
def get_control():
    path = os.path.join(RESULTS_DIR, "control.json")
    if not os.path.exists(path):
        return jsonify({"command": "run"})
    with open(path) as f:
        return jsonify(json.load(f))


@app.route("/api/control", methods=["POST"])
def set_control():
    data = request.get_json()
    if not data or "command" not in data:
        return jsonify({"error": "missing command"}), 400
    if data["command"] not in ("pause", "run", "stop"):
        return jsonify({"error": "invalid command"}), 400

    os.makedirs(RESULTS_DIR, exist_ok=True)
    path = os.path.join(RESULTS_DIR, "control.json")
    with open(path, "w") as f:
        json.dump({"command": data["command"]}, f, indent=2)

    return jsonify({"ok": True, "command": data["command"]})


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AMATAS Dashboard Server")
    parser.add_argument("--port", type=int, default=5001)
    args = parser.parse_args()

    print(f"Dashboard: http://localhost:{args.port}")
    print(f"Serving from: {DOCS_DIR}")
    print(f"Results dir: {RESULTS_DIR}")
    app.run(host="0.0.0.0", port=args.port, debug=True)
