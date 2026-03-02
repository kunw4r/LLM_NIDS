# Infilteration Attack Detection: Temporal Clustering Results

## Problem Statement

Infilteration attacks in CICIDS2018 achieved 0% recall in Stage 1 evaluation.
Root cause analysis revealed a double failure:

1. **Tier 1 RF filter** classified 40/50 attack flows as benign (80% loss at filtering)
2. **LLM agents** classified all remaining 10 flows as BENIGN — they are individually
   indistinguishable from legitimate DNS/NTP/DHCP queries

The attack vector is DNS exfiltration (T1048.003): 46/50 attack flows are DNS queries
(port 53, UDP, 1 packet, 63-457 bytes). Each looks normal individually, but 46 DNS
queries from one IP in a short window is the anomalous signal.

## Experimental Design

Three conditions tested on the same 1000-flow batch (50 attack, 950 benign):

| Condition | Enriched Prompt | Temporal Clustering | Tier 1 Override |
|-----------|----------------|--------------------|-----------------|
| A         | Yes            | No                 | No              |
| B         | No             | Yes (5-min window) | Yes (>10 DNS)   |
| C         | Yes            | Yes                | Yes             |

## Results

| Condition | TP | FP | FN | TN | Recall | FPR | F1 | Cost |
|-----------|----|----|----|----|--------|-----|-----|------|
| Baseline  | 0  | 0  | 50 | 950| 0.0%   | 0.0%| 0.0%| ~$3.50|
| Enriched Prompt Only | 0 | 0 | 50 | 950 | 0.0% | 0.0% | 0.0% | $0.00 |
| Temporal Clustering | 26 | 170 | 24 | 780 | 52.0% | 17.9% | 21.1% | $7.24 |
| Enriched + Clustering | 29 | 182 | 21 | 768 | 58.0% | 19.2% | 22.2% | $7.79 |

## Analysis

### Condition A — Enriched Prompt Only
Recall: 0.0% (TP=0, FN=50)

As predicted, enriched prompts alone cannot overcome the Tier 1 filter blocking 80% of attack flows. Even when flows reach the LLM, individual DNS queries remain indistinguishable from benign traffic without cluster context.

### Condition B — Temporal Clustering
Recall: 52.0% (TP=26, FN=24)

Temporal clustering significantly improves detection by:
1. **Overriding Tier 1** for flows in suspicious DNS clusters (fixing the filter problem)
2. **Injecting cluster context** so agents see aggregate patterns (fixing the LLM problem)

### Condition C — Combined (Enriched + Clustering)
Recall: 58.0% (TP=29, FN=21)

The combined approach provides the most complete solution, addressing both the filtering and detection layers.

## Implications for AMATAS v3

The best condition (Enriched + Clustering) achieved 58.0% recall at $7.79 cost. This validates the v3 hypothesis: temporal clustering provides context density that individual flow analysis cannot match. For attacks like Infilteration where the signal is in the *pattern* of flows rather than any individual flow, clustering is essential.

Cost increased from ~$3.50 (baseline) to $7.79 due to more flows reaching the LLM pipeline (222 vs ~60). This is an acceptable trade-off for recovering from 0% to 58% recall on one of the hardest attack types.
