import React, { useState } from "react";
import { AGENTS } from "../../data/agents";
import { STAGE1_SUMMARY } from "../../data/stage1";
import { ATTACK_DESCRIPTIONS } from "../../data/attacks";
import { AGENT_CROSS_PERFORMANCE, SIGNAL_COLORS } from "../../data/agentPerformance";

export default function AgentHeatmap({ compact = false }) {
  const attackTypes = STAGE1_SUMMARY.experiments.map(e => e.attack_type);
  const specialistIds = ["protocol", "statistical", "behavioural", "temporal"];
  const [selectedCell, setSelectedCell] = useState(null); // { agent, attack }

  if (compact) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="text-left px-1.5 py-1 text-gray-500 font-medium">Agent</th>
              {attackTypes.map(at => (
                <th key={at} className="px-0.5 py-1 text-gray-400 font-medium text-center" style={{ minWidth: 28 }}>
                  <span className="block truncate" title={at} style={{ maxWidth: 35 }}>
                    {at.replace(/^(DDoS_attacks-|DoS_attacks-|DDOS_attack-|Brute_Force_-)/, "").slice(0, 5)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specialistIds.map(agentId => {
              const agent = AGENTS.find(a => a.id === agentId);
              return (
                <tr key={agentId}>
                  <td className="px-1.5 py-1 font-medium text-gray-600">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: agent?.color }} />
                      {agent?.name}
                    </span>
                  </td>
                  {attackTypes.map(at => {
                    const perf = AGENT_CROSS_PERFORMANCE[at]?.[agentId];
                    const colors = perf ? SIGNAL_COLORS[perf.signal] : { bg: "#f3f4f6", text: "#9ca3af" };
                    return (
                      <td
                        key={at}
                        className="px-0.5 py-1 text-center font-bold cursor-help"
                        style={{ background: colors.bg, color: colors.text }}
                        title={perf?.reason || `${agent?.name} on ${at}`}
                      >
                        {perf ? perf.signal.charAt(0).toUpperCase() : "-"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex gap-2 mt-1.5">
          {Object.entries(SIGNAL_COLORS).map(([key, val]) => (
            <span key={key} className="text-[9px] text-gray-400 flex items-center gap-0.5">
              <span className="w-2 h-2 rounded-sm" style={{ background: val.bg, border: `1px solid ${val.text}30` }} />
              {val.label}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const selPerf = selectedCell
    ? AGENT_CROSS_PERFORMANCE[selectedCell.attack]?.[selectedCell.agent]
    : null;
  const selAgent = selectedCell ? AGENTS.find(a => a.id === selectedCell.agent) : null;
  const selAttackInfo = selectedCell ? ATTACK_DESCRIPTIONS[selectedCell.attack] : null;

  return (
    <div className="border border-gray-200 rounded-lg p-5">
      <h3 className="text-sm font-bold mb-1">Agent Performance by Attack Type</h3>
      <p className="text-xs text-gray-500 mb-4">
        How well each specialist agent's analytical perspective matches each attack type's characteristics. Click any cell to see why.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="text-left px-2 py-2 text-gray-500 font-semibold border-b border-gray-200">Agent</th>
              {attackTypes.map(at => {
                const exp = STAGE1_SUMMARY.experiments.find(e => e.attack_type === at);
                const isSelected = selectedCell?.attack === at;
                return (
                  <th
                    key={at}
                    className="px-1 py-2 text-gray-500 font-medium text-center border-b border-gray-200"
                    style={{ minWidth: 50, background: isSelected ? "#f0f9ff" : undefined }}
                  >
                    <div className="truncate" title={at} style={{ maxWidth: 60 }}>
                      {at.replace(/^(DDoS_attacks-|DoS_attacks-|DDOS_attack-|Brute_Force_-)/, "").replace(/_/g, " ")}
                    </div>
                    <div className="text-[9px] text-gray-400 font-normal">{exp?.recall || 0}% R</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {specialistIds.map(agentId => {
              const agent = AGENTS.find(a => a.id === agentId);
              const isAgentSelected = selectedCell?.agent === agentId;
              return (
                <tr key={agentId} className="border-b border-gray-100">
                  <td
                    className="px-2 py-2 font-medium text-gray-700"
                    style={{ background: isAgentSelected ? "#f0f9ff" : undefined }}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: agent?.color }} />
                      {agent?.name}
                    </span>
                  </td>
                  {attackTypes.map(at => {
                    const perf = AGENT_CROSS_PERFORMANCE[at]?.[agentId];
                    const colors = perf ? SIGNAL_COLORS[perf.signal] : { bg: "#f3f4f6", text: "#9ca3af" };
                    const isThis = selectedCell?.agent === agentId && selectedCell?.attack === at;
                    return (
                      <td
                        key={at}
                        onClick={() => setSelectedCell(
                          isThis ? null : { agent: agentId, attack: at }
                        )}
                        className="px-1 py-2 text-center font-semibold cursor-pointer transition-all"
                        style={{
                          background: colors.bg,
                          color: colors.text,
                          outline: isThis ? `2px solid ${colors.text}` : "none",
                          outlineOffset: "-2px",
                        }}
                        title={perf?.reason || ""}
                      >
                        {perf ? colors.label : "-"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mt-2.5">
        {Object.entries(SIGNAL_COLORS).map(([key, val]) => (
          <span key={key} className="text-[10px] text-gray-500 flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: val.bg, border: `1px solid ${val.text}30` }} />
            {val.label} — {key === "strong" ? "highly effective" : key === "moderate" ? "partially effective" : "limited"} for this attack
          </span>
        ))}
      </div>

      {/* Justification panel — shown when a cell is clicked */}
      {selPerf && selAgent && (
        <div
          className="mt-4 rounded-lg p-4 border-l-[3px] transition-all"
          style={{
            background: SIGNAL_COLORS[selPerf.signal].bg + "60",
            borderColor: SIGNAL_COLORS[selPerf.signal].text,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: selAgent.color }} />
            <span className="text-sm font-bold text-gray-900">{selAgent.name} Agent</span>
            <span className="text-xs text-gray-400">&rarr;</span>
            <span className="text-sm font-semibold text-gray-700">
              {(selAttackInfo?.name || selectedCell.attack).replace(/_/g, " ")}
            </span>
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold ml-auto"
              style={{
                color: SIGNAL_COLORS[selPerf.signal].text,
                background: SIGNAL_COLORS[selPerf.signal].bg,
                border: `1px solid ${SIGNAL_COLORS[selPerf.signal].text}30`,
              }}
            >
              {SIGNAL_COLORS[selPerf.signal].label} Signal
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed m-0">
            {selPerf.reason}
          </p>
          {selAttackInfo && (
            <div className="mt-2 pt-2 border-t border-gray-200/50 text-[11px] text-gray-500">
              <strong>Attack signature:</strong> {selAttackInfo.signature}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
