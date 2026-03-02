import React from "react";
import { verdictColor, verdictBg } from "../../lib/format";

export default function AgentCard({ agent, result, expandedPrompts, setExpandedPrompts, prefix }) {
  if (!result) return null;

  const evidence = result.key_evidence || result.key_findings || [];
  const promptKey = `${prefix}_${agent.id}`;

  return (
    <div className="border border-gray-200 rounded-lg p-3.5">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold uppercase" style={{ color: agent.color }}>
          {agent.name} Agent
        </span>
        <span
          className="px-2 py-0.5 rounded text-[11px] font-semibold"
          style={{ color: verdictColor(result.verdict), background: verdictBg(result.verdict) }}
        >
          {result.verdict} {result.confidence != null ? `${(result.confidence * 100).toFixed(0)}%` : ""}
        </span>
      </div>

      {/* Attack type */}
      {result.attack_type && (
        <div className="text-[11px] text-gray-500 mb-1.5">Attack type: {result.attack_type}</div>
      )}

      {/* Reasoning */}
      {result.reasoning && (
        <p className="text-xs text-gray-700 leading-relaxed mb-2 whitespace-pre-wrap">
          {result.reasoning}
        </p>
      )}

      {/* Key evidence / findings */}
      {evidence.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {evidence.map((kf, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-[11px] text-gray-700">
              {typeof kf === "string" ? (kf.length > 80 ? kf.slice(0, 80) + "..." : kf) : JSON.stringify(kf)}
            </span>
          ))}
        </div>
      )}

      {/* View prompt toggle */}
      <button
        onClick={() => setExpandedPrompts(prev => ({ ...prev, [promptKey]: !prev[promptKey] }))}
        className="bg-transparent border-none p-0 text-[10px] font-semibold cursor-pointer mt-1"
        style={{ color: agent.color }}
      >
        {expandedPrompts[promptKey] ? "hide prompt" : "view prompt"}
      </button>
      {expandedPrompts[promptKey] && (
        <pre className="mt-1.5 p-2.5 bg-gray-50 border border-gray-200 rounded-md text-[10px] leading-relaxed whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto text-gray-700 font-mono">
          {agent.prompt}
        </pre>
      )}

      {/* Temporal agent extra fields */}
      {agent.id === "temporal" && result.ip_history_summary && (
        <div className="text-[11px] text-gray-500 mt-1.5 p-2 bg-fuchsia-50 rounded">
          <div className="font-semibold text-pink-500 mb-1">IP History</div>
          <div>{result.ip_history_summary}</div>
          {result.temporal_pattern && (
            <div className="mt-0.5">Pattern: <strong>{result.temporal_pattern}</strong></div>
          )}
          {result.connected_flows && result.connected_flows.length > 0 && (
            <div className="mt-1">
              Connected flows: {result.connected_flows.map(cf => cf.flow_id ?? "?").join(", ")}
            </div>
          )}
        </div>
      )}
      {agent.id === "temporal" && result.temporal_summary && (
        <div className="text-[11px] text-gray-500 mt-1.5 p-2 bg-fuchsia-50 rounded">
          <div className="font-semibold text-pink-500 mb-1">Temporal Context</div>
          <div>{typeof result.temporal_summary === "string" ? result.temporal_summary : JSON.stringify(result.temporal_summary)}</div>
        </div>
      )}
    </div>
  );
}
