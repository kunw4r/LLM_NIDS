import React, { useState } from "react";
import { AGENTS } from "../../data/agents";
import { REFERENCES } from "../../data/references";
import { AGENT_COST_DATA, AGENT_COST_PER_EXPERIMENT, STAGE1_SUMMARY } from "../../data/stage1";
import { ATTACK_DESCRIPTIONS } from "../../data/attacks";
import { AGENT_CROSS_PERFORMANCE, SIGNAL_COLORS } from "../../data/agentPerformance";
import { dollar } from "../../lib/format";

// Literature justification per agent
const AGENT_LITERATURE = {
  protocol: {
    why: "Network protocol analysis is a foundational NIDS technique. By checking port-service alignment, TCP flag consistency, and packet size norms, the Protocol Agent implements rule-based validation grounded in RFC standards and known protocol behaviors.",
    refs: ["Sarhan2021"],
  },
  statistical: {
    why: "Statistical anomaly detection identifies flows that deviate from expected distributions across volume, timing, throughput, and packet characteristics. This agent implements the statistical profiling approach common in traditional NIDS research.",
    refs: ["Sharafaldin2018", "Sarhan2021"],
  },
  behavioural: {
    why: "Attack signature matching maps observed flow patterns to known attack techniques via MITRE ATT&CK. This agent acts as a domain expert, encoding threat intelligence knowledge that pure statistical methods lack.",
    refs: ["Sarhan2021"],
  },
  temporal: {
    why: "Individual flows can appear benign in isolation. Cross-flow temporal analysis groups flows by source IP to detect patterns like brute-force bursts, scanning sequences, and beaconing. This parallels the Society of Mind concept of emergent understanding from grouped observations.",
    refs: ["Minsky1986", "Yao2023"],
  },
  devils_advocate: {
    why: "Group polarization theory shows that like-minded agents reinforce each other's biases, leading to overconfident malicious verdicts. The Devil's Advocate forces consideration of benign interpretations, directly reducing false positives through adversarial deliberation.",
    refs: ["Sunstein2002"],
  },
  orchestrator: {
    why: "Weighted consensus synthesis combines multiple analytical perspectives into a calibrated final verdict. The orchestrator implements structured reasoning by explicitly weighing specialist agreement, DA counter-arguments, and confidence levels.",
    refs: ["Wei2022", "Yao2023"],
  },
};

// Input/Output specifications per agent
const AGENT_IO = {
  protocol: {
    inputs: [
      "14 NetFlow features as JSON (ports, protocol, flags, packet sizes, DNS/FTP fields)",
      "System prompt defining protocol validation rules",
    ],
    outputs: [
      "verdict: BENIGN | SUSPICIOUS | MALICIOUS",
      "confidence: 0.0-1.0",
      "attack_type: predicted type or null",
      "key_findings: string[] — evidence points (e.g., 'Port 21 matches FTP service')",
      "reasoning: full analysis text",
    ],
  },
  statistical: {
    inputs: [
      "14 NetFlow features as JSON (bytes, packets, throughput, IAT, duration, retransmissions)",
      "System prompt defining statistical anomaly thresholds",
    ],
    outputs: [
      "verdict: BENIGN | SUSPICIOUS | MALICIOUS",
      "confidence: 0.0-1.0",
      "attack_type: predicted type or null",
      "key_findings: string[] — statistical anomalies detected",
      "reasoning: full analysis text",
    ],
  },
  behavioural: {
    inputs: [
      "14 NetFlow features as JSON",
      "System prompt with MITRE ATT&CK technique signatures for all 14 attack types",
    ],
    outputs: [
      "verdict: BENIGN | SUSPICIOUS | MALICIOUS",
      "confidence: 0.0-1.0",
      "attack_type: predicted type or null",
      "key_findings: string[] — matched attack signatures",
      "reasoning: full analysis text with MITRE technique IDs",
    ],
  },
  temporal: {
    inputs: [
      "14 NetFlow features as JSON (target flow)",
      "Co-IP flow context: all flows from same source IP in batch (up to 50)",
      "System prompt defining temporal pattern types (burst, sequential, repetitive, diverse)",
    ],
    outputs: [
      "verdict: BENIGN | SUSPICIOUS | MALICIOUS",
      "confidence: 0.0-1.0",
      "attack_type: predicted type or null",
      "key_findings: string[] — temporal patterns observed",
      "reasoning: full analysis including IP history summary",
    ],
  },
  devils_advocate: {
    inputs: [
      "14 NetFlow features as JSON (original flow)",
      "All 4 specialist analyses (verdicts, confidence, findings, reasoning)",
      "System prompt mandating benign interpretation",
    ],
    outputs: [
      "confidence_benign: 0.0-1.0 — strength of benign argument",
      "strongest_benign_indicator: single best benign explanation",
      "counter_argument: full adversarial text challenging malicious findings",
      "reasoning: structured rebuttal of each specialist's concerns",
    ],
  },
  orchestrator: {
    inputs: [
      "14 NetFlow features as JSON (original flow)",
      "All 4 specialist analyses + Devil's Advocate counter-argument",
      "System prompt with consensus rules (30% DA weight, threshold table)",
    ],
    outputs: [
      "verdict: BENIGN | SUSPICIOUS | MALICIOUS (final)",
      "confidence: 0.0-1.0 (calibrated)",
      "attack_type: most specific type from highest-confidence specialist",
      "consensus_score: 0.0-1.0 — specialist agreement level",
      "mitre_techniques: string[] — relevant ATT&CK IDs",
      "reasoning: synthesis of all perspectives with decision rationale",
    ],
  },
};

export default function AgentDocs() {
  const [expandedAgent, setExpandedAgent] = useState("protocol");

  const attackTypes = STAGE1_SUMMARY.experiments.map(e => e.attack_type);

  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight mb-1">Agent Documentation</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-3xl leading-relaxed">
        AMATAS uses 6 specialist agents, each analysing network flows from a different perspective.
        Every agent exists for a research-backed reason and produces structured, traceable outputs.
      </p>

      {/* Agent selector pills */}
      <div className="flex gap-1.5 flex-wrap mb-6">
        {AGENTS.map(agent => (
          <button
            key={agent.id}
            onClick={() => setExpandedAgent(agent.id)}
            className="px-3 py-1.5 rounded-md text-xs cursor-pointer border"
            style={{
              borderColor: expandedAgent === agent.id ? agent.color : "#e5e7eb",
              background: expandedAgent === agent.id ? `${agent.color}10` : "white",
              color: expandedAgent === agent.id ? agent.color : "#374151",
              fontWeight: expandedAgent === agent.id ? 600 : 400,
            }}
          >
            {agent.name}
          </button>
        ))}
      </div>

      {/* Agent detail sections */}
      {AGENTS.filter(a => a.id === expandedAgent).map(agent => {
        const lit = AGENT_LITERATURE[agent.id];
        const io = AGENT_IO[agent.id];
        const costData = AGENT_COST_DATA[agent.id];

        return (
          <div key={agent.id} className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full" style={{ background: agent.color }} />
              <h3 className="text-lg font-bold m-0">{agent.name} Agent</h3>
              <span className="text-sm text-gray-500">{agent.desc}</span>
            </div>

            {/* Why This Agent Exists */}
            <div className="border border-gray-200 rounded-lg p-5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Why This Agent Exists
              </h4>
              <p className="text-sm text-gray-700 leading-relaxed mb-2">{lit.why}</p>
              <div className="flex gap-2 flex-wrap">
                {lit.refs.map(refKey => {
                  const ref = REFERENCES[refKey];
                  return ref ? (
                    <span key={refKey} className="text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-700" title={ref.title}>
                      {ref.short}
                    </span>
                  ) : null;
                })}
              </div>
            </div>

            {/* Input / Output */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  What It Receives (Input)
                </h4>
                <ul className="list-none m-0 p-0 space-y-1.5">
                  {io.inputs.map((input, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-gray-400 flex-shrink-0">&rarr;</span>
                      {input}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border border-gray-200 rounded-lg p-5">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  What It Outputs
                </h4>
                <ul className="list-none m-0 p-0 space-y-1.5">
                  {io.outputs.map((output, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-gray-400 flex-shrink-0">&larr;</span>
                      <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{output}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Performance Across Attacks — with justifications */}
            <div className="border border-gray-200 rounded-lg p-5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Performance Across Attack Types
              </h4>
              <div className="flex gap-3 mb-3">
                {Object.entries(SIGNAL_COLORS).map(([key, val]) => (
                  <span key={key} className="text-[10px] text-gray-500 flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: val.bg, border: `1px solid ${val.text}30` }} />
                    {val.label}
                  </span>
                ))}
              </div>
              {/* Per-attack signal cards with reasons */}
              <div className="space-y-1.5">
                {attackTypes.map(at => {
                  const perf = AGENT_CROSS_PERFORMANCE[at]?.[agent.id];
                  if (!perf) return null;
                  const colors = SIGNAL_COLORS[perf.signal];
                  const exp = STAGE1_SUMMARY.experiments.find(e => e.attack_type === at);
                  const info = ATTACK_DESCRIPTIONS[at];
                  return (
                    <div
                      key={at}
                      className="flex items-start gap-3 rounded-md px-3 py-2"
                      style={{ background: colors.bg + "80" }}
                    >
                      <div className="flex-shrink-0 w-20">
                        <div className="text-[11px] font-bold" style={{ color: colors.text }}>
                          {colors.label}
                        </div>
                        {exp && (
                          <div className="text-[10px] text-gray-500">
                            {exp.recall}% recall
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-gray-800 mb-0.5">
                          {(info?.name || at).replace(/_/g, " ")}
                          {info && (
                            <span
                              className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
                              style={{
                                color: info.difficulty === "Hardest" || info.difficulty === "Hard" ? "#dc2626" : info.difficulty === "Medium" ? "#d97706" : "#16a34a",
                                background: info.difficulty === "Hardest" || info.difficulty === "Hard" ? "#fef2f2" : info.difficulty === "Medium" ? "#fffbeb" : "#f0fdf4",
                              }}
                            >
                              {info.difficulty}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-600 leading-relaxed">
                          {perf.reason}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cost Profile */}
            <div className="border border-gray-200 rounded-lg p-5">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Cost Profile
              </h4>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="text-center py-3 bg-gray-50 rounded">
                  <div className="text-xl font-bold" style={{ color: agent.color }}>
                    {costData.pct}%
                  </div>
                  <div className="text-[10px] text-gray-500">of total cost</div>
                </div>
                <div className="text-center py-3 bg-gray-50 rounded">
                  <div className="text-xl font-bold text-gray-900">{dollar(costData.cost)}</div>
                  <div className="text-[10px] text-gray-500">total across 14 experiments</div>
                </div>
                <div className="text-center py-3 bg-gray-50 rounded">
                  <div className="text-xl font-bold text-gray-900">
                    {dollar(costData.cost / AGENT_COST_DATA.totalLlmFlows)}
                  </div>
                  <div className="text-[10px] text-gray-500">avg per LLM flow</div>
                </div>
              </div>
              {/* Per-experiment cost bars */}
              <div className="text-[11px] text-gray-500 mb-1.5">Cost variation across experiments:</div>
              <div className="space-y-1">
                {STAGE1_SUMMARY.experiments.map(exp => {
                  const perExp = AGENT_COST_PER_EXPERIMENT[exp.attack_type];
                  if (!perExp) return null;
                  const cost = perExp[agent.id] || 0;
                  const maxCost = Math.max(...Object.values(AGENT_COST_PER_EXPERIMENT).map(e => e[agent.id] || 0));
                  return (
                    <div key={exp.attack_type} className="flex items-center gap-1.5">
                      <div className="w-20 text-[10px] text-gray-500 text-right truncate" title={exp.attack_type}>
                        {exp.attack_type.replace(/_/g, " ").slice(0, 16)}
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-sm h-3 overflow-hidden">
                        <div
                          className="h-full rounded-sm"
                          style={{ width: `${(cost / maxCost) * 100}%`, background: agent.color }}
                        />
                      </div>
                      <div className="w-12 text-[10px] text-gray-500 font-mono">${cost.toFixed(2)}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* System Prompt */}
            <details className="border border-gray-200 rounded-lg">
              <summary className="px-5 py-3 cursor-pointer text-xs font-semibold text-gray-500">
                View Full System Prompt
              </summary>
              <pre className="px-5 pb-4 text-xs text-gray-600 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {agent.prompt}
              </pre>
            </details>
          </div>
        );
      })}

      {/* Full Heatmap (all agents x all attacks) */}
      <div className="mt-10 border border-gray-200 rounded-lg p-5">
        <h3 className="text-sm font-bold mb-1">Cross-Agent Performance Heatmap</h3>
        <p className="text-xs text-gray-500 mb-4">
          Signal strength of each specialist agent per attack type, based on expected detection capability from attack signatures and flow characteristics.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Agent</th>
                {attackTypes.map(at => (
                  <th key={at} className="px-1 py-1.5 text-gray-400 font-medium text-center" style={{ minWidth: 40 }}>
                    <span className="block truncate" title={at} style={{ maxWidth: 55 }}>
                      {at.replace(/^(DDoS_attacks-|DoS_attacks-|DDOS_attack-|Brute_Force_-)/, "").replace(/_/g, " ")}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {["protocol", "statistical", "behavioural", "temporal"].map(agentId => {
                const agent = AGENTS.find(a => a.id === agentId);
                return (
                  <tr key={agentId}>
                    <td className="px-2 py-1.5 font-medium text-gray-700">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: agent?.color }} />
                        {agent?.name}
                      </span>
                    </td>
                    {attackTypes.map(at => {
                      const perf = AGENT_CROSS_PERFORMANCE[at]?.[agentId];
                      const colors = perf ? SIGNAL_COLORS[perf.signal] : { bg: "#f3f4f6", text: "#9ca3af" };
                      return (
                        <td
                          key={at}
                          className="px-1 py-1.5 text-center font-semibold rounded cursor-help"
                          style={{ background: colors.bg, color: colors.text }}
                          title={perf?.reason || ""}
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
        </div>
        <div className="flex gap-3 mt-2">
          {Object.entries(SIGNAL_COLORS).map(([key, val]) => (
            <span key={key} className="text-[10px] text-gray-500 flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: val.bg, border: `1px solid ${val.text}30` }} />
              {val.label.charAt(0)} = {val.label}
            </span>
          ))}
          <span className="text-[10px] text-gray-400 ml-2">Hover any cell to see why</span>
        </div>
      </div>
    </div>
  );
}
