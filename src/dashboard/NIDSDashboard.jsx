import { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — All experiments, narratives, and result structures
// ═══════════════════════════════════════════════════════════════════════════════

const EXPERIMENTS = [
  {
    id: "baseline",
    name: "MCP Baseline",
    phase: "Phase 1",
    phaseGroup: "Phase 1 — MCP",
    date: "2026-02-19",
    flows: 58,
    cost: 3.98,
    f1: 0.833,
    precision: 0.755,
    recall: 0.930,
    accuracy: 0.724,
    model: "claude-sonnet-4",
    confusion: { tp: 40, fp: 13, tn: 2, fn: 3 },
    verdicts: { benign: 5, suspicious: 53, malicious: 0 },
    variables: { architecture: "single-agent + MCP", model: "claude-sonnet-4", batch_size: 58, benign_ratio: "26%", da_weight: "N/A" },
    narrative: {
      tried: "Single Claude Sonnet agent with 13 MCP tools — AbuseIPDB, OTX, geolocation, MITRE ATT&CK, and NetFlow analyzer. ReAct loop with up to 5 tool iterations per flow. The agent queries external threat intelligence APIs for each IP address and uses the results to classify flows.",
      happened: "0 out of 142 external tool calls returned meaningful data. Every IP in the CICIDS2018 dataset is anonymized to private RFC1918 ranges, so AbuseIPDB, OTX, and geolocation all return empty results. The agent defaulted to SUSPICIOUS when uncertain, flagging 53 of 58 flows as suspicious.",
      learned: "External threat intelligence is useless on anonymized datasets — the entire MCP tool approach is fundamentally mismatched to this problem.",
      nextId: "iter_1",
    },
  },
  {
    id: "iter_1",
    name: "Temporal Memory",
    phase: "Phase 2",
    phaseGroup: "Phase 2 — Single-Agent",
    date: "2026-02-19",
    flows: 58,
    cost: 6.73,
    f1: 0.753,
    precision: 0.853,
    recall: 0.674,
    accuracy: 0.672,
    model: "claude-sonnet-4",
    confusion: { tp: 29, fp: 5, tn: 10, fn: 14 },
    verdicts: { benign: 24, suspicious: 29, malicious: 5 },
    variables: { architecture: "single-agent + MCP", model: "claude-sonnet-4", batch_size: 58, benign_ratio: "26%", da_weight: "N/A", temporal_context: "SQLite 60s window" },
    narrative: {
      tried: "Added SQLite-based temporal memory that tracks all previously analysed flows. Before each flow analysis, the agent queries recent activity from the same source IP within a 60-second window to provide temporal context.",
      happened: "Temporal context was only injected for 2 of 58 flows (3.4% injection rate) because the batch lacked temporal density — most source IPs appeared only once. Precision improved to 85.3% (best of Phase 2) but recall dropped to 67.4%.",
      learned: "Temporal memory only helps when the batch has temporal density — repeated flows from the same IP within short windows. A sparse batch negates the entire approach.",
      nextId: "iter_2",
    },
  },
  {
    id: "iter_2",
    name: "Benign Calibration",
    phase: "Phase 2",
    phaseGroup: "Phase 2 — Single-Agent",
    date: "2026-02-19",
    flows: 58,
    cost: 7.18,
    f1: 0.776,
    precision: 0.786,
    recall: 0.767,
    accuracy: 0.672,
    model: "claude-sonnet-4",
    confusion: { tp: 33, fp: 9, tn: 6, fn: 10 },
    verdicts: { benign: 16, suspicious: 37, malicious: 5 },
    variables: { architecture: "single-agent + MCP", model: "claude-sonnet-4", batch_size: 58, benign_ratio: "26%", da_weight: "N/A" },
    narrative: {
      tried: "Added calibration guidance teaching the agent that empty threat intel for RFC1918/private IPs is expected — not suspicious. Defined known-benign traffic patterns (DNS, DHCP, HTTPS). Required POSITIVE evidence of anomaly before flagging suspicious.",
      happened: "Balanced trade-off achieved: false positives reduced from 13 to 9 vs baseline, benign accuracy up from 13.3% to 40%. But recall dropped from 93% to 77% — the agent now misses some attacks it previously caught by over-flagging everything.",
      learned: "Prompt engineering on a single agent is a precision-recall seesaw. Improving one metric degrades the other. The single-agent architecture has a ceiling.",
      nextId: "phase3a",
    },
  },
  {
    id: "phase3a",
    name: "Multi-Agent Baseline",
    phase: "Phase 3",
    phaseGroup: "Phase 3 — Multi-Agent",
    date: "2026-02-20",
    flows: 58,
    cost: 3.85,
    f1: 0.716,
    precision: 1.0,
    recall: 0.558,
    accuracy: 0.672,
    model: "claude-sonnet-4",
    confusion: { tp: 24, fp: 0, tn: 15, fn: 19 },
    verdicts: { benign: 34, suspicious: 16, malicious: 8 },
    variables: { architecture: "6-agent multi-agent", model: "claude-sonnet-4", batch_size: 58, benign_ratio: "26%", da_weight: "30%" },
    narrative: {
      tried: "Completely new 6-agent architecture: 4 specialist agents (protocol, statistical, behavioural, temporal) analyse each flow in parallel, followed by a Devil's Advocate that argues for benign interpretation, then an Orchestrator that makes a weighted consensus verdict. No MCP tools — pure LLM reasoning on NetFlow features.",
      happened: "Perfect precision (zero false positives!) but low recall at 55.8% — 19 false negatives. The Devil's Advocate was too aggressive, successfully arguing benign on many true attacks. The multi-agent approach was 2x faster than MCP (30 min vs 88 min) and cheaper per flow.",
      learned: "Multi-agent consensus eliminates false positives but the DA agent needs careful weighting to avoid suppressing true detections.",
      nextId: "phase3b",
    },
  },
  {
    id: "phase3b",
    name: "Scale Test (150 flows)",
    phase: "Phase 3",
    phaseGroup: "Phase 3 — Multi-Agent",
    date: "2026-02-20",
    flows: 150,
    cost: 11.11,
    f1: 0.959,
    precision: 0.921,
    recall: 1.0,
    accuracy: 0.94,
    model: "claude-sonnet-4",
    confusion: { tp: 105, fp: 9, tn: 36, fn: 0 },
    verdicts: { benign: 36, suspicious: 33, malicious: 81 },
    variables: { architecture: "6-agent multi-agent", model: "claude-sonnet-4", batch_size: 150, benign_ratio: "30%", da_weight: "30%" },
    narrative: {
      tried: "Scaled to 150 flows with 6 attack types: FTP-BruteForce, SSH-Bruteforce, DoS-GoldenEye, DoS-Slowloris, DoS-SlowHTTPTest. 30 flows per attack type plus 45 benign. Rich temporal context with ~30 same-IP flows per source.",
      happened: "Best results across all experiments. 100% recall — zero missed attacks. The temporal agent excelled with rich same-IP flow context. Only 9 false positives from 45 benign flows. F1 of 95.9%.",
      learned: "Temporal context density is the strongest signal. When the temporal agent has 30+ flows from the same source IP, detection becomes near-perfect. The multi-agent architecture dramatically outperforms single-agent approaches.",
      nextId: "phase3c",
    },
  },
  {
    id: "phase3c",
    name: "Realistic Distribution",
    phase: "Phase 3",
    phaseGroup: "Phase 3 — Multi-Agent",
    date: "2026-02-20",
    flows: 100,
    cost: 6.51,
    f1: 0.233,
    precision: 0.146,
    recall: 0.583,
    accuracy: 0.54,
    model: "claude-sonnet-4",
    confusion: { tp: 7, fp: 41, tn: 47, fn: 5 },
    verdicts: { benign: 52, suspicious: 38, malicious: 10 },
    variables: { architecture: "6-agent multi-agent", model: "claude-sonnet-4", batch_size: 100, benign_ratio: "88%", da_weight: "30%" },
    narrative: {
      tried: "First test on realistic class distribution — 88% benign, 12% attack, matching real-world traffic ratios. Same 6-agent architecture with 30% DA weight. Contains DDOS-HOIC, DoS-Hulk, FTP-BruteForce, and Infiltration.",
      happened: "Catastrophic false positive explosion: 41 of 88 benign flows flagged as attacks. Precision collapsed to 14.6%. Specialists hallucinated attack patterns in normal HTTPS, DNS, and NTP traffic. 35 of 41 FPs had unanimous 4/4 specialist agreement on MALICIOUS.",
      learned: "The system was implicitly calibrated on attack-heavy batches. On realistic distributions with 88% benign traffic, the specialists can't distinguish normal from malicious. This is the central problem to solve.",
      nextId: "phase3e",
    },
  },
  {
    id: "phase3e",
    name: "DA Weight 50%",
    phase: "Phase 3",
    phaseGroup: "Phase 3 — Multi-Agent",
    date: "2026-02-20",
    flows: 100,
    cost: 6.54,
    f1: 0.259,
    precision: 0.167,
    recall: 0.583,
    accuracy: 0.60,
    model: "claude-sonnet-4",
    confusion: { tp: 7, fp: 35, tn: 53, fn: 5 },
    verdicts: { benign: 58, suspicious: 40, malicious: 2 },
    variables: { architecture: "6-agent multi-agent", model: "claude-sonnet-4", batch_size: 100, benign_ratio: "88%", da_weight: "50%" },
    narrative: {
      tried: "Increased Devil's Advocate weight from 30% to 50%. Modified consensus thresholds: 4/4 specialists + strong DA now yields SUSPICIOUS instead of MALICIOUS. 3/4 specialists + strong DA now yields BENIGN.",
      happened: "Fixed 6 FPs without introducing any new errors (0 worsened flows). But 35 FPs remain — 34 of which have 4/4 specialists unanimously wrong. DA argues benign with 0.80 mean confidence but can't override unanimous specialist consensus.",
      learned: "The false positive problem is in specialist prompts, not orchestrator weighting. No DA weight can fix specialists that unanimously hallucinate attack patterns in benign traffic.",
      nextId: "batch3_stealthy",
    },
  },
  {
    id: "batch3_stealthy",
    name: "Stealthy Attacks (1000)",
    phase: "Phase 3",
    phaseGroup: "Phase 3 — Multi-Agent",
    date: "2026-02-21",
    flows: 1000,
    cost: 107.99,
    f1: 0.823,
    precision: 0.948,
    recall: 0.727,
    accuracy: 0.712,
    model: "claude-sonnet-4",
    confusion: { tp: 668, fp: 37, tn: 44, fn: 251 },
    verdicts: { benign: 268, suspicious: 113, malicious: 592 },
    variables: { architecture: "6-agent multi-agent", model: "claude-sonnet-4", batch_size: 1000, benign_ratio: "8.1%", da_weight: "30%" },
    narrative: {
      tried: "First large-scale evaluation — 1000 flows targeting the 3 attack types previously undetectable at 0% recall: SQL Injection (300), XSS Brute Force (319), Infiltration (300), plus 81 benign flows.",
      happened: "Major breakthrough: recovered detection for all 3 previously-invisible attack types. SQL Injection 93.3% recall (280/300). XSS 85.6% recall (273/319). Infiltration 38.3% recall (115/300). Precision excellent at 94.8%. Total cost $107.99 over 12.6 hours.",
      learned: "At 1000-flow scale, richer temporal context enables detection of patterns invisible in small batches. Infiltration remains the hardest — its DNS-mimicry requires burst-level detection.",
      nextId: "sonnet_20",
    },
  },
  {
    id: "sonnet_20",
    name: "Sonnet-4 Cost Baseline",
    phase: "Phase 4",
    phaseGroup: "Phase 4 — Model Comparison",
    date: "2026-02-21",
    flows: 20,
    cost: 3.77,
    f1: 0.824,
    precision: 0.778,
    recall: 0.875,
    accuracy: 0.70,
    model: "claude-sonnet-4",
    confusion: { tp: 14, fp: 4, tn: 0, fn: 2 },
    verdicts: { benign: 2, suspicious: 4, malicious: 14 },
    variables: { architecture: "6-agent multi-agent", model: "claude-sonnet-4", batch_size: 20, benign_ratio: "20%", da_weight: "30%" },
    narrative: {
      tried: "Cost comparison baseline: ran 20 flows from Batch 1 with full Sonnet-4 for both orchestrator and all specialists. Established the cost ceiling to compare against cheaper models.",
      happened: "87.5% recall, 77.8% precision, F1 0.824 at $3.77 total ($0.189/flow). The temporal agent dominated cost at $2.63 (70% of total). Quality is good but expensive.",
      learned: "At $0.189/flow, Sonnet-4 for all agents is prohibitively expensive for large-scale evaluation. The temporal agent alone consumes 70% of the budget due to vector context injection.",
      nextId: "haiku_20",
    },
  },
  {
    id: "haiku_20",
    name: "Haiku Specialist Test",
    phase: "Phase 4",
    phaseGroup: "Phase 4 — Model Comparison",
    date: "2026-02-21",
    flows: 20,
    cost: 0.50,
    f1: 0.0,
    precision: 0.0,
    recall: 0.0,
    accuracy: 0.20,
    model: "claude-haiku-3.5",
    confusion: { tp: 0, fp: 0, tn: 4, fn: 16 },
    verdicts: { benign: 20, suspicious: 0, malicious: 0 },
    variables: { architecture: "6-agent multi-agent", model: "claude-haiku-3.5", batch_size: 20, benign_ratio: "20%", da_weight: "30%" },
    narrative: {
      tried: "Tested Haiku 3.5 as the specialist model to minimize cost. Only the DA and orchestrator used Sonnet; the 4 specialists used Haiku.",
      happened: "Complete failure — 0% recall, 0% F1. Haiku classified every single flow as BENIGN. The model lacked the reasoning capability to detect attack patterns in raw NetFlow features. Architectural bug: specialists produced 0 calls.",
      learned: "Haiku is too weak for NetFlow security analysis. There is a minimum model capability threshold below which the multi-agent architecture completely fails.",
      nextId: "hybrid_20",
    },
  },
  {
    id: "hybrid_20",
    name: "Hybrid GPT-4o-mini",
    phase: "Phase 4",
    phaseGroup: "Phase 4 — Model Comparison",
    date: "2026-02-21",
    flows: 20,
    cost: 0.71,
    f1: 0.857,
    precision: 0.789,
    recall: 0.938,
    accuracy: 0.75,
    model: "gpt-4o-mini + sonnet-4",
    confusion: { tp: 15, fp: 4, tn: 0, fn: 1 },
    verdicts: { benign: 1, suspicious: 4, malicious: 15 },
    variables: { architecture: "6-agent multi-agent", model: "gpt-4o-mini (specialists) + sonnet-4 (orch+DA)", batch_size: 20, benign_ratio: "20%", da_weight: "30%" },
    narrative: {
      tried: "Hybrid approach: GPT-4o-mini for the 4 specialist agents (cheap), Claude Sonnet for the orchestrator and Devil's Advocate (quality). Tests whether cheap specialists with smart orchestration can match full-Sonnet quality.",
      happened: "Excellent results: 93.8% recall, 78.9% precision, F1 0.857 — actually better than full Sonnet on this batch. Cost dropped 81% from $3.77 to $0.71. GPT-4o-mini specialists were surprisingly capable.",
      learned: "GPT-4o-mini is a viable specialist model. The orchestrator quality matters more than specialist quality — cheap specialists with a smart orchestrator outperform the reverse.",
      nextId: "gpt4omini_20",
    },
  },
  {
    id: "gpt4omini_20",
    name: "All GPT-4o-mini",
    phase: "Phase 4",
    phaseGroup: "Phase 4 — Model Comparison",
    date: "2026-02-21",
    flows: 20,
    cost: 0.146,
    f1: 0.889,
    precision: 0.80,
    recall: 1.0,
    accuracy: 0.80,
    model: "gpt-4o-mini",
    confusion: { tp: 16, fp: 4, tn: 0, fn: 0 },
    verdicts: { benign: 0, suspicious: 4, malicious: 16 },
    variables: { architecture: "6-agent multi-agent", model: "gpt-4o-mini (all agents)", batch_size: 20, benign_ratio: "20%", da_weight: "30%" },
    narrative: {
      tried: "All 6 agents running on GPT-4o-mini — no Anthropic API calls at all. Tests the floor: how cheap can we go while maintaining quality?",
      happened: "Surprisingly the best 20-flow result: 100% recall, 80% precision, F1 0.889. Cost was $0.146 total ($0.007/flow) — 26x cheaper than Sonnet. No missed attacks. 4 false positives on benign flows.",
      learned: "GPT-4o-mini at $0.007/flow makes large-scale evaluation economically feasible. Quality is comparable to or better than Sonnet-4 on this sample. Need to validate at 1000-flow scale.",
      nextId: "gpt4omini_1000",
    },
  },
  {
    id: "gpt4omini_1000",
    name: "GPT-4o-mini at Scale",
    phase: "Phase 4",
    phaseGroup: "Phase 4 — Model Comparison",
    date: "2026-02-22",
    flows: 1000,
    cost: 4.09,
    f1: 0.958,
    precision: 0.919,
    recall: 1.0,
    accuracy: 0.919,
    model: "gpt-4o-mini",
    confusion: { tp: 919, fp: 81, tn: 0, fn: 0 },
    verdicts: { benign: 0, suspicious: 81, malicious: 919 },
    variables: { architecture: "6-agent multi-agent", model: "gpt-4o-mini (all agents)", batch_size: 1000, benign_ratio: "8.1%", da_weight: "30%" },
    narrative: {
      tried: "Scaled GPT-4o-mini to the same 1000-flow stealthy batch used in experiment 8. Direct comparison: does the 26x cost reduction hold at scale?",
      happened: "Perfect recall (100%) with 91.9% precision. F1 of 0.958 — better than Sonnet's 0.823 on the same batch. Cost was $4.09 vs Sonnet's $107.99 (26x cheaper). Runtime 6.7 hours vs 12.6 hours. 81 FPs vs Sonnet's 37, but zero missed attacks.",
      learned: "GPT-4o-mini is the clear winner for large-scale evaluation. It trades slightly higher FP rate for perfect recall at 1/26th the cost. This is the model configuration for Stage 1.",
      nextId: "stage1_ftp",
    },
  },
  {
    id: "stage1_ftp",
    name: "Stage 1: FTP-BruteForce",
    phase: "Stage 1",
    phaseGroup: "Stage 1 — Per-Attack Evaluation",
    date: "2026-02-23",
    flows: 1000,
    cost: 1.61,
    f1: 0.864,
    precision: 1.0,
    recall: 0.76,
    accuracy: 0.988,
    model: "gpt-4o",
    confusion: { tp: 38, fp: 0, tn: 950, fn: 12 },
    verdicts: { benign: 962, suspicious: 6, malicious: 32 },
    variables: { architecture: "6-agent + Tier-1 RF filter", model: "gpt-4o", batch_size: 1000, benign_ratio: "95%", da_weight: "30%", tier1_threshold: 0.15 },
    narrative: {
      tried: "Stage 1 per-attack evaluation: 1000 flows (950 benign, 50 FTP-BruteForce) with a Tier-1 Random Forest pre-filter at 0.15 threshold. The RF filter routes obviously benign flows around the expensive LLM pipeline. Only 50 flows sent to LLM.",
      happened: "Tier-1 filter achieved 95% filter rate — only 50/1000 flows needed LLM analysis, reducing cost from an estimated $32.17 to $1.61 (20x savings). Perfect precision (0 FPs). Recall at 76% — 12 attacks missed by the filter or the LLM.",
      learned: "The Tier-1 RF pre-filter is transformative for cost. At 95% filter rate, 1000-flow batches cost $1.61 instead of $32. The filter-then-LLM architecture is the path to scalable evaluation.",
      nextId: null,
    },
  },
];

// Stage 1 running summary data
const STAGE1_SUMMARY = {
  experiments: [
    { attack_type: "FTP-BruteForce", status: "complete", recall: 100, fpr: 0, f1: 100, cost: 2.13, cost_per_tp: 0.04, confusion: { tp: 50, fp: 0, tn: 950, fn: 0 } },
    { attack_type: "SSH-Bruteforce", status: "complete", recall: 98, fpr: 0, f1: 99, cost: 2.16, cost_per_tp: 0.04, confusion: { tp: 49, fp: 0, tn: 950, fn: 1 } },
    { attack_type: "DDoS_attacks-LOIC-HTTP", status: "complete", recall: 82, fpr: 0, f1: 90, cost: 1.57, cost_per_tp: 0.04, confusion: { tp: 41, fp: 0, tn: 950, fn: 9 } },
    { attack_type: "DoS_attacks-Hulk", status: "complete", recall: 92, fpr: 0, f1: 96, cost: 2.17, cost_per_tp: 0.05, confusion: { tp: 46, fp: 0, tn: 950, fn: 4 } },
    { attack_type: "DoS_attacks-SlowHTTPTest", status: "complete", recall: 100, fpr: 0, f1: 100, cost: 2.12, cost_per_tp: 0.04, confusion: { tp: 50, fp: 0, tn: 950, fn: 0 } },
    { attack_type: "DoS_attacks-GoldenEye", status: "complete", recall: 92, fpr: 0, f1: 96, cost: 2.15, cost_per_tp: 0.05, confusion: { tp: 46, fp: 0, tn: 950, fn: 4 } },
    { attack_type: "DoS_attacks-Slowloris", status: "complete", recall: 100, fpr: 0, f1: 100, cost: 2.16, cost_per_tp: 0.04, confusion: { tp: 50, fp: 0, tn: 950, fn: 0 } },
    { attack_type: "DDOS_attack-HOIC", status: "complete", recall: 58, fpr: 0, f1: 72, cost: 1.79, cost_per_tp: 0.06, confusion: { tp: 29, fp: 1, tn: 949, fn: 21 } },
    { attack_type: "DDOS_attack-LOIC-UDP", status: "complete", recall: 100, fpr: 0, f1: 96, cost: 1.87, cost_per_tp: 0.04, confusion: { tp: 50, fp: 4, tn: 946, fn: 0 } },
    { attack_type: "Bot", status: "complete", recall: 82, fpr: 1, f1: 85, cost: 2.30, cost_per_tp: 0.06, confusion: { tp: 41, fp: 6, tn: 944, fn: 9 } },
    { attack_type: "Infilteration", status: "complete", recall: 0, fpr: 0, f1: 0, cost: 0.80, cost_per_tp: Infinity, confusion: { tp: 0, fp: 2, tn: 948, fn: 50 } },
    { attack_type: "Brute_Force_-Web", status: "complete", recall: 86, fpr: 0, f1: 89, cost: 2.05, cost_per_tp: 0.05, confusion: { tp: 43, fp: 4, tn: 946, fn: 7 } },
    { attack_type: "Brute_Force_-XSS", status: "complete", recall: 84, fpr: 0, f1: 89, cost: 2.09, cost_per_tp: 0.05, confusion: { tp: 42, fp: 2, tn: 948, fn: 8 } },
    { attack_type: "SQL_Injection", status: "complete", recall: 98, fpr: 0, f1: 96, cost: 1.99, cost_per_tp: 0.04, confusion: { tp: 49, fp: 3, tn: 947, fn: 1 } },
  ],
  overall: { best_f1: 100, total_flows: 14000, total_cost: 27.35, avg_fpr: 0 },
};

// Agent definitions
const AGENTS = [
  { id: "protocol", name: "Protocol", color: "#3b82f6", desc: "Validates protocol/port/flag consistency",
    prompt: `You are a network protocol analyst specializing in protocol validation.

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
   - If DNS_QUERY_ID > 0 but protocol is not UDP/port 53 → anomalous` },
  { id: "statistical", name: "Statistical", color: "#8b5cf6", desc: "Detects statistical anomalies in traffic features",
    prompt: `You are a network traffic statistician specializing in anomaly detection.

Your task: Analyze a single NetFlow record and identify statistical anomalies that may indicate malicious activity.

Examine the following statistical dimensions:

1. TRAFFIC VOLUME AND ASYMMETRY
   - IN_BYTES vs OUT_BYTES: Is the ratio reasonable for the protocol?
   - IN_PKTS vs OUT_PKTS: Are they balanced or heavily skewed?
   - Completely one-directional traffic can be suspicious

2. THROUGHPUT ANALYSIS
   - SRC_TO_DST_AVG_THROUGHPUT vs DST_TO_SRC_AVG_THROUGHPUT
   - Extremely high throughput on low-bandwidth services is anomalous

3. FLOW DURATION AND TIMING
   - Very short flows (0-1ms) with data may indicate scanning
   - Very long flows may indicate persistent connections (C2, tunneling)

4. PACKET SIZE DISTRIBUTION
   - High count of small packets may indicate scanning or C2 heartbeats
   - High count of max-size packets may indicate data transfer or flooding

5. INTER-ARRIVAL TIME (IAT)
   - Low StdDev = very regular timing (possibly automated)
   - Very uniform IAT can indicate automated/tool-generated traffic

6. RETRANSMISSION ANALYSIS
   - High retransmission rates indicate network issues or SYN flood

7. TCP WINDOW ANALYSIS
   - Window size 0 can indicate resource exhaustion attacks
   - Very small windows may indicate slowloris-type attacks` },
  { id: "behavioural", name: "Behavioural", color: "#f59e0b", desc: "Matches flow patterns against known attack signatures",
    prompt: `You are a cybersecurity threat analyst specializing in attack pattern recognition.

Your task: Analyze a single NetFlow record and determine if it matches known attack patterns. Map any detected attacks to MITRE ATT&CK techniques.

KNOWN ATTACK PATTERNS TO CHECK:

1. BRUTE FORCE (T1110)
   - Repeated connections to authentication ports (21=FTP, 22=SSH, 23=Telnet, 3389=RDP)
   - Small packet sizes, short flow durations, TCP RST flags

2. DENIAL OF SERVICE (T1498/T1499)
   - GoldenEye: HTTP flood with randomized headers
   - Slowloris: Partial HTTP requests, long-duration, very small TCP windows
   - SlowHTTPTest: Slow POST or slow read attacks
   - Hulk: Rapid HTTP GET/POST flood
   - LOIC-HTTP: High-volume HTTP flood
   - LOIC-UDP: UDP flood, high packet count
   - HOIC: HTTP flood with boosted traffic

3. DISTRIBUTED DENIAL OF SERVICE (T1498)
   - Extremely high packet rates or byte counts
   - UDP or TCP floods

4. WEB APPLICATION ATTACKS (T1190)
   - Brute Force Web, XSS, SQL Injection on HTTP ports

5. SCANNING AND RECONNAISSANCE (T1046)
   - SYN packets without completion, very short duration

6. BOTNET COMMUNICATION (T1071)
   - Periodic connections, consistent packet sizes (beaconing)

7. DATA EXFILTRATION (T1041)
   - Large outbound data transfers to unusual ports

8. INFILTRATION (T1071)
   - Lateral movement, internal-to-internal on unusual ports` },
  { id: "temporal", name: "Temporal", color: "#ec4899", desc: "Analyses cross-flow patterns from same source IP",
    prompt: `You are a network temporal pattern analyst specializing in detecting attack sequences.

Your task: Analyze a TARGET network flow in the context of ALL flows from the same source IP. Detect temporal patterns that indicate coordinated or sustained attacks.

TEMPORAL PATTERNS TO DETECT:

1. BURST ACTIVITY
   - Many flows from the same source IP in a short time window
   - Rapid-fire connections to the same destination port (brute force)
   - Multiple connections to different ports on the same host (port scan)

2. SEQUENTIAL ESCALATION
   - Reconnaissance followed by exploitation attempts
   - Initial probing followed by sustained connections

3. REPETITIVE PATTERNS
   - Same source→destination→port combination repeated (automated tool)
   - Uniform flow durations and packet sizes across flows
   - Regular timing intervals between flows (beaconing)

4. TARGET DIVERSITY
   - One source IP contacting many different destination IPs (scanning)
   - One source IP hitting many different ports (port sweep)

5. VOLUME CONTEXT
   - A single flow may look benign, but 50 similar flows from the same IP changes the picture
   - Compare the target flow's characteristics to the group's baseline

ANALYSIS APPROACH:
- First, summarize what you observe about the group of flows from this source IP
- Then, analyze the TARGET flow in that context
- Consider: Would this flow be suspicious on its own? Is it more or less suspicious given the group context?` },
  { id: "devils_advocate", name: "Devil's Advocate", color: "#ef4444", desc: "Argues for benign interpretation of every flow",
    prompt: `You are a devil's advocate analyst in a network intrusion detection system.

Your role: Given the analyses from 4 specialist agents, argue for the BENIGN interpretation of the network flow. Your job is to challenge the malicious assessments and find plausible innocent explanations.

You MUST argue for BENIGN even if you personally think the flow is malicious. This is a deliberate adversarial check to prevent false positives.

STRATEGIES FOR ARGUING BENIGN:

1. LEGITIMATE TRAFFIC PATTERNS
   - High-volume web traffic is normal for content delivery, streaming, backups
   - Many short connections are normal for REST APIs, health checks, monitoring
   - Connections to authentication ports happen constantly in enterprise networks

2. PROTOCOL EXPLANATIONS
   - Unusual flag combinations can result from middleboxes, NAT, or load balancers
   - Zero-length flows happen with connection resets, timeouts, or probes

3. TIMING AND VOLUME
   - Regular intervals are normal for monitoring, NTP, heartbeats, scheduled tasks
   - Bursts of traffic happen with batch processing, cron jobs, deployments

4. COMMON FALSE POSITIVE CAUSES
   - Internal scanning by vulnerability assessment tools is legitimate
   - Load balancer health checks generate many short connections
   - Database connection pools create burst patterns
   - CDN or proxy traffic can look like floods

For each specialist finding that says MALICIOUS or SUSPICIOUS, provide a specific, plausible alternative explanation.` },
  { id: "orchestrator", name: "Orchestrator", color: "#10b981", desc: "Synthesizes all analyses into weighted consensus verdict",
    prompt: `You are the lead orchestrator of a multi-agent Network Intrusion Detection System.

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

2. DEVIL'S ADVOCATE COUNTERWEIGHT (30% influence)
   - The DA argument carries 30% weight as a counterbalance to reduce false positives
   - Strong DA arguments should lower confidence or change verdict

3. CONSENSUS THRESHOLDS
   - 4/4 specialists MALICIOUS + weak DA → MALICIOUS (high confidence)
   - 3/4 specialists MALICIOUS + moderate DA → MALICIOUS (moderate confidence)
   - 3/4 specialists MALICIOUS + strong DA → SUSPICIOUS
   - 2/4 specialists MALICIOUS → carefully weigh evidence, likely SUSPICIOUS
   - 1/4 specialists MALICIOUS → likely BENIGN unless very strong evidence
   - 0/4 specialists MALICIOUS → BENIGN

4. CONFIDENCE CALIBRATION
   - Average the specialist confidence scores as a baseline
   - Increase if specialists agree and DA arguments are weak
   - Decrease if specialists disagree or DA raises valid concerns

5. ATTACK TYPE SELECTION
   - Use the most specific attack type from the specialist with highest confidence
   - Include MITRE ATT&CK technique IDs from the behavioural agent` },
];

// ── Dataset split metadata (from inventory.json) ──────────────────────────────
const DATASET_SPLITS = {
  development: {
    label: "Development", flows: 7040435, pct: 35,
    badge: "RF TRAINING DATA",
    attacks: {
      "FTP-BruteForce": 386720, "SSH-Bruteforce": 188474,
      "DDoS_attacks-LOIC-HTTP": 288589, "DoS_attacks-Hulk": 100076,
      "DoS_attacks-SlowHTTPTest": 105550, "DoS_attacks-GoldenEye": 61300,
      "DoS_attacks-Slowloris": 36040,
    },
  },
  validation: {
    label: "Validation", flows: 5028882, pct: 25,
    attacks: {
      "DDOS_attack-HOIC": 1032311, "DDOS_attack-LOIC-UDP": 3450,
      "Brute_Force_-Web": 1483, "Brute_Force_-XSS": 19, "SQL_Injection": 440,
    },
  },
  test: {
    label: "Test", flows: 8046212, pct: 40,
    attacks: {
      "Bot": 207703, "Infilteration": 188152,
      "Brute_Force_-Web": 135, "Brute_Force_-XSS": 461,
    },
  },
};

// Attack types in dev split → RF trained on these AND batches sourced from dev
// → within-split overlap on RF filtering (LLM metrics unaffected)
const RF_TRAINED_TYPES = new Set([
  "FTP-BruteForce", "SSH-Bruteforce", "DDoS_attacks-LOIC-HTTP",
  "DoS_attacks-Hulk", "DoS_attacks-SlowHTTPTest", "DoS_attacks-GoldenEye",
  "DoS_attacks-Slowloris",
]);

// Attack types RF catches despite not being in training (distinctive patterns)
const RF_CAUGHT_UNSEEN = new Set(["DDOS_attack-HOIC", "DDOS_attack-LOIC-UDP"]);

// Attack types NOT in dev split → RF never saw these → fully clean evaluation
const CLEAN_ATTACK_TYPES = new Set([
  "Bot", "Infilteration", "SQL_Injection", "Brute_Force_-Web", "Brute_Force_-XSS",
]);

// Pill color for each attack type based on RF relationship
const rfPillColor = (at) => {
  if (RF_TRAINED_TYPES.has(at)) return { bg: "#dcfce7", color: "#166534", label: "In training" };
  if (RF_CAUGHT_UNSEEN.has(at)) return { bg: "#fef3c7", color: "#92400e", label: "Caught unseen" };
  return { bg: "#fee2e2", color: "#991b1b", label: "RF misses" };
};

// Agent cost breakdown (calculated from 14 Stage 1 result files)
const AGENT_COST_DATA = {
  protocol: { cost: 2.64, pct: 9.7, color: "#3b82f6", label: "Protocol" },
  statistical: { cost: 2.75, pct: 10.1, color: "#8b5cf6", label: "Statistical" },
  behavioural: { cost: 2.85, pct: 10.4, color: "#f59e0b", label: "Behavioural" },
  temporal: { cost: 8.21, pct: 30.0, color: "#ec4899", label: "Temporal" },
  devils_advocate: { cost: 5.07, pct: 18.5, color: "#ef4444", label: "Devil's Advocate" },
  orchestrator: { cost: 5.83, pct: 21.3, color: "#10b981", label: "Orchestrator" },
  total: 27.35,
  totalLlmFlows: 758,
  totalFiltered: 13242,
  avgPerLlmFlow: 0.036,
  avgPerBatch: 1.95,
  estWithoutTier1: 509.78,
};

// Per-experiment agent cost breakdown (extracted from result JSONs)
const AGENT_COST_PER_EXPERIMENT = {
  "FTP-BruteForce": { protocol: 0.1767, statistical: 0.1790, behavioural: 0.1906, temporal: 0.8654, devils_advocate: 0.3307, orchestrator: 0.3911, total: 2.1335, llmFlows: 50, filtered: 950, estWithout: 42.67 },
  "SSH-Bruteforce": { protocol: 0.1790, statistical: 0.1833, behavioural: 0.1925, temporal: 0.8832, devils_advocate: 0.3330, orchestrator: 0.3880, total: 2.1590, llmFlows: 51, filtered: 949, estWithout: 42.33 },
  "DDoS_attacks-LOIC-HTTP": { protocol: 0.1769, statistical: 0.1850, behavioural: 0.1882, temporal: 0.2972, devils_advocate: 0.3327, orchestrator: 0.3856, total: 1.5657, llmFlows: 50, filtered: 950, estWithout: 31.31 },
  "DoS_attacks-Hulk": { protocol: 0.1785, statistical: 0.1794, behavioural: 0.1946, temporal: 0.8896, devils_advocate: 0.3355, orchestrator: 0.3885, total: 2.1662, llmFlows: 50, filtered: 950, estWithout: 43.32 },
  "DoS_attacks-SlowHTTPTest": { protocol: 0.1741, statistical: 0.1799, behavioural: 0.1876, temporal: 0.8625, devils_advocate: 0.3310, orchestrator: 0.3861, total: 2.1211, llmFlows: 50, filtered: 950, estWithout: 42.42 },
  "DoS_attacks-GoldenEye": { protocol: 0.1729, statistical: 0.1829, behavioural: 0.1896, temporal: 0.8842, devils_advocate: 0.3373, orchestrator: 0.3852, total: 2.1520, llmFlows: 50, filtered: 950, estWithout: 43.04 },
  "DoS_attacks-Slowloris": { protocol: 0.1732, statistical: 0.1877, behavioural: 0.1862, temporal: 0.8784, devils_advocate: 0.3432, orchestrator: 0.3954, total: 2.1641, llmFlows: 50, filtered: 950, estWithout: 43.28 },
  "DDOS_attack-HOIC": { protocol: 0.2069, statistical: 0.2072, behavioural: 0.2172, temporal: 0.3361, devils_advocate: 0.3817, orchestrator: 0.4434, total: 1.7925, llmFlows: 59, filtered: 941, estWithout: 30.38 },
  "DDOS_attack-LOIC-UDP": { protocol: 0.1980, statistical: 0.2255, behavioural: 0.2220, temporal: 0.3431, devils_advocate: 0.4188, orchestrator: 0.4671, total: 1.8746, llmFlows: 59, filtered: 941, estWithout: 31.77 },
  "Bot": { protocol: 0.2561, statistical: 0.2538, behavioural: 0.2731, temporal: 0.4870, devils_advocate: 0.4738, orchestrator: 0.5513, total: 2.2951, llmFlows: 73, filtered: 927, estWithout: 31.44 },
  "Infilteration": { protocol: 0.0870, statistical: 0.0893, behavioural: 0.0935, temporal: 0.1775, devils_advocate: 0.1675, orchestrator: 0.1891, total: 0.8038, llmFlows: 26, filtered: 974, estWithout: 30.91 },
  "Brute_Force_-Web": { protocol: 0.2333, statistical: 0.2449, behavioural: 0.2502, temporal: 0.3514, devils_advocate: 0.4533, orchestrator: 0.5133, total: 2.0464, llmFlows: 67, filtered: 933, estWithout: 30.54 },
  "Brute_Force_-XSS": { protocol: 0.2184, statistical: 0.2322, behavioural: 0.2342, temporal: 0.5005, devils_advocate: 0.4241, orchestrator: 0.4816, total: 2.0909, llmFlows: 63, filtered: 937, estWithout: 33.19 },
  "SQL_Injection": { protocol: 0.2107, statistical: 0.2213, behavioural: 0.2290, temporal: 0.4539, devils_advocate: 0.4063, orchestrator: 0.4680, total: 1.9892, llmFlows: 60, filtered: 940, estWithout: 33.15 },
};
const AGENT_KEYS = ["protocol", "statistical", "behavioural", "temporal", "devils_advocate", "orchestrator"];

// GitHub raw base URL for result files
const RESULTS_BASE = "https://raw.githubusercontent.com/kunw4r/LLM_NIDS/main/results";

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const pct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : "—";
const pctInt = (v) => v != null ? `${Math.round(v * 100)}%` : "—";
const dollar = (v) => v != null ? `$${v.toFixed(2)}` : "—";
const verdictColor = (v) => {
  if (!v) return "#94a3b8";
  const u = v.toUpperCase();
  if (u === "MALICIOUS") return "#dc2626";
  if (u === "SUSPICIOUS") return "#d97706";
  if (u === "BENIGN") return "#16a34a";
  return "#94a3b8";
};
const verdictBg = (v) => {
  if (!v) return "#f8fafc";
  const u = v.toUpperCase();
  if (u === "MALICIOUS") return "#fef2f2";
  if (u === "SUSPICIOUS") return "#fffbeb";
  if (u === "BENIGN") return "#f0fdf4";
  return "#f8fafc";
};
const correctColor = (correct) => correct ? "#16a34a" : "#dc2626";

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function NIDSDashboard() {
  // ── Navigation state ────────────────────────────────────────────────────────
  const [topTab, setTopTab] = useState("amatas");
  const [amatasTab, setAmatasTab] = useState("overview");
  const [mcpTab, setMcpTab] = useState("overview");
  const [expandedPrompts, setExpandedPrompts] = useState({});

  // ── Story state ─────────────────────────────────────────────────────────────
  const [storyExpId, setStoryExpId] = useState(EXPERIMENTS[0].id);

  // ── Flow Inspector state ────────────────────────────────────────────────────
  const [inspectorData, setInspectorData] = useState(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorError, setInspectorError] = useState(null);
  const [inspectorFilter, setInspectorFilter] = useState("all");
  const [selectedFlowIdx, setSelectedFlowIdx] = useState(null);
  const [inspectorPage, setInspectorPage] = useState(0);
  const FLOWS_PER_PAGE = 50;
  const [inspectorSource, setInspectorSource] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Comparison state ────────────────────────────────────────────────────────
  const [compCategory, setCompCategory] = useState("all");
  const [compSort, setCompSort] = useState({ key: "f1", dir: "desc" });

  // ── Live experiment panel state ────────────────────────────────────────────
  const [liveStatus, setLiveStatus] = useState(null);
  const [livePanelOpen, setLivePanelOpen] = useState(false);
  const [liveSummary, setLiveSummary] = useState(null);
  const [newResultNotif, setNewResultNotif] = useState(null);

  // ── Thesis tab state ──────────────────────────────────────────────────────
  const [thesisDrafts, setThesisDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [selectedDraftContent, setSelectedDraftContent] = useState(null);

  // ── Stage 1 expandable rows ──────────────────────────────────────────────
  const [expandedS1Rows, setExpandedS1Rows] = useState({});
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  // ── Leaky RF comparison state ─────────────────────────────────────────────
  const [leakySummary, setLeakySummary] = useState(null);

  // ── Data fetch timestamp ────────────────────────────────────────────────────
  const [lastFetched, setLastFetched] = useState(null);

  // ── Keyboard navigation for Story ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (topTab !== "amatas" || amatasTab !== "story") return;
      const idx = EXPERIMENTS.findIndex(x => x.id === storyExpId);
      if (e.key === "ArrowLeft" && idx > 0) {
        setStoryExpId(EXPERIMENTS[idx - 1].id);
      } else if (e.key === "ArrowRight" && idx < EXPERIMENTS.length - 1) {
        setStoryExpId(EXPERIMENTS[idx + 1].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [topTab, amatasTab, storyExpId]);

  // ── Fetch thesis drafts when tab opens ──────────────────────────────────────
  useEffect(() => {
    if (topTab !== "thesis" || thesisDrafts.length > 0) return;
    const fetchIndex = async () => {
      try {
        const resp = await fetch(`${RESULTS_BASE.replace("/results", "")}/results/thesis_drafts/INDEX.md?t=${Date.now()}`);
        if (!resp.ok) return;
        const text = await resp.text();
        const rows = text.split("\n").filter(l => l.startsWith("|") && !l.includes("---") && !l.includes("Attack Type"));
        const drafts = rows.map(row => {
          const cols = row.split("|").map(c => c.trim()).filter(Boolean);
          if (cols.length < 4) return null;
          const fileMatch = cols[1].match(/\[(.+?)\]\((.+?)\)/);
          return { attack_type: cols[0], file: fileMatch?.[2] || cols[1], words: parseInt(cols[2]) || 0, generated: cols[3] };
        }).filter(Boolean);
        if (drafts.length > 0) setThesisDrafts(drafts);
      } catch (_) {}
    };
    fetchIndex();
  }, [topTab, thesisDrafts.length]);

  // ── Poll live experiment status ─────────────────────────────────────────────
  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        let data;
        // Try local Flask first (3s timeout)
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const resp = await fetch("http://localhost:5001/api/status", { signal: controller.signal });
          clearTimeout(timeout);
          if (resp.ok) {
            const raw = await resp.json();
            data = raw.status || raw;
          }
        } catch (_) {
          // Fallback to GitHub raw
          const resp2 = await fetch(`${RESULTS_BASE}/stage1/live_status.json?t=${Date.now()}`);
          if (resp2.ok) data = await resp2.json();
        }
        if (data && (data.status === "running" || data.status === "paused" || data.status === "creating_batch")) {
          setLiveStatus(data);
        } else if (data && (data.status === "complete" || data.status === "all_done")) {
          // Only show "complete" banner if it was updated recently (< 10 min ago)
          const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
          const age = Date.now() - updatedAt;
          if (age < 10 * 60 * 1000) {
            setLiveStatus(data);
          } else {
            setLiveStatus(null);
          }
        } else {
          setLiveStatus(null);
        }
        // Also fetch running_summary.json for detailed experiment metrics
        try {
          const summResp = await fetch(`${RESULTS_BASE}/stage1/running_summary.json?t=${Date.now()}`);
          if (summResp.ok) {
            const newSumm = await summResp.json();
            setLiveSummary(prev => {
              // Detect newly completed experiments
              if (prev && newSumm.experiments && prev.experiments) {
                const prevTypes = new Set(prev.experiments.map(e => e.attack_type));
                const added = newSumm.experiments.filter(e => !prevTypes.has(e.attack_type));
                if (added.length > 0) {
                  const name = added[added.length - 1].attack_type;
                  const recall = added[added.length - 1].recall;
                  setNewResultNotif(`New result: ${name} — ${recall}% recall`);
                  setTimeout(() => setNewResultNotif(null), 5000);
                }
              }
              return newSumm;
            });
          }
        } catch (_) {}
        // Fetch leaky summary for comparison (one-time, not polled)
        if (!leakySummary) {
          try {
            const leakyResp = await fetch(`${RESULTS_BASE}/stage1/running_summary_leaky.json?t=${Date.now()}`);
            if (leakyResp.ok) {
              const leakyData = await leakyResp.json();
              setLeakySummary(leakyData);
            }
          } catch (_) {}
        }
      } catch (_) {
        setLiveStatus(null);
      }
    };
    poll();
    timer = setInterval(poll, 15000);
    return () => clearInterval(timer);
  }, []);

  // ── Load flow inspector data ────────────────────────────────────────────────
  const loadInspectorData = useCallback(async (sourceId) => {
    setInspectorLoading(true);
    setInspectorError(null);
    setSelectedFlowIdx(null);
    try {
      const fileMap = {
        baseline: "/results/final_mcp_evaluation_raw.json",
        iter_1: "/results/phase2_iter1_results.json",
        phase3a: "/results/phase3a_mini_results.json",
        phase3b: "/results/phase3b_full_results.json",
        phase3c: "/results/phase3c_medium_batch_100_results.json",
        phase3e: "/results/phase3e_da_tuned_results.json",
        batch3_stealthy: "/results/scaled/batch_3_stealthy_full_results.json",
        sonnet_20: "/results/scaled/batch1_sonnet_20_test.json",
        haiku_20: "/results/scaled/batch1_haiku_20_test.json",
        hybrid_20: "/results/scaled/batch1_hybrid_gpt4omini_20_test.json",
        gpt4omini_20: "/results/scaled/batch1_allgpt4omini_20_test.json",
        gpt4omini_1000: "/results/scaled/batch_3_stealthy_gpt4omini_results.json",
        stage1_ftp: "/results/stage1/FTP-BruteForce_results.json",
        stage1_ssh: "/results/stage1/SSH-Bruteforce_results.json",
        stage1_loic_http: "/results/stage1/DDoS_attacks-LOIC-HTTP_results.json",
        stage1_hulk: "/results/stage1/DoS_attacks-Hulk_results.json",
        stage1_slowhttp: "/results/stage1/DoS_attacks-SlowHTTPTest_results.json",
        stage1_goldeneye: "/results/stage1/DoS_attacks-GoldenEye_results.json",
        stage1_slowloris: "/results/stage1/DoS_attacks-Slowloris_results.json",
        stage1_hoic: "/results/stage1/DDOS_attack-HOIC_results.json",
        stage1_loic_udp: "/results/stage1/DDOS_attack-LOIC-UDP_results.json",
        stage1_bot: "/results/stage1/Bot_results.json",
        stage1_infilteration: "/results/stage1/Infilteration_results.json",
        stage1_web: "/results/stage1/Brute_Force_-Web_results.json",
        stage1_xss: "/results/stage1/Brute_Force_-XSS_results.json",
        stage1_sql: "/results/stage1/SQL_Injection_results.json",
      };
      const path = fileMap[sourceId];
      if (!path) { setInspectorError("No flow data available for this experiment"); setInspectorLoading(false); return; }
      const url = `${RESULTS_BASE.replace("/results", "")}${path}?t=${Date.now()}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setInspectorData(data);
      setLastFetched(new Date());
    } catch (err) {
      setInspectorError(err.message);
      // Try local fallback
      try {
        const localMap = Object.fromEntries(
          Object.entries(fileMap).map(([k, v]) => [k, "." + v])
        );
        const resp2 = await fetch(localMap[sourceId]);
        if (resp2.ok) {
          const data = await resp2.json();
          setInspectorData(data);
          setInspectorError(null);
          setLastFetched(new Date());
        }
      } catch (_) { /* local also failed */ }
    }
    setInspectorLoading(false);
  }, []);

  // ── Open experiment detail (from Story / Comparison) ──────────────────
  const openExperimentDetail = useCallback((expId) => {
    setTopTab("amatas");
    setAmatasTab("inspector");
    setInspectorSource(expId);
    loadInspectorData(expId);
  }, [loadInspectorData]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const storyExp = EXPERIMENTS.find(x => x.id === storyExpId) || EXPERIMENTS[0];
  const storyIdx = EXPERIMENTS.findIndex(x => x.id === storyExpId);

  // Merge hardcoded STAGE1_SUMMARY with live data from running_summary.json
  const s1 = (() => {
    const base = STAGE1_SUMMARY;
    if (!liveSummary?.experiments?.length) return base;
    // Use liveSummary if it has more experiments (it's the live source of truth)
    const merged = liveSummary.experiments.length >= base.experiments.length ? liveSummary : base;
    const exps = merged.experiments || [];
    const totalFlows = exps.length * 1000;
    const totalCost = exps.reduce((s, e) => s + (e.cost || 0), 0);
    const bestExp = exps.reduce((best, e) => (e.f1 || 0) > (best.f1 || 0) ? e : best, exps[0] || {});
    const avgFpr = exps.length > 0 ? exps.reduce((s, e) => s + (e.fpr || 0), 0) / exps.length : 0;
    return {
      experiments: exps,
      overall: {
        best_f1: bestExp?.f1 || 0,
        best_detected: bestExp?.attack_type || "",
        total_flows: totalFlows,
        total_cost: totalCost,
        avg_fpr: avgFpr,
      },
    };
  })();

  const bestF1 = Math.max(...EXPERIMENTS.map(e => e.f1));
  const earlyFlows = EXPERIMENTS.reduce((s, e) => s + e.flows, 0);
  const earlyCost = EXPERIMENTS.reduce((s, e) => s + e.cost, 0);
  const totalFlows = earlyFlows + s1.overall.total_flows;
  const totalCost = earlyCost + s1.overall.total_cost;

  // Inspector derived
  const inspectorFlows = inspectorData?.results || [];
  const filteredInspectorFlows = inspectorFlows.filter(f => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchIdx = String(f.flow_idx).includes(q);
      const matchVerdict = (f.verdict || "").toLowerCase().includes(q);
      const matchAttack = (f.attack_type_actual || "").toLowerCase().includes(q);
      if (!matchIdx && !matchVerdict && !matchAttack) return false;
    }
    if (inspectorFilter === "all") return true;
    if (inspectorFilter === "correct") {
      const actual = f.label_actual;
      const predicted = f.verdict?.toUpperCase() === "BENIGN" ? 0 : 1;
      return actual === predicted;
    }
    if (inspectorFilter === "wrong") {
      const actual = f.label_actual;
      const predicted = f.verdict?.toUpperCase() === "BENIGN" ? 0 : 1;
      return actual !== predicted;
    }
    if (inspectorFilter === "filtered") return f.tier1_filtered === true;
    if (inspectorFilter === "attacks") return f.label_actual === 1;
    if (inspectorFilter === "benign_actual") return f.label_actual === 0;
    if (inspectorFilter === "malicious") return f.verdict?.toUpperCase() === "MALICIOUS";
    if (inspectorFilter === "suspicious") return f.verdict?.toUpperCase() === "SUSPICIOUS";
    if (inspectorFilter === "benign") return f.verdict?.toUpperCase() === "BENIGN";
    return true;
  });
  const selectedFlow = selectedFlowIdx != null ? inspectorFlows.find(f => f.flow_idx === selectedFlowIdx) : null;

  // Comparison data
  const compExps = EXPERIMENTS.filter(e => {
    if (compCategory === "all") return true;
    if (compCategory === "amatas") return e.phaseGroup.includes("Phase 3") || e.phaseGroup.includes("Phase 4") || e.phaseGroup.includes("Stage 1");
    if (compCategory === "mcp") return e.phaseGroup.includes("Phase 1") || e.phaseGroup.includes("Phase 2");
    return true;
  }).sort((a, b) => {
    const av = a[compSort.key] ?? 0;
    const bv = b[compSort.key] ?? 0;
    return compSort.dir === "desc" ? bv - av : av - bv;
  });

  // Phase groups for story sidebar
  const phaseGroups = [];
  let lastGroup = null;
  EXPERIMENTS.forEach(exp => {
    if (exp.phaseGroup !== lastGroup) {
      phaseGroups.push({ label: exp.phaseGroup, experiments: [] });
      lastGroup = exp.phaseGroup;
    }
    phaseGroups[phaseGroups.length - 1].experiments.push(exp);
  });

  // Pie counts for inspector — count by verdict (including filtered as BENIGN)
  const pieCounts = {
    malicious: inspectorFlows.filter(f => f.verdict?.toUpperCase() === "MALICIOUS").length,
    suspicious: inspectorFlows.filter(f => f.verdict?.toUpperCase() === "SUSPICIOUS").length,
    benign: inspectorFlows.filter(f => f.verdict?.toUpperCase() === "BENIGN").length,
    filtered: inspectorFlows.filter(f => f.tier1_filtered).length,
  };
  const pieTotal = inspectorFlows.length || 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: "#1a1a1a", background: "#fff", minHeight: "100vh", position: "relative" }}>

      {/* ── NEW RESULT NOTIFICATION TOAST ───────────────────────────────────── */}
      {newResultNotif && (
        <div style={{
          position: "fixed", top: 16, right: 16, zIndex: 1000,
          background: "#166534", color: "#fff", padding: "10px 20px",
          borderRadius: 8, fontSize: 13, fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          animation: "slideIn 0.3s ease-out",
        }}>
          {newResultNotif}
        </div>
      )}
      <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }`}</style>

      {/* ── LIVE EXPERIMENT BANNER ──────────────────────────────────────────── */}
      {liveStatus && (() => {
        const completed = liveStatus.experiments_completed || [];
        const queued = liveStatus.experiments_queued || [];
        const totalExperiments = completed.length + queued.length + (liveStatus.status === "all_done" ? 0 : 1);
        const pctOverall = totalExperiments > 0 ? Math.round((completed.length / totalExperiments) * 100) : 0;
        const totalCost = liveStatus.total_cost_so_far || 0;
        const summaryExperiments = liveSummary?.experiments || [];
        const summaryMap = Object.fromEntries(summaryExperiments.map(e => [e.attack_type, e]));
        // Compute running totals from summary
        const totalTP = summaryExperiments.reduce((s, e) => s + (e.confusion?.tp || 0), 0);
        const totalFN = summaryExperiments.reduce((s, e) => s + (e.confusion?.fn || 0), 0);
        const totalFP = summaryExperiments.reduce((s, e) => s + (e.confusion?.fp || 0), 0);
        const totalTN = summaryExperiments.reduce((s, e) => s + (e.confusion?.tn || 0), 0);
        const isRunning = liveStatus.status === "running" || liveStatus.status === "creating_batch";
        const isDone = liveStatus.status === "all_done";

        return (
        <div style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe" }}>
          {/* Clickable banner bar */}
          <div
            onClick={() => setLivePanelOpen(p => !p)}
            style={{ padding: "10px 32px", cursor: "pointer", userSelect: "none" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, maxWidth: 1200, margin: "0 auto" }}>
              {/* Pulsing dot */}
              <div style={{ position: "relative", width: 10, height: 10, flexShrink: 0 }}>
                <div style={{ position: "absolute", width: 10, height: 10, borderRadius: "50%", background: isDone ? "#16a34a" : liveStatus.status === "paused" ? "#d97706" : "#2563eb", animation: isRunning ? "pulse 2s ease-in-out infinite" : "none" }} />
              </div>
              {/* Experiment name + progress count */}
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", minWidth: 180 }}>
                {isDone ? "Stage 1 Complete" : liveStatus.current_experiment || "Experiment"}
                <span style={{ fontWeight: 400, color: "#3b82f6", marginLeft: 8 }}>
                  ({completed.length}/{totalExperiments})
                </span>
              </div>
              {/* Progress bar */}
              <div style={{ flex: 1, height: 6, background: "#dbeafe", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pctOverall}%`, height: "100%", background: isDone ? "#16a34a" : "#2563eb", borderRadius: 3, transition: "width 0.5s ease" }} />
              </div>
              <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 500, minWidth: 40 }}>
                {pctOverall}%
              </span>
              {/* Cost */}
              <span style={{ fontSize: 12, color: "#6b7280", minWidth: 70 }}>
                ${totalCost.toFixed(2)}
              </span>
              {/* Status badge */}
              <span style={{
                padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                background: isDone ? "#dcfce7" : liveStatus.status === "paused" ? "#fef3c7" : "#dbeafe",
                color: isDone ? "#166534" : liveStatus.status === "paused" ? "#92400e" : "#1e40af",
              }}>
                {isDone ? "COMPLETE" : liveStatus.status === "paused" ? "PAUSED" : "RUNNING"}
              </span>
              {/* Chevron */}
              <span style={{ fontSize: 12, color: "#6b7280", transition: "transform 0.2s", transform: livePanelOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                ▼
              </span>
            </div>
          </div>

          {/* Expanded panel */}
          {livePanelOpen && (
            <div style={{ padding: "0 32px 16px", maxWidth: 1200, margin: "0 auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12 }}>

                {/* Left column: Experiment Queue */}
                <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", padding: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Experiment Queue</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {/* Completed experiments */}
                    {completed.map((name, i) => {
                      const m = summaryMap[name];
                      return (
                        <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 4, background: "#f0fdf4" }}>
                          <span style={{ color: "#16a34a", fontSize: 13, width: 16 }}>&#10003;</span>
                          <span style={{ flex: 1, color: "#166534", fontWeight: 500 }}>{name}</span>
                          {m && (
                            <span style={{ color: "#6b7280", fontSize: 11 }}>
                              {m.recall}% recall &middot; ${m.cost?.toFixed(2)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {/* Current experiment */}
                    {!isDone && liveStatus.current_experiment && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 4, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                        <span style={{ color: "#2563eb", fontSize: 13, width: 16, animation: "pulse 2s ease-in-out infinite" }}>&#9654;</span>
                        <span style={{ flex: 1, color: "#1e40af", fontWeight: 600 }}>{liveStatus.current_experiment}</span>
                        <span style={{ color: "#3b82f6", fontSize: 11 }}>running</span>
                      </div>
                    )}
                    {/* Queued experiments */}
                    {queued.map((name) => (
                      <div key={name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", borderRadius: 4, color: "#9ca3af" }}>
                        <span style={{ width: 16, textAlign: "center" }}>&middot;</span>
                        <span style={{ flex: 1 }}>{name}</span>
                        <span style={{ fontSize: 11 }}>queued</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right column: Running Totals + Last Result */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Running totals */}
                  <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", padding: 12 }}>
                    <div style={{ fontWeight: 600, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Running Totals</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ background: "#f0fdf4", borderRadius: 6, padding: "8px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#166534" }}>{totalTP + totalFN > 0 ? Math.round(totalTP / (totalTP + totalFN) * 100) : 0}%</div>
                        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>Recall ({totalTP}/{totalTP + totalFN} detected)</div>
                      </div>
                      <div style={{ background: totalFP > 0 ? "#fef2f2" : "#f0fdf4", borderRadius: 6, padding: "8px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: totalFP > 0 ? "#991b1b" : "#166534" }}>{totalFP + totalTN > 0 ? ((totalFP / (totalFP + totalTN)) * 100).toFixed(1) : 0}%</div>
                        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>FPR ({totalFP}/{totalFP + totalTN} flagged)</div>
                      </div>
                      <div style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#1e40af" }}>{summaryExperiments.length > 0 ? Math.round(summaryExperiments.reduce((s, e) => s + (e.f1 || 0), 0) / summaryExperiments.length) : 0}%</div>
                        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>Avg F1 across {summaryExperiments.length} experiments</div>
                      </div>
                      <div style={{ background: "#f8fafc", borderRadius: 6, padding: "8px 12px", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: "#6b7280" }}>${totalCost.toFixed(2)}</div>
                        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>Total cost ({completed.length * 1000} flows)</div>
                      </div>
                    </div>
                  </div>

                  {/* Last completed result */}
                  {liveStatus.last_result && (
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", padding: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Last Completed</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontWeight: 600, color: "#1a1a1a" }}>{liveStatus.last_result.attack_type}</span>
                        <span style={{ color: "#16a34a", fontWeight: 500 }}>{liveStatus.last_result.recall}% recall</span>
                        <span style={{ color: "#3b82f6" }}>F1: {liveStatus.last_result.f1}%</span>
                        <span style={{ color: "#6b7280" }}>${liveStatus.last_result.cost?.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Best / Hardest */}
                  {liveSummary?.overall && (
                    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", padding: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Highlights</div>
                      <div style={{ display: "flex", gap: 16 }}>
                        <div>
                          <span style={{ color: "#6b7280" }}>Best: </span>
                          <span style={{ fontWeight: 600, color: "#166534" }}>{liveSummary.overall.best_detected}</span>
                          <span style={{ color: "#16a34a", marginLeft: 4 }}>{liveSummary.overall.best_recall}% recall</span>
                        </div>
                        <div>
                          <span style={{ color: "#6b7280" }}>Hardest: </span>
                          <span style={{ fontWeight: 600, color: "#991b1b" }}>{liveSummary.overall.hardest}</span>
                          <span style={{ color: "#dc2626", marginLeft: 4 }}>{liveSummary.overall.hardest_recall}% recall</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pulse animation */}
          <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
        </div>
        );
      })()}

      {/* ── TOP HEADER ─────────────────────────────────────────────────────── */}
      <header style={{ borderBottom: "1px solid #e5e7eb", padding: "16px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 28, height: 28, flexShrink: 0 }}>
          <path d="M16 2L4 8v8c0 7.2 5.12 13.92 12 16 6.88-2.08 12-8.8 12-16V8L16 2z" fill="#0f172a"/>
          <path d="M16 5L7 9.5v7c0 6 4.2 11.6 9 13.5 4.8-1.9 9-7.5 9-13.5v-7L16 5z" fill="#1e293b"/>
          <circle cx="11" cy="13" r="2" fill="#3b82f6"/><circle cx="21" cy="13" r="2" fill="#8b5cf6"/>
          <circle cx="11" cy="19.5" r="2" fill="#f59e0b"/><circle cx="21" cy="19.5" r="2" fill="#ec4899"/>
          <circle cx="16" cy="16.2" r="1.8" fill="#ef4444"/>
          <circle cx="16" cy="24" r="2.2" fill="#10b981"/>
          <line x1="11" y1="13" x2="16" y2="16.2" stroke="#3b82f6" strokeWidth="0.7" opacity="0.6"/>
          <line x1="21" y1="13" x2="16" y2="16.2" stroke="#8b5cf6" strokeWidth="0.7" opacity="0.6"/>
          <line x1="11" y1="19.5" x2="16" y2="16.2" stroke="#f59e0b" strokeWidth="0.7" opacity="0.6"/>
          <line x1="21" y1="19.5" x2="16" y2="16.2" stroke="#ec4899" strokeWidth="0.7" opacity="0.6"/>
          <line x1="16" y1="16.2" x2="16" y2="24" stroke="#ef4444" strokeWidth="0.7" opacity="0.6"/>
          <circle cx="16" cy="24" r="1" fill="#34d399"/>
        </svg>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>AMATAS</h1>
        <span style={{ fontSize: 13, color: "#6b7280" }}>Autonomous Multi-Agent Threat Analysis System</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
          CICIDS2018 NetFlow v3 &middot; {EXPERIMENTS.length} experiments
        </span>
      </header>

      {/* ── TOP TABS ───────────────────────────────────────────────────────── */}
      <nav style={{ borderBottom: "1px solid #e5e7eb", padding: "0 32px", display: "flex", gap: 0 }}>
        {[
          ["amatas", "AMATAS"],
          ["mcp", "MCP Experiments"],
          ["clustering", "Clustering"],
          ["comparison", "Comparison"],
          ["architecture", "Architecture"],
          ["thesis", "Thesis Drafts"],
          ["next", "What's Next"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTopTab(id)} style={{
            padding: "12px 20px", fontSize: 13, fontWeight: topTab === id ? 600 : 400,
            color: topTab === id ? "#2563eb" : "#6b7280", background: "none", border: "none",
            borderBottom: topTab === id ? "2px solid #2563eb" : "2px solid transparent",
            cursor: "pointer", transition: "all 0.15s",
          }}>
            {label}
          </button>
        ))}
      </nav>

      {/* ── AMATAS SUB-NAV ─────────────────────────────────────────────────── */}
      {topTab === "amatas" && (
        <nav style={{ borderBottom: "1px solid #e5e7eb", padding: "0 32px", display: "flex", gap: 0, background: "#fafafa" }}>
          {[
            ["overview", "Overview"],
            ["story", "The Story"],
            ["stage1", "Stage 1"],
            ["howitworks", "How It Runs"],
            ["inspector", "Flow Inspector"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setAmatasTab(id)} style={{
              padding: "10px 16px", fontSize: 12, fontWeight: amatasTab === id ? 600 : 400,
              color: amatasTab === id ? "#2563eb" : "#6b7280", background: "none", border: "none",
              borderBottom: amatasTab === id ? "2px solid #2563eb" : "2px solid transparent",
              cursor: "pointer",
            }}>
              {label}
            </button>
          ))}
        </nav>
      )}

      {/* ── MCP SUB-NAV ────────────────────────────────────────────────────── */}
      {topTab === "mcp" && (
        <nav style={{ borderBottom: "1px solid #e5e7eb", padding: "0 32px", display: "flex", gap: 0, background: "#fafafa" }}>
          {[
            ["overview", "Overview"],
            ["results", "Test Results"],
            ["comparison", "Comparison"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setMcpTab(id)} style={{
              padding: "10px 16px", fontSize: 12, fontWeight: mcpTab === id ? 600 : 400,
              color: mcpTab === id ? "#2563eb" : "#6b7280", background: "none", border: "none",
              borderBottom: mcpTab === id ? "2px solid #2563eb" : "2px solid transparent",
              cursor: "pointer",
            }}>
              {label}
            </button>
          ))}
        </nav>
      )}

      {/* ── CONTENT ────────────────────────────────────────────────────────── */}
      <main style={{ padding: "32px", maxWidth: 1200, margin: "0 auto" }}>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* AMATAS — OVERVIEW                                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {topTab === "amatas" && amatasTab === "overview" && (
          <div>
            {/* ── WHAT THIS SYSTEM DOES ─────────────────────────────────── */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.02em" }}>What This System Does</h2>
              <div style={{ fontSize: 14, lineHeight: 1.8, color: "#374151", maxWidth: 800 }}>
                <p style={{ marginBottom: 16 }}>
                  AMATAS is a multi-agent LLM system for network intrusion detection. Unlike traditional ML approaches
                  which produce a binary flag with no explanation, AMATAS uses 6 specialised agents that each analyse
                  a network flow from a different perspective and produce human-readable reasoning for every decision.
                </p>
                <p style={{ marginBottom: 16 }}>
                  The system was evaluated on CICIDS2018 NetFlow v3 across 14 attack types at realistic 5% attack
                  prevalence — 950 benign flows and 50 attack flows per batch. A Random Forest pre-filter routes obvious
                  benign traffic around the expensive LLM pipeline, reducing cost by 95%.
                </p>
                <p style={{ marginBottom: 0 }}>
                  AMATAS v2 achieved {(() => { const totalFP = s1.experiments.reduce((s, e) => s + (e.confusion?.fp || 0), 0); const totalTN = s1.experiments.reduce((s, e) => s + (e.confusion?.tn || 0), 0); return ((totalFP / (totalFP + totalTN)) * 100).toFixed(1); })()}% false positive rate across {s1.experiments.reduce((s, e) => s + (e.confusion?.tn || 0) + (e.confusion?.fp || 0), 0).toLocaleString()} benign flows while detecting {(() => { const exps = s1.experiments.filter(e => e.recall > 0); return exps.length > 0 ? Math.round(exps.reduce((s, e) => s + (e.recall || 0), 0) / exps.length) : 0; })()}% of attacks on average. {s1.experiments.filter(e => (e.recall || 0) >= 82).length} of 14 attack types were detected at 82%+ recall. Total evaluation cost: {dollar(s1.overall.total_cost)}.
                </p>
              </div>
            </div>

            {/* ── MCP CALLOUT BOX ──────────────────────────────────────── */}
            <div style={{ border: "1px solid #93c5fd", borderRadius: 8, padding: "20px 24px", background: "#eff6ff", marginBottom: 32 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 10 }}>About MCP in this system</div>
              <div style={{ fontSize: 13, color: "#1e3a5f", lineHeight: 1.7 }}>
                <p style={{ marginBottom: 10 }}>
                  AMATAS does <strong>not</strong> use MCP tools for detection. The 6 agents reason purely from network flow
                  features using their pre-trained knowledge.
                </p>
                <p style={{ marginBottom: 10 }}>
                  MCP was evaluated separately (see MCP tab) and found to provide minimal uplift on this dataset — external
                  threat intel tools return no useful data on private/anonymised IPs.
                </p>
                <p style={{ margin: 0 }}>
                  The multi-agent architecture itself is the contribution — specialised roles + adversarial checking
                  outperforms any single-agent configuration.
                </p>
              </div>
            </div>

            {/* ── HERO NUMBERS ─────────────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Stage 1 Best F1", value: `${s1.overall.best_f1 || Math.round(bestF1 * 100)}%`, sub: s1.overall.best_detected || "—" },
                { label: "Stage 1 Flows", value: s1.overall.total_flows.toLocaleString(), sub: `${s1.experiments.length} x 1,000-flow batches` },
                { label: "Stage 1 Cost", value: dollar(s1.overall.total_cost), sub: `$${s1.overall.total_cost > 0 ? (s1.overall.total_cost / s1.experiments.length).toFixed(2) : '0'}/batch avg` },
                { label: "Stage 1 Coverage", value: `${s1.experiments.length} / 14`, sub: s1.experiments.length >= 14 ? "All attack types evaluated" : "Attack types evaluated" },
              ].map(h => (
                <div key={h.label} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "24px" }}>
                  <div style={{ fontSize: 36, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{h.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginTop: 4 }}>{h.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{h.sub}</div>
                </div>
              ))}
            </div>

            {/* ── KEY FINDINGS ──────────────────────────────────────────── */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "24px", marginBottom: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, letterSpacing: "-0.02em" }}>Key Findings</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Finding 1 */}
                <div style={{ borderLeft: "3px solid #16a34a", paddingLeft: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>1. Multi-agent beats single-agent</div>
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                    AMATAS v2 achieved {Math.round(s1.experiments.reduce((s, e) => s + (e.f1 || 0), 0) / s1.experiments.length)}% avg F1 vs 62.8% for the best single-agent configuration (zero-shot GPT-4o-mini).
                    The gap comes from specialised roles + adversarial checking — the Devil's Advocate reduced FPR from
                    41% (single agent) to {s1.overall.avg_fpr.toFixed(1)}% (AMATAS).
                  </div>
                </div>
                {/* Finding 2 */}
                <div style={{ borderLeft: "3px solid #8b5cf6", paddingLeft: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>2. External tools provide minimal uplift</div>
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                    Adding MITRE ATT&CK tool access to a single agent improved recall by only 3.3% at +$0.09 cost.
                    External threat intelligence is ineffective on anonymised dataset IPs.
                  </div>
                </div>
                {/* Finding 3 — Cost */}
                <div style={{ borderLeft: "3px solid #2563eb", paddingLeft: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>3. Cost reduction via ML pre-filter</div>
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: 12 }}>
                    The Tier 1 RF pre-filter reduced per-batch LLM cost from ~${(AGENT_COST_DATA.estWithoutTier1 / 14).toFixed(0)} to ~${AGENT_COST_DATA.avgPerBatch.toFixed(2)} (95% reduction)
                    by routing obviously benign traffic around the LLM pipeline.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    <div style={{ textAlign: "center", padding: "12px", background: "#f0fdf4", borderRadius: 8 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#166534" }}>${AGENT_COST_DATA.avgPerBatch.toFixed(2)}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>avg per 1,000-flow batch</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "12px", background: "#fef2f2", borderRadius: 8 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#991b1b" }}>${(AGENT_COST_DATA.estWithoutTier1 / 14).toFixed(0)}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>estimated without Tier 1</div>
                    </div>
                    <div style={{ textAlign: "center", padding: "12px", background: "#eff6ff", borderRadius: 8 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "#1e40af" }}>95%</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>cost reduction</div>
                    </div>
                  </div>
                  {/* Mini agent cost bar */}
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Agent cost distribution</div>
                    <div style={{ display: "flex", height: 16, borderRadius: 4, overflow: "hidden" }}>
                      {["protocol", "statistical", "behavioural", "temporal", "devils_advocate", "orchestrator"].map(a => (
                        <div key={a} style={{ width: `${AGENT_COST_DATA[a].pct}%`, background: AGENT_COST_DATA[a].color, position: "relative" }}
                          title={`${AGENT_COST_DATA[a].label}: ${AGENT_COST_DATA[a].pct}%`} />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 6, flexWrap: "wrap" }}>
                      {["temporal", "orchestrator", "devils_advocate", "behavioural", "statistical", "protocol"].map(a => (
                        <span key={a} style={{ fontSize: 10, color: "#6b7280", display: "flex", alignItems: "center", gap: 3 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: AGENT_COST_DATA[a].color, display: "inline-block" }} />
                          {AGENT_COST_DATA[a].label} {AGENT_COST_DATA[a].pct}%
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Finding 4 */}
                <div style={{ borderLeft: "3px solid #dc2626", paddingLeft: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>4. Infiltration: flow-level limitation</div>
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                    Infiltration attacks (DNS exfiltration) achieved 0% recall. Individual flows are statistically
                    identical to legitimate DNS queries — undetectable at the NetFlow feature level without temporal
                    clustering. This motivates the v3 clustering contribution.
                  </div>
                </div>
                {/* Finding 5 */}
                <div style={{ borderLeft: "3px solid #f59e0b", paddingLeft: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>5. Explainability advantage</div>
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                    Every detection includes full agent reasoning, connected flow evidence, and attack classification.
                    Click any flow in the Flow Inspector to see exactly why it was flagged — impossible with traditional ML.
                  </div>
                </div>
              </div>
            </div>

            {/* ── Architecture diagram ─────────────────────────────────── */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "32px", marginBottom: 32 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 24, color: "#1a1a1a" }}>Architecture</h3>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontFamily: "monospace", fontSize: 13 }}>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 24px", background: "#f9fafb" }}>Network Flow (53 features)</div>
                <div style={{ color: "#9ca3af" }}>&#8595;</div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ border: "2px solid #2563eb", borderRadius: 8, padding: "10px 20px", color: "#2563eb", fontWeight: 600 }}>Tier 1 RF Filter</div>
                  <div style={{ color: "#9ca3af" }}>&#8594;</div>
                  <div style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 20px", color: "#6b7280", background: "#f0fdf4" }}>BENIGN — filtered (95%)</div>
                </div>
                <div style={{ color: "#9ca3af" }}>&#8595; 5% flagged</div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px 24px", display: "flex", gap: 12 }}>
                  {["Protocol", "Statistical", "Behavioural", "Temporal"].map(a => (
                    <div key={a} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 500 }}>{a}</div>
                  ))}
                </div>
                <div style={{ color: "#9ca3af" }}>&#8595;</div>
                <div style={{ border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 20px", color: "#dc2626", fontWeight: 500 }}>Devil's Advocate</div>
                <div style={{ color: "#9ca3af" }}>&#8595;</div>
                <div style={{ border: "2px solid #2563eb", borderRadius: 8, padding: "10px 20px", color: "#2563eb", fontWeight: 600 }}>Orchestrator</div>
                <div style={{ color: "#9ca3af" }}>&#8595;</div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 24px", background: "#f9fafb", fontWeight: 500 }}>MALICIOUS / BENIGN + Attack Type + Reasoning</div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* AMATAS — THE STORY                                                 */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {topTab === "amatas" && amatasTab === "story" && (
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 32, minHeight: "70vh" }}>
            {/* Left sidebar */}
            <div style={{ borderRight: "1px solid #e5e7eb", paddingRight: 24 }}>
              {phaseGroups.map(group => (
                <div key={group.label} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    {group.label}
                  </div>
                  {group.experiments.map(exp => (
                    <button key={exp.id} onClick={() => setStoryExpId(exp.id)} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      width: "100%", padding: "8px 12px", marginBottom: 2, border: "none",
                      borderRadius: 6, cursor: "pointer", textAlign: "left", fontSize: 13,
                      background: storyExpId === exp.id ? "#eff6ff" : "transparent",
                      color: storyExpId === exp.id ? "#2563eb" : "#374151",
                      fontWeight: storyExpId === exp.id ? 600 : 400,
                    }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{exp.name}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>F1 {pctInt(exp.f1)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Right content */}
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{storyExp.phase}</span>
                <span style={{ fontSize: 11, color: "#d1d5db" }}>&middot;</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{storyExp.date}</span>
                <span style={{ fontSize: 11, color: "#d1d5db" }}>&middot;</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{storyExp.model}</span>
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, letterSpacing: "-0.02em" }}>{storyExp.name}</h2>

              {/* WHAT WE TRIED */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8 }}>What we tried</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "#374151" }}>{storyExp.narrative.tried}</p>
              </div>

              {/* WHAT HAPPENED — Key metrics */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 12 }}>What happened</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                  {[
                    { label: "F1", value: pct(storyExp.f1) },
                    { label: "Precision", value: pct(storyExp.precision) },
                    { label: "Recall", value: pct(storyExp.recall) },
                    { label: "Cost", value: dollar(storyExp.cost) },
                  ].map(m => (
                    <div key={m.label} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px" }}>
                      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{m.value}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{m.label}</div>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "#374151" }}>{storyExp.narrative.happened}</p>
              </div>

              {/* BATCH COMPOSITION */}
              <details style={{ marginBottom: 28, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0" }}>
                <summary style={{ padding: "12px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6b7280" }}>
                  Batch Composition &middot; {storyExp.flows} flows
                </summary>
                <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: "True Positives", val: storyExp.confusion.tp, color: "#16a34a" },
                    { label: "False Positives", val: storyExp.confusion.fp, color: "#dc2626" },
                    { label: "True Negatives", val: storyExp.confusion.tn, color: "#2563eb" },
                    { label: "False Negatives", val: storyExp.confusion.fn, color: "#d97706" },
                  ].map(c => (
                    <div key={c.label} style={{ textAlign: "center", padding: "12px 8px", background: "#f9fafb", borderRadius: 6 }}>
                      <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.val}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{c.label}</div>
                    </div>
                  ))}
                </div>
                {storyExp.verdicts && (
                  <div style={{ padding: "0 16px 8px" }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Verdict distribution</div>
                    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#f3f4f6" }}>
                      <div style={{ width: `${(storyExp.verdicts.benign / storyExp.flows) * 100}%`, background: "#16a34a" }} />
                      <div style={{ width: `${(storyExp.verdicts.suspicious / storyExp.flows) * 100}%`, background: "#d97706" }} />
                      <div style={{ width: `${(storyExp.verdicts.malicious / storyExp.flows) * 100}%`, background: "#dc2626" }} />
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 11, color: "#9ca3af" }}>
                      <span>Benign: {storyExp.verdicts.benign}</span>
                      <span>Suspicious: {storyExp.verdicts.suspicious}</span>
                      <span>Malicious: {storyExp.verdicts.malicious}</span>
                    </div>
                  </div>
                )}
              </details>

              {/* PER-ATTACK BREAKDOWN (for experiments with enough data) */}
              {storyExp.id === "batch3_stealthy" && (
                <details style={{ marginBottom: 28, border: "1px solid #e5e7eb", borderRadius: 8 }}>
                  <summary style={{ padding: "12px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#6b7280" }}>
                    Per-Attack Breakdown
                  </summary>
                  <div style={{ padding: "0 16px 16px" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <th style={{ textAlign: "left", padding: "8px 0", color: "#6b7280", fontWeight: 500 }}>Attack Type</th>
                          <th style={{ textAlign: "right", padding: "8px 0", color: "#6b7280", fontWeight: 500 }}>Recall</th>
                          <th style={{ textAlign: "right", padding: "8px 0", color: "#6b7280", fontWeight: 500 }}>Detected/Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { type: "SQL Injection", detected: 280, total: 300, recall: 0.933 },
                          { type: "XSS (Brute Force)", detected: 273, total: 319, recall: 0.856 },
                          { type: "Infiltration", detected: 115, total: 300, recall: 0.383 },
                        ].map(a => (
                          <tr key={a.type} style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "8px 0" }}>{a.type}</td>
                            <td style={{ textAlign: "right", padding: "8px 0", fontWeight: 600 }}>{pct(a.recall)}</td>
                            <td style={{ textAlign: "right", padding: "8px 0", color: "#6b7280" }}>{a.detected}/{a.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

              {/* WHAT WE LEARNED */}
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 8 }}>What we learned</h3>
                <p style={{ fontSize: 14, lineHeight: 1.7, color: "#374151", fontStyle: "italic" }}>{storyExp.narrative.learned}</p>
              </div>

              {/* ACTION BUTTONS */}
              <div style={{ display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap" }}>
                <button onClick={() => openExperimentDetail(storyExp.id)} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "8px 16px", border: "1px solid #2563eb", borderRadius: 6,
                  background: "#2563eb", color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}>
                  Inspect Flows &#8594;
                </button>
                {storyExp.narrative.nextId && (
                  <button onClick={() => setStoryExpId(storyExp.narrative.nextId)} style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: 6,
                    background: "none", color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer",
                  }}>
                    What we did next &#8594; {EXPERIMENTS.find(e => e.id === storyExp.narrative.nextId)?.name}
                  </button>
                )}
              </div>

              {/* Prev / Next navigation */}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 16 }}>
                <button disabled={storyIdx === 0} onClick={() => setStoryExpId(EXPERIMENTS[storyIdx - 1]?.id)} style={{
                  padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: 6, background: "none",
                  color: storyIdx === 0 ? "#d1d5db" : "#374151", fontSize: 13, cursor: storyIdx === 0 ? "default" : "pointer",
                }}>
                  &#8592; Previous
                </button>
                <span style={{ fontSize: 12, color: "#9ca3af", alignSelf: "center" }}>{storyIdx + 1} / {EXPERIMENTS.length} &middot; Use arrow keys</span>
                <button disabled={storyIdx === EXPERIMENTS.length - 1} onClick={() => setStoryExpId(EXPERIMENTS[storyIdx + 1]?.id)} style={{
                  padding: "8px 16px", border: "1px solid #e5e7eb", borderRadius: 6, background: "none",
                  color: storyIdx === EXPERIMENTS.length - 1 ? "#d1d5db" : "#374151", fontSize: 13,
                  cursor: storyIdx === EXPERIMENTS.length - 1 ? "default" : "pointer",
                }}>
                  Next &#8594;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* AMATAS — STAGE 1                                                   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {topTab === "amatas" && amatasTab === "stage1" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.02em" }}>Per-Attack-Type Detection at 5% Prevalence</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
              Each batch: 950 benign + 50 attack flows. Tier-1 RF pre-filter reduces LLM calls by ~95%.
            </p>

            {/* ── RECALL BAR CHART ────────────────────────────────────── */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "24px", marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Detection Recall by Attack Type</div>
              {[...s1.experiments].sort((a, b) => (b.recall || 0) - (a.recall || 0)).map(exp => {
                const recall = exp.recall || 0;
                const barColor = recall === 0 ? "#dc2626" : recall >= 80 ? "#16a34a" : recall >= 50 ? "#d97706" : "#dc2626";
                return (
                  <div key={exp.attack_type} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 180, fontSize: 12, color: "#374151", textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {exp.attack_type.replace(/_/g, " ")}
                    </div>
                    <div style={{ flex: 1, height: 22, background: "#f3f4f6", borderRadius: 4, overflow: "hidden", position: "relative" }}>
                      {/* 80% threshold line */}
                      <div style={{ position: "absolute", left: "80%", top: 0, bottom: 0, width: 1, borderLeft: "2px dashed #9ca3af", zIndex: 1 }} />
                      <div style={{ width: `${recall}%`, height: "100%", background: barColor, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: recall > 10 ? 8 : 0, minWidth: recall > 0 ? 2 : 0 }}>
                        {recall >= 15 && <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{recall}%</span>}
                      </div>
                    </div>
                    {recall < 15 && <span style={{ fontSize: 11, fontWeight: 600, color: barColor, minWidth: 35 }}>{recall}%</span>}
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
                <div style={{ width: 180 }} />
                <div style={{ flex: 1, position: "relative" }}>
                  <span style={{ position: "absolute", left: "78%", fontSize: 10, color: "#6b7280" }}>80% threshold</span>
                </div>
              </div>
            </div>

            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Best F1", value: `${s1.overall.best_f1}%`, sub: s1.overall.best_detected || "—" },
                { label: "Total Flows", value: s1.overall.total_flows.toLocaleString(), sub: `${s1.experiments.length} attack types tested` },
                { label: "Avg FPR", value: `${s1.overall.avg_fpr.toFixed(1)}%`, sub: "False positive rate" },
                { label: "Total Cost", value: dollar(s1.overall.total_cost), sub: `$${(s1.overall.total_cost / (s1.overall.total_flows || 1)).toFixed(4)}/flow` },
              ].map(c => (
                <div key={c.label} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{c.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginTop: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Cost breakdown toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <button onClick={() => setShowCostBreakdown(p => !p)} style={{
                padding: "6px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                border: showCostBreakdown ? "1px solid #2563eb" : "1px solid #e5e7eb",
                background: showCostBreakdown ? "#eff6ff" : "#fff",
                color: showCostBreakdown ? "#2563eb" : "#6b7280",
              }}>
                {showCostBreakdown ? "Hide cost breakdown" : "Show cost breakdown"}
              </button>
            </div>

            {/* Results table with expandable confusion matrices */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Attack Type", "Data Split", "Recall", "FPR", "F1", "Cost", "$/TP"].map(h => (
                      <th key={h} style={{ textAlign: h === "Attack Type" ? "left" : "right", padding: "12px 16px", fontWeight: 600, color: "#6b7280", fontSize: 12, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s1.experiments.map(exp => {
                    const stage1IdMap = {
                      "FTP-BruteForce": "stage1_ftp", "SSH-Bruteforce": "stage1_ssh",
                      "DoS-SlowHTTPTest": "stage1_slowhttp", "DoS_attacks-SlowHTTPTest": "stage1_slowhttp",
                      "DDoS_attacks-LOIC-HTTP": "stage1_loic_http", "DoS_attacks-Hulk": "stage1_hulk",
                      "DoS_attacks-GoldenEye": "stage1_goldeneye", "DoS_attacks-Slowloris": "stage1_slowloris",
                      "DDOS_attack-HOIC": "stage1_hoic", "DDOS_attack-LOIC-UDP": "stage1_loic_udp",
                      "Bot": "stage1_bot", "Infilteration": "stage1_infilteration",
                      "Brute_Force_-Web": "stage1_web", "Brute_Force_-XSS": "stage1_xss",
                      "SQL_Injection": "stage1_sql",
                    };
                    const expId = stage1IdMap[exp.attack_type];
                    const isExpanded = expandedS1Rows[exp.attack_type];
                    const cm = exp.confusion || {};
                    return (
                    <React.Fragment key={exp.attack_type}>
                    <tr onClick={() => setExpandedS1Rows(p => ({ ...p, [exp.attack_type]: !p[exp.attack_type] }))} style={{ borderBottom: isExpanded ? "none" : "1px solid #f3f4f6", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#2563eb" }}>
                        <span style={{ marginRight: 6, fontSize: 10, color: "#9ca3af" }}>{isExpanded ? "\u25BC" : "\u25B6"}</span>
                        {exp.attack_type}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {RF_TRAINED_TYPES.has(exp.attack_type) ? (
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "#dbeafe", color: "#1e40af" }}>dev_eval</span>
                        ) : RF_CAUGHT_UNSEEN.has(exp.attack_type) ? (
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500, background: "#dcfce7", color: "#166534" }}>validation</span>
                        ) : DATASET_SPLITS.test.attacks[exp.attack_type] != null ? (
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500, background: "#dcfce7", color: "#166534" }}>test</span>
                        ) : (
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 500, background: "#dcfce7", color: "#166534" }}>validation</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: (exp.recall || 0) >= 80 ? "#16a34a" : (exp.recall || 0) >= 50 ? "#d97706" : "#dc2626" }}>{exp.recall}%</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: exp.fpr > 5 ? "#dc2626" : "#6b7280" }}>{exp.fpr}%</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#2563eb" }}>{exp.f1}%</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#6b7280" }}>{dollar(exp.cost)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#6b7280" }}>{exp.cost_per_tp === Infinity ? "—" : dollar(exp.cost_per_tp)}</td>
                    </tr>
                    {/* Expanded confusion matrix + cost breakdown */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: "0 16px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                          <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                            {/* Confusion Matrix */}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>Confusion Matrix</div>
                              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 1fr", gridTemplateRows: "auto auto auto", gap: 0, maxWidth: 320 }}>
                                <div style={{ padding: 8, fontSize: 11, color: "#6b7280" }}></div>
                                <div style={{ padding: 8, fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>Pred Benign</div>
                                <div style={{ padding: 8, fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "center", borderBottom: "1px solid #e5e7eb" }}>Pred Attack</div>
                                <div style={{ padding: 8, fontSize: 11, fontWeight: 600, color: "#6b7280", borderRight: "1px solid #e5e7eb" }}>True Benign</div>
                                <div style={{ padding: 8, textAlign: "center", fontSize: 16, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", borderRadius: "4px 0 0 0" }}>{cm.tn}</div>
                                <div style={{ padding: 8, textAlign: "center", fontSize: 16, fontWeight: 700, color: cm.fp > 0 ? "#dc2626" : "#16a34a", background: cm.fp > 0 ? "#fef2f2" : "#f0fdf4", borderRadius: "0 4px 0 0" }}>{cm.fp}</div>
                                <div style={{ padding: 8, fontSize: 11, fontWeight: 600, color: "#6b7280", borderRight: "1px solid #e5e7eb" }}>True Attack</div>
                                <div style={{ padding: 8, textAlign: "center", fontSize: 16, fontWeight: 700, color: cm.fn > 0 ? "#dc2626" : "#16a34a", background: cm.fn > 0 ? "#fef2f2" : "#f0fdf4", borderRadius: "0 0 0 4px" }}>{cm.fn}</div>
                                <div style={{ padding: 8, textAlign: "center", fontSize: 16, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", borderRadius: "0 0 4px 0" }}>{cm.tp}</div>
                              </div>
                              <div style={{ fontSize: 12, color: "#374151", marginTop: 10, lineHeight: 1.6 }}>
                                Detected <strong>{cm.tp}</strong> of 50 attacks.{" "}
                                {cm.fp === 0 ? "Zero false alarms on 950 benign flows. " : `${cm.fp} false alarm${cm.fp !== 1 ? "s" : ""} on 950 benign flows. `}
                                {cm.fn === 0 ? "No attacks missed." : `${cm.fn} attack${cm.fn !== 1 ? "s" : ""} missed.`}
                              </div>
                            </div>
                            {/* Quick action */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 140 }}>
                              <button onClick={(e) => { e.stopPropagation(); expId && openExperimentDetail(expId); }} style={{
                                padding: "8px 16px", border: "1px solid #2563eb", borderRadius: 6,
                                background: "#2563eb", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer",
                              }}>
                                Inspect Flows
                              </button>
                            </div>
                          </div>
                          {/* Inline cost breakdown bar — per-experiment data */}
                          {showCostBreakdown && (() => {
                            const perExp = AGENT_COST_PER_EXPERIMENT[exp.attack_type];
                            if (!perExp) return null;
                            return (
                              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
                                  Agent cost distribution &middot; {perExp.llmFlows} flows to LLM &middot; {perExp.filtered} filtered
                                </div>
                                <div style={{ display: "flex", height: 14, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                                  {AGENT_KEYS.map(a => {
                                    const pct = (perExp[a] / perExp.total * 100);
                                    return (
                                      <div key={a} style={{ width: `${pct}%`, background: AGENT_COST_DATA[a].color }}
                                        title={`${AGENT_COST_DATA[a].label}: $${perExp[a].toFixed(3)} (${pct.toFixed(0)}%)`} />
                                    );
                                  })}
                                </div>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {[...AGENT_KEYS].sort((a, b) => perExp[b] - perExp[a]).map(a => {
                                    const pct = (perExp[a] / perExp.total * 100);
                                    return (
                                      <span key={a} style={{ fontSize: 10, color: "#6b7280", display: "flex", alignItems: "center", gap: 3 }}>
                                        <span style={{ width: 7, height: 7, borderRadius: 2, background: AGENT_COST_DATA[a].color, display: "inline-block" }} />
                                        {AGENT_COST_DATA[a].label} {pct.toFixed(0)}%
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cost insight */}
            {showCostBreakdown && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px 20px", marginTop: 12, background: "#f9fafb" }}>
                <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.7, marginBottom: 10 }}>
                  <strong>Orchestrator + Devil's Advocate account for ~{(AGENT_COST_DATA.orchestrator.pct + AGENT_COST_DATA.devils_advocate.pct).toFixed(0)}% of all LLM spend</strong> — they receive all specialist outputs as context, making their prompts significantly longer.
                  Temporal agent cost varies most across attack types — higher for attacks with many flows from the same IP.
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
                  DoS variants (Hulk, Slowloris, GoldenEye, SlowHTTPTest) show temporal costs of 40%+ because source IPs generate
                  dozens of nearly identical flows that get injected as context. Brute-force and DDoS attacks show 17–24% temporal
                  cost due to fewer connected flows per IP. Infiltration is lowest overall ($0.80) because 97% of flows were filtered by Tier 1.
                </div>
              </div>
            )}

            {/* Remaining attack types — only show if pipeline still running */}
            {liveStatus && liveStatus.experiments_queued?.length > 0 && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "24px", marginTop: 16, textAlign: "center", color: "#9ca3af" }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>{liveStatus.experiments_queued.length} more attack type{liveStatus.experiments_queued.length !== 1 ? "s" : ""} queued for evaluation</p>
              <p style={{ fontSize: 12 }}>{liveStatus.experiments_queued.join(", ")}</p>
            </div>
            )}

            {/* Within-Split Impact Comparison — shows when rerun data exists for dev-split types */}
            {leakySummary?.experiments?.length > 0 && (() => {
              const leakyByType = {};
              leakySummary.experiments.forEach(e => { leakyByType[e.attack_type] = e; });
              const cleanByType = {};
              s1.experiments.forEach(e => { cleanByType[e.attack_type] = e; });
              // Show for the 7 dev-split types that have both old and rerun data
              const affectedRows = [...RF_TRAINED_TYPES].filter(at => leakyByType[at] && cleanByType[at]).map(at => {
                const leaky = leakyByType[at];
                const clean = cleanByType[at];
                return { at, leaky, clean, recallDelta: clean.recall - leaky.recall, f1Delta: clean.f1 - leaky.f1, costDelta: clean.cost - leaky.cost };
              });
              if (affectedRows.length === 0) return null;
              return (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginTop: 20 }}>
                  <div style={{ padding: "16px 20px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Within-Split Overlap Impact — Dev-Split Batches vs Clean Batches</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Comparing results from dev-sourced batches (RF overlap) vs val/test-sourced batches (no overlap)</div>
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        {["Attack Type", "Leaky Recall", "Clean Recall", "\u0394 Recall", "Leaky F1", "Clean F1", "\u0394 F1", "\u0394 Cost"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: h === "Attack Type" ? "left" : "right", fontWeight: 600, color: "#6b7280", fontSize: 11, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {affectedRows.map(r => (
                        <tr key={r.at} style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 500 }}>{r.at}</td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>{r.leaky.recall}%</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{r.clean.recall}%</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: r.recallDelta > 0 ? "#16a34a" : r.recallDelta < 0 ? "#dc2626" : "#6b7280" }}>
                            {r.recallDelta > 0 ? "+" : ""}{r.recallDelta}pp
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right" }}>{r.leaky.f1}%</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{r.clean.f1}%</td>
                          <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: r.f1Delta > 0 ? "#16a34a" : r.f1Delta < 0 ? "#dc2626" : "#6b7280" }}>
                            {r.f1Delta > 0 ? "+" : ""}{r.f1Delta}pp
                          </td>
                          <td style={{ padding: "10px 12px", textAlign: "right", color: "#6b7280" }}>
                            {r.costDelta > 0 ? "+" : ""}{dollar(r.costDelta)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* AMATAS — FLOW INSPECTOR                                            */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {topTab === "amatas" && amatasTab === "inspector" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.02em" }}>Flow Inspector</h2>

            {/* Source selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#6b7280", marginRight: 4, fontWeight: 600, minWidth: 90 }}>Development:</span>
                {EXPERIMENTS.map(exp => (
                  <button key={exp.id} onClick={() => { setInspectorSource(exp.id); loadInspectorData(exp.id); }} style={{
                    padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                    border: inspectorSource === exp.id ? "1px solid #2563eb" : "1px solid #e5e7eb",
                    background: inspectorSource === exp.id ? "#eff6ff" : "#fff",
                    color: inspectorSource === exp.id ? "#2563eb" : "#374151",
                    fontWeight: inspectorSource === exp.id ? 600 : 400,
                  }}>
                    {exp.name}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#6b7280", marginRight: 4, fontWeight: 600, minWidth: 90 }}>Stage 1:</span>
                {STAGE1_SUMMARY.experiments.map(exp => {
                  const slug = exp.attack_type.replace(/ /g, "_");
                  const idMap = {
                    "FTP-BruteForce": "stage1_ftp", "SSH-Bruteforce": "stage1_ssh",
                    "DDoS_attacks-LOIC-HTTP": "stage1_loic_http", "DoS_attacks-Hulk": "stage1_hulk",
                    "DoS_attacks-SlowHTTPTest": "stage1_slowhttp", "DoS_attacks-GoldenEye": "stage1_goldeneye",
                    "DoS_attacks-Slowloris": "stage1_slowloris", "DDOS_attack-HOIC": "stage1_hoic",
                    "DDOS_attack-LOIC-UDP": "stage1_loic_udp", "Bot": "stage1_bot",
                    "Infilteration": "stage1_infilteration", "Brute_Force_-Web": "stage1_web",
                    "Brute_Force_-XSS": "stage1_xss", "SQL_Injection": "stage1_sql",
                  };
                  const sourceId = idMap[exp.attack_type] || `stage1_${slug.toLowerCase()}`;
                  const isActive = inspectorSource === sourceId;
                  const recallColor = exp.recall >= 95 ? "#16a34a" : exp.recall >= 80 ? "#2563eb" : exp.recall >= 50 ? "#d97706" : "#dc2626";
                  return (
                    <button key={sourceId} onClick={() => { setInspectorSource(sourceId); loadInspectorData(sourceId); }} style={{
                      padding: "4px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                      border: isActive ? `1px solid ${recallColor}` : "1px solid #e5e7eb",
                      background: isActive ? `${recallColor}10` : "#fff",
                      color: isActive ? recallColor : "#374151",
                      fontWeight: isActive ? 600 : 400,
                    }}>
                      {exp.attack_type.replace(/_/g, " ")} <span style={{ color: recallColor, fontSize: 10 }}>{exp.recall}%</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Loading / Error / Empty states */}
            {inspectorLoading && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "48px", textAlign: "center", color: "#6b7280" }}>
                Loading flow data...
              </div>
            )}
            {inspectorError && !inspectorData && (
              <div style={{ border: "1px solid #fca5a5", borderRadius: 8, padding: "24px", background: "#fef2f2", color: "#dc2626", fontSize: 13 }}>
                Failed to load: {inspectorError}. Click an experiment button above to load data.
              </div>
            )}
            {!inspectorData && !inspectorLoading && !inspectorError && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "48px", textAlign: "center", color: "#9ca3af" }}>
                <p style={{ fontSize: 16, marginBottom: 8 }}>Select an experiment to inspect individual flow results</p>
                <p style={{ fontSize: 13 }}>Click any experiment button above to load its flow-level data with agent reasoning</p>
              </div>
            )}

            {/* Loaded data */}
            {inspectorData && !inspectorLoading && (
              <>
                {/* Interrupted banner */}
                {(inspectorData.evaluation_metadata?.status === "interrupted" || inspectorData.failed) && (
                  <div style={{ border: "1px solid #fbbf24", borderRadius: 8, padding: "12px 16px", background: "#fffbeb", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
                    &#9888;&#65039; This experiment was interrupted — partial results shown.
                  </div>
                )}

                {/* SECTION A — Experiment Summary */}
                {(() => {
                  const exp = EXPERIMENTS.find(e => e.id === inspectorSource);
                  if (!exp) return null;
                  return (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px", marginBottom: 20, background: "#fafafa" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                        <div>
                          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 500 }}>{exp.phase}</span>
                          <span style={{ fontSize: 11, color: "#d1d5db", margin: "0 6px" }}>&middot;</span>
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>{exp.model}</span>
                        </div>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>{exp.date}</span>
                      </div>
                      <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px 0", letterSpacing: "-0.02em" }}>{exp.name}</h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }}>
                        {[
                          { label: "F1", value: pct(exp.f1) },
                          { label: "Recall", value: pct(exp.recall) },
                          { label: "Precision", value: pct(exp.precision) },
                          { label: "Cost", value: dollar(exp.cost) },
                          { label: "Flows", value: exp.flows },
                          { label: "TP/FP/TN/FN", value: `${exp.confusion.tp}/${exp.confusion.fp}/${exp.confusion.tn}/${exp.confusion.fn}` },
                        ].map(m => (
                          <div key={m.label} style={{ textAlign: "center", padding: "8px 4px", background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                            <div style={{ fontSize: 16, fontWeight: 700 }}>{m.value}</div>
                            <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                      {exp.variables && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                          {Object.entries(exp.variables).map(([k, v]) => (
                            <span key={k} style={{ padding: "2px 8px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 11, color: "#6b7280" }}>
                              {k.replace(/_/g, " ")}: <strong style={{ color: "#374151" }}>{v}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                      {exp.narrative && (
                        <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                          <strong>What we tried:</strong> {exp.narrative.tried}
                          <br /><strong>What happened:</strong> {exp.narrative.happened}
                          <br /><strong style={{ fontStyle: "italic" }}>Learned:</strong> <em>{exp.narrative.learned}</em>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Cost Breakdown Card ──────────────────────────── */}
                {(() => {
                  // Find cost data for this experiment from inspectorData or AGENT_COST_PER_EXPERIMENT
                  const meta = inspectorData?.evaluation_metadata;
                  const agentStats = meta?.agent_stats;
                  const tier1 = meta?.tier1 || {};
                  const metrics = meta?.metrics?.confusion || {};

                  // Try to compute from loaded inspector data first, fall back to static
                  let costData = null;
                  if (agentStats) {
                    const total = Object.values(agentStats).reduce((s, a) => s + (a.total_cost || 0), 0);
                    if (total > 0) {
                      costData = {};
                      AGENT_KEYS.forEach(k => {
                        const c = agentStats[k]?.total_cost || 0;
                        costData[k] = { cost: c, pct: (c / total * 100) };
                      });
                      costData._total = total;
                      costData._llmFlows = tier1.flows_sent_to_llm || 0;
                      costData._filtered = tier1.flows_filtered || 0;
                      costData._estWithout = tier1.estimated_cost_without_tier1 || 0;
                      costData._tp = metrics.tp || 0;
                    }
                  }
                  // Fallback to static data
                  if (!costData) {
                    const s1exp = STAGE1_SUMMARY.experiments.find(e => {
                      const idMap = { "FTP-BruteForce": "stage1_ftp", "SSH-Bruteforce": "stage1_ssh", "DDoS_attacks-LOIC-HTTP": "stage1_loic_http", "DoS_attacks-Hulk": "stage1_hulk", "DoS_attacks-SlowHTTPTest": "stage1_slowhttp", "DoS_attacks-GoldenEye": "stage1_goldeneye", "DoS_attacks-Slowloris": "stage1_slowloris", "DDOS_attack-HOIC": "stage1_hoic", "DDOS_attack-LOIC-UDP": "stage1_loic_udp", "Bot": "stage1_bot", "Infilteration": "stage1_infilteration", "Brute_Force_-Web": "stage1_web", "Brute_Force_-XSS": "stage1_xss", "SQL_Injection": "stage1_sql" };
                      return idMap[e.attack_type] === inspectorSource;
                    });
                    if (s1exp) {
                      const perExp = AGENT_COST_PER_EXPERIMENT[s1exp.attack_type];
                      if (perExp) {
                        costData = {};
                        AGENT_KEYS.forEach(k => {
                          costData[k] = { cost: perExp[k], pct: (perExp[k] / perExp.total * 100) };
                        });
                        costData._total = perExp.total;
                        costData._llmFlows = perExp.llmFlows;
                        costData._filtered = perExp.filtered;
                        costData._estWithout = perExp.estWithout;
                        costData._tp = s1exp.confusion.tp;
                      }
                    }
                  }

                  if (!costData) return null;
                  return (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px", marginBottom: 20, background: "#fafafa" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Cost Breakdown</div>
                      {/* Mini horizontal bar chart */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                        {[...AGENT_KEYS].sort((a, b) => (costData[b]?.pct || 0) - (costData[a]?.pct || 0)).map(a => (
                          <div key={a} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 80, fontSize: 10, color: "#6b7280", textAlign: "right" }}>{AGENT_COST_DATA[a].label}</div>
                            <div style={{ flex: 1, background: "#e5e7eb", borderRadius: 3, height: 14, overflow: "hidden" }}>
                              <div style={{ width: `${(costData[a].pct / 45) * 100}%`, maxWidth: "100%", background: AGENT_COST_DATA[a].color, height: "100%", borderRadius: 3 }} />
                            </div>
                            <div style={{ width: 80, fontSize: 10, color: "#6b7280", fontFamily: "monospace" }}>
                              ${costData[a].cost.toFixed(3)} ({costData[a].pct.toFixed(0)}%)
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Stats row */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                        {[
                          { label: "Total cost", value: `$${costData._total.toFixed(2)}`, bg: "#f0fdf4", color: "#166534" },
                          { label: "Cost/flow", value: `$${(costData._total / 1000).toFixed(4)}`, bg: "#eff6ff", color: "#1e40af" },
                          { label: "Cost/TP", value: costData._tp > 0 ? `$${(costData._total / costData._tp).toFixed(3)}` : "N/A", bg: "#fefce8", color: "#854d0e" },
                          { label: "Tier 1 saved", value: `$${(costData._filtered * (costData._total / (costData._llmFlows || 1))).toFixed(2)}`, bg: "#f0fdf4", color: "#166534" },
                          { label: "Without Tier 1", value: `$${costData._estWithout.toFixed(0)}`, bg: "#fef2f2", color: "#991b1b" },
                        ].map(s => (
                          <div key={s.label} style={{ textAlign: "center", padding: "8px 4px", background: s.bg, borderRadius: 6 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: "monospace" }}>{s.value}</div>
                            <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Pie chart overview */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                  {[
                    { label: "Malicious", count: pieCounts.malicious, color: "#dc2626", filter: "malicious" },
                    { label: "Suspicious", count: pieCounts.suspicious, color: "#d97706", filter: "suspicious" },
                    { label: "Benign", count: pieCounts.benign, color: "#16a34a", filter: "benign" },
                    { label: "Tier-1 Filtered", count: pieCounts.filtered, color: "#9ca3af", filter: "filtered" },
                  ].map(s => (
                    <button key={s.label} onClick={() => { setInspectorFilter(inspectorFilter === s.filter ? "all" : s.filter); setInspectorPage(0); }} style={{
                      border: inspectorFilter === s.filter ? `2px solid ${s.color}` : "1px solid #e5e7eb",
                      borderRadius: 8, padding: "16px", textAlign: "center", cursor: "pointer", background: "#fff",
                    }}>
                      <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.count}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{s.label}</div>
                      <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: "#f3f4f6", overflow: "hidden" }}>
                        <div style={{ width: `${(s.count / pieTotal) * 100}%`, height: "100%", background: s.color, borderRadius: 2 }} />
                      </div>
                    </button>
                  ))}
                </div>

                {/* Search / filter bar */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Search by flow #, verdict, or attack type..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: 1, padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 13, outline: "none" }}
                  />
                  {[
                    ["all", "All"],
                    ["correct", "Correct"],
                    ["wrong", "Wrong"],
                    ["attacks", "Attacks"],
                    ["benign_actual", "Benign"],
                    ["filtered", "Filtered"],
                  ].map(([id, label]) => (
                    <button key={id} onClick={() => { setInspectorFilter(id); setInspectorPage(0); }} style={{
                      padding: "8px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                      border: inspectorFilter === id ? "1px solid #2563eb" : "1px solid #e5e7eb",
                      background: inspectorFilter === id ? "#eff6ff" : "#fff",
                      color: inspectorFilter === id ? "#2563eb" : "#6b7280",
                    }}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* Two-column layout: table + detail */}
                <div style={{ display: "grid", gridTemplateColumns: selectedFlow ? "1fr 1fr" : "1fr", gap: 20 }}>
                  {/* Flows table */}
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", maxHeight: "70vh", overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead style={{ position: "sticky", top: 0, background: "#f9fafb", zIndex: 1 }}>
                        <tr>
                          {["#", "Actual", "Verdict", "Correct?", "Conf"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600, color: "#6b7280", fontSize: 11, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInspectorFlows.slice(inspectorPage * FLOWS_PER_PAGE, (inspectorPage + 1) * FLOWS_PER_PAGE).map(f => {
                          const isAttack = f.label_actual === 1;
                          const predictedAttack = f.verdict?.toUpperCase() !== "BENIGN";
                          const correct = (isAttack && predictedAttack) || (!isAttack && !predictedAttack);
                          const isSelected = selectedFlowIdx === f.flow_idx;
                          const vUpper = (f.verdict || "").toUpperCase();
                          const displayVerdict = f.tier1_filtered ? "FILTERED" : vUpper;
                          return (
                            <tr key={f.flow_idx} onClick={() => setSelectedFlowIdx(isSelected ? null : f.flow_idx)} style={{
                              borderBottom: "1px solid #f3f4f6", cursor: "pointer",
                              background: isSelected ? "#eff6ff" : f.tier1_filtered ? "#f8fafc" : correct ? "#fafff9" : "#fff5f5",
                            }}>
                              <td style={{ padding: "8px 12px", color: "#9ca3af" }}>{f.flow_idx}</td>
                              <td style={{ padding: "8px 12px", fontSize: 11 }}>{f.attack_type_actual || "Benign"}</td>
                              <td style={{ padding: "8px 12px" }}>
                                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                                  color: f.tier1_filtered ? "#94a3b8" : verdictColor(f.verdict),
                                  background: f.tier1_filtered ? "#f1f5f9" : verdictBg(f.verdict) }}>
                                  {displayVerdict}
                                </span>
                              </td>
                              <td style={{ padding: "8px 12px", color: correctColor(correct), fontWeight: 600, fontSize: 11 }}>
                                {correct ? "Yes" : "No"}
                              </td>
                              <td style={{ padding: "8px 12px", color: "#6b7280" }}>{f.confidence != null ? `${(f.confidence * 100).toFixed(0)}%` : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Pagination controls */}
                    {(() => {
                      const totalPages = Math.ceil(filteredInspectorFlows.length / FLOWS_PER_PAGE);
                      const start = inspectorPage * FLOWS_PER_PAGE + 1;
                      const end = Math.min((inspectorPage + 1) * FLOWS_PER_PAGE, filteredInspectorFlows.length);
                      return (
                        <div style={{ padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280" }}>
                          <span>Showing {start}–{end} of {filteredInspectorFlows.length} flows</span>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => setInspectorPage(0)} disabled={inspectorPage === 0} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #e5e7eb", background: "#fff", cursor: inspectorPage === 0 ? "default" : "pointer", opacity: inspectorPage === 0 ? 0.4 : 1 }}>&laquo;</button>
                            <button onClick={() => setInspectorPage(p => Math.max(0, p - 1))} disabled={inspectorPage === 0} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #e5e7eb", background: "#fff", cursor: inspectorPage === 0 ? "default" : "pointer", opacity: inspectorPage === 0 ? 0.4 : 1 }}>&lsaquo; Prev</button>
                            <span style={{ padding: "4px 8px", fontWeight: 500 }}>Page {inspectorPage + 1} / {totalPages}</span>
                            <button onClick={() => setInspectorPage(p => Math.min(totalPages - 1, p + 1))} disabled={inspectorPage >= totalPages - 1} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #e5e7eb", background: "#fff", cursor: inspectorPage >= totalPages - 1 ? "default" : "pointer", opacity: inspectorPage >= totalPages - 1 ? 0.4 : 1 }}>Next &rsaquo;</button>
                            <button onClick={() => setInspectorPage(totalPages - 1)} disabled={inspectorPage >= totalPages - 1} style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #e5e7eb", background: "#fff", cursor: inspectorPage >= totalPages - 1 ? "default" : "pointer", opacity: inspectorPage >= totalPages - 1 ? 0.4 : 1 }}>&raquo;</button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Flow detail panel */}
                  {selectedFlow && (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px", maxHeight: "70vh", overflowY: "auto" }}>
                      {/* Header */}
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Flow #{selectedFlow.flow_idx}</h3>
                          <button onClick={() => setSelectedFlowIdx(null)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 16 }}>&times;</button>
                        </div>
                        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                          Actual: <strong style={{ color: selectedFlow.label_actual === 1 ? "#dc2626" : "#16a34a" }}>
                            {selectedFlow.attack_type_actual || "Benign"} ({selectedFlow.label_actual === 1 ? "ATTACK" : "BENIGN"})
                          </strong>
                        </div>
                        <div style={{ fontSize: 13, marginTop: 4 }}>
                          Final Verdict: <strong style={{ color: verdictColor(selectedFlow.verdict) }}>{selectedFlow.verdict}</strong>
                          {(() => {
                            const isAttack = selectedFlow.label_actual === 1;
                            const predictedAttack = selectedFlow.verdict?.toUpperCase() !== "BENIGN";
                            const correct = (isAttack && predictedAttack) || (!isAttack && !predictedAttack);
                            return <span style={{ marginLeft: 8, color: correctColor(correct), fontWeight: 600 }}>{correct ? "Correct" : "Incorrect"}</span>;
                          })()}
                        </div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                          Confidence: {(selectedFlow.confidence * 100).toFixed(0)}%
                          {selectedFlow.cost_usd > 0 && <span> &middot; Cost: ${selectedFlow.cost_usd.toFixed(4)}</span>}
                          {selectedFlow.time_seconds > 0 && <span> &middot; {selectedFlow.time_seconds.toFixed(1)}s</span>}
                        </div>
                        {/* Per-flow agent cost mini bar */}
                        {selectedFlow.agent_costs && Object.keys(selectedFlow.agent_costs).length > 0 && (() => {
                          const ac = selectedFlow.agent_costs;
                          const total = Object.values(ac).reduce((s, v) => s + v, 0);
                          if (total === 0) return null;
                          return (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ display: "flex", height: 10, borderRadius: 3, overflow: "hidden" }}>
                                {AGENT_KEYS.map(a => ac[a] ? (
                                  <div key={a} style={{ width: `${(ac[a] / total) * 100}%`, background: AGENT_COST_DATA[a].color }}
                                    title={`${AGENT_COST_DATA[a].label}: $${ac[a].toFixed(4)} (${(ac[a] / total * 100).toFixed(0)}%)`} />
                                ) : null)}
                              </div>
                              <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                                {AGENT_KEYS.filter(a => ac[a]).sort((a, b) => (ac[b] || 0) - (ac[a] || 0)).map(a => (
                                  <span key={a} style={{ fontSize: 9, color: "#9ca3af", display: "flex", alignItems: "center", gap: 2 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: 1, background: AGENT_COST_DATA[a].color, display: "inline-block" }} />
                                    {AGENT_COST_DATA[a].label} ${ac[a].toFixed(4)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Flow features (raw NetFlow data) */}
                      {selectedFlow.flow_features && Object.keys(selectedFlow.flow_features).length > 0 && (
                        <details style={{ border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
                          <summary style={{ padding: "10px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#6b7280", background: "#f9fafb" }}>
                            NetFlow Features ({Object.keys(selectedFlow.flow_features).length} fields)
                          </summary>
                          <div style={{ padding: "8px 14px" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                              <tbody>
                                {Object.entries(selectedFlow.flow_features).map(([key, val]) => (
                                  <tr key={key} style={{ borderBottom: "1px solid #f3f4f6" }}>
                                    <td style={{ padding: "4px 8px 4px 0", color: "#6b7280", fontWeight: 500, whiteSpace: "nowrap" }}>{key}</td>
                                    <td style={{ padding: "4px 0", fontFamily: "monospace", color: "#374151" }}>
                                      {typeof val === "number" ? val.toLocaleString() : String(val)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      )}

                      {/* Tier 1 filtered */}
                      {selectedFlow.tier1_filtered && (
                        <div style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "16px", background: "#f0fdf4", fontSize: 13, lineHeight: 1.6 }}>
                          <div style={{ fontWeight: 600, color: "#16a34a", marginBottom: 4 }}>Filtered by Tier 1 RF</div>
                          <div style={{ color: "#374151" }}>
                            Auto-classified benign (confidence: {(selectedFlow.confidence * 100).toFixed(1)}%) — LLM not consulted.
                            The Random Forest pre-filter determined this flow's P(attack) was below the 0.15 threshold.
                          </div>
                        </div>
                      )}

                      {/* Agent cards */}
                      {!selectedFlow.tier1_filtered && selectedFlow.specialist_results && Object.keys(selectedFlow.specialist_results).length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {AGENTS.filter(a => a.id !== "orchestrator" && a.id !== "devils_advocate").map(agent => {
                            const result = selectedFlow.specialist_results?.[agent.id];
                            if (!result) return null;
                            const evidence = result.key_evidence || result.key_findings || [];
                            return (
                              <div key={agent.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                  <span style={{ fontSize: 12, fontWeight: 600, color: agent.color, textTransform: "uppercase" }}>{agent.name} Agent</span>
                                  <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                                    color: verdictColor(result.verdict), background: verdictBg(result.verdict) }}>
                                    {result.verdict} {result.confidence != null ? `${(result.confidence * 100).toFixed(0)}%` : ""}
                                  </span>
                                </div>
                                {result.attack_type && (
                                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>Attack type: {result.attack_type}</div>
                                )}
                                {result.reasoning && (
                                  <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: "0 0 8px 0", whiteSpace: "pre-wrap" }}>
                                    {result.reasoning}
                                  </p>
                                )}
                                {evidence.length > 0 && (
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
                                    {evidence.map((kf, i) => (
                                      <span key={i} style={{ padding: "2px 8px", background: "#f3f4f6", borderRadius: 4, fontSize: 11, color: "#374151" }}>
                                        {typeof kf === "string" ? (kf.length > 80 ? kf.slice(0, 80) + "..." : kf) : JSON.stringify(kf)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* View prompt toggle */}
                                <button
                                  onClick={() => setExpandedPrompts(prev => ({ ...prev, [`flow_${agent.id}`]: !prev[`flow_${agent.id}`] }))}
                                  style={{ background: "none", border: "none", padding: 0, fontSize: 10, color: agent.color, cursor: "pointer", fontWeight: 600, marginTop: 4 }}
                                >
                                  {expandedPrompts[`flow_${agent.id}`] ? "hide prompt" : "view prompt"}
                                </button>
                                {expandedPrompts[`flow_${agent.id}`] && (
                                  <pre style={{
                                    marginTop: 6, padding: 10, background: "#f9fafb", border: "1px solid #e5e7eb",
                                    borderRadius: 6, fontSize: 10, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                                    maxHeight: 200, overflowY: "auto", color: "#374151", fontFamily: "ui-monospace, monospace",
                                  }}>
                                    {agent.prompt}
                                  </pre>
                                )}
                                {/* Temporal agent extra fields */}
                                {agent.id === "temporal" && result.ip_history_summary && (
                                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6, padding: "8px", background: "#fdf4ff", borderRadius: 4 }}>
                                    <div style={{ fontWeight: 600, color: "#ec4899", marginBottom: 4 }}>IP History</div>
                                    <div>{result.ip_history_summary}</div>
                                    {result.temporal_pattern && <div style={{ marginTop: 2 }}>Pattern: <strong>{result.temporal_pattern}</strong></div>}
                                    {result.connected_flows && result.connected_flows.length > 0 && (
                                      <div style={{ marginTop: 4 }}>
                                        Connected flows: {result.connected_flows.map(cf => cf.flow_id ?? "?").join(", ")}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {agent.id === "temporal" && result.temporal_summary && (
                                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6, padding: "8px", background: "#fdf4ff", borderRadius: 4 }}>
                                    <div style={{ fontWeight: 600, color: "#ec4899", marginBottom: 4 }}>Temporal Context</div>
                                    <div>{typeof result.temporal_summary === "string" ? result.temporal_summary : JSON.stringify(result.temporal_summary)}</div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {/* Devil's Advocate */}
                          {selectedFlow.devils_advocate && (selectedFlow.devils_advocate.confidence_benign > 0 || selectedFlow.devils_advocate.confidence > 0 || selectedFlow.devils_advocate.counter_argument) && (
                            <div style={{ border: "1px solid #fca5a5", borderRadius: 8, padding: "14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", textTransform: "uppercase" }}>
                                  Devil's Advocate
                                  <button
                                    onClick={() => setExpandedPrompts(prev => ({ ...prev, flow_devils_advocate: !prev.flow_devils_advocate }))}
                                    style={{ background: "none", border: "none", padding: 0, fontSize: 10, color: "#ef4444", cursor: "pointer", fontWeight: 600, marginLeft: 8, textTransform: "lowercase" }}
                                  >
                                    {expandedPrompts.flow_devils_advocate ? "hide prompt" : "view prompt"}
                                  </button>
                                </span>
                                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: "#16a34a", background: "#f0fdf4" }}>
                                  BENIGN {((selectedFlow.devils_advocate.confidence_benign || selectedFlow.devils_advocate.confidence || 0) * 100).toFixed(0)}%
                                </span>
                              </div>
                              {expandedPrompts.flow_devils_advocate && (
                                <pre style={{
                                  marginBottom: 8, padding: 10, background: "#fef2f2", border: "1px solid #fecaca",
                                  borderRadius: 6, fontSize: 10, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                                  maxHeight: 200, overflowY: "auto", color: "#374151", fontFamily: "ui-monospace, monospace",
                                }}>
                                  {AGENTS.find(a => a.id === "devils_advocate")?.prompt}
                                </pre>
                              )}
                              {(selectedFlow.devils_advocate.counter_argument || selectedFlow.devils_advocate.benign_argument) && (
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Counter-Argument</div>
                                  <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                                    {selectedFlow.devils_advocate.counter_argument || selectedFlow.devils_advocate.benign_argument}
                                  </p>
                                </div>
                              )}
                              {selectedFlow.devils_advocate.strongest_benign_indicator && (
                                <div style={{ marginBottom: 8 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Strongest Benign Indicator</div>
                                  <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.5, margin: 0 }}>
                                    {selectedFlow.devils_advocate.strongest_benign_indicator}
                                  </p>
                                </div>
                              )}
                              {selectedFlow.devils_advocate.alternative_explanations && selectedFlow.devils_advocate.alternative_explanations.length > 0 && (
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Alternative Explanations</div>
                                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                                    {selectedFlow.devils_advocate.alternative_explanations.map((alt, i) => (
                                      <li key={i} style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{alt}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {selectedFlow.devils_advocate.weaknesses_in_malicious_case && selectedFlow.devils_advocate.weaknesses_in_malicious_case.length > 0 && (
                                <div>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Weaknesses in Malicious Case</div>
                                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                                    {selectedFlow.devils_advocate.weaknesses_in_malicious_case.map((w, i) => (
                                      <li key={i} style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{w}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Orchestrator reasoning */}
                          {selectedFlow.reasoning && selectedFlow.reasoning !== "Tier 1 RF pre-filter: classified as obviously benign" && (
                            <div style={{ border: "2px solid #10b981", borderRadius: 8, padding: "14px", background: "#f0fdf4" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981", textTransform: "uppercase" }}>
                                  Orchestrator — Final Verdict
                                  <button
                                    onClick={() => setExpandedPrompts(prev => ({ ...prev, flow_orchestrator: !prev.flow_orchestrator }))}
                                    style={{ background: "none", border: "none", padding: 0, fontSize: 10, color: "#10b981", cursor: "pointer", fontWeight: 600, marginLeft: 8, textTransform: "lowercase" }}
                                  >
                                    {expandedPrompts.flow_orchestrator ? "hide prompt" : "view prompt"}
                                  </button>
                                </span>
                                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                                  color: verdictColor(selectedFlow.verdict), background: verdictBg(selectedFlow.verdict) }}>
                                  {selectedFlow.verdict} {selectedFlow.confidence != null ? `${(selectedFlow.confidence * 100).toFixed(0)}%` : ""}
                                </span>
                              </div>
                              {expandedPrompts.flow_orchestrator && (
                                <pre style={{
                                  marginBottom: 8, padding: 10, background: "#ecfdf5", border: "1px solid #a7f3d0",
                                  borderRadius: 6, fontSize: 10, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
                                  maxHeight: 200, overflowY: "auto", color: "#374151", fontFamily: "ui-monospace, monospace",
                                }}>
                                  {AGENTS.find(a => a.id === "orchestrator")?.prompt}
                                </pre>
                              )}
                              {(selectedFlow.attack_type_predicted || selectedFlow.attack_category) && (
                                <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                                  {selectedFlow.attack_type_predicted && (
                                    <span style={{ padding: "2px 8px", background: "#fef2f2", borderRadius: 4, fontSize: 11, color: "#dc2626", fontWeight: 500 }}>
                                      Type: {selectedFlow.attack_type_predicted}
                                    </span>
                                  )}
                                  {selectedFlow.attack_category && (
                                    <span style={{ padding: "2px 8px", background: "#fffbeb", borderRadius: 4, fontSize: 11, color: "#d97706", fontWeight: 500 }}>
                                      Category: {selectedFlow.attack_category}
                                    </span>
                                  )}
                                </div>
                              )}
                              {(selectedFlow.agents_agreed?.length > 0 || selectedFlow.agents_disagreed?.length > 0) && (
                                <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
                                  {selectedFlow.agents_agreed?.length > 0 && (
                                    <div style={{ fontSize: 11, color: "#16a34a" }}>
                                      Agreed: {selectedFlow.agents_agreed.join(", ")}
                                    </div>
                                  )}
                                  {selectedFlow.agents_disagreed?.length > 0 && (
                                    <div style={{ fontSize: 11, color: "#dc2626" }}>
                                      Disagreed: {selectedFlow.agents_disagreed.join(", ")}
                                    </div>
                                  )}
                                </div>
                              )}
                              {selectedFlow.consensus_score != null && selectedFlow.consensus_score > 0 && (
                                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
                                  Consensus score: {(selectedFlow.consensus_score * 100).toFixed(0)}%
                                </div>
                              )}
                              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Reasoning</div>
                              <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                                {selectedFlow.reasoning}
                              </p>
                              {selectedFlow.mitre_techniques && selectedFlow.mitre_techniques.length > 0 && (
                                <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                  <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>MITRE:</span>
                                  {selectedFlow.mitre_techniques.map(t => (
                                    <span key={t} style={{ padding: "2px 8px", background: "#eff6ff", borderRadius: 4, fontSize: 11, color: "#2563eb" }}>{t}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Old format — no agent details but may have reasoning */}
                      {!selectedFlow.tier1_filtered && (!selectedFlow.specialist_results || Object.keys(selectedFlow.specialist_results).length === 0) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {selectedFlow.reasoning && (
                            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px", background: "#f9fafb" }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", textTransform: "uppercase", marginBottom: 8 }}>Agent Reasoning</div>
                              <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                                {selectedFlow.reasoning}
                              </p>
                            </div>
                          )}
                          <div style={{ border: "1px solid #93c5fd", borderRadius: 8, padding: "12px 16px", background: "#eff6ff", color: "#1e40af", fontSize: 13, lineHeight: 1.6 }}>
                            This experiment used the original result format. Full agent reasoning was captured from Stage 1 onwards.
                            View a Stage 1 experiment to see complete agent analysis with per-specialist reasoning, Devil's Advocate counter-arguments, and Orchestrator synthesis.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MCP EXPERIMENTS                                                    */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {topTab === "mcp" && mcpTab === "overview" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>MCP Comparison Experiments</h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, maxWidth: 800, lineHeight: 1.7 }}>
              Three single-agent configurations tested on the same 100-flow batch (10 FTP + 10 SSH + 10 DoS-Hulk + 70 benign)
              to isolate the impact of prompt engineering and tool access on NIDS performance.
            </p>

            {/* Hero comparison cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "A: Zero-Shot", model: "GPT-4o-mini", recall: "90.0%", fpr: "41.4%", f1: "62.8%", cost: "$0.01", border: "#d97706" },
                { label: "B: Engineered Prompt", model: "GPT-4o", recall: "66.7%", fpr: "27.1%", f1: "58.0%", cost: "$0.37", border: "#3b82f6" },
                { label: "C: + MITRE Tool", model: "GPT-4o", recall: "70.0%", fpr: "30.0%", f1: "58.3%", cost: "$0.45", border: "#8b5cf6" },
                { label: "AMATAS v2", model: "GPT-4o (6-agent)", recall: "85%", fpr: "1.1%", f1: "88%", cost: "$2.59/1k", border: "#16a34a" },
              ].map(c => (
                <div key={c.label} style={{ border: `2px solid ${c.border}`, borderRadius: 8, padding: "16px", background: "#fff" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c.border, marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 12 }}>{c.model}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{c.f1}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>F1 Score</div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11 }}>
                    <span style={{ color: "#16a34a" }}>R: {c.recall}</span>
                    <span style={{ color: "#dc2626" }}>FPR: {c.fpr}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{c.cost}</div>
                </div>
              ))}
            </div>

            {/* Key findings */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px", marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Key Findings</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                <div style={{ display: "flex", gap: 8 }}><span style={{ color: "#d97706", fontWeight: 600, flexShrink: 0 }}>1.</span> <span><strong>GPT-4o-mini zero-shot</strong> catches the most attacks (90% recall) but flags everything suspicious — 41% FPR makes it unusable in production.</span></div>
                <div style={{ display: "flex", gap: 8 }}><span style={{ color: "#3b82f6", fontWeight: 600, flexShrink: 0 }}>2.</span> <span><strong>Engineered prompt</strong> reduces FPR to 27% but also cuts recall to 67% — the single-agent precision-recall seesaw in action.</span></div>
                <div style={{ display: "flex", gap: 8 }}><span style={{ color: "#8b5cf6", fontWeight: 600, flexShrink: 0 }}>3.</span> <span><strong>MITRE ATT&CK tool</strong> provides marginal +3.3% recall over engineered prompt at +$0.09 cost — minimal uplift validates Phase 1 finding.</span></div>
                <div style={{ display: "flex", gap: 8 }}><span style={{ color: "#16a34a", fontWeight: 600, flexShrink: 0 }}>4.</span> <span><strong>AMATAS multi-agent</strong> breaks through the single-agent ceiling: 88% F1 with only 1.1% FPR — specialised roles + adversarial checking beats any single-agent config.</span></div>
              </div>
            </div>

            {/* Batch info */}
            <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
              Batch: 100 flows from dev_eval.csv (RF holdout) &middot; 10 FTP-BruteForce + 10 SSH-Bruteforce + 10 DoS-Hulk + 70 Benign &middot; Total cost: $0.83 / $6.00 budget
            </div>
          </div>
        )}

        {topTab === "mcp" && mcpTab === "results" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.02em" }}>Per-Config Results</h2>

            {/* Results table */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 24 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    {["Config", "Model", "Recall", "FPR", "Precision", "F1", "TP", "FP", "FN", "TN", "Cost"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { config: "A: Zero-Shot", model: "GPT-4o-mini", recall: "90.0%", fpr: "41.4%", precision: "48.2%", f1: "62.8%", tp: 27, fp: 29, fn: 3, tn: 41, cost: "$0.01", bg: "#fffbeb" },
                    { config: "B: Engineered", model: "GPT-4o", recall: "66.7%", fpr: "27.1%", precision: "51.3%", f1: "58.0%", tp: 20, fp: 19, fn: 10, tn: 51, cost: "$0.37", bg: "#eff6ff" },
                    { config: "C: + MITRE", model: "GPT-4o", recall: "70.0%", fpr: "30.0%", precision: "50.0%", f1: "58.3%", tp: 21, fp: 21, fn: 9, tn: 49, cost: "$0.45", bg: "#f5f3ff" },
                  ].map(r => (
                    <tr key={r.config} style={{ borderBottom: "1px solid #f3f4f6", background: r.bg }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.config}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{r.model}</td>
                      <td style={{ padding: "10px 12px", color: "#16a34a", fontWeight: 500 }}>{r.recall}</td>
                      <td style={{ padding: "10px 12px", color: "#dc2626" }}>{r.fpr}</td>
                      <td style={{ padding: "10px 12px" }}>{r.precision}</td>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.f1}</td>
                      <td style={{ padding: "10px 12px" }}>{r.tp}</td>
                      <td style={{ padding: "10px 12px", color: "#dc2626" }}>{r.fp}</td>
                      <td style={{ padding: "10px 12px", color: "#dc2626" }}>{r.fn}</td>
                      <td style={{ padding: "10px 12px" }}>{r.tn}</td>
                      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{r.cost}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f0fdf4" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#166534" }}>AMATAS v2</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>GPT-4o (6-agent)</td>
                    <td style={{ padding: "10px 12px", color: "#16a34a", fontWeight: 700 }}>85%</td>
                    <td style={{ padding: "10px 12px", color: "#16a34a", fontWeight: 700 }}>1.1%</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>97%</td>
                    <td style={{ padding: "10px 12px", fontWeight: 700, color: "#166534" }}>88%</td>
                    <td colSpan={4} style={{ padding: "10px 12px", color: "#6b7280", fontSize: 11 }}>14,000 flows across 14 attack types</td>
                    <td style={{ padding: "10px 12px", color: "#6b7280" }}>$27.35</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ fontSize: 12, color: "#9ca3af" }}>
              All single-agent configs tested on same 100-flow batch. AMATAS v2 results are aggregate across 14 x 1,000-flow Stage 1 experiments.
            </div>
          </div>
        )}

        {topTab === "mcp" && mcpTab === "comparison" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.02em" }}>Single-Agent vs Multi-Agent</h2>

            {/* Visual F1 bar chart */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "24px", marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 16 }}>F1 Score Comparison</div>
              {[
                { label: "A: Zero-Shot (GPT-4o-mini)", f1: 62.8, color: "#d97706" },
                { label: "B: Engineered Prompt (GPT-4o)", f1: 58.0, color: "#3b82f6" },
                { label: "C: + MITRE Tool (GPT-4o)", f1: 58.3, color: "#8b5cf6" },
                { label: "AMATAS v2 (6-Agent + RF)", f1: 88, color: "#16a34a" },
              ].map(b => (
                <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <div style={{ width: 220, fontSize: 12, color: "#374151", textAlign: "right" }}>{b.label}</div>
                  <div style={{ flex: 1, height: 24, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${b.f1}%`, height: "100%", background: b.color, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{b.f1}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Thesis argument */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px", background: "#f9fafb" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Thesis Argument</div>
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, maxWidth: 800 }}>
                <p style={{ marginBottom: 12 }}>
                  The MCP comparison demonstrates that <strong>no single-agent configuration can match the multi-agent AMATAS architecture</strong>.
                  The best single-agent (Config A: zero-shot GPT-4o-mini) achieves 90% recall but at the cost of 41% FPR — classifying nearly half of benign traffic as suspicious.
                  Prompt engineering (Config B) reduces FPR but simultaneously cuts recall, confirming the precision-recall seesaw inherent to single-agent systems.
                </p>
                <p style={{ marginBottom: 12 }}>
                  MITRE ATT&CK tooling (Config C) provides only marginal improvement (+3.3% recall, +$0.09 cost) over the engineered prompt alone.
                  This validates the Phase 1 finding that <strong>external tools are limited by data quality, not tool quality</strong> — on anonymised synthetic data,
                  even comprehensive frameworks like MITRE ATT&CK add little beyond what prompt-encoded attack signatures already provide.
                </p>
                <p>
                  AMATAS v2&apos;s 88% F1 with 1.1% FPR is achieved through <strong>specialised analytical roles</strong> (protocol, statistical, behavioural, temporal analysis),
                  <strong>adversarial cross-checking</strong> (Devil&apos;s Advocate), and <strong>weighted consensus</strong> (Orchestrator) — capabilities fundamentally unavailable to any single-agent approach.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CLUSTERING                                                         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {topTab === "clustering" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>Temporal Clustering</h2>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: 16, color: "#6b7280", marginBottom: 12 }}>Temporal clustering experiment planned</div>
              <p style={{ fontSize: 13, color: "#9ca3af", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
                Will compare isolated flow analysis vs cluster-based analysis.
                Flows from the same source IP within a time window will be grouped
                and analysed together, testing whether cluster context improves
                detection of attacks like Infiltration that mimic benign DNS patterns.
              </p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* COMPARISON                                                         */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {topTab === "comparison" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.02em" }}>All Experiments</h2>

            {/* Timeline */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px", marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 12 }}>F1 Score Timeline</div>
              <div style={{ display: "flex", alignItems: "end", gap: 4, height: 80 }}>
                {EXPERIMENTS.map(exp => {
                  const h = Math.max(exp.f1 * 80, 4);
                  const hue = exp.f1 >= 0.8 ? "#16a34a" : exp.f1 >= 0.5 ? "#d97706" : "#dc2626";
                  return (
                    <div key={exp.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ fontSize: 9, color: "#9ca3af" }}>{pctInt(exp.f1)}</div>
                      <div style={{ width: "100%", maxWidth: 32, height: h, background: hue, borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} />
                      <div style={{ fontSize: 8, color: "#9ca3af", textAlign: "center", lineHeight: 1.2, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Category filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Filter:</span>
              {[
                ["all", "All"],
                ["amatas", "AMATAS"],
                ["mcp", "MCP"],
              ].map(([id, label]) => (
                <button key={id} onClick={() => setCompCategory(id)} style={{
                  padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                  border: compCategory === id ? "1px solid #2563eb" : "1px solid #e5e7eb",
                  background: compCategory === id ? "#eff6ff" : "#fff",
                  color: compCategory === id ? "#2563eb" : "#6b7280",
                }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Sortable table */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {[
                      { key: "phase", label: "Category" },
                      { key: "name", label: "Experiment" },
                      { key: "f1", label: "F1" },
                      { key: "recall", label: "Recall" },
                      { key: "precision", label: "Precision" },
                      { key: "cost", label: "Cost/flow" },
                      { key: "model", label: "Model" },
                      { key: "flows", label: "Flows" },
                    ].map(col => (
                      <th key={col.key} onClick={() => setCompSort(s => ({
                        key: col.key, dir: s.key === col.key && s.dir === "desc" ? "asc" : "desc"
                      }))} style={{
                        textAlign: col.key === "name" || col.key === "phase" || col.key === "model" ? "left" : "right",
                        padding: "12px 16px", fontWeight: 600, color: "#6b7280", fontSize: 12,
                        borderBottom: "1px solid #e5e7eb", cursor: "pointer", userSelect: "none",
                      }}>
                        {col.label} {compSort.key === col.key ? (compSort.dir === "desc" ? "↓" : "↑") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compExps.map(exp => (
                    <tr key={exp.id} onClick={() => openExperimentDetail(exp.id)} style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer", transition: "background 0.1s" }} onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"} onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <td style={{ padding: "10px 16px", fontSize: 11, color: "#9ca3af" }}>{exp.phase}</td>
                      <td style={{ padding: "10px 16px", fontWeight: 500, color: "#2563eb" }}>{exp.name}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: exp.f1 >= 0.8 ? "#16a34a" : exp.f1 >= 0.5 ? "#d97706" : "#dc2626" }}>{pct(exp.f1)}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>{pct(exp.recall)}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>{pct(exp.precision)}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right", color: "#6b7280" }}>${(exp.cost / exp.flows).toFixed(4)}</td>
                      <td style={{ padding: "10px 16px", fontSize: 11, color: "#6b7280" }}>{exp.model}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>{exp.flows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* ARCHITECTURE                                                       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {topTab === "architecture" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, letterSpacing: "-0.02em" }}>System Architecture</h2>

            {/* Full architecture diagram */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "32px", marginBottom: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, fontFamily: "monospace", fontSize: 13 }}>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 32px", background: "#f9fafb", fontWeight: 600 }}>
                  CICIDS2018 NetFlow v3 &middot; 20M flows &middot; 53 features
                </div>
                <div style={{ color: "#9ca3af" }}>&#8595;</div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 24px", background: "#f9fafb" }}>
                  Stratified Sample &middot; 1000 flows per batch (950 benign + 50 attack)
                </div>
                <div style={{ color: "#9ca3af" }}>&#8595;</div>
                <div style={{ border: "2px solid #2563eb", borderRadius: 8, padding: "16px 32px", textAlign: "center" }}>
                  <div style={{ color: "#2563eb", fontWeight: 600, marginBottom: 4 }}>Tier 1: Random Forest Pre-Filter</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Filters ~95% of flows as obviously benign</div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>Threshold: 0.15 &middot; Trained on development split</div>
                </div>
                <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#9ca3af", fontSize: 11 }}>&#8595; ~50 flows</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>Flagged for LLM analysis</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#16a34a", fontSize: 11 }}>&#8594; ~950 flows</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>Classified BENIGN</div>
                  </div>
                </div>
                <div style={{ color: "#9ca3af" }}>&#8595;</div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 32px", width: "100%", maxWidth: 600 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 12, textAlign: "center" }}>Tier 2: 6-Agent Multi-Agent LLM Pipeline</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                    {AGENTS.filter(a => a.id !== "devils_advocate" && a.id !== "orchestrator").map(a => (
                      <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "10px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: a.color }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{a.desc.slice(0, 30)}...</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", color: "#9ca3af", marginBottom: 8 }}>&#8595;</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ border: "1px solid #fca5a5", borderRadius: 6, padding: "10px", textAlign: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#dc2626" }}>Devil's Advocate</div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>Counter-argument for benign</div>
                    </div>
                    <div style={{ border: "2px solid #2563eb", borderRadius: 6, padding: "10px", textAlign: "center" }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#2563eb" }}>Orchestrator</div>
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>Weighted consensus verdict</div>
                    </div>
                  </div>
                </div>
                <div style={{ color: "#9ca3af" }}>&#8595;</div>
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 32px", background: "#f9fafb", fontWeight: 500 }}>
                  Verdict + Confidence + Attack Type + Full Reasoning Chain
                </div>
              </div>
            </div>

            {/* Agent details */}
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Agent Roles</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {AGENTS.map(a => {
                const isExpanded = expandedPrompts[`arch_${a.id}`];
                return (
                  <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px", gridColumn: isExpanded ? "1 / -1" : undefined }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: a.color, marginBottom: 4 }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 8 }}>{a.desc}</div>
                    <button
                      onClick={() => setExpandedPrompts(prev => ({ ...prev, [`arch_${a.id}`]: !prev[`arch_${a.id}`] }))}
                      style={{ background: "none", border: "none", padding: 0, fontSize: 11, color: a.color, cursor: "pointer", fontWeight: 600 }}
                    >
                      {isExpanded ? "Hide Prompt \u25B2" : "View Prompt \u25BC"}
                    </button>
                    {isExpanded && (
                      <pre style={{
                        marginTop: 8, padding: 12, background: "#f9fafb", border: "1px solid #e5e7eb",
                        borderRadius: 6, fontSize: 11, lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        maxHeight: 300, overflowY: "auto", color: "#374151", fontFamily: "ui-monospace, monospace",
                      }}>
                        {a.prompt}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Agent Cost Distribution ──────────────────────────────── */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "24px", marginTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Agent Cost Distribution</h3>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>
                Averaged across all 14 Stage 1 experiments ({AGENT_COST_DATA.totalLlmFlows} LLM-analysed flows)
              </p>

              {/* Horizontal bar chart */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {[...AGENT_KEYS].sort((a, b) => AGENT_COST_DATA[b].pct - AGENT_COST_DATA[a].pct).map(a => {
                  const d = AGENT_COST_DATA[a];
                  return (
                    <div key={a} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 100, fontSize: 12, fontWeight: 500, color: "#374151", textAlign: "right" }}>{d.label}</div>
                      <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 4, height: 22, position: "relative", overflow: "hidden" }}>
                        <div style={{ width: `${(d.pct / 30) * 100}%`, maxWidth: "100%", background: d.color, height: "100%", borderRadius: 4, transition: "width 0.3s" }} />
                      </div>
                      <div style={{ width: 90, fontSize: 12, color: "#6b7280", textAlign: "right", fontFamily: "monospace" }}>
                        ${d.cost.toFixed(2)} ({d.pct}%)
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <div style={{ textAlign: "center", padding: "16px", background: "#f0fdf4", borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#166534", fontFamily: "monospace" }}>${AGENT_COST_DATA.avgPerLlmFlow.toFixed(3)}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>avg cost per LLM-analysed flow</div>
                </div>
                <div style={{ textAlign: "center", padding: "16px", background: "#eff6ff", borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#1e40af", fontFamily: "monospace" }}>${AGENT_COST_DATA.avgPerBatch.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>avg cost per 1,000-flow batch</div>
                </div>
                <div style={{ textAlign: "center", padding: "16px", background: "#fef2f2", borderRadius: 8 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#991b1b", fontFamily: "monospace" }}>~${(AGENT_COST_DATA.estWithoutTier1 / 14).toFixed(0)}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>Tier 1 saves per batch</div>
                </div>
              </div>

              {/* Insight */}
              <div style={{ marginTop: 16, padding: "12px 16px", background: "#fafafa", borderRadius: 8, border: "1px solid #f3f4f6" }}>
                <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.7 }}>
                  <strong>Orchestrator + DA account for {(AGENT_COST_DATA.orchestrator.pct + AGENT_COST_DATA.devils_advocate.pct).toFixed(1)}%</strong> of
                  all LLM spend — they receive all specialist outputs as context, making their prompts significantly longer.
                  Temporal agent cost varies most across attack types (8–41%) — higher for attacks with many flows from the same IP,
                  as more connected flows are injected as context.
                </div>
              </div>
            </div>

            {/* Dataset info */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px", marginTop: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Dataset: CICIDS2018 NetFlow v3</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, fontSize: 13, marginBottom: 20 }}>
                {[
                  { label: "Total Flows", value: "20,115,529" },
                  { label: "Features", value: "53" },
                  { label: "Attack Types", value: "14" },
                  { label: "Benign Ratio", value: "87%" },
                ].map(d => (
                  <div key={d.label}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{d.value}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{d.label}</div>
                  </div>
                ))}
              </div>

              {/* Stacked proportion bar */}
              <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", marginBottom: 16, border: "1px solid #e5e7eb" }}>
                <div style={{ width: "35%", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 600 }}>Dev 35%</div>
                <div style={{ width: "25%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 600 }}>Val 25%</div>
                <div style={{ width: "40%", background: "#8b5cf6", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 600 }}>Test 40%</div>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginBottom: 20, fontSize: 11 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#dcfce7", border: "1px solid #bbf7d0", display: "inline-block" }}/> In RF training</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#fef3c7", border: "1px solid #fde68a", display: "inline-block" }}/> Caught unseen</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#fee2e2", border: "1px solid #fecaca", display: "inline-block" }}/> RF misses</span>
              </div>

              {/* Three split cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {Object.entries(DATASET_SPLITS).map(([key, split]) => {
                  const borderColor = key === "development" ? "#3b82f6" : key === "validation" ? "#f59e0b" : "#8b5cf6";
                  return (
                    <div key={key} style={{ border: `2px solid ${borderColor}`, borderRadius: 8, padding: "16px", position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{split.label}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{(split.flows / 1e6).toFixed(2)}M flows ({split.pct}%)</div>
                        </div>
                        {split.badge && (
                          <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: "#dbeafe", color: "#1e40af" }}>{split.badge}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {Object.entries(split.attacks).map(([at, count]) => {
                          const pill = rfPillColor(at);
                          const display = count >= 1000 ? `${(count / 1000).toFixed(0)}K` : String(count);
                          return (
                            <span key={at} style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 500, background: pill.bg, color: pill.color, whiteSpace: "nowrap" }}>
                              {at.replace(/_/g, " ").replace("attacks-", "")} ({display})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Data Integrity & Split Design ─────────────────────────────── */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "24px", marginTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Data Integrity &amp; Split Design</h3>

              {/* Flow diagram */}
              <div style={{ fontFamily: "monospace", fontSize: 12, lineHeight: 1.6, background: "#f9fafb", borderRadius: 8, padding: "24px", marginBottom: 20, overflowX: "auto" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ border: "2px solid #1e40af", borderRadius: 8, padding: "10px 24px", background: "#eff6ff", fontWeight: 600, textAlign: "center" }}>
                    NF-CICIDS2018-v3.csv&nbsp;&nbsp;(20.1M flows)
                  </div>
                  <div style={{ color: "#9ca3af" }}>|</div>
                  <div style={{ display: "flex", gap: 48, alignItems: "flex-start" }}>
                    {/* Left branch: development */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ border: "2px solid #3b82f6", borderRadius: 8, padding: "10px 16px", textAlign: "center" }}>
                        <div style={{ fontWeight: 600, color: "#1e40af" }}>development</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>7.04M flows &middot; 7 attack types</div>
                      </div>
                      <div style={{ color: "#9ca3af" }}>|</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>80 / 20 split</div>
                      <div style={{ color: "#9ca3af" }}>|</div>
                      <div style={{ display: "flex", gap: 16 }}>
                        <div style={{ border: "2px solid #16a34a", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                          <div style={{ fontWeight: 600, color: "#16a34a" }}>train</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>5.63M</div>
                          <div style={{ fontSize: 10, color: "#16a34a", marginTop: 2 }}>RF trains here</div>
                        </div>
                        <div style={{ border: "2px solid #2563eb", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                          <div style={{ fontWeight: 600, color: "#2563eb" }}>eval</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>1.41M</div>
                          <div style={{ fontSize: 10, color: "#2563eb", marginTop: 2 }}>Batch source</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: "#16a34a", marginTop: 4, textAlign: "center" }}>&#8593; RF never sees eval</div>
                    </div>
                    {/* Right branch: validation + test */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ border: "2px solid #8b5cf6", borderRadius: 8, padding: "10px 16px", textAlign: "center" }}>
                        <div style={{ fontWeight: 600, color: "#6d28d9" }}>validation + test</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>13.07M flows &middot; 7 attack types</div>
                      </div>
                      <div style={{ color: "#9ca3af", marginTop: 8 }}>&#8593;</div>
                      <div style={{ fontSize: 11, color: "#6b7280", textAlign: "center", maxWidth: 160, lineHeight: 1.5, background: "#f0fdf4", padding: "6px 10px", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                        These results are fully clean — RF never trained here
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clean vs Rerun labels */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div style={{ border: "1px solid #bbf7d0", borderRadius: 8, padding: "12px 16px", background: "#f0fdf4" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#166534", marginBottom: 4 }}>
                    <span style={{ marginRight: 6 }}>&#x1F7E2;</span>CLEAN (no overlap)
                  </div>
                  <div style={{ fontSize: 12, color: "#166534", lineHeight: 1.6 }}>
                    Bot, Infilteration, SQL_Injection, Brute_Force-XSS, Brute_Force-Web, DDOS-HOIC, DDOS-LOIC-UDP
                  </div>
                </div>
                <div style={{ border: "1px solid #93c5fd", borderRadius: 8, padding: "12px 16px", background: "#eff6ff" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", marginBottom: 4 }}>
                    <span style={{ marginRight: 6 }}>&#x1F535;</span>RERUN (clean split applied)
                  </div>
                  <div style={{ fontSize: 12, color: "#1e40af", lineHeight: 1.6 }}>
                    FTP-BruteForce, SSH-Bruteforce, DDoS-LOIC-HTTP, DoS-Hulk, DoS-SlowHTTPTest, DoS-GoldenEye, DoS-Slowloris
                  </div>
                </div>
              </div>

              {/* Explanation paragraph */}
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, margin: 0, textAlign: "justify" }}>
                During evaluation we identified a within-split overlap in the Tier 1 pre-filter training data.
                The original RF was trained on development.csv and evaluated on batches also sourced from development.csv.
                To ensure methodological rigour, development data was sub-split 80/20 and the RF retrained on the training
                partition only. The 7 affected attack types were rerun with batches sourced exclusively from the 20% holdout
                the RF never saw. The remaining 7 attack types were always sourced from separate validation and test splits
                and required no rerun.
              </p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* THESIS DRAFTS                                                      */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {topTab === "thesis" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, letterSpacing: "-0.02em" }}>Thesis Chapter Drafts</h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
              Auto-generated academic prose from experiment results. Each draft covers one attack type evaluation.
            </p>

            {/* Trigger fetch on tab open — uses a hidden component */}

            {thesisDrafts.length === 0 && !selectedDraftContent && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "48px", textAlign: "center", color: "#9ca3af" }}>
                <p style={{ fontSize: 16, marginBottom: 8 }}>No thesis drafts generated yet</p>
                <p style={{ fontSize: 13 }}>
                  Run <code style={{ background: "#f3f4f6", padding: "2px 6px", borderRadius: 4 }}>python scripts/generate_chapter_draft.py results/stage1/FTP-BruteForce_results.json</code> to generate the first draft.
                </p>
              </div>
            )}

            {thesisDrafts.length > 0 && !selectedDraftContent && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["Attack Type", "Words", "Generated", ""].map(h => (
                        <th key={h} style={{ textAlign: h === "" ? "right" : "left", padding: "12px 16px", fontWeight: 600, color: "#6b7280", fontSize: 12, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {thesisDrafts.map(d => (
                      <tr key={d.file} style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                        onClick={async () => {
                          setSelectedDraft(d);
                          try {
                            const resp = await fetch(`${RESULTS_BASE.replace("/results", "")}/results/thesis_drafts/${d.file}?t=${Date.now()}`);
                            if (resp.ok) setSelectedDraftContent(await resp.text());
                            else setSelectedDraftContent("Failed to load draft.");
                          } catch (_) { setSelectedDraftContent("Failed to load draft."); }
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                        onMouseLeave={e => e.currentTarget.style.background = ""}
                      >
                        <td style={{ padding: "12px 16px", fontWeight: 500, color: "#2563eb" }}>{d.attack_type}</td>
                        <td style={{ padding: "12px 16px", color: "#6b7280" }}>{d.words}</td>
                        <td style={{ padding: "12px 16px", color: "#6b7280" }}>{d.generated}</td>
                        <td style={{ padding: "12px 16px", textAlign: "right", color: "#2563eb", fontSize: 12 }}>View &#8594;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedDraftContent && (
              <div>
                {/* Back + actions bar */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <button onClick={() => { setSelectedDraftContent(null); setSelectedDraft(null); }} style={{
                    padding: "6px 14px", border: "1px solid #e5e7eb", borderRadius: 6,
                    background: "none", cursor: "pointer", fontSize: 13, color: "#374151",
                  }}>
                    &#8592; Back to list
                  </button>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#9ca3af" }}>
                      {selectedDraftContent.split(/\s+/).length} words
                    </span>
                    <button onClick={() => navigator.clipboard.writeText(selectedDraftContent)} style={{
                      padding: "6px 14px", border: "1px solid #e5e7eb", borderRadius: 6,
                      background: "none", cursor: "pointer", fontSize: 12, color: "#374151",
                    }}>
                      Copy
                    </button>
                    <button onClick={() => {
                      const blob = new Blob([selectedDraftContent], { type: "text/markdown" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url; a.download = selectedDraft?.file || "draft.md"; a.click();
                      URL.revokeObjectURL(url);
                    }} style={{
                      padding: "6px 14px", border: "1px solid #2563eb", borderRadius: 6,
                      background: "#2563eb", cursor: "pointer", fontSize: 12, color: "#fff", fontWeight: 500,
                    }}>
                      Download .md
                    </button>
                  </div>
                </div>

                {/* Rendered markdown */}
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "32px", background: "#fafafa", lineHeight: 1.8, fontSize: 14, color: "#374151" }}>
                  {selectedDraftContent.split("\n").map((line, i) => {
                    if (line.startsWith("#### ")) return <h4 key={i} style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginTop: 24, marginBottom: 8 }}>{line.replace("#### ", "")}</h4>;
                    if (line.startsWith("### ")) return <h3 key={i} style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 12, letterSpacing: "-0.02em" }}>{line.replace("### ", "")}</h3>;
                    if (line.trim() === "") return <div key={i} style={{ height: 8 }} />;
                    return <p key={i} style={{ margin: "0 0 12px", textAlign: "justify" }}>{line}</p>;
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* WHAT'S NEXT                                                        */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {topTab === "next" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24, letterSpacing: "-0.02em" }}>What's Next</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 700 }}>
              {[
                {
                  title: "Stage 1: All 14 Attack Types",
                  desc: "Per-attack evaluation across all 14 CICIDS2018 attack types. 1000 flows each (50 attack + 950 benign) with Tier-1 RF pre-filtering + GPT-4o 6-agent pipeline. 12/14 types detected at 82%+ recall, 0% FPR across the board. Total cost: $27.35.",
                  status: "Complete",
                  statusColor: "#16a34a",
                },
                {
                  title: "MCP Comparison Experiment",
                  desc: "Three single-agent configs vs AMATAS: (A) GPT-4o-mini zero-shot (90% recall, 41% FPR), (B) GPT-4o engineered prompt (67% recall, 27% FPR), (C) GPT-4o + MITRE tool (70% recall, 30% FPR). AMATAS v2 achieves 88% F1 with 1.1% FPR — no single agent comes close.",
                  status: "Complete",
                  statusColor: "#16a34a",
                },
                {
                  title: "Infilteration Deep Dive",
                  desc: "Infilteration scored 0% recall — attack flows are DNS/NTP/DHCP queries statistically identical to benign traffic. Tier 1 RF filtered 40/50 attacks as benign; the LLM missed the remaining 10. Individual-flow analysis cannot detect this attack; temporal clustering is the hypothesis.",
                  status: "Investigating",
                  statusColor: "#d97706",
                },
                {
                  title: "AMATAS v3: Temporal Clustering",
                  desc: "Group flows by source IP within time windows before LLM analysis. Hypothesis: clustered context reveals exfiltration patterns (46 DNS queries from one IP) invisible at the individual flow level. Primary target: Infilteration recovery from 0% recall.",
                  status: "Next Up",
                  statusColor: "#2563eb",
                },
                {
                  title: "Test Set Final Evaluation",
                  desc: "Run the complete AMATAS v2 (and v3 if clustering works) pipeline on the held-out test.csv split (8.05M flows). This is the final evaluation for the thesis — no parameter tuning allowed.",
                  status: "Planned",
                  statusColor: "#6b7280",
                },
                {
                  title: "Thesis Write-Up",
                  desc: "Compile all experimental results into the formal thesis. Key contributions: two-tier ML+LLM architecture, per-attack-type evaluation at realistic distributions, explainable verdicts via multi-agent reasoning chains, and the role of temporal context in NIDS.",
                  status: "In Progress",
                  statusColor: "#2563eb",
                },
              ].map(item => (
                <div key={item.title} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{item.title}</h3>
                    <span style={{ padding: "2px 10px", borderRadius: 4, fontSize: 11, fontWeight: 500, color: item.statusColor, border: `1px solid ${item.statusColor}30` }}>
                      {item.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid #e5e7eb", padding: "16px 32px", display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af" }}>
        <span>AMATAS — Autonomous Multi-Agent Threat Analysis System &middot; University Thesis 2026</span>
        <span>Last updated: {lastFetched ? lastFetched.toLocaleString() : "Not yet fetched"}</span>
      </footer>
    </div>
  );
}
