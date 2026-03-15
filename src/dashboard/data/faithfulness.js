// Faithfulness audit data — re-exported from faithfulness_audit.json

export const FAITHFULNESS_DATA = {
  summary: {
    files_audited: 14,
    flows_audited: 758,
    total_claims: 6279,
    correct_claims: 5637,
    incorrect_claims: 642,
    faithfulness_rate_pct: 89.78,
    confabulation_rate_pct: 10.22,
  },
  per_agent: [
    { agent: "Statistical", total: 776, correct: 729, incorrect: 47, rate: 93.9, color: "#8b5cf6" },
    { agent: "Temporal", total: 365, correct: 332, incorrect: 33, rate: 91.0, color: "#ec4899" },
    { agent: "Orchestrator", total: 1225, correct: 1113, incorrect: 112, rate: 90.9, color: "#10b981" },
    { agent: "Protocol", total: 2869, correct: 2593, incorrect: 276, rate: 90.4, color: "#3b82f6" },
    { agent: "Behavioural", total: 867, correct: 728, incorrect: 139, rate: 84.0, color: "#f59e0b" },
    { agent: "Devil's Advocate", total: 177, correct: 142, incorrect: 35, rate: 80.2, color: "#ef4444" },
  ],
  per_claim_type: [
    { type: "Port references", total: 1821, correct: 1787, incorrect: 34, rate: 98.1 },
    { type: "Numeric (exact)", total: 508, correct: 502, incorrect: 6, rate: 98.8 },
    { type: "Numeric (natural language)", total: 369, correct: 363, incorrect: 6, rate: 98.4 },
    { type: "TCP flags (numeric)", total: 93, correct: 93, incorrect: 0, rate: 100.0 },
    { type: "Ephemeral port", total: 41, correct: 41, incorrect: 0, rate: 100.0 },
    { type: "Protocol (numeric)", total: 89, correct: 89, incorrect: 0, rate: 100.0 },
    { type: "IP addresses", total: 314, correct: 301, incorrect: 13, rate: 95.9 },
    { type: "Service-port mapping", total: 609, correct: 543, incorrect: 66, rate: 89.2 },
    { type: "Protocol naming", total: 940, correct: 758, incorrect: 182, rate: 80.6 },
    { type: "TCP flag names", total: 1494, correct: 1159, incorrect: 335, rate: 77.6 },
  ],
  confabulation_examples: [
    { type: "TCP flag names", detail: "Claimed PSH+RST for flags=22, but PSH is NOT set", agent: "Orchestrator", attack: "Bot" },
    { type: "Protocol naming", detail: "Claimed TCP (protocol=6) when actual protocol=17 (UDP)", agent: "Protocol", attack: "Bot" },
    { type: "Service-port mapping", detail: "Claimed DNS for port 123 (expected port 53 for DNS)", agent: "Temporal", attack: "Bot" },
    { type: "Port reference", detail: "Claimed port=53 when actual ports were src=123 dst=123", agent: "Temporal", attack: "Bot" },
  ],
};
