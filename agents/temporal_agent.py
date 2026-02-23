#!/usr/bin/env python3
"""Temporal Agent: Analyzes patterns across flows from the same source IP."""

import json
from .base_agent import BaseAgent

SYSTEM_PROMPT = """You are a network temporal pattern analyst specializing in detecting attack sequences.

Your task: Analyze a TARGET network flow in the context of ALL flows from the same source IP. Detect temporal patterns that indicate coordinated or sustained attacks.

TEMPORAL PATTERNS TO DETECT:

1. BURST ACTIVITY
   - Many flows from the same source IP in a short time window
   - Rapid-fire connections to the same destination port (brute force)
   - Multiple connections to different ports on the same host (port scan)

2. SEQUENTIAL ESCALATION
   - Reconnaissance (scanning) followed by exploitation attempts
   - Initial probing followed by sustained connections
   - Gradual increase in traffic volume over time

3. REPETITIVE PATTERNS
   - Same source→destination→port combination repeated (automated tool)
   - Uniform flow durations and packet sizes across flows (scripted activity)
   - Regular timing intervals between flows (beaconing or scheduled tasks)

4. TARGET DIVERSITY
   - One source IP contacting many different destination IPs (scanning)
   - One source IP hitting many different ports on one destination (port sweep)
   - Fan-out patterns suggesting worm propagation or lateral movement

5. VOLUME CONTEXT
   - A single flow may look benign, but 50 similar flows from the same IP changes the picture
   - Compare the target flow's characteristics to the group's baseline

ANALYSIS APPROACH:
- First, summarize what you observe about the group of flows from this source IP
- Then, analyze the TARGET flow in that context
- Consider: Would this flow be suspicious on its own? Is it more or less suspicious given the group context?
- If there is only 1 flow from this source IP, note the limited temporal context

Respond with ONLY a JSON object (no other text):
{
  "verdict": "BENIGN" | "MALICIOUS" | "SUSPICIOUS",
  "confidence": 0.0-1.0,
  "attack_type": "specific attack type if malicious, null if benign",
  "reasoning": "temporal analysis explaining patterns observed across the IP's flows",
  "key_findings": ["pattern1", "pattern2", ...],
  "temporal_pattern": "burst | sequential | periodic | none",
  "ip_history_summary": "Brief narrative of what this IP has been doing across all its flows",
  "temporal_summary": {
    "total_flows_from_ip": 0,
    "unique_destinations": 0,
    "unique_ports": 0,
    "time_span_ms": 0,
    "pattern_type": "single_flow | burst | sustained | periodic | diverse_targets"
  }
}"""


def _summarize_flow(flow: dict) -> dict:
    """Create a compact summary of a flow for temporal context."""
    return {
        "flow_id": flow.get("flow_id"),
        "dst_ip": flow.get("IPV4_DST_ADDR"),
        "dst_port": flow.get("L4_DST_PORT"),
        "protocol": flow.get("PROTOCOL"),
        "in_bytes": flow.get("IN_BYTES"),
        "out_bytes": flow.get("OUT_BYTES"),
        "in_pkts": flow.get("IN_PKTS"),
        "out_pkts": flow.get("OUT_PKTS"),
        "duration_ms": flow.get("FLOW_DURATION_MILLISECONDS"),
        "tcp_flags": flow.get("TCP_FLAGS"),
        "start_ms": flow.get("FLOW_START_MILLISECONDS"),
    }


class TemporalAgent(BaseAgent):
    def __init__(self, model: str, api_key: str, provider: str = "anthropic"):
        super().__init__(model, api_key, "temporal", provider=provider)

    def analyze(self, flow_data: dict, ip_flows: list = None, **kwargs) -> dict:
        """Analyze a flow in the context of all flows from the same source IP.

        Args:
            flow_data: The target flow to classify.
            ip_flows: All flows from the same source IP (including the target).
        """
        if ip_flows is None:
            ip_flows = [flow_data]

        # Build compact summaries of co-IP flows (excluding the target)
        target_id = flow_data.get("flow_id")
        other_flows = [
            _summarize_flow(f) for f in ip_flows
            if f.get("flow_id") != target_id
        ]

        # Sort by timestamp (use 0 if start_ms is missing or None)
        other_flows.sort(key=lambda f: f.get("start_ms") or 0)

        user_prompt = (
            f"TARGET FLOW to classify:\n{json.dumps(flow_data, indent=2)}\n\n"
        )

        if other_flows:
            user_prompt += (
                f"OTHER FLOWS from the same source IP ({flow_data.get('IPV4_SRC_ADDR')}):\n"
                f"Total co-IP flows: {len(other_flows)}\n\n"
                f"{json.dumps(other_flows, indent=2)}\n\n"
            )
        else:
            user_prompt += (
                f"This is the ONLY flow from source IP {flow_data.get('IPV4_SRC_ADDR')} "
                f"in this batch. Limited temporal context available.\n\n"
            )

        user_prompt += "Analyze the TARGET flow in the context of the temporal pattern from this source IP."

        result = self.call_llm(SYSTEM_PROMPT, user_prompt)

        if "error" in result:
            return self._make_error_result(f"LLM error: {result['error']}")

        parsed = self.parse_json_response(result["text"])
        if parsed is None:
            parsed = {
                "verdict": "SUSPICIOUS",
                "confidence": 0.3,
                "attack_type": None,
                "reasoning": "Failed to parse agent response",
                "key_findings": [],
                "temporal_summary": {
                    "total_flows_from_ip": len(ip_flows),
                    "unique_destinations": 0,
                    "unique_ports": 0,
                    "time_span_ms": 0,
                    "pattern_type": "parse_error",
                },
            }

        parsed.setdefault("temporal_summary", {})
        parsed.setdefault("temporal_pattern", "none")
        parsed.setdefault("ip_history_summary", "")

        # Build connected_flows metadata from actual co-IP data
        target_start = flow_data.get("FLOW_START_MILLISECONDS") or 0
        connected = []
        for f in (ip_flows or []):
            if f.get("flow_id") == flow_data.get("flow_id"):
                continue
            f_start = f.get("FLOW_START_MILLISECONDS") or 0
            connected.append({
                "flow_id": f.get("flow_id"),
                "src_ip": f.get("IPV4_SRC_ADDR"),
                "time_delta_ms": f_start - target_start if target_start else 0,
                "dst_port": f.get("L4_DST_PORT"),
                "pattern_noted": "",
            })
        parsed["connected_flows"] = connected

        return self._finalize_result(parsed, result)
