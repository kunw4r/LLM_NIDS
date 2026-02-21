import { useState, useEffect, useRef } from "react";

// ── Fonts via Google Fonts injection ──────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap";
document.head.appendChild(fontLink);

// ── Phase 1 flow-level data (20 sampled flows from MCP baseline) ────────────
const FLOWS = [
  { id:0,  src:"172.31.0.2",      dst:"172.31.66.58",    port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Benign",         conf:0.95, tier:4, tools:4, cost:0.0745, time:23, hit:true,  reasoning:"Single DNS response from internal DNS server. Normal UDP port 53 pattern with reasonable 156-byte response. No malicious indicators." },
  { id:1,  src:"18.221.219.4",    dst:"172.31.69.25",    port:21,   proto:"TCP", verdict:"SUSPICIOUS", actual:"FTP-BruteForce",  conf:0.50, tier:1, tools:4, cost:0.0727, time:27, hit:true,  reasoning:"AbuseIPDB: 0 reports. OTX: no threats. Geolocation: AWS Ohio. Despite 0% external intel return, flagged as suspicious due to FTP port 21 pattern from datacenter IP." },
  { id:2,  src:"18.221.219.4",    dst:"172.31.69.25",    port:21,   proto:"TCP", verdict:"SUSPICIOUS", actual:"FTP-BruteForce",  conf:0.50, tier:1, tools:4, cost:0.0707, time:26, hit:true,  reasoning:"Repeated FTP connection from same AWS IP. Continuing pattern of port 21 connections with SYN-ACK flags — incremented source port suggests automated tooling." },
  { id:3,  src:"18.221.219.4",    dst:"172.31.69.25",    port:21,   proto:"TCP", verdict:"SUSPICIOUS", actual:"FTP-BruteForce",  conf:0.50, tier:1, tools:8, cost:0.0884, time:41, hit:true,  reasoning:"Three consecutive FTP flows, same target, incrementing source ports. IP history confirms repeated brute-force pattern." },
  { id:4,  src:"172.31.66.58",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Benign",         conf:0.95, tier:4, tools:4, cost:0.0799, time:42, hit:true,  reasoning:"DNS A record query from internal host. 65-byte query, 185-byte response — within normal DNS range." },
  { id:5,  src:"13.58.98.64",     dst:"172.31.69.25",    port:21,   proto:"TCP", verdict:"SUSPICIOUS", actual:"SSH-Bruteforce",  conf:0.50, tier:1, tools:4, cost:0.0720, time:38, hit:true,  reasoning:"New AWS Ohio IP targeting FTP port. AbuseIPDB: 0 reports. OTX: clean." },
  { id:6,  src:"13.58.98.64",     dst:"172.31.69.25",    port:21,   proto:"TCP", verdict:"SUSPICIOUS", actual:"SSH-Bruteforce",  conf:0.50, tier:1, tools:4, cost:0.0702, time:41, hit:true,  reasoning:"Second flow from same IP. External tools remain silent — zero threat intelligence for recycled 2018 AWS IPs." },
  { id:7,  src:"172.31.66.29",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"SUSPICIOUS", actual:"Benign",         conf:0.50, tier:4, tools:4, cost:0.0724, time:34, hit:false, reasoning:"FALSE POSITIVE: Single DNS A record query. Private RFC1918 addressing. Normal packet sizes. Agent flagged suspicious despite no anomalies." },
  { id:8,  src:"13.58.98.64",     dst:"172.31.69.25",    port:22,   proto:"TCP", verdict:"SUSPICIOUS", actual:"SSH-Bruteforce",  conf:0.50, tier:1, tools:4, cost:0.0690, time:47, hit:true,  reasoning:"SSH connection (port 22) from same IP that was doing FTP probes. Duration 373ms, 23 packets — consistent with SSH brute force." },
  { id:9,  src:"18.219.211.138",  dst:"172.31.69.25",    port:80,   proto:"TCP", verdict:"SUSPICIOUS", actual:"DoS_GoldenEye",   conf:0.50, tier:2, tools:4, cost:0.0697, time:27, hit:true,  reasoning:"HTTP connections (port 80) from AWS Ohio. Flow characteristics consistent with slow-rate DoS preamble." },
  { id:12, src:"172.31.66.58",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Benign",         conf:0.95, tier:4, tools:4, cost:0.0787, time:27, hit:true,  reasoning:"DNS AAAA query (IPv6 lookup). Query type 28, normal for modern networks." },
  { id:20, src:"172.31.66.29",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Benign",         conf:0.98, tier:4, tools:4, cost:0.0829, time:30, hit:true,  reasoning:"DNS A record from host with prior HTTPS to Google infrastructure. Benign confirmed." },
  { id:23, src:"18.219.193.20",   dst:"172.31.69.25",    port:80,   proto:"TCP", verdict:"BENIGN",     actual:"DoS_Hulk",       conf:0.95, tier:2, tools:6, cost:0.0860, time:28, hit:false, reasoning:"MISSED: Agent saw 3 HTTP flows, classified as benign web browsing. Hulk DoS requires volume detection — single-flow analysis insufficient." },
  { id:25, src:"52.14.136.135",   dst:"172.31.69.25",    port:80,   proto:"TCP", verdict:"SUSPICIOUS", actual:"DDoS_LOIC-HTTP",  conf:0.50, tier:2, tools:4, cost:0.0635, time:135, hit:true, reasoning:"Tool errors on all calls (MCP timeout). Agent defaulted to SUSPICIOUS — correct verdict from baseline caution." },
  { id:43, src:"172.31.69.28",    dst:"172.31.69.1",     port:67,   proto:"UDP", verdict:"BENIGN",     actual:"Brute_Force_XSS", conf:0.98, tier:3, tools:4, cost:0.0704, time:146, hit:false, reasoning:"MISSED: Agent identified DHCP pattern (port 67/68, UDP). XSS brute force camouflaged with DHCP-like characteristics." },
  { id:44, src:"172.31.69.28",    dst:"172.31.69.1",     port:67,   proto:"UDP", verdict:"BENIGN",     actual:"Brute_Force_XSS", conf:0.98, tier:3, tools:4, cost:0.0715, time:147, hit:false, reasoning:"MISSED: Repeated DHCP flow pattern. Without cross-flow context, XSS disguise is convincing." },
  { id:50, src:"172.31.69.12",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Infilteration",  conf:0.95, tier:3, tools:4, cost:0.0707, time:145, hit:false, reasoning:"MISSED: Single DNS AAAA query. Part of a 30-flow burst from 2 IPs in 3.2 seconds — temporal context required." },
  { id:51, src:"172.31.69.12",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Infilteration",  conf:0.95, tier:3, tools:4, cost:0.0738, time:152, hit:false, reasoning:"MISSED: Identical DNS pattern. The infiltration signature is 30 consecutive DNS queries in 3.2 seconds — invisible to single-flow analysis." },
  { id:52, src:"172.31.69.12",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"SUSPICIOUS", actual:"Infilteration",  conf:0.50, tier:3, tools:4, cost:0.0642, time:135, hit:true,  reasoning:"Tool errors led to default SUSPICIOUS. Ironically correct verdict — from tool failure, not actual detection." },
  { id:53, src:"172.31.67.91",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"SUSPICIOUS", actual:"Benign",         conf:0.95, tier:4, tools:4, cost:0.0695, time:145, hit:false, reasoning:"FALSE POSITIVE: Agent output says BENIGN in reasoning but verdict field shows SUSPICIOUS. Parsing inconsistency." },
];

// ── All experiments across all phases ────────────────────────────────────────
const EXPERIMENTS = [
  {
    id: "phase3e",
    name: "Phase 3e — DA Weight 50%",
    phase: 3,
    date: "2026-02-20",
    status: "complete",
    flows: 100,
    cost: "$6.54",
    time: "60 min",
    accuracy: "60.0%",
    f1: "25.9%",
    precision: "16.7%",
    recall: "58.3%",
    changes: "Increased Devil's Advocate weight from 30% to 50% in orchestrator consensus. Modified consensus thresholds: 4/4 specialists + strong DA now yields SUSPICIOUS instead of MALICIOUS. 3/4 specialists + strong DA now yields BENIGN. Tested whether DA can override specialist FP consensus.",
    notes: "Fixed 6 FPs without introducing any new errors (0 worsened flows). But 35 FPs remain — 34 of which have 4/4 specialists unanimously wrong. DA argues benign with 0.80 mean confidence on these, but orchestrator won't override unanimous specialist consensus even at 50% weight. Proves FP problem is in specialist prompts, not orchestrator weighting.",
    variables: { architecture: "6-agent multi-agent", model: "claude-sonnet-4-20250514", batch_size: 100, benign_ratio: "88%", da_weight: "50%", specialist_parallel: true, temporal_context: "batch-level" },
    confusion: { tp: 7, fp: 35, tn: 53, fn: 5 },
    verdicts: { benign: 58, suspicious: 40, malicious: 2 },
  },
  {
    id: "phase3c",
    name: "Phase 3c — Realistic Distribution",
    phase: 3,
    date: "2026-02-20",
    status: "complete",
    flows: 100,
    cost: "$6.51",
    time: "58 min",
    accuracy: "54.0%",
    f1: "23.3%",
    precision: "14.6%",
    recall: "58.3%",
    changes: "First test on realistic class distribution (88% benign, 12% attack). Same 6-agent architecture as 3a/3b with 30% DA weight. Uses medium batch_100 which contains DDOS-HOIC, DoS-Hulk, FTP-BruteForce, and Infiltration attack types.",
    notes: "Catastrophic false positive explosion: 41 of 88 benign flows flagged as attacks. Precision collapsed to 14.6%. Root cause: specialists hallucinate attack patterns in normal traffic (HTTPS, DNS, NTP). 35/41 FPs had unanimous 4/4 specialist agreement on MALICIOUS — the DA cannot override this. Exposed a fundamental prompt engineering problem.",
    variables: { architecture: "6-agent multi-agent", model: "claude-sonnet-4-20250514", batch_size: 100, benign_ratio: "88%", da_weight: "30%", specialist_parallel: true, temporal_context: "batch-level" },
    confusion: { tp: 7, fp: 41, tn: 47, fn: 5 },
    verdicts: { benign: 52, suspicious: 38, malicious: 10 },
  },
  {
    id: "phase3b",
    name: "Phase 3b — Scale Test",
    phase: 3,
    date: "2026-02-20",
    status: "complete",
    flows: 150,
    cost: "$11.11",
    time: "83 min",
    accuracy: "94.0%",
    f1: "95.9%",
    precision: "92.1%",
    recall: "100%",
    changes: "Scaled to 150 flows (capped from 500 for cost). Contains 6 attack types: FTP-BruteForce, SSH-Bruteforce, DoS-GoldenEye, DoS-Slowloris, DoS-SlowHTTPTest. 30 flows per attack type + 45 benign. Rich temporal context: ~30 same-IP flows available per source.",
    notes: "Best results across all experiments. 100% recall — zero missed attacks. Temporal agent excelled with rich same-IP flow context (30+ flows per source IP). Only 9 FPs from 45 benign flows (80% benign accuracy). The multi-agent architecture with temporal context dramatically outperforms single-agent approaches.",
    variables: { architecture: "6-agent multi-agent", model: "claude-sonnet-4-20250514", batch_size: 150, benign_ratio: "30%", da_weight: "30%", specialist_parallel: true, temporal_context: "batch-level" },
    confusion: { tp: 105, fp: 9, tn: 36, fn: 0 },
    verdicts: { benign: 36, suspicious: 33, malicious: 81 },
  },
  {
    id: "phase3a",
    name: "Phase 3a — Multi-Agent Baseline",
    phase: 3,
    date: "2026-02-20",
    status: "complete",
    flows: 58,
    cost: "$3.85",
    time: "30 min",
    accuracy: "67.2%",
    f1: "71.6%",
    precision: "100%",
    recall: "55.8%",
    changes: "New 6-agent multi-agent architecture: 4 specialist agents (protocol, statistical, behavioural, temporal) analyse each flow in parallel, followed by a Devil's Advocate agent that argues for benign interpretation, then an Orchestrator that makes weighted consensus verdict. No MCP tools — pure LLM reasoning on NetFlow features. DA weight: 30%.",
    notes: "Perfect precision (0 FPs) but low recall (55.8%, 19 FN). The DA agent was too aggressive — successfully argued benign on many true attacks. Tested on same 58-flow mini batch as Phase 1 iterations for direct comparison. Multi-agent is 2x faster than MCP approach (30 min vs 88 min).",
    variables: { architecture: "6-agent multi-agent", model: "claude-sonnet-4-20250514", batch_size: 58, benign_ratio: "26%", da_weight: "30%", specialist_parallel: true, temporal_context: "batch-level" },
    confusion: { tp: 24, fp: 0, tn: 15, fn: 19 },
    verdicts: { benign: 34, suspicious: 16, malicious: 8 },
  },
  {
    id: "iter_2",
    name: "Phase 2 Iter 2 — Benign Calibration",
    phase: 2,
    date: "2026-02-19",
    status: "complete",
    flows: 58,
    cost: "$7.18",
    time: "223 min",
    accuracy: "67.2%",
    f1: "77.6%",
    precision: "78.6%",
    recall: "76.7%",
    changes: "Adds calibration guidance teaching the agent that empty threat intel for RFC1918/private IPs is expected — not suspicious. Defines known-benign traffic patterns (DNS, DHCP, HTTPS). Requires POSITIVE evidence of anomaly before flagging suspicious.",
    notes: "Balanced trade-off: FP reduced 13 to 9 vs baseline, benign accuracy up from 13.3% to 40%. Recall drops from 93% to 77% — agent now misses some attacks it previously caught by over-flagging.",
    variables: { architecture: "single-agent + MCP", model: "claude-sonnet-4-20250514", batch_size: 58, benign_ratio: "26%", da_weight: "N/A", specialist_parallel: false, temporal_context: "none" },
    confusion: { tp: 33, fp: 9, tn: 6, fn: 10 },
    verdicts: { benign: 16, suspicious: 37, malicious: 5 },
  },
  {
    id: "iter_1",
    name: "Phase 2 Iter 1 — Temporal Memory",
    phase: 2,
    date: "2026-02-19",
    status: "complete",
    flows: 58,
    cost: "$6.73",
    time: "218 min",
    accuracy: "67.2%",
    f1: "75.3%",
    precision: "85.3%",
    recall: "67.4%",
    changes: "Adds SQLite-based temporal store tracking all analysed flows. Before each flow analysis, queries recent activity from same source IP within a 60-second window.",
    notes: "Best precision of Phase 2 (85.3%) but worst recall (67.4%). Temporal context only injected for 2/58 flows (3.4% injection rate) — batch lacked temporal density.",
    variables: { architecture: "single-agent + MCP", model: "claude-sonnet-4-20250514", batch_size: 58, benign_ratio: "26%", da_weight: "N/A", specialist_parallel: false, temporal_context: "SQLite 60s window" },
    confusion: { tp: 29, fp: 5, tn: 10, fn: 14 },
    verdicts: { benign: 24, suspicious: 29, malicious: 5 },
  },
  {
    id: "baseline",
    name: "Phase 1 — MCP Baseline",
    phase: 1,
    date: "2026-02-19",
    status: "complete",
    flows: 58,
    cost: "$3.98",
    time: "88 min",
    accuracy: "72.4%",
    f1: "83.3%",
    precision: "75.5%",
    recall: "93.0%",
    changes: "Baseline MCP single-agent evaluation. max_iterations=5, model=sonnet-4. Agent uses all 13 MCP tools: threat intel (AbuseIPDB, OTX, geolocation), MITRE ATT&CK mapping, and NetFlow behavioral analyzer.",
    notes: "0/142 external tool calls returned meaningful data (private/anonymized IPs). Best recall (93%) but worst precision (75.5%). Agent defaults to SUSPICIOUS when uncertain — 53/58 flows flagged suspicious.",
    variables: { architecture: "single-agent + MCP", model: "claude-sonnet-4-20250514", batch_size: 58, benign_ratio: "26%", da_weight: "N/A", specialist_parallel: false, temporal_context: "none" },
    confusion: { tp: 40, fp: 13, tn: 2, fn: 3 },
    verdicts: { benign: 5, suspicious: 53, malicious: 0 },
  },
];

// ── Phase 3 agents (actual architecture) ────────────────────────────────────
const AGENTS = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    model: "claude-sonnet-4-20250514",
    role: "Synthesizes all specialist and DA analyses into final weighted consensus verdict. Applies configurable consensus thresholds based on specialist agreement count and DA argument strength.",
    color: "#00d4aa",
    icon: "O",
    stats: { calls: 308, cost: "$4.61", avgCost: "$0.015" }
  },
  {
    id: "protocol",
    name: "Protocol",
    model: "claude-sonnet-4-20250514",
    role: "Validates protocol/port/flag consistency. Checks port-service alignment, TCP flag sequences, packet size norms, and FTP/DNS field correctness.",
    color: "#3b82f6",
    icon: "P",
    stats: { calls: 308, cost: "$2.51", avgCost: "$0.008" }
  },
  {
    id: "statistical",
    name: "Statistical",
    model: "claude-sonnet-4-20250514",
    role: "Detects statistical anomalies in traffic features: volume asymmetry, throughput spikes, IAT patterns, retransmissions, TCP window sizes, and flow duration outliers.",
    color: "#a855f7",
    icon: "S",
    stats: { calls: 308, cost: "$2.63", avgCost: "$0.009" }
  },
  {
    id: "behavioural",
    name: "Behavioural",
    model: "claude-sonnet-4-20250514",
    role: "Matches flow patterns against known attack signatures (brute force, DoS variants, DDoS, web attacks, scanning, botnet, exfiltration). Maps findings to MITRE ATT&CK technique IDs.",
    color: "#f59e0b",
    icon: "B",
    stats: { calls: 308, cost: "$2.90", avgCost: "$0.009" }
  },
  {
    id: "temporal",
    name: "Temporal",
    model: "claude-sonnet-4-20250514",
    role: "Analyses cross-flow patterns from the same source IP within the batch. Detects burst activity, sequential escalation, repetitive connection patterns, and coordinated targeting.",
    color: "#ec4899",
    icon: "T",
    stats: { calls: 308, cost: "$4.11", avgCost: "$0.013" }
  },
  {
    id: "devils_advocate",
    name: "Devil's Advocate",
    model: "claude-sonnet-4-20250514",
    role: "Argues for the BENIGN interpretation of every flow, regardless of specialist findings. Provides alternative explanations, identifies weaknesses in the malicious case. Acts as false-positive counterbalance.",
    color: "#ef4444",
    icon: "D",
    stats: { calls: 308, cost: "$4.71", avgCost: "$0.015" }
  },
];

// ── Per-attack detection rates across Phase 3 (aggregate) ───────────────────
const ATTACK_RATES = [
  { type: "FTP-BruteForce",        total: 38, detected: 38, rate: 1.00,  f1: 1.00  },
  { type: "SSH-Bruteforce",        total: 33, detected: 33, rate: 1.00,  f1: 1.00  },
  { type: "DoS-SlowHTTPTest",      total: 8,  detected: 8,  rate: 1.00,  f1: 1.00  },
  { type: "DDOS-LOIC-UDP",         total: 3,  detected: 3,  rate: 1.00,  f1: 1.00  },
  { type: "Bot",                   total: 3,  detected: 3,  rate: 1.00,  f1: 1.00  },
  { type: "Brute_Force-Web",       total: 3,  detected: 3,  rate: 1.00,  f1: 1.00  },
  { type: "DoS-Slowloris",         total: 23, detected: 21, rate: 0.91,  f1: 0.95  },
  { type: "DoS-GoldenEye",         total: 23, detected: 20, rate: 0.87,  f1: 0.93  },
  { type: "SQL_Injection",         total: 3,  detected: 2,  rate: 0.67,  f1: 0.80  },
  { type: "DDOS-HOIC",             total: 9,  detected: 4,  rate: 0.44,  f1: 0.62  },
  { type: "DDoS-LOIC-HTTP",        total: 3,  detected: 1,  rate: 0.33,  f1: 0.50  },
  { type: "DoS-Hulk",              total: 4,  detected: 0,  rate: 0.00,  f1: 0.00  },
  { type: "Infilteration",         total: 4,  detected: 0,  rate: 0.00,  f1: 0.00  },
  { type: "Brute_Force-XSS",       total: 3,  detected: 0,  rate: 0.00,  f1: 0.00  },
];

// ── DA impact data ──────────────────────────────────────────────────────────
const DA_IMPACT = {
  totalFlips: 15,
  correctFlips: 10,
  incorrectFlips: 5,
  flipAccuracy: 66.7,
  noEffect: 144,
  unanimousBenign: 85,
};

// ── Specialist agreement data ───────────────────────────────────────────────
const AGREEMENT = {
  distribution: { "4/4": 53, "3/4": 77, "2/4": 29, "1/4": 64, "0/4": 85 },
  unanimousRate: 44.8,
  perAgent: {
    protocol:    { malicious: 9,  suspicious: 83,  benign: 216 },
    statistical: { malicious: 23, suspicious: 126, benign: 159 },
    behavioural: { malicious: 13, suspicious: 128, benign: 167 },
    temporal:    { malicious: 129, suspicious: 54, benign: 125 },
  }
};

const MISSED = FLOWS.filter(f => f.reasoning.startsWith("MISSED") || f.reasoning.startsWith("FALSE"));
const HITS   = FLOWS.filter(f => !f.reasoning.startsWith("MISSED") && !f.reasoning.startsWith("FALSE") && f.hit);

// ── Colour helpers ─────────────────────────────────────────────────────────────
const verdictColour = (v) => ({
  "BENIGN":    { bg: "#0f291f", border: "#166534", text: "#4ade80" },
  "SUSPICIOUS":{ bg: "#2a1f0a", border: "#92400e", text: "#fbbf24" },
  "MALICIOUS": { bg: "#2a0a0a", border: "#991b1b", text: "#f87171" },
}[v] || { bg: "#1c2a3a", border: "#334155", text: "#94a3b8" });

const tierLabel = (t) => ["","External Tool","Feature-Rich","Temporal","Benign Baseline"][t] || "";
const tierColour = (t) => ["","#3b82f6","#a855f7","#f59e0b","#64748b"][t] || "#64748b";

const phaseColour = (p) => ({ 1: "#64748b", 2: "#f59e0b", 3: "#00d4aa" }[p] || "#475569");

const rateColour = (r) => {
  if (r >= 0.9) return "#4ade80";
  if (r >= 0.6) return "#fbbf24";
  if (r >= 0.3) return "#f97316";
  return "#f87171";
};

// ── CSS ────────────────────────────────────────────────────────────────────────
const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body, #root { background: #060a10; }

  .nids {
    font-family: 'Space Mono', monospace;
    background: #060a10;
    color: #c8d8e8;
    min-height: 100vh;
    font-size: 12px;
  }

  .header {
    background: #080d15;
    border-bottom: 1px solid #1a2840;
    padding: 0 24px;
    display: flex;
    align-items: center;
    gap: 24px;
    height: 52px;
  }
  .header-title {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 16px;
    color: #00d4aa;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .header-sub { color: #475569; font-size: 10px; margin-left: auto; }
  .status-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: #00d4aa;
    box-shadow: 0 0 6px #00d4aa;
    animation: pulse 2s infinite;
  }
  @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }

  .tabs {
    display: flex;
    gap: 0;
    background: #080d15;
    border-bottom: 1px solid #1a2840;
    padding: 0 24px;
    overflow-x: auto;
  }
  .tab {
    padding: 10px 16px;
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: #475569;
    border: none;
    background: none;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .tab:hover { color: #94a3b8; }
  .tab.active { color: #00d4aa; border-bottom-color: #00d4aa; }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    border: 1px solid;
  }

  .content { padding: 20px 24px; }

  .flow-table { width: 100%; border-collapse: collapse; }
  .flow-table th {
    text-align: left;
    padding: 8px 12px;
    font-size: 10px;
    color: #475569;
    border-bottom: 1px solid #1a2840;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .flow-row {
    border-bottom: 1px solid #0f1a28;
    transition: background 0.1s;
    cursor: pointer;
  }
  .flow-row:hover { background: #0c1824; }
  .flow-row.selected { background: #0d1e30; }
  .flow-row.missed { border-left: 2px solid #ef4444; }
  .flow-row.fp { border-left: 2px solid #f59e0b; }
  .flow-row td { padding: 7px 12px; }
  .mono { font-family: 'Space Mono', monospace; font-size: 11px; }

  .detail-panel {
    background: #080d15;
    border: 1px solid #1a2840;
    border-radius: 6px;
    padding: 16px;
    margin-top: 16px;
  }
  .detail-title {
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 13px;
    color: #e2e8f0;
    margin-bottom: 12px;
  }

  .agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
  .agent-card {
    background: #080d15;
    border: 1px solid #1a2840;
    border-radius: 6px;
    padding: 16px;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .agent-card:hover { border-color: #2a3f5f; }
  .agent-card.selected { border-color: #00d4aa; }
  .agent-icon { font-size: 20px; margin-bottom: 8px; font-family: 'Syne', sans-serif; font-weight: 800; }
  .agent-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .agent-model { font-size: 10px; color: #475569; margin-bottom: 8px; }
  .agent-role { font-size: 11px; color: #64748b; line-height: 1.5; }
  .stat-row { display: flex; gap: 16px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #1a2840; }
  .stat { display: flex; flex-direction: column; gap: 2px; }
  .stat-val { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 16px; }
  .stat-label { font-size: 9px; color: #475569; letter-spacing: 0.08em; text-transform: uppercase; }

  .btn {
    padding: 7px 16px;
    border-radius: 4px;
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    cursor: pointer;
    border: 1px solid;
    transition: all 0.15s;
  }
  .btn-primary { background: #00d4aa22; border-color: #00d4aa; color: #00d4aa; }
  .btn-primary:hover { background: #00d4aa33; }
  .btn-ghost { background: transparent; border-color: #1a2840; color: #475569; }
  .btn-ghost:hover { border-color: #2a3f5f; color: #94a3b8; }

  .comparison-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .compare-card {
    background: #080d15;
    border: 1px solid #1a2840;
    border-radius: 6px;
    padding: 16px;
  }
  .compare-header {
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .exp-card {
    background: #080d15;
    border: 1px solid #1a2840;
    border-radius: 6px;
    padding: 16px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .exp-card:hover { border-color: #2a3f5f; }
  .exp-card.selected { border-color: #00d4aa; }
  .exp-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .exp-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; }
  .metrics-row { display: flex; gap: 20px; margin-top: 12px; flex-wrap: wrap; }
  .metric { display: flex; flex-direction: column; gap: 2px; }
  .metric-val { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px; }
  .metric-label { font-size: 9px; color: #475569; letter-spacing: 0.08em; text-transform: uppercase; }

  .var-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .var-table td, .var-table th { padding: 5px 8px; font-size: 11px; border-bottom: 1px solid #0f1a28; }
  .var-table td:first-child { color: #475569; width: 200px; }
  .changed { color: #f59e0b !important; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #060a10; }
  ::-webkit-scrollbar-thumb { background: #1a2840; border-radius: 3px; }

  .reasoning-box {
    background: #0a1222;
    border: 1px solid #1a2840;
    border-radius: 4px;
    padding: 12px;
    font-size: 11px;
    line-height: 1.7;
    color: #94a3b8;
    margin-top: 8px;
  }

  .tool-row {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 8px; border-radius: 3px;
    background: #0a1222; margin-bottom: 4px; font-size: 10px;
  }
  .tool-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

  .section-label {
    font-size: 9px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #334155;
    margin-bottom: 8px;
    font-weight: 700;
  }

  .split { display: grid; grid-template-columns: 1fr 360px; gap: 16px; align-items: start; }
  .overflow { overflow-x: auto; }

  .big-metric {
    background: #080d15;
    border: 1px solid #1a2840;
    border-radius: 6px;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .big-metric-val { font-family: 'Syne', sans-serif; font-weight: 800; font-size: 28px; }
  .big-metric-label { font-size: 10px; color: #475569; letter-spacing: 0.08em; text-transform: uppercase; }

  .metrics-bar { display: flex; gap: 12px; margin-bottom: 16px; }

  .filter-row { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
  .filter-btn {
    padding: 4px 10px;
    border-radius: 3px;
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    cursor: pointer;
    border: 1px solid #1a2840;
    background: transparent;
    color: #475569;
    transition: all 0.1s;
  }
  .filter-btn.active { background: #00d4aa22; border-color: #00d4aa88; color: #00d4aa; }
  .filter-btn:hover:not(.active) { border-color: #2a3f5f; color: #94a3b8; }

  .mt-2 { margin-top: 8px; }
  .mt-3 { margin-top: 12px; }
  .mt-4 { margin-top: 16px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-3 { margin-bottom: 12px; }

  .highlight-box {
    background: #0f291f;
    border: 1px solid #166534;
    border-radius: 4px;
    padding: 10px 14px;
    font-size: 11px;
    color: #4ade80;
    line-height: 1.6;
    margin-top: 8px;
  }
  .warn-box {
    background: #2a1f0a;
    border: 1px solid #92400e;
    border-radius: 4px;
    padding: 10px 14px;
    font-size: 11px;
    color: #fbbf24;
    line-height: 1.6;
    margin-top: 8px;
  }
  .error-box {
    background: #2a0a0a;
    border: 1px solid #991b1b;
    border-radius: 4px;
    padding: 10px 14px;
    font-size: 11px;
    color: #f87171;
    line-height: 1.6;
    margin-top: 8px;
  }

  .analysis-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .analysis-card {
    background: #080d15;
    border: 1px solid #1a2840;
    border-radius: 6px;
    padding: 16px;
  }
  .analysis-card.full { grid-column: 1 / -1; }
  .card-title {
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 13px;
    margin-bottom: 12px;
    color: #e2e8f0;
  }

  .bar-container { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .bar-label { font-size: 10px; color: #94a3b8; width: 140px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar-track { flex: 1; height: 16px; background: #0a1222; border-radius: 3px; overflow: hidden; position: relative; }
  .bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px; }
  .bar-val { font-size: 9px; font-weight: 700; }

  .evo-table { width: 100%; border-collapse: collapse; }
  .evo-table th, .evo-table td { padding: 6px 10px; font-size: 11px; border-bottom: 1px solid #0f1a28; text-align: center; }
  .evo-table th { color: #475569; font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 700; }
  .evo-table td:first-child { text-align: left; color: #94a3b8; font-weight: 700; }
  .evo-best { color: #4ade80; font-weight: 700; }
  .evo-worst { color: #f87171; }
  .evo-mid { color: #fbbf24; }

  .insight-card {
    background: #0a1222;
    border: 1px solid #1a2840;
    border-radius: 4px;
    padding: 12px 14px;
    margin-bottom: 8px;
  }
  .insight-num {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 14px;
    margin-right: 8px;
  }
  .insight-title {
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 12px;
    color: #e2e8f0;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
  }
  .insight-body { font-size: 11px; color: #64748b; line-height: 1.6; }

  @keyframes fadeIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }
  .fade-in { animation: fadeIn 0.2s ease; }
`;

// ── Component ──────────────────────────────────────────────────────────────────
export default function NIDSDashboard() {
  const [tab, setTab] = useState("analysis");
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selectedExp, setSelectedExp] = useState(EXPERIMENTS[0]);
  const [compExpId, setCompExpId] = useState("phase3c");

  const filteredFlows = FLOWS.filter(f => {
    if (filter === "all") return true;
    if (filter === "hit") return f.hit && !f.reasoning.startsWith("MISSED") && !f.reasoning.startsWith("FALSE");
    if (filter === "missed") return f.reasoning.startsWith("MISSED");
    if (filter === "fp") return f.reasoning.startsWith("FALSE");
    if (filter === "suspicious") return f.verdict === "SUSPICIOUS";
    if (filter === "benign") return f.verdict === "BENIGN";
    return true;
  });

  const flow = selectedFlow !== null ? FLOWS.find(f => f.id === selectedFlow) : null;
  const agent = selectedAgent ? AGENTS.find(a => a.id === selectedAgent) : null;
  const compExp = EXPERIMENTS.find(e => e.id === compExpId);

  const totalFlows = EXPERIMENTS.reduce((s, e) => s + e.flows, 0);
  const totalCost = EXPERIMENTS.reduce((s, e) => s + parseFloat(e.cost.slice(1)), 0);

  const toolCalls = flow ? [
    { name: "record_flow",       cat: "netflow",   meaningful: true,  result: "Recorded flow" },
    { name: "geolocate_ip",      cat: "external",  meaningful: false, result: "Private IP — no data" },
    { name: "check_ip_abuseipdb",cat: "external",  meaningful: false, result: "0 reports" },
    { name: "check_ip_otx",      cat: "external",  meaningful: false, result: "No threats" },
  ].slice(0, Math.min(flow.tools, 4)) : [];

  const toolColour = (cat) => ({ netflow:"#00d4aa", external:"#f59e0b", mitre:"#a855f7" }[cat] || "#64748b");

  // Helper: classify metric value for evolution table colouring
  const evoClass = (val, metric, allVals) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "";
    const nums = allVals.map(v => parseFloat(v)).filter(v => !isNaN(v));
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    if (max === min) return "";
    if (metric === "fp" || metric === "fn") {
      if (num === min) return "evo-best";
      if (num === max) return "evo-worst";
      return "evo-mid";
    }
    if (num === max) return "evo-best";
    if (num === min) return "evo-worst";
    return "evo-mid";
  };

  return (
    <>
      <style>{css}</style>
      <div className="nids">
        {/* Header */}
        <div className="header">
          <div className="status-dot" />
          <div className="header-title">NIDS // Thesis Dashboard</div>
          <div style={{ display:"flex", gap:20, marginLeft:20 }}>
            {[
              { label:"EXPERIMENTS", val: EXPERIMENTS.length },
              { label:"TOTAL FLOWS", val: totalFlows },
              { label:"BEST F1", val: "95.9%", col:"#4ade80" },
              { label:"TOTAL COST", val: "$"+totalCost.toFixed(2) },
              { label:"PHASES", val: "1 / 2 / 3", col:"#00d4aa" },
            ].map(m => (
              <div key={m.label} style={{ display:"flex", gap:6, alignItems:"baseline" }}>
                <span style={{ fontSize:13, fontFamily:"Syne", fontWeight:700, color: m.col||"#e2e8f0" }}>{m.val}</span>
                <span style={{ fontSize:9, color:"#334155", letterSpacing:"0.1em" }}>{m.label}</span>
              </div>
            ))}
          </div>
          <div className="header-sub">NF-CICIDS2018-v3 | 7 Experiments | Feb 2026</div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            ["analysis",    "01 Analysis"],
            ["experiments", "02 Experiments"],
            ["agents",      "03 Agents"],
            ["flows",       "04 Flow Monitor"],
            ["comparison",  "05 Missed Detections"],
          ].map(([id, label]) => (
            <button key={id} className={`tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="content fade-in" key={tab}>

          {/* ── ANALYSIS ── */}
          {tab === "analysis" && (
            <div>
              {/* Top-level summary metrics */}
              <div className="metrics-bar">
                {[
                  { val:"95.9%", label:"Best F1 (3b)", col:"#00d4aa" },
                  { val:"100%",  label:"Best Recall (3b)", col:"#a855f7" },
                  { val:"100%",  label:"Best Precision (3a)", col:"#3b82f6" },
                  { val:"94.0%", label:"Best Accuracy (3b)", col:"#f59e0b" },
                  { val:"$0.07", label:"Avg Cost/Flow", col:"#64748b" },
                  { val: totalFlows.toString(), label:"Total Flows Analysed", col:"#e2e8f0" },
                ].map(m => (
                  <div key={m.label} className="big-metric" style={{ flex:1 }}>
                    <div className="big-metric-val" style={{ color: m.col }}>{m.val}</div>
                    <div className="big-metric-label">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Evolution table */}
              <div className="analysis-card full mb-3">
                <div className="card-title">Experiment Evolution</div>
                <div className="section-label">How metrics changed across all 7 experiments (chronological order, left to right)</div>
                <div className="overflow">
                  <table className="evo-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign:"left" }}>Metric</th>
                        {[...EXPERIMENTS].reverse().map(e => (
                          <th key={e.id} style={{ borderBottom: `2px solid ${phaseColour(e.phase)}` }}>
                            {e.name.split("\u2014")[0].trim()}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: "Architecture", vals: [...EXPERIMENTS].reverse().map(e => e.variables.architecture) },
                        { key: "Flows", vals: [...EXPERIMENTS].reverse().map(e => String(e.flows)) },
                        { key: "Benign %", vals: [...EXPERIMENTS].reverse().map(e => e.variables.benign_ratio || "26%") },
                        { key: "F1", vals: [...EXPERIMENTS].reverse().map(e => e.f1), metric: "f1" },
                        { key: "Precision", vals: [...EXPERIMENTS].reverse().map(e => e.precision), metric: "precision" },
                        { key: "Recall", vals: [...EXPERIMENTS].reverse().map(e => e.recall), metric: "recall" },
                        { key: "Accuracy", vals: [...EXPERIMENTS].reverse().map(e => e.accuracy), metric: "accuracy" },
                        { key: "True Pos", vals: [...EXPERIMENTS].reverse().map(e => String(e.confusion.tp)), metric: "tp" },
                        { key: "False Pos", vals: [...EXPERIMENTS].reverse().map(e => String(e.confusion.fp)), metric: "fp" },
                        { key: "True Neg", vals: [...EXPERIMENTS].reverse().map(e => String(e.confusion.tn)) },
                        { key: "False Neg", vals: [...EXPERIMENTS].reverse().map(e => String(e.confusion.fn)), metric: "fn" },
                        { key: "Cost", vals: [...EXPERIMENTS].reverse().map(e => e.cost) },
                        { key: "Time", vals: [...EXPERIMENTS].reverse().map(e => e.time) },
                      ].map(row => (
                        <tr key={row.key}>
                          <td>{row.key}</td>
                          {row.vals.map((v, i) => (
                            <td key={i} className={row.metric ? evoClass(v, row.metric, row.vals) : ""}>
                              {v}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="analysis-grid">
                {/* Key Findings */}
                <div className="analysis-card">
                  <div className="card-title">Key Findings</div>
                  {[
                    { num: "1", col: "#4ade80", title: "Multi-agent architecture dramatically outperforms single-agent", body: "Phase 3b (6-agent) achieved 95.9% F1 vs Phase 1's 83.3% F1 on a larger and more diverse dataset. The multi-agent approach is also 2x faster (no MCP tool overhead) and cheaper per flow." },
                    { num: "2", col: "#f87171", title: "False positives explode on realistic class distributions", body: "When benign traffic is 88% of the batch (as in production), specialists hallucinate attack patterns in normal HTTPS, DNS, and NTP traffic. Phase 3c: 41 FPs on 88 benign flows (46.6% FP rate). The system was effectively trained on attack-heavy batches." },
                    { num: "3", col: "#fbbf24", title: "Devil's Advocate helps but cannot fix root cause", body: "The DA agent correctly flipped 10 verdicts (preventing FPs) with 66.7% accuracy. But increasing DA weight from 30% to 50% only fixed 6 more FPs. 34/35 remaining FPs had unanimous 4/4 specialist agreement — no DA weight can override that." },
                    { num: "4", col: "#a855f7", title: "Temporal context is the strongest signal", body: "Phase 3b (rich temporal context with ~30 same-IP flows) achieved 100% recall. The temporal agent had the most decisive impact — it shifts from 0.87 recall to 1.0 when given sufficient same-IP flow history." },
                    { num: "5", col: "#3b82f6", title: "Some attack types are fundamentally invisible to per-flow analysis", body: "DoS-Hulk (0% recall), Infiltration (0% recall), and Brute_Force-XSS (0% recall) require aggregate/temporal detection. Individual flows look legitimate — the attack is the volume, timing, or sequence." },
                  ].map(f => (
                    <div key={f.num} className="insight-card">
                      <div className="insight-title">
                        <span className="insight-num" style={{ color: f.col }}>{f.num}</span>
                        {f.title}
                      </div>
                      <div className="insight-body">{f.body}</div>
                    </div>
                  ))}
                </div>

                {/* Per-Attack Detection Rates */}
                <div className="analysis-card">
                  <div className="card-title">Per-Attack Detection Rate (Phase 3 Aggregate, 308 flows)</div>
                  <div className="section-label mb-2">Recall by attack type across all Phase 3 experiments</div>
                  {ATTACK_RATES.map(a => (
                    <div key={a.type} className="bar-container">
                      <div className="bar-label">{a.type}</div>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ width: `${Math.max(a.rate * 100, 2)}%`, background: rateColour(a.rate) }}>
                          {a.rate > 0.15 && <span className="bar-val" style={{ color: "#060a10" }}>{(a.rate * 100).toFixed(0)}%</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 9, color: "#475569", width: 40, textAlign: "right" }}>{a.detected}/{a.total}</div>
                    </div>
                  ))}

                  {/* DA Impact */}
                  <div style={{ marginTop: 20 }}>
                    <div className="card-title">Devil's Advocate Impact</div>
                    <div className="section-label mb-2">How the DA agent influenced final verdicts (Phase 3 aggregate)</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      {[
                        { val: DA_IMPACT.totalFlips, label: "Verdict Flips", col: "#e2e8f0" },
                        { val: DA_IMPACT.correctFlips, label: "Correct (FP prevented)", col: "#4ade80" },
                        { val: DA_IMPACT.incorrectFlips, label: "Incorrect (FN caused)", col: "#f87171" },
                      ].map(d => (
                        <div key={d.label} style={{ background: "#0a1222", borderRadius: 4, padding: "8px 10px", textAlign: "center" }}>
                          <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 20, color: d.col }}>{d.val}</div>
                          <div style={{ fontSize: 8, color: "#475569", letterSpacing: "0.08em" }}>{d.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <div style={{ flex: 1, background: "#0a1222", borderRadius: 4, padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16, color: "#fbbf24" }}>{DA_IMPACT.flipAccuracy}%</div>
                        <div style={{ fontSize: 8, color: "#475569" }}>FLIP ACCURACY</div>
                      </div>
                      <div style={{ flex: 1, background: "#0a1222", borderRadius: 4, padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 16, color: "#64748b" }}>{DA_IMPACT.noEffect}</div>
                        <div style={{ fontSize: 8, color: "#475569" }}>NO EFFECT</div>
                      </div>
                    </div>
                  </div>

                  {/* Specialist agreement */}
                  <div style={{ marginTop: 20 }}>
                    <div className="card-title">Specialist Agreement</div>
                    <div className="section-label mb-2">How many of 4 specialists agreed on malicious/suspicious</div>
                    {Object.entries(AGREEMENT.distribution).map(([k, v]) => (
                      <div key={k} className="bar-container">
                        <div className="bar-label" style={{ width: 60 }}>{k} agree</div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${(v / 308) * 100}%`, background: k === "4/4" ? "#f87171" : k === "0/4" ? "#4ade80" : "#fbbf24" }}>
                            <span className="bar-val" style={{ color: "#060a10" }}>{v}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phase 3c vs 3e comparison */}
              <div className="analysis-card full mt-3">
                <div className="card-title">DA Weight Experiment: Phase 3c (30%) vs Phase 3e (50%)</div>
                <div className="section-label mb-2">Testing whether increasing DA weight fixes the false positive problem on realistic distributions</div>
                <div className="overflow">
                  <table className="evo-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Metric</th>
                        <th style={{ borderBottom: "2px solid #f59e0b" }}>3c (DA=30%)</th>
                        <th style={{ borderBottom: "2px solid #00d4aa" }}>3e (DA=50%)</th>
                        <th>Delta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["False Positives", "41", "35", "-6", true],
                        ["True Negatives", "47", "53", "+6", true],
                        ["True Positives", "7", "7", "0", false],
                        ["False Negatives", "5", "5", "0", false],
                        ["Accuracy", "54.0%", "60.0%", "+6.0%", true],
                        ["Precision", "14.6%", "16.7%", "+2.1%", true],
                        ["Recall", "58.3%", "58.3%", "0%", false],
                        ["F1", "23.3%", "25.9%", "+2.6%", true],
                        ["Flows fixed", "-", "6", "6 FPs corrected", true],
                        ["Flows worsened", "-", "0", "0 new errors", true],
                      ].map(([k, a, b, d, good]) => (
                        <tr key={k}>
                          <td style={{ textAlign: "left" }}>{k}</td>
                          <td style={{ color: "#f59e0b" }}>{a}</td>
                          <td style={{ color: "#00d4aa" }}>{b}</td>
                          <td style={{ color: good ? "#4ade80" : "#475569" }}>{d}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="warn-box" style={{ marginTop: 12 }}>
                  Conclusion: DA weight increase was surgically precise (6 FPs fixed, 0 regressions) but insufficient. 34 of 35 remaining FPs have 4/4 unanimous specialist agreement. The root cause is specialist prompt engineering, not orchestrator weighting. The DA argues benign with 0.80 mean confidence on these flows, but the orchestrator correctly defers to unanimous specialist consensus.
                </div>
              </div>

              {/* Methodology summary */}
              <div className="analysis-card full mt-3">
                <div className="card-title">Methodology Summary</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  <div>
                    <div className="section-label" style={{ color: "#64748b" }}>Phase 1 — MCP Baseline</div>
                    <div className="reasoning-box" style={{ marginTop: 4 }}>
                      Single Claude Sonnet agent with 13 MCP tools (AbuseIPDB, OTX, geolocation, MITRE ATT&CK, NetFlow analyzer). ReAct loop with up to 5 tool iterations per flow. Finding: 0/142 external tool calls returned meaningful data on anonymized IPs. Agent defaulted to SUSPICIOUS when uncertain, yielding high recall (93%) but many false positives.
                    </div>
                  </div>
                  <div>
                    <div className="section-label" style={{ color: "#f59e0b" }}>Phase 2 — Single-Agent Iterations</div>
                    <div className="reasoning-box" style={{ marginTop: 4 }}>
                      Two prompt engineering iterations on the same single-agent architecture. Iter 1 added SQLite-based temporal memory (60s sliding window per source IP) — improved precision to 85.3% but low injection rate (3.4%). Iter 2 added benign baseline calibration — reduced FPs from 13 to 9 but lost recall (77%).
                    </div>
                  </div>
                  <div>
                    <div className="section-label" style={{ color: "#00d4aa" }}>Phase 3 — Multi-Agent Architecture</div>
                    <div className="reasoning-box" style={{ marginTop: 4 }}>
                      6-agent system: 4 specialists (protocol, statistical, behavioural, temporal) analyse in parallel, then a Devil's Advocate argues benign, then an Orchestrator makes weighted consensus verdict. No MCP tools — pure LLM reasoning on 53 NetFlow features. Best result: 95.9% F1 on 150 flows. Cost: ~$0.07/flow. Key weakness: FP explosion on realistic 88% benign distributions.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── EXPERIMENT LOG ── */}
          {tab === "experiments" && (
            <div className="split">
              <div>
                <div className="mb-3">
                  {EXPERIMENTS.map(exp => (
                    <div key={exp.id} className={`exp-card ${selectedExp?.id === exp.id ? "selected":""}`}
                      onClick={() => setSelectedExp(exp)}>
                      <div className="exp-header">
                        <span className="badge" style={{
                          background: `${phaseColour(exp.phase)}22`,
                          borderColor: phaseColour(exp.phase),
                          color: phaseColour(exp.phase),
                          fontSize: 9,
                        }}>
                          P{exp.phase}
                        </span>
                        <div className="exp-name">{exp.name}</div>
                        <span className="badge" style={{
                          background: "#0f291f",
                          borderColor: "#166534",
                          color: "#4ade80",
                        }}>
                          COMPLETE
                        </span>
                        <span style={{ marginLeft:"auto", fontSize:10, color:"#334155" }}>{exp.date}</span>
                      </div>
                      <div style={{ fontSize:10, color:"#475569", lineHeight:1.5, marginTop:4 }}>{exp.notes}</div>
                      <div className="metrics-row">
                        {[
                          { label:"Flows",    val: exp.flows },
                          { label:"Cost",     val: exp.cost },
                          { label:"Time",     val: exp.time },
                          { label:"F1",       val: exp.f1,       col:"#00d4aa" },
                          { label:"Precision", val: exp.precision, col:"#3b82f6" },
                          { label:"Recall",   val: exp.recall,   col:"#a855f7" },
                          { label:"Accuracy", val: exp.accuracy },
                        ].map(m => (
                          <div key={m.label} className="metric">
                            <div className="metric-val" style={{ fontSize:16, color: m.col || "#e2e8f0" }}>{m.val}</div>
                            <div className="metric-label">{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Experiment detail */}
              {selectedExp && (
                <div>
                  <div className="detail-panel">
                    <div className="section-label">Variables — {selectedExp.name}</div>
                    <table className="var-table">
                      <tbody>
                        {Object.entries(selectedExp.variables).map(([k, v]) => {
                          const otherVal = compExp?.variables[k];
                          const changed = compExp && compExp.id !== selectedExp.id && String(otherVal) !== String(v);
                          return (
                            <tr key={k}>
                              <td>{k}</td>
                              <td className={changed ? "changed" : ""}>{String(v)}</td>
                              {compExp && compExp.id !== selectedExp.id && <td style={{ color:"#334155", fontSize:10 }}>{String(otherVal)}</td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {selectedExp.confusion && (
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
                        <div>
                          <div className="section-label">Confusion Matrix</div>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                            {[
                              { label:"TRUE POS",  val: selectedExp.confusion.tp, col:"#4ade80", bg:"#0f291f" },
                              { label:"FALSE POS", val: selectedExp.confusion.fp, col:"#f87171", bg:"#2a0a0a" },
                              { label:"FALSE NEG", val: selectedExp.confusion.fn, col:"#fbbf24", bg:"#2a1f0a" },
                              { label:"TRUE NEG",  val: selectedExp.confusion.tn, col:"#3b82f6", bg:"#0c1830" },
                            ].map(c => (
                              <div key={c.label} style={{ background:c.bg, borderRadius:4, padding:"8px 10px", textAlign:"center" }}>
                                <div style={{ fontFamily:"Syne", fontWeight:700, fontSize:20, color:c.col }}>{c.val}</div>
                                <div style={{ fontSize:8, color:c.col, opacity:0.7, letterSpacing:"0.1em" }}>{c.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="section-label">Verdict Distribution</div>
                          {selectedExp.verdicts && [
                            { label:"BENIGN",     val: selectedExp.verdicts.benign,     col:"#4ade80", total: selectedExp.flows },
                            { label:"SUSPICIOUS", val: selectedExp.verdicts.suspicious, col:"#fbbf24", total: selectedExp.flows },
                            { label:"MALICIOUS",  val: selectedExp.verdicts.malicious,  col:"#f87171", total: selectedExp.flows },
                          ].map(v => (
                            <div key={v.label} style={{ marginBottom:6 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:9, marginBottom:2 }}>
                                <span style={{ color:v.col, letterSpacing:"0.08em" }}>{v.label}</span>
                                <span style={{ color:"#475569" }}>{v.val}/{v.total}</span>
                              </div>
                              <div style={{ background:"#0a1222", borderRadius:2, height:8, overflow:"hidden" }}>
                                <div style={{ width:`${(v.val/v.total)*100}%`, height:"100%", background:v.col, borderRadius:2, transition:"width 0.3s" }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="section-label mt-3">What Changed</div>
                    <div className="reasoning-box">{selectedExp.changes}</div>

                    <div className="section-label mt-3">Compare With</div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {EXPERIMENTS.filter(e => e.id !== selectedExp.id).map(e => (
                        <button key={e.id}
                          className={`filter-btn ${compExpId === e.id ? "active":""}`}
                          onClick={() => setCompExpId(e.id)}>
                          {e.name.split("\u2014")[0].trim()}
                        </button>
                      ))}
                    </div>

                    {compExp && compExp.id !== selectedExp.id && (
                      <>
                        <div className="section-label mt-3">Metric Comparison</div>
                        <table className="var-table">
                          <thead>
                            <tr>
                              <td style={{ color:"#334155", fontSize:9 }}>METRIC</td>
                              <td style={{ color:"#00d4aa", fontSize:9 }}>{selectedExp.name.split("\u2014")[0].trim()}</td>
                              <td style={{ color:"#f59e0b", fontSize:9 }}>{compExp.name.split("\u2014")[0].trim()}</td>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ["Flows",     selectedExp.flows,     compExp.flows],
                              ["F1",        selectedExp.f1,        compExp.f1],
                              ["Precision", selectedExp.precision, compExp.precision],
                              ["Recall",    selectedExp.recall,    compExp.recall],
                              ["Accuracy",  selectedExp.accuracy,  compExp.accuracy],
                              ["Cost",      selectedExp.cost,      compExp.cost],
                              ["Time",      selectedExp.time,      compExp.time],
                              ["TP / FP",
                                `${selectedExp.confusion.tp} / ${selectedExp.confusion.fp}`,
                                `${compExp.confusion.tp} / ${compExp.confusion.fp}`],
                              ["TN / FN",
                                `${selectedExp.confusion.tn} / ${selectedExp.confusion.fn}`,
                                `${compExp.confusion.tn} / ${compExp.confusion.fn}`],
                            ].map(([k, a, b]) => (
                              <tr key={k}>
                                <td>{k}</td>
                                <td style={{ color:"#00d4aa" }}>{a}</td>
                                <td style={{ color:"#f59e0b" }}>{b}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── AGENTS ── */}
          {tab === "agents" && (
            <div>
              {/* Architecture diagram */}
              <div className="analysis-card full mb-3">
                <div className="card-title">Phase 3 Multi-Agent Architecture</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 0", flexWrap: "wrap" }}>
                  <div style={{ background: "#0a1222", border: "1px solid #1a2840", borderRadius: 6, padding: "10px 16px", textAlign: "center", fontSize: 11 }}>
                    <div style={{ color: "#475569", fontSize: 9, letterSpacing: "0.1em", marginBottom: 4 }}>INPUT</div>
                    <div style={{ color: "#94a3b8" }}>NetFlow Record</div>
                    <div style={{ color: "#334155", fontSize: 9 }}>53 features</div>
                  </div>
                  <div style={{ color: "#334155", fontSize: 16 }}>{"\u2192"}</div>
                  <div style={{ display: "flex", gap: 6, background: "#0a1222", border: "1px dashed #1a2840", borderRadius: 6, padding: 10 }}>
                    {["Protocol", "Statistical", "Behavioural", "Temporal"].map((name, i) => (
                      <div key={name} style={{ background: "#080d15", border: `1px solid ${["#3b82f6","#a855f7","#f59e0b","#ec4899"][i]}33`, borderRadius: 4, padding: "6px 10px", textAlign: "center" }}>
                        <div style={{ color: ["#3b82f6","#a855f7","#f59e0b","#ec4899"][i], fontSize: 10, fontWeight: 700 }}>{name}</div>
                        <div style={{ color: "#334155", fontSize: 8 }}>parallel</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ color: "#334155", fontSize: 16 }}>{"\u2192"}</div>
                  <div style={{ background: "#080d15", border: "1px solid #ef444433", borderRadius: 6, padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ color: "#ef4444", fontSize: 11, fontWeight: 700 }}>Devil's Advocate</div>
                    <div style={{ color: "#334155", fontSize: 8 }}>counter-argument</div>
                  </div>
                  <div style={{ color: "#334155", fontSize: 16 }}>{"\u2192"}</div>
                  <div style={{ background: "#080d15", border: "1px solid #00d4aa33", borderRadius: 6, padding: "10px 14px", textAlign: "center" }}>
                    <div style={{ color: "#00d4aa", fontSize: 11, fontWeight: 700 }}>Orchestrator</div>
                    <div style={{ color: "#334155", fontSize: 8 }}>weighted consensus</div>
                  </div>
                  <div style={{ color: "#334155", fontSize: 16 }}>{"\u2192"}</div>
                  <div style={{ background: "#0a1222", border: "1px solid #1a2840", borderRadius: 6, padding: "10px 16px", textAlign: "center", fontSize: 11 }}>
                    <div style={{ color: "#475569", fontSize: 9, letterSpacing: "0.1em", marginBottom: 4 }}>OUTPUT</div>
                    <div style={{ color: "#94a3b8" }}>Verdict + Reasoning</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#475569", textAlign: "center" }}>
                  6 LLM calls per flow (4 parallel + 2 sequential) | ~$0.07/flow | ~20s/flow
                </div>
              </div>

              <div className="agent-grid mb-3">
                {AGENTS.map(a => (
                  <div
                    key={a.id}
                    className={`agent-card ${selectedAgent === a.id ? "selected" : ""}`}
                    style={{ borderColor: selectedAgent === a.id ? a.color : undefined }}
                    onClick={() => setSelectedAgent(selectedAgent === a.id ? null : a.id)}
                  >
                    <div className="agent-icon" style={{ color: a.color }}>{a.icon}</div>
                    <div className="agent-name" style={{ color: a.color }}>{a.name}</div>
                    <div className="agent-model">{a.model}</div>
                    <div className="agent-role">{a.role}</div>
                    <div className="stat-row">
                      {Object.entries(a.stats).map(([k,v]) => (
                        <div key={k} className="stat">
                          <div className="stat-val" style={{ color: a.color, fontSize:14 }}>{v}</div>
                          <div className="stat-label">{k}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {agent && (
                <div className="detail-panel fade-in">
                  <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:12 }}>
                    <span style={{ fontSize:20, color: agent.color, fontFamily: "Syne", fontWeight: 800 }}>{agent.icon}</span>
                    <div>
                      <div className="detail-title" style={{ marginBottom:0, color: agent.color }}>{agent.name} Agent</div>
                      <div style={{ fontSize:10, color:"#475569" }}>{agent.model}</div>
                    </div>
                  </div>
                  <div className="reasoning-box">{agent.role}</div>

                  {AGREEMENT.perAgent[agent.id] && (
                    <div style={{ marginTop: 12 }}>
                      <div className="section-label">Verdict Distribution (308 flows)</div>
                      {[
                        { label: "BENIGN", val: AGREEMENT.perAgent[agent.id].benign, col: "#4ade80" },
                        { label: "SUSPICIOUS", val: AGREEMENT.perAgent[agent.id].suspicious, col: "#fbbf24" },
                        { label: "MALICIOUS", val: AGREEMENT.perAgent[agent.id].malicious, col: "#f87171" },
                      ].map(v => (
                        <div key={v.label} style={{ marginBottom: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, marginBottom: 2 }}>
                            <span style={{ color: v.col }}>{v.label}</span>
                            <span style={{ color: "#475569" }}>{v.val}/308</span>
                          </div>
                          <div style={{ background: "#0a1222", borderRadius: 2, height: 6, overflow: "hidden" }}>
                            <div style={{ width: `${(v.val / 308) * 100}%`, height: "100%", background: v.col, borderRadius: 2 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {agent.id === "temporal" && (
                    <div className="highlight-box" style={{ marginTop: 12 }}>
                      Most aggressive agent: 129 MALICIOUS verdicts (41.9% of flows). Provides critical same-IP temporal context that other agents lack. Responsible for Phase 3b's 100% recall when given rich same-IP flow history.
                    </div>
                  )}
                  {agent.id === "protocol" && (
                    <div className="highlight-box" style={{ marginTop: 12 }}>
                      Most conservative agent: 216 BENIGN verdicts (70.1% of flows). Focuses purely on protocol correctness — if ports, flags, and packet sizes match protocol norms, it says BENIGN. Provides important counterbalance to other agents.
                    </div>
                  )}
                  {agent.id === "devils_advocate" && (
                    <div className="warn-box" style={{ marginTop: 12 }}>
                      Successfully flipped 15 verdicts with 66.7% accuracy (10 correct, 5 incorrect). At 30% weight, it reduces FPs but cannot override unanimous specialist consensus. At 50% weight, it fixed 6 additional FPs without causing any new errors.
                    </div>
                  )}
                  {agent.id === "orchestrator" && (
                    <div className="warn-box" style={{ marginTop: 12 }}>
                      Uses configurable consensus thresholds. Default DA weight is 30%. When 4/4 specialists agree on MALICIOUS, even 50% DA weight rarely overrides the verdict. The orchestrator correctly defers to specialist consensus — the problem is specialists being wrong.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── FLOW MONITOR ── */}
          {tab === "flows" && (
            <div className="split">
              <div>
                <div className="section-label mb-2">Phase 1 MCP Baseline — 20 sampled flows with per-flow detail</div>
                <div className="metrics-bar">
                  {[
                    { val:"83.3%", label:"F1 Score",  col:"#00d4aa" },
                    { val:"75.5%", label:"Precision",  col:"#3b82f6" },
                    { val:"93.0%", label:"Recall",     col:"#a855f7" },
                    { val:"72.4%", label:"Accuracy",   col:"#f59e0b" },
                    { val:"0%",    label:"Ext. Tool Hit", col:"#ef4444" },
                  ].map(m => (
                    <div key={m.label} className="big-metric" style={{ flex:1 }}>
                      <div className="big-metric-val" style={{ color: m.col }}>{m.val}</div>
                      <div className="big-metric-label">{m.label}</div>
                    </div>
                  ))}
                </div>

                <div className="filter-row">
                  <span style={{ fontSize:9, color:"#334155", letterSpacing:"0.1em" }}>FILTER:</span>
                  {[
                    ["all","All ("+FLOWS.length+")"],
                    ["hit","Correct"],
                    ["missed","Missed"],
                    ["fp","False Positives"],
                    ["suspicious","Suspicious"],
                    ["benign","Benign"],
                  ].map(([id, label]) => (
                    <button key={id} className={`filter-btn ${filter===id?"active":""}`} onClick={()=>setFilter(id)}>{label}</button>
                  ))}
                </div>

                <div className="overflow">
                  <table className="flow-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Source</th><th>Dest</th><th>Port</th><th>Proto</th><th>Verdict</th><th>Actual</th><th>Conf</th><th>Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFlows.map(f => {
                        const vc = verdictColour(f.verdict);
                        const isMissed = f.reasoning.startsWith("MISSED");
                        const isFP = f.reasoning.startsWith("FALSE");
                        const isSelected = selectedFlow === f.id;
                        return (
                          <tr key={f.id}
                            className={`flow-row mono ${isSelected?"selected":""} ${isMissed?"missed":""} ${isFP?"fp":""}`}
                            onClick={() => setSelectedFlow(isSelected ? null : f.id)}>
                            <td style={{ color:"#334155" }}>{String(f.id).padStart(3,"0")}</td>
                            <td style={{ color:"#94a3b8" }}>{f.src}</td>
                            <td style={{ color:"#64748b" }}>{f.dst}</td>
                            <td style={{ color:"#475569" }}>{f.port}</td>
                            <td style={{ color:"#475569" }}>{f.proto}</td>
                            <td><span className="badge" style={{ background:vc.bg, borderColor:vc.border, color:vc.text }}>{f.verdict}</span></td>
                            <td style={{ color: f.hit && !isMissed && !isFP ? "#4ade80" : isMissed ? "#f87171" : "#fbbf24", fontSize:10 }}>{f.actual}</td>
                            <td style={{ color: f.conf >= 0.8 ? "#4ade80" : f.conf >= 0.6 ? "#fbbf24" : "#64748b" }}>{(f.conf*100).toFixed(0)}%</td>
                            <td style={{ color:"#334155" }}>${f.cost.toFixed(3)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                {flow ? (
                  <div className="detail-panel fade-in">
                    <div className="section-label">Flow Detail — ID {String(flow.id).padStart(3,"0")}</div>
                    <div className="detail-title">{flow.src} {"\u2192"} {flow.dst}</div>

                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                      {[
                        { k:"Port", v: flow.port },
                        { k:"Protocol", v: flow.proto },
                        { k:"Tier", v: `T${flow.tier} \u2014 ${tierLabel(flow.tier)}`, col: tierColour(flow.tier) },
                        { k:"Confidence", v: `${(flow.conf*100).toFixed(0)}%` },
                        { k:"Tools Used", v: flow.tools },
                        { k:"Cost", v: `$${flow.cost.toFixed(4)}` },
                      ].map(({k,v,col}) => (
                        <div key={k} style={{ background:"#0a1222", borderRadius:3, padding:"6px 10px" }}>
                          <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:2 }}>{k}</div>
                          <div style={{ fontSize:12, color: col || "#c8d8e8" }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {(() => { const vc = verdictColour(flow.verdict); return (
                      <div style={{ background:vc.bg, border:`1px solid ${vc.border}`, borderRadius:4, padding:"8px 12px", marginBottom:12 }}>
                        <div style={{ fontSize:9, color: vc.text, letterSpacing:"0.1em", marginBottom:2, opacity:0.7 }}>VERDICT</div>
                        <div style={{ fontFamily:"Syne", fontWeight:700, fontSize:16, color: vc.text }}>{flow.verdict}</div>
                        <div style={{ fontSize:10, color: "#64748b", marginTop:2 }}>Actual: <span style={{ color: flow.hit ? "#4ade80":"#f87171" }}>{flow.actual}</span></div>
                      </div>
                    ); })()}

                    <div className="section-label">Tool Call Trace</div>
                    {toolCalls.map((t, i) => (
                      <div key={i} className="tool-row">
                        <div className="tool-dot" style={{ background: toolColour(t.cat) }} />
                        <span style={{ color:"#94a3b8", fontSize:10 }}>{t.name}</span>
                        <span style={{ marginLeft:"auto", color: t.meaningful ? "#4ade80":"#ef4444", fontSize:9 }}>
                          {t.meaningful ? "data" : "empty"}
                        </span>
                      </div>
                    ))}

                    <div className="section-label" style={{ marginTop:12 }}>Agent Reasoning</div>
                    <div className="reasoning-box">
                      {flow.reasoning.startsWith("MISSED") && <div style={{ color:"#f87171", fontWeight:700, marginBottom:6 }}>MISSED DETECTION</div>}
                      {flow.reasoning.startsWith("FALSE") && <div style={{ color:"#fbbf24", fontWeight:700, marginBottom:6 }}>FALSE POSITIVE</div>}
                      {flow.reasoning.replace(/^(MISSED|FALSE POSITIVE): /, "")}
                    </div>
                  </div>
                ) : (
                  <div style={{ color:"#334155", padding:20, textAlign:"center", fontSize:11, marginTop:40 }}>
                    Select a flow to inspect
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── MISSED DETECTIONS ── */}
          {tab === "comparison" && (
            <div>
              <div className="section-label mb-2">Root cause analysis of missed detections and false positives across all phases</div>
              <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
                <div className="big-metric" style={{ flex:1 }}>
                  <div className="big-metric-val" style={{ color:"#4ade80" }}>136</div>
                  <div className="big-metric-label">True Positives (Phase 3)</div>
                </div>
                <div className="big-metric" style={{ flex:1 }}>
                  <div className="big-metric-val" style={{ color:"#f87171" }}>50</div>
                  <div className="big-metric-label">False Positives (Phase 3)</div>
                </div>
                <div className="big-metric" style={{ flex:1 }}>
                  <div className="big-metric-val" style={{ color:"#fbbf24" }}>24</div>
                  <div className="big-metric-label">False Negatives (Phase 3)</div>
                </div>
                <div className="big-metric" style={{ flex:1 }}>
                  <div className="big-metric-val" style={{ color:"#3b82f6" }}>98</div>
                  <div className="big-metric-label">True Negatives (Phase 3)</div>
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
                {[
                  {
                    title: "Undetectable: Hulk + Infiltration + XSS",
                    col: "#f87171",
                    attacks: "DoS-Hulk (0%), Infiltration (0%), XSS (0%)",
                    cause: "These attacks are invisible at the per-flow level. Hulk: each HTTP flow looks normal — the attack IS the volume. Infiltration: each DNS query is legitimate — the attack IS the 30-query burst in 3.2 seconds. XSS: flows mimic DHCP packet profiles.",
                    fix: "Requires aggregate detection: cluster flows by destination x time window, detect volume anomalies, and analyse temporal bursts across flows rather than within individual flows."
                  },
                  {
                    title: "FP Explosion on Realistic Distributions",
                    col: "#fbbf24",
                    attacks: "41 FPs on 88 benign flows in Phase 3c (46.6% FP rate)",
                    cause: "Specialists hallucinate attack patterns in normal HTTPS, DNS, and NTP traffic. The statistical agent flags any traffic with unusual metrics. The behavioural agent pattern-matches too aggressively on short flows. 35/41 FPs had 4/4 specialists unanimously wrong.",
                    fix: "Specialist prompts need benign-aware calibration. The current prompts were implicitly tuned on attack-heavy batches (70%+ attacks). Production traffic is 87%+ benign."
                  },
                  {
                    title: "DA Cannot Fix Unanimous Error",
                    col: "#a855f7",
                    attacks: "34/35 remaining FPs after DA=50% have 4/4 specialist consensus",
                    cause: "The orchestrator consensus mechanism correctly trusts unanimous specialist agreement. When all 4 specialists say MALICIOUS on a benign flow, even a 50% DA weight cannot flip the verdict. The DA argues benign at 0.80 confidence but is outweighed.",
                    fix: "The fix must be at the specialist level. Options: add benign baseline examples to prompts, add explicit normal-traffic patterns, or add a pre-filter that routes obviously benign traffic around the multi-agent pipeline."
                  },
                ].map(item => (
                  <div key={item.title} style={{ background:"#080d15", border:"1px solid #1a2840", borderRadius:6, padding:14 }}>
                    <div style={{ fontFamily:"Syne", fontWeight:700, fontSize:12, color: item.col, marginBottom:8 }}>{item.title}</div>
                    <div className="section-label">Affected</div>
                    <div style={{ fontSize:10, color:"#94a3b8", lineHeight:1.6, marginBottom:8 }}>{item.attacks}</div>
                    <div className="section-label">Root Cause</div>
                    <div style={{ fontSize:10, color:"#94a3b8", lineHeight:1.6, marginBottom:8 }}>{item.cause}</div>
                    <div className="section-label">Potential Fix</div>
                    <div style={{ fontSize:10, color:"#4ade80", lineHeight:1.6 }}>{item.fix}</div>
                  </div>
                ))}
              </div>

              <div className="analysis-card full">
                <div className="card-title">Phase 1 Per-Flow Missed Detection Detail</div>
                <div className="comparison-grid">
                  <div className="compare-card">
                    <div className="compare-header">
                      <span style={{ color:"#4ade80" }}>Correct ({HITS.length})</span>
                    </div>
                    {HITS.map(f => (
                      <div key={f.id} style={{ padding:"6px 0", borderBottom:"1px solid #0f1a28", cursor:"pointer" }}
                        onClick={() => { setSelectedFlow(f.id); setTab("flows"); }}>
                        <div style={{ display:"flex", justifyContent:"space-between" }}>
                          <span style={{ fontSize:10, color:"#4ade80" }}>{f.actual}</span>
                          <span style={{ fontSize:9, color:"#334155" }}>T{f.tier}</span>
                        </div>
                        <div style={{ fontSize:9, color:"#475569" }}>{f.src} : {f.port}</div>
                      </div>
                    ))}
                  </div>
                  <div className="compare-card">
                    <div className="compare-header">
                      <span style={{ color:"#f87171" }}>Missed / FP ({MISSED.length})</span>
                    </div>
                    {MISSED.map(f => (
                      <div key={f.id} style={{ padding:"6px", marginBottom:4, background:"#2a0a0a", borderRadius:4, border:"1px solid #991b1b44", cursor:"pointer" }}
                        onClick={() => { setSelectedFlow(f.id); setTab("flows"); }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                          <span style={{ fontSize:10, color:"#f87171", fontWeight:700 }}>{f.actual}</span>
                          <span className="badge" style={{ background: verdictColour(f.verdict).bg, borderColor: verdictColour(f.verdict).border, color: verdictColour(f.verdict).text, fontSize:9 }}>
                            {f.verdict}
                          </span>
                        </div>
                        <div style={{ fontSize:9, color:"#7f1d1d", lineHeight:1.4 }}>{f.reasoning.replace(/^(MISSED|FALSE POSITIVE): /,"").slice(0, 120)}...</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
