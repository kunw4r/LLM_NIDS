import React, { useState } from "react";
import { SHAP_FLOWS } from "../../data/shapComparison";

const AGENT_COLORS = {
  Protocol: "#3b82f6",
  Statistical: "#8b5cf6",
  Behavioural: "#f59e0b",
  Temporal: "#ec4899",
  "Devil's Advocate": "#ef4444",
};

const VERDICT_STYLE = {
  MALICIOUS: { bg: "#fef2f2", color: "#dc2626" },
  SUSPICIOUS: { bg: "#fffbeb", color: "#d97706" },
  BENIGN: { bg: "#f0fdf4", color: "#16a34a" },
};

function getVerdictStyle(v) {
  if (v.includes("MALICIOUS")) return VERDICT_STYLE.MALICIOUS;
  if (v.includes("SUSPICIOUS")) return VERDICT_STYLE.SUSPICIOUS;
  return VERDICT_STYLE.BENIGN;
}

export default function SHAPComparison() {
  const [selectedIdx, setSelectedIdx] = useState(3); // Bot highlighted by default

  const flow = SHAP_FLOWS[selectedIdx];
  const maxShap = Math.max(...flow.shap_top5.map(s => Math.abs(s.shap_value)));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-2">SHAP vs AMATAS: Explainability Comparison</h2>
        <p className="text-sm text-gray-500 leading-relaxed max-w-3xl">
          SHAP (SHapley Additive exPlanations) shows which features the Random Forest relied on.
          AMATAS agents explain <strong>why</strong> those features matter and what they mean in context.
          Select a flow to compare both explanations side by side.
        </p>
      </div>

      {/* Flow selector */}
      <div className="flex flex-wrap gap-2">
        {SHAP_FLOWS.map((f, i) => (
          <button
            key={i}
            onClick={() => setSelectedIdx(i)}
            className="px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer transition-colors"
            style={{
              background: i === selectedIdx ? (f.highlight ? "#fef3c7" : "#eff6ff") : "white",
              borderColor: i === selectedIdx ? (f.highlight ? "#d97706" : "#3b82f6") : "#e5e7eb",
              color: i === selectedIdx ? (f.highlight ? "#92400e" : "#1d4ed8") : "#6b7280",
            }}
          >
            {f.attack_type}
            {f.highlight && <span className="ml-1 text-amber-600">*</span>}
          </button>
        ))}
      </div>

      {/* Highlight callout for Bot flow */}
      {flow.highlight && (
        <div className="border-2 border-amber-400 rounded-lg p-4 bg-amber-50">
          <div className="text-sm font-bold text-amber-800 mb-1">Key Finding</div>
          <div className="text-sm text-amber-900">{flow.highlightReason}</div>
        </div>
      )}

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SHAP side */}
        <div className="border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-sm font-bold text-gray-900">SHAP Feature Attribution</div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Random Forest</span>
          </div>

          <div className="mb-3 text-xs text-gray-500">
            RF prediction: <span className="font-semibold">{flow.rf_attack_prob >= 0.5 ? "ATTACK" : "BENIGN"}</span> ({(flow.rf_attack_prob * 100).toFixed(1)}% attack probability)
          </div>

          <div className="space-y-2 mb-4">
            {flow.shap_top5.map((s, i) => {
              const pct = Math.abs(s.shap_value) / maxShap * 100;
              const isPositive = s.shap_value > 0;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-32 text-xs text-gray-600 text-right font-mono">{s.feature}</div>
                  <div className="flex-1 h-5 bg-gray-50 rounded relative overflow-hidden">
                    <div
                      className="h-full rounded flex items-center px-1"
                      style={{
                        width: `${Math.max(pct, 8)}%`,
                        background: isPositive ? "#ef4444" : "#3b82f6",
                        justifyContent: "flex-end",
                      }}
                    >
                      <span className="text-[10px] font-bold text-white">{s.shap_value > 0 ? "+" : ""}{s.shap_value.toFixed(3)}</span>
                    </div>
                  </div>
                  <div className="w-14 text-[10px] text-gray-400 text-right">{s.actual_value}</div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-[10px] text-gray-400 mb-3">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> Pushes toward ATTACK</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" /> Pushes toward BENIGN</span>
          </div>

          <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded p-3">
            {flow.shap_interpretation}
          </div>
        </div>

        {/* AMATAS side */}
        <div className="border border-gray-200 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="text-sm font-bold text-gray-900">AMATAS Agent Reasoning</div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">6-Agent Pipeline</span>
          </div>

          <div className="mb-3 text-xs text-gray-500">
            AMATAS verdict: <span className="font-semibold">{flow.amatas_verdict}</span>
          </div>

          <div className="space-y-2 mb-4">
            {flow.agents.map((a, i) => {
              const vs = getVerdictStyle(a.verdict);
              return (
                <div key={i} className="border border-gray-100 rounded-md p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: AGENT_COLORS[a.agent] || "#6b7280" }} />
                    <span className="text-xs font-semibold text-gray-700">{a.agent}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: vs.bg, color: vs.color }}>
                      {a.verdict}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-600 leading-relaxed pl-4">{a.excerpt}</div>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-gray-600 leading-relaxed bg-green-50 rounded p-3 border border-green-100">
            {flow.amatas_interpretation}
          </div>
        </div>
      </div>

      {/* Bottom insight */}
      <div className="border border-violet-200 rounded-lg p-5 bg-violet-50">
        <div className="text-sm font-bold text-violet-800 mb-2">The Explainability Gap</div>
        <div className="text-sm text-violet-900 leading-relaxed space-y-2">
          <p>
            <strong>SHAP tells you WHICH features mattered.</strong> It assigns importance scores to input features —
            useful for model debugging but not for understanding the threat.
          </p>
          <p>
            <strong>AMATAS tells you WHY those features matter.</strong> It provides causal reasoning: "this is brute force
            because of repeated short connections to port 22" rather than just "port 22 has a high SHAP value."
            Agent disagreements make the uncertainty visible — when Protocol says BENIGN but Temporal says MALICIOUS,
            the explanation surface is richer than any single score.
          </p>
        </div>
      </div>
    </div>
  );
}
