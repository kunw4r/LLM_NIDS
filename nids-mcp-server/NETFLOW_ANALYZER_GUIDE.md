# NetFlow Analyzer - Cline Testing Guide

## Overview
The NetFlow Analyzer is now integrated into the NIDS MCP server! It provides **5 powerful tools** for behavioral analysis using a per-IP working memory system (like an analyst's notepad).

## Architecture
- **Per-IP Queues**: Each IP gets a `deque(maxlen=20)` to track last 20 flows
- **Working Memory**: Sliding window approach (not permanent database)
- **SQLite Persistence**: Optional persistence across sessions
- **Academic Foundation**: Follows ReAct, Toolformer, HuggingGPT patterns

## The 5 NetFlow Tools

### 1. `record_flow`
**Purpose**: Record NetFlow entries into working memory  
**Use Case**: Feed flows to the system for temporal analysis

```json
{
  "flow_data": {
    "src_ip": "13.58.98.64",
    "dst_ip": "172.31.69.25",
    "src_port": 45678,
    "dst_port": 22,
    "protocol": 6,
    "duration": 369000,
    "tot_fwd_pkts": 23,
    "tot_bwd_pkts": 23
  }
}
```

**Returns**:
- Queue size and capacity
- New IP indicator
- Total flows processed

---

### 2. `get_ip_history`
**Purpose**: Retrieve recent flows for an IP  
**Use Case**: Review what an IP has been doing recently

```json
{
  "ip_address": "13.58.98.64",
  "limit": 10
}
```

**Returns**:
- Last N flows in chronological order
- Analyst observations
- Queue metadata

---

### 3. `analyze_ip_pattern`
**Purpose**: Analyze behavioral patterns  
**Use Case**: Detect attack signatures (port scanning, brute force, etc.)

```json
{
  "ip_address": "13.58.98.64"
}
```

**Returns**:
- **Port Behavior**: Unique ports, diversity ratio, most common port
- **Target Behavior**: Unique targets, diversity ratio
- **Traffic Statistics**: Avg duration, packet rates, standard deviation
- **Behavioral Flags**:
  - `HIGH_PORT_DIVERSITY`: 🚩 Port scanning
  - `HIGH_TARGET_DIVERSITY`: 🚩 Network reconnaissance
  - `RAPID_FIRE_CONNECTIONS`: 🚩 DDoS/Brute force (avg duration < 1000ms, flows >= 10)
  - `PROTOCOL_SWITCHING`: 🚩 Protocol tunneling/evasion

---

### 4. `detect_behavior_change`
**Purpose**: Detect behavioral shifts  
**Use Case**: Identify attack escalation or compromised hosts

```json
{
  "ip_address": "13.58.98.64",
  "window_size": 5
}
```

**Returns**:
- Baseline vs recent flow comparison
- **Change Types**:
  - `NEW_PORTS`: Started targeting new ports
  - `NEW_TARGETS`: Started targeting new hosts
  - `TRAFFIC_SPIKE`: Packet rate increased >2x
  - `TRAFFIC_DROP`: Packet rate decreased >2x

---

### 5. `add_observation`
**Purpose**: Add analyst notes to IP investigation  
**Use Case**: Maintain context across multiple tool calls

```json
{
  "ip_address": "13.58.98.64",
  "observation": "Detected SSH bruteforce pattern - recommend blocking. Map to MITRE T1110."
}
```

**Returns**:
- Confirmation with total observations count
- Timestamped observation

---

## Testing Scenario: SSH Bruteforce from CICIDS2018

### Sample NetFlow Record
From `TEST_NETFLOW_SAMPLE.md`:

```
Source IP: 13.58.98.64
Destination IP: 172.31.69.25
Destination Port: 22 (SSH)
Protocol: TCP
Duration: 369ms
Forward Packets: 23
Backward Packets: 23
Label: SSH-Bruteforce ✅ (confirmed in dataset)
```

### Recommended Testing Flow

1. **Record the flow**:
   ```
   Use record_flow to add the SSH bruteforce flow to working memory
   ```

2. **Analyze the IP**:
   ```
   Use analyze_ip_pattern on 13.58.98.64 to detect behavioral flags
   ```
   - Expected: `RAPID_FIRE_CONNECTIONS` flag (duration < 1000ms)

3. **Check other threat intel**:
   ```
   Use check_ip_abuseipdb, check_ip_otx, geolocate_ip on 13.58.98.64
   ```

4. **Map to MITRE**:
   ```
   Use map_attack_to_mitre with "SSH bruteforce"
   ```
   - Expected: T1110 (Brute Force), T1110.001 (Password Guessing), T1021.004 (SSH)

5. **Add your conclusion**:
   ```
   Use add_observation to document your analysis and recommendation
   ```

---

## Test Results from Automated Test Suite

✅ **TEST 1**: Basic Flow Recording - PASSED  
✅ **TEST 2**: SSH Bruteforce Simulation (15 flows) - PASSED  
✅ **TEST 3**: IP History Retrieval - PASSED  
✅ **TEST 4**: Behavioral Pattern Analysis - PASSED  
   - Detected `RAPID_FIRE_CONNECTIONS` flag (avg duration: 370ms)  
✅ **TEST 5**: Behavior Change Detection - PASSED  
   - Detected `NEW_PORTS` and `TRAFFIC_SPIKE` during attack escalation  
✅ **TEST 6**: Analyst Observations - PASSED  
   - Successfully stored and retrieved 3 observations  
✅ **TEST 7**: Port Scanning Detection - PASSED  
   - Detected `HIGH_PORT_DIVERSITY` flag (20 unique ports scanned)  
   - Detected `RAPID_FIRE_CONNECTIONS` flag (avg duration: 50ms)  

---

## Research Questions to Explore

1. **How many flows before pattern detected?**
   - Feed flows one by one, check `analyze_ip_pattern` after each
   - Measure when behavioral flags first appear

2. **Can LLM detect behavior changes?**
   - Record SSH flows, then HTTP flows
   - Use `detect_behavior_change` to identify attack escalation

3. **Does queue size affect accuracy?**
   - Test with queue_size=10, 20, 50
   - Measure precision/recall on known attacks

4. **Can LLM generalize to novel attacks?**
   - Test on attack types not seen in training
   - Measure false positive rate on benign traffic

---

## Total MCP Server Capabilities

Now you have **13 tools** at your disposal:

### Threat Intelligence (5 tools)
1. `geolocate_ip` - IP geolocation
2. `check_ip_reputation` - abuse.ch feeds
3. `check_ip_abuseipdb` - Community reports
4. `check_ip_otx` - AlienVault OTX
5. `search_otx_pulses` - Threat pulse search

### MITRE ATT&CK (3 tools)
6. `query_mitre_technique` - Get technique details
7. `search_mitre_techniques` - Search 691 techniques
8. `map_attack_to_mitre` - Map attack type to techniques

### NetFlow Analysis (5 tools) ⭐ NEW!
9. `record_flow` - Record NetFlow to working memory
10. `get_ip_history` - Retrieve IP flow history
11. `analyze_ip_pattern` - Behavioral pattern detection
12. `detect_behavior_change` - Anomaly detection
13. `add_observation` - Add analyst notes

---

## Next Steps

1. ✅ **Test with Cline** - Validate end-to-end with real NetFlow
2. ⏳ **Batch Processing** - Script to process 7M dev flows in batches
3. ⏳ **Evaluation Metrics** - Precision, recall, F1-score on test set
4. ⏳ **Thesis Writeup** - Document methodology and results

---

## Academic Justification

This is **NOT "cheating"** - this is established research methodology:

- **ReAct** (Google/Princeton 2022): LLMs + Tool Use for reasoning
- **Toolformer** (Meta 2023): Self-supervised tool learning
- **HuggingGPT** (Microsoft 2023): LLM as controller, tools as experts

The **LLM does the reasoning** (pattern recognition, threat assessment, MITRE mapping).  
The **tools provide context** (threat intel, flow history, statistical analysis).

Your contribution: **Applying tool-augmented LLMs to NIDS** with working memory.
