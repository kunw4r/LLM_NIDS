# MCP Server Tools Overview

**System:** LLM-Based NIDS with Model Context Protocol (MCP)  
**Purpose:** Provide the LLM with structured access to threat intelligence and analysis tools

---

## 🎯 Overview

On the backend, the **MCP server** now connects key tools like **AbuseIPDB**, **AlienVault OTX**, **IP Geolocation**, and **MITRE ATT&CK** through one unified schema. Each tool provides specific types of information that help the LLM make informed decisions about network security threats.

---

## 🛠️ Current MCP Tools (Production)

### 1. 🔍 **MITRE ATT&CK Framework**

**What it provides:**
- **Standardized attack technique taxonomy** - 600+ documented attack patterns
- **Technique validation** - Confirms if an attack classification is legitimate
- **Structured threat reasoning** - Forces LLM to justify classifications with evidence
- **Attack pattern descriptions** - Detailed explanations of how attacks work
- **Detection guidance** - Recommended methods for identifying each technique

**Example usage:**
```
LLM observes: Repeated SSH connections from 13.58.98.64 → 172.31.69.5:22

Tool call: search_mitre_techniques(query="SSH brute force password guessing")
Returns: T1110.001 (Brute Force: Password Guessing)

Tool call: query_mitre_technique(technique_id="T1110.001")
Returns:
  - Name: "Brute Force: Password Guessing"
  - Tactic: "Credential Access"
  - Description: "Adversaries may use brute force techniques to gain access..."
  - Detection: "Monitor authentication logs for multiple failed attempts"

LLM classifies: SSH-Bruteforce attack (T1110.001) ✅
```

**Value:**
- ✅ Reduces misclassification (forces structured thinking)
- ✅ Provides explainability (standardized terminology)
- ✅ Low cost (local database, no external API calls)

---

### 2. 🌐 **IP Geolocation**

**What it provides:**
- **Geographic location** - Country, region, city of IP address
- **ISP/ASN information** - Internet Service Provider and Autonomous System Number
- **Organization details** - Company or entity owning the IP
- **Network type** - Hosting provider, mobile carrier, enterprise, etc.

**Example usage:**
```
LLM observes: Traffic from 13.58.98.64

Tool call: get_ip_geolocation(ip_address="13.58.98.64")
Returns:
  - Country: United States
  - Region: Ohio
  - City: Columbus
  - ISP: Amazon.com, Inc.
  - Organization: AWS EC2 (us-east-2)
  - ASN: AS16509

LLM reasons: "AWS server - could be legitimate cloud service or compromised instance"
```

**Value:**
- ⚠️ **Limited usefulness for static datasets** (IPs often internal/private)
- ✅ Useful for identifying cloud providers, hosting services
- ⚠️ Does NOT indicate maliciousness (clean IPs can be compromised)

**Current status:** Minimal usage (0-1 calls per 100 flows)

---

### 3. 🚨 **AbuseIPDB (IP Reputation)**

**What it provides:**
- **Abuse confidence score** - 0-100% likelihood IP is malicious
- **Report count** - Number of abuse reports from global community
- **Last reported date** - How recently IP was flagged
- **Attack categories** - Types of malicious activity (brute force, DDoS, spam)
- **ISP/country** - Network owner and location

**Example usage:**
```
LLM observes: Suspicious behavior from 185.220.101.42

Tool call: check_ip_reputation(ip_address="185.220.101.42")
Returns:
  - Abuse Confidence: 98%
  - Total Reports: 1,247
  - Last Reported: 2 days ago
  - Categories: ["SSH Brute Force", "DDoS Attack"]
  - ISP: "Tor Exit Node"

LLM reasons: "High-confidence malicious IP - confirmed attack source"
```

**Value:**
- ⚠️ **Low value for static/research datasets** (historical data, IPs no longer active)
- ✅ Excellent for **live production traffic** (real-time threat intel)
- ❌ **High cost** ($0.01-$0.02 per lookup with API limits)
- ⚠️ **Many false negatives** (attacker IPs not yet reported)

**Current status:** Minimal usage (too expensive for batch analysis)

---

### 4. 🔗 **AlienVault OTX (Open Threat Exchange)**

**What it provides:**
- **Threat pulse subscriptions** - Community-submitted threat intelligence
- **Indicator of Compromise (IoC) data** - Known malicious IPs, domains, hashes
- **Attack patterns** - Associated tactics, techniques, procedures (TTPs)
- **Related threats** - Connected malware families, campaigns
- **Historical context** - When IP was first/last seen in attacks

**Example usage:**
```
LLM observes: Connection to 45.142.212.61

Tool call: query_alienvault_otx(indicator="45.142.212.61", type="IPv4")
Returns:
  - Pulse matches: 3
  - First seen: 2023-11-14
  - Last seen: 2024-10-10
  - Associated malware: ["Mirai", "Botnet C2"]
  - Threat tags: ["botnet", "iot-malware", "ddos"]

LLM reasons: "Known botnet C2 server - classify as Bot attack"
```

**Value:**
- ⚠️ **Low value for CICIDS-2018 dataset** (data from 2018, OTX didn't have coverage)
- ✅ **High value for modern live traffic** (extensive threat intelligence)
- ✅ **Free API** (no per-lookup cost, but rate-limited)
- ⚠️ **Requires external network** (not available offline)

**Current status:** Minimal usage (dataset pre-dates most OTX intelligence)

---

## 📊 Tool Usage Comparison

| Tool | Cost | Dataset Value | Live Traffic Value | Information Type |
|------|------|---------------|-------------------|------------------|
| **MITRE ATT&CK** | Free | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Attack classification |
| **IP Geolocation** | Free | ⭐⭐ | ⭐⭐⭐ | Geographic context |
| **AbuseIPDB** | $0.01-0.02/lookup | ⭐ | ⭐⭐⭐⭐ | IP reputation |
| **AlienVault OTX** | Free (rate-limited) | ⭐ | ⭐⭐⭐⭐⭐ | Threat intelligence |

---

## 🚀 Recommended New Tools (Behavioral Analysis)

### 5. 📈 **Temporal Flow Aggregator** (PROPOSED)

**What it would provide:**
- **Time-windowed statistics** - Flow counts, rates, patterns over 1-5 second windows
- **Source/destination aggregations** - Group flows by IP pairs, ports
- **Connection rate analysis** - Detect flood patterns (>50 flows/sec)
- **Timing pattern detection** - Identify automated vs human behavior

**Example usage:**
```
Tool call: summarize_temporal_patterns(flows, time_window=5)
Returns:
  Window 1 (12:28:07-12:28:12):
    - Total flows: 347
    - Flow rate: 69.4 flows/sec
    - Unique sources: 212 IPs
    - Unique destinations: 1 IP (172.31.69.10)
    - Avg duration: 7ms
    - Pattern detected: DDoS flood (many→one, high rate)

LLM classifies: DDoS attack (T1499.002) ✅
```

**Expected value:**
- ⭐⭐⭐⭐⭐ **Critical for coordinated attacks** (DDoS, Slowloris, botnets)
- 🎯 **Solves current limitation:** 0% DDoS detection → ~80% expected
- 💰 **Low cost:** Local computation, no external APIs

---

### 6. 📊 **Statistical Anomaly Detector** (PROPOSED)

**What it would provide:**
- **Z-score analysis** - How many standard deviations from normal
- **IQR outlier detection** - Identify statistical outliers robustly
- **Isolation Forest** - ML-based anomaly detection
- **Baseline comparison** - Compare against normal service behavior

**Example usage:**
```
Tool call: detect_statistical_anomalies(flows, metric='duration_ms', method='zscore')
Returns:
  - Anomaly count: 23 flows
  - Mean duration: 2,145ms
  - Std deviation: 342ms
  - Outliers: [
      Flow #12: 87ms (z-score: -6.0σ) ⚠️
      Flow #15: 91ms (z-score: -6.0σ) ⚠️
      Flow #22: 85ms (z-score: -6.0σ) ⚠️
    ]

LLM reasons: "Multiple flows <100ms in dataset averaging 2s - suspicious automation"
```

**Expected value:**
- ⭐⭐⭐⭐ **Reduces false positives** (quantitative validation)
- 🎯 **Improves precision:** 87.6% → ~93% expected
- 💰 **Low cost:** Simple statistical calculations

---

### 7. 🔬 **Protocol Behavior Analyzer** (PROPOSED)

**What it would provide:**
- **TCP handshake validation** - Detect SYN floods, half-open connections
- **HTTP request patterns** - Identify Slowloris, slow POST attacks
- **DNS query analysis** - Detect tunneling, exfiltration
- **Port behavior baselines** - Know what's "normal" for SSH, HTTP, RDP

**Example usage:**
```
Tool call: analyze_tcp_behavior(flows)
Returns:
  - Completed handshakes: 12/47 (25.6%)
  - Half-open connections: 35 (74.4%) ⚠️
  - Average handshake time: 145ms
  - RST flag count: 41 (87%) ⚠️
  - Pattern: "SYN flood - many incomplete connections"

LLM classifies: DDoS-SYN attack (T1499.002) ✅
```

**Expected value:**
- ⭐⭐⭐⭐ **Attack-specific detection** (protocol-aware analysis)
- 🎯 **Improves classification:** 67% → ~80% expected
- 💰 **Medium cost:** More complex parsing, still local

---

### 8. 🧠 **Attack Pattern Library** (PROPOSED)

**What it would provide:**
- **Pre-defined signatures** - Known attack patterns from research
- **Similarity matching** - Compare current flows to historical attacks
- **Feature vectors** - Extract key characteristics for comparison
- **Confidence scoring** - How closely flows match known patterns

**Example usage:**
```
Tool call: match_attack_signature(flows, signature_db="slowloris")
Returns:
  - Match confidence: 87%
  - Matched pattern: "Slowloris v2.0"
  - Key features:
      ✓ Same source IP (172.31.69.28)
      ✓ Repeated connections to port 80
      ✓ Short duration (200-300ms)
      ✓ Minimal data transfer (<200 bytes)
      ✓ High connection rate (53 in 1.2s)
  - Signature: "Multiple slow, incomplete HTTP connections"

LLM classifies: DoS-Slowloris (T1499) with HIGH confidence ✅
```

**Expected value:**
- ⭐⭐⭐⭐ **Improves recall on known attacks** (signature matching)
- 🎯 **Boosts Slowloris detection:** 37.5% → ~75% expected
- 💰 **Low cost:** Local pattern database

---

## 🔄 Tool Evolution Strategy

### Phase 1: Current (IP-Heavy Approach) ❌
```
LLM → Check AbuseIPDB → Check OTX → Check Geolocation → Guess
Cost: $0.30-$0.50 per 100 flows
Recall: ~60-70%
Problem: Over-reliance on external threat intel (low data availability)
```

### Phase 2: MITRE-Focused (Current) ⚠️
```
LLM → Analyze behavior → Search MITRE → Validate technique → Classify
Cost: $0.04-$0.29 per 100 flows (75% reduction)
Recall: 70.9%
Problem: No temporal context, port-based bias
```

### Phase 3: Behavioral + Temporal (Proposed) ✅
```
LLM → Temporal aggregation → Statistical analysis → MITRE validation → Classify
      ↓
      Protocol analysis → Pattern matching → Confidence scoring
Cost: $0.05-$0.15 per 100 flows (target)
Recall: ~85-90% (expected)
Benefit: Behavioral reasoning, not just signature matching
```

---

## 📋 Summary for Presentation Slide

### "MCP Server Tools - What Each Provides"

**Current Production Tools:**

1. **MITRE ATT&CK** 🎯
   - Standardized attack taxonomy (600+ techniques)
   - Forces structured reasoning and explainability
   - ⭐ **High value** - Used in every analysis

2. **IP Geolocation** 🌐
   - Geographic location and ISP information
   - Cloud provider identification
   - ⚠️ **Limited value** - IPs often internal/private

3. **AbuseIPDB** 🚨
   - IP reputation scores (0-100% malicious)
   - Community abuse reports
   - ❌ **Low value for datasets** - Too expensive, low coverage

4. **AlienVault OTX** 🔗
   - Threat intelligence pulses
   - Known malicious indicators
   - ❌ **Low value for CICIDS-2018** - Dataset pre-dates threat intel

**Proposed Behavioral Tools:**

5. **Temporal Aggregator** 📈
   - Flow rate analysis, time-windowed statistics
   - 🎯 **Solves DDoS detection** (0% → ~80%)

6. **Statistical Analyzer** 📊
   - Anomaly detection, baseline comparison
   - 🎯 **Reduces false positives** (87.6% → ~93%)

7. **Protocol Analyzer** 🔬
   - TCP/HTTP/DNS behavior validation
   - 🎯 **Improves classification** (67% → ~80%)

8. **Pattern Matcher** 🧠
   - Signature-based attack recognition
   - 🎯 **Boosts Slowloris recall** (37.5% → ~75%)

---

## 💡 Key Insight for Thesis

**From TEST_RESULTS_ANALYSIS.md:**
> "MITRE ATT&CK mapping significantly reduces costs (70% reduction) and encourages structured analysis, BUT the LLM still lacks temporal correlation and behavioral baselines."

**Solution:**
> "Move from signature-based external threat intel (AbuseIPDB, OTX) to **behavioral analysis tools** (temporal aggregation, statistical anomaly detection). This allows the LLM to detect **novel attacks** by reasoning about behavior, not just matching known signatures."

**Expected Impact:**
- **Cost:** $0.12 → $0.08 per 100 flows (33% reduction)
- **Recall:** 70.9% → ~88% (+24% improvement)
- **Precision:** 87.6% → ~93% (+6% improvement)
- **Classification:** 67% → ~82% (+22% improvement)

---

**Document Purpose:** Explain what each MCP tool provides and why behavioral tools are the next evolution.  
**Target Audience:** Thesis committee, seminar presentation, technical documentation.
