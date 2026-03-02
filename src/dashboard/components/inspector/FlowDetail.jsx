import React from "react";
import { AGENTS } from "../../data/agents";
import { AGENT_COST_DATA } from "../../data/stage1";
import { AGENT_KEYS } from "../../data/constants";
import { verdictColor, verdictBg, correctColor, isCorrect } from "../../lib/format";
import AgentCard from "./AgentCard";

export default function FlowDetail({ flow, expandedPrompts, setExpandedPrompts }) {
  const correct = isCorrect(flow);

  return (
    <div className="border border-gray-200 rounded-lg p-3 sm:p-5 max-h-none lg:max-h-[70vh] overflow-y-auto">
      {/* Header */}
      <div className="mb-4">
        <div className="flex justify-between items-baseline">
          <h3 className="text-base font-bold m-0">Flow #{flow.flow_idx}</h3>
        </div>
        <div className="text-sm text-gray-500 mt-1">
          Actual:{" "}
          <strong style={{ color: flow.label_actual === 1 ? "#dc2626" : "#16a34a" }}>
            {flow.attack_type_actual || "Benign"} ({flow.label_actual === 1 ? "ATTACK" : "BENIGN"})
          </strong>
        </div>
        <div className="text-sm mt-1">
          Final Verdict:{" "}
          <strong style={{ color: verdictColor(flow.verdict) }}>{flow.verdict}</strong>
          <span className="ml-2 font-semibold" style={{ color: correctColor(correct) }}>
            {correct ? "Correct" : "Incorrect"}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          Confidence: {flow.confidence != null ? `${(flow.confidence * 100).toFixed(0)}%` : "N/A"}
          {flow.cost_usd > 0 && <span> &middot; Cost: ${flow.cost_usd.toFixed(4)}</span>}
          {flow.time_seconds > 0 && <span> &middot; {flow.time_seconds.toFixed(1)}s</span>}
        </div>

        {/* Per-flow agent cost mini bar */}
        {flow.agent_costs && Object.keys(flow.agent_costs).length > 0 && (() => {
          const ac = flow.agent_costs;
          const total = Object.values(ac).reduce((s, v) => s + v, 0);
          if (total === 0) return null;
          return (
            <div className="mt-2">
              <div className="flex h-2.5 rounded-sm overflow-hidden">
                {AGENT_KEYS.map(a => ac[a] ? (
                  <div
                    key={a}
                    style={{ width: `${(ac[a] / total) * 100}%`, background: AGENT_COST_DATA[a].color }}
                    title={`${AGENT_COST_DATA[a].label}: $${ac[a].toFixed(4)} (${(ac[a] / total * 100).toFixed(0)}%)`}
                  />
                ) : null)}
              </div>
              <div className="flex gap-2 mt-1 flex-wrap">
                {AGENT_KEYS.filter(a => ac[a]).sort((a, b) => (ac[b] || 0) - (ac[a] || 0)).map(a => (
                  <span key={a} className="text-[9px] text-gray-400 flex items-center gap-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-sm inline-block"
                      style={{ background: AGENT_COST_DATA[a].color }}
                    />
                    {AGENT_COST_DATA[a].label} ${ac[a].toFixed(4)}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* NetFlow features */}
      {flow.flow_features && Object.keys(flow.flow_features).length > 0 && (
        <details className="border border-gray-200 rounded-lg mb-3 overflow-hidden">
          <summary className="px-3.5 py-2.5 cursor-pointer text-xs font-semibold text-gray-500 bg-gray-50">
            NetFlow Features ({Object.keys(flow.flow_features).length} fields)
          </summary>
          <div className="px-3.5 py-2">
            <table className="w-full border-collapse text-[11px]">
              <tbody>
                {Object.entries(flow.flow_features).map(([key, val]) => (
                  <tr key={key} className="border-b border-gray-100">
                    <td className="py-1 pr-2 text-gray-500 font-medium whitespace-nowrap">{key}</td>
                    <td className="py-1 font-mono text-gray-700">
                      {typeof val === "number" ? val.toLocaleString() : String(val)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Tier 1 filtered */}
      {flow.tier1_filtered && (
        <div className="border border-gray-300 rounded-lg p-4 bg-green-50 text-sm leading-relaxed">
          <div className="font-semibold text-green-600 mb-1">Filtered by Tier 1 RF</div>
          <div className="text-gray-700">
            Auto-classified benign (confidence: {(flow.confidence * 100).toFixed(1)}%) — LLM not consulted.
            The Random Forest pre-filter determined this flow's P(attack) was below the 0.15 threshold.
          </div>
        </div>
      )}

      {/* Agent cards */}
      {!flow.tier1_filtered && flow.specialist_results && Object.keys(flow.specialist_results).length > 0 && (
        <div className="flex flex-col gap-3">
          {/* 4 specialist agents */}
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
                prefix="flow"
              />
            );
          })}

          {/* Devil's Advocate */}
          {flow.devils_advocate && (flow.devils_advocate.confidence_benign > 0 || flow.devils_advocate.confidence > 0 || flow.devils_advocate.counter_argument) && (
            <div className="border border-red-300 rounded-lg p-3.5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-red-600 uppercase">
                  Devil's Advocate
                  <button
                    onClick={() => setExpandedPrompts(prev => ({ ...prev, flow_devils_advocate: !prev.flow_devils_advocate }))}
                    className="bg-transparent border-none p-0 text-[10px] text-red-500 cursor-pointer font-semibold ml-2 lowercase"
                  >
                    {expandedPrompts.flow_devils_advocate ? "hide prompt" : "view prompt"}
                  </button>
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold text-green-600 bg-green-50">
                  BENIGN {((flow.devils_advocate.confidence_benign || flow.devils_advocate.confidence || 0) * 100).toFixed(0)}%
                </span>
              </div>

              {expandedPrompts.flow_devils_advocate && (
                <pre className="mb-2 p-2.5 bg-red-50 border border-red-200 rounded-md text-[10px] leading-relaxed whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto text-gray-700 font-mono">
                  {AGENTS.find(a => a.id === "devils_advocate")?.prompt}
                </pre>
              )}

              {(flow.devils_advocate.counter_argument || flow.devils_advocate.benign_argument) && (
                <div className="mb-2">
                  <div className="text-[11px] font-semibold text-gray-500 mb-1">Counter-Argument</div>
                  <p className="text-xs text-gray-700 leading-relaxed m-0 whitespace-pre-wrap">
                    {flow.devils_advocate.counter_argument || flow.devils_advocate.benign_argument}
                  </p>
                </div>
              )}

              {flow.devils_advocate.strongest_benign_indicator && (
                <div className="mb-2">
                  <div className="text-[11px] font-semibold text-gray-500 mb-1">Strongest Benign Indicator</div>
                  <p className="text-xs text-gray-700 leading-normal m-0">
                    {flow.devils_advocate.strongest_benign_indicator}
                  </p>
                </div>
              )}

              {flow.devils_advocate.alternative_explanations && flow.devils_advocate.alternative_explanations.length > 0 && (
                <div className="mb-1">
                  <div className="text-[11px] font-semibold text-gray-500 mb-1">Alternative Explanations</div>
                  <ul className="m-0 pl-4">
                    {flow.devils_advocate.alternative_explanations.map((alt, i) => (
                      <li key={i} className="text-xs text-gray-700 leading-normal">{alt}</li>
                    ))}
                  </ul>
                </div>
              )}

              {flow.devils_advocate.weaknesses_in_malicious_case && flow.devils_advocate.weaknesses_in_malicious_case.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-gray-500 mb-1">Weaknesses in Malicious Case</div>
                  <ul className="m-0 pl-4">
                    {flow.devils_advocate.weaknesses_in_malicious_case.map((w, i) => (
                      <li key={i} className="text-xs text-gray-700 leading-normal">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Orchestrator */}
          {flow.reasoning && flow.reasoning !== "Tier 1 RF pre-filter: classified as obviously benign" && (
            <div className="border-2 border-emerald-500 rounded-lg p-3.5 bg-green-50">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-emerald-500 uppercase">
                  Orchestrator — Final Verdict
                  <button
                    onClick={() => setExpandedPrompts(prev => ({ ...prev, flow_orchestrator: !prev.flow_orchestrator }))}
                    className="bg-transparent border-none p-0 text-[10px] text-emerald-500 cursor-pointer font-semibold ml-2 lowercase"
                  >
                    {expandedPrompts.flow_orchestrator ? "hide prompt" : "view prompt"}
                  </button>
                </span>
                <span
                  className="px-2 py-0.5 rounded text-[11px] font-semibold"
                  style={{ color: verdictColor(flow.verdict), background: verdictBg(flow.verdict) }}
                >
                  {flow.verdict} {flow.confidence != null ? `${(flow.confidence * 100).toFixed(0)}%` : ""}
                </span>
              </div>

              {expandedPrompts.flow_orchestrator && (
                <pre className="mb-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-[10px] leading-relaxed whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto text-gray-700 font-mono">
                  {AGENTS.find(a => a.id === "orchestrator")?.prompt}
                </pre>
              )}

              {/* Attack type + category */}
              {(flow.attack_type_predicted || flow.attack_category) && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {flow.attack_type_predicted && (
                    <span className="px-2 py-0.5 bg-red-50 rounded text-[11px] text-red-600 font-medium">
                      Type: {flow.attack_type_predicted}
                    </span>
                  )}
                  {flow.attack_category && (
                    <span className="px-2 py-0.5 bg-amber-50 rounded text-[11px] text-amber-600 font-medium">
                      Category: {flow.attack_category}
                    </span>
                  )}
                </div>
              )}

              {/* Agreed / disagreed */}
              {(flow.agents_agreed?.length > 0 || flow.agents_disagreed?.length > 0) && (
                <div className="flex gap-3 mb-2">
                  {flow.agents_agreed?.length > 0 && (
                    <div className="text-[11px] text-green-600">
                      Agreed: {flow.agents_agreed.join(", ")}
                    </div>
                  )}
                  {flow.agents_disagreed?.length > 0 && (
                    <div className="text-[11px] text-red-600">
                      Disagreed: {flow.agents_disagreed.join(", ")}
                    </div>
                  )}
                </div>
              )}

              {/* Consensus score */}
              {flow.consensus_score != null && flow.consensus_score > 0 && (
                <div className="text-[11px] text-gray-500 mb-2">
                  Consensus score: {(flow.consensus_score * 100).toFixed(0)}%
                </div>
              )}

              {/* Reasoning */}
              <div className="text-[11px] font-semibold text-gray-500 mb-1">Reasoning</div>
              <p className="text-xs text-gray-700 leading-relaxed m-0 whitespace-pre-wrap">
                {flow.reasoning}
              </p>

              {/* MITRE techniques */}
              {flow.mitre_techniques && flow.mitre_techniques.length > 0 && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  <span className="text-[11px] text-gray-500 font-medium">MITRE:</span>
                  {flow.mitre_techniques.map(t => (
                    <span key={t} className="px-2 py-0.5 bg-blue-50 rounded text-[11px] text-blue-600">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fallback for old format data */}
      {!flow.tier1_filtered && (!flow.specialist_results || Object.keys(flow.specialist_results).length === 0) && (
        <div className="flex flex-col gap-3">
          {flow.reasoning && (
            <div className="border border-gray-200 rounded-lg p-3.5 bg-gray-50">
              <div className="text-xs font-semibold text-blue-600 uppercase mb-2">Agent Reasoning</div>
              <p className="text-xs text-gray-700 leading-relaxed m-0 whitespace-pre-wrap">
                {flow.reasoning}
              </p>
            </div>
          )}
          <div className="border border-blue-300 rounded-lg px-4 py-3 bg-blue-50 text-blue-800 text-sm leading-relaxed">
            This experiment used the original result format. Full agent reasoning was captured from Stage 1 onwards.
            View a Stage 1 experiment to see complete agent analysis with per-specialist reasoning, Devil's Advocate counter-arguments, and Orchestrator synthesis.
          </div>
        </div>
      )}
    </div>
  );
}
