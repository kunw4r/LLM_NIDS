# Batch Analysis: LLM Performance on 10-Flow Batches

**Date:** October 16, 2025  
**Batches Analyzed:** batch_01 (Pure Attacks), batch_04 (Mixed)  
**Model:** GPT-4o-mini with MITRE ATT&CK validation

---

## 📊 BATCH 1: Pure Attacks (10 Attacks, 0 Benign)

### Ground Truth Composition:
- **Total flows:** 10
- **Attacks:** 10 (100%)
- **Benign:** 0 (0%)

### Attack Breakdown:
- **3 × Bot**
- **2 × DDOS_attack-HOIC**
- **2 × FTP-BruteForce**
- **2 × SSH-Bruteforce**
- **1 × DoS_attacks-Slowloris**

### LLM Results:
**❌ COMPLETE FAILURE - 0% Detection Rate**

From ANALYSIS_REPORT.md, the LLM classified ALL flows as **BENIGN**:
- IP 18.221.219.4 → Verdict: Benign
- IP 18.219.5.43 → Verdict: Benign
- IP 172.31.69.25 → Verdict: Benign
- IP 172.31.69.28 → Verdict: Benign

### Performance Metrics:
| Metric | Value |
|--------|-------|
| **True Positives** | 0 |
| **False Negatives** | 10 |
| **False Positives** | 0 |
| **True Negatives** | 0 |
| **Recall** | **0%** ❌ |
| **Precision** | N/A (no attacks flagged) |
| **F1-Score** | **0%** ❌ |

### Detailed Flow Analysis:

| Flow ID | Ground Truth | LLM Verdict | Result |
|---------|--------------|-------------|--------|
| 5 | FTP-BruteForce | BENIGN | ❌ MISSED |
| 11 | DDOS_attack-HOIC | BENIGN | ❌ MISSED |
| 20 | DoS_attacks-Slowloris | BENIGN | ❌ MISSED |
| 22 | DDOS_attack-HOIC | BENIGN | ❌ MISSED |
| 43 | SSH-Bruteforce | BENIGN | ❌ MISSED |
| 55 | FTP-BruteForce | BENIGN | ❌ MISSED |
| 58 | SSH-Bruteforce | BENIGN | ❌ MISSED |
| 62 | Bot | BENIGN | ❌ MISSED |
| 65 | Bot | BENIGN | ❌ MISSED |
| 66 | Bot | BENIGN | ❌ MISSED |

### Root Cause Analysis:

**Why did the LLM fail completely?**

1. **IP-based analysis instead of behavioral:**
   - LLM focused on IP reputation (Amazon.com, Private IPs)
   - Concluded "clean IP = benign traffic"
   - Ignored flow-level behavioral patterns

2. **Lack of temporal correlation:**
   - Each flow analyzed in isolation
   - Didn't detect repeated patterns (multiple FTP, SSH, Bot flows)
   - No aggregation by source IP or attack type

3. **MITRE mapping was superficial:**
   - Listed generic techniques (T1189, T1190, T1595) without evidence
   - Didn't actually apply them to the flows
   - Recommendations were generic boilerplate

4. **No baseline comparison:**
   - Didn't recognize abnormal behavior for FTP port 21, SSH port 22
   - Short 1ms durations and RST flags not flagged as suspicious

---

## 📊 BATCH 4: Mixed (5 Attacks, 5 Benign)

### Ground Truth Composition:
- **Total flows:** 10
- **Attacks:** 5 (50%)
- **Benign:** 5 (50%)

### Attack Breakdown:
- **1 × DDOS_attack-HOIC** (flow 11)
- **1 × DDOS_attack-HOIC** (flow 22)
- **1 × DoS_attacks-Slowloris** (flow 20)
- **1 × FTP-BruteForce** (flow 5)
- **1 × SSH-Bruteforce** (flow 43)

### Benign Flows:
- Flows 0, 1, 2, 3, 4

### LLM Results:
**Partial Success - 40% Detection Rate**

### Performance Metrics:
| Metric | Value |
|--------|-------|
| **True Positives** | 2 (FTP-BruteForce, SSH-Bruteforce) |
| **False Negatives** | 3 (2× DDOS-HOIC, 1× Slowloris) |
| **False Positives** | 0 |
| **True Negatives** | 5 (all benign correctly identified) |
| **Recall** | **40%** ⚠️ |
| **Precision** | **100%** ✅ |
| **F1-Score** | **57.1%** |

### Detailed Flow Analysis:

| Flow ID | Ground Truth | LLM Verdict | Attack Type | MITRE | Result |
|---------|--------------|-------------|-------------|-------|--------|
| 0 | Benign | BENIGN | N/A | N/A | ✅ CORRECT |
| 1 | Benign | BENIGN | N/A | N/A | ✅ CORRECT |
| 2 | Benign | BENIGN | N/A | N/A | ✅ CORRECT |
| 3 | Benign | BENIGN | N/A | N/A | ✅ CORRECT |
| 4 | Benign | BENIGN | N/A | N/A | ✅ CORRECT |
| 5 | FTP-BruteForce | **ATTACK** | FTP-BruteForce | T1110 | ✅ CORRECT |
| 11 | DDOS_attack-HOIC | BENIGN | N/A | N/A | ❌ MISSED |
| 20 | DoS_attacks-Slowloris | BENIGN | N/A | N/A | ❌ MISSED |
| 22 | DDOS_attack-HOIC | BENIGN | N/A | N/A | ❌ MISSED |
| 43 | SSH-Bruteforce | **ATTACK** | SSH-Bruteforce | T1110.001 | ✅ CORRECT |

### What the LLM Got Right:

1. **✅ FTP-BruteForce (Flow 5):**
   - Correctly identified: "Port 21; RST flag; 1ms duration; failed auth pattern"
   - Correct MITRE mapping: T1110 (Brute Force)
   - Key indicators recognized: Short duration, failed authentication, suspicious behavior

2. **✅ SSH-Bruteforce (Flow 43):**
   - Correctly identified: "Port 22; RST flag; instant failure; datacenter source; classic bruteforce"
   - Correct MITRE mapping: T1110.001 (Brute Force: Password Guessing)
   - Key indicators recognized: Port 22, RST flag, datacenter IP

3. **✅ All 5 Benign flows (0, 1, 2, 3, 4):**
   - Correctly identified normal DNS queries (port 53)
   - Correctly identified normal RDP traffic (port 3389)
   - Zero false positives

### What the LLM Got Wrong:

1. **❌ DDOS_attack-HOIC (Flow 11):**
   - Classified as: BENIGN
   - Reason: "Port 80; 18ms duration; TCP flags 219; IP clean"
   - **Missed:** Didn't recognize DDoS pattern on HTTP port

2. **❌ DoS_attacks-Slowloris (Flow 20):**
   - Classified as: BENIGN
   - Reason: "Port 80; 1ms duration; TCP flags 24; IP clean"
   - **Missed:** Didn't recognize Slowloris timing pattern

3. **❌ DDOS_attack-HOIC (Flow 22):**
   - Classified as: BENIGN
   - Reason: "Port 80; 4ms duration; TCP flags 219; IP clean"
   - **Missed:** Didn't recognize DDoS pattern on HTTP port

### Root Cause Analysis:

**Why did the LLM detect brute force but miss DoS/DDoS?**

1. **Brute force has clear port-based signatures:**
   - Port 21 (FTP) + RST flag + short duration = obvious brute force
   - Port 22 (SSH) + RST flag + datacenter IP = obvious brute force
   - LLM's port-based heuristics work well for these

2. **DoS/DDoS attacks are more subtle:**
   - Port 80 (HTTP) appears legitimate
   - "IP clean" from reputation check → assumed benign
   - Short durations (1ms, 4ms, 18ms) not flagged as suspicious
   - No temporal aggregation to detect flood patterns

3. **Over-reliance on IP reputation:**
   - LLM used IP reputation tools heavily
   - "IP clean" → classified as benign
   - Ignored behavioral patterns that indicate resource exhaustion

4. **Missing attack signatures:**
   - No HOIC signature recognition
   - No Slowloris timing pattern detection
   - Would need protocol-specific analysis tools

---

## 🔍 COMPARATIVE ANALYSIS: Batch 1 vs Batch 4

| Metric | Batch 1 (Pure Attacks) | Batch 4 (Mixed) | Difference |
|--------|----------------------|-----------------|------------|
| **Recall** | 0% | 40% | +40% |
| **Precision** | N/A | 100% | N/A |
| **F1-Score** | 0% | 57.1% | +57.1% |
| **Attacks Detected** | 0/10 | 2/5 | - |
| **Benign Correctly ID'd** | N/A | 5/5 | - |

### Key Insight:
**The LLM performs BETTER on mixed batches than pure attack batches!**

**Why?**
- In pure attack batches, LLM assumes "all suspicious" = probably false positives
- Conservative approach: classify everything as benign to avoid false alarms
- In mixed batches, LLM has confidence in contrast (benign vs attack)
- More willing to flag obvious attacks (brute force) when benign baseline exists

---

## 📈 PERFORMANCE SUMMARY

### Attack Type Detection Accuracy:

| Attack Type | Total in Batches | Detected | Missed | Detection Rate |
|-------------|------------------|----------|--------|----------------|
| **Bot** | 3 | 0 | 3 | **0%** ❌ |
| **DDOS_attack-HOIC** | 3 | 0 | 3 | **0%** ❌ |
| **DoS_attacks-Slowloris** | 2 | 0 | 2 | **0%** ❌ |
| **FTP-BruteForce** | 3 | 1 | 2 | **33.3%** ⚠️ |
| **SSH-Bruteforce** | 3 | 1 | 2 | **33.3%** ⚠️ |
| **Overall** | 14 | 2 | 12 | **14.3%** ❌ |

### MITRE Technique Mapping:

| Technique | Used For | Correctness |
|-----------|----------|-------------|
| T1110 (Brute Force) | FTP-BruteForce | ✅ Correct |
| T1110.001 (Password Guessing) | SSH-Bruteforce | ✅ Correct |
| T1189, T1190, T1595 (Generic) | Batch 1 (unused) | ⚠️ Superficial |

**MITRE mapping accuracy:** 100% when actually applied, but rarely applied.

---

## 🚨 CRITICAL FINDINGS

### 1. **Attack Type Bias:**
- ✅ **Brute force attacks:** 33% detection (port-based signatures work)
- ❌ **DoS/DDoS attacks:** 0% detection (requires temporal analysis)
- ❌ **Bot attacks:** 0% detection (requires behavioral profiling)

### 2. **IP Reputation Over-Reliance:**
- Clean IP reputation → automatic "benign" classification
- Ignores behavioral indicators even when suspicious
- Need to prioritize behavioral patterns over IP reputation

### 3. **Pure Attack Batch Paradox:**
- 0% detection on batch_01 (10/10 attacks)
- 40% detection on batch_04 (5/10 attacks, 5/10 benign)
- LLM more conservative when everything looks suspicious
- Needs confidence in benign baseline to flag attacks

### 4. **Missing Detection Capabilities:**
- ❌ No DDoS flood pattern detection
- ❌ No Slowloris timing analysis
- ❌ No Bot behavior profiling
- ❌ No temporal correlation across flows

---

## 💡 RECOMMENDATIONS

### Immediate Fixes:

1. **Reduce IP reputation weight in decision making:**
   - Add rule: "Clean IP ≠ benign traffic"
   - Prioritize behavioral patterns over IP reputation
   - Use IP reputation as secondary factor only

2. **Add DoS/DDoS detection signatures:**
   - Short duration + HTTP port + multiple flows = potential DDoS
   - Repeated connections with identical timing = Slowloris
   - High packet rate + low duration = flood attack

3. **Implement temporal aggregation:**
   - Group flows by source IP within time window
   - Detect repeated patterns (e.g., 3× Bot flows from same source)
   - Calculate flow rate anomalies

4. **Add attack-specific detection tools:**
   - `detect_dos_patterns()` - timing and volume analysis
   - `detect_bot_behavior()` - C&C communication patterns
   - `detect_ddos_flood()` - packet rate and distribution analysis

### Long-term Improvements:

1. **Build attack signature database:**
   - HOIC signature (HTTP flood characteristics)
   - Slowloris signature (slow connection exhaustion)
   - Bot C&C signature (periodic beaconing)

2. **Add baseline comparison:**
   - Normal traffic profile for each port/protocol
   - Statistical anomaly detection (z-scores, IQR)
   - Deviation thresholds for flagging

3. **Improve confidence calibration:**
   - Don't assume "all suspicious = all benign"
   - Use statistical methods to validate suspicions
   - Balance between false positives and false negatives

---

## 📊 COST ANALYSIS

Unfortunately, batch_01 and batch_04 don't have cost data in the provided files. Based on the 100-flow samples:

**Estimated costs for 10-flow batches:**
- Simple batch: ~$0.004-$0.006
- Complex batch: ~$0.029

---

## 🎯 CONCLUSION

### Batch 1 (Pure Attacks):
- **❌ FAILED:** 0% detection rate
- **Root cause:** Over-reliance on IP reputation, no behavioral analysis
- **Critical lesson:** LLM cannot detect attacks without behavioral pattern recognition

### Batch 4 (Mixed):
- **⚠️ PARTIAL SUCCESS:** 40% recall, 100% precision
- **What worked:** Brute force detection on standard ports (FTP, SSH)
- **What failed:** DoS/DDoS detection (all missed)
- **Critical lesson:** Port-based heuristics work for obvious attacks, fail for subtle ones

### Overall Assessment:
The LLM shows **strong potential for brute force detection** (when behavioral patterns are clear) but **completely fails on DoS/DDoS attacks** (which require temporal correlation and traffic volume analysis). The system needs significant enhancements in behavioral pattern recognition and attack-specific detection capabilities.

**Thesis Impact:** These findings demonstrate the importance of combining LLM reasoning with specialized detection tools. Pure LLM analysis is insufficient for comprehensive NIDS.

---

**Report Generated:** October 16, 2025  
**Next Steps:** Implement DoS detection tools and re-test on batch_01
