#!/usr/bin/env python3
"""Devil's Advocate Agent: Argues for benign interpretation of specialist findings."""

import json
from .base_agent import BaseAgent

SYSTEM_PROMPT = """You are a devil's advocate analyst in a network intrusion detection system.

Your role: Given the analyses from 4 specialist agents, argue for the BENIGN interpretation of the network flow. Your job is to challenge the malicious assessments and find plausible innocent explanations.

You MUST argue for BENIGN even if you personally think the flow is malicious. This is a deliberate adversarial check to prevent false positives.

STRATEGIES FOR ARGUING BENIGN:

1. LEGITIMATE TRAFFIC PATTERNS
   - High-volume web traffic is normal for content delivery, streaming, backups
   - Many short connections are normal for REST APIs, health checks, monitoring
   - Connections to authentication ports happen constantly in enterprise networks
   - Failed connections happen due to timeouts, misconfigurations, network issues

2. PROTOCOL EXPLANATIONS
   - Unusual flag combinations can result from middleboxes, NAT, or load balancers
   - Zero-length flows happen with connection resets, timeouts, or probes
   - Asymmetric traffic is normal for streaming, downloads, or DNS
   - Small packets are normal for ACKs, keepalives, or lightweight protocols

3. TIMING AND VOLUME
   - Regular intervals are normal for monitoring, NTP, heartbeats, scheduled tasks
   - Bursts of traffic happen with batch processing, cron jobs, deployments
   - Multiple connections from one IP are normal for multi-threaded applications
   - Short-lived connections are normal for modern microservice architectures

4. COMMON FALSE POSITIVE CAUSES
   - Internal scanning by vulnerability assessment tools is legitimate
   - Load balancer health checks generate many short connections
   - Database connection pools create burst patterns
   - CDN or proxy traffic can look like floods

For each specialist finding that says MALICIOUS or SUSPICIOUS, provide a specific, plausible alternative explanation.

Respond with ONLY a JSON object (no other text):
{
  "benign_argument": "comprehensive argument for why this flow is benign",
  "confidence_benign": 0.0-1.0,
  "alternative_explanations": [
    "explanation for finding 1",
    "explanation for finding 2"
  ],
  "weaknesses_in_malicious_case": [
    "weakness 1 in the malicious argument",
    "weakness 2"
  ],
  "strongest_benign_indicator": "the single strongest reason to classify as benign"
}"""


class DevilsAdvocateAgent(BaseAgent):
    def __init__(self, model: str, api_key: str, provider: str = "anthropic"):
        super().__init__(model, api_key, "devils_advocate", provider=provider)

    def analyze(self, flow_data: dict, specialist_results: dict = None, **kwargs) -> dict:
        """Argue for benign interpretation given specialist analyses.

        Args:
            flow_data: The original flow data.
            specialist_results: Dict of {agent_name: result_dict} from the 4 specialists.
        """
        if specialist_results is None:
            specialist_results = {}

        # Build summary of specialist findings
        specialist_summary = {}
        for agent_name, result in specialist_results.items():
            specialist_summary[agent_name] = {
                "verdict": result.get("verdict", "UNKNOWN"),
                "confidence": result.get("confidence", 0.0),
                "attack_type": result.get("attack_type"),
                "reasoning": result.get("reasoning", ""),
                "key_findings": result.get("key_findings", []),
            }

        user_prompt = (
            f"FLOW DATA:\n{json.dumps(flow_data, indent=2)}\n\n"
            f"SPECIALIST AGENT ANALYSES:\n{json.dumps(specialist_summary, indent=2)}\n\n"
            f"Argue for the BENIGN interpretation. Challenge each specialist's malicious findings."
        )

        result = self.call_llm(SYSTEM_PROMPT, user_prompt)

        if "error" in result:
            return {
                "benign_argument": f"Error: {result['error']}",
                "confidence_benign": 0.0,
                "alternative_explanations": [],
                "weaknesses_in_malicious_case": [],
                "strongest_benign_indicator": "N/A",
                "tokens": {"input": 0, "output": 0},
                "cost": 0.0,
            }

        parsed = self.parse_json_response(result["text"])
        if parsed is None:
            parsed = {
                "benign_argument": "Failed to parse agent response",
                "confidence_benign": 0.3,
                "alternative_explanations": [],
                "weaknesses_in_malicious_case": [],
                "strongest_benign_indicator": "N/A",
            }

        parsed.setdefault("benign_argument", "")
        parsed.setdefault("confidence_benign", 0.3)
        parsed.setdefault("alternative_explanations", [])
        parsed.setdefault("weaknesses_in_malicious_case", [])
        parsed.setdefault("strongest_benign_indicator", "N/A")
        parsed["tokens"] = {
            "input": result["input_tokens"],
            "output": result["output_tokens"],
        }
        parsed["cost"] = result["cost"]
        return parsed
