import React from "react";
import { EXPERIMENTS, getPhaseGroups } from "../../data/experiments";
import { STAGE1_SUMMARY } from "../../data/stage1";
import { ATTACK_DESCRIPTIONS, DIFFICULTY_TIERS } from "../../data/attacks";
import { pct, pctInt, dollar } from "../../lib/format";

const PHASE_META = {
  "Phase 1 — MCP": {
    color: "#d97706",
    conclusion: "External threat intelligence is useless on anonymized datasets. MCP tools returned no data for any IP address.",
  },
  "Phase 2 — Single-Agent": {
    color: "#3b82f6",
    conclusion: "Single-agent prompt engineering is a precision-recall seesaw. No configuration breaks through the ceiling.",
  },
  "Phase 3 — Multi-Agent": {
    color: "#8b5cf6",
    conclusion: "Multi-agent specialist deliberation breaks the single-agent ceiling. F1 jumped from 68% to 96% with temporal context.",
  },
  "Phase 4 — Model Comparison": {
    color: "#ec4899",
    conclusion: "GPT-4o is the production model. Haiku fails completely; GPT-4o-mini is a viable cost alternative.",
  },
  "Stage 1 — Per-Attack Evaluation": {
    color: "#16a34a",
    conclusion: "Architecture generalizes across 14 attack types. 92.9% mean F1, 0.07% FPR, $27.35 total cost.",
  },
  "Clustering — Infiltration v3": {
    color: "#06b6d4",
    conclusion: "Temporal clustering recovers detection of previously invisible attacks. Infiltration went from 0% to 58% recall.",
  },
};

const ROADMAP_ITEMS = [
  {
    title: "Test Set Final Evaluation",
    desc: "Run complete AMATAS v2/v3 pipeline on held-out test.csv (8.05M flows). Final thesis evaluation — no parameter tuning allowed.",
    status: "Planned",
    statusColor: "#6b7280",
  },
  {
    title: "Thesis Write-Up",
    desc: "Compile all experimental results. Key contributions: two-tier ML+LLM architecture, per-attack-type evaluation, explainable multi-agent reasoning, and temporal context. ~8 weeks remaining.",
    status: "In Progress",
    statusColor: "#2563eb",
  },
];

export default function ResearchJourney({ onNavigateToDetail, onNavigateToResults }) {
  const phaseGroups = getPhaseGroups();

  return (
    <div className="max-w-4xl">
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight mb-3">AMATAS</h1>
        <p className="text-base text-gray-600 leading-relaxed mb-2">
          Advanced Multi-Agent Threat Analysis System — an LLM-augmented Network Intrusion Detection System
          that provides <strong>explainable</strong> verdicts through multi-agent deliberation.
        </p>
        <p className="text-sm text-gray-500 leading-relaxed">
          Unlike traditional ML classifiers that output a probability with no explanation, every AMATAS verdict
          includes full reasoning chains from 6 specialist agents. You can trace exactly why a flow was flagged,
          what evidence was considered, and what counter-arguments were weighed.
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

        {phaseGroups.map((group) => {
          const meta = PHASE_META[group.label] || {};
          const isStage1 = group.label === "Stage 1 — Per-Attack Evaluation";

          return (
            <div key={group.label} className="mb-10 relative">
              {/* Phase header */}
              <div className="flex items-center gap-3 mb-4 ml-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10 flex-shrink-0"
                  style={{ background: meta.color || "#6b7280" }}
                >
                  {group.experiments.length}
                </div>
                <h2 className="text-lg font-bold tracking-tight m-0">{group.label}</h2>
              </div>

              {/* Experiment cards */}
              <div className="ml-11 space-y-3">
                {group.experiments.map((exp) => (
                  <div
                    key={exp.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{exp.name}</div>
                        <div className="text-[11px] text-gray-400">
                          {exp.date} &middot; {exp.model} &middot; {exp.flows} flows
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-sm font-bold" style={{ color: exp.f1 >= 0.8 ? "#16a34a" : exp.f1 >= 0.5 ? "#d97706" : "#dc2626" }}>
                          F1 {pctInt(exp.f1)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mb-2">{exp.narrative.tried}</p>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {[
                        { label: "Recall", value: pct(exp.recall) },
                        { label: "Precision", value: pct(exp.precision) },
                        { label: "F1", value: pct(exp.f1) },
                        { label: "Cost", value: dollar(exp.cost) },
                      ].map((m) => (
                        <div key={m.label} className="text-center py-1.5 bg-gray-50 rounded">
                          <div className="text-sm font-bold">{m.value}</div>
                          <div className="text-[9px] text-gray-400">{m.label}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 italic leading-relaxed m-0">
                      {exp.narrative.learned}
                    </p>
                  </div>
                ))}

                {/* Stage 1 summary + mini cards for all 14 attack types */}
                {isStage1 && (
                  <div className="border border-green-200 rounded-lg p-5 bg-green-50/50">
                    <h3 className="text-sm font-bold text-green-800 mb-1">
                      Full Stage 1 Results — 14 Attack Types
                    </h3>
                    <p className="text-xs text-green-700 mb-3">
                      Each batch: 950 benign + 50 attack flows at 5% prevalence. Tier-1 RF pre-filter reduces LLM calls by ~95%.
                    </p>

                    {/* Summary metrics */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {[
                        { label: "Mean Recall", value: `${Math.round(STAGE1_SUMMARY.experiments.filter(e => e.recall > 0).reduce((s,e) => s+e.recall, 0) / STAGE1_SUMMARY.experiments.filter(e => e.recall > 0).length)}%` },
                        { label: "Mean F1", value: `${Math.round(STAGE1_SUMMARY.experiments.reduce((s,e) => s+e.f1, 0) / STAGE1_SUMMARY.experiments.length)}%` },
                        { label: "Total Cost", value: dollar(STAGE1_SUMMARY.overall.total_cost) },
                        { label: "14k Flows", value: `${STAGE1_SUMMARY.overall.total_flows.toLocaleString()}` },
                      ].map((m) => (
                        <div key={m.label} className="text-center py-2 bg-white rounded border border-green-200">
                          <div className="text-lg font-bold text-green-800">{m.value}</div>
                          <div className="text-[9px] text-gray-500">{m.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Difficulty tiers */}
                    {Object.entries(DIFFICULTY_TIERS).map(([tier, data]) => (
                      <div key={tier} className="mb-3">
                        <div className="text-[11px] font-semibold mb-1.5" style={{ color: data.color }}>
                          {data.label}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {data.attacks.map((at) => {
                            const exp = STAGE1_SUMMARY.experiments.find(e => e.attack_type === at);
                            if (!exp) return null;
                            return (
                              <button
                                key={at}
                                onClick={() => onNavigateToDetail && onNavigateToDetail(at)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] border border-gray-200 bg-white cursor-pointer hover:border-gray-300"
                              >
                                <span className="text-gray-700">{at.replace(/_/g, " ")}</span>
                                <span className="font-bold" style={{ color: exp.recall >= 80 ? "#16a34a" : exp.recall >= 50 ? "#d97706" : "#dc2626" }}>
                                  {exp.recall}%
                                </span>
                                <span className="text-gray-400">F1 {exp.f1}%</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {onNavigateToResults && (
                      <button
                        onClick={onNavigateToResults}
                        className="mt-2 px-4 py-2 bg-green-700 text-white rounded-md text-xs font-medium cursor-pointer border-none"
                      >
                        View Full Results Table &rarr;
                      </button>
                    )}
                  </div>
                )}

                {/* Phase conclusion */}
                {meta.conclusion && (
                  <div
                    className="rounded-lg px-4 py-3 text-sm leading-relaxed"
                    style={{ background: `${meta.color}08`, borderLeft: `3px solid ${meta.color}`, color: "#374151" }}
                  >
                    <strong>Conclusion:</strong> {meta.conclusion}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* What's Next */}
      <div className="mt-12 mb-8">
        <h2 className="text-xl font-bold tracking-tight mb-4">What's Next</h2>
        <div className="flex flex-col gap-3 max-w-[700px]">
          {ROADMAP_ITEMS.map((item) => (
            <div key={item.title} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-1.5">
                <h3 className="text-sm font-semibold m-0">{item.title}</h3>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-medium"
                  style={{
                    color: item.statusColor,
                    border: `1px solid ${item.statusColor}30`,
                    background: `${item.statusColor}08`,
                  }}
                >
                  {item.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed m-0">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
