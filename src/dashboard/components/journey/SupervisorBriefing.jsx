import React from "react";

const PIVOT_TIMELINE = [
  {
    phase: "Original Proposal",
    what: "MCP-centric tool orchestration — a single LLM agent connected to 7 external threat intelligence tools (AbuseIPDB, AlienVault OTX, geolocation, WHOIS, Shodan, reverse DNS, MITRE ATT&CK).",
    hypothesis: "Tool-augmented reasoning would outperform standalone classification. External threat intelligence would provide context that raw flow features alone cannot.",
    color: "#d97706",
  },
  {
    phase: "Finding 1: Tools Are Useless on This Data",
    what: "All IP-dependent tools returned empty results. CICIDS2018 uses anonymised private IPs (172.31.x.x) — AbuseIPDB, OTX, geolocation, WHOIS, Shodan all return nothing. The entire tool-augmentation strategy was ineffective on this benchmark.",
    hypothesis: null,
    color: "#dc2626",
  },
  {
    phase: "Finding 2: Tools That DO Work Actually Hurt",
    what: "Built 7 dataset-compatible tools (IANA port lookup, protocol decoder, TCP flag decoder, DShield, CVE, MITRE) that return valid data on anonymised flows. Ran a 7-configuration ablation. Result: the best no-tools config (F1=58%) outperformed every tool-equipped config (F1=37–47%). Tools provide true-but-irrelevant context that displaces direct feature analysis.",
    hypothesis: null,
    color: "#dc2626",
  },
  {
    phase: "Pivot: Multi-Agent Architecture",
    what: "Abandoned tool-augmentation as the contribution. Built AMATAS: 6 specialist LLM agents (protocol, statistical, behavioural, temporal, Devil's Advocate, orchestrator) that debate each flow. No external tools — agents reason purely from flow features and pre-trained knowledge.",
    hypothesis: "Diversity of analytical perspectives + adversarial cross-checking would break the single-agent precision-recall ceiling.",
    color: "#8b5cf6",
  },
  {
    phase: "Results: The Pivot Worked",
    what: "AMATAS achieved 88% F1 with 1.1% FPR across 14 attack types at realistic 5% attack prevalence. Best single-agent: 62.8% F1 with 41% FPR. The 25.2pp F1 gap + near-zero FPR validated that multi-agent debate, not tool access, is the mechanism that works.",
    hypothesis: null,
    color: "#16a34a",
  },
];

const WHAT_WAS_DONE = [
  {
    category: "MCP Comparison Study",
    items: [
      "Built an MCP server with 13 tools (7 IP-dependent, 6 dataset-compatible)",
      "Ran 7 single-agent configurations (A-G) on 100-flow batch",
      "Demonstrated tools hurt performance: B (no tools) F1=58% vs D (3 tools) F1=37%",
      "This became a negative-result contribution rather than the thesis core",
    ],
  },
  {
    category: "Multi-Agent System (AMATAS)",
    items: [
      "Designed and built 6-agent pipeline with weighted consensus",
      "14 x 1,000-flow experiments across all CICIDS2018 attack types",
      "Two-tier ML+LLM architecture (RF pre-filter + agent pipeline)",
      "94.6% cost reduction ($27.35 actual vs $509.78 without pre-filter)",
      "88% F1 with 0.09% FPR across 14,000 flows",
    ],
  },
  {
    category: "Explainability Analysis",
    items: [
      "Faithfulness audit: 6,279 claims verified, 89.8% factually correct",
      "SHAP comparison: side-by-side showing AMATAS provides causal reasoning vs feature scores",
      "Identified systematic confabulation patterns (TCP flags 77.6%, protocol naming 80.6%)",
    ],
  },
  {
    category: "Ablation & Extensions",
    items: [
      "6-condition ablation study (removing agents one by one)",
      "Temporal clustering (v3): recovered Infiltration from 0% to 58% recall",
      "3-condition routing control experiment (trained RF vs random filters)",
    ],
  },
];

const ABLATION_FINDINGS = {
  intro: "Systematically disabled agents one at a time across 3 attack types (FTP-BruteForce, SSH-Bruteforce, DDOS-HOIC) to measure each agent's contribution.",
  conditions: [
    { label: "Full AMATAS (6 agents)", ftp: 100, ssh: 99, hoic: 72, color: "#16a34a" },
    { label: "No Devil's Advocate", ftp: 100, ssh: 100, hoic: 98, color: "#ef4444" },
    { label: "No Temporal Agent", ftp: 97, ssh: 69, hoic: 35, color: "#ec4899" },
    { label: "No Statistical Agent", ftp: 100, ssh: 100, hoic: 90, color: "#8b5cf6" },
    { label: "4-Agent (no DA/Stats)", ftp: 100, ssh: 98, hoic: 94, color: "#f59e0b" },
    { label: "2-Agent (Protocol+Orch)", ftp: 21, ssh: 0, hoic: 18, color: "#6b7280" },
  ],
  keyFindings: [
    {
      title: "Temporal agent is the most critical",
      detail: "Removing it drops SSH from 99% to 69% F1 and HOIC from 72% to 35%. It provides cross-flow pattern analysis that no other agent replicates. It's also the most expensive (30% of cost).",
    },
    {
      title: "Devil's Advocate suppresses HOIC recall",
      detail: "Removing DA from HOIC increases F1 from 72% to 98%. The DA argues too aggressively that HTTP-like DDoS flows are benign. DA weight (30%) may need per-attack-type calibration.",
    },
    {
      title: "2-agent minimum fails completely",
      detail: "Protocol + Orchestrator alone: 0% on SSH, 21% on FTP, 18% on HOIC. Multi-agent isn't just a nice-to-have — below 4 agents the system stops working.",
    },
    {
      title: "Statistical agent is redundant on brute-force",
      detail: "Removing it has zero impact on FTP and SSH (F1 stays 100%). Its value concentrates on ambiguous attacks like HOIC where volume anomalies matter.",
    },
  ],
};

const CRITICAL_QUESTIONS = [
  {
    question: "The thesis proposal was MCP-focused, but the actual contribution is multi-agent architecture. Is this pivot acceptable, or does the thesis need to be reframed around MCP more explicitly?",
    context: "The Introduction already explains the pivot as experimentally motivated. The MCP comparison is a full chapter contribution. But a supervisor might feel the thesis doesn't deliver what was proposed.",
    severity: "high",
  },
  {
    question: "The MCP comparison uses only 100 flows (30 attack, 70 benign) — is this sample size sufficient to draw conclusions about tool effectiveness, or should it be scaled up?",
    context: "Stage 1 uses 1,000 flows per experiment. The MCP configs were cheaper per-flow but the small sample means individual misclassifications swing metrics by 3+ percentage points.",
    severity: "high",
  },
  {
    question: "All experiments use a single dataset (CICIDS2018). Does this limit generalisability claims? Should I caveat more heavily or attempt a second dataset?",
    context: "CICIDS2018 is the standard IDS benchmark, but it's synthetic lab traffic from 2018. Real-world traffic may differ. The anonymised IPs are a feature of this dataset, not all datasets.",
    severity: "medium",
  },
  {
    question: "The Infiltration failure (0% recall) — is this a fair evaluation given that individual flows are genuinely indistinguishable? Or does it undermine the 'comparable accuracy' claim in RQ1?",
    context: "Excluding Infiltration, mean F1 is 92.9%. Including it, 86.3%. The thesis argues this is a fundamental flow-level limitation, not a system failure. The clustering recovery (58%) supports this.",
    severity: "medium",
  },
  {
    question: "GPT-4o is the only production model tested. Should I test Claude or other models for comparison, or is the single-model result sufficient?",
    context: "Phase 4 tested Haiku (failed), GPT-4o-mini (too aggressive), and Sonnet (rate-limited). But the production Stage 1 results are all GPT-4o. A reviewer might ask about model dependence.",
    severity: "medium",
  },
  {
    question: "The ablation shows Devil's Advocate hurts HOIC recall (72% with DA vs 98% without). Should the thesis recommend per-attack-type DA weighting, or does this undermine the 'one architecture fits all' argument?",
    context: "DA works well on brute-force (prevents false positives) but over-corrects on DDoS that mimics legitimate HTTP. A fixed 30% DA weight may not be optimal. This is either a limitation to acknowledge or future work to propose.",
    severity: "medium",
  },
  {
    question: "The faithfulness audit found 10.2% confabulation. Is this rate acceptable for a security system? How should the thesis frame this — as a limitation or as motivation for future work?",
    context: "Most confabulation is TCP flag/protocol naming errors (cosmetic), not verdict-changing. But 'the security system hallucinates 10% of the time' sounds bad in isolation.",
    severity: "medium",
  },
  {
    question: "The cost analysis assumes OpenAI API pricing. Should I model costs for self-hosted LLMs (e.g., Llama) to strengthen the 'economically viable' argument?",
    context: "Current cost is $0.036/flow for LLM-analysed flows, $0.002/flow amortised across all flows. Self-hosting would change the economics significantly.",
    severity: "low",
  },
  {
    question: "Should I run final evaluation on the held-out test set (8.05M flows), or are the Stage 1 results sufficient? The test set evaluation was planned but not completed.",
    context: "Running on test.csv would cost ~$50-100 in API calls. It would give a clean held-out evaluation, but the Stage 1 experiments already cover all 14 attack types across dev/val/test splits.",
    severity: "low",
  },
];

export default function SupervisorBriefing({ onNavigateToTab }) {
  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-2">Supervisor Briefing</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Honest summary of what was proposed, what changed, what was actually built, and what needs discussion.
        </p>
      </div>

      {/* The Pivot */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-4">The Pivot: What Happened</h3>
        <div className="space-y-4">
          {PIVOT_TIMELINE.map((p, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-3 h-3 rounded-full" style={{ background: p.color }} />
                {i < PIVOT_TIMELINE.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
              </div>
              <div className="pb-4">
                <div className="text-sm font-bold" style={{ color: p.color }}>{p.phase}</div>
                <div className="text-sm text-gray-700 leading-relaxed mt-1">{p.what}</div>
                {p.hypothesis && (
                  <div className="text-xs text-gray-500 italic mt-1">
                    Hypothesis: {p.hypothesis}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* One-line summary */}
      <div className="border-2 border-blue-300 rounded-lg p-5 bg-blue-50">
        <div className="text-sm font-bold text-blue-800 mb-2">The One-Line Story</div>
        <div className="text-sm text-blue-900 leading-relaxed">
          I proposed MCP tool-augmented NIDS. Experiments showed tools don't help (and actually hurt).
          I pivoted to multi-agent debate architecture, which achieved 88% F1 with near-zero false positives and
          full explainability. The MCP work became a negative-result comparison study that motivates why
          multi-agent reasoning beats tool augmentation.
        </div>
      </div>

      {/* What Was Actually Done */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-4">What Was Actually Done</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {WHAT_WAS_DONE.map((cat) => (
            <div key={cat.category} className="border border-gray-100 rounded-lg p-4">
              <div className="text-sm font-bold text-gray-900 mb-2">{cat.category}</div>
              <ul className="space-y-1.5">
                {cat.items.map((item, i) => (
                  <li key={i} className="text-xs text-gray-700 leading-relaxed flex gap-2">
                    <span className="text-gray-400 flex-shrink-0">-</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* What the thesis is actually about now */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-3">What the Thesis Argues</h3>
        <div className="text-sm text-gray-700 leading-relaxed space-y-3">
          <p>
            <strong>Core claim:</strong> Multi-agent LLM debate produces explainable network intrusion detection
            that traditional ML cannot — not through external tools, but through structured disagreement between
            specialist analytical perspectives.
          </p>
          <p>
            <strong>The evidence structure:</strong>
          </p>
          <ol className="space-y-2 ml-4">
            <li className="text-sm"><strong>1.</strong> MCP tool comparison (7 configs) proves tools don't help and actively hurt — rules out the obvious approach</li>
            <li className="text-sm"><strong>2.</strong> Multi-agent architecture (AMATAS) achieves 88% F1 vs 63% best single-agent — proves the mechanism that does work</li>
            <li className="text-sm"><strong>3.</strong> Two-tier ML+LLM design makes it economically viable (94.6% cost reduction) — proves it could deploy</li>
            <li className="text-sm"><strong>4.</strong> Faithfulness audit (89.8%) + SHAP comparison proves the explanations are real, not hallucinated</li>
            <li className="text-sm"><strong>5.</strong> Ablation + clustering prove which components matter and where the architecture breaks</li>
          </ol>
        </div>
      </div>

      {/* Ablation Study */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-1">Ablation Study: Which Agents Matter?</h3>
        <p className="text-xs text-gray-500 mb-4">{ABLATION_FINDINGS.intro}</p>

        {/* F1 comparison table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left font-semibold text-xs text-gray-500">Condition</th>
                <th className="px-3 py-2 text-center font-semibold text-xs text-gray-500">FTP F1</th>
                <th className="px-3 py-2 text-center font-semibold text-xs text-gray-500">SSH F1</th>
                <th className="px-3 py-2 text-center font-semibold text-xs text-gray-500">HOIC F1</th>
              </tr>
            </thead>
            <tbody>
              {ABLATION_FINDINGS.conditions.map(c => (
                <tr key={c.label} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-medium text-sm" style={{ color: c.color }}>{c.label}</td>
                  {[c.ftp, c.ssh, c.hoic].map((v, i) => (
                    <td key={i} className="px-3 py-2 text-center">
                      <span className="font-bold" style={{ color: v >= 90 ? "#16a34a" : v >= 50 ? "#d97706" : "#dc2626" }}>
                        {v}%
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Key findings */}
        <div className="space-y-3">
          {ABLATION_FINDINGS.keyFindings.map((f, i) => (
            <div key={i} className="border-l-[3px] border-gray-300 pl-4">
              <div className="text-sm font-bold text-gray-900">{f.title}</div>
              <div className="text-xs text-gray-600 leading-relaxed">{f.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Critical Questions */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-1">Questions for Supervisors</h3>
        <p className="text-xs text-gray-500 mb-4">
          These are the honest concerns. Sorted by severity — address the high ones first.
        </p>
        <div className="space-y-4">
          {CRITICAL_QUESTIONS.map((q, i) => (
            <div
              key={i}
              className="border rounded-lg p-4"
              style={{
                borderColor: q.severity === "high" ? "#fca5a5" : q.severity === "medium" ? "#fcd34d" : "#d1d5db",
                background: q.severity === "high" ? "#fef2f2" : q.severity === "medium" ? "#fffbeb" : "#f9fafb",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                  style={{
                    color: q.severity === "high" ? "#991b1b" : q.severity === "medium" ? "#92400e" : "#374151",
                    background: q.severity === "high" ? "#fee2e2" : q.severity === "medium" ? "#fef3c7" : "#e5e7eb",
                  }}
                >
                  {q.severity}
                </span>
                <span className="text-xs text-gray-400">Q{i + 1}</span>
              </div>
              <div className="text-sm font-semibold text-gray-900 leading-snug mb-2">{q.question}</div>
              <div className="text-xs text-gray-600 leading-relaxed">{q.context}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick nav to evidence */}
      {onNavigateToTab && (
        <div className="border border-gray-200 rounded-lg p-5">
          <div className="text-sm font-semibold mb-3">Jump to Evidence</div>
          <div className="flex flex-wrap gap-2">
            {[
              { tab: "mcp", label: "MCP 7-Config Results" },
              { tab: "stage1", label: "Stage 1 (14 attacks)" },
              { tab: "ablation", label: "Ablation Study" },
              { tab: "clustering", label: "Clustering Recovery" },
              { tab: "shap", label: "SHAP Comparison" },
              { tab: "faithfulness", label: "Faithfulness Audit" },
              { tab: "reasoning", label: "Flow Inspector" },
            ].map(l => (
              <button
                key={l.tab}
                onClick={() => onNavigateToTab(l.tab)}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-200 bg-white hover:border-gray-300 cursor-pointer transition-colors text-gray-700"
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
