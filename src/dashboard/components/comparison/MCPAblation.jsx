import React from "react";

const heroCards = [
  { label: "A: Zero-Shot", model: "GPT-4o-mini", recall: "90.0%", fpr: "41.4%", f1: "62.8%", cost: "$0.01", border: "#d97706" },
  { label: "B: Engineered Prompt", model: "GPT-4o", recall: "66.7%", fpr: "27.1%", f1: "58.0%", cost: "$0.37", border: "#3b82f6" },
  { label: "C: + MITRE Tool", model: "GPT-4o", recall: "70.0%", fpr: "30.0%", f1: "58.3%", cost: "$0.45", border: "#8b5cf6" },
  { label: "AMATAS v2", model: "GPT-4o (6-agent)", recall: "85%", fpr: "1.1%", f1: "88%", cost: "$2.59/1k", border: "#16a34a" },
];

const tableRows = [
  { config: "A: Zero-Shot", model: "GPT-4o-mini", recall: "90.0%", fpr: "41.4%", precision: "48.2%", f1: "62.8%", tp: 27, fp: 29, fn: 3, tn: 41, cost: "$0.01", bg: "#fffbeb" },
  { config: "B: Engineered", model: "GPT-4o", recall: "66.7%", fpr: "27.1%", precision: "51.3%", f1: "58.0%", tp: 20, fp: 19, fn: 10, tn: 51, cost: "$0.37", bg: "#eff6ff" },
  { config: "C: + MITRE", model: "GPT-4o", recall: "70.0%", fpr: "30.0%", precision: "50.0%", f1: "58.3%", tp: 21, fp: 21, fn: 9, tn: 49, cost: "$0.45", bg: "#f5f3ff" },
];

const f1Bars = [
  { label: "A: Zero-Shot (GPT-4o-mini)", f1: 62.8, color: "#d97706" },
  { label: "B: Engineered Prompt (GPT-4o)", f1: 58.0, color: "#3b82f6" },
  { label: "C: + MITRE Tool (GPT-4o)", f1: 58.3, color: "#8b5cf6" },
  { label: "AMATAS v2 (6-Agent + RF)", f1: 88, color: "#16a34a" },
];

export default function MCPAblation({ s1 }) {
  return (
    <div>
      {/* ── Overview ─────────────────────────────────────────────── */}
      <h2 className="text-xl font-bold mb-2 tracking-tight">MCP Comparison Experiments</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-3xl leading-relaxed">
        Three single-agent configurations tested on the same 100-flow batch (10 FTP + 10 SSH + 10 DoS-Hulk + 70 benign)
        to isolate the impact of prompt engineering and tool access on NIDS performance.
      </p>

      {/* Hero comparison cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {heroCards.map(c => (
          <div key={c.label} className="rounded-lg p-4 bg-white" style={{ border: `2px solid ${c.border}` }}>
            <div className="text-xs font-semibold mb-1" style={{ color: c.border }}>{c.label}</div>
            <div className="text-xs text-gray-400 mb-3">{c.model}</div>
            <div className="text-3xl font-bold text-gray-900 tracking-tight">{c.f1}</div>
            <div className="text-xs text-gray-500 mt-0.5">F1 Score</div>
            <div className="flex justify-between mt-2 text-xs">
              <span className="text-green-600">R: {c.recall}</span>
              <span className="text-red-600">FPR: {c.fpr}</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">{c.cost}</div>
          </div>
        ))}
      </div>

      {/* Key findings */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <div className="text-sm font-semibold mb-3">Key Findings</div>
        <div className="flex flex-col gap-2 text-sm text-gray-700 leading-relaxed">
          <div className="flex gap-2"><span className="text-amber-600 font-semibold flex-shrink-0">1.</span> <span><strong>GPT-4o-mini zero-shot</strong> catches the most attacks (90% recall) but flags everything suspicious — 41% FPR makes it unusable in production.</span></div>
          <div className="flex gap-2"><span className="text-blue-500 font-semibold flex-shrink-0">2.</span> <span><strong>Engineered prompt</strong> reduces FPR to 27% but also cuts recall to 67% — the single-agent precision-recall seesaw in action.</span></div>
          <div className="flex gap-2"><span className="text-violet-500 font-semibold flex-shrink-0">3.</span> <span><strong>MITRE ATT&CK tool</strong> provides marginal +3.3% recall over engineered prompt at +$0.09 cost — minimal uplift validates Phase 1 finding.</span></div>
          <div className="flex gap-2"><span className="text-green-600 font-semibold flex-shrink-0">4.</span> <span><strong>AMATAS multi-agent</strong> breaks through the single-agent ceiling: 88% F1 with only 1.1% FPR — specialised roles + adversarial checking beats any single-agent config.</span></div>
        </div>
      </div>

      {/* Batch info */}
      <div className="text-xs text-gray-400 leading-relaxed mb-8">
        Batch: 100 flows from dev_eval.csv (RF holdout) &middot; 10 FTP-BruteForce + 10 SSH-Bruteforce + 10 DoS-Hulk + 70 Benign &middot; Total cost: $0.83 / $6.00 budget
      </div>

      {/* ── Results Table ────────────────────────────────────────── */}
      <h2 className="text-xl font-bold mb-4 tracking-tight">Per-Config Results</h2>

      <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["Config", "Model", "Recall", "FPR", "Precision", "F1", "TP", "FP", "FN", "TN", "Cost"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-xs text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.map(r => (
              <tr key={r.config} className="border-b border-gray-100" style={{ background: r.bg }}>
                <td className="px-3 py-2.5 font-semibold">{r.config}</td>
                <td className="px-3 py-2.5 text-gray-500">{r.model}</td>
                <td className="px-3 py-2.5 text-green-600 font-medium">{r.recall}</td>
                <td className="px-3 py-2.5 text-red-600">{r.fpr}</td>
                <td className="px-3 py-2.5">{r.precision}</td>
                <td className="px-3 py-2.5 font-semibold">{r.f1}</td>
                <td className="px-3 py-2.5">{r.tp}</td>
                <td className="px-3 py-2.5 text-red-600">{r.fp}</td>
                <td className="px-3 py-2.5 text-red-600">{r.fn}</td>
                <td className="px-3 py-2.5">{r.tn}</td>
                <td className="px-3 py-2.5 text-gray-500">{r.cost}</td>
              </tr>
            ))}
            <tr className="bg-green-50" style={{ borderTop: "2px solid #e5e7eb" }}>
              <td className="px-3 py-2.5 font-bold text-green-800">AMATAS v2</td>
              <td className="px-3 py-2.5 text-gray-500">GPT-4o (6-agent)</td>
              <td className="px-3 py-2.5 text-green-600 font-bold">85%</td>
              <td className="px-3 py-2.5 text-green-600 font-bold">1.1%</td>
              <td className="px-3 py-2.5 font-semibold">97%</td>
              <td className="px-3 py-2.5 font-bold text-green-800">88%</td>
              <td colSpan={4} className="px-3 py-2.5 text-gray-500 text-xs">14,000 flows across 14 attack types</td>
              <td className="px-3 py-2.5 text-gray-500">$27.35</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-400 mb-10">
        All single-agent configs tested on same 100-flow batch. AMATAS v2 results are aggregate across 14 x 1,000-flow Stage 1 experiments.
      </div>

      {/* ── Single-Agent vs Multi-Agent ──────────────────────────── */}
      <h2 className="text-xl font-bold mb-4 tracking-tight">Single-Agent vs Multi-Agent</h2>

      {/* Visual F1 bar chart */}
      <div className="border border-gray-200 rounded-lg p-6 mb-6">
        <div className="text-xs font-semibold text-gray-500 mb-4">F1 Score Comparison</div>
        {f1Bars.map(b => (
          <div key={b.label} className="flex items-center gap-3 mb-2">
            <div className="w-56 text-xs text-gray-700 text-right">{b.label}</div>
            <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full rounded flex items-center justify-end pr-2"
                style={{ width: `${b.f1}%`, background: b.color }}
              >
                <span className="text-xs font-bold text-white">{b.f1}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Thesis argument */}
      <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
        <div className="text-sm font-semibold mb-3">Thesis Argument</div>
        <div className="text-sm text-gray-700 leading-relaxed max-w-3xl">
          <p className="mb-3">
            The MCP comparison demonstrates that <strong>no single-agent configuration can match the multi-agent AMATAS architecture</strong>.
            The best single-agent (Config A: zero-shot GPT-4o-mini) achieves 90% recall but at the cost of 41% FPR — classifying nearly half of benign traffic as suspicious.
            Prompt engineering (Config B) reduces FPR but simultaneously cuts recall, confirming the precision-recall seesaw inherent to single-agent systems.
          </p>
          <p className="mb-3">
            MITRE ATT&CK tooling (Config C) provides only marginal improvement (+3.3% recall, +$0.09 cost) over the engineered prompt alone.
            This validates the Phase 1 finding that <strong>external tools are limited by data quality, not tool quality</strong> — on anonymised synthetic data,
            even comprehensive frameworks like MITRE ATT&CK add little beyond what prompt-encoded attack signatures already provide.
          </p>
          <p>
            AMATAS v2&apos;s 88% F1 with 1.1% FPR is achieved through <strong>specialised analytical roles</strong> (protocol, statistical, behavioural, temporal analysis),
            <strong>adversarial cross-checking</strong> (Devil&apos;s Advocate), and <strong>weighted consensus</strong> (Orchestrator) — capabilities fundamentally unavailable to any single-agent approach.
          </p>
        </div>
      </div>
    </div>
  );
}
