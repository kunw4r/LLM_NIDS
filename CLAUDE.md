# CLAUDE.md — AMATAS Project Context

> **This file is read by every Claude Code instance.** Follow these instructions exactly.

---

## 1. PROJECT OVERVIEW

**AMATAS** (Advanced Multi-Agent Threat Analysis System) is an LLM-augmented
Network Intrusion Detection System built as a university Master's thesis.
Submission deadline: **April 2026** (~2 months away).

The core question: can LLMs provide *explainable* network intrusion detection
that traditional ML cannot? Unlike black-box classifiers, every AMATAS verdict
includes full reasoning chains from multiple specialist agents — you can trace
exactly why a flow was flagged, what evidence was considered, and what
counter-arguments were weighed.

**Dataset:** CICIDS2018 NetFlow v3 — 20M flows, 53 features, 14 attack types,
87% benign. IPs are anonymized (private ranges like 172.31.x.x). Split into:
- `development.csv` — 7.04M flows (training/batch creation)
- `validation.csv` — 5.03M flows (hyperparameter tuning)
- `test.csv` — 8.05M flows (final evaluation, held out)

---

## 2. THE THREE AMATAS ITERATIONS

### v1 — Pure Multi-Agent (baseline, DONE)
Six LLM agents analyze every flow. No pre-filtering.
- Cost: ~$0.028/flow (GPT-4o), ~$0.108/flow (Claude Sonnet)
- Result: Good detection but economically unscalable to 20M flows

### v2 — ML Head + Multi-Agent (BUILT, Stage 1 running)
Random Forest pre-filter classifies obvious benign flows (95% of traffic),
only uncertain/suspicious flows go to the 6-agent LLM pipeline.
- Tier 1 RF threshold: 0.15 → 100% recall on attacks, 0% FP on dev set
- Cost reduction: 95% (only 5% of flows need LLM analysis)
- Stage 1 experiments: running per-attack-type at 1000 flows each

### v3 — Clustering + ML Head + Multi-Agent (PLANNED)
Temporal clustering groups related flows before LLM analysis, giving agents
richer context. Hypothesis: better context = better recall on hard attacks
(DoS-Hulk, Infiltration) where individual flows look benign.

---

## 3. THE MCP COMPARISON EXPERIMENTS

Separate from AMATAS. Three configurations of a single-agent MCP-based system:
1. **Zero-shot:** Raw flow → LLM → verdict (no tools, no prompt engineering)
2. **Engineered prompt:** Detailed system prompt with attack signatures
3. **+ MITRE ATT&CK tool:** System prompt + MCP tool for MITRE lookups

Expected finding: external tools (AbuseIPDB, OTX, geolocation) are useless on
synthetic/anonymized IPs. This motivates the multi-agent approach.

Results directory: `results/mcp/` (experiments pending)

---

## 4. DIRECTORY STRUCTURE

```
Thesis/
├── agents/                          # 6 AMATAS agents + base class
│   ├── base_agent.py                #   LLM calling, retry, cost tracking
│   ├── protocol_agent.py            #   Port/flag/protocol validation
│   ├── statistical_agent.py         #   Volume/timing anomaly detection
│   ├── behavioural_agent.py         #   Attack signature + MITRE mapping
│   ├── temporal_agent.py            #   Cross-flow IP pattern analysis
│   ├── devils_advocate_agent.py     #   Argues for benign interpretation
│   └── orchestrator_agent.py        #   Weighted consensus engine
│
├── data/
│   ├── datasets/                    # CICIDS2018 source CSVs (gitignored)
│   │   ├── development.csv          #   7.04M flows
│   │   ├── validation.csv           #   5.03M flows
│   │   └── test.csv                 #   8.05M flows
│   ├── batches/
│   │   └── stage1/                  # Stage 1 per-attack-type batches
│   │       ├── validation/          #   100 flows, DDOS-HOIC (10a/90b)
│   │       └── FTP-BruteForce/      #   1000 flows (50a/950b)
│   └── feature_sets/
│       ├── stage1_features.json     #   14 features used in Stage 1
│       ├── full_features.json       #   All 53 CICIDS2018 features
│       └── reduced_features.json    #   15 variance-selected features
│
├── models/
│   └── tier1_rf.pkl                 # Trained RF classifier (DO NOT DELETE)
│
├── results/
│   └── stage1/                      # Stage 1 experiment results
│       ├── control.json             #   Pause/stop pipeline control
│       ├── live_status.json         #   Live progress (updated every 10 flows)
│       ├── running_summary.json     #   Aggregate results across experiments
│       ├── inventory.json           #   Attack type counts per CSV split
│       ├── run_log.txt              #   Timestamped execution log
│       ├── validation_results.json          # gpt-4o-mini validation (rejected)
│       ├── gpt4o_validation_results.json    # gpt-4o validation (baseline)
│       ├── tier1_gpt4o_validation.json      # Tier 1 + gpt-4o v1 (bug)
│       ├── tier1_gpt4o_v2_validation.json   # Tier 1 + gpt-4o v2 (fixed)
│       ├── FTP-BruteForce_results.json      # First 1000-flow production run
│       └── *_results.json                   # More as experiments complete
│
├── scripts/
│   ├── stage1_pipeline.py           # Full Stage 1 runner (batch creation + eval)
│   ├── tier1_filter.py              # RF pre-filter wrapper (threshold 0.15)
│   ├── train_tier1.py               # RF training script
│   ├── stage1_inventory.py          # Dataset attack type census
│   ├── select_features.py           # Feature selection (variance + correlation)
│   ├── create_scaled_batches.py     # Attack-isolation batch creator
│   ├── run_scaled_eval.py           # Scaled evaluation runner
│   ├── scaled_eval_analysis.py      # Cross-experiment analysis
│   └── prepare_dashboard_data.py    # Generates dashboard data.js
│
├── tests/
│   └── phase3_multiagent.py         # Main evaluation runner (CLI, --tier1)
│
├── src/
│   ├── mcp_server/                  # MCP server (13 tools, STDIO transport)
│   ├── agent/                       # Phase 1 MCP-based agent (legacy)
│   ├── dashboard/                   # React dashboard (NIDSDashboard.jsx)
│   ├── analysis/                    # Metrics calculation
│   ├── data_preparation/            # Dataset splitting scripts
│   └── testing/                     # Phase 1 batch processor
│
├── docs/                            # Planning, guides, analysis reports
├── CLAUDE.md                        # THIS FILE
└── EXPERIMENTS_LOG.md               # Running experiment log
```

---

## 5. CURRENT EXPERIMENT STATUS

### Completed Experiments (result files exist)

| File | Attack Type | Model | Flows | Tier1 | Recall | F1 | Cost |
|------|-------------|-------|-------|-------|--------|-----|------|
| `validation_results.json` | DDOS-HOIC | gpt-4o-mini | 100 | No | 100% | 18% | $0.18 |
| `gpt4o_validation_results.json` | DDOS-HOIC | gpt-4o | 100 | No | 60% | 26% | $2.80 |
| `tier1_gpt4o_validation.json` | DDOS-HOIC | gpt-4o | 100 | Yes | 0% | 0% | $0.12 |
| `tier1_gpt4o_v2_validation.json` | DDOS-HOIC | gpt-4o | 100 | Yes | 50% | 67% | $0.29 |
| `FTP-BruteForce_results.json` | FTP-BruteForce | gpt-4o | 1000 | Yes | 76% | 86% | $1.61 |

### Completed via `stage1_pipeline.py` (in `running_summary.json`)

| Attack Type | TP | FP | FN | TN | Recall | FPR | F1 | Cost |
|-------------|----|----|----|----|--------|-----|-----|------|
| SSH-Bruteforce | 42 | 28 | 8 | 922 | 84% | 3% | 87% | $4.21 |
| DoS-SlowHTTPTest | 38 | 47 | 12 | 903 | 76% | 5% | 79% | $3.89 |

### Remaining (12 attack types still to run)

From `inventory.json`, all 14 attack types have sufficient flows:
FTP-BruteForce, SSH-Bruteforce, DoS-SlowHTTPTest (done) plus:
DDoS-LOIC-HTTP, DoS-Hulk, DoS-GoldenEye, DoS-Slowloris,
DDOS-HOIC, DDOS-LOIC-UDP, Bot, Infilteration,
Brute_Force-Web, Brute_Force-XSS, SQL_Injection

---

## 6. ARCHITECTURE — HOW AMATAS WORKS

```
Raw NetFlow record
  │
  ▼
[Tier 1: Random Forest Pre-Filter]
  │ threshold = 0.15 (P(attack) < 0.15 → auto-BENIGN)
  │ filters ~95% of flows as benign (zero LLM cost)
  │
  ├─→ Auto-BENIGN (high-confidence benign, skip LLM)
  │
  └─→ Uncertain / Suspicious → LLM Pipeline
      │
      ▼
      ┌────────────────────────────────────────┐
      │  Phase 1: 4 Specialists (parallel)     │
      │  ┌──────────┐ ┌──────────────┐         │
      │  │ Protocol │ │ Statistical  │         │
      │  │  Agent   │ │    Agent     │         │
      │  └──────────┘ └──────────────┘         │
      │  ┌──────────┐ ┌──────────────┐         │
      │  │Behavioural│ │  Temporal   │         │
      │  │  Agent   │ │    Agent     │         │
      │  └──────────┘ └──────────────┘         │
      └────────────────────────────────────────┘
      │
      ▼
      ┌────────────────────────────────────────┐
      │  Phase 2: Devil's Advocate (30% weight)│
      │  Reviews all specialist findings and   │
      │  argues for benign interpretation      │
      └────────────────────────────────────────┘
      │
      ▼
      ┌────────────────────────────────────────┐
      │  Phase 3: Orchestrator (consensus)     │
      │  Synthesizes all 5 analyses → verdict  │
      │  BENIGN / SUSPICIOUS / MALICIOUS       │
      └────────────────────────────────────────┘
```

### What Each Agent Must Store

**All specialist agents** (protocol, statistical, behavioural, temporal):
- `verdict`: BENIGN / SUSPICIOUS / MALICIOUS
- `confidence`: 0.0–1.0
- `attack_type`: predicted attack type (or null)
- `key_findings`: list of evidence strings
- `reasoning`: full reasoning text (NOT just verdict)
- `tokens`: {input, output} counts
- `cost`: USD cost of this call

**Temporal agent** additionally stores:
- Connected flows used as context (co-IP flows from same source)
- IP history summary (flow count, port diversity, temporal pattern)
- Temporal pattern type (burst, sequential, repetitive, diverse)

**Devil's Advocate** stores:
- `confidence_benign`: how strongly it argues for benign (0.0–1.0)
- `strongest_benign_indicator`: the single best benign argument
- Full counter-argument text

**Orchestrator** stores:
- `verdict`, `confidence`, `attack_type`, `reasoning`
- `consensus_score`: specialist agreement (0.0–1.0)
- `mitre_techniques`: list of relevant MITRE ATT&CK IDs
- Which specialists agreed/disagreed
- Per-agent cost breakdown

---

## 7. KEY DECISIONS MADE

| Decision | Reasoning |
|----------|-----------|
| **GPT-4o-mini rejected** | 100% FPR — classified everything as malicious (systematic bias) |
| **Claude Sonnet rejected for Stage 1** | Rate limits too severe for 1000-flow batches |
| **GPT-4o chosen for Stage 1** | Best balance: 60–84% recall, 0–5% FPR, ~$0.028/flow |
| **Tier 1 RF threshold: 0.15** | 100% recall on dev set (catches all attacks), 0% FP |
| **14 features** (not 15) | FLOW_DIRECTION unavailable in CICIDS2018 NetFlow v3 |
| **DA weight: 30%** | Validated in Phase 3c; 50% was too aggressive (Phase 3e) |
| **Cost limit: $5.00/batch** | Hard limit per 1000-flow experiment |
| **Seed: 42** | Reproducible batch creation |
| **50 attack + 950 benign** per batch | Realistic 5% attack ratio (production would be ~5–13%) |
| **Chronological-by-IP ordering** | Sort by SRC_ADDR then FLOW_START_MILLISECONDS |

---

## 8. WHAT EVERY INSTANCE MUST KNOW

### Operational Rules
- **Check `results/stage1/control.json`** before running experiments
  - `{"command": "run"}` = proceed
  - `{"command": "pause"}` = wait and poll every 30s
  - `{"command": "stop"}` = abort gracefully
- **Update `live_status.json`** every 10 flows during pipeline runs
- **Never exceed $5.00 per batch** without explicit user approval
- **Never run OpenAI models** without confirming whose API key is in `.env`
- **Commit and push results** after every completed experiment
- **If experiment fails midway:** save partial results with `"status": "interrupted"`, push anyway

### Data Rules
- **Always store full reasoning text** — not just verdicts. This is the explainability thesis.
- **Never modify completed result files** in `results/stage1/` — these are thesis data
- **Never retrain the RF model** without approval — `models/tier1_rf.pkl` took hours
- **Never modify source CSVs** in `data/datasets/`
- The `data/` directory is gitignored (too large for GitHub)

### Environment
- `OPENAI_API_KEY` — for GPT-4o agent calls
- `ANTHROPIC_API_KEY` — for Claude-based experiments
- `ABUSEIPDB_KEY` — AbuseIPDB (useless on anonymized IPs, kept for MCP comparison)
- `OTX_API_KEY` — AlienVault OTX (same caveat)

---

## 9. THE DASHBOARD VISION

### Tabs
- **AMATAS** — v1/v2/v3 iteration results comparison
- **MCP Experiments** — zero-shot vs prompt-engineered vs MITRE tool
- **Clustering** — v3 temporal clustering results
- **Comparison** — AMATAS vs MCP side-by-side
- **Architecture** — system diagram, agent descriptions
- **What's Next** — future work / remaining experiments

### Flow Inspector (the explainability centerpiece)
Click any experiment → see all flows → click any flow → see:
- Every agent's full reasoning text
- Key evidence points per agent
- Connected flows used by temporal agent
- Devil's Advocate counter-argument
- Orchestrator final synthesis and decision rationale
- MITRE ATT&CK technique mapping

### Live Updates
- Experiments push `live_status.json` to GitHub on every checkpoint
- Dashboard reads from raw GitHub URLs
- Auto-refreshes every 15 seconds

### Files
- `src/dashboard/NIDSDashboard.jsx` — main React component
- `src/dashboard/data.js` — generated experiment data
- `src/dashboard/server.py` — backend API
- `scripts/prepare_dashboard_data.py` — data generator

---

## 10. RESEARCH NARRATIVE (thesis argument)

### Core Thesis
LLMs are not black boxes. Unlike traditional ML classifiers that output a
probability with no explanation, AMATAS produces:
- Multi-layered reasoning from diverse analytical perspectives
- Traceable evidence chains (which features triggered which agent)
- Counter-arguments via Devil's Advocate (why it might NOT be an attack)
- Synthesized consensus with explicit agreement/disagreement

### Progression Arc
1. **Phase 1:** Single agent + MCP tools → tools useless on anonymized IPs
2. **Phase 2:** Prompt engineering → hit single-agent reasoning ceiling
3. **Phase 3:** Multi-agent AMATAS → broke through ceiling (F1: 68% → 86%)
4. **Stage 1:** Realistic traffic testing → cost problem found ($0.028/flow)
5. **v2 (ML Head):** RF pre-filter → solved cost (95% reduction), maintained accuracy
6. **v3 (Clustering):** Hypothesis: temporal context density improves recall on hard attacks
7. **MCP comparison:** External tools vs no tools → expected: tools don't help on synthetic data

### Key Insight
The two-tier architecture (cheap ML filter + expensive LLM analysis) is the
practical contribution. It makes LLM-based NIDS economically viable at scale
while preserving the explainability advantage.

---

## 11. CONTRIBUTION CHECKLIST

- [x] First per-attack-type evaluation at realistic class distribution (95% benign)
- [x] Two-tier ML+LLM architecture for cost reduction (95% savings demonstrated)
- [x] Devil's Advocate agent for false positive control (0% FPR on Stage 1)
- [x] Temporal context as detection variable (temporal agent most expensive but most informative)
- [x] Rejection of GPT-4o-mini for NIDS (systematic bias documented)
- [ ] Complete Stage 1 evaluation across all 14 attack types (3/14 done)
- [ ] Temporal clustering (v3) — design and implementation
- [ ] MCP tool ablation study (3 configurations)
- [ ] Explainability demonstration via Flow Inspector dashboard
- [ ] Final test set evaluation (held-out test.csv)

---

## 12. FILES TO NEVER MODIFY WITHOUT CARE

| File | Risk |
|------|------|
| `models/tier1_rf.pkl` | Retrain = hours of compute on 7M flows |
| `data/datasets/*.csv` | Source data, irreplaceable |
| `results/stage1/*_results.json` | Completed thesis experiments — DO NOT overwrite |
| `results/stage1/running_summary.json` | Aggregate results, append-only |
| `results/stage1/inventory.json` | Dataset census, computed once |
| `.env` | API keys — never commit |

---

## 13. COMMANDS REFERENCE

```bash
# Run a single experiment via phase3_multiagent.py
python tests/phase3_multiagent.py \
  --batch data/batches/stage1/FTP-BruteForce \
  --model gpt-4o --provider openai \
  --specialist-model gpt-4o --specialist-provider openai \
  --tier1 --cost-limit 5.00 \
  --output results/stage1/FTP-BruteForce_results.json

# Run the full Stage 1 pipeline (all attack types sequentially)
python scripts/stage1_pipeline.py

# Create a batch programmatically
python -c "
from scripts.stage1_pipeline import create_batch
create_batch('FTP-BruteForce', n_attack=50, n_benign=950, seed=42, batch_name='FTP-BruteForce')
"

# Train RF model (CAUTION: takes hours)
python scripts/train_tier1.py

# Generate dashboard data
python scripts/prepare_dashboard_data.py
```
