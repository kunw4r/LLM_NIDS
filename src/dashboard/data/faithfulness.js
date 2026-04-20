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

// Head-to-head audit on balanced 50-flow batches: AMATAS vs single-agent vanilla GPT-4o.
// Same model, same flows, same seed — only the architecture differs.
// Source: results/analysis/faithfulness_balanced.json
export const FAITHFULNESS_HEAD_TO_HEAD = {
  amatas: {
    flows_audited: 750,
    total_claims: 5700,
    correct_claims: 5137,
    faithfulness_rate_pct: 90.1,
    claims_per_flow: 7.6,
  },
  vanilla: {
    flows_audited: 750,
    total_claims: 3198,
    correct_claims: 2908,
    faithfulness_rate_pct: 90.9,
    claims_per_flow: 4.26,
  },
  evidence_ratio: 1.78, // AMATAS produces 1.78x more verifiable claims per flow
  takeaway:
    "Per-claim reliability is the same (~90% for both). AMATAS's advantage is depth: 1.78× more verifiable evidence per flow, each traceable to a specific agent.",
};

// Per-agent and per-claim-type breakdowns on the balanced 50/50 batches (AMATAS only).
// Companion to FAITHFULNESS_DATA which is on Stage 1 (realistic 5% attack prevalence).
export const FAITHFULNESS_BALANCED = {
  per_agent: [
    { agent: "Statistical",      total: 701,  correct: 642,  incorrect: 59,  rate: 91.6, color: "#8b5cf6" },
    { agent: "Protocol",         total: 2699, correct: 2453, incorrect: 246, rate: 90.9, color: "#3b82f6" },
    { agent: "Orchestrator",     total: 1345, correct: 1220, incorrect: 125, rate: 90.7, color: "#10b981" },
    { agent: "Devil's Advocate", total: 47,   correct: 42,   incorrect: 5,   rate: 89.4, color: "#ef4444" },
    { agent: "Temporal",         total: 153,  correct: 136,  incorrect: 17,  rate: 88.9, color: "#ec4899" },
    { agent: "Behavioural",      total: 755,  correct: 644,  incorrect: 111, rate: 85.3, color: "#f59e0b" },
  ],
  per_claim_type: [
    { type: "TCP flags (numeric)",        total: 94,   correct: 94,   incorrect: 0,   rate: 100.0 },
    { type: "Ephemeral port",             total: 63,   correct: 63,   incorrect: 0,   rate: 100.0 },
    { type: "Protocol (numeric)",         total: 83,   correct: 83,   incorrect: 0,   rate: 100.0 },
    { type: "Port references",            total: 1754, correct: 1739, incorrect: 15,  rate: 99.1 },
    { type: "Numeric (exact)",            total: 445,  correct: 439,  incorrect: 6,   rate: 98.7 },
    { type: "Numeric (natural language)", total: 326,  correct: 318,  incorrect: 8,   rate: 97.5 },
    { type: "Service-port mapping",       total: 650,  correct: 611,  incorrect: 39,  rate: 94.0 },
    { type: "IP addresses",               total: 135,  correct: 125,  incorrect: 10,  rate: 92.6 },
    { type: "Protocol naming",            total: 896,  correct: 750,  incorrect: 146, rate: 83.7 },
    { type: "TCP flag names",             total: 1254, correct: 915,  incorrect: 339, rate: 73.0 },
  ],
};
