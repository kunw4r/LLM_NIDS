"""
Lightweight Flask server for the AMATAS research dashboard.

Serves the built dashboard and provides API endpoints for:
- Reading live experiment status
- Reading completed experiment summaries
- Reading and writing pipeline control commands

Usage:
    python server.py              # Serves on port 5001
    python server.py --port 8080  # Custom port
"""

import json
import os
import argparse
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

ROOT = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(ROOT, "..", "..", "docs")
RESULTS_DIR = os.path.join(ROOT, "..", "..", "results", "stage1")

app = Flask(__name__, static_folder=DOCS_DIR, static_url_path="/")
CORS(app)


# ── Static dashboard ─────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(DOCS_DIR, "index.html")


# ── API: Live status ─────────────────────────────────────────────────────────

@app.route("/api/status")
def get_status():
    path = os.path.join(RESULTS_DIR, "live_status.json")
    if not os.path.exists(path):
        return "", 404
    with open(path) as f:
        return jsonify(json.load(f))


@app.route("/api/summary")
def get_summary():
    path = os.path.join(RESULTS_DIR, "running_summary.json")
    if not os.path.exists(path):
        return "", 404
    with open(path) as f:
        return jsonify(json.load(f))


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
