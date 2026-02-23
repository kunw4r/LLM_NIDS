# Generalized MCP Tools for LLM-Based NIDS

## Design Philosophy: Tools Provide Evidence, LLM Does Reasoning

### The Critical Distinction

**❌ WRONG: Tools Make Decisions**
```python
# Tool returns: "SSH Bruteforce detected"
detect_ssh_bruteforce() → {"attack": "SSH Bruteforce", "confidence": 0.95}
```
→ This is just a traditional ML classifier. No LLM reasoning needed.

**✅ CORRECT: Tools Provide Evidence, LLM Reasons**
```python
# Tools return RAW EVIDENCE:
query_ip_history() → "150 SSH connection attempts across 50 hosts in 10 batches"
calculate_baseline() → "Current rate is 45 standard deviations above normal"
check_ip_reputation() → "95% abuse confidence, reported for attacks"
aggregate_by_pattern() → "All attempts failed, 0% success rate"

# LLM SYNTHESIZES and REASONS:
"Based on evidence from 4 tools, I conclude this is SSH bruteforce:
 - Volume anomaly (45σ above baseline) suggests automated attack
 - Distribution (50 targets) indicates credential stuffing, not targeted attack
 - Low success rate (0%) means defense is working
 - External reputation validates this IP is known attacker
 
 Confidence: HIGH (95%)
 Recommendation: Block IP, verify no successful logins occurred"
```

### What Makes This an LLM Contribution?

**1. Tool Selection & Orchestration (LLM Decision)**
- LLM decides WHICH tools to call based on flow characteristics
- LLM determines ORDER of tool calls (start broad → narrow down)
- LLM knows WHEN to stop gathering evidence

Example:
```
Flow shows SSH connection → LLM decides to call:
  1. query_ip_history() first (has this IP done this before?)
  2. If anomalous → calculate_baseline() (how anomalous?)
  3. If very anomalous → check_ip_reputation() (is IP known bad?)
  4. If still uncertain → aggregate_by_pattern() (what's the larger pattern?)
```

**2. Evidence Synthesis (LLM Reasoning)**
- LLM combines results from multiple tools
- LLM weighs conflicting evidence
- LLM applies domain knowledge to interpret raw statistics

Example:
```
Tool 1: "45 std devs above baseline" ← Statistical evidence
Tool 2: "95% abuse confidence" ← External validation
Tool 3: "0% success rate" ← Behavioral evidence

LLM: "All three lines of evidence converge → HIGH confidence detection"
```

**3. Contextual Reasoning (LLM Intelligence)**
- LLM understands WHAT the numbers mean in security context
- LLM can reason about edge cases ("high volume BUT it's a legitimate scanner")
- LLM adapts reasoning to different attack types

Example:
```
Tool: "1000 connections per batch to port 80"

LLM Context:
- If from single IP → DDoS
- If from 500 different IPs → Distributed DDoS
- If during business hours from employee workstation → Legitimate web scraper
- If at 3am from IoT device → Compromised device
```

**4. Explainability (LLM Output)**
- LLM generates natural language explanations
- LLM cites specific tool results as evidence
- LLM explains WHY it reached conclusion

Traditional ML: "Anomaly score: 0.95" ← Unexplained
LLM-based: "This is SSH bruteforce because [cites 4 tool results and explains reasoning]"

**5. Revision Capability (LLM Unique)**
- LLM can retrospectively reinterpret earlier evidence
- LLM connects dots across time: "Those batch 1 port scans were recon for batch 3 exploit"
- LLM updates conclusions as new context arrives

Example:
```
Batch 3: "Low-severity port scan detected"
Batch 8: LLM sees successful exploit
         Uses detect_attack_chain() 
         → Revises Batch 3: "Port scan was RECONNAISSANCE for this attack"
```

### What MCP Enables (Not Just Tool Library)

**Without MCP:**
- Custom integration code for each data source
- LLM needs to know exact API formats
- Hard to add new tools (breaks existing code)
- No standardization across different systems

**With MCP:**
- ✅ **Standardized Interface**: All tools use same JSON schema
- ✅ **Tool Discovery**: LLM sees available tools + descriptions automatically
- ✅ **Composability**: Add new tools without rewriting LLM code
- ✅ **Multi-Agent**: Different agents (Memory, Analysis, Revision) share tools
- ✅ **Vendor Agnostic**: Works with any LLM (Claude, GPT-4, Llama)

**MCP Value Proposition:**
```python
# Traditional approach: Custom code for each integration
llm_query("Check IP reputation") → Need custom AbuseIPDB code
llm_query("Check threat feeds") → Need custom OTX code
llm_query("Query memory") → Need custom ChromaDB code

# MCP approach: Standardized tool calls
llm.call_tool("check_ip_reputation", {"ip": "1.2.3.4"})
llm.call_tool("check_threat_feeds", {"ip": "1.2.3.4"})
llm.call_tool("query_ip_history", {"ip": "1.2.3.4"})
→ All use same interface, LLM doesn't need to know underlying APIs
```

### Why This Matters for Your Thesis

**Research Question:**
*"Can NetFlow augmentation via MCP improve LLM-based NIDS detection and explainability?"*

**Your Contribution:**
1. **MCP Architecture**: Standardized tool interface for NIDS (novel application)
2. **Generalized Tools**: Evidence primitives (not attack signatures) enable generalization
3. **LLM Reasoning**: Demonstrates LLM can synthesize evidence and reason about security
4. **Revision Capability**: Shows LLM can improve decisions with retrospective analysis
5. **Explainability**: Natural language explanations with cited evidence

**What You're Testing:**
- ✅ Can LLM select appropriate tools for different attack types?
- ✅ Can LLM synthesize evidence from multiple tools effectively?
- ✅ Can LLM generalize to unseen attack types (not in training data)?
- ✅ Does revision improve accuracy (batch-level vs final-revised)?
- ✅ Are LLM explanations useful to security analysts?

**Baseline Comparison:**
| Approach | Tool Selection | Evidence Synthesis | Explainability | Generalization | Revision |
|----------|---------------|-------------------|----------------|----------------|----------|
| Traditional ML | N/A (fixed features) | N/A (black box) | ❌ None | ❌ Retraining needed | ❌ No |
| LLM (no tools) | N/A | ❌ Hallucinates | ✅ Yes | ⚠️ Limited by training | ⚠️ Can forget |
| **LLM + MCP Tools** | ✅ Dynamic | ✅ Multi-source | ✅ Cited evidence | ✅ Zero-shot | ✅ Memory-backed |

---

## Core Tool Categories

### 1. **Historical Context Tools**
*"What has this IP/port/protocol done before?"*

```python
# Tool: query_ip_history
{
  "ip_address": "192.168.1.50",
  "lookback_batches": 10  # Check last 10 batches
}
→ Returns: [
  {
    "batch_id": 5,
    "flows_count": 3,
    "protocols": ["TCP", "TCP", "TCP"],
    "dst_ports": [22, 22, 22],
    "bytes_avg": 1200,
    "packets_avg": 15,
    "flags_seen": ["SYN", "ACK", "FIN"]
  },
  ...
]

# Tool: query_port_history
{
  "dst_port": 22,
  "dst_ip": "10.0.0.5",
  "lookback_batches": 10
}
→ Returns: Number of connections, unique sources, byte volumes, etc.

# Tool: query_protocol_behavior
{
  "src_ip": "192.168.1.50",
  "protocol": "TCP",
  "lookback_batches": 10
}
→ Returns: Volume trends, port diversity, connection patterns
```

**Use Cases (LLM reasoning):**
- SSH Bruteforce: "This IP has tried port 22 on 50 different hosts in last 5 batches"
- Botnet C2: "This IP contacts the same external IP every batch, tiny payloads"
- Infiltration: "This IP was benign in batch 1-3, now scanning internal network"

---

### 2. **Baseline & Anomaly Detection Tools**
*"Is this normal for this network/IP/service?"*

```python
# Tool: calculate_baseline
{
  "entity_type": "ip",  # or "port", "protocol", "network"
  "entity_value": "192.168.1.50",
  "metric": "bytes_per_flow",  # or "flows_per_batch", "port_diversity"
  "baseline_batches": 10  # Use first 10 batches as baseline
}
→ Returns: {
  "mean": 5000,
  "std_dev": 500,
  "percentile_95": 6000,
  "current_value": 50000,  # Current flow value
  "z_score": 90.0,  # 90 standard deviations!
  "is_anomalous": true
}

# Tool: detect_volume_change
{
  "ip_address": "192.168.1.50",
  "metric": "total_bytes",
  "window_size": 5  # Compare last 5 batches to previous 5
}
→ Returns: {
  "previous_avg": 10000,
  "current_avg": 100000,
  "percent_increase": 900,
  "is_significant": true,
  "trend": "exponential"  # linear, exponential, step_change
}
```

**Use Cases (LLM reasoning):**
- DDoS: "Traffic to port 80 is 1000x baseline in this batch"
- Data Exfiltration: "This internal IP is sending 90 std devs above normal to external IP"
- Port Scan: "This IP contacted 50 unique ports (baseline = 2-3 ports)"

---

### 3. **Cross-Flow Correlation Tools**
*"Are there patterns across multiple flows?"*

```python
# Tool: find_similar_flows
{
  "reference_flow_id": "flow_123",
  "similarity_criteria": ["src_ip", "dst_port", "protocol"],
  "search_scope": "current_batch"  # or "all_batches", "last_N_batches"
}
→ Returns: [
  {"flow_id": "flow_456", "similarity_score": 0.95, "batch_id": 5},
  {"flow_id": "flow_789", "similarity_score": 0.92, "batch_id": 5},
  ...
]

# Tool: aggregate_by_pattern
{
  "group_by": ["src_ip", "dst_port"],
  "filters": {"dst_port": 22},
  "batches": [1, 2, 3, 4, 5]
}
→ Returns: {
  "192.168.1.50": {"count": 100, "success_rate": 0.01, "target_ips": 50},
  "192.168.1.51": {"count": 5, "success_rate": 1.0, "target_ips": 2},
  ...
}

# Tool: detect_distributed_pattern
{
  "target_ip": "10.0.0.5",
  "target_port": 80,
  "time_window": "current_batch"
}
→ Returns: {
  "unique_sources": 500,
  "total_flows": 10000,
  "sources_per_flow_avg": 0.05,  # Each source sends few flows
  "is_distributed": true,
  "geographic_diversity": 50  # From 50 different /24 subnets
}
```

**Use Cases (LLM reasoning):**
- Distributed DDoS: "Port 80 hit by 500 unique IPs, each sending 20 packets"
- Coordinated Scan: "50 IPs scanning same port range on different targets"
- Botnet: "10 internal IPs all contacting same external C2 server"

---

### 4. **External Threat Intelligence Tools**
*"Is this IP/domain known malicious?"*

```python
# Tool: check_ip_reputation (AbuseIPDB)
{
  "ip_address": "203.0.113.50"
}
→ Returns: {
  "abuse_confidence_score": 95,
  "total_reports": 150,
  "last_reported": "2026-01-20",
  "categories": ["SSH Bruteforce", "Port Scan"],
  "is_tor_exit": false
}

# Tool: check_threat_feeds (AlienVault OTX)
{
  "ip_address": "203.0.113.50"
}
→ Returns: {
  "pulses_count": 5,
  "reputation": "malicious",
  "tags": ["botnet", "mirai", "iot"],
  "first_seen": "2025-12-01",
  "associated_malware": ["Mirai"]
}

# Tool: geolocate_ip
{
  "ip_address": "203.0.113.50"
}
→ Returns: {
  "country": "CN",
  "asn": "AS4134",
  "org": "Chinanet",
  "is_cloud_provider": false,
  "is_vpn": true
}
```

**Use Cases (LLM reasoning):**
- Validation: "This IP has 95% abuse confidence, reinforces my SSH bruteforce hypothesis"
- Context: "This is a known Mirai botnet IP trying to contact IoT device on port 23"
- Prioritization: "Unknown IP but from known malicious ASN, higher suspicion"

---

### 5. **Temporal Analysis Tools**
*"How has behavior changed over time?"*

```python
# Tool: detect_behavioral_shift
{
  "ip_address": "192.168.1.50",
  "shift_detection_method": "changepoint",  # or "trend", "cycle"
  "metric": "port_diversity"
}
→ Returns: {
  "shift_detected": true,
  "shift_batch": 8,  # Behavior changed at batch 8
  "before_pattern": "2-3 ports per batch",
  "after_pattern": "50-100 ports per batch",
  "statistical_significance": 0.001
}

# Tool: calculate_entropy
{
  "ip_address": "192.168.1.50",
  "metric": "dst_ports",  # Measure port diversity entropy
  "window": "last_5_batches"
}
→ Returns: {
  "entropy": 4.5,  # High entropy = many different ports
  "interpretation": "high_diversity",
  "baseline_entropy": 1.2,  # Normal = low entropy
  "is_anomalous": true
}

# Tool: get_flow_timeline
{
  "ip_address": "192.168.1.50",
  "start_batch": 1,
  "end_batch": 10
}
→ Returns: [
  {"batch": 1, "flow_count": 5, "bytes": 5000, "ports": [80, 443]},
  {"batch": 2, "flow_count": 5, "bytes": 5100, "ports": [80, 443]},
  {"batch": 8, "flow_count": 50, "bytes": 50000, "ports": [21, 22, 23, 25, ...]},
  ...
]
```

**Use Cases (LLM reasoning):**
- Infiltration: "IP was benign batch 1-7, then started scanning at batch 8 → revision needed"
- Slow Escalation: "Connection attempts increasing linearly → brute force"
- Periodic Beaconing: "Connects every 3 batches, tiny payload → C2 beacon"

---

### 6. **Deep Inspection Tools**
*"What's in the payload/flags/timing?"*

```python
# Tool: analyze_tcp_flags
{
  "flow_id": "flow_123"
}
→ Returns: {
  "flags": "SYN",
  "has_data": false,
  "interpretation": "connection_attempt",
  "is_suspicious": false  # SYN with no follow-up = scan
}

# Tool: analyze_packet_timing
{
  "flow_id": "flow_123"
}
→ Returns: {
  "inter_packet_delay_ms": 0.5,
  "is_automated": true,  # Too fast for human
  "timing_pattern": "uniform",  # Scripted vs organic
  "jitter": 0.001
}

# Tool: analyze_payload_size_distribution
{
  "ip_address": "192.168.1.50",
  "protocol": "TCP",
  "batches": [1, 2, 3, 4, 5]
}
→ Returns: {
  "size_distribution": [64, 64, 64, 64, 64],  # All same size
  "variance": 0.0,
  "interpretation": "automated_traffic",
  "is_suspicious": true
}
```

**Use Cases (LLM reasoning):**
- Scan Detection: "All SYN flags, no ACK → port scan"
- Automation: "Packet timing is 0.5ms uniform → scripted attack"
- C2 Beacon: "Payload always 64 bytes → beacon pattern"

---

### 7. **Multi-Stage Attack Detection Tools**
*"Is this part of a larger attack chain?"*

**These tools help detect advanced attacks that unfold over multiple batches (Infiltration, APT, Lateral Movement, etc.) without hardcoding specific attack signatures.**

```python
# Tool: detect_attack_chain
{
  "ip_address": "192.168.1.50",
  "start_batch": 1,
  "end_batch": 10
}
→ Returns: {
  "phases_detected": [
    {
      "phase": "reconnaissance",
      "batches": [1, 2],
      "evidence": "Port scanning 22, 23, 80, 443 across 20 hosts",
      "port_diversity": 15,
      "target_diversity": 20
    },
    {
      "phase": "exploitation",

### **Phase 5: Multi-Stage Attack Detection** (Week 6)
15. ✅ `detect_attack_chain()` - Identify attack progression phases
16. ✅ `detect_behavioral_phases()` - Find phase transitions
17. ✅ `detect_lateral_movement()` - Track internal propagation
18. ✅ `detect_command_and_control()` - Find C2 beaconing
19. ✅ `detect_data_exfiltration()` - Unusual outbound activity
20. ✅ `detect_persistence_mechanism()` - Long-term presence
21. ✅ `find_attack_sequence_patterns()` - Common attack sequences
      "batches": [3],
      "evidence": "Successful connection to 10.0.0.5:22",
      "connection_established": true
    },
    {
      "phase": "post_exploitation",
      "batches": [4, 5, 6],
      "evidence": "Internal network scanning from compromised host",
      "lateral_movement": true
    },
    {
      "phase": "data_exfiltration",
      "batches": [7, 8, 9],
      "evidence": "Large outbound transfers to external IP",
      "exfil_bytes": 500000000
    }
  ],
  "is_multi_stage_attack": true,
  "confidence": 0.92,
  "attack_duration_batches": 9
}

# Tool: detect_behavioral_phases
{
  "ip_address": "192.168.1.50",
  "window_size": 3  # Analyze in 3-batch windows
}
→ Returns: {
  "phase_transitions": [
    {
      "from_batch": 1,
      "to_batch": 3,
      "before_behavior": "normal_user",
      "after_behavior": "scanner",
      "transition_significance": 0.001,
      "evidence": {
        "port_diversity_change": "2 ports → 50 ports",
        "target_diversity_change": "1 host → 100 hosts",
        "volume_change": "5KB → 500KB"
      }
    }
  ],
  "has_behavioral_shift": true
}

# Tool: detect_lateral_movement
{
  "internal_network": "192.168.1.0/24",
  "suspicious_ip": "192.168.1.50",
  "batches": [1, 2, 3, 4, 5]
}
→ Returns: {
  "is_lateral_movement": true,
  "compromised_hosts": [
    {"ip": "192.168.1.50", "compromised_batch": 3, "evidence": "bruteforce"},
    {"ip": "192.168.1.51", "compromised_batch": 4, "evidence": "propagated from .50"},
    {"ip": "192.168.1.52", "compromised_batch": 5, "evidence": "propagated from .51"}
  ],
  "propagation_pattern": "sequential",
  "propagation_speed": "1 host per batch",
  "affected_subnet": "192.168.1.0/24"
}

# Tool: detect_command_and_control
{
  "ip_address": "192.168.1.50",
  "lookback_batches": 20
}
→ Returns: {
  "is_c2_beacon": true,
  "beacon_characteristics": {
    "periodicity": "every 3 batches",
    "regularity_score": 0.95,  # 1.0 = perfectly regular
    "destination_ips": ["203.0.113.100"],  # Same C2 server
    "payload_size_consistency": 0.98,  # Always ~64 bytes
    "protocol": "TCP",
    "port": 443
  },
  "beacon_timeline": [
    {"batch": 1, "bytes": 64, "packets": 2},
    {"batch": 4, "bytes": 64, "packets": 2},
    {"batch": 7, "bytes": 64, "packets": 2},
    {"batch": 10, "bytes": 64, "packets": 2}
  ],
  "confidence": 0.89
}

# Tool: detect_data_exfiltration
{
  "ip_address": "192.168.1.50",
  "direction": "outbound",
  "batches": [1, 2, 3, 4, 5, 6, 7, 8]
}
→ Returns: {
  "is_exfiltration": true,
  "evidence": {
    "outbound_volume_change": {
      "baseline_avg": 10000,  # bytes per batch
      "current_avg": 50000000,  # 50MB per batch
      "increase_factor": 5000
    },
    "destination_pattern": {
      "destinations": ["203.0.113.200"],
      "is_single_destination": true,
      "is_external": true,
      "is_cloud_provider": false
    },
    "timing_pattern": {
      "occurs_at": "off_hours",  # Batch 6-8 = night time
      "is_suspicious_timing": true
    },
    "data_characteristics": {
      "connection_duration": "long",
      "bytes_per_packet": 1500,  # Full packets = large file transfer
      "is_encrypted": true
    }
  },
  "total_exfiltrated_bytes": 150000000,  # 150MB
  "confidence": 0.87
}

# Tool: detect_persistence_mechanism
{
  "ip_address": "192.168.1.50",
  "lookback_batches": 20
}
→ Returns: {
  "has_persistence": true,
  "evidence": {
    "regular_reconnections": true,
    "survives_batch_gaps": true,  # Still active after "quiet" periods
    "connection_frequency": "every 2-3 batches",
    "connection_reliability": 0.92  # Rarely fails to reconnect
  },
  "persistence_timeline": [
    {"batch": 1, "connected": true},
    {"batch": 3, "connected": true},
    {"batch": 5, "connected": true},
    {"batch": 10, "connected": true},
    {"batch": 15, "connected": true}
  ],
  "interpretation": "Automated persistence (cronjob, service, or implant)"
}

# Tool: find_attack_sequence_patterns
{
  "ip_address": "192.168.1.50",
  "sequence_types": ["scan_then_exploit", "exploit_then_lateral", "beacon_then_command"]
}
→ Returns: {
  "patterns_found": [
    {
      "pattern_type": "scan_then_exploit",
      "confidence": 0.91,
      "sequence": [
        {"batch": 1, "action": "port_scan", "targets": 50},
        {"batch": 2, "action": "targeted_scan", "targets": 5},
        {"batch": 3, "action": "exploitation_attempt", "targets": 1},
        {"batch": 3, "action": "successful_connection", "target": "10.0.0.5"}
      ]
    },
    {
      "pattern_type": "exploit_then_lateral",
      "confidence": 0.88,
      "sequence": [
        {"batch": 3, "action": "compromise", "host": "10.0.0.5"},
        {"batch": 4, "action": "internal_scan_from_compromised"},
        {"batch": 5, "action": "lateral_propagation", "new_victim": "10.0.0.6"}
      ]
    }
  ],
  "is_advanced_attack": true
}
```

**Use Cases (LLM reasoning):**

**Example 1: Infiltration Attack**
```
detect_attack_chain() → "4 phases detected: recon → exploit → lateral → exfil"
detect_behavioral_phases() → "Normal behavior in batch 1-2, scanner in 3-5"
detect_lateral_movement() → "Compromised 3 hosts sequentially"
detect_data_exfiltration() → "150MB exfiltrated to external IP in batches 7-9"

LLM Conclusion:
"CRITICAL: Multi-stage infiltration attack detected
- Batch 1-2: Reconnaissance (port scanning)
- Batch 3: Initial compromise (SSH bruteforce on 10.0.0.5)
- Batch 4-6: Lateral movement (3 hosts compromised)
- Batch 7-9: Data exfiltration (150MB to external server)

REVISION NEEDED: Mark batch 1-2 flows as PART OF ATTACK CHAIN (initially looked benign)"
```

**Example 2: Botnet C2**
```
detect_command_and_control() → "Periodic beacon every 3 batches to 203.0.113.100"
detect_persistence_mechanism() → "Connection survives gaps, reconnects reliably"
detect_behavioral_phases() → "Normal until batch 5, then regular C2 traffic"

LLM Conclusion:
"CRITICAL: Botnet C2 communication detected
- Batch 5: Initial compromise (how did malware get installed?)
- Batch 5-20: Regular C2 beacon (64 bytes, every 3 batches, 95% regularity)
- Evidence: Perfect periodicity, consistent payload size, single C2 server

REVISION NEEDED: Investigate batch 5 for initial infection vector"
```

**Example 3: APT-Style Attack**
```
find_attack_sequence_patterns() → "scan_then_exploit + exploit_then_lateral patterns"
detect_command_and_control() → "Low-frequency beacon (every 10 batches)"
detect_data_exfiltration() → "Slow exfiltration (small amounts over many batches)"

LLM Conclusion:
"CRITICAL: APT-style advanced persistent threat
- Slow, methodical progression over 20 batches
- Low-and-slow exfiltration (5MB per batch, avoids detection)
- Long-term persistence (beacon every 10 batches)

This is NOT opportunistic attack - this is targeted, patient adversary"
```

---

## Tool Implementation Priority

### **Phase 1: Core Memory & Context** (Week 1-2)
1. ✅ `store_flow()` - Save flow to memory DB
2. ✅ `query_ip_history()` - Historical behavior lookup
3. ✅ `calculate_baseline()` - Statistical baseline
4. ✅ `detect_volume_change()` - Trend detection

### **Phase 2: External Intelligence** (Week 3)
5. ✅ `check_ip_reputation()` - AbuseIPDB (already have API key)
6. ✅ `check_threat_feeds()` - AlienVault OTX (already integrated)
7. ✅ `geolocate_ip()` - IP geolocation

### **Phase 3: Correlation & Analysis** (Week 4)
8. ✅ `find_similar_flows()` - Pattern matching
9. ✅ `aggregate_by_pattern()` - Group by attributes
10. ✅ `detect_distributed_pattern()` - DDoS detection
11. ✅ `detect_behavioral_shift()` - Changepoint detection

### **Phase 4: Deep Inspection** (Week 5)
12. ✅ `analyze_tcp_flags()` - Protocol analysis
13. ✅ `analyze_packet_timing()` - Timing patterns
14. ✅ `calculate_entropy()` - Diversity metrics

---

## Example: LLM Reasoning Flow (SSH Bruteforce)

**Batch 3 Flow:**
```
src_ip: 203.0.113.50
dst_ip: 10.0.0.5
dst_port: 22
protocol: TCP
bytes: 1200
```

**LLM Tool Usage:**
1. `query_ip_history("203.0.113.50", lookback=10)`
   - **Result:** "This IP has attempted 150 SSH connections in last 10 batches"
   
2. `calculate_baseline(entity="dst_ip:10.0.0.5", metric="ssh_attempts")`
   - **Result:** "Normal SSH attempts = 2-3/batch, current = 50 (z-score: 45)"
   
3. `check_ip_reputation("203.0.113.50")`
   - **Result:** "Abuse confidence 95%, reported for SSH attacks"
   
4. `aggregate_by_pattern(group_by=["src_ip"], filters={"dst_port": 22})`
   - **Result:** "This IP targeted 50 different hosts on port 22"

**LLM Reasoning:**
> "**ATTACK DETECTED: SSH Bruteforce**
> 
> Evidence:
> - IP 203.0.113.50 has attempted 150 SSH connections across 50 hosts
> - Connection rate is 45 std deviations above baseline
> - IP has 95% abuse confidence score for SSH attacks
> - Pattern indicates automated credential stuffing
> 
> Confidence: HIGH (95%)
> RWhy Multi-Stage Tools Are Critical

**The Problem with Single-Flow Analysis:**
- Infiltration looks like: Normal browsing → Failed SSH → Normal browsing → Successful SSH → Internal scan
- Each individual flow looks normal or low-severity
- **Only when viewed as a sequence** does the attack become obvious

**The Solution:**
- Give LLM tools to detect **progression patterns**
- Detect **behavioral phase transitions** (normal → reconnaissance → exploitation → post-exploitation)
- Enable **retrospective revision**: "Those batch 1-2 port scans were actually reconnaissance for the batch 3 exploit"

**Key Insight:**
These tools don't hardcode "infiltration attack" or "APT attack" - they detect **generalized patterns**:
- Reconnaissance → Exploitation (any attack)
- Low-frequency periodic beacon (any C2)
- Volume spike to external IP (any exfiltration)
- Sequential host compromise (any lateral movement)

The LLM uses **reasoning** to connect dots: "This sequence of behaviors indicates multi-stage attack"

---

## Benefits of Generalized Approach

1. **Thesis Strength:**
   - Demonstrates LLM can **generalize** security reasoning
   - Not just memorizing attack signatures
   - Tests **true reasoning capability** across simple AND complex attacks
   - Shows LLM can detect **attack chains** without explicit training

2. **Real-World Applicability:**
   - Works on **zero-day attacks** (not in training data)
   - Detects **novel APT techniques** using behavioral primitives
   - **Future-proof** (doesn't need retraining for new attacks)
   - **Explainable** (LLM explains reasoning with tool results)

3. **Avoids Overfitting:**
   - Not tuned to CICIDS2018 attack types
   - Tests on unseen attacks would still work
   - Validates **generalization hypothesis**
   - Multi-stage tools work for ANY attack progression pattern

4. **Enables Revision:**
   - Tools provide historical context needed for revision
   - LLM can retrospectively re-evaluate earlier flows
   - **Critical for multi-stage attacks**: Early recon flows get upgraded to "part of attack chain"
   - Measures improvement: batch-level vs final-revised accuracy

5. **Handles Advanced Threats:**
   - Botnet C2 (periodic beaconing detection)
   - APT (low-and-slow exfiltration detection)
   - Infiltration (attack chain reconstruction)
   - Lateral movement (propagation tracking)
   - **Without hardcoding any attack-specific logic**
3. **Avoids Overfitting:**
   - Not tuned to CICIDS2018 attack types
   - Tests on unseen attacks would still work
   - Validates **generalization hypothesis**

4. **Enables Revision:**
   - Tools provide historical context needed for revision
   - LLM can retrospectively re-evaluate earlier flows
   - Measures improvement: batch-level vs final-revised accuracy

---

## Evaluation: Measuring LLM + MCP Contribution

### What We're Evaluating (Not Just Accuracy)

**1. Tool Selection Quality (LLM Intelligence)**
- Does LLM choose appropriate tools for each flow type?
- Does LLM call tools in logical order?
- Does LLM know when to stop gathering evidence?

**Metric:** Tool call relevance score (manual evaluation)

**2. Evidence Synthesis (LLM Reasoning)**
- Does LLM correctly interpret tool outputs?
- Does LLM weigh conflicting evidence appropriately?
- Does LLM integrate multiple evidence sources?

**Metric:** Compare LLM reasoning to ground truth explanations

**3. Generalization (Not Overfitting)**
- Does LLM detect attacks not explicitly trained on?
- Does LLM work on novel attack variations?
- Does LLM avoid false positives on benign anomalies?

**Metric:** Accuracy on held-out attack types

**4. Revision Improvement (Memory-Enabled)**
- How much does accuracy improve after revision phase?
- Which attack types benefit most from revision?
- Does LLM correctly identify which earlier flows need revision?

**Metric:** (Final Accuracy - Batch Accuracy) / Batch Accuracy

**5. Explainability (LLM Output Quality)**
- Are explanations understandable to security analysts?
- Does LLM cite specific evidence?
- Can explanations be used for incident response?

**Metric:** Analyst survey + explanation completeness score

### Baseline Comparisons

**Compare LLM+MCP against:**
1. **Traditional ML (XGBoost)** - No explainability, no revision
2. **LLM without tools** - Hallucinates, no external data
3. **Rule-based NIDS (Snort)** - No generalization, no context

**Expected Results:**
- Traditional ML: Higher speed, lower explainability
- LLM without tools: Good reasoning, but makes up facts
- **LLM+MCP: Best balance of accuracy, reasoning, and explainability**

---

## Next Steps

1. **Implement Memory MCP Server** with evidence-providing tools (Python)
2. **Create Batch Orchestrator** with revision phase
3. **Test on CICIDS2018** batches
4. **Measure:** 
   - Tool selection quality
   - Evidence synthesis accuracy
   - Generalization to unseen attacks
   - Revision improvement rate
   - Explanation quality

**Critical Success Criteria:**
- ✅ LLM must demonstrate reasoning (not just pattern matching)
- ✅ Tools must provide evidence (not make decisions)
- ✅ MCP must show composability advantage (easy to add new tools)
- ✅ Revision must improve accuracy measurably
- ✅ Explanations must be useful to analysts

Ready to start implementation?
