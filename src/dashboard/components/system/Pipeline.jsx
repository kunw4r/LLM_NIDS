import React from "react";
import { AGENT_COST_DATA } from "../../data/stage1";

export default function Pipeline() {
  const steps = [
    { n: 1, bg: "#eff6ff", bc: "#2563eb", title: "Data Preparation", text: "Network flows from CICIDS2018 NetFlow v3. 1,000 flows per batch: 950 benign + 50 attacks. 15 features selected from 53 available. Flows sorted chronologically by source IP to preserve temporal patterns." },
    { n: 2, bg: "#f0fdf4", bc: "#16a34a", title: "Tier 1 RF Pre-Filter", text: `A Random Forest classifier (100 trees, trained on 5.63M flows) assigns each flow an attack probability. Flows below threshold 0.15 are auto-classified BENIGN at zero LLM cost. ~${Math.round(AGENT_COST_DATA.totalFiltered / 14000 * 100)}% of flows are filtered here.` },
    { n: 3, bg: "#fdf4ff", bc: "#ec4899", title: "4 Specialist Agents (parallel)", text: "The remaining flows are sent simultaneously to 4 specialist agents. Each analyses the flow from one perspective and returns a verdict + full reasoning." },
    { n: 4, bg: "#fef2f2", bc: "#dc2626", title: "Devil's Advocate", text: "Receives all 4 specialist verdicts. Argues the strongest possible case for BENIGN regardless of specialist votes. Designed to reduce false positives by stress-testing the malicious case. Carries 30% weight." },
    { n: 5, bg: "#ecfdf5", bc: "#10b981", title: "Orchestrator", text: "Receives all 5 agent outputs. Weighs evidence, considers DA counter-argument, produces final verdict: MALICIOUS / SUSPICIOUS / BENIGN plus attack category and full reasoning chain." },
    { n: 6, bg: "#f9fafb", bc: "#6b7280", title: "Results", text: "Complete reasoning chain stored per flow. Results pushed to GitHub automatically. Thesis draft generated for each experiment." },
  ];

  const specialists = [
    { name: "Protocol", color: "#3b82f6", desc: "Port/flag/protocol validity" },
    { name: "Statistical", color: "#8b5cf6", desc: "Volume/timing anomalies" },
    { name: "Behavioural", color: "#f59e0b", desc: "Attack signature matching" },
    { name: "Temporal", color: "#ec4899", desc: "Cross-flow IP patterns" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-2 tracking-tight">How AMATAS Runs</h2>
      <p className="text-sm text-gray-500 mb-8">Complete pipeline from raw data to explainable verdict.</p>

      <div className="flex flex-col gap-6 mb-10">
        {steps.map(step => (
          <div key={step.n} className="flex gap-5">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0"
              style={{ background: step.bg, border: `2px solid ${step.bc}`, color: step.bc }}
            >
              {step.n}
            </div>
            <div className="flex-1">
              <h3 className="text-[15px] font-bold mb-1.5">{step.title}</h3>
              <p className="text-sm text-gray-700 leading-relaxed m-0">{step.text}</p>

              {/* Tier 1 flow diagram */}
              {step.n === 2 && (
                <div className="flex items-center gap-2 font-mono text-xs p-3 bg-gray-50 rounded-lg border border-gray-200 mt-3 flex-wrap">
                  <span className="px-2.5 py-1 bg-blue-800 text-white rounded font-semibold">1000 flows</span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="px-2.5 py-1 bg-green-600 text-white rounded">RF filter</span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="px-2.5 py-1 bg-blue-600 text-white rounded">{Math.round(AGENT_COST_DATA.totalLlmFlows / 14)} to LLM</span>
                  <span className="text-gray-300">|</span>
                  <span className="px-2.5 py-1 bg-green-50 text-green-600 rounded border border-green-200">{Math.round(AGENT_COST_DATA.totalFiltered / 14)} auto-benign</span>
                </div>
              )}

              {/* 4 specialist agent grid */}
              {step.n === 3 && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {specialists.map(a => (
                    <div key={a.name} className="border border-gray-200 rounded-md p-2.5 text-center">
                      <div className="text-xs font-semibold" style={{ color: a.color }}>{a.name}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{a.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Agent Cost Distribution */}
      <div className="border border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="text-sm font-semibold mb-5">Agent Cost Distribution (per LLM-analysed flow)</h3>
        <div className="max-w-xl">
          {["orchestrator", "devils_advocate", "temporal", "behavioural", "statistical", "protocol"].map(a => (
            <div key={a} className="flex items-center gap-3 mb-2">
              <div className="w-28 text-xs text-gray-700 text-right">{AGENT_COST_DATA[a].label}</div>
              <div className="flex-1 h-[22px] bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full rounded flex items-center justify-end pr-2"
                  style={{ width: `${AGENT_COST_DATA[a].pct}%`, background: AGENT_COST_DATA[a].color }}
                >
                  <span className="text-xs font-bold text-white">{AGENT_COST_DATA[a].pct}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xl font-bold">${AGENT_COST_DATA.avgPerLlmFlow.toFixed(3)}</div>
            <div className="text-xs text-gray-500">per flow reaching LLM</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xl font-bold">${AGENT_COST_DATA.avgPerBatch.toFixed(2)}</div>
            <div className="text-xs text-gray-500">per 1,000-flow batch</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-xl font-bold text-green-800">~${(AGENT_COST_DATA.estWithoutTier1 / 14 - AGENT_COST_DATA.avgPerBatch).toFixed(0)}</div>
            <div className="text-xs text-gray-500">saved per batch by Tier 1</div>
          </div>
        </div>
      </div>

      {/* Where the Money Goes */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-semibold mb-3">Where the Money Goes</h3>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-40 text-xs text-gray-700 text-right">Tier 1 filtered (free)</div>
            <div className="flex-1 h-[22px] bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-green-600 rounded flex items-center pl-2"
                style={{ width: `${Math.round(AGENT_COST_DATA.totalFiltered / 14000 * 100)}%` }}
              >
                <span className="text-xs font-bold text-white">{Math.round(AGENT_COST_DATA.totalFiltered / 14000 * 100)}%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-40 text-xs text-gray-700 text-right">LLM pipeline</div>
            <div className="flex-1 h-[22px] bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded flex items-center pl-2"
                style={{ width: `${Math.round(AGENT_COST_DATA.totalLlmFlows / 14000 * 100)}%` }}
              >
                <span className="text-xs font-bold text-white">{Math.round(AGENT_COST_DATA.totalLlmFlows / 14000 * 100)}%</span>
              </div>
            </div>
          </div>
          <div className="ml-44 text-xs text-gray-500 mb-1">LLM cost split by agent:</div>
          {["protocol", "statistical", "behavioural", "temporal", "devils_advocate", "orchestrator"].map(a => (
            <div key={a} className="flex items-center gap-3 ml-10">
              <div className="w-28 text-xs text-gray-500 text-right">{AGENT_COST_DATA[a].label}</div>
              <div className="flex-1 h-3.5 bg-gray-100 rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm"
                  style={{ width: `${AGENT_COST_DATA[a].pct}%`, background: AGENT_COST_DATA[a].color }}
                />
              </div>
              <span className="text-xs text-gray-500 min-w-[35px]">{AGENT_COST_DATA[a].pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
