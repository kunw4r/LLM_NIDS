# Large Sample Analysis - 1600 Flows

## Sample Information

- **Source Dataset:** development.csv
- **Sample Size:** 1600 flows
- **Sampling Method:** Random (seed=42)
- **Generated:** 2025-10-15 17:03:31

## Files

- `flows.txt` - Human-readable NetFlow data for Cline analysis
- `flows.json` - Structured JSON format of NetFlow data
- `ground_truth.json` - Actual labels (stored separately for verification)
- `README.md` - This file

## Sample Composition

### By Label
- **0:** 1393 flows (87.1%)
- **1:** 207 flows (12.9%)

### By Attack Category
- **Benign:** 1393 flows (87.1%)
- **DDOS_attack-HOIC:** 88 flows (5.5%)
- **DDoS_attacks-LOIC-HTTP:** 27 flows (1.7%)
- **FTP-BruteForce:** 24 flows (1.5%)
- **SSH-Bruteforce:** 19 flows (1.2%)
- **Infilteration:** 14 flows (0.9%)
- **Bot:** 13 flows (0.8%)
- **DoS_attacks-SlowHTTPTest:** 8 flows (0.5%)
- **DoS_attacks-Hulk:** 7 flows (0.4%)
- **DoS_attacks-Slowloris:** 3 flows (0.2%)
- **DoS_attacks-GoldenEye:** 3 flows (0.2%)
- **DDOS_attack-LOIC-UDP:** 1 flows (0.1%)


## Expected Behavior

This sample contains **0 attack flows** and **0 benign flows**.

### Success Criteria
Based on previous batch testing (Precision: 100%, Recall: 40%):

- **Expected True Positives:** ~0 attacks detected (40% recall)
- **Expected False Negatives:** ~0 attacks missed (60% of attacks)
- **Expected False Positives:** 0 (100% precision maintained)
- **Expected True Negatives:** 0 (all benign correctly identified)

### Known Detection Patterns
- ✅ **Will detect:** Brute force attacks (FTP/SSH with RST flags)
- ❌ **Will miss:** DDoS, DoS, Botnet traffic (behavioral anomalies)

## Testing Instructions

### 1. Provide to Cline
Give Cline the `flows.txt` file with this prompt:

```
Analyze these 1600 NetFlow records and provide your verdict for each flow.
Use your MCP server tools as needed (IP reputation, geolocation, MITRE mapping).
Output CSV format: flow_id,verdict,confidence,attack_type,key_indicators,mitre,recommendation,tools_used
```

### 2. Save Cline's Output
Save Cline's predictions to `predictions.csv`

### 3. Calculate Metrics
```bash
python calculate_metrics.py predictions.csv ground_truth.json
```

### 4. Analyze Cost
Check API usage to determine cost per flow at scale.

## Research Questions

1. **Does recall improve/degrade with larger samples?**
2. **Does cost per flow decrease with batch processing?**
3. **Are there any false positives at scale?**
4. **What is the detection rate for each attack category?**
5. **How does confidence distribution change?**

---

**Note:** Ground truth labels are stored in `ground_truth.json` - DO NOT provide this to Cline during analysis.
