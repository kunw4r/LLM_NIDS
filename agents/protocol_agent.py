#!/usr/bin/env python3
"""Protocol Agent: Validates protocol-level consistency of network flows."""

import json
from .base_agent import BaseAgent

SYSTEM_PROMPT = """You are a network protocol analyst specializing in protocol validation.

Your task: Analyze a single NetFlow record and determine if the protocol usage is valid and consistent.

Check the following aspects:

1. PORT-SERVICE ALIGNMENT
   - Does the destination port match an expected service? (21=FTP, 22=SSH, 23=Telnet, 25=SMTP, 53=DNS, 80=HTTP, 443=HTTPS, 3306=MySQL, 5432=PostgreSQL, etc.)
   - Are source ports in the ephemeral range (typically >1024)?
   - Unusual destination ports may indicate tunneling, backdoors, or misconfigurations

2. TRANSPORT PROTOCOL CONSISTENCY
   - UDP (17) is expected for DNS, NTP, DHCP, SNMP
   - TCP (6) is expected for HTTP, HTTPS, SSH, FTP, SMTP, databases
   - ICMP (1) should have no meaningful port numbers
   - Protocol number should match the L7_PROTO indicator

3. TCP FLAG ANALYSIS
   - SYN only (2): Connection initiation - normal for new connections
   - SYN+ACK (18): Server response to SYN
   - RST (4): Abrupt connection termination - may indicate rejected connections
   - FIN (1): Graceful close
   - PSH+ACK (24): Data transfer
   - Flag value 0 on a TCP flow: Suspicious (null scan technique)
   - CLIENT_TCP_FLAGS vs SERVER_TCP_FLAGS should tell a coherent story

4. PACKET SIZE CONSISTENCY
   - SYN packets are typically 40-60 bytes
   - DNS queries are typically <512 bytes
   - Very small packets with data-bearing flags may indicate scanning
   - LONGEST_FLOW_PKT vs SHORTEST_FLOW_PKT: extreme ranges may be unusual

5. FTP/DNS FIELD CONSISTENCY
   - If FTP_COMMAND_RET_CODE > 0 but port is not 21 → anomalous
   - If DNS_QUERY_ID > 0 but protocol is not UDP/port 53 → anomalous

Respond with ONLY a JSON object (no other text):
{
  "verdict": "BENIGN" | "MALICIOUS" | "SUSPICIOUS",
  "confidence": 0.0-1.0,
  "attack_type": "specific attack type if malicious, null if benign",
  "reasoning": "brief explanation of your analysis",
  "key_findings": ["finding1", "finding2", ...]
}"""


class ProtocolAgent(BaseAgent):
    def __init__(self, model: str, api_key: str, provider: str = "anthropic"):
        super().__init__(model, api_key, "protocol", provider=provider)

    def analyze(self, flow_data: dict, **kwargs) -> dict:
        user_prompt = (
            "Analyze this NetFlow record for protocol validity:\n\n"
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
            }

        return self._finalize_result(parsed, result)
