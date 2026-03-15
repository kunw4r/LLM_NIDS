// Research Questions with evidence links

export const RESEARCH_QUESTIONS = [
  {
    id: "RQ1",
    question: "Can a multi-agent LLM system achieve comparable detection accuracy to traditional ML classifiers on realistic network traffic?",
    shortLabel: "Detection Accuracy",
    verdict: "Comparable on most attacks, superior on RF-invisible types",
    verdictColor: "#16a34a",
    answer: "AMATAS v2 achieved 86.3% mean F1 across 14 attack types (92.9% excluding Infiltration), compared to 57.1% for a standalone Random Forest and 62.8% for the best single-agent LLM configuration. On attack types invisible to the RF (Bot, Infiltration, Web/XSS brute force, SQL Injection), AMATAS provides detection capability where the RF alone would miss attacks entirely.",
    evidence: [
      { title: "Stage 1 Mean F1", metric: "86.3%", detail: "92.9% excluding Infiltration (flow-level limitation)", linkTab: "stage1" },
      { title: "RF Baseline F1", metric: "57.1%", detail: "Standalone Random Forest on same batches", linkTab: "stage1" },
      { title: "Best Single-Agent", metric: "62.8%", detail: "Config A: Zero-shot GPT-4o-mini", linkTab: "mcp" },
      { title: "Attack Types at 82%+ Recall", metric: "12 / 14", detail: "Only HOIC (58%) and Infiltration (0%) below threshold", linkTab: "stage1" },
    ],
  },
  {
    id: "RQ2",
    question: "What is the cost-accuracy trade-off of using LLMs for network intrusion detection, and can a hybrid ML+LLM architecture make it economically viable?",
    shortLabel: "Cost-Accuracy Trade-off",
    verdict: "94.6% cost reduction with zero recall loss",
    verdictColor: "#2563eb",
    answer: "Without the Tier-1 RF pre-filter, analysing all 14,000 Stage 1 flows through the 6-agent LLM pipeline would have cost an estimated $509.78. The RF pre-filter classified 94.6% of flows as benign (all correctly), reducing the actual cost to $27.35 — a 94.6% reduction. The per-flow LLM cost of $0.036 is viable for targeted deployment on flagged traffic.",
    evidence: [
      { title: "Without Tier 1", metric: "$509.78", detail: "Estimated cost if all 14,000 flows went through LLM pipeline", linkTab: "overview" },
      { title: "With Tier 1", metric: "$27.35", detail: "Actual cost — only 758 flows (5.4%) needed LLM analysis", linkTab: "overview" },
      { title: "Cost Reduction", metric: "94.6%", detail: "RF filters 13,242 of 14,000 flows with zero false negatives", linkTab: "overview" },
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
    verdict: "100% F1 on brute-force, 0% on Infiltration — fundamental flow-level limit",
    verdictColor: "#dc2626",
    answer: "Performance varies dramatically: FTP-BruteForce, SSH-Bruteforce, DoS-SlowHTTPTest, and DoS-Slowloris all achieved 100% F1, while Infiltration (DNS exfiltration) achieved 0% — individual exfiltration flows are statistically identical to legitimate DNS queries at the NetFlow feature level. Temporal clustering (v3) partially recovered Infiltration detection to 58% recall by grouping related flows, confirming that context density is the key variable.",
    evidence: [
      { title: "Best Attack Types", metric: "100% F1", detail: "FTP-BruteForce, SSH-Bruteforce, SlowHTTPTest, Slowloris — distinctive NetFlow signatures", linkTab: "stage1" },
      { title: "Worst Attack Type", metric: "0% F1", detail: "Infiltration — DNS exfiltration flows indistinguishable from legitimate DNS", linkTab: "stage1" },
      { title: "Clustering Recovery", metric: "58% recall", detail: "v3 temporal clustering recovered Infiltration from 0% to 58%", linkTab: "clustering" },
      { title: "DA Ablation Impact", metric: "4.5pp F1 drop", detail: "Removing Devil's Advocate increases FPR — validates adversarial role", linkTab: "ablation" },
    ],
  },
];
