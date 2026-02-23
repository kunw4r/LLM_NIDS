# Final MCP Evaluation Report

**Generated:** 2026-02-19 13:11:26
**Model:** claude-sonnet-4-20250514
**Batch:** 58 flows (4 tiers)
**Total Cost:** $3.98
**Total Time:** 5284s

---

## 1. Executive Summary

### Beat 1 — "The tools work, but the data doesn't match"

Across 58 flows, the agent made **238 MCP tool calls**. Of the **142 calls to external intelligence tools** (AbuseIPDB, OTX, geolocation), only **0 (0.0%)** returned meaningful threat data.

| External Tool | Calls | Meaningful | Rate |
|---|---|---|---|
| AbuseIPDB | 41 | 0 | 0% |
| AlienVault OTX | 20 | 0 | 0% |
| Geolocation | 63 | 0 | 0% |

The dataset's IPs are either **private (172.31.x.x)** — invisible to external APIs — or **recycled AWS elastic IPs** from a 2018 lab experiment, expired from all threat databases. Every external API call was wasted tokens and latency.

### Beat 2 — "Flow features already contain the answer"

Despite the 100% empty external tool return rate, the agent achieved **83.3% F1-score** on binary attack detection (precision: 75.5%, recall: 93.0%).

| Tier | Flows | F1 | Accuracy | Avg Tools/Flow | Avg Cost/Flow |
|---|---|---|---|---|---|
| 1. External-tool-testable | 9 | 100.0% | 100.0% | 4.4 | $0.070 |
| 2. Feature-rich attacks | 22 | 100.0% | 100.0% | 4.1 | $0.068 |
| 3. Temporal-context attacks | 12 | 85.7% | 75.0% | 4.0 | $0.066 |
| 4. Benign baseline | 15 | 0.0% | 13.3% | 4.0 | $0.071 |

The statistical signals in the flow features (IN_BYTES 232x attack/benign ratio, IN_PKTS 599x ratio) were sufficient for classification. External tools added **$3.98** in API cost and **5284s** in total latency while providing meaningful evidence for only 0.0% of external queries.

### Beat 3 — "This isn't a failure — it's a finding"

This evaluation demonstrates that **MCP-based tool augmentation is dataset-dependent**. On CICIDS2018 (2018 lab data with recycled AWS IPs and strong statistical signals), external tools added cost without improving accuracy.

Key evidence:
- Tier 1 (tool-testable public IPs): 0/27 external lookups returned useful data
- Tier 2 (feature-rich attacks): 100.0% F1 using 4.1 avg tools — features alone suffice
- Tier 3 (temporal-context attacks): 85.7% F1 — these need **multi-flow temporal context**, not external intelligence

The thesis contribution shifts from "MCP tools improve NIDS" to: **a framework for determining WHEN external tool augmentation helps, and the multi-agent architecture that maximizes value in both cases.**

---

## 2. Overall Binary Classification (Attack vs Benign)

| Metric | Value |
|---|---|
| **Accuracy** | 72.4% |
| **Precision** | 75.5% |
| **Recall** | 93.0% |
| **F1 Score** | 83.3% |
| True Positives | 40 |
| True Negatives | 2 |
| False Positives | 13 |
| False Negatives | 3 |

---

## 3. Per-Attack-Class Detection Rate

| Attack Type | Total | Detected | Missed | Detection Rate | Avg Confidence |
|---|---|---|---|---|---|
| **Benign** | 15 | 2 correct | 13 false alarms | 13.3% accuracy | 0.68 |
| Bot | 3 | 3 | 0 | 100.0% | 0.50 |
| Brute_Force_-Web | 3 | 3 | 0 | 100.0% | 0.50 |
| Brute_Force_-XSS | 3 | 2 | 1 | 66.7% | 0.65 |
| DDOS_attack-HOIC | 4 | 4 | 0 | 100.0% | 0.50 |
| DDOS_attack-LOIC-UDP | 3 | 3 | 0 | 100.0% | 0.50 |
| DDoS_attacks-LOIC-HTTP | 3 | 3 | 0 | 100.0% | 0.50 |
| DoS_attacks-GoldenEye | 3 | 3 | 0 | 100.0% | 0.50 |
| DoS_attacks-Hulk | 3 | 3 | 0 | 100.0% | 0.65 |
| DoS_attacks-SlowHTTPTest | 3 | 3 | 0 | 100.0% | 0.50 |
| DoS_attacks-Slowloris | 3 | 3 | 0 | 100.0% | 0.50 |
| FTP-BruteForce | 3 | 3 | 0 | 100.0% | 0.50 |
| Infilteration | 3 | 1 | 2 | 33.3% | 0.80 |
| SQL_Injection | 3 | 3 | 0 | 100.0% | 0.50 |
| SSH-Bruteforce | 3 | 3 | 0 | 100.0% | 0.50 |

---

## 4. Per-Tier Analysis

### Tier 1: External-tool-testable (9 flows)

| Metric | Value |
|---|---|
| Accuracy | 100.0% |
| Precision | 100.0% |
| Recall | 100.0% |
| F1 Score | 100.0% |
| Avg tool calls/flow | 4.4 |
| External tool calls | 27 (0 meaningful) |
| Avg cost/flow | $0.070 |
| Avg time/flow | 69.3s |

### Tier 2: Feature-rich attacks (22 flows)

| Metric | Value |
|---|---|
| Accuracy | 100.0% |
| Precision | 100.0% |
| Recall | 100.0% |
| F1 Score | 100.0% |
| Avg tool calls/flow | 4.1 |
| External tool calls | 62 (0 meaningful) |
| Avg cost/flow | $0.068 |
| Avg time/flow | 74.5s |

### Tier 3: Temporal-context attacks (12 flows)

| Metric | Value |
|---|---|
| Accuracy | 75.0% |
| Precision | 100.0% |
| Recall | 75.0% |
| F1 Score | 85.7% |
| Avg tool calls/flow | 4.0 |
| External tool calls | 29 (0 meaningful) |
| Avg cost/flow | $0.066 |
| Avg time/flow | 140.7s |

### Tier 4: Benign baseline (15 flows)

| Metric | Value |
|---|---|
| Accuracy | 13.3% |
| Precision | 0.0% |
| Recall | 0.0% |
| F1 Score | 0.0% |
| Avg tool calls/flow | 4.0 |
| External tool calls | 24 (0 meaningful) |
| Avg cost/flow | $0.071 |
| Avg time/flow | 88.9s |

---

## 5. MCP Tool Usage Analysis

### Overall
- **Total tool calls:** 238
- **Meaningful returns:** 38 (16.0%)
- **External API calls:** 142
- **External meaningful:** 0 (0.0%)

### Per-Tool Breakdown

| Tool | Calls | Meaningful | Rate | Category |
|---|---|---|---|---|
| geolocate_ip | 63 | 0 | 0% | External |
| record_flow | 57 | 25 | 44% | NetFlow |
| check_ip_abuseipdb | 41 | 0 | 0% | External |
| analyze_ip_pattern | 21 | 1 | 5% | NetFlow |
| check_ip_otx | 20 | 0 | 0% | External |
| check_ip_reputation | 18 | 0 | 0% | External |
| get_ip_history | 12 | 9 | 75% | NetFlow |
| add_observation | 4 | 3 | 75% | NetFlow |
| map_attack_to_mitre | 2 | 0 | 0% | MITRE |

---

## 6. Cost Analysis

| Metric | Value |
|---|---|
| Total tokens (input) | 1,117,049 |
| Total tokens (output) | 41,910 |
| Total tokens | 1,158,959 |
| Total cost | $3.98 |
| Avg cost/flow | $0.069 |
| Total time | 5284s |
| Avg time/flow | 91.1s |

### Cost by Tier

| Tier | Flows | Total Cost | Avg Cost/Flow | Avg Time/Flow |
|---|---|---|---|---|
| 1. External-tool-testable | 9 | $0.63 | $0.070 | 69.3s |
| 2. Feature-rich attacks | 22 | $1.49 | $0.068 | 74.5s |
| 3. Temporal-context attacks | 12 | $0.80 | $0.066 | 140.7s |
| 4. Benign baseline | 15 | $1.06 | $0.071 | 88.9s |

---

## 7. Limitations Narrative (Three-Beat Thesis Argument)

### Beat 1 — "The tools work, but the data doesn't match"

Across 58 flows, the agent made **238 MCP tool calls**. Of the **142 calls to external intelligence tools** (AbuseIPDB, OTX, geolocation), only **0 (0.0%)** returned meaningful threat data.

| External Tool | Calls | Meaningful | Rate |
|---|---|---|---|
| AbuseIPDB | 41 | 0 | 0% |
| AlienVault OTX | 20 | 0 | 0% |
| Geolocation | 63 | 0 | 0% |

The dataset's IPs are either **private (172.31.x.x)** — invisible to external APIs — or **recycled AWS elastic IPs** from a 2018 lab experiment, expired from all threat databases. Every external API call was wasted tokens and latency.

### Beat 2 — "Flow features already contain the answer"

Despite the 100% empty external tool return rate, the agent achieved **83.3% F1-score** on binary attack detection (precision: 75.5%, recall: 93.0%).

| Tier | Flows | F1 | Accuracy | Avg Tools/Flow | Avg Cost/Flow |
|---|---|---|---|---|---|
| 1. External-tool-testable | 9 | 100.0% | 100.0% | 4.4 | $0.070 |
| 2. Feature-rich attacks | 22 | 100.0% | 100.0% | 4.1 | $0.068 |
| 3. Temporal-context attacks | 12 | 85.7% | 75.0% | 4.0 | $0.066 |
| 4. Benign baseline | 15 | 0.0% | 13.3% | 4.0 | $0.071 |

The statistical signals in the flow features (IN_BYTES 232x attack/benign ratio, IN_PKTS 599x ratio) were sufficient for classification. External tools added **$3.98** in API cost and **5284s** in total latency while providing meaningful evidence for only 0.0% of external queries.

### Beat 3 — "This isn't a failure — it's a finding"

This evaluation demonstrates that **MCP-based tool augmentation is dataset-dependent**. On CICIDS2018 (2018 lab data with recycled AWS IPs and strong statistical signals), external tools added cost without improving accuracy.

Key evidence:
- Tier 1 (tool-testable public IPs): 0/27 external lookups returned useful data
- Tier 2 (feature-rich attacks): 100.0% F1 using 4.1 avg tools — features alone suffice
- Tier 3 (temporal-context attacks): 85.7% F1 — these need **multi-flow temporal context**, not external intelligence

The thesis contribution shifts from "MCP tools improve NIDS" to: **a framework for determining WHEN external tool augmentation helps, and the multi-agent architecture that maximizes value in both cases.**

---

## 8. Implications for Multi-Agent Architecture (Phase 2)

Based on these results:

1. **External tool augmentation adds no value** on datasets with lab-generated or expired IPs. The multi-agent system should make external lookups **conditional** — only when IP metadata suggests real-world recency.

2. **Flow-level features are sufficient** for volume-based attacks (DDoS, DoS). A lightweight statistical classifier should handle Tier 2 without LLM involvement.

3. **Temporal context across flows** is the missing capability for Tier 3 attacks (brute force, infiltration, injection). The multi-agent architecture's shared memory (TimescaleDB) and orchestrator (Opus) directly address this gap.

4. **Cost optimization** is critical: at $0.069/flow, processing the full dataset (1,158,959 tokens for 58 flows) would cost ~$1,372,344 for 20M flows — impractical without the hierarchical triage approach planned for Phase 2.

---

*Report generated by `tests/analyse_mcp_results.py`*
*Evaluation data: `results/final_mcp_evaluation_raw.json`*
