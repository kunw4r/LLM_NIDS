// Research Questions with evidence links

export const RESEARCH_QUESTIONS = [
  {
    id: "RQ1",
    question: "Can a multi-agent LLM system achieve comparable detection accuracy to traditional ML classifiers on realistic network traffic?",
    shortLabel: "Detection Accuracy",
    verdict: "Comparable on most attacks, superior on RF-invisible types",
    verdictColor: "#16a34a",
    answer: "AMATAS v2 achieved 88.7% mean F1 across 14 attack types (91.6% excluding Infiltration) on the held-out test set, compared to 57.1% for a standalone Random Forest and 62.8% for the best single-agent LLM configuration. On attack types invisible to the RF (Bot, Infiltration, Web/XSS brute force, SQL Injection), AMATAS provides detection capability where the RF alone would miss attacks entirely.",
    evidence: [
      { title: "Stage 1 Mean F1", metric: "88.7%", detail: "91.6% excluding Infiltration (flow-level limitation)", linkTab: "stage1" },
      { title: "RF Baseline F1", metric: "57.1%", detail: "Standalone Random Forest on same batches", linkTab: "stage1" },
      { title: "Best Single-Agent", metric: "62.8%", detail: "Config A: Zero-shot GPT-4o-mini fallback", linkTab: "mcp" },
      { title: "Attack Types at 80%+ Recall", metric: "12 / 14", detail: "Only HOIC (66%) and Infiltration (34%) below threshold", linkTab: "stage1" },
    ],
  },
  {
    id: "RQ2",
    question: "What is the cost-accuracy trade-off of using LLMs for network intrusion detection, and can a hybrid ML+LLM architecture make it economically viable?",
    shortLabel: "Cost-Accuracy Trade-off",
    verdict: "94.6% cost reduction with zero recall loss",
    verdictColor: "#2563eb",
    answer: "Without the Tier-1 RF pre-filter, analysing all 14,000 Stage 1 flows through the 6-agent LLM pipeline would have cost an estimated $504. The RF pre-filter routes roughly 95% of flows past the LLM stack, reducing the actual test-set cost to $24.75 — a ~95% reduction. The per-flow LLM cost of ~$0.036 is viable for targeted deployment on flagged traffic.",
    evidence: [
      { title: "Without Tier 1", metric: "~$504", detail: "Estimated cost if all 14,000 flows went through LLM pipeline", linkTab: "overview" },
      { title: "With Tier 1", metric: "$24.75", detail: "Actual test-set cost — only ~5% of flows needed LLM analysis", linkTab: "overview" },
      { title: "Cost Reduction", metric: "~95%", detail: "RF filters ~95% of benign flows with zero false negatives on attacks", linkTab: "overview" },
      { title: "Cost per Detection", metric: "$0.04", detail: "Average cost per true positive across all attack types", linkTab: "stage1" },
    ],
  },
  {
    id: "RQ3",
    question: "Does multi-agent LLM reasoning produce qualitatively richer and more faithful explanations than traditional ML feature attribution methods?",
    shortLabel: "Reasoning Quality",
    verdict: "89.8% faithful, qualitatively richer than SHAP",
    verdictColor: "#7c3aed",
    answer: "A faithfulness audit of 6,279 verifiable claims across 758 flows found 89.8% were factually correct. The 10.2% confabulation rate concentrates in TCP flag interpretation (77.6% accurate) and protocol naming (80.6% accurate) — agents infer expected values rather than reading raw numeric features. Compared to SHAP, AMATAS provides causal reasoning ('this is brute force because of repeated short connections to port 22') rather than just feature importance scores.",
    evidence: [
      { title: "Faithfulness Rate", metric: "89.8%", detail: "6,279 claims audited across 758 flows from 14 experiments", linkTab: "faithfulness" },
      { title: "Worst Claim Type", metric: "77.6%", detail: "TCP flag name interpretation — agents confabulate flag meanings", linkTab: "faithfulness" },
      { title: "Best Claim Type", metric: "98.1%", detail: "Port number references — nearly always correct", linkTab: "faithfulness" },
      { title: "SHAP Comparison", metric: "5 flows", detail: "Side-by-side showing AMATAS provides causal reasoning vs feature scores", linkTab: "shap" },
    ],
  },
  {
    id: "RQ4",
    question: "How does detection performance vary across different attack types, and what are the fundamental limitations of flow-level LLM analysis?",
    shortLabel: "Attack-Type Variation",
    verdict: "100% F1 on volumetric / brute-force attacks, 51% F1 on Infiltration — fundamental flow-level limit",
    verdictColor: "#dc2626",
    answer: "Performance varies dramatically: DoS-Slowloris, DDOS-LOIC-UDP, SlowHTTPTest, FTP-BruteForce and SSH-Bruteforce all reached ≥99% F1, while Infiltration (DNS exfiltration) bottomed at 51% F1 / 34% recall — individual exfiltration flows are statistically similar to legitimate DNS queries at the NetFlow feature level. Temporal clustering (v3) partially recovered Infiltration detection to 58% recall by grouping related flows, confirming that context density is the key variable.",
    evidence: [
      { title: "Best Attack Types", metric: "99–100% F1", detail: "FTP/SSH brute force, Slowloris, SlowHTTPTest, LOIC-UDP — distinctive NetFlow signatures", linkTab: "stage1" },
      { title: "Worst Attack Type", metric: "51% F1", detail: "Infiltration — DNS exfiltration flows hard to distinguish from legitimate DNS", linkTab: "stage1" },
      { title: "Clustering Recovery", metric: "58% recall", detail: "v3 temporal clustering lifts Infiltration from 34% to 58% recall", linkTab: "clustering" },
      { title: "DA Ablation Impact", metric: "4.5pp F1 drop", detail: "Removing Devil's Advocate increases FPR — validates adversarial role", linkTab: "ablation" },
    ],
  },
];
