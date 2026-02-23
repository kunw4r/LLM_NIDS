#!/usr/bin/env python3
"""Orchestrator Agent: Weighted consensus from specialist + devil's advocate analyses."""

import json
from .base_agent import BaseAgent

SYSTEM_PROMPT = """You are the lead orchestrator of a multi-agent Network Intrusion Detection System.

You receive analyses from 5 agents:
- Protocol Agent: Checks protocol validity and port/flag consistency
- Statistical Agent: Detects statistical anomalies in traffic features
- Behavioural Agent: Matches flow patterns to known attack signatures
- Temporal Agent: Analyzes cross-flow patterns from the same source IP
- Devil's Advocate: Argues for the benign interpretation

YOUR TASK: Synthesize all analyses into a single final verdict.

WEIGHTING AND DECISION RULES:

1. SPECIALIST CONSENSUS (4 agents: protocol, statistical, behavioural, temporal)
   - Each specialist contributes equally to the base assessment
   - Count how many specialists say MALICIOUS, SUSPICIOUS, or BENIGN

2. DEVIL'S ADVOCATE COUNTERWEIGHT (30% influence)
   - The devil's advocate argument carries 30% weight as a counterbalance
   - Its purpose is to reduce false positives
   - Strong DA arguments should lower confidence or change verdict
   - Weak DA arguments should not override strong specialist consensus

3. CONSENSUS THRESHOLDS
   - 4/4 specialists MALICIOUS + weak DA → MALICIOUS (high confidence)
   - 3/4 specialists MALICIOUS + moderate DA → MALICIOUS (moderate confidence)
   - 3/4 specialists MALICIOUS + strong DA → SUSPICIOUS
   - 2/4 specialists MALICIOUS + any DA → carefully weigh evidence, likely SUSPICIOUS
   - 1/4 specialists MALICIOUS → likely BENIGN unless that specialist has very strong evidence
   - 0/4 specialists MALICIOUS → BENIGN

4. CONFIDENCE CALIBRATION
   - Average the specialist confidence scores as a baseline
   - Increase if specialists agree and DA arguments are weak
   - Decrease if specialists disagree or DA raises valid concerns
   - SUSPICIOUS verdict should have confidence 0.3-0.6
   - High confidence (>0.8) only with strong specialist agreement

5. ATTACK TYPE SELECTION
   - Use the most specific attack type from the specialist with highest confidence
   - If specialists disagree on type, use the one with strongest evidence
   - Include MITRE ATT&CK technique IDs from the behavioural agent

IMPORTANT: Your analysis must cite specific evidence from each agent. Do not just summarize — synthesize and reason about the combined picture.

Respond with ONLY a JSON object (no other text):
{
  "verdict": "BENIGN" | "MALICIOUS" | "SUSPICIOUS",
  "confidence": 0.0-1.0,
  "attack_type": "specific attack type if malicious, null if benign",
  "attack_category": "Brute Force | DoS | DDoS | Web Attack | Infiltration | Botnet | null",
  "reasoning": "comprehensive synthesis citing each agent's findings and explaining the decision",
  "consensus_score": 0.0-1.0,
  "agents_agreed": ["names of agents that align with final verdict"],
  "agents_disagreed": ["names of agents that disagree with final verdict"],
  "mitre_techniques": ["T1110", "T1498", ...]
}"""


def _build_system_prompt(da_weight_pct: int) -> str:
    """Build orchestrator system prompt with configurable DA weight."""
    if da_weight_pct >= 50:
        consensus_rules = """3. CONSENSUS THRESHOLDS
   - 4/4 specialists MALICIOUS + weak DA → MALICIOUS (moderate confidence)
   - 4/4 specialists MALICIOUS + strong DA → SUSPICIOUS (the DA carries significant weight)
   - 3/4 specialists MALICIOUS + moderate DA → SUSPICIOUS
   - 3/4 specialists MALICIOUS + strong DA → BENIGN (DA tips the balance)
   - 2/4 specialists MALICIOUS + any DA → likely BENIGN
   - 1/4 specialists MALICIOUS → BENIGN
   - 0/4 specialists MALICIOUS → BENIGN"""
    else:
        consensus_rules = """3. CONSENSUS THRESHOLDS
   - 4/4 specialists MALICIOUS + weak DA → MALICIOUS (high confidence)
   - 3/4 specialists MALICIOUS + moderate DA → MALICIOUS (moderate confidence)
   - 3/4 specialists MALICIOUS + strong DA → SUSPICIOUS
   - 2/4 specialists MALICIOUS + any DA → carefully weigh evidence, likely SUSPICIOUS
   - 1/4 specialists MALICIOUS → likely BENIGN unless that specialist has very strong evidence
   - 0/4 specialists MALICIOUS → BENIGN"""

    return SYSTEM_PROMPT_TEMPLATE.replace("{DA_WEIGHT}", str(da_weight_pct)).replace(
        "{CONSENSUS_RULES}", consensus_rules
    )


SYSTEM_PROMPT_TEMPLATE = """You are the lead orchestrator of a multi-agent Network Intrusion Detection System.

You receive analyses from 5 agents:
- Protocol Agent: Checks protocol validity and port/flag consistency
- Statistical Agent: Detects statistical anomalies in traffic features
- Behavioural Agent: Matches flow patterns to known attack signatures
- Temporal Agent: Analyzes cross-flow patterns from the same source IP
- Devil's Advocate: Argues for the benign interpretation

YOUR TASK: Synthesize all analyses into a single final verdict.

WEIGHTING AND DECISION RULES:

1. SPECIALIST CONSENSUS (4 agents: protocol, statistical, behavioural, temporal)
   - Each specialist contributes equally to the base assessment
   - Count how many specialists say MALICIOUS, SUSPICIOUS, or BENIGN

2. DEVIL'S ADVOCATE COUNTERWEIGHT ({DA_WEIGHT}% influence)
   - The devil's advocate argument carries {DA_WEIGHT}% weight as a counterbalance
   - Its purpose is to reduce false positives
   - Strong DA arguments should lower confidence or change verdict
   - Weak DA arguments should not override strong specialist consensus

{CONSENSUS_RULES}

4. CONFIDENCE CALIBRATION
   - Average the specialist confidence scores as a baseline
   - Increase if specialists agree and DA arguments are weak
   - Decrease if specialists disagree or DA raises valid concerns
   - SUSPICIOUS verdict should have confidence 0.3-0.6
   - High confidence (>0.8) only with strong specialist agreement

5. ATTACK TYPE SELECTION
   - Use the most specific attack type from the specialist with highest confidence
   - If specialists disagree on type, use the one with strongest evidence
   - Include MITRE ATT&CK technique IDs from the behavioural agent

IMPORTANT: Your analysis must cite specific evidence from each agent. Do not just summarize — synthesize and reason about the combined picture.

Respond with ONLY a JSON object (no other text):
{
  "verdict": "BENIGN" | "MALICIOUS" | "SUSPICIOUS",
  "confidence": 0.0-1.0,
  "attack_type": "specific attack type if malicious, null if benign",
  "attack_category": "Brute Force | DoS | DDoS | Web Attack | Infiltration | Botnet | null",
  "reasoning": "comprehensive synthesis citing each agent's findings and explaining the decision",
  "consensus_score": 0.0-1.0,
  "agents_agreed": ["names of agents that align with final verdict"],
  "agents_disagreed": ["names of agents that disagree with final verdict"],
  "mitre_techniques": ["T1110", "T1498", ...]
}"""

# Default system prompt (30% DA weight) for backward compatibility
SYSTEM_PROMPT = _build_system_prompt(30)


class OrchestratorAgent(BaseAgent):
    def __init__(self, model: str, api_key: str, da_weight: int = 30, provider: str = "anthropic"):
        super().__init__(model, api_key, "orchestrator", provider=provider)
        self.da_weight = da_weight
        self.system_prompt = _build_system_prompt(da_weight)

    def analyze(self, flow_data: dict, specialist_results: dict = None,
                devils_advocate_result: dict = None, **kwargs) -> dict:
        """Make final consensus verdict from all agent analyses.

        Args:
            flow_data: The original flow data.
            specialist_results: Dict of {agent_name: result_dict} from the 4 specialists.
            devils_advocate_result: The devil's advocate analysis.
        """
        if specialist_results is None:
            specialist_results = {}
        if devils_advocate_result is None:
            devils_advocate_result = {}

        # Build specialist summary
        specialist_summary = {}
        for agent_name, result in specialist_results.items():
            specialist_summary[agent_name] = {
                "verdict": result.get("verdict", "UNKNOWN"),
                "confidence": result.get("confidence", 0.0),
                "attack_type": result.get("attack_type"),
                "reasoning": result.get("reasoning", ""),
                "key_findings": result.get("key_findings", []),
            }
            if "mitre_techniques" in result:
                specialist_summary[agent_name]["mitre_techniques"] = result["mitre_techniques"]
            if "temporal_summary" in result:
                specialist_summary[agent_name]["temporal_summary"] = result["temporal_summary"]

        # Build DA summary
        da_summary = {
            "benign_argument": devils_advocate_result.get("benign_argument", ""),
            "confidence_benign": devils_advocate_result.get("confidence_benign", 0.0),
            "alternative_explanations": devils_advocate_result.get("alternative_explanations", []),
            "weaknesses_in_malicious_case": devils_advocate_result.get("weaknesses_in_malicious_case", []),
            "strongest_benign_indicator": devils_advocate_result.get("strongest_benign_indicator", "N/A"),
        }

        user_prompt = (
            f"FLOW DATA:\n{json.dumps(flow_data, indent=2)}\n\n"
            f"SPECIALIST ANALYSES (4 agents):\n{json.dumps(specialist_summary, indent=2)}\n\n"
            f"DEVIL'S ADVOCATE ({self.da_weight}% weight):\n{json.dumps(da_summary, indent=2)}\n\n"
            f"Synthesize all analyses into a final verdict. "
            f"Remember: Devil's Advocate carries {self.da_weight}% weight as counterbalance."
        )

        result = self.call_llm(self.system_prompt, user_prompt)

        if "error" in result:
            return self._make_error_result(f"LLM error: {result['error']}")

        parsed = self.parse_json_response(result["text"])
        if parsed is None:
            parsed = {
                "verdict": "SUSPICIOUS",
                "confidence": 0.3,
                "attack_type": None,
                "reasoning": "Failed to parse orchestrator response",
                "consensus_score": 0.0,
                "dissenting_opinions": [],
                "mitre_techniques": [],
            }

        parsed.setdefault("consensus_score", 0.0)
        parsed.setdefault("agents_agreed", [])
        parsed.setdefault("agents_disagreed", [])
        parsed.setdefault("mitre_techniques", [])
        parsed.setdefault("attack_category", None)
        # Keep dissenting_opinions for backward compat if LLM returns it
        parsed.setdefault("dissenting_opinions", [])
        return self._finalize_result(parsed, result)
