# LLM-based NIDS Architecture with Persistent Memory

## Executive Summary

This document outlines a cognitive Network Intrusion Detection System (NIDS) architecture that uses Large Language Models (LLMs) with **persistent memory** and **multi-agent orchestration** to detect both immediate threats and slow-burn attacks that unfold over days or weeks.

### Core Problem Identified
Current stateless batch processing (100-1000 flows per prompt) has critical limitations:
- ❌ **Memory Loss**: Each batch requires new prompt → new API call → stateless analysis
- ❌ **No Temporal Correlation**: Cannot track IP behavior over hours/days/weeks
- ❌ **Slow-Burn Blindness**: Misses APTs, data exfiltration ramp-ups, reconnaissance patterns
- ❌ **Analyst Inefficiency**: Can't backtrack through logs when suspicious patterns emerge later

### Solution Architecture
**Stateful Multi-Agent LLM NIDS with RAG-based Memory Layer**

---

## 1. Research Foundation

### 1.1 Key Papers & Frameworks
- **arXiv 2507.04752**: Multi-agent LLM NIDS with nDPI-XGBoost-LLM pipeline
- **Giorgio Zoppi's Cognitive NIDS**: Intelligent querying + multi-level explanations
- **Tool-Augmented LLMs**: ReAct, Toolformer, HuggingGPT paradigms
- **Model Context Protocol (MCP)**: Standardized LLM-to-data/tools interface

### 1.2 Success Factors from Literature
1. **Multi-Agent Architectures**: Specialized agents for parsing, filtering, analysis, memory
2. **Hybrid ML+LLM**: Traditional ML (XGBoost/LSTM) pre-filters before LLM analysis
3. **Chain-of-Thought (CoT) Prompting**: Structured reasoning steps improve detection
4. **RAG for Long-Term Context**: Vector DBs retrieve relevant historical flows
5. **LoRA Fine-Tuning**: Domain adaptation on attack datasets improves reliability

---

## 2. Proposed Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LLM NIDS COGNITIVE LAYER                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐     │
│  │  Packet      │──────▶│  ML Filter   │──────▶│   Memory     │     │
│  │  Agent       │      │  Agent       │      │   Agent      │     │
│  │  (nDPI/MCP)  │      │ (XGBoost)    │      │ (Vector DB)  │     │
│  └──────────────┘      └──────────────┘      └──────┬───────┘     │
│         │                                             │             │
│         │                                             ▼             │
│         │                                    ┌──────────────┐      │
│         └────────────────────────────────────▶│  Analyst LLM │      │
│                                               │  (Controller)│      │
│                                               └──────┬───────┘      │
│                                                      │              │
│                                                      ▼              │
│                                             ┌──────────────┐       │
│                                             │   Actions    │       │
│                                             │ (Alert/Log)  │       │
│                                             └──────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Details

#### **A. Packet Agent (Data Ingestion)**
- **Purpose**: Parse NetFlow data via MCP tools
- **Technology**: 
  - MCP Server with netflow_analyzer tool
  - nDPI for protocol detection
  - Real-time stream processing
- **Output**: Structured flow records with metadata

#### **B. ML Filter Agent (Pre-Screening)**
- **Purpose**: Reduce cognitive load on LLM by filtering obvious normals
- **Technology**: 
  - XGBoost/Random Forest trained on CICIDS2018
  - Anomaly score threshold (e.g., >0.7 → pass to LLM)
- **Benefits**: 
  - 80-90% traffic filtered as benign
  - Cost savings (fewer LLM API calls)
  - Faster processing

#### **C. Memory Agent (Persistent State)**
**THIS IS THE KEY INNOVATION**

##### **Technology Stack**:
```python
# Vector Database: ChromaDB or Pinecone
# Embeddings: sentence-transformers/all-MiniLM-L6-v2
# Storage: Time-series flow summaries + entity graphs

{
  "ip_address": "192.168.1.50",
  "time_window": "2025-01-20 00:00 - 23:59",
  "summary": {
    "total_flows": 1523,
    "unique_destinations": 42,
    "port_scan_score": 0.3,
    "data_volume_trend": [+2%, +3%, +5%, +8%],  # 4-day trend
    "anomalies": ["new_C2_domain", "unusual_upload_time"]
  },
  "embedding": [0.23, -0.45, ...]  # 384-dim vector
}
```

##### **Memory Operations**:
1. **Write**: Store daily/hourly summaries per IP
2. **Read (RAG)**: 
   ```python
   query = "Retrieve flows from 10.0.0.5 over last 7 days showing upload patterns"
   relevant_docs = vector_db.similarity_search(query, k=5)
   ```
3. **Update**: Append new events to entity timelines
4. **Search**: Semantic search for related indicators

##### **Data Structures**:
```python
# Sliding Window Memory (per IP)
class EntityMemory:
    ip: str
    flows_queue: deque[Flow]  # Last 50-100 flows
    daily_summaries: List[DailySummary]  # Last 30 days
    baselines: Dict[str, float]  # Normal behavior metrics
    alerts: List[Alert]  # Historical alerts
    
# Event Chain (for APT tracking)
class AttackChain:
    chain_id: uuid
    stages: List[Stage]  # [Recon, Exploitation, C2, Exfil]
    confidence: float
    last_updated: datetime
```

#### **D. Analyst LLM (Controller)**
- **Purpose**: Final decision-making with full context
- **Model Options**: 
  - GPT-4 Turbo (general intelligence)
  - Fine-tuned Llama-3-8B (cost-effective)
  - Sec-Llama (domain-specific)
  
##### **Prompt Template with Memory**:
```python
ANALYST_PROMPT = """
You are a cybersecurity analyst examining network traffic.

CURRENT FLOW:
{current_flow}

HISTORICAL CONTEXT (Retrieved from Memory):
{retrieved_history}

BASELINE BEHAVIOR for {ip_address}:
- Avg Daily Uploads: {baseline_upload} MB
- Typical Destinations: {baseline_dests}
- Normal Port Usage: {baseline_ports}

TASK:
Step 1: Compare current flow to baseline
Step 2: Review historical context for escalation patterns
Step 3: Assess if this is part of multi-stage attack
Step 4: Provide risk score (0-100) and explanation

REASONING (Chain-of-Thought):
"""
```

---

## 3. Memory Layer Architecture (Detailed)

### 3.1 Why Existing Approaches Fail
| Approach | Problem |
|----------|---------|
| **Stateless Batching** | No memory between batches |
| **In-Memory Queues** | Lost on restart, no persistence |
| **Full Dataset in Context** | Token limits (32k-128k) → can't fit days of logs |
| **SQL Queries Only** | LLM can't semantically search logs |

### 3.2 RAG-Based Solution

#### **Architecture**:
```
┌─────────────────────────────────────────────────────────────┐
│                    Memory MCP Server                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐                    │
│  │  Vector DB   │      │  Time-Series │                    │
│  │  (ChromaDB)  │      │  Store       │                    │
│  │  - Embeddings│      │  (SQLite)    │                    │
│  │  - Semantic  │      │  - Raw flows │                    │
│  │    Search    │      │  - Metadata  │                    │
│  └──────┬───────┘      └──────┬───────┘                    │
│         │                      │                            │
│         └──────────┬───────────┘                            │
│                    ▼                                        │
│         ┌──────────────────┐                                │
│         │  MCP Resources:  │                                │
│         │  - flow_history  │                                │
│         │  - ip_timeline   │                                │
│         │  - attack_chains │                                │
│         └──────────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

#### **MCP Resources Exposed**:
```python
# Resource 1: Historical Flow Retrieval
mcp_resource "memory://ip_history/{ip}/7days"
# Returns: Last 7 days of flow summaries for IP

# Resource 2: Semantic Search
mcp_tool "search_memory"
# Input: Natural language query
# Output: Relevant historical flows/alerts

# Resource 3: Entity Timeline
mcp_resource "memory://timeline/{ip}"
# Returns: Chronological event chain for IP
```

### 3.3 Temporal Memory Mechanisms

#### **Sliding Window Summaries**:
```python
# Hourly aggregation (real-time)
hourly_summary = {
    "bytes_sent": sum(flows.bytes_out),
    "unique_ports": len(set(flows.dst_port)),
    "protocol_dist": Counter(flows.protocol)
}

# Daily baselines (background process)
daily_baseline = {
    "mean_bytes": statistics.mean(daily_bytes),
    "std_dev": statistics.stdev(daily_bytes),
    "anomaly_threshold": mean + 3*std_dev
}

# Weekly trends (for slow-burn detection)
weekly_trend = [day1_metric, day2_metric, ..., day7_metric]
trend_analysis = analyze_gradual_increase(weekly_trend)
```

#### **Event Chaining for APT Detection**:
```python
# Detect multi-stage attacks
class APTDetector:
    def correlate_events(self, ip: str):
        events = memory.get_timeline(ip, days=14)
        
        # Pattern: Recon → Exploit → C2 → Exfil
        stages = {
            "recon": detect_port_scans(events),
            "exploit": detect_vulnerability_attempts(events),
            "c2": detect_beaconing(events),
            "exfil": detect_data_transfer_spike(events)
        }
        
        # If all stages present → HIGH confidence APT
        if all(stages.values()):
            return Alert(
                severity="CRITICAL",
                attack_type="APT",
                evidence=stages
            )
```

---

## 4. Detecting Slow-Burn Attacks

### 4.1 Example: Data Exfiltration Over 2 Weeks

**Traditional ML Fails**:
- Day 1: 50MB upload → normal
- Day 2: 52MB upload → normal
- ...
- Day 14: 120MB upload → individually normal, cumulatively suspicious

**LLM with Memory Succeeds**:
```python
# LLM receives context:
current_flow = {"ip": "10.0.0.5", "bytes_out": 120MB, "date": "2025-01-21"}

retrieved_memory = """
Historical data for 10.0.0.5:
- Jan 7: 50MB upload (baseline: 48MB ±5MB)
- Jan 8: 52MB upload (+4% from previous day)
- Jan 9: 55MB upload (+5.7%)
- ...
- Jan 20: 118MB upload (+3.5%)
- Jan 21: 120MB upload (CURRENT)

Trend Analysis: 140% increase over 14 days
Baseline Deviation: +150% (5 std devs above mean)
"""

# LLM reasoning:
"""
Step 1: Current flow (120MB) individually looks normal for a workstation
Step 2: Historical trend shows consistent 2-4% daily increase
Step 3: This matches "low-and-slow" exfiltration pattern
Step 4: ALERT - Likely data exfiltration via gradual ramp-up
Risk Score: 85/100
"""
```

### 4.2 Other Slow-Burn Patterns Detected

| Attack Type | Timeline | Detection via Memory |
|-------------|----------|---------------------|
| **APT Reconnaissance** | 1-4 weeks | Track port scans across weeks, detect systematic probing |
| **Credential Stuffing** | Days | Failed logins from same IP, different accounts |
| **DNS Tunneling (C2)** | Weeks | Regular DNS queries to unusual domains at fixed intervals |
| **Insider Threat** | Months | Gradual privilege escalation + data access pattern changes |

---

## 5. Implementation Roadmap

### Phase 1: Memory Layer (Weeks 1-2)
```python
# src/memory_server/
├── server.py              # MCP Memory Server
├── vector_db.py          # ChromaDB integration
├── entity_store.py       # IP/entity tracking
└── temporal_analysis.py  # Trend detection
```

**Key Code**:
```python
import chromadb
from sentence_transformers import SentenceTransformer

class MemoryAgent:
    def __init__(self):
        self.client = chromadb.PersistentClient(path="./memory_db")
        self.collection = self.client.get_or_create_collection("flow_history")
        self.encoder = SentenceTransformer('all-MiniLM-L6-v2')
    
    def store_flow(self, flow: dict):
        # Create semantic summary
        summary = f"IP {flow['src_ip']} sent {flow['bytes']}B to {flow['dst_ip']}:{flow['dst_port']} via {flow['protocol']}"
        embedding = self.encoder.encode(summary)
        
        # Store in vector DB
        self.collection.add(
            documents=[summary],
            embeddings=[embedding.tolist()],
            metadatas=[flow],
            ids=[f"flow_{flow['timestamp']}_{flow['src_ip']}"]
        )
    
    def retrieve_context(self, query: str, k: int = 5):
        query_embedding = self.encoder.encode(query)
        results = self.collection.query(
            query_embeddings=[query_embedding.tolist()],
            n_results=k
        )
        return results['metadatas'][0]
```

### Phase 2: Multi-Agent Pipeline (Weeks 3-4)
```python
# src/agents/
├── packet_agent.py       # NetFlow parser
├── ml_filter_agent.py    # XGBoost pre-filter
├── memory_agent.py       # RAG queries
└── analyst_llm.py        # Final analysis
```

**Orchestration**:
```python
class NIDSController:
    def analyze_flow(self, flow: dict):
        # Step 1: Parse
        parsed = self.packet_agent.parse(flow)
        
        # Step 2: ML Filter (fast reject obvious normals)
        anomaly_score = self.ml_filter.score(parsed)
        if anomaly_score < 0.7:
            return {"threat": "benign", "score": anomaly_score}
        
        # Step 3: Retrieve Memory
        context = self.memory_agent.retrieve_context(
            f"Historical behavior for {parsed['src_ip']}"
        )
        
        # Step 4: LLM Analysis
        prompt = self.build_prompt(parsed, context)
        analysis = self.analyst_llm.analyze(prompt)
        
        return analysis
```

### Phase 3: Temporal Analysis (Week 5)
```python
# src/detectors/
├── slow_burn_detector.py
├── apt_chain_builder.py
└── baseline_calculator.py
```

**Slow-Burn Detector**:
```python
class SlowBurnDetector:
    def detect_gradual_escalation(self, ip: str, metric: str, days: int = 14):
        # Get daily values
        history = memory_agent.get_daily_summaries(ip, days=days)
        values = [h[metric] for h in history]
        
        # Check for gradual increase
        trend_line = np.polyfit(range(len(values)), values, 1)
        slope = trend_line[0]
        
        # Alert if consistent upward trend
        if slope > 0 and self._is_significant(values):
            return Alert(
                type="slow_burn_escalation",
                ip=ip,
                metric=metric,
                evidence=f"{slope*100:.1f}% daily increase over {days} days"
            )
```

### Phase 4: Evaluation (Week 6)
- **Datasets**: CICIDS2018, UNSW-NB15, custom slow-burn APT scenarios
- **Metrics**: 
  - Detection rate for multi-day attacks
  - False positive rate
  - Time to detect (TTD) for slow-burn vs instant threats
- **Baseline Comparison**: Traditional ML (no memory) vs LLM+Memory

---

## 6. Technical Specifications

### 6.1 System Requirements
- **Vector DB**: ChromaDB (local) or Pinecone (cloud)
- **Python**: 3.10+
- **Dependencies**: 
  - `sentence-transformers` (embeddings)
  - `chromadb` (vector storage)
  - `xgboost` (ML filter)
  - `mcp` (Model Context Protocol SDK)

### 6.2 MCP Server Configuration
```json
{
  "mcpServers": {
    "nids-tools": {
      "command": "python",
      "args": ["src/mcp_server/server.py"]
    },
    "nids-memory": {
      "command": "python",
      "args": ["src/memory_server/server.py"]
    }
  }
}
```

### 6.3 Prompt Engineering
**Key Techniques**:
1. **Chain-of-Thought**: Force step-by-step reasoning
2. **Few-Shot Examples**: Include 2-3 attack examples in prompt
3. **Structured Output**: Use JSON schema for reliable parsing
4. **Memory Integration**: Always include retrieved context in prompt

---

## 7. Expected Outcomes

### 7.1 Quantitative Goals
- **20-30% improvement** in detecting slow-burn attacks (vs traditional ML)
- **50% reduction** in false positives (via contextual reasoning)
- **<5 second latency** for real-time analysis (with ML pre-filter)
- **90%+ accuracy** on known attack patterns

### 7.2 Qualitative Benefits
- **Explainability**: Natural language explanations for SOC analysts
- **Adaptability**: Handles novel attacks via reasoning (not just signatures)
- **Analyst Augmentation**: Acts as "junior analyst" with memory

---

## 8. Research Contributions

### 8.1 Novel Aspects
1. **MCP-based Memory Server**: First implementation of persistent RAG memory for NIDS
2. **Temporal Correlation Engine**: Detect attacks across days/weeks
3. **Hybrid ML-LLM Pipeline**: Cost-effective real-time processing

### 8.2 Thesis Deliverables
1. **Architecture Design** (this document)
2. **Implementation** (functional prototype)
3. **Evaluation** (comparison with baselines on CICIDS2018)
4. **Publication**: Target IEEE S&P or ACM CCS workshops

---

## 9. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **LLM Hallucinations** | ML pre-filter + confidence thresholds |
| **Latency** | Background memory updates, cached embeddings |
| **Cost (API calls)** | Fine-tuned local model (Llama-3-8B) |
| **Memory Size** | Automatic summarization, 30-day retention |

---

## 10. Next Steps

1. ✅ **Review this architecture** with advisors
2. ⏳ **Implement Memory MCP Server** (ChromaDB + vector store)
3. ⏳ **Integrate with existing MCP tools** (netflow_analyzer)
4. ⏳ **Build multi-agent orchestrator**
5. ⏳ **Evaluate on CICIDS2018 + synthetic slow-burn attacks**

---

## References

1. arXiv 2507.04752: "Large Language Models for Network Intrusion Detection Systems"
2. Giorgio Zoppi: "Cognitive NIDS with LLMs" (Medium article)
3. ReAct Paper: "Synergizing Reasoning and Acting in Language Models"
4. Model Context Protocol: https://modelcontextprotocol.io
5. ChromaDB Documentation: https://docs.trychroma.com
6. CICIDS2018 Dataset: https://www.unb.ca/cic/datasets/ids-2018.html

---

**Last Updated**: January 21, 2025  
**Author**: Thesis Research - LLM NIDS Project
