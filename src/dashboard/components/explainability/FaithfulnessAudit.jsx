import React from "react";
import { FAITHFULNESS_DATA } from "../../data/faithfulness";

export default function FaithfulnessAudit() {
  const { summary, per_agent, per_claim_type, confabulation_examples } = FAITHFULNESS_DATA;

  const maxAgentTotal = Math.max(...per_agent.map(a => a.total));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-2">Faithfulness Audit</h2>
        <p className="text-sm text-gray-500 leading-relaxed max-w-3xl">
          Are the agents' factual claims about network flow features actually correct?
          This audit extracted and verified {summary.total_claims.toLocaleString()} verifiable claims
          from {summary.flows_audited} flows across all 14 Stage 1 experiments.
        </p>
      </div>

      {/* Hero number */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Faithfulness Rate", value: `${summary.faithfulness_rate_pct}%`, color: "#16a34a" },
          { label: "Total Claims", value: summary.total_claims.toLocaleString(), color: "#6b7280" },
          { label: "Correct Claims", value: summary.correct_claims.toLocaleString(), color: "#16a34a" },
          { label: "Incorrect Claims", value: summary.incorrect_claims.toLocaleString(), color: "#dc2626" },
        ].map(h => (
          <div key={h.label} className="border border-gray-200 rounded-lg p-5 text-center">
            <div className="text-3xl font-bold tracking-tight" style={{ color: h.color }}>{h.value}</div>
            <div className="text-xs text-gray-500 mt-1">{h.label}</div>
          </div>
        ))}
      </div>

      {/* Per-agent bar chart */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-1">Faithfulness by Agent</h3>
        <p className="text-xs text-gray-500 mb-4">
          Percentage of factual claims that were correct, per agent. Statistical agent is most faithful; Devil's Advocate least.
        </p>
        <div className="space-y-3">
          {per_agent.map(a => (
            <div key={a.agent} className="flex items-center gap-3">
              <div className="w-28 text-xs text-gray-700 text-right font-medium">{a.agent}</div>
              <div className="flex-1 h-7 bg-gray-100 rounded overflow-hidden relative">
                <div
                  className="h-full rounded flex items-center justify-end pr-2"
                  style={{ width: `${a.rate}%`, background: a.color }}
                >
                  <span className="text-[11px] font-bold text-white">{a.rate}%</span>
                </div>
              </div>
              <div className="w-20 text-[10px] text-gray-400 text-right">
                {a.correct}/{a.total} claims
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-claim-type bar chart */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-1">Faithfulness by Claim Type</h3>
        <p className="text-xs text-gray-500 mb-4">
          Some types of factual claims are harder to get right. Numeric references are nearly perfect;
          TCP flag interpretation and protocol naming are where confabulation concentrates.
        </p>
        <div className="space-y-2">
          {per_claim_type.map(c => {
            const barColor = c.rate >= 95 ? "#16a34a" : c.rate >= 85 ? "#d97706" : "#dc2626";
            return (
              <div key={c.type} className="flex items-center gap-3">
                <div className="w-40 text-xs text-gray-700 text-right">{c.type}</div>
                <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full rounded flex items-center justify-end pr-1.5"
                    style={{ width: `${c.rate}%`, background: barColor }}
                  >
                    <span className="text-[10px] font-bold text-white">{c.rate}%</span>
                  </div>
                </div>
                <div className="w-16 text-[10px] text-gray-400 text-right">{c.incorrect} errors</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confabulation insight */}
      <div className="border border-amber-200 rounded-lg p-5 bg-amber-50">
        <div className="text-sm font-bold text-amber-800 mb-2">Where Confabulation Concentrates</div>
        <div className="text-sm text-amber-900 leading-relaxed space-y-2">
          <p>
            <strong>TCP flag interpretation (77.6% accurate):</strong> Agents receive a numeric bitmask (e.g., flags=22)
            and must decode it into flag names (SYN, ACK, RST, etc.). They frequently confabulate — stating PSH is set
            when it isn't, or misidentifying which flags correspond to the numeric value. This is a domain knowledge gap,
            not a reasoning failure.
          </p>
          <p>
            <strong>Protocol naming (80.6% accurate):</strong> Agents see protocol=17 (UDP) but write "TCP" in their reasoning,
            likely because TCP is far more common in their training data. The agent knows the flow uses protocol 17 but
            defaults to the more familiar protocol name.
          </p>
          <p>
            <strong>The pattern:</strong> Confabulation is systematic, not random. Agents infer expected values from
            domain knowledge rather than reading the actual numeric data. This suggests a targeted mitigation: providing
            pre-decoded feature values (which is exactly what the MCP tools in configs D-G attempt to do — though as shown
            in the MCP comparison, this introduces its own problems).
          </p>
        </div>
      </div>

      {/* Example errors */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-3">Example Confabulations</h3>
        <div className="space-y-2">
          {confabulation_examples.map((ex, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
              <span className="text-xs font-mono px-1.5 py-0.5 bg-red-100 text-red-700 rounded flex-shrink-0">{ex.type}</span>
              <div className="flex-1">
                <div className="text-xs text-gray-800">{ex.detail}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{ex.agent} agent &middot; {ex.attack}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
