# Visual Architecture Diagrams

## 1. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                    LLM-BASED NIDS WITH MEMORY                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                      DATA INGESTION LAYER                        │ │
│  │                                                                  │ │
│  │    NetFlow Data → Packet Agent → Normalized Format              │ │
│  │    (CICIDS2018)   (Parser)       (Structured JSON)              │ │
│  └────────────────────────┬─────────────────────────────────────────┘ │
│                           │                                             │
│                           ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    FILTERING LAYER (ML)                          │ │
│  │                                                                  │ │
│  │    XGBoost Classifier → Score (0.0 - 1.0)                       │ │
│  │    - Trained on CICIDS2018                                      │ │
│  │    - 80+ flow features                                          │ │
│  │    - Filters 85% as benign                                      │ │
│  │                                                                  │ │
│  │    If score < 0.7 → Benign (store & exit)                      │ │
│  │    If score ≥ 0.7 → Suspicious (pass to LLM)                   │ │
│  └────────────────────────┬─────────────────────────────────────────┘ │
│                           │                                             │
│                           ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    MEMORY LAYER (RAG)                            │ │
│  │                                                                  │ │
│  │    ┌────────────────┐      ┌───────────────────┐               │ │
│  │    │   Vector DB    │      │   Time-Series     │               │ │
│  │    │  (ChromaDB)    │      │   Store (SQLite)  │               │ │
│  │    │                │      │                   │               │ │
│  │    │ • Embeddings   │      │ • Raw flows       │               │ │
│  │    │ • Semantic     │      │ • Metadata        │               │ │
│  │    │   search       │      │ • Timestamps      │               │ │
│  │    └────────────────┘      └───────────────────┘               │ │
│  │             │                        │                          │ │
│  │             └──────────┬─────────────┘                          │ │
│  │                        ▼                                        │ │
│  │         Memory Agent (Retrieval Interface)                     │ │
│  │         - Get IP history (time-windowed)                       │ │
│  │         - Calculate baselines                                  │ │
│  │         - Detect trends                                        │ │
│  │         - Semantic search                                      │ │
│  └────────────────────────┬─────────────────────────────────────────┘ │
│                           │                                             │
│                           ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    REASONING LAYER (LLM)                         │ │
│  │                                                                  │ │
│  │    Analyst LLM (Claude/GPT-4/Llama)                             │ │
│  │    ┌────────────────────────────────────────────────┐           │ │
│  │    │ Prompt:                                        │           │ │
│  │    │ • Current flow                                 │           │ │
│  │    │ • Retrieved history (RAG)                      │           │ │
│  │    │ • Baseline metrics                             │           │ │
│  │    │ • Trend analysis                               │           │ │
│  │    │ • Chain-of-Thought steps                       │           │ │
│  │    └────────────────────────────────────────────────┘           │ │
│  │                        ↓                                         │ │
│  │    ┌────────────────────────────────────────────────┐           │ │
│  │    │ Response:                                      │           │ │
│  │    │ • Threat level (benign/suspicious/malicious)  │           │ │
│  │    │ • Confidence score                             │           │ │
│  │    │ • Natural language explanation                 │           │ │
│  │    │ • Evidence list                                │           │ │
│  │    │ • Attack type (if applicable)                  │           │ │
│  │    └────────────────────────────────────────────────┘           │ │
│  └────────────────────────┬─────────────────────────────────────────┘ │
│                           │                                             │
│                           ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                    ACTION LAYER                                  │ │
│  │                                                                  │ │
│  │    • Store result in memory (for future correlation)            │ │
│  │    • Generate alert (if malicious)                              │ │
│  │    • Log to SIEM                                                │ │
│  │    • Update baselines                                           │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Slow-Burn Attack Detection Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                    DETECTING GRADUAL ESCALATION                         │
│                                                                         │
│  Timeline: 14 Days                                                     │
│  ────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Day 1: 50MB upload                                                    │
│    ↓                                                                   │
│  [Memory Agent] Store: {ip: 10.0.0.5, bytes: 50MB, date: Jan 7}       │
│  [Decision] Normal (within baseline)                                   │
│                                                                         │
│  Day 2: 52MB upload (+4%)                                              │
│    ↓                                                                   │
│  [Memory Agent] Store + retrieve Day 1                                 │
│  [Trend Detector] Calculate: +4% change                                │
│  [Decision] Normal (small variation)                                   │
│                                                                         │
│  Day 3-6: Gradual increases (55, 60, 68, 75 MB)                       │
│    ↓                                                                   │
│  [Memory Agent] Store each day                                         │
│  [Trend Detector] Slope = +4.2 MB/day                                  │
│  [Decision] Suspicious (trend emerging)                                │
│                                                                         │
│  Day 7: 85MB upload (+70% from Day 1)                                  │
│    ↓                                                                   │
│  [Memory Agent] Retrieve 7-day history                                 │
│  [Baseline Calc] Mean: 50MB, Current: 85MB (3.5 std devs)             │
│  [Trend Detector] Consistent upward trend (R² = 0.94)                  │
│  [LLM Analysis]                                                        │
│    Prompt: "This IP has increased uploads by 70% over 7 days.         │
│             Pattern: [50, 52, 55, 60, 68, 75, 85]                     │
│             Is this data exfiltration?"                                │
│    Response: "SUSPICIOUS - Gradual escalation matches low-and-slow    │
│               exfiltration. Monitor closely."                          │
│  [Decision] Flag as suspicious, continue monitoring                    │
│                                                                         │
│  Day 8-13: Continued escalation (92, 98, 105, 110, 115, 118 MB)       │
│    ↓                                                                   │
│  [Memory Agent] Store + track cumulative trend                         │
│  [Trend Detector] Slope = +5.0 MB/day, R² = 0.96 (highly consistent)  │
│                                                                         │
│  Day 14: 120MB upload (+140% from Day 1)                               │
│    ↓                                                                   │
│  [Memory Agent] Retrieve 14-day history                                │
│  [Baseline Calc] Mean: 50MB, Current: 120MB (7 std devs!)             │
│  [Trend Detector]                                                      │
│    - Total change: +140%                                               │
│    - Daily change: +5% avg                                             │
│    - R² = 0.96 (near-perfect linear trend)                             │
│    - Confidence: 0.89                                                  │
│  [LLM Analysis]                                                        │
│    Prompt: "Complete 14-day pattern:                                   │
│             [50, 52, 55, 60, 68, 75, 85, 92, 98, 105, 110, 115,      │
│              118, 120]                                                 │
│             +140% increase with consistent trend.                      │
│             Baseline: 50MB ± 5MB                                       │
│             External IP (known suspicious): 45.33.32.156               │
│             Is this data exfiltration?"                                │
│    Response: "MALICIOUS - High confidence data exfiltration.           │
│               Evidence:                                                │
│               1. 140% volume increase over 14 days                     │
│               2. Consistent daily escalation (+5% avg)                 │
│               3. Destination is external IP                            │
│               4. Matches low-and-slow exfil pattern                    │
│               Recommendation: Block IP, investigate endpoint"          │
│  [Decision] 🚨 ALERT - Data Exfiltration Detected!                     │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘

KEY: Traditional ML would miss this because each day individually looks normal.
     Memory + temporal analysis detects the cumulative pattern.
```

---

## 3. Data Flow: Single Flow Analysis

```
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 1: INGESTION                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Raw NetFlow Record (from CICIDS2018):                              │
│  {                                                                   │
│    "src_ip": "192.168.10.50",                                       │
│    "dst_ip": "172.16.0.1",                                          │
│    "src_port": 44321,                                               │
│    "dst_port": 443,                                                 │
│    "protocol": "TCP",                                               │
│    "tot_fwd_pkts": 120,                                             │
│    "tot_bwd_pkts": 85,                                              │
│    "tot_bytes": 50000000,  // 50MB                                  │
│    "timestamp": "2025-01-21T10:00:00"                               │
│  }                                                                   │
│                                                                      │
│  ↓ [Packet Agent] Parse & normalize                                 │
│                                                                      │
│  Normalized Flow:                                                    │
│  {                                                                   │
│    "src_ip": "192.168.10.50",                                       │
│    "dst_ip": "172.16.0.1",                                          │
│    "dst_port": 443,                                                 │
│    "bytes_total": 50000000,                                         │
│    "packets_total": 205,                                            │
│    "duration": 120.5,                                               │
│    "timestamp": "2025-01-21T10:00:00"                               │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 2: ML PRE-SCREENING                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [ML Filter Agent] XGBoost Classifier                               │
│                                                                      │
│  Extract 80+ features:                                              │
│    - bytes_total: 50000000                                          │
│    - packets_total: 205                                             │
│    - bytes_per_packet: 243,902                                      │
│    - duration: 120.5                                                │
│    - dst_port: 443 (HTTPS)                                          │
│    - ... (75 more features)                                         │
│                                                                      │
│  ↓ [XGBoost Model]                                                  │
│                                                                      │
│  Anomaly Score: 0.78  ← SUSPICIOUS! (threshold = 0.7)               │
│                                                                      │
│  Decision: Pass to LLM for analysis                                 │
│  (If score < 0.7, would be labeled "benign" and exit here)          │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 3: MEMORY RETRIEVAL (RAG)                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Memory Agent] Query Vector DB                                     │
│                                                                      │
│  Query 1: Get IP history                                            │
│    retrieve_ip_history("192.168.10.50", days=7)                     │
│                                                                      │
│  Retrieved History (last 10 flows):                                 │
│  [                                                                   │
│    {date: "Jan 14", bytes: 30MB, dests: 3, threat: "benign"},      │
│    {date: "Jan 15", bytes: 32MB, dests: 4, threat: "benign"},      │
│    {date: "Jan 16", bytes: 35MB, dests: 4, threat: "benign"},      │
│    {date: "Jan 17", bytes: 38MB, dests: 5, threat: "benign"},      │
│    {date: "Jan 18", bytes: 42MB, dests: 5, threat: "benign"},      │
│    {date: "Jan 19", bytes: 45MB, dests: 6, threat: "benign"},      │
│    {date: "Jan 20", bytes: 48MB, dests: 6, threat: "benign"},      │
│    {date: "Jan 21", bytes: 50MB, dests: 7, threat: "?"}  ← Current │
│  ]                                                                   │
│                                                                      │
│  Query 2: Calculate baseline                                        │
│    calculate_baseline("192.168.10.50", "bytes_total", days=14)      │
│                                                                      │
│  Baseline:                                                           │
│    - Mean: 30MB                                                     │
│    - Std Dev: 5MB                                                   │
│    - Threshold (3σ): 45MB                                           │
│    - Current: 50MB  ← EXCEEDS THRESHOLD!                            │
│                                                                      │
│  Query 3: Detect trend                                              │
│    detect_gradual_trend("192.168.10.50", "bytes_total", days=7)     │
│                                                                      │
│  Trend Analysis:                                                     │
│    - Slope: +2.86 MB/day                                            │
│    - Total change: +66% over 7 days                                 │
│    - R²: 0.94 (strong linear trend)                                 │
│    - Direction: increasing                                          │
│    - Significance: YES (>20% change)                                │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 4: LLM REASONING                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Analyst LLM] Claude-3.5-Sonnet                                    │
│                                                                      │
│  Constructed Prompt:                                                 │
│  ─────────────────────────────────────────────────────────────────  │
│  You are a cybersecurity analyst examining network traffic.         │
│                                                                      │
│  CURRENT FLOW:                                                       │
│  {                                                                   │
│    "src_ip": "192.168.10.50",                                       │
│    "dst_ip": "172.16.0.1",                                          │
│    "bytes_total": 50000000,                                         │
│    "timestamp": "2025-01-21T10:00:00"                               │
│  }                                                                   │
│                                                                      │
│  ML ANOMALY SCORE: 0.78 (suspicious)                                │
│                                                                      │
│  HISTORICAL CONTEXT:                                                 │
│  • Last 7 days: [30MB, 32MB, 35MB, 38MB, 42MB, 45MB, 48MB, 50MB]   │
│  • Baseline: 30MB ± 5MB                                             │
│  • Current vs baseline: +66% (3 std devs above mean)                │
│  • Trend: +2.86 MB/day (R² = 0.94)                                  │
│  • Pattern: Consistent gradual increase                             │
│                                                                      │
│  TASK: Analyze using step-by-step reasoning                         │
│  1. Compare to baseline                                             │
│  2. Assess trend significance                                       │
│  3. Check for attack patterns                                       │
│  4. Final verdict                                                   │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                      │
│  ↓ [LLM Processing with Chain-of-Thought]                           │
│                                                                      │
│  LLM Response:                                                       │
│  {                                                                   │
│    "threat_level": "suspicious",                                    │
│    "confidence": 0.85,                                              │
│    "attack_type": "potential_data_exfiltration",                    │
│    "explanation": "This IP shows a concerning pattern of gradually │
│                    increasing upload volumes over 7 days (+66%).    │
│                    Current upload (50MB) exceeds baseline by 3      │
│                    standard deviations. The consistent linear       │
│                    trend (R²=0.94) suggests intentional escalation  │
│                    rather than random variation. While not yet      │
│                    definitive, this matches early-stage             │
│                    low-and-slow data exfiltration patterns.         │
│                    Recommend continued monitoring and alerting if   │
│                    trend continues.",                               │
│    "evidence": [                                                    │
│      "66% increase over 7 days",                                    │
│      "Exceeds baseline by 3 standard deviations",                   │
│      "Strong linear trend (R²=0.94)",                               │
│      "Consistent daily escalation"                                  │
│    ],                                                                │
│    "requires_alert": true                                           │
│  }                                                                   │
└─────────────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────────────┐
│ STEP 5: ACTION                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [NIDSController] Execute actions:                                  │
│                                                                      │
│  1. Store analysis in memory                                        │
│     store_flow_summary(                                             │
│       ip="192.168.10.50",                                           │
│       summary={                                                     │
│         "timestamp": "2025-01-21T10:00:00",                         │
│         "bytes_total": 50000000,                                    │
│         "threat_level": "suspicious",                               │
│         "confidence": 0.85                                          │
│       }                                                             │
│     )                                                               │
│                                                                      │
│  2. Generate alert                                                  │
│     🚨 ALERT: Suspicious Activity Detected                          │
│     ─────────────────────────────────────────                       │
│     IP: 192.168.10.50                                               │
│     Type: Potential Data Exfiltration                               │
│     Confidence: 85%                                                 │
│     Evidence:                                                       │
│       • 66% upload increase over 7 days                             │
│       • Exceeds baseline by 3 std devs                              │
│       • Strong linear trend (R²=0.94)                               │
│     Action: Monitor closely, alert if continues                     │
│                                                                      │
│  3. Log to file (alerts.jsonl)                                      │
│     {                                                               │
│       "timestamp": "2025-01-21T10:00:00",                           │
│       "src_ip": "192.168.10.50",                                    │
│       "threat_level": "suspicious",                                 │
│       "explanation": "..."                                          │
│     }                                                               │
│                                                                      │
│  4. Update statistics                                               │
│     total_flows: 1523                                               │
│     ml_filtered: 1200 (79%)                                         │
│     llm_analyzed: 323                                               │
│     alerts: 15                                                      │
└─────────────────────────────────────────────────────────────────────┘

RESULT: Flow flagged as suspicious, stored in memory, alert generated.
        Future flows from this IP will include this context!
```

---

## 4. Cost Comparison Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     COST COMPARISON                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  SCENARIO: 100,000 flows per day                                    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ APPROACH 1: Stateless Batching (Current)                     │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  100,000 flows                                               │  │
│  │      ↓                                                       │  │
│  │  Batch into 100-flow groups                                  │  │
│  │      ↓                                                       │  │
│  │  1,000 batches × 1 LLM call each = 1,000 API calls          │  │
│  │      ↓                                                       │  │
│  │  Cost: 1,000 calls × $0.06/call = $60/day                   │  │
│  │                                                              │  │
│  │  Monthly cost: $60 × 30 = $1,800/month                       │  │
│  │                                                              │  │
│  │  ❌ No memory between batches                                │  │
│  │  ❌ Can't detect slow-burn attacks                           │  │
│  │  ❌ Expensive (all flows analyzed)                           │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ APPROACH 2: Memory-Enabled with ML Filter (New)             │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  100,000 flows                                               │  │
│  │      ↓                                                       │  │
│  │  ML Filter (XGBoost) - 85% filtered as benign               │  │
│  │      ↓                             ↓                         │  │
│  │  85,000 benign          15,000 suspicious                    │  │
│  │  (stored in memory,     (needs LLM analysis)                 │  │
│  │   no LLM needed)                  ↓                          │  │
│  │                         Of these, ~99% still benign          │  │
│  │                                   ↓                          │  │
│  │                         Only ~15 truly ambiguous need LLM    │  │
│  │                                   ↓                          │  │
│  │  Cost: 15 calls × $0.09/call = $1.35/day                    │  │
│  │        (slightly more per call due to history context)       │  │
│  │                                                              │  │
│  │  Monthly cost: $1.35 × 30 = $40/month                        │  │
│  │                                                              │  │
│  │  ✅ All flows stored in memory                               │  │
│  │  ✅ Can detect slow-burn attacks                             │  │
│  │  ✅ 97.8% cost reduction vs Approach 1                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  SAVINGS: $1,800 → $40 = $1,760/month saved!                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   COST BREAKDOWN                             │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │                                                              │  │
│  │  Component               Monthly Cost                        │  │
│  │  ──────────────────────  ─────────────                       │  │
│  │  LLM API calls           $40                                 │  │
│  │  ChromaDB (local)        $0 (self-hosted)                    │  │
│  │  XGBoost inference       $0 (local CPU)                      │  │
│  │  Storage (100K flows)    ~$5 (disk space)                    │  │
│  │                          ───                                 │  │
│  │  TOTAL:                  $45/month                           │  │
│  │                                                              │  │
│  │  vs $1,800/month (stateless) = 97.5% savings!               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Technology Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                      TECHNOLOGY STACK                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ LAYER 1: Data Ingestion & Parsing                           │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • Python 3.10+                                              │  │
│  │  • Pandas (data manipulation)                                │  │
│  │  • NumPy (numerical operations)                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ LAYER 2: ML Pre-Filtering                                   │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • XGBoost 2.0+ (gradient boosting classifier)               │  │
│  │  • scikit-learn (feature engineering, evaluation)            │  │
│  │  • Training: CICIDS2018 dataset                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ LAYER 3: Memory & Storage                                   │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • ChromaDB 0.4+ (vector database)                           │  │
│  │  • sentence-transformers (text embeddings)                   │  │
│  │    - Model: all-MiniLM-L6-v2 (384-dim vectors)               │  │
│  │  • SQLite (time-series metadata)                             │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ LAYER 4: LLM Reasoning                                       │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  Option A: Claude 3.5 Sonnet (Anthropic)                     │  │
│  │    • Best reasoning capability                               │  │
│  │    • $3/M input, $15/M output tokens                         │  │
│  │                                                              │  │
│  │  Option B: GPT-4 Turbo (OpenAI)                              │  │
│  │    • Fast inference                                          │  │
│  │    • $10/M input, $30/M output tokens                        │  │
│  │                                                              │  │
│  │  Option C: Llama-3-8B (Meta) - fine-tuned                    │  │
│  │    • Local deployment (no API costs)                         │  │
│  │    • Requires GPU (NVIDIA A100)                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ LAYER 5: Integration & Orchestration                         │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • MCP SDK 0.5+ (Model Context Protocol)                     │  │
│  │  • asyncio (async/await patterns)                            │  │
│  │  • JSON-RPC 2.0 (MCP communication)                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ LAYER 6: Monitoring & Alerting                              │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • JSON Lines (alert logging)                                │  │
│  │  • Python logging module                                     │  │
│  │  • Integration: SIEM (optional)                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ SUPPORTING TOOLS                                             │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  • pytest (testing)                                          │  │
│  │  • black (code formatting)                                   │  │
│  │  • mypy (type checking)                                      │  │
│  │  • Git (version control)                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

These diagrams complement the written documentation and provide visual reference for the architecture!
