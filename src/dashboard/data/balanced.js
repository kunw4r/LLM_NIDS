// Balanced batch experiments (25 attack + 25 benign = 50 flows per batch)
// AMATAS 6-agent (no Tier 1) vs Vanilla single-LLM (engineered prompt)
// Source: results/balanced/balanced_summary.json
// Model: gpt-4o for both modes

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

// Results as of latest run (will be updated as more batches complete)
export const BALANCED_RESULTS = [
  // AMATAS results (multi-agent, no Tier 1)
  { batch: "Bot", mode: "amatas", recall: 48.0, precision: 57.1, f1: 52.2, fpr: 36.0, cost: 1.48, confusion: { tp: 12, fp: 9, fn: 13, tn: 16 } },
  { batch: "Brute_Force_-Web", mode: "amatas", recall: 96.0, precision: 80.0, f1: 87.3, fpr: 24.0, cost: 1.46, confusion: { tp: 24, fp: 6, fn: 1, tn: 19 } },
  { batch: "Brute_Force_-XSS", mode: "amatas", recall: 96.0, precision: 85.7, f1: 90.6, fpr: 16.0, cost: 1.50, confusion: { tp: 24, fp: 4, fn: 1, tn: 21 } },
  { batch: "DDoS_attacks-LOIC-HTTP", mode: "amatas", recall: 72.0, precision: 75.0, f1: 73.5, fpr: 24.0, cost: 1.58, confusion: { tp: 18, fp: 6, fn: 7, tn: 19 } },
  { batch: "DoS_attacks-GoldenEye", mode: "amatas", recall: 80.0, precision: 71.4, f1: 75.5, fpr: 32.0, cost: 1.63, confusion: { tp: 20, fp: 8, fn: 5, tn: 17 } },
  { batch: "DoS_attacks-Hulk", mode: "amatas", recall: 80.0, precision: 71.4, f1: 75.5, fpr: 32.0, cost: 1.60, confusion: { tp: 20, fp: 8, fn: 5, tn: 17 } },
  { batch: "DoS_attacks-SlowHTTPTest", mode: "amatas", recall: 100.0, precision: 75.8, f1: 86.2, fpr: 100.0, cost: 1.62, confusion: { tp: 25, fp: 8, fn: 0, tn: 17 } },
  { batch: "DoS_attacks-Slowloris", mode: "amatas", recall: 96.0, precision: 82.8, f1: 88.9, fpr: 20.0, cost: 1.67, confusion: { tp: 24, fp: 5, fn: 1, tn: 20 } },
  { batch: "FTP-BruteForce", mode: "amatas", recall: 100.0, precision: 73.5, f1: 84.7, fpr: 32.0, cost: 1.71, confusion: { tp: 25, fp: 9, fn: 0, tn: 16 } },
  // Vanilla results
  { batch: "Bot", mode: "vanilla", recall: 24.0, precision: 35.3, f1: 28.6, fpr: 44.0, cost: 0.19, confusion: { tp: 6, fp: 11, fn: 19, tn: 14 } },
  { batch: "Brute_Force_-Web", mode: "vanilla", recall: 52.0, precision: 86.7, f1: 65.0, fpr: 8.0, cost: 0.19, confusion: { tp: 13, fp: 2, fn: 12, tn: 23 } },
  { batch: "Brute_Force_-XSS", mode: "vanilla", recall: 24.0, precision: 60.0, f1: 34.3, fpr: 16.0, cost: 0.19, confusion: { tp: 6, fp: 4, fn: 19, tn: 21 } },
  { batch: "DDoS_attacks-LOIC-HTTP", mode: "vanilla", recall: 60.0, precision: 60.0, f1: 60.5, fpr: 40.0, cost: 0.19, confusion: { tp: 15, fp: 10, fn: 10, tn: 15 } },
  { batch: "DoS_attacks-GoldenEye", mode: "vanilla", recall: 36.0, precision: 64.3, f1: 45.7, fpr: 20.0, cost: 0.19, confusion: { tp: 9, fp: 5, fn: 16, tn: 20 } },
  { batch: "DoS_attacks-Hulk", mode: "vanilla", recall: 40.0, precision: 62.5, f1: 48.8, fpr: 24.0, cost: 0.19, confusion: { tp: 10, fp: 6, fn: 15, tn: 19 } },
  { batch: "DoS_attacks-SlowHTTPTest", mode: "vanilla", recall: 100.0, precision: 80.6, f1: 89.3, fpr: 96.0, cost: 0.19, confusion: { tp: 25, fp: 24, fn: 0, tn: 1 } },
  { batch: "DoS_attacks-Slowloris", mode: "vanilla", recall: 44.0, precision: 78.6, f1: 56.4, fpr: 12.0, cost: 0.17, confusion: { tp: 11, fp: 3, fn: 14, tn: 22 } },
  { batch: "FTP-BruteForce", mode: "vanilla", recall: 100.0, precision: 80.6, f1: 89.3, fpr: 96.0, cost: 0.19, confusion: { tp: 25, fp: 24, fn: 0, tn: 1 } },
];

// Note: a few batches (DDOS-HOIC, DDOS-LOIC-UDP) are still running when this
// file was generated. The component falls back to "—" for missing rows.
// Running averages over 9 completed batches (both modes):
export const BALANCED_AGGREGATE = {
  amatas: {
    n_complete: 9,
    avg_recall: 85.3,
    avg_precision: 74.7,
    avg_f1: 79.4,
    avg_fpr: 35.1,
    total_cost: 14.25,
  },
  vanilla: {
    n_complete: 9,
    avg_recall: 53.3,
    avg_precision: 67.6,
    avg_f1: 57.5,
    avg_fpr: 28.4,
    total_cost: 1.70,
  },
  delta: {
    recall: 32.0,  // AMATAS - Vanilla
    f1: 21.9,
    fpr: 6.7,  // AMATAS is higher (more trigger-happy)
    cost_ratio: 8.4,  // AMATAS costs ~8x more
  },
};

// Curated examples where AMATAS caught an attack that vanilla missed.
// Shows the multi-agent reasoning advantage in concrete terms.
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
