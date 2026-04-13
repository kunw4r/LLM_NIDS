// Balanced batch experiments (25 attack + 25 benign = 50 flows per batch)
// AMATAS 6-agent (no Tier 1) vs Vanilla single-LLM (engineered prompt)
// Source: results/balanced/enriched_summary.json
// Model: gpt-4o for both modes
// Auto-generated from real results — last run 2026-04-13

export const BALANCED_META = {
  description: "Direct-to-AMATAS vs vanilla single-LLM, balanced 50/50 batches",
  model: "gpt-4o",
  batch_size: 50,
  class_balance: "50/50 (25 attack + 25 benign)",
  source: "validation.csv",
  amatas_architecture: "6 agents (4 specialists + Devil's Advocate + Orchestrator), NO Tier-1 RF",
  vanilla_architecture: "1 GPT-4o call per flow, engineered prompt with attack signatures",
  purpose: "Isolate multi-agent architecture value vs prompt engineering alone, at balanced class ratio",
};

export const BALANCED_RESULTS = [
  { batch: "Bot", mode: "amatas", recall: 48.0, precision: 57.1, f1: 52.2, fpr: 36.0, balanced_accuracy: 56.0, mcc: 0.122, cost: 1.482, confusion: { tp: 12, fp: 9, fn: 13, tn: 16 } },
  { batch: "Bot", mode: "vanilla", recall: 24.0, precision: 35.3, f1: 28.6, fpr: 44.0, balanced_accuracy: 40.0, mcc: -0.211, cost: 0.1911, confusion: { tp: 6, fp: 11, fn: 19, tn: 14 } },
  { batch: "Brute_Force_-Web", mode: "amatas", recall: 96.0, precision: 80.0, f1: 87.3, fpr: 24.0, balanced_accuracy: 86.0, mcc: 0.735, cost: 1.4566, confusion: { tp: 24, fp: 6, fn: 1, tn: 19 } },
  { batch: "Brute_Force_-Web", mode: "vanilla", recall: 52.0, precision: 86.7, f1: 65.0, fpr: 8.0, balanced_accuracy: 72.0, mcc: 0.48, cost: 0.1889, confusion: { tp: 13, fp: 2, fn: 12, tn: 23 } },
  { batch: "Brute_Force_-XSS", mode: "amatas", recall: 96.0, precision: 85.7, f1: 90.6, fpr: 16.0, balanced_accuracy: 90.0, mcc: 0.806, cost: 1.5051, confusion: { tp: 24, fp: 4, fn: 1, tn: 21 } },
  { batch: "Brute_Force_-XSS", mode: "vanilla", recall: 24.0, precision: 60.0, f1: 34.3, fpr: 16.0, balanced_accuracy: 54.0, mcc: 0.1, cost: 0.1878, confusion: { tp: 6, fp: 4, fn: 19, tn: 21 } },
  { batch: "DDOS_attack-HOIC", mode: "amatas", recall: 64.0, precision: 72.7, f1: 68.1, fpr: 24.0, balanced_accuracy: 70.0, mcc: 0.403, cost: 1.4497, confusion: { tp: 16, fp: 6, fn: 9, tn: 19 } },
  { batch: "DDOS_attack-HOIC", mode: "vanilla", recall: 28.0, precision: 53.8, f1: 36.8, fpr: 24.0, balanced_accuracy: 52.0, mcc: 0.046, cost: 0.1866, confusion: { tp: 7, fp: 6, fn: 18, tn: 19 } },
  { batch: "DDOS_attack-LOIC-UDP", mode: "amatas", recall: 100.0, precision: 75.8, f1: 86.2, fpr: 32.0, balanced_accuracy: 84.0, mcc: 0.718, cost: 1.4966, confusion: { tp: 25, fp: 8, fn: 0, tn: 17 } },
  { batch: "DDOS_attack-LOIC-UDP", mode: "vanilla", recall: 100.0, precision: 86.2, f1: 92.6, fpr: 16.0, balanced_accuracy: 92.0, mcc: 0.851, cost: 0.1909, confusion: { tp: 25, fp: 4, fn: 0, tn: 21 } },
  { batch: "DDoS_attacks-LOIC-HTTP", mode: "amatas", recall: 72.0, precision: 75.0, f1: 73.5, fpr: 24.0, balanced_accuracy: 74.0, mcc: 0.48, cost: 1.4669, confusion: { tp: 18, fp: 6, fn: 7, tn: 19 } },
  { batch: "DDoS_attacks-LOIC-HTTP", mode: "vanilla", recall: 52.0, precision: 72.2, f1: 60.5, fpr: 20.0, balanced_accuracy: 66.0, mcc: 0.333, cost: 0.1863, confusion: { tp: 13, fp: 5, fn: 12, tn: 20 } },
  { batch: "DoS_attacks-GoldenEye", mode: "amatas", recall: 80.0, precision: 71.4, f1: 75.5, fpr: 32.0, balanced_accuracy: 74.0, mcc: 0.483, cost: 1.6282, confusion: { tp: 20, fp: 8, fn: 5, tn: 17 } },
  { batch: "DoS_attacks-GoldenEye", mode: "vanilla", recall: 32.0, precision: 80.0, f1: 45.7, fpr: 8.0, balanced_accuracy: 62.0, mcc: 0.3, cost: 0.1912, confusion: { tp: 8, fp: 2, fn: 17, tn: 23 } },
  { batch: "DoS_attacks-Hulk", mode: "amatas", recall: 80.0, precision: 71.4, f1: 75.5, fpr: 32.0, balanced_accuracy: 74.0, mcc: 0.483, cost: 1.6231, confusion: { tp: 20, fp: 8, fn: 5, tn: 17 } },
  { batch: "DoS_attacks-Hulk", mode: "vanilla", recall: 40.0, precision: 62.5, f1: 48.8, fpr: 24.0, balanced_accuracy: 58.0, mcc: 0.171, cost: 0.1886, confusion: { tp: 10, fp: 6, fn: 15, tn: 19 } },
  { batch: "DoS_attacks-SlowHTTPTest", mode: "amatas", recall: 100.0, precision: 75.8, f1: 86.2, fpr: 32.0, balanced_accuracy: 84.0, mcc: 0.718, cost: 1.6133, confusion: { tp: 25, fp: 8, fn: 0, tn: 17 } },
  { batch: "DoS_attacks-SlowHTTPTest", mode: "vanilla", recall: 100.0, precision: 80.6, f1: 89.3, fpr: 24.0, balanced_accuracy: 88.0, mcc: 0.783, cost: 0.1849, confusion: { tp: 25, fp: 6, fn: 0, tn: 19 } },
  { batch: "DoS_attacks-Slowloris", mode: "amatas", recall: 96.0, precision: 82.8, f1: 88.9, fpr: 20.0, balanced_accuracy: 88.0, mcc: 0.77, cost: 1.6219, confusion: { tp: 24, fp: 5, fn: 1, tn: 20 } },
  { batch: "DoS_attacks-Slowloris", mode: "vanilla", recall: 44.0, precision: 78.6, f1: 56.4, fpr: 12.0, balanced_accuracy: 66.0, mcc: 0.356, cost: 0.1873, confusion: { tp: 11, fp: 3, fn: 14, tn: 22 } },
  { batch: "FTP-BruteForce", mode: "amatas", recall: 100.0, precision: 73.5, f1: 84.7, fpr: 36.0, balanced_accuracy: 82.0, mcc: 0.686, cost: 1.6044, confusion: { tp: 25, fp: 9, fn: 0, tn: 16 } },
  { batch: "FTP-BruteForce", mode: "vanilla", recall: 100.0, precision: 80.6, f1: 89.3, fpr: 24.0, balanced_accuracy: 88.0, mcc: 0.783, cost: 0.1856, confusion: { tp: 25, fp: 6, fn: 0, tn: 19 } },
  { batch: "Infilteration", mode: "amatas", recall: 40.0, precision: 66.7, f1: 50.0, fpr: 20.0, balanced_accuracy: 60.0, mcc: 0.218, cost: 1.4461, confusion: { tp: 10, fp: 5, fn: 15, tn: 20 } },
  { batch: "Infilteration", mode: "vanilla", recall: 20.0, precision: 100.0, f1: 33.3, fpr: 0.0, balanced_accuracy: 60.0, mcc: 0.333, cost: 0.1818, confusion: { tp: 5, fp: 0, fn: 20, tn: 25 } },
  { batch: "SQL_Injection", mode: "amatas", recall: 88.0, precision: 81.5, f1: 84.6, fpr: 20.0, balanced_accuracy: 84.0, mcc: 0.682, cost: 1.4969, confusion: { tp: 22, fp: 5, fn: 3, tn: 20 } },
  { batch: "SQL_Injection", mode: "vanilla", recall: 8.0, precision: 40.0, f1: 13.3, fpr: 12.0, balanced_accuracy: 48.0, mcc: -0.067, cost: 0.1914, confusion: { tp: 2, fp: 3, fn: 23, tn: 22 } },
  { batch: "SSH-Bruteforce", mode: "amatas", recall: 100.0, precision: 75.8, f1: 86.2, fpr: 32.0, balanced_accuracy: 84.0, mcc: 0.718, cost: 1.6043, confusion: { tp: 25, fp: 8, fn: 0, tn: 17 } },
  { batch: "SSH-Bruteforce", mode: "vanilla", recall: 100.0, precision: 78.1, f1: 87.7, fpr: 28.0, balanced_accuracy: 86.0, mcc: 0.75, cost: 0.1843, confusion: { tp: 25, fp: 7, fn: 0, tn: 18 } },
  { batch: "mixed_all", mode: "amatas", recall: 57.1, precision: 69.6, f1: 62.7, fpr: 31.8, balanced_accuracy: 62.7, mcc: 0.252, cost: 1.4579, confusion: { tp: 16, fp: 7, fn: 12, tn: 15 } },
  { batch: "mixed_all", mode: "vanilla", recall: 46.4, precision: 76.5, f1: 57.8, fpr: 18.2, balanced_accuracy: 64.1, mcc: 0.296, cost: 0.1887, confusion: { tp: 13, fp: 4, fn: 15, tn: 18 } },
];

export const BALANCED_AGGREGATE = {
  amatas: {
    n_complete: 15,
    avg_recall: 81.14,
    avg_precision: 74.32,
    avg_f1: 76.81,
    avg_fpr: 27.45,
    avg_balanced_accuracy: 76.85,
    avg_mcc: 0.55,
    total_cost: 22.95,
  },
  vanilla: {
    n_complete: 15,
    avg_recall: 51.36,
    avg_precision: 71.41,
    avg_f1: 55.96,
    avg_fpr: 18.55,
    avg_balanced_accuracy: 66.41,
    avg_mcc: 0.35,
    total_cost: 2.82,
  },
  delta: {
    recall: 29.78,
    f1: 20.85,
    balanced_accuracy: 10.44,
    mcc: 0.2,
    cost_ratio: 8.1,
  },
};

// Curated examples where AMATAS caught an attack that vanilla missed.
export const BALANCED_REASONING_EXAMPLES = [
  {
    id: "xss-ike-port",
    batch: "Brute_Force_-XSS",
    flow_idx: 0,
    actual: "Brute_Force_-XSS",
    amatas: {
      verdict: "SUSPICIOUS",
      predicted_type: "DATA EXFILTRATION",
      specialists: [
        { name: "Protocol", verdict: "SUSPICIOUS", findings: ["UDP protocol (17) on port 500 aligns with IKE/IPsec", "No outgoing packets (OUT_PKTS=0, OUT_BYTES=0) unusual for IKE handshakes"] },
        { name: "Statistical", verdict: "SUSPICIOUS", findings: ["Completely one-directional traffic", "High asymmetric SRC→DST inter-arrival times"] },
        { name: "Behavioural", verdict: "SUSPICIOUS", findings: ["Unusual outbound connection", "Non-standard port usage", "Long flow duration", "Zero sourced packets"] },
        { name: "Temporal", verdict: "SUSPICIOUS", findings: ["Repetitive patterns across co-IP flows", "Uniform flow durations and packet sizes", "Regular timing intervals suggesting periodic activity"] },
      ],
      devils_advocate: { confidence_benign: 0.9, argument: "Could be legitimate IKE/IPsec key exchange; lack of replies is not always malicious." },
      final_reasoning: "All four specialists flagged concerns. Protocol noted unusual IKE on UDP/500 with no outgoing packets. Statistical found asymmetric one-way flow. Behavioural identified non-standard port usage. Temporal detected repetitive periodic patterns across co-IP flows. Despite DA's strong benign argument (0.90), the unanimous specialist consensus on anomaly indicators — especially the temporal periodicity combined with one-way data pattern — outweighed the benign interpretation.",
    },
    vanilla: {
      verdict: "BENIGN",
      reasoning: "The flow is a UDP connection on port 500. Port 500 is commonly used for Internet Key Exchange (IKE), which is part of IPsec, a protocol suite for secure Internet Protocol (IP) communications. The flow has a modest byte count and packet count, with data only moving from source to destination, which can be typical for a one-way communication like key exchange. There is no evidence of malicious intent.",
    },
    analysis: "The vanilla LLM stops at the first plausible explanation (port 500 = IKE = benign). AMATAS's Temporal Agent provides context the single-LLM doesn't have: this flow is part of a repetitive pattern across multiple co-IP flows, which the single-LLM can't observe because it only sees one flow at a time. The Devil's Advocate made the strongest case for benign that a single LLM would likely accept — but the Orchestrator weighed it against four independent specialist findings and correctly flagged the flow.",
  },
  {
    id: "bot-8080-beacon",
    batch: "Bot",
    flow_idx: 22,
    actual: "Bot",
    amatas: {
      verdict: "SUSPICIOUS",
      predicted_type: "SCANNING AND RECONNAISSANCE",
      specialists: [
        { name: "Protocol", verdict: "BENIGN", findings: ["Destination port 8080 is HTTP proxy", "Source port 59489 ephemeral", "TCP protocol standard"] },
        { name: "Statistical", verdict: "BENIGN", findings: [] },
        { name: "Behavioural", verdict: "SUSPICIOUS", findings: ["Short duration", "Minimal data transfer", "SYN-ACK-RST pattern (TCP flags 219)", "Uncommon target port 8080"] },
        { name: "Temporal", verdict: "SUSPICIOUS", findings: ["Same src→dst→port combo repeated", "Uniform flow durations and packet sizes across flows", "Regular timing intervals"] },
      ],
      devils_advocate: { confidence_benign: 0.6, argument: "Port 8080 is a common proxy port; short bursts to proxies are typical of background agents." },
      final_reasoning: "Protocol and Statistical agents saw nothing wrong individually, but Behavioural and Temporal caught the real pattern: the SYN-ACK-RST handshake (flags=219) combined with repetitive beaconing to the same destination is a textbook botnet C2 check-in. No single agent had enough signal alone — the combination revealed the attack.",
    },
    vanilla: {
      verdict: "BENIGN",
      reasoning: "The flow represents typical web traffic from a private to a public IP, utilizing a common web proxy port (8080), with comparable in and out packet and byte counts. The brief duration and balanced byte count suggest a small web transaction rather than a sustained data exfiltration.",
    },
    analysis: "Classic case where 2 of 4 specialists said BENIGN but the combination mattered. The single LLM matches the surface features (web proxy port, balanced bytes) to a benign pattern and stops. The Temporal Agent's cross-flow view — 'this same src→dst→port combo repeats with uniform timing' — is the decisive evidence, and it's fundamentally unavailable to a per-flow single-LLM baseline.",
  },
];
