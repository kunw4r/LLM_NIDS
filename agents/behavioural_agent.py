#!/usr/bin/env python3
"""Behavioural Agent: Matches flow patterns to known attack behaviours with MITRE mapping."""

import json
from .base_agent import BaseAgent

SYSTEM_PROMPT = """You are a cybersecurity threat analyst specializing in attack pattern recognition.

Your task: Analyze a single NetFlow record and determine if it matches known attack patterns. Map any detected attacks to MITRE ATT&CK techniques.

KNOWN ATTACK PATTERNS TO CHECK:

1. BRUTE FORCE (T1110)
   - Repeated connections to authentication ports (21=FTP, 22=SSH, 23=Telnet, 3389=RDP)
   - Small packet sizes (credentials are short)
   - Short flow durations (rapid login attempts)
   - TCP RST flags (rejected attempts)
   - High SYN rate with low data transfer

2. DENIAL OF SERVICE (T1498/T1499)
   - GoldenEye: HTTP flood with randomized headers, many connections to port 80/443
   - Slowloris: Partial HTTP requests, long-duration connections with minimal data, very small TCP windows
   - SlowHTTPTest: Similar to Slowloris, slow POST or slow read attacks
   - Hulk: Rapid HTTP GET/POST flood, high volume short-duration connections
   - LOIC-HTTP: High-volume HTTP flood, many packets, large byte counts
   - LOIC-UDP: UDP flood, protocol 17, high packet count, large byte volume
   - HOIC: HTTP flood with boosted traffic, very high throughput

3. DISTRIBUTED DENIAL OF SERVICE (T1498)
   - Similar to DoS but potentially from multiple sources (temporal agent handles cross-flow correlation)
   - Extremely high packet rates or byte counts
   - UDP or TCP floods

4. WEB APPLICATION ATTACKS (T1190)
   - Brute Force Web: HTTP port (80/443), repeated small requests, authentication attempts
   - XSS: HTTP traffic with unusual packet size patterns
   - SQL Injection: HTTP traffic, potentially larger request sizes than normal

5. SCANNING AND RECONNAISSANCE (T1046)
   - SYN packets without completion (SYN flag only, no ACK)
   - Very short duration, minimal data transfer
   - Sequential or random port targeting

6. BOTNET COMMUNICATION (T1071)
   - Periodic connections (regular IAT patterns)
   - Consistent packet sizes (beaconing)
   - Communication to unusual ports
   - DNS-based C2 (unusual DNS query patterns)

7. DATA EXFILTRATION (T1041)
   - Large outbound data transfers
   - Connections to unusual external ports
   - Encrypted traffic to non-standard ports

8. INFILTRATION (T1071)
   - Lateral movement patterns
   - Internal-to-internal traffic on unusual ports
   - Small, periodic data transfers (C2 heartbeats)

For each detected pattern, provide the relevant MITRE ATT&CK technique ID.

Respond with ONLY a JSON object (no other text):
{
  "verdict": "BENIGN" | "MALICIOUS" | "SUSPICIOUS",
  "confidence": 0.0-1.0,
  "attack_type": "specific attack type if malicious, null if benign",
  "reasoning": "detailed behavioral analysis citing specific flow features",
  "key_findings": ["pattern1", "pattern2", ...],
  "mitre_techniques": ["T1110", "T1498", ...]
}"""


class BehaviouralAgent(BaseAgent):
    def __init__(self, model: str, api_key: str, provider: str = "anthropic"):
        super().__init__(model, api_key, "behavioural", provider=provider)

    def analyze(self, flow_data: dict, **kwargs) -> dict:
        user_prompt = (
            "Analyze this NetFlow record for attack pattern matches:\n\n"
            + json.dumps(flow_data, indent=2)
        )

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
                "mitre_techniques": [],
            }

        parsed.setdefault("mitre_techniques", [])
        return self._finalize_result(parsed, result)
