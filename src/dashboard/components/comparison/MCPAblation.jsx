import React, { useState } from "react";
import { MCP_CONFIGS, AMATAS_BASELINE, MCP_TOOL_CATALOG, TOOLS_HURT_NARRATIVE } from "../../data/mcpExtended";

const ALL_CONFIGS = [...MCP_CONFIGS, { ...AMATAS_BASELINE, metrics: AMATAS_BASELINE.metrics, confusion: null }];

const f1Bars = [
  ...MCP_CONFIGS.map(c => ({ label: c.label, f1: c.metrics.f1, color: c.color })),
  { label: "AMATAS v2 (6-Agent + RF)", f1: AMATAS_BASELINE.metrics.f1, color: AMATAS_BASELINE.color },
];

export default function MCPAblation({ s1, onInspectFlows }) {
  const [toolsExpanded, setToolsExpanded] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold mb-2 tracking-tight">MCP Comparison: 7-Configuration Study</h2>
        <p className="text-sm text-gray-500 mb-2 max-w-3xl leading-relaxed">
          Seven single-agent configurations tested on the same 100-flow batch to isolate the impact of prompt engineering,
          tool access, and tool type on NIDS performance. Configs A-C use IP-dependent tools; D-G use dataset-compatible
          tools that work on anonymised data.
        </p>
      </div>

      {/* Hero comparison cards — grouped */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">IP-Dependent Configurations</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {MCP_CONFIGS.filter(c => c.category === "ip-dependent").map(c => (
            <ConfigCard key={c.id} config={c} />
          ))}
        </div>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dataset-Compatible Configurations</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {MCP_CONFIGS.filter(c => c.category === "dataset-compatible").map(c => (
            <ConfigCard key={c.id} config={c} />
          ))}
        </div>

        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Multi-Agent Baseline</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg p-4 bg-white" style={{ border: `2px solid ${AMATAS_BASELINE.color}` }}>
            <div className="text-xs font-semibold mb-1" style={{ color: AMATAS_BASELINE.color }}>{AMATAS_BASELINE.label}</div>
            <div className="text-xs text-gray-400 mb-3">{AMATAS_BASELINE.model}</div>
            <div className="text-3xl font-bold text-gray-900 tracking-tight">{AMATAS_BASELINE.metrics.f1}%</div>
            <div className="text-xs text-gray-500 mt-0.5">F1 Score</div>
            <div className="flex justify-between mt-2 text-xs">
              <span className="text-green-600">R: {AMATAS_BASELINE.metrics.recall}%</span>
              <span className="text-red-600">FPR: {AMATAS_BASELINE.metrics.fpr}%</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">${AMATAS_BASELINE.metrics.cost}/14k flows</div>
          </div>
        </div>
      </div>

      {/* Key Finding: Tools Hurt */}
      <div className="border-2 border-red-300 rounded-lg p-6 bg-red-50">
        <h3 className="text-base font-bold text-red-800 mb-3">{TOOLS_HURT_NARRATIVE.title}</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-white rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-blue-700">{TOOLS_HURT_NARRATIVE.comparison.baseline.f1}%</div>
            <div className="text-[11px] text-gray-600 font-medium">{TOOLS_HURT_NARRATIVE.comparison.baseline.label}</div>
            <div className="text-[10px] text-gray-400">Config {TOOLS_HURT_NARRATIVE.comparison.baseline.config}</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-700">{TOOLS_HURT_NARRATIVE.comparison.worst.f1}%</div>
            <div className="text-[11px] text-gray-600 font-medium">{TOOLS_HURT_NARRATIVE.comparison.worst.label}</div>
            <div className="text-[10px] text-gray-400">Config {TOOLS_HURT_NARRATIVE.comparison.worst.config}</div>
          </div>
          <div className="text-center p-3 bg-white rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-800">{TOOLS_HURT_NARRATIVE.comparison.delta}pp</div>
            <div className="text-[11px] text-gray-600 font-medium">F1 Delta</div>
            <div className="text-[10px] text-gray-400">Tools made it worse</div>
          </div>
        </div>
        <p className="text-sm text-red-900 leading-relaxed">{TOOLS_HURT_NARRATIVE.explanation}</p>
      </div>

      {/* Tool Documentation */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setToolsExpanded(!toolsExpanded)}
          className="w-full px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer text-left"
        >
          <span className="text-sm font-bold text-gray-900">Tool Documentation ({MCP_TOOL_CATALOG.length} tools)</span>
          <span className="text-gray-400 text-sm">{toolsExpanded ? "−" : "+"}</span>
        </button>
        {toolsExpanded && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {["Tool", "Description", "Category", "Works on Anonymised?", "Used In"].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MCP_TOOL_CATALOG.map(t => (
                  <tr key={t.name} className="border-b border-gray-100">
                    <td className="px-3 py-2 font-mono text-[11px]">{t.name}</td>
                    <td className="px-3 py-2 text-gray-600">{t.description}</td>
                    <td className="px-3 py-2 text-gray-500">{t.category}</td>
                    <td className="px-3 py-2">
                      {t.worksOnAnonymized ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">Valid data</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700">Empty on private IPs</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{t.usedIn.length > 0 ? t.usedIn.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Results Table */}
      <div>
        <h3 className="text-base font-bold tracking-tight mb-3">Full 7-Configuration Results</h3>
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Config", "Model", "Tools", "Recall", "FPR", "Precision", "F1", "TP", "FP", "FN", "TN", "Cost"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-xs text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MCP_CONFIGS.map(c => (
                <tr key={c.id} className="border-b border-gray-100" style={{ background: c.bg }}>
                  <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{c.label}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{c.model}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{c.tools.length}</td>
                  <td className="px-3 py-2.5 text-green-600 font-medium">{c.metrics.recall}%</td>
                  <td className="px-3 py-2.5 text-red-600">{c.metrics.fpr}%</td>
                  <td className="px-3 py-2.5">{c.metrics.precision}%</td>
                  <td className="px-3 py-2.5 font-semibold">{c.metrics.f1}%</td>
                  <td className="px-3 py-2.5">{c.confusion.tp}</td>
                  <td className="px-3 py-2.5 text-red-600">{c.confusion.fp}</td>
                  <td className="px-3 py-2.5 text-red-600">{c.confusion.fn}</td>
                  <td className="px-3 py-2.5">{c.confusion.tn}</td>
                  <td className="px-3 py-2.5 text-gray-500">${c.metrics.cost.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-green-50" style={{ borderTop: "2px solid #e5e7eb" }}>
                <td className="px-3 py-2.5 font-bold text-green-800">AMATAS v2</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">GPT-4o (6-agent)</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs">0 (internal)</td>
                <td className="px-3 py-2.5 text-green-600 font-bold">{AMATAS_BASELINE.metrics.recall}%</td>
                <td className="px-3 py-2.5 text-green-600 font-bold">{AMATAS_BASELINE.metrics.fpr}%</td>
                <td className="px-3 py-2.5 font-semibold">{AMATAS_BASELINE.metrics.precision}%</td>
                <td className="px-3 py-2.5 font-bold text-green-800">{AMATAS_BASELINE.metrics.f1}%</td>
                <td colSpan={4} className="px-3 py-2.5 text-gray-500 text-xs">14,000 flows across 14 attack types</td>
                <td className="px-3 py-2.5 text-gray-500">${AMATAS_BASELINE.metrics.cost}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="text-xs text-gray-400 mt-2">
          All single-agent configs tested on same 100-flow batch (10 FTP + 10 SSH + 10 DoS-Hulk + 70 benign). AMATAS v2 results are aggregate across 14 x 1,000-flow Stage 1 experiments.
        </div>
      </div>

      {/* F1 Bar Chart */}
      <div className="border border-gray-200 rounded-lg p-6">
        <div className="text-sm font-semibold text-gray-900 mb-4">F1 Score Comparison (All 8 Configurations)</div>
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

      {/* Flow Inspector links */}
      <div className="border border-gray-200 rounded-lg p-5">
        <div className="text-sm font-semibold mb-3">Inspect Individual Flows</div>
        <div className="flex flex-wrap gap-2">
          {MCP_CONFIGS.map(c => {
            const inspId = `mcp_config_${c.id.toLowerCase()}`;
            return (
              <button
                key={c.id}
                onClick={() => onInspectFlows && onInspectFlows(inspId)}
                className="px-3 py-1.5 rounded-md text-xs font-medium border border-gray-200 bg-white hover:border-gray-300 cursor-pointer transition-colors"
                style={{ color: c.color }}
              >
                Inspect {c.label} flows
              </button>
            );
          })}
        </div>
      </div>

      {/* Thesis argument */}
      <div className="border border-gray-200 rounded-lg p-5 bg-gray-50">
        <div className="text-sm font-semibold mb-3">Thesis Argument</div>
        <div className="text-sm text-gray-700 leading-relaxed max-w-3xl space-y-3">
          <p>
            The 7-configuration MCP comparison demonstrates two things: (1) <strong>no single-agent configuration can match the multi-agent AMATAS architecture</strong>,
            and (2) <strong>adding tools to a single agent actively degrades performance</strong> on this dataset.
          </p>
          <p>
            The best single-agent (Config A: zero-shot GPT-4o-mini) achieves 90% recall but at 41% FPR.
            The best tool-equipped config (E: +DShield) only reaches 46.9% F1.
            Config B with no tools outperforms every tool-equipped variant — prompt-encoded knowledge is more effective
            than real-time tool access when the data is anonymised.
          </p>
          <p>
            AMATAS v2&apos;s 88% F1 with 1.1% FPR is achieved through <strong>specialised analytical roles</strong>,
            <strong> adversarial cross-checking</strong>, and <strong>weighted consensus</strong> — capabilities
            fundamentally unavailable to any single-agent approach, with or without tools.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConfigCard({ config: c }) {
  return (
    <div className="rounded-lg p-4 bg-white" style={{ border: `2px solid ${c.color}` }}>
      <div className="text-xs font-semibold mb-1" style={{ color: c.color }}>{c.label}</div>
      <div className="text-xs text-gray-400 mb-3">{c.model}</div>
      <div className="text-3xl font-bold text-gray-900 tracking-tight">{c.metrics.f1}%</div>
      <div className="text-xs text-gray-500 mt-0.5">F1 Score</div>
      <div className="flex justify-between mt-2 text-xs">
        <span className="text-green-600">R: {c.metrics.recall}%</span>
        <span className="text-red-600">FPR: {c.metrics.fpr}%</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">
        {c.tools.length} tools &middot; ${c.metrics.cost.toFixed(2)}
      </div>
    </div>
  );
}
