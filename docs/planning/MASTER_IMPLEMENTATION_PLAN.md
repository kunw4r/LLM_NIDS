# Master Implementation Plan: LLM-Based NIDS with Memory & Revision

**Goal:** Build autonomous LLM agent that analyzes NetFlow batches, uses MCP tools for evidence gathering, and performs smart revision to improve detection accuracy.

**Success Criteria:**
- ✅ LLM demonstrates reasoning (not just pattern matching)
- ✅ Revision improves accuracy measurably (batch vs final)
- ✅ MCP shows composability value (easy to add tools)
- ✅ Efficient operation (smart targeting, not reviewing everything)
- ✅ Explainable decisions (cited evidence)

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS NIDS AGENT                     │
│                                                               │
│  Phase 1: Sequential Batch Processing                        │
│  ┌────────┐  ┌────────┐  ┌────────┐       ┌────────┐       │
│  │Batch 1 │─▶│Batch 2 │─▶│Batch 3 │─ ... ─│Batch N │       │
│  └────────┘  └────────┘  └────────┘       └────────┘       │
│       │          │           │                  │            │
│       └──────────┴───────────┴──────────────────┘            │
│                        │                                      │
│                        ▼                                      │
│              ┌──────────────────┐                            │
│              │  Decision Store  │                            │
│              │  (with confidence│                            │
│              │   scores)        │                            │
│              └──────────────────┘                            │
│                        │                                      │
│  Phase 2: Smart Revision Targeting                           │
│                        │                                      │
│         ┌──────────────┼──────────────┐                      │
│         ▼              ▼              ▼                       │
│  ┌──────────┐  ┌─────────────┐  ┌──────────┐               │
│  │Low Conf  │  │Implicated   │  │Behavioral│               │
│  │Decisions │  │IPs          │  │Anomalies │               │
│  │(<85%)    │  │(attack chain)│  │(shifts)  │               │
│  └──────────┘  └─────────────┘  └──────────┘               │
│         │              │              │                       │
│         └──────────────┴──────────────┘                      │
│                        │                                      │
│                        ▼                                      │
│              ┌──────────────────┐                            │
│              │  Review & Revise │                            │
│              │  (targeted LLM   │                            │
│              │   re-analysis)   │                            │
│              └──────────────────┘                            │
│                        │                                      │
│  Phase 3: Final Report                                       │
│                        ▼                                      │
│              ┌──────────────────┐                            │
│              │  Accuracy Report │                            │
│              │  - Batch-level   │                            │
│              │  - Revised       │                            │
│              │  - Improvement % │                            │
│              └──────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ Uses tools via
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   MEMORY MCP SERVER                          │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ ChromaDB     │  │ SQLite       │  │ External APIs│      │
│  │ (semantic    │  │ (structured  │  │ - AbuseIPDB  │      │
│  │  search)     │  │  queries)    │  │ - AlienVault │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  Tools Available:                                            │
│  ├─ query_ip_history()          (historical behavior)       │
│  ├─ calculate_baseline()        (statistical anomaly)       │
│  ├─ detect_volume_change()      (trend detection)           │
│  ├─ check_ip_reputation()       (AbuseIPDB)                 │
│  ├─ find_similar_flows()        (pattern matching)          │
│  ├─ detect_attack_chain()       (multi-stage detection)     │
│  ├─ detect_lateral_movement()   (propagation tracking)      │
│  └─ detect_behavioral_phases()  (phase transitions)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚨 Problem Identification & Solutions

### Problem 1: **Inefficient Revision** (Reviewing all 10K flows)
**Impact:** 
- 10,000 LLM calls = $500 + 5 hours
- Most flows are high-confidence, don't need review

**Solution:** ✅ **Smart Targeting (3 strategies)**
1. Low confidence (<85%): ~8% of flows
2. Implicated IPs (attack chains): ~3% of flows  
3. Behavioral anomalies: ~1% of flows
**Result:** Only review ~12% = $60 + 40 minutes

---

### Problem 2: **LLM Tool Selection Quality**
**Impact:**
- Random tool calls waste API calls
- Inconsistent reasoning quality
- May miss important evidence

**Solution:** ✅ **Structured Prompting + Few-Shot Examples**
```python
SYSTEM PROMPT:
"Tool selection strategy:
 1. Start broad (query_ip_history)
 2. Narrow down based on findings
 3. Call multiple tools to corroborate
 4. Stop at 90% confidence"

FEW-SHOT EXAMPLES:
Example 1: SSH from external IP
  → query_ip_history() first
  → If anomalous, calculate_baseline()
  → If very anomalous, check_ip_reputation()
  
Example 2: High port 80 traffic
  → query_ip_history() first
  → If consistent pattern, check_ip_reputation()
  → If clean, likely benign
```

**Monitoring:** Track tool call patterns, identify inefficiencies

---

### Problem 3: **Memory Storage Efficiency**
**Impact:**
- 10K flows × 100 batches = 1M flow records
- ChromaDB embedding generation is slow
- Queries may timeout on large datasets

**Solution:** ✅ **Hybrid Storage Architecture**
```python
ChromaDB (semantic search):
  ├─ Store: Flow summaries (not raw flows)
  ├─ Usage: Rare complex queries only
  └─ Size: ~10MB for 1M flow summaries

SQLite (fast structured queries):
  ├─ Store: IP metadata, aggregated stats
  ├─ Usage: Common queries (IP history, baselines)
  └─ Indexed: ip_address, timestamp, batch_id
  
In-Memory Cache:
  ├─ Store: Recent batch data (last 10 batches)
  ├─ Usage: 90% of queries hit cache
  └─ Eviction: LRU policy
```

**Result:** 
- Average query time: <100ms (vs 2-5 seconds)
- 90% queries served from cache/SQLite
- ChromaDB only for complex semantic searches

---

### Problem 4: **Ground Truth Comparison**
**Impact:**
- Need to compare LLM decisions to CICIDS2018 labels
- Different label formats (e.g., "SSH-Bruteforce" vs "SSH Bruteforce")
- Multi-class vs binary classification

**Solution:** ✅ **Normalized Label Mapping**
```python
LABEL_MAPPING = {
    # LLM outputs → CICIDS2018 labels
    "ssh bruteforce": "SSH-Bruteforce",
    "ssh brute force": "SSH-Bruteforce",
    "brute force ssh": "SSH-Bruteforce",
    "ddos": ["DDOS attack-HOIC", "DDOS attack-LOIC-HTTP", "DDOS attack-LOIC-UDP"],
    "dos": ["DoS attacks-Slowloris", "DoS attacks-Hulk", "DoS attacks-GoldenEye"],
    "botnet": "Bot",
    "bot": "Bot",
    "c2": "Bot",
    "infiltration": "Infilteration",  # Note: typo in dataset
    # ... etc
}

def compare_verdicts(llm_attack_type: str, ground_truth_label: str) -> bool:
    normalized_llm = normalize_label(llm_attack_type)
    if isinstance(normalized_llm, list):
        return ground_truth_label in normalized_llm
    return normalized_llm == ground_truth_label
```

---

### Problem 5: **Cost Control**
**Impact:**
- Full evaluation: 10K flows × 3 tool calls × $0.003/call = $90 per run
- Multiple test runs = expensive iteration

**Solution:** ✅ **Tiered Testing Strategy**
```python
Tier 1: Smoke Test (10 flows)
  ├─ Cost: $0.09
  ├─ Time: 2 minutes
  └─ Purpose: Verify pipeline works

Tier 2: Dev Test (100 flows)
  ├─ Cost: $0.90
  ├─ Time: 20 minutes
  └─ Purpose: Test tool selection, catch bugs

Tier 3: Validation (1000 flows)
  ├─ Cost: $9
  ├─ Time: 3 hours
  └─ Purpose: Measure accuracy, tune prompts

Tier 4: Full Evaluation (10K flows)
  ├─ Cost: $90
  ├─ Time: 18 hours
  └─ Purpose: Final thesis results
```

**Budget Strategy:**
- Dev iterations: Tier 1-2 only ($0.09-$0.90)
- Validation runs: Tier 3 ($9) - 2-3 times
- Final evaluation: Tier 4 ($90) - 1 time only

---

### Problem 6: **Failure Recovery**
**Impact:**
- 18-hour run crashes at batch 87 → lose all progress
- API rate limits → need to pause and resume
- Network errors → need retry logic

**Solution:** ✅ **Checkpoint & Resume**
```python
# Save checkpoint after each batch
checkpoint = {
    "batch_id": current_batch,
    "decisions": self.batch_decisions,
    "timestamp": datetime.now()
}
json.dump(checkpoint, open("checkpoint.json", "w"))

# Resume from checkpoint
if Path("checkpoint.json").exists():
    checkpoint = json.load(open("checkpoint.json"))
    start_batch = checkpoint["batch_id"] + 1
    self.batch_decisions = checkpoint["decisions"]
    print(f"Resuming from batch {start_batch}")
```

**Retry Logic:**
```python
@retry(tries=3, delay=2, backoff=2)
async def _call_mcp_tool(self, ...):
    # Automatic retry with exponential backoff
    ...
```

---

## 📋 Component Dependency Map

```
┌────────────────────────────────────────────────────────────┐
│                   DEPENDENCIES                              │
└────────────────────────────────────────────────────────────┘

Phase 1: Memory MCP Server
├─ Depends on: NOTHING (can build standalone)
├─ Components:
│  ├─ ChromaDB setup
│  ├─ SQLite schema
│  ├─ Tool implementations (query_ip_history, etc.)
│  └─ MCP protocol wrapper
└─ Deliverable: Running MCP server that responds to tool calls

Phase 2: Autonomous Agent
├─ Depends on: Memory MCP Server (Phase 1)
├─ Components:
│  ├─ ReAct loop (LLM decides which tools to call)
│  ├─ MCP client integration
│  ├─ Decision storage
│  └─ Revision targeting logic
└─ Deliverable: Agent that processes batches autonomously

Phase 3: Evaluation Pipeline
├─ Depends on: Agent (Phase 2) + Ground Truth Data
├─ Components:
│  ├─ Ground truth loader
│  ├─ Label normalization
│  ├─ Accuracy calculator
│  └─ Report generator
└─ Deliverable: Automated evaluation script

Phase 4: Testing & Iteration
├─ Depends on: All above phases
├─ Components:
│  ├─ Tier 1-2 tests (smoke tests)
│  ├─ Prompt tuning
│  ├─ Tool call analysis
│  └─ Bug fixes
└─ Deliverable: Validated system ready for full eval
```

---

## 🔄 Execution Phases (Chronological)

### **Phase 1: Foundation - Memory MCP Server** (Week 1)
**Goal:** Build the evidence-providing backend

**Tasks:**
1. **Setup storage backends** (Day 1-2)
   ```bash
   - Install ChromaDB, SQLite
   - Create database schemas
   - Test basic CRUD operations
   ```

2. **Implement core tools** (Day 3-5)
   - `store_flow()` - Save flow to DB
   - `query_ip_history()` - Retrieve IP behavior
   - `calculate_baseline()` - Statistical analysis
   - `check_ip_reputation()` - AbuseIPDB API

3. **Implement advanced tools** (Day 6-7)
   - `detect_attack_chain()` - Multi-stage detection
   - `detect_lateral_movement()` - Propagation tracking
   - `detect_behavioral_phases()` - Phase transitions

4. **MCP protocol wrapper** (Day 7)
   - Wrap tools in MCP server
   - Test with MCP inspector
   - Verify all tools callable

**Validation:**
```bash
# Test MCP server manually
python src/mcp_server/server.py

# In another terminal, test tools
mcp-inspector src/mcp_server/server.py
→ Call query_ip_history({"ip": "1.2.3.4"})
→ Verify returns historical data
```

**Success Criteria:**
- ✅ All 8-10 core tools implemented
- ✅ MCP server responds to tool calls
- ✅ Response time <100ms for common queries
- ✅ No crashes on edge cases

---

### **Phase 2: Autonomous Agent** (Week 2)

**Goal:** Build the LLM reasoning layer

**Tasks:**
1. **ReAct loop implementation** (Day 1-2)
   ```python
   - LLM receives flow
   - LLM decides which tool to call
   - Execute tool, feed result back to LLM
   - Repeat until LLM gives final verdict
   ```

2. **MCP client integration** (Day 3)
   - Connect agent to MCP server
   - Handle tool discovery
   - Parse tool responses

3. **Decision storage & tracking** (Day 4)
   - Store all decisions with metadata
   - Track confidence scores
   - Log tool usage patterns

4. **Revision targeting** (Day 5-6)
   - Implement 3 targeting strategies
   - Build review loop
   - Test revision logic

5. **Checkpoint & recovery** (Day 7)
   - Save progress after each batch
   - Implement resume logic
   - Add retry mechanisms

**Validation:**
```bash
# Tier 1: Smoke test (10 flows)
python autonomous_nids_agent.py \
  --batches data/test/sample_10 \
  --output test_results.json

# Check:
- Does it complete without crashing?
- Are decisions stored correctly?
- Does revision phase run?
```

**Success Criteria:**
- ✅ Agent processes batches autonomously
- ✅ LLM calls appropriate tools (manual review)
- ✅ Revision targets <15% of flows
- ✅ Checkpoints work (can resume from interruption)

---

### **Phase 3: Integration & Testing** (Week 3)

**Goal:** Connect all pieces, validate end-to-end

**Tasks:**
1. **Ground truth integration** (Day 1)
   - Load CICIDS2018 labels
   - Implement label normalization
   - Build comparison logic

2. **Tier 2 testing** (Day 2-3)
   ```bash
   # 100 flows across 10 batches
   python autonomous_nids_agent.py \
     --batches data/batches/large/sample_100_1 \
     --output tier2_results.json
   
   # Analyze results
   python analyze_results.py tier2_results.json
   ```

3. **Debug & fix issues** (Day 4-5)
   - Analyze tool call patterns
   - Fix prompt issues
   - Improve tool selection

4. **Prompt tuning** (Day 6)
   - Add few-shot examples if needed
   - Adjust confidence thresholds
   - Refine system prompts

5. **Performance optimization** (Day 7)
   - Profile slow queries
   - Add caching where needed
   - Parallelize where possible

**Validation:**
- Compare Tier 2 accuracy to baseline (traditional ML)
- Check revision improvement (batch vs final)
- Verify tool selection makes sense

**Success Criteria:**
- ✅ Tier 2 completes successfully
- ✅ Accuracy reasonable (>70%)
- ✅ Revision shows improvement (>5%)
- ✅ Tool selection follows logical patterns

---

### **Phase 4: Full Evaluation** (Week 4)

**Goal:** Run final thesis evaluation

**Tasks:**
1. **Tier 3 validation** (Day 1-2)
   ```bash
   # 1000 flows - last validation before full run
   python autonomous_nids_agent.py \
     --batches data/batches/large/sample_100_[1-10] \
     --output tier3_results.json
   ```

2. **Final prompt refinement** (Day 3)
   - Based on Tier 3 results
   - Last chance for improvements

3. **Full evaluation run** (Day 4-5)
   ```bash
   # THE BIG ONE: 10K flows
   nohup python autonomous_nids_agent.py \
     --batches data/batches/large/* \
     --output final_results.json \
     > full_eval.log 2>&1 &
   
   # Monitor progress
   tail -f full_eval.log
   ```

4. **Results analysis** (Day 6-7)
   - Calculate all metrics
   - Compare to baselines
   - Generate thesis tables/figures
   - Analyze failure cases

**Deliverables:**
- Final accuracy numbers (batch vs revised)
- Tool usage statistics
- Example explanations for thesis
- Error analysis

**Success Criteria:**
- ✅ Full evaluation completes
- ✅ Revision improves accuracy measurably
- ✅ Results validate MCP+LLM approach
- ✅ Sufficient data for thesis

---

## 📊 Metrics to Track

### **During Development:**
1. **Tool Call Patterns**
   - Which tools get called most?
   - Are tool calls logical for each flow type?
   - Average tools per flow?

2. **Confidence Distribution**
   - % of high confidence (>0.85) decisions?
   - Correlation between confidence and correctness?

3. **Performance**
   - Average time per flow?
   - Average time per batch?
   - Memory usage over time?

### **Final Evaluation:**
1. **Accuracy Metrics**
   - Batch-level accuracy (before revision)
   - Revised accuracy (after revision)
   - Improvement = (Revised - Batch) / Batch
   - Per-attack-type accuracy

2. **Efficiency Metrics**
   - % of flows flagged for revision
   - % of revisions that changed verdict
   - API cost per flow

3. **Explainability Metrics**
   - Average explanation length
   - % of explanations citing tool evidence
   - Analyst survey scores (if time permits)

---

## 🎛️ Configuration & Tuning Knobs

### **Agent Configuration:**
```python
CONFIDENCE_THRESHOLD = 0.85        # For revision targeting
MAX_TOOL_CALLS_PER_FLOW = 10      # Prevent infinite loops
BATCH_SIZE = 100                   # Flows per batch
CACHE_SIZE = 10                    # Batches to keep in memory
```

### **Revision Configuration:**
```python
REVISION_STRATEGIES = {
    "low_confidence": True,         # Enable/disable each strategy
    "implicated_ips": True,
    "behavioral_anomalies": False   # Disable if too slow
}

LOW_CONFIDENCE_THRESHOLD = 0.85
SAMPLE_IPS_FOR_CHAINS = 100        # Max IPs to check for attack chains
```

### **Cost Control:**
```python
USE_CACHING = True                 # Cache tool results
MAX_BUDGET_PER_RUN = 100           # Stop if cost exceeds $100
ENABLE_CHECKPOINTS = True          # Save progress
CHECKPOINT_INTERVAL = 5            # Every N batches
```

---

## 🚀 Quick Start Commands

```bash
# Phase 1: Test MCP server
python src/mcp_server/server.py
mcp-inspector src/mcp_server/server.py

# Phase 2: Tier 1 smoke test
python src/agent/autonomous_nids_agent.py \
  --batches data/test/sample_10 \
  --output smoke_test.json \
  --api-key $ANTHROPIC_API_KEY

# Phase 3: Tier 2 dev test
python src/agent/autonomous_nids_agent.py \
  --batches data/batches/large/sample_100_1 \
  --output tier2_test.json \
  --api-key $ANTHROPIC_API_KEY

# Phase 4: Full evaluation
nohup python src/agent/autonomous_nids_agent.py \
  --batches data/batches/large/* \
  --output final_results.json \
  --api-key $ANTHROPIC_API_KEY \
  > full_eval.log 2>&1 &
```

---

## ✅ Final Checklist

**Before Full Evaluation:**
- [ ] All MCP tools implemented and tested
- [ ] Agent completes Tier 2 test successfully
- [ ] Revision targeting reduces review to <15%
- [ ] Checkpoint/resume works
- [ ] Ground truth comparison validates
- [ ] Cost estimate confirms within budget
- [ ] All dependencies installed
- [ ] API keys configured

**After Full Evaluation:**
- [ ] Results saved and backed up
- [ ] Accuracy improvement documented
- [ ] Tool usage analyzed
- [ ] Example explanations extracted
- [ ] Thesis tables/figures generated
- [ ] Code cleaned and commented
- [ ] Repository ready for submission

---

## 🎓 Thesis Narrative

**Chapter Structure:**
1. **Introduction** - Problem: Stateless NIDS can't detect multi-stage attacks
2. **Background** - LLMs for security, MCP protocol, CICIDS2018 dataset
3. **Methodology** - Architecture (agent + MCP tools + revision)
4. **Implementation** - Tool design, smart revision targeting
5. **Evaluation** - Tier testing results, final accuracy, comparison
6. **Results** - Revision improves accuracy X%, tool usage patterns
7. **Discussion** - LLM reasoning quality, generalization ability
8. **Conclusion** - MCP enables composable security tools

**Key Contributions:**
1. Novel application of MCP to NIDS domain
2. Generalized evidence-providing tools (not attack signatures)
3. Smart revision targeting algorithm
4. Demonstration of LLM reasoning + tool synthesis

---

This plan is now your **execution roadmap**. Start with Phase 1 (Memory MCP Server), validate each phase before moving to the next, and track metrics throughout.

Ready to begin Phase 1?
