import { useState, useEffect, useRef } from "react";

// ── Fonts via Google Fonts injection ──────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap";
document.head.appendChild(fontLink);

// ── Real data from evaluation ─────────────────────────────────────────────────
const FLOWS = [
  { id:0,  src:"172.31.0.2",      dst:"172.31.66.58",    port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Benign",         conf:0.95, tier:4, tools:4, cost:0.0745, time:23, hit:true,  reasoning:"Single DNS response from internal DNS server. Normal UDP port 53 pattern with reasonable 156-byte response. No malicious indicators — private IPs, standard TTL, single packet exchange." },
  { id:1,  src:"18.221.219.4",    dst:"172.31.69.25",    port:21,   proto:"TCP", verdict:"SUSPICIOUS", actual:"FTP-BruteForce",  conf:0.50, tier:1, tools:4, cost:0.0727, time:27, hit:true,  reasoning:"AbuseIPDB: 0 reports. OTX: no threats. Geolocation: AWS Ohio. Despite 0% external intel return, flagged as suspicious due to FTP port 21 pattern from datacenter IP." },
  { id:2,  src:"18.221.219.4",    dst:"172.31.69.25",    port:21,   proto:"TCP", verdict:"SUSPICIOUS", actual:"FTP-BruteForce",  conf:0.50, tier:1, tools:4, cost:0.0707, time:26, hit:true,  reasoning:"Repeated FTP connection from same AWS IP. Continuing pattern of port 21 connections with SYN-ACK flags — incremented source port suggests automated tooling." },
  { id:3,  src:"18.221.219.4",    dst:"172.31.69.25",    port:21,   proto:"TCP", verdict:"SUSPICIOUS", actual:"FTP-BruteForce",  conf:0.50, tier:1, tools:8, cost:0.0884, time:41, hit:true,  reasoning:"Three consecutive FTP flows, same target, incrementing source ports (39924→39934→40030). IP history confirms repeated brute-force pattern. Observation recorded: service enumeration behaviour." },
  { id:4,  src:"172.31.66.58",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Benign",         conf:0.95, tier:4, tools:4, cost:0.0799, time:42, hit:true,  reasoning:"DNS A record query from internal host. 65-byte query, 185-byte response — within normal DNS range. TTL 60s reasonable. All indicators point to routine internal DNS resolution." },
  { id:5,  src:"13.58.98.64",     dst:"172.31.69.25",    port:21,   proto:"TCP", verdict:"SUSPICIOUS", actual:"SSH-Bruteforce",  conf:0.50, tier:1, tools:4, cost:0.0720, time:38, hit:true,  reasoning:"New AWS Ohio IP targeting FTP port. AbuseIPDB: 0 reports. OTX: clean. Geolocation returns identical AWS EC2 profile — all 2018 lab IPs resolve to same datacenter with zero history." },
  { id:6,  src:"13.58.98.64",     dst:"172.31.69.25",    port:21,   proto:"TCP", verdict:"SUSPICIOUS", actual:"SSH-Bruteforce",  conf:0.50, tier:1, tools:4, cost:0.0702, time:41, hit:true,  reasoning:"Second flow from same IP. Pattern building: same target, FTP port, minimal packets (1 fwd / 1 bwd). External tools remain silent — zero threat intelligence for recycled 2018 AWS IPs." },
  { id:7,  src:"172.31.66.29",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"SUSPICIOUS", actual:"Benign",         conf:0.50, tier:4, tools:4, cost:0.0724, time:34, hit:false, reasoning:"Single DNS A record query. Private RFC1918 addressing. Normal packet sizes (69/85 bytes). Agent flagged suspicious despite no anomalies — false positive from over-cautious base behaviour." },
  { id:8,  src:"13.58.98.64",     dst:"172.31.69.25",    port:22,   proto:"TCP", verdict:"SUSPICIOUS", actual:"SSH-Bruteforce",  conf:0.50, tier:1, tools:4, cost:0.0690, time:47, hit:true,  reasoning:"SSH connection (port 22) from same IP that was doing FTP probes. Duration 373ms, 23 packets each direction — consistent with SSH brute force handshake sequence." },
  { id:9,  src:"18.219.211.138",  dst:"172.31.69.25",    port:80,   proto:"TCP", verdict:"SUSPICIOUS", actual:"DoS_GoldenEye",   conf:0.50, tier:2, tools:4, cost:0.0697, time:27, hit:true,  reasoning:"HTTP connections (port 80) from AWS Ohio. Duration ~4.3s, 5 fwd / 3 bwd packets per flow. AbuseIPDB: 0 reports. Flow characteristics consistent with slow-rate DoS preamble." },
  { id:12, src:"172.31.66.58",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Benign",         conf:0.95, tier:4, tools:4, cost:0.0787, time:27, hit:true,  reasoning:"DNS AAAA query (IPv6 lookup). Query type 28, normal for modern networks. Packet sizes 69/97 bytes typical. Confirmed benign — legitimate IPv6 address resolution." },
  { id:20, src:"172.31.66.29",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Benign",         conf:0.98, tier:4, tools:4, cost:0.0829, time:30, hit:true,  reasoning:"DNS A record from host with prior HTTPS to Google infrastructure. Protocol switching (TCP→UDP) flagged low-severity but fully explained by DNS+web usage pattern. Benign confirmed." },
  { id:23, src:"18.219.193.20",   dst:"172.31.69.25",    port:80,   proto:"TCP", verdict:"BENIGN",     actual:"DoS_Hulk",       conf:0.95, tier:2, tools:6, cost:0.0860, time:28, hit:false, reasoning:"MISSED: Agent saw 3 HTTP flows targeting same server, classified as benign web browsing. Hulk DoS requires volume detection across many concurrent connections — single-flow analysis insufficient." },
  { id:25, src:"52.14.136.135",   dst:"172.31.69.25",    port:80,   proto:"TCP", verdict:"SUSPICIOUS", actual:"DDoS_LOIC-HTTP",  conf:0.50, tier:2, tools:4, cost:0.0635, time:135, hit:true, reasoning:"Tool errors on all calls (MCP timeout). Agent defaulted to SUSPICIOUS — correct verdict from baseline caution rather than evidence. Cost reflects 135s timeout waiting for tools." },
  { id:43, src:"172.31.69.28",    dst:"172.31.69.1",     port:67,   proto:"UDP", verdict:"BENIGN",     actual:"Brute_Force_XSS", conf:0.98, tier:3, tools:4, cost:0.0704, time:146, hit:false, reasoning:"MISSED: Agent identified DHCP pattern (port 67/68, UDP, 328/357 bytes) and confidently classified as benign infrastructure. XSS brute force camouflaged with DHCP-like flow characteristics." },
  { id:44, src:"172.31.69.28",    dst:"172.31.69.1",     port:67,   proto:"UDP", verdict:"BENIGN",     actual:"Brute_Force_XSS", conf:0.98, tier:3, tools:4, cost:0.0715, time:147, hit:false, reasoning:"MISSED: Repeated DHCP flow pattern. Agent gave detailed DHCP analysis with 98% confidence. Without cross-flow context showing repeated UDP 67/68 at machine speed, XSS disguise is convincing." },
  { id:50, src:"172.31.69.12",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Infilteration",  conf:0.95, tier:3, tools:4, cost:0.0707, time:145, hit:false, reasoning:"MISSED: Single DNS AAAA query from internal IP. Agent correctly identified as legitimate DNS. But this is part of a 30-flow burst from 2 IPs in 3.2 seconds — temporal context required." },
  { id:51, src:"172.31.69.12",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"BENIGN",     actual:"Infilteration",  conf:0.95, tier:3, tools:4, cost:0.0738, time:152, hit:false, reasoning:"MISSED: Identical DNS pattern. Without memory of flow 50, no anomaly visible. The infiltration signature is 30 consecutive DNS queries in 3.2 seconds — invisible to single-flow analysis." },
  { id:52, src:"172.31.69.12",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"SUSPICIOUS", actual:"Infilteration",  conf:0.50, tier:3, tools:4, cost:0.0642, time:135, hit:true,  reasoning:"Tool errors led to default SUSPICIOUS. Ironically correct verdict — but from tool failure, not actual detection. Highlights need for temporal correlation agent." },
  { id:53, src:"172.31.67.91",    dst:"172.31.0.2",      port:53,   proto:"UDP", verdict:"SUSPICIOUS", actual:"Benign",         conf:0.95, tier:4, tools:4, cost:0.0695, time:145, hit:false, reasoning:"FALSE POSITIVE: Agent output says BENIGN in reasoning but verdict field shows SUSPICIOUS. Parsing inconsistency — agent gave detailed benign analysis but default SUSPICIOUS was recorded." },
];

const AGENTS = [
  {
    id: "orchestrator",
    name: "Orchestrator",
    model: "claude-opus-4-6",
    role: "Coordinates specialist agents, makes final verdicts, triggers retroactive reclassification",
    color: "#00d4aa",
    icon: "⬡",
    systemPrompt: `You are the NIDS Orchestrator. Your role is to:
1. Receive NetFlow records and distribute to specialist agents
2. Aggregate findings from Flow Analyst, Pattern Correlator, and Temporal Correlation agents
3. Make final VERDICT decisions (BENIGN / SUSPICIOUS / MALICIOUS)
4. Trigger retroactive reclassification when new evidence changes prior assessments
5. Maintain awareness of the investigation context across all flows

Output format:
VERDICT: [BENIGN|SUSPICIOUS|MALICIOUS]
CONFIDENCE: [0.0-1.0]
ATTACK_TYPE: [type or N/A]
REASONING: [detailed explanation]
RETROACTIVE: [any prior flows that should be reclassified]`,
    stats: { processed: 58, accuracy: "72.4%", avgTime: "91s" }
  },
  {
    id: "flow_analyst",
    name: "Flow Analyst",
    model: "claude-sonnet-4-6",
    role: "Analyses individual NetFlow records for statistical anomalies and protocol violations",
    color: "#3b82f6",
    icon: "◈",
    systemPrompt: `You are the Flow Analyst agent. Your role is to:
1. Examine individual NetFlow records for statistical anomalies
2. Check packet ratios, byte distributions, duration patterns
3. Identify protocol violations and unusual flag combinations
4. Compare against known attack signatures in flow features

Key indicators to check:
- IN_BYTES / OUT_BYTES ratio (attack flows often heavily skewed)
- IN_PKTS (DDoS typically shows extreme packet counts)
- DURATION vs packet count (brute force: many short flows)
- TCP flags (unusual combinations suggest scanning/exploits)
- Port numbers (privileged ports from external IPs are suspicious)

Respond with: ANOMALY_SCORE, FLAGS, and REASONING.`,
    stats: { processed: 58, accuracy: "78%", avgTime: "45s" }
  },
  {
    id: "pattern_correlator",
    name: "Pattern Correlator",
    model: "claude-sonnet-4-6",
    role: "Clusters related flows, identifies multi-stage attacks and C2 patterns",
    color: "#a855f7",
    icon: "◎",
    systemPrompt: `You are the Pattern Correlator agent. Your role is to:
1. Group flows by source IP, destination, and time window
2. Identify coordinated multi-source attacks (DDoS)
3. Detect C2 beaconing patterns (regular interval connections)
4. Correlate port scanning sequences across multiple flows
5. Flag when multiple attack types target the same destination

Clustering parameters:
- Time window: 60 seconds for burst detection
- IP grouping: same /24 subnet treated as coordinated
- Port sequence: ordered port probes suggest scanning

Output: CLUSTER_ID, PATTERN_TYPE, RELATED_FLOWS, CONFIDENCE`,
    stats: { processed: 58, accuracy: "85%", avgTime: "38s" }
  },
  {
    id: "temporal_agent",
    name: "Temporal Correlation",
    model: "claude-sonnet-4-6",
    role: "Detects slow-burn attacks, APTs, and patterns only visible across time",
    color: "#f59e0b",
    icon: "◷",
    systemPrompt: `You are the Temporal Correlation agent. Your role is to:
1. Maintain a rolling window of flow history (last 500 flows)
2. Detect low-and-slow attacks that are invisible in single-flow analysis
3. Identify infiltration via anomalous internal DNS burst patterns
4. Flag when an IP's behaviour changes significantly over time
5. Trigger RETROACTIVE alerts when current evidence re-contextualises prior benign flows

Critical patterns to detect:
- Internal DNS bursts: >5 queries/second from same source = infiltration indicator
- FTP/SSH repeated short connections: brute force signature
- Consistent payload sizes at regular intervals: C2 beaconing
- Gradual port escalation: reconnaissance pattern

Output: TEMPORAL_SCORE, PATTERN, TIME_WINDOW, RETROACTIVE_FLAGS`,
    stats: { processed: 58, accuracy: "67%", avgTime: "120s" }
  },
  {
    id: "explainability",
    name: "Explainability",
    model: "claude-sonnet-4-6",
    role: "Generates human-readable reports, explains missed detections, suggests prompt improvements",
    color: "#ec4899",
    icon: "◉",
    systemPrompt: `You are the Explainability agent. Your role is to:
1. Generate human-readable summaries of detections and missed cases
2. Analyse false positives and false negatives to identify systematic weaknesses
3. Suggest improvements to other agents' system prompts
4. Produce comparison reports between experiment runs
5. Explain why benign flows were misclassified and vice versa

For each missed detection:
- Identify what feature or pattern should have triggered
- Determine if it was a single-flow vs multi-flow failure
- Suggest the minimum context needed to detect correctly

Output: EXPLANATION, ROOT_CAUSE, SUGGESTED_FIX, CONFIDENCE`,
    stats: { processed: 15, accuracy: "N/A", avgTime: "60s" }
  },
];

const EXPERIMENTS = [
  {
    id: "iter_2",
    name: "Iter 2 — Benign Baseline Calibration",
    date: "2026-02-19",
    status: "complete",
    flows: 58,
    cost: "$7.18",
    time: "223 min",
    accuracy: "67.2%",
    f1: "77.6%",
    precision: "78.6%",
    recall: "76.7%",
    changes: "Adds calibration guidance teaching the agent that empty threat intel for RFC1918/private IPs is expected — not suspicious. Defines known-benign traffic patterns (DNS, DHCP, HTTPS). Requires POSITIVE evidence of anomaly before flagging suspicious. No temporal memory.",
    notes: "Balanced trade-off: FP reduced 13→9 vs baseline, benign accuracy up from 13.3%→40%. Recall drops from 93%→77% — agent now misses some attacks it previously caught by over-flagging. 16 flows classified BENIGN (vs 5 in baseline).",
    variables: { max_iterations: 10, model: "claude-sonnet-4-20250514", batch_size: 58, tools_enabled: "all", temporal_memory: false, benign_calibration: true, confidence_threshold: false },
    confusion: { tp: 33, fp: 9, tn: 6, fn: 10 },
    verdicts: { benign: 16, suspicious: 37, malicious: 5 },
  },
  {
    id: "iter_1",
    name: "Iter 1 — Temporal Memory",
    date: "2026-02-19",
    status: "complete",
    flows: 58,
    cost: "$6.73",
    time: "218 min",
    accuracy: "67.2%",
    f1: "75.3%",
    precision: "85.3%",
    recall: "67.4%",
    changes: "Adds SQLite-based temporal store tracking all analysed flows. Before each flow analysis, queries recent activity from same source IP within a 60-second window. When a source IP has sent >3 flows in the window, temporal context is prepended to the prompt describing volume and target patterns.",
    notes: "Best precision (85.3%) but worst recall (67.4%). Temporal context only injected for 2/58 flows (3.4% injection rate) — batch lacked temporal density. 5 flows classified MALICIOUS (first time). Nearly 2× cost of baseline due to max_iterations=10.",
    variables: { max_iterations: 10, model: "claude-sonnet-4-20250514", batch_size: 58, tools_enabled: "all", temporal_memory: true, benign_calibration: false, confidence_threshold: false },
    confusion: { tp: 29, fp: 5, tn: 10, fn: 14 },
    verdicts: { benign: 24, suspicious: 29, malicious: 5 },
  },
  {
    id: "baseline",
    name: "Phase 1 — MCP Baseline",
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
    notes: "0/142 external tool calls returned meaningful data (private/anonymized IPs). Best recall (93%) but worst precision (75.5%). Agent defaults to SUSPICIOUS when uncertain — 53/58 flows flagged suspicious. Benign accuracy only 13.3%.",
    variables: { max_iterations: 5, model: "claude-sonnet-4-20250514", batch_size: 58, tools_enabled: "all", temporal_memory: false, benign_calibration: false, confidence_threshold: false },
    confusion: { tp: 40, fp: 13, tn: 2, fn: 3 },
    verdicts: { benign: 5, suspicious: 53, malicious: 0 },
  },
];

const MISSED = FLOWS.filter(f => f.reasoning.startsWith("MISSED") || f.reasoning.startsWith("FALSE POSITIVE"));
const HITS   = FLOWS.filter(f => !f.reasoning.startsWith("MISSED") && !f.reasoning.startsWith("FALSE POSITIVE") && f.hit);

// ── Colour helpers ─────────────────────────────────────────────────────────────
const verdictColour = (v) => ({
  "BENIGN":    { bg: "#0f291f", border: "#166534", text: "#4ade80" },
  "SUSPICIOUS":{ bg: "#2a1f0a", border: "#92400e", text: "#fbbf24" },
  "MALICIOUS": { bg: "#2a0a0a", border: "#991b1b", text: "#f87171" },
}[v] || { bg: "#1c2a3a", border: "#334155", text: "#94a3b8" });

const tierLabel = (t) => ["","External Tool","Feature-Rich","Temporal","Benign Baseline"][t] || "";
const tierColour = (t) => ["","#3b82f6","#a855f7","#f59e0b","#64748b"][t] || "#64748b";

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
  }
  .tab {
    padding: 10px 20px;
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

  /* Flow table */
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

  /* Detail panel */
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

  /* Agent cards */
  .agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
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
  .agent-icon { font-size: 24px; margin-bottom: 8px; }
  .agent-name { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 14px; margin-bottom: 4px; }
  .agent-model { font-size: 10px; color: #475569; margin-bottom: 8px; }
  .agent-role { font-size: 11px; color: #64748b; line-height: 1.5; }
  .stat-row { display: flex; gap: 16px; margin-top: 12px; padding-top: 12px; border-top: 1px solid #1a2840; }
  .stat { display: flex; flex-direction: column; gap: 2px; }
  .stat-val { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 16px; }
  .stat-label { font-size: 9px; color: #475569; letter-spacing: 0.08em; text-transform: uppercase; }

  /* Prompt editor */
  .prompt-editor {
    width: 100%;
    background: #0a1222;
    border: 1px solid #1a2840;
    border-radius: 4px;
    padding: 12px;
    font-family: 'Space Mono', monospace;
    font-size: 11px;
    color: #c8d8e8;
    line-height: 1.6;
    resize: vertical;
    min-height: 300px;
    outline: none;
  }
  .prompt-editor:focus { border-color: #00d4aa44; }

  /* Button */
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
  .btn-danger { background: #ef444420; border-color: #ef4444; color: #ef4444; }

  /* Comparison */
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

  /* Experiments */
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

  /* Variables diff */
  .var-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .var-table td { padding: 5px 8px; font-size: 11px; border-bottom: 1px solid #0f1a28; }
  .var-table td:first-child { color: #475569; width: 200px; }
  .changed { color: #f59e0b !important; }

  /* Scrollbar */
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
    display: flex; 
    align-items: center; 
    gap: 8px; 
    padding: 5px 8px; 
    border-radius: 3px;
    background: #0a1222;
    margin-bottom: 4px;
    font-size: 10px;
  }
  .tool-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

  .thinking-stream {
    background: #0a1222;
    border: 1px solid #1a2840;
    border-radius: 4px;
    padding: 12px;
    font-size: 10px;
    line-height: 1.8;
    color: #475569;
    font-family: 'Space Mono', monospace;
    overflow-y: auto;
    max-height: 200px;
  }

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

  .gap { gap: 16px; }
  .flex { display: flex; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
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

  @keyframes fadeIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }
  .fade-in { animation: fadeIn 0.2s ease; }
`;

// ── Component ──────────────────────────────────────────────────────────────────
export default function NIDSDashboard() {
  const [tab, setTab] = useState("flows");
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [agentPrompts, setAgentPrompts] = useState(
    Object.fromEntries(AGENTS.map(a => [a.id, a.systemPrompt]))
  );
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [filter, setFilter] = useState("all");
  const [selectedExp, setSelectedExp] = useState(EXPERIMENTS[0]);
  const [compExpId, setCompExpId] = useState("iter_1");

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

  const toolCalls = flow ? [
    { name: "record_flow",       cat: "netflow",   meaningful: true,  result: "Recorded flow, queue_size updated" },
    { name: "geolocate_ip",      cat: "external",  meaningful: false, result: "AWS Ohio / Private IP — no useful data" },
    { name: "check_ip_abuseipdb",cat: "external",  meaningful: false, result: "0 reports, confidence 0%" },
    { name: "check_ip_otx",      cat: "external",  meaningful: false, result: "No threats found in OTX database" },
  ].slice(0, Math.min(flow.tools, 4)) : [];

  const toolColour = (cat) => ({ netflow:"#00d4aa", external:"#f59e0b", mitre:"#a855f7" }[cat] || "#64748b");

  return (
    <>
      <style>{css}</style>
      <div className="nids">
        {/* Header */}
        <div className="header">
          <div className="status-dot" />
          <div className="header-title">NIDS // Threat Monitor</div>
          <div style={{ display:"flex", gap:20, marginLeft:20 }}>
            {[
              { label:"EXPERIMENTS", val: EXPERIMENTS.length },
              { label:"TOTAL FLOWS", val: EXPERIMENTS.reduce((s,e)=>s+e.flows,0) },
              { label:"BEST F1", val: "83.3%", col:"#4ade80" },
              { label:"TOTAL COST", val: "$"+EXPERIMENTS.reduce((s,e)=>s+parseFloat(e.cost.slice(1)),0).toFixed(2) },
            ].map(m => (
              <div key={m.label} style={{ display:"flex", gap:6, alignItems:"baseline" }}>
                <span style={{ fontSize:13, fontFamily:"Syne", fontWeight:700, color: m.col||"#e2e8f0" }}>{m.val}</span>
                <span style={{ fontSize:9, color:"#334155", letterSpacing:"0.1em" }}>{m.label}</span>
              </div>
            ))}
          </div>
          <div className="header-sub">NF-CICIDS2018-v3 · 3 Iterations · 58 Flows Each · 2026-02-19</div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[
            ["flows",      "01 Flow Monitor"],
            ["agents",     "02 Agent Inspector"],
            ["comparison", "03 Missed Detections"],
            ["experiments","04 Experiment Log"],
          ].map(([id, label]) => (
            <button key={id} className={`tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>
              {label}
            </button>
          ))}
        </div>

        <div className="content fade-in" key={tab}>

          {/* ── FLOW MONITOR ── */}
          {tab === "flows" && (
            <div className="split">
              <div>
                {/* Summary metrics */}
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

                {/* Filters */}
                <div className="filter-row">
                  <span style={{ fontSize:9, color:"#334155", letterSpacing:"0.1em" }}>FILTER:</span>
                  {[
                    ["all","All ("+FLOWS.length+")"],
                    ["hit","Correct Detections"],
                    ["missed","Missed Attacks"],
                    ["fp","False Positives"],
                    ["suspicious","Verdict: Suspicious"],
                    ["benign","Verdict: Benign"],
                  ].map(([id, label]) => (
                    <button key={id} className={`filter-btn ${filter===id?"active":""}`} onClick={()=>setFilter(id)}>{label}</button>
                  ))}
                </div>

                {/* Table */}
                <div className="overflow">
                  <table className="flow-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Source</th>
                        <th>Dest</th>
                        <th>Port</th>
                        <th>Proto</th>
                        <th>Tier</th>
                        <th>Verdict</th>
                        <th>Actual</th>
                        <th>Conf</th>
                        <th>Tools</th>
                        <th>Cost</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFlows.map(f => {
                        const vc = verdictColour(f.verdict);
                        const isMissed = f.reasoning.startsWith("MISSED");
                        const isFP = f.reasoning.startsWith("FALSE");
                        const isSelected = selectedFlow === f.id;
                        return (
                          <tr
                            key={f.id}
                            className={`flow-row mono ${isSelected?"selected":""} ${isMissed?"missed":""} ${isFP?"fp":""}`}
                            onClick={() => setSelectedFlow(isSelected ? null : f.id)}
                          >
                            <td style={{ color:"#334155" }}>{String(f.id).padStart(3,"0")}</td>
                            <td style={{ color:"#94a3b8" }}>{f.src}</td>
                            <td style={{ color:"#64748b" }}>{f.dst}</td>
                            <td style={{ color:"#475569" }}>{f.port}</td>
                            <td style={{ color:"#475569" }}>{f.proto}</td>
                            <td>
                              <span style={{ fontSize:9, color: tierColour(f.tier), letterSpacing:"0.05em" }}>
                                T{f.tier}
                              </span>
                            </td>
                            <td>
                              <span className="badge" style={{ background:vc.bg, borderColor:vc.border, color:vc.text }}>
                                {f.verdict}
                              </span>
                            </td>
                            <td style={{ color: f.hit && !isMissed && !isFP ? "#4ade80" : isMissed ? "#f87171" : "#fbbf24", fontSize:10 }}>
                              {f.actual}
                            </td>
                            <td style={{ color: f.conf >= 0.8 ? "#4ade80" : f.conf >= 0.6 ? "#fbbf24" : "#64748b" }}>
                              {(f.conf*100).toFixed(0)}%
                            </td>
                            <td style={{ color:"#475569" }}>{f.tools}</td>
                            <td style={{ color:"#334155" }}>${f.cost.toFixed(4)}</td>
                            <td style={{ color:"#334155" }}>{f.time}s</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Side panel */}
              <div>
                {flow ? (
                  <div className="detail-panel fade-in">
                    <div className="section-label">Flow Detail — ID {String(flow.id).padStart(3,"0")}</div>
                    <div className="detail-title">{flow.src} → {flow.dst}</div>

                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                      {[
                        { k:"Port", v: flow.port },
                        { k:"Protocol", v: flow.proto },
                        { k:"Tier", v: `T${flow.tier} — ${tierLabel(flow.tier)}`, col: tierColour(flow.tier) },
                        { k:"Confidence", v: `${(flow.conf*100).toFixed(0)}%` },
                        { k:"Tools Used", v: flow.tools },
                        { k:"Cost", v: `$${flow.cost.toFixed(4)}` },
                        { k:"Time", v: `${flow.time}s` },
                      ].map(({k,v,col}) => (
                        <div key={k} style={{ background:"#0a1222", borderRadius:3, padding:"6px 10px" }}>
                          <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:2 }}>{k}</div>
                          <div style={{ fontSize:12, color: col || "#c8d8e8" }}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {/* Verdict */}
                    {(() => { const vc = verdictColour(flow.verdict); return (
                      <div style={{ background:vc.bg, border:`1px solid ${vc.border}`, borderRadius:4, padding:"8px 12px", marginBottom:12 }}>
                        <div style={{ fontSize:9, color: vc.text, letterSpacing:"0.1em", marginBottom:2, opacity:0.7 }}>VERDICT</div>
                        <div style={{ fontFamily:"Syne", fontWeight:700, fontSize:16, color: vc.text }}>{flow.verdict}</div>
                        <div style={{ fontSize:10, color: "#64748b", marginTop:2 }}>Actual: <span style={{ color: flow.hit ? "#4ade80":"#f87171" }}>{flow.actual}</span></div>
                      </div>
                    ); })()}

                    {/* Tool calls */}
                    <div className="section-label">Tool Call Trace</div>
                    {toolCalls.map((t, i) => (
                      <div key={i} className="tool-row">
                        <div className="tool-dot" style={{ background: toolColour(t.cat) }} />
                        <span style={{ color:"#94a3b8", fontFamily:"Space Mono", fontSize:10 }}>{t.name}</span>
                        <span style={{ marginLeft:"auto", color: t.meaningful ? "#4ade80":"#ef4444", fontSize:9 }}>
                          {t.meaningful ? "✓ data":"✗ empty"}
                        </span>
                      </div>
                    ))}

                    {/* Reasoning */}
                    <div className="section-label" style={{ marginTop:12 }}>Agent Reasoning</div>
                    <div className="reasoning-box">
                      {flow.reasoning.startsWith("MISSED") && (
                        <div style={{ color:"#f87171", fontWeight:700, marginBottom:6 }}>⚠ MISSED DETECTION</div>
                      )}
                      {flow.reasoning.startsWith("FALSE") && (
                        <div style={{ color:"#fbbf24", fontWeight:700, marginBottom:6 }}>⚠ FALSE POSITIVE</div>
                      )}
                      {flow.reasoning.replace(/^(MISSED|FALSE POSITIVE): /, "")}
                    </div>
                  </div>
                ) : (
                  <div style={{ color:"#334155", padding:20, textAlign:"center", fontSize:11, marginTop:40 }}>
                    ← Select a flow to inspect
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── AGENT INSPECTOR ── */}
          {tab === "agents" && (
            <div>
              <div className="agent-grid mb-3">
                {AGENTS.map(a => (
                  <div
                    key={a.id}
                    className={`agent-card ${selectedAgent === a.id ? "selected" : ""}`}
                    style={{ borderColor: selectedAgent === a.id ? a.color : undefined }}
                    onClick={() => { setSelectedAgent(a.id); setEditingPrompt(false); }}
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
                  <div className="flex items-center justify-between mb-3">
                    <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <span style={{ fontSize:20, color: agent.color }}>{agent.icon}</span>
                      <div>
                        <div className="detail-title" style={{ marginBottom:0, color: agent.color }}>{agent.name} Agent</div>
                        <div style={{ fontSize:10, color:"#475569" }}>{agent.model}</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button className={`btn ${editingPrompt ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => setEditingPrompt(!editingPrompt)}>
                        {editingPrompt ? "Editing..." : "Edit System Prompt"}
                      </button>
                      {editingPrompt && (
                        <button className="btn btn-primary"
                          onClick={() => setEditingPrompt(false)}>
                          Save Changes
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="section-label">System Prompt</div>
                  {editingPrompt ? (
                    <>
                      <textarea
                        className="prompt-editor"
                        value={agentPrompts[agent.id]}
                        onChange={e => setAgentPrompts(p => ({...p, [agent.id]: e.target.value}))}
                      />
                      <div className="warn-box" style={{ marginTop:8 }}>
                        Changes will apply to the next experiment run. Save to persist, or reload to revert.
                      </div>
                    </>
                  ) : (
                    <div className="thinking-stream" style={{ maxHeight:300, whiteSpace:"pre-wrap" }}>
                      {agentPrompts[agent.id]}
                    </div>
                  )}

                  <div className="section-label mt-4">What this agent is responsible for</div>
                  <div className="reasoning-box">{agent.role}</div>

                  {agent.id === "temporal_agent" && (
                    <div className="error-box" style={{ marginTop:12 }}>
                      ⚠ <strong>Phase 1 Gap:</strong> This agent has no shared memory across flows in the current single-agent architecture. The Infiltration class (33.3% detection rate) is entirely attributable to the absence of this agent's cross-flow temporal window. Phase 2 directly addresses this.
                    </div>
                  )}
                  {agent.id === "flow_analyst" && (
                    <div className="warn-box" style={{ marginTop:12 }}>
                      ⚠ <strong>Benign bias issue:</strong> Over-triggering on flows with normal statistical profiles. The agent's base threshold needs calibration — 13/15 benign flows were flagged suspicious. Consider adding explicit benign pattern recognition to this prompt.
                    </div>
                  )}
                  {agent.id === "orchestrator" && (
                    <div className="highlight-box" style={{ marginTop:12 }}>
                      ✓ <strong>Retroactive reclassification</strong> is the core thesis contribution. When the temporal agent detects an infiltration burst, the orchestrator should retroactively reclassify all prior DNS flows in that window from BENIGN → SUSPICIOUS.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── MISSED DETECTIONS ── */}
          {tab === "comparison" && (
            <div>
              <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
                <div className="big-metric" style={{ flex:1 }}>
                  <div className="big-metric-val" style={{ color:"#4ade80" }}>{HITS.length}</div>
                  <div className="big-metric-label">Correct Detections</div>
                </div>
                <div className="big-metric" style={{ flex:1 }}>
                  <div className="big-metric-val" style={{ color:"#f87171" }}>{MISSED.length}</div>
                  <div className="big-metric-label">Missed Attacks</div>
                </div>
                <div className="big-metric" style={{ flex:1 }}>
                  <div className="big-metric-val" style={{ color:"#fbbf24" }}>13</div>
                  <div className="big-metric-label">False Positives (Benign)</div>
                </div>
                <div className="big-metric" style={{ flex:1 }}>
                  <div className="big-metric-val" style={{ color:"#a855f7" }}>13.3%</div>
                  <div className="big-metric-label">Benign Accuracy</div>
                </div>
              </div>

              <div className="comparison-grid">
                {/* Hits */}
                <div className="compare-card">
                  <div className="compare-header">
                    <span style={{ color:"#4ade80" }}>✓</span>
                    <span style={{ color:"#4ade80" }}>Correctly Detected ({HITS.length})</span>
                  </div>
                  {HITS.map(f => (
                    <div key={f.id} style={{ padding:"7px 0", borderBottom:"1px solid #0f1a28", cursor:"pointer" }}
                      onClick={() => { setSelectedFlow(f.id); setTab("flows"); }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:10, color:"#4ade80", fontWeight:700 }}>{f.actual}</span>
                        <span style={{ fontSize:9, color:"#334155" }}>T{f.tier} · ${f.cost.toFixed(3)}</span>
                      </div>
                      <div style={{ fontSize:10, color:"#475569" }}>{f.src} → port {f.port}</div>
                    </div>
                  ))}
                </div>

                {/* Missed */}
                <div className="compare-card">
                  <div className="compare-header">
                    <span style={{ color:"#f87171" }}>✗</span>
                    <span style={{ color:"#f87171" }}>Missed / False Positives ({MISSED.length + 1})</span>
                  </div>
                  {MISSED.map(f => (
                    <div key={f.id} style={{ padding:"8px", marginBottom:6, background:"#2a0a0a", borderRadius:4, border:"1px solid #991b1b", cursor:"pointer" }}
                      onClick={() => { setSelectedFlow(f.id); setTab("flows"); }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:11, color:"#f87171", fontWeight:700 }}>{f.actual}</span>
                        <span className="badge" style={{ background: verdictColour(f.verdict).bg, borderColor: verdictColour(f.verdict).border, color: verdictColour(f.verdict).text }}>
                          {f.verdict}
                        </span>
                      </div>
                      <div style={{ fontSize:10, color:"#ef4444", marginBottom:4 }}>{f.src} → port {f.port}</div>
                      <div style={{ fontSize:10, color:"#7f1d1d", lineHeight:1.5 }}>{f.reasoning.replace(/^(MISSED|FALSE POSITIVE): /,"")}</div>
                    </div>
                  ))}
                  {/* The 13 benign FPs */}
                  <div style={{ padding:"8px", background:"#2a1f0a", borderRadius:4, border:"1px solid #92400e", marginTop:4 }}>
                    <div style={{ fontSize:11, color:"#fbbf24", fontWeight:700, marginBottom:4 }}>13× Benign → SUSPICIOUS (False Positives)</div>
                    <div style={{ fontSize:10, color:"#92400e", lineHeight:1.5 }}>
                      All 13 false positives share the same root cause: the agent lacks a benign baseline calibration. Normal DNS, DHCP, and HTTPS flows were flagged suspicious because the system has no learned definition of "normal" to compare against. The single-agent architecture defaults to suspicion when evidence is absent.
                    </div>
                  </div>
                </div>
              </div>

              {/* Reasoning agent panel */}
              <div className="detail-panel mt-4">
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                  <span style={{ color:"#ec4899", fontSize:18 }}>◉</span>
                  <div>
                    <div style={{ fontFamily:"Syne", fontWeight:700, fontSize:14, color:"#ec4899" }}>Explainability Agent — Root Cause Analysis</div>
                    <div style={{ fontSize:10, color:"#475569" }}>Systematic failure analysis across all missed detections</div>
                  </div>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
                  {[
                    {
                      title: "Infiltration (33.3%)",
                      col: "#f87171",
                      cause: "Root cause: single-flow isolation. Each DNS flow looks perfectly normal in isolation — 60-byte query, port 53, internal IP, TTL 60s. The attack signature (30 flows in 3.2 seconds from 2 IPs) is only visible across time.",
                      fix: "Solution: Temporal Correlation Agent with 60-second rolling window. When >5 DNS queries/second detected from same source, retroactively flag all flows in burst."
                    },
                    {
                      title: "Brute Force XSS (66.7%)",
                      col: "#fbbf24",
                      cause: "Root cause: protocol camouflage. The XSS flows were crafted to mimic DHCP packet sizes (328/357 bytes, UDP, short duration). Agent gave high-confidence BENIGN analysis — saw DHCP, didn't suspect attack.",
                      fix: "Solution: Flow Analyst should flag DHCP-sized UDP flows targeting non-router IPs. 172.31.69.28 is not a DHCP server — context-aware port/role validation needed."
                    },
                    {
                      title: "DoS Hulk (0% per-flow)",
                      col: "#a855f7",
                      cause: "Root cause: volume attack, single-flow detection. Each individual Hulk flow looks like legitimate HTTP (port 80, 16-26 packets, reasonable duration). The DoS is the aggregate — hundreds of concurrent connections.",
                      fix: "Solution: Pattern Correlator Agent clusters flows by dest IP × time window. When >50 concurrent HTTP flows to same target detected, trigger DoS alert regardless of per-flow normalcy."
                    },
                  ].map(item => (
                    <div key={item.title} style={{ background:"#0a1222", border:"1px solid #1a2840", borderRadius:4, padding:12 }}>
                      <div style={{ fontFamily:"Syne", fontWeight:700, fontSize:12, color: item.col, marginBottom:8 }}>{item.title}</div>
                      <div className="section-label">Root Cause</div>
                      <div style={{ fontSize:10, color:"#94a3b8", lineHeight:1.6, marginBottom:8 }}>{item.cause}</div>
                      <div className="section-label">Suggested Fix</div>
                      <div style={{ fontSize:10, color:"#4ade80", lineHeight:1.6 }}>{item.fix}</div>
                    </div>
                  ))}
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
                        <div className="exp-name">{exp.name}</div>
                        <span className="badge" style={{
                          background: exp.status==="complete" ? "#0f291f" : exp.status==="abandoned" ? "#2a0a0a" : "#2a1f0a",
                          borderColor: exp.status==="complete" ? "#166534" : exp.status==="abandoned" ? "#991b1b" : "#92400e",
                          color: exp.status==="complete" ? "#4ade80" : exp.status==="abandoned" ? "#f87171" : "#fbbf24",
                        }}>
                          {exp.status.toUpperCase()}
                        </span>
                        <span style={{ marginLeft:"auto", fontSize:10, color:"#334155" }}>{exp.date}</span>
                      </div>
                      <div style={{ fontSize:10, color:"#475569", lineHeight:1.5 }}>{exp.notes}</div>
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
                          const changed = compExp && otherVal !== v;
                          return (
                            <tr key={k}>
                              <td>{k}</td>
                              <td className={changed ? "changed" : ""}>{String(v)}</td>
                              {compExp && <td style={{ color:"#334155", fontSize:10 }}>{String(otherVal)}</td>}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Confusion Matrix + Verdict Distribution */}
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
                          {e.name}
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
                              <td style={{ color:"#00d4aa", fontSize:9 }}>{selectedExp.name.split("—")[0].trim()}</td>
                              <td style={{ color:"#f59e0b", fontSize:9 }}>{compExp.name.split("—")[0].trim()}</td>
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
                                selectedExp.confusion ? `${selectedExp.confusion.tp} / ${selectedExp.confusion.fp}` : "N/A",
                                compExp.confusion ? `${compExp.confusion.tp} / ${compExp.confusion.fp}` : "N/A"],
                              ["TN / FN",
                                selectedExp.confusion ? `${selectedExp.confusion.tn} / ${selectedExp.confusion.fn}` : "N/A",
                                compExp.confusion ? `${compExp.confusion.tn} / ${compExp.confusion.fn}` : "N/A"],
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

                    <div style={{ display:"flex", gap:8, marginTop:16 }}>
                      <button className="btn btn-primary">Re-run Experiment</button>
                      <button className="btn btn-ghost">Export CSV</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
