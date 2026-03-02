import React, { useState } from "react";
import { AGENTS } from "../../data/agents";
import { AGENT_KEYS } from "../../data/constants";
import { AGENT_COST_DATA } from "../../data/stage1";
import { verdictColor, verdictBg, isCorrect } from "../../lib/format";
import AgentCard from "../inspector/AgentCard";

/**
 * Selects showcase flows: 1 best TP, 1 FN (if exists), 1 TN from LLM (if exists).
 */
function selectShowcaseFlows(flows) {
  if (!flows || flows.length === 0) return [];

  const llmFlows = flows.filter(f => !f.tier1_filtered);
  const tps = llmFlows.filter(f => f.label_actual === 1 && (f.verdict || "").toUpperCase() !== "BENIGN");
  const fns = llmFlows.filter(f => f.label_actual === 1 && (f.verdict || "").toUpperCase() === "BENIGN");
  const tns = llmFlows.filter(f => f.label_actual === 0 && (f.verdict || "").toUpperCase() === "BENIGN");

  const result = [];

  // Best TP — highest consensus score
  if (tps.length > 0) {
    const best = [...tps].sort((a, b) => (b.consensus_score || 0) - (a.consensus_score || 0))[0];
    result.push({ flow: best, type: "tp", label: "True Positive — System Working" });
  }

  // FN where DA had high benign confidence
  if (fns.length > 0) {
    const daFn = [...fns].sort((a, b) => {
      const aConf = a.devils_advocate?.confidence_benign || a.devils_advocate?.confidence || 0;
      const bConf = b.devils_advocate?.confidence_benign || b.devils_advocate?.confidence || 0;
      return bConf - aConf;
    })[0];
    result.push({ flow: daFn, type: "fn", label: "False Negative — Missed Attack" });
  }

  // TN from LLM-analyzed benign
  if (tns.length > 0) {
    const best = tns[0];
    result.push({ flow: best, type: "tn", label: "True Negative — Correctly Cleared" });
  }

  return result;
}

function DecisionTimeline({ flow }) {
  if (!flow || flow.tier1_filtered) return null;

  const specialists = ["protocol", "statistical", "behavioural", "temporal"];
  const colors = {
    MALICIOUS: "#dc2626", SUSPICIOUS: "#d97706", BENIGN: "#16a34a",
  };

  const steps = [];

  // Tier 1 pass
  if (flow.tier1_probability != null) {
    steps.push({
      label: "Tier 1",
      detail: `P(attack)=${(flow.tier1_probability * 100).toFixed(0)}%`,
      color: "#2563eb",
      bg: "#eff6ff",
    });
  }

  // Specialists
  specialists.forEach(id => {
    const r = flow.specialist_results?.[id];
    if (!r) return;
    const v = (r.verdict || "").toUpperCase();
    const finding = (r.key_findings || r.key_evidence || [])[0];
    steps.push({
      label: AGENT_COST_DATA[id]?.label || id,
      detail: `${v} (${((r.confidence || 0) * 100).toFixed(0)}%)`,
      sub: finding ? (typeof finding === "string" ? finding.slice(0, 60) : "") : "",
      color: colors[v] || "#6b7280",
      bg: verdictBg(v) || "#f9fafb",
    });
  });

  // DA
  const da = flow.devils_advocate;
  if (da) {
    const conf = da.confidence_benign || da.confidence || 0;
    steps.push({
      label: "Devil's Advocate",
      detail: `Benign ${(conf * 100).toFixed(0)}%`,
      sub: da.strongest_benign_indicator ? da.strongest_benign_indicator.slice(0, 60) : "",
      color: "#ef4444",
      bg: "#fef2f2",
    });
  }

  // Orchestrator
  const ov = (flow.verdict || "").toUpperCase();
  steps.push({
    label: "Orchestrator",
    detail: `${ov} (${((flow.confidence || 0) * 100).toFixed(0)}%)`,
    sub: flow.consensus_score ? `Consensus: ${(flow.consensus_score * 100).toFixed(0)}%` : "",
    color: colors[ov] || "#6b7280",
    bg: verdictBg(ov) || "#f9fafb",
    bold: true,
  });

  return (
    <div className="flex gap-1 items-stretch overflow-x-auto pb-1 -mx-1 px-1">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div className="flex items-center text-gray-300 text-xs flex-shrink-0">&rarr;</div>}
          <div
            className="rounded-md px-2.5 py-1.5 text-center flex-shrink-0 min-w-[90px]"
            style={{ background: s.bg, border: s.bold ? `2px solid ${s.color}` : `1px solid ${s.color}30` }}
          >
            <div className="text-[10px] font-semibold" style={{ color: s.color }}>{s.label}</div>
            <div className={`text-[11px] ${s.bold ? "font-bold" : "font-medium"}`} style={{ color: s.color }}>{s.detail}</div>
            {s.sub && <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">{s.sub}</div>}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export default function ReasoningShowcase({ flows }) {
  const [expandedPrompts, setExpandedPrompts] = useState({});

  const showcaseFlows = selectShowcaseFlows(flows);

  if (showcaseFlows.length === 0) return null;

  const typeBorder = { tp: "#16a34a", fn: "#dc2626", tn: "#2563eb" };
  const typeBg = { tp: "#f0fdf4", fn: "#fef2f2", tn: "#eff6ff" };

  return (
    <div className="mb-5">
      <div className="text-sm font-bold mb-1">Example Analysis Chains</div>
      <p className="text-xs text-gray-500 mb-4">
        Full agent reasoning for representative flows — the explainability centerpiece of AMATAS.
      </p>

      {showcaseFlows.map(({ flow, type, label }, idx) => (
        <div
          key={flow.flow_idx}
          className="border rounded-lg mb-4 overflow-hidden"
          style={{ borderColor: typeBorder[type] }}
        >
          {/* Header */}
          <div
            className="px-4 py-2.5 flex justify-between items-center"
            style={{ background: typeBg[type] }}
          >
            <div>
              <span className="text-xs font-bold" style={{ color: typeBorder[type] }}>{label}</span>
              <span className="text-xs text-gray-500 ml-2">Flow #{flow.flow_idx}</span>
              <span className="text-xs text-gray-400 ml-2">
                Actual: {flow.label_actual === 1 ? (flow.attack_type_actual || "Attack") : "Benign"}
              </span>
            </div>
            <span
              className="px-2 py-0.5 rounded text-[11px] font-semibold"
              style={{ color: verdictColor(flow.verdict), background: verdictBg(flow.verdict) }}
            >
              {flow.verdict} {flow.confidence != null ? `${(flow.confidence * 100).toFixed(0)}%` : ""}
            </span>
          </div>

          <div className="px-4 py-3">
            {/* Decision timeline */}
            <DecisionTimeline flow={flow} />

            {/* Agent reasoning cards */}
            {flow.specialist_results && Object.keys(flow.specialist_results).length > 0 && (
              <details className="mt-3">
                <summary className="text-xs font-semibold text-blue-600 cursor-pointer mb-2">
                  Show full agent reasoning ({Object.keys(flow.specialist_results).length} specialists + DA + Orchestrator)
                </summary>
                <div className="flex flex-col gap-2">
                  {AGENTS.filter(a => a.id !== "orchestrator" && a.id !== "devils_advocate").map(agent => {
                    const result = flow.specialist_results?.[agent.id];
                    if (!result) return null;
                    return (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        result={result}
                        expandedPrompts={expandedPrompts}
                        setExpandedPrompts={setExpandedPrompts}
                        prefix={`showcase_${idx}`}
                      />
                    );
                  })}

                  {/* DA summary */}
                  {flow.devils_advocate && (
                    <div className="border border-red-300 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-red-600">Devil's Advocate</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-green-600 bg-green-50">
                          BENIGN {((flow.devils_advocate.confidence_benign || flow.devils_advocate.confidence || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      {flow.devils_advocate.counter_argument && (
                        <p className="text-xs text-gray-700 leading-relaxed m-0 whitespace-pre-wrap">
                          {flow.devils_advocate.counter_argument}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Orchestrator */}
                  {flow.reasoning && flow.reasoning !== "Tier 1 RF pre-filter: classified as obviously benign" && (
                    <div className="border-2 border-emerald-500 rounded-lg p-3 bg-green-50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-emerald-600">Orchestrator — Final Verdict</span>
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-semibold"
                          style={{ color: verdictColor(flow.verdict), background: verdictBg(flow.verdict) }}
                        >
                          {flow.verdict}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed m-0 whitespace-pre-wrap">
                        {flow.reasoning}
                      </p>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
