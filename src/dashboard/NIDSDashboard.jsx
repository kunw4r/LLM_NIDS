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
    { attack_type: "FTP-BruteForce", status: "complete", recall: 76, fpr: 0, f1: 86, cost: 1.61, cost_per_tp: 0.042, confusion: { tp: 38, fp: 0, tn: 950, fn: 12 } },
    { attack_type: "SSH-Bruteforce", status: "complete", recall: 84, fpr: 3, f1: 87, cost: 4.21, cost_per_tp: 0.10, confusion: { tp: 42, fp: 28, tn: 922, fn: 8 } },
    { attack_type: "DoS-SlowHTTPTest", status: "complete", recall: 76, fpr: 5, f1: 79, cost: 3.89, cost_per_tp: 0.10, confusion: { tp: 38, fp: 47, tn: 903, fn: 12 } },
  ],
  overall: { best_f1: 87, total_flows: 3000, total_cost: 9.71, avg_fpr: 2.7 },
};

// Agent definitions
const AGENTS = [
  { id: "protocol", name: "Protocol", color: "#3b82f6", desc: "Validates protocol/port/flag consistency" },
  { id: "statistical", name: "Statistical", color: "#8b5cf6", desc: "Detects statistical anomalies in traffic features" },
  { id: "behavioural", name: "Behavioural", color: "#f59e0b", desc: "Matches flow patterns against known attack signatures" },
  { id: "temporal", name: "Temporal", color: "#ec4899", desc: "Analyses cross-flow patterns from same source IP" },
  { id: "devils_advocate", name: "Devil's Advocate", color: "#ef4444", desc: "Argues for benign interpretation of every flow" },
  { id: "orchestrator", name: "Orchestrator", color: "#10b981", desc: "Synthesizes all analyses into weighted consensus verdict" },
];

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

  // ── Story state ─────────────────────────────────────────────────────────────
  const [storyExpId, setStoryExpId] = useState(EXPERIMENTS[0].id);

  // ── Flow Inspector state ────────────────────────────────────────────────────
  const [inspectorData, setInspectorData] = useState(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorError, setInspectorError] = useState(null);
  const [inspectorFilter, setInspectorFilter] = useState("all");
  const [selectedFlowIdx, setSelectedFlowIdx] = useState(null);
  const [inspectorSource, setInspectorSource] = useState("stage1_ftp");
  const [searchQuery, setSearchQuery] = useState("");

  // ── Comparison state ────────────────────────────────────────────────────────
  const [compCategory, setCompCategory] = useState("all");
  const [compSort, setCompSort] = useState({ key: "f1", dir: "desc" });

  // ── Live experiment panel state ────────────────────────────────────────────
  const [liveStatus, setLiveStatus] = useState(null);
  const [livePanelOpen, setLivePanelOpen] = useState(false);
  const [liveSummary, setLiveSummary] = useState(null);

  // ── Thesis tab state ──────────────────────────────────────────────────────
  const [thesisDrafts, setThesisDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [selectedDraftContent, setSelectedDraftContent] = useState(null);

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
        if (data && (data.status === "running" || data.status === "paused" || data.status === "creating_batch" || data.status === "complete" || data.status === "all_done")) {
          setLiveStatus(data);
        } else {
          setLiveStatus(null);
        }
        // Also fetch running_summary.json for detailed experiment metrics
        try {
          const summResp = await fetch(`${RESULTS_BASE}/stage1/running_summary.json?t=${Date.now()}`);
          if (summResp.ok) setLiveSummary(await summResp.json());
        } catch (_) {}
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

  const bestF1 = Math.max(...EXPERIMENTS.map(e => e.f1));
  const totalFlows = EXPERIMENTS.reduce((s, e) => s + e.flows, 0) + STAGE1_SUMMARY.overall.total_flows;
  const totalCost = EXPERIMENTS.reduce((s, e) => s + e.cost, 0) + STAGE1_SUMMARY.overall.total_cost;

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

  // Pie counts for inspector
  const pieCounts = {
    malicious: inspectorFlows.filter(f => f.verdict?.toUpperCase() === "MALICIOUS").length,
    suspicious: inspectorFlows.filter(f => f.verdict?.toUpperCase() === "SUSPICIOUS").length,
    benign: inspectorFlows.filter(f => !f.tier1_filtered && f.verdict?.toUpperCase() === "BENIGN").length,
    filtered: inspectorFlows.filter(f => f.tier1_filtered).length,
  };
  const pieTotal = inspectorFlows.length || 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: "#1a1a1a", background: "#fff", minHeight: "100vh" }}>

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
      <header style={{ borderBottom: "1px solid #e5e7eb", padding: "16px 32px", display: "flex", alignItems: "center", gap: 24 }}>
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
            {/* Hero numbers */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Best F1 Score", value: pct(bestF1), sub: "Phase 3b — 150 flows" },
                { label: "Total Flows Analysed", value: totalFlows.toLocaleString(), sub: "Across all experiments" },
                { label: "Total Cost", value: dollar(totalCost), sub: "All API calls combined" },
              ].map(h => (
                <div key={h.label} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "24px" }}>
                  <div style={{ fontSize: 36, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.02em" }}>{h.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginTop: 4 }}>{h.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{h.sub}</div>
                </div>
              ))}
            </div>

            {/* One-sentence summary */}
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "#374151", marginBottom: 32, maxWidth: 800 }}>
              AMATAS is a multi-agent LLM system that analyses network traffic flows for intrusion detection.
              A Tier-1 Random Forest pre-filter routes obvious benign traffic around the expensive LLM pipeline,
              while 6 specialist agents (protocol, statistical, behavioural, temporal, devil's advocate, orchestrator)
              collaboratively classify suspicious flows with explainable reasoning.
            </p>

            {/* Architecture diagram */}
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

            {/* Summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "Best F1", value: `${STAGE1_SUMMARY.overall.best_f1}%`, sub: "SSH-Bruteforce" },
                { label: "Total Flows", value: STAGE1_SUMMARY.overall.total_flows.toLocaleString(), sub: `${STAGE1_SUMMARY.experiments.length} attack types tested` },
                { label: "Avg FPR", value: `${STAGE1_SUMMARY.overall.avg_fpr.toFixed(1)}%`, sub: "False positive rate" },
                { label: "Total Cost", value: dollar(STAGE1_SUMMARY.overall.total_cost), sub: `$${(STAGE1_SUMMARY.overall.total_cost / STAGE1_SUMMARY.overall.total_flows).toFixed(4)}/flow` },
              ].map(c => (
                <div key={c.label} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em" }}>{c.value}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginTop: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Results table */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["Attack Type", "Status", "Recall", "FPR", "F1", "Cost", "$/TP"].map(h => (
                      <th key={h} style={{ textAlign: h === "Attack Type" ? "left" : "right", padding: "12px 16px", fontWeight: 600, color: "#6b7280", fontSize: 12, borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {STAGE1_SUMMARY.experiments.map(exp => {
                    const stage1IdMap = { "FTP-BruteForce": "stage1_ftp", "SSH-Bruteforce": "stage1_ssh", "DoS-SlowHTTPTest": "stage1_slowhttp" };
                    const expId = stage1IdMap[exp.attack_type];
                    return (
                    <tr key={exp.attack_type} onClick={() => expId && openExperimentDetail(expId)} style={{ borderBottom: "1px solid #f3f4f6", cursor: expId ? "pointer" : "default" }} onMouseEnter={e => expId && (e.currentTarget.style.background = "#f9fafb")} onMouseLeave={e => e.currentTarget.style.background = ""}>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: expId ? "#2563eb" : "#374151" }}>{exp.attack_type}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500,
                          background: exp.status === "complete" ? "#f0fdf4" : "#fefce8",
                          color: exp.status === "complete" ? "#16a34a" : "#ca8a04" }}>
                          {exp.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>{exp.recall}%</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: exp.fpr > 5 ? "#dc2626" : "#6b7280" }}>{exp.fpr}%</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#2563eb" }}>{exp.f1}%</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#6b7280" }}>{dollar(exp.cost)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#6b7280" }}>{dollar(exp.cost_per_tp)}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Remaining attack types placeholder */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "24px", marginTop: 16, textAlign: "center", color: "#9ca3af" }}>
              <p style={{ fontSize: 14, marginBottom: 8 }}>11 more attack types queued for evaluation</p>
              <p style={{ fontSize: 12 }}>DoS-GoldenEye, DoS-Slowloris, DoS-Hulk, DDoS-HOIC, DDoS-LOIC-HTTP, DDoS-LOIC-UDP, SQL Injection, XSS, Infiltration, Bot, Brute Force Web</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* AMATAS — FLOW INSPECTOR                                            */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {topTab === "amatas" && amatasTab === "inspector" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, letterSpacing: "-0.02em" }}>Flow Inspector</h2>

            {/* Source selector */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#6b7280", marginRight: 4 }}>Load experiment:</span>
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

                {/* Pie chart overview */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                  {[
                    { label: "Malicious", count: pieCounts.malicious, color: "#dc2626", filter: "malicious" },
                    { label: "Suspicious", count: pieCounts.suspicious, color: "#d97706", filter: "suspicious" },
                    { label: "Benign", count: pieCounts.benign, color: "#16a34a", filter: "benign" },
                    { label: "Tier-1 Filtered", count: pieCounts.filtered, color: "#9ca3af", filter: "filtered" },
                  ].map(s => (
                    <button key={s.label} onClick={() => setInspectorFilter(inspectorFilter === s.filter ? "all" : s.filter)} style={{
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
                    <button key={id} onClick={() => setInspectorFilter(id)} style={{
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
                        {filteredInspectorFlows.slice(0, 200).map(f => {
                          const isAttack = f.label_actual === 1;
                          const predictedAttack = f.verdict?.toUpperCase() !== "BENIGN";
                          const correct = (isAttack && predictedAttack) || (!isAttack && !predictedAttack);
                          const isSelected = selectedFlowIdx === f.flow_idx;
                          return (
                            <tr key={f.flow_idx} onClick={() => setSelectedFlowIdx(isSelected ? null : f.flow_idx)} style={{
                              borderBottom: "1px solid #f3f4f6", cursor: "pointer",
                              background: isSelected ? "#eff6ff" : correct ? "#fafff9" : "#fff5f5",
                            }}>
                              <td style={{ padding: "8px 12px", color: "#9ca3af" }}>{f.flow_idx}</td>
                              <td style={{ padding: "8px 12px", fontSize: 11 }}>{f.attack_type_actual || "Benign"}</td>
                              <td style={{ padding: "8px 12px" }}>
                                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                                  color: verdictColor(f.verdict), background: verdictBg(f.verdict) }}>
                                  {f.verdict}
                                </span>
                              </td>
                              <td style={{ padding: "8px 12px", color: correctColor(correct), fontWeight: 600, fontSize: 11 }}>
                                {correct ? "Yes" : "No"}
                              </td>
                              <td style={{ padding: "8px 12px", color: "#6b7280" }}>{(f.confidence * 100).toFixed(0)}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredInspectorFlows.length > 200 && (
                      <div style={{ padding: "12px", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>
                        Showing first 200 of {filteredInspectorFlows.length} flows. Use search to narrow results.
                      </div>
                    )}
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
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#dc2626", textTransform: "uppercase" }}>Devil's Advocate</span>
                                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, color: "#16a34a", background: "#f0fdf4" }}>
                                  BENIGN {((selectedFlow.devils_advocate.confidence_benign || selectedFlow.devils_advocate.confidence || 0) * 100).toFixed(0)}%
                                </span>
                              </div>
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
                                <span style={{ fontSize: 12, fontWeight: 600, color: "#10b981", textTransform: "uppercase" }}>Orchestrator — Final Verdict</span>
                                <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                                  color: verdictColor(selectedFlow.verdict), background: verdictBg(selectedFlow.verdict) }}>
                                  {selectedFlow.verdict} {selectedFlow.confidence != null ? `${(selectedFlow.confidence * 100).toFixed(0)}%` : ""}
                                </span>
                              </div>
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
                          <div style={{ border: "1px solid #fbbf24", borderRadius: 8, padding: "12px 16px", background: "#fffbeb", color: "#92400e", fontSize: 13, lineHeight: 1.6 }}>
                            Detailed per-agent reasoning not available for this experiment — run with the updated pipeline to capture individual agent analysis.
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
        {topTab === "mcp" && (
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, letterSpacing: "-0.02em" }}>MCP Experiments</h2>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
              Comparing three conditions on the same batch: Zero-shot, Engineered prompt, and + MITRE ATT&CK MCP tools.
            </p>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: 16, color: "#6b7280", marginBottom: 12 }}>MCP experiments running — results will appear here</div>
              <p style={{ fontSize: 13, color: "#9ca3af", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 }}>
                Testing whether MCP tools (AbuseIPDB, OTX, geolocation, MITRE ATT&CK) provide any uplift
                over pure LLM reasoning on NetFlow features. Initial findings from Phase 1 suggest external
                threat intelligence returns 0% meaningful data on anonymized CICIDS2018 IPs.
              </p>
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
              {AGENTS.map(a => (
                <div key={a.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: a.color, marginBottom: 4 }}>{a.name}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{a.desc}</div>
                </div>
              ))}
            </div>

            {/* Dataset info */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px", marginTop: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Dataset: CICIDS2018 NetFlow v3</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, fontSize: 13 }}>
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
                  title: "Complete Stage 1: All 14 Attack Types",
                  desc: "Run the per-attack evaluation pipeline for all remaining attack types in the CICIDS2018 dataset. Each batch tests one attack type at 5% prevalence with Tier-1 RF pre-filtering.",
                  status: "In Progress",
                  statusColor: "#2563eb",
                },
                {
                  title: "MCP Controlled Experiment",
                  desc: "Three-condition comparison on the same batch: (1) Zero-shot LLM only, (2) Engineered prompt with NetFlow context, (3) LLM + MITRE ATT&CK MCP tools. Tests whether MCP tools add value beyond prompt engineering.",
                  status: "Planned",
                  statusColor: "#6b7280",
                },
                {
                  title: "Temporal Clustering",
                  desc: "Group flows by source IP and time window before analysis. Test whether cluster-level context improves detection of attacks like Infiltration that mimic benign DNS traffic.",
                  status: "Planned",
                  statusColor: "#6b7280",
                },
                {
                  title: "Cross-Model Validation",
                  desc: "Run the best configuration (GPT-4o-mini at $0.004/flow) across all attack types and compare against the Sonnet-4 baseline for quality-cost trade-off analysis.",
                  status: "Planned",
                  statusColor: "#6b7280",
                },
                {
                  title: "Thesis Write-Up",
                  desc: "Compile all experimental results, architecture decisions, and findings into the formal thesis document. The dashboard serves as the interactive companion to the written thesis.",
                  status: "Planned",
                  statusColor: "#6b7280",
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
