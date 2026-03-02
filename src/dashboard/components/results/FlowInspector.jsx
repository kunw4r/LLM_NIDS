import React from "react";
import { EXPERIMENTS } from "../../data/experiments";
import { STAGE1_SUMMARY, AGENT_COST_DATA, AGENT_COST_PER_EXPERIMENT } from "../../data/stage1";
import { AGENT_KEYS, STAGE1_ID_MAP } from "../../data/constants";
import { ATTACK_DESCRIPTIONS } from "../../data/attacks";
import { pct, dollar, verdictColor, verdictBg } from "../../lib/format";
import { computeErrorAttribution } from "../../lib/errorAttribution";
import ErrorAttribution from "./ErrorAttribution";
import ReasoningShowcase from "./ReasoningShowcase";
import FlowTable from "../inspector/FlowTable";
import FlowDetail from "../inspector/FlowDetail";

/** Map inspector source ID back to an attack type key for ATTACK_DESCRIPTIONS */
function getAttackType(sourceId) {
  for (const [at, id] of Object.entries(STAGE1_ID_MAP)) {
    if (id === sourceId) return at;
  }
  return null;
}

export default function FlowInspector({ inspector }) {
  const {
    inspectorData,
    inspectorLoading,
    inspectorError,
    inspectorFilter,
    setInspectorFilter,
    selectedFlowIdx,
    setSelectedFlowIdx,
    inspectorPage,
    setInspectorPage,
    inspectorSource,
    setInspectorSource,
    searchQuery,
    setSearchQuery,
    loadInspectorData,
    inspectorFlows,
    filteredFlows,
    selectedFlow,
    pieCounts,
    FLOWS_PER_PAGE,
    expandedPrompts,
    setExpandedPrompts,
  } = inspector;

  const pieTotal = inspectorFlows.length || 1;
  const attackType = getAttackType(inspectorSource);
  const attackInfo = attackType ? ATTACK_DESCRIPTIONS[attackType] : null;
  const attribution = inspectorData ? computeErrorAttribution(inspectorFlows) : null;

  return (
    <div>
      <h2 className="text-xl font-bold mb-1 tracking-tight">Flow Inspector</h2>
      <p className="text-sm text-gray-500 mb-5">
        Explore individual flow results with full agent reasoning chains — the explainability centerpiece of AMATAS.
      </p>

      {/* Source selector */}
      <div className="flex flex-col gap-2.5 mb-5">
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs text-gray-500 font-semibold mr-1 min-w-[90px]">Development:</span>
          {EXPERIMENTS.map(exp => (
            <button
              key={exp.id}
              onClick={() => { setInspectorSource(exp.id); loadInspectorData(exp.id); }}
              className={`px-2.5 py-1 rounded-md text-[11px] cursor-pointer border ${
                inspectorSource === exp.id
                  ? "border-blue-600 bg-blue-50 text-blue-600 font-semibold"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              {exp.name}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs text-gray-500 font-semibold mr-1 min-w-[90px]">Stage 1:</span>
          {STAGE1_SUMMARY.experiments.map(exp => {
            const sourceId = STAGE1_ID_MAP[exp.attack_type] || `stage1_${exp.attack_type.replace(/ /g, "_").toLowerCase()}`;
            const isActive = inspectorSource === sourceId;
            const recallColor = exp.recall >= 95 ? "#16a34a" : exp.recall >= 80 ? "#2563eb" : exp.recall >= 50 ? "#d97706" : "#dc2626";
            return (
              <button
                key={sourceId}
                onClick={() => { setInspectorSource(sourceId); loadInspectorData(sourceId); }}
                className="px-2.5 py-1 rounded-md text-[11px] cursor-pointer"
                style={{
                  border: isActive ? `1px solid ${recallColor}` : "1px solid #e5e7eb",
                  background: isActive ? `${recallColor}10` : "#fff",
                  color: isActive ? recallColor : "#374151",
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {exp.attack_type.replace(/_/g, " ")} <span style={{ color: recallColor, fontSize: 10 }}>{exp.recall}%</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {inspectorLoading && (
        <div className="border border-gray-200 rounded-lg p-12 text-center text-gray-500">
          Loading flow data...
        </div>
      )}

      {/* Error state */}
      {inspectorError && !inspectorData && (
        <div className="border border-red-300 rounded-lg p-6 bg-red-50 text-red-600 text-sm">
          Failed to load: {inspectorError}. Click an experiment button above to load data.
        </div>
      )}

      {/* Empty state */}
      {!inspectorData && !inspectorLoading && !inspectorError && (
        <div className="border border-gray-200 rounded-lg p-12 text-center text-gray-400">
          <p className="text-base mb-2">Select an experiment to inspect individual flow results</p>
          <p className="text-sm">Click any experiment button above to load its flow-level data with agent reasoning</p>
        </div>
      )}

      {/* Loaded data */}
      {inspectorData && !inspectorLoading && (
        <>
          {/* Interrupted banner */}
          {(inspectorData.evaluation_metadata?.status === "interrupted" || inspectorData.failed) && (
            <div className="border border-yellow-400 rounded-lg px-4 py-3 bg-yellow-50 mb-4 text-sm text-yellow-800">
              &#9888;&#65039; This experiment was interrupted — partial results shown.
            </div>
          )}

          {/* Attack description card */}
          {attackInfo && (
            <div className="border border-gray-200 rounded-lg p-5 mb-5 bg-gray-50/80">
              <div className="flex justify-between items-baseline mb-2">
                <h3 className="text-base font-bold m-0">{attackInfo.name}</h3>
                <span
                  className="px-2.5 py-0.5 rounded text-[11px] font-semibold"
                  style={{
                    color: attackInfo.difficulty === "Hardest" || attackInfo.difficulty === "Hard" ? "#dc2626" : attackInfo.difficulty === "Medium" ? "#d97706" : "#16a34a",
                    background: attackInfo.difficulty === "Hardest" || attackInfo.difficulty === "Hard" ? "#fef2f2" : attackInfo.difficulty === "Medium" ? "#fffbeb" : "#f0fdf4",
                  }}
                >
                  {attackInfo.difficulty}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600 mr-2">{attackInfo.category}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">{attackInfo.datasetSplit}</span>
              <p className="text-sm text-gray-700 mt-2 mb-2 leading-relaxed">{attackInfo.description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="font-semibold text-gray-500 mb-0.5">How it works</div>
                  <div className="text-gray-700 leading-relaxed">{attackInfo.howItWorks}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-500 mb-0.5">Detection signature</div>
                  <div className="text-gray-700 leading-relaxed">{attackInfo.signature}</div>
                </div>
                <div>
                  <div className="font-semibold text-gray-500 mb-0.5">Batch composition</div>
                  <div className="text-gray-700 leading-relaxed">
                    <strong>{attackInfo.batchComposition.attack}</strong> attack + <strong>{attackInfo.batchComposition.benign}</strong> benign = {attackInfo.batchComposition.total} flows
                    <br />
                    <span className="text-gray-500">{attackInfo.totalInDataset.toLocaleString()} total in dataset</span>
                  </div>
                  <div className="text-gray-500 mt-1 italic">{attackInfo.difficultyReason}</div>
                </div>
              </div>
            </div>
          )}

          {/* Experiment Summary Card (for non-Stage1 experiments) */}
          {!attackInfo && (() => {
            const exp = EXPERIMENTS.find(e => e.id === inspectorSource);
            if (!exp) return null;
            return (
              <div className="border border-gray-200 rounded-lg p-5 mb-5 bg-gray-50/80">
                <div className="flex justify-between items-baseline mb-3">
                  <div>
                    <span className="text-[11px] text-gray-400 font-medium">{exp.phase}</span>
                    <span className="text-[11px] text-gray-300 mx-1.5">&middot;</span>
                    <span className="text-[11px] text-gray-400">{exp.model}</span>
                  </div>
                  <span className="text-[11px] text-gray-400">{exp.date}</span>
                </div>
                <h3 className="text-lg font-bold mb-3 tracking-tight">{exp.name}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
                  {[
                    { label: "F1", value: pct(exp.f1) },
                    { label: "Recall", value: pct(exp.recall) },
                    { label: "Precision", value: pct(exp.precision) },
                    { label: "Cost", value: dollar(exp.cost) },
                    { label: "Flows", value: exp.flows },
                    { label: "TP/FP/TN/FN", value: `${exp.confusion.tp}/${exp.confusion.fp}/${exp.confusion.tn}/${exp.confusion.fn}` },
                  ].map(m => (
                    <div key={m.label} className="text-center py-2 px-1 bg-white rounded-md border border-gray-200">
                      <div className="text-base font-bold">{m.value}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>
                {exp.narrative && (
                  <div className="text-sm text-gray-700 leading-relaxed">
                    <strong>What we tried:</strong> {exp.narrative.tried}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Error Attribution */}
          <ErrorAttribution attribution={attribution} />

          {/* Cost Breakdown Card */}
          {(() => {
            const meta = inspectorData?.evaluation_metadata;
            const agentStats = meta?.agent_stats;
            const tier1 = meta?.tier1 || {};
            const metrics = meta?.metrics?.confusion || {};

            // Try per-experiment costs first (most accurate)
            let costData = null;
            let costSource = "";

            if (agentStats) {
              const total = Object.values(agentStats).reduce((s, a) => s + (a.total_cost || 0), 0);
              if (total > 0) {
                costData = {};
                AGENT_KEYS.forEach(k => {
                  const c = agentStats[k]?.total_cost || 0;
                  costData[k] = { cost: c, pct: (c / total * 100) };
                });
                costData._total = total;
                costData._llmFlows = tier1.flows_sent_to_llm || 0;
                costData._filtered = tier1.flows_filtered || 0;
                costData._estWithout = tier1.estimated_cost_without_tier1 || 0;
                costData._tp = metrics.tp || 0;
                costSource = "experiment";
              }
            }

            // Fallback: per-experiment data from stage1.js
            if (!costData && attackType && AGENT_COST_PER_EXPERIMENT[attackType]) {
              const perExp = AGENT_COST_PER_EXPERIMENT[attackType];
              costData = {};
              AGENT_KEYS.forEach(k => {
                costData[k] = { cost: perExp[k] || 0, pct: perExp.total > 0 ? ((perExp[k] || 0) / perExp.total * 100) : 0 };
              });
              costData._total = perExp.total;
              costData._llmFlows = perExp.llmFlows;
              costData._filtered = perExp.filtered;
              costData._estWithout = perExp.estWithout;
              costData._tp = 0;
              costSource = "stage1";
            }

            // Last fallback: skip — don't show misleading global averages
            if (!costData) {
              return null;
            }

            return (
              <div className="border border-gray-200 rounded-lg p-4 mb-5 bg-gray-50/80">
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-sm font-bold">Cost Breakdown</div>
                  {costSource === "average" && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">(estimated avg)</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 mb-3">
                  {[...AGENT_KEYS].sort((a, b) => (costData[b]?.pct || 0) - (costData[a]?.pct || 0)).map(a => (
                    <div key={a} className="flex items-center gap-1.5">
                      <div className="w-16 sm:w-20 text-[10px] text-gray-500 text-right flex-shrink-0">{AGENT_COST_DATA[a].label}</div>
                      <div className="flex-1 bg-gray-200 rounded-sm h-3.5 overflow-hidden min-w-0">
                        <div
                          className="h-full rounded-sm"
                          style={{ width: `${(costData[a].pct / 45) * 100}%`, maxWidth: "100%", background: AGENT_COST_DATA[a].color }}
                        />
                      </div>
                      <div className="w-20 sm:w-24 text-[10px] text-gray-500 font-mono flex-shrink-0">
                        ${costData[a].cost.toFixed(3)} <span className="hidden sm:inline">({costData[a].pct.toFixed(0)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { label: "Total cost", value: `$${costData._total.toFixed(2)}`, bg: "bg-green-50", color: "text-green-800" },
                    { label: "Cost/flow", value: `$${(costData._total / 1000).toFixed(4)}`, bg: "bg-blue-50", color: "text-blue-800" },
                    { label: "Cost/TP", value: costData._tp > 0 ? `$${(costData._total / costData._tp).toFixed(3)}` : "N/A", bg: "bg-yellow-50", color: "text-yellow-800" },
                    { label: "Tier 1 saved", value: `$${(costData._filtered * (costData._total / (costData._llmFlows || 1))).toFixed(2)}`, bg: "bg-green-50", color: "text-green-800" },
                    { label: "Without Tier 1", value: `$${costData._estWithout.toFixed(0)}`, bg: "bg-red-50", color: "text-red-900" },
                  ].map(s => (
                    <div key={s.label} className={`text-center py-2 px-1 ${s.bg} rounded-md`}>
                      <div className={`text-sm font-bold ${s.color} font-mono`}>{s.value}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Verdict distribution cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Malicious", count: pieCounts.malicious, color: "#dc2626", filter: "malicious" },
              { label: "Suspicious", count: pieCounts.suspicious, color: "#d97706", filter: "suspicious" },
              { label: "Benign", count: pieCounts.benign, color: "#16a34a", filter: "benign" },
              { label: "Tier-1 Filtered", count: pieCounts.filtered, color: "#9ca3af", filter: "filtered" },
            ].map(s => (
              <button
                key={s.label}
                onClick={() => { setInspectorFilter(inspectorFilter === s.filter ? "all" : s.filter); setInspectorPage(0); }}
                className="rounded-lg p-4 text-center cursor-pointer bg-white"
                style={{
                  border: inspectorFilter === s.filter ? `2px solid ${s.color}` : "1px solid #e5e7eb",
                }}
              >
                <div className="text-3xl font-bold" style={{ color: s.color }}>{s.count}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
                <div className="mt-2 h-1 rounded-sm bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-sm" style={{ width: `${(s.count / pieTotal) * 100}%`, background: s.color }} />
                </div>
              </button>
            ))}
          </div>

          {/* Example Analysis Chains (Reasoning Showcase) */}
          <ReasoningShowcase flows={inspectorFlows} />

          {/* Search + filter bar */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              type="text"
              placeholder="Search by flow #, verdict, or attack type..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-400"
            />
            <div className="flex gap-1.5 flex-wrap">
              {[
                ["all", "All"],
                ["correct", "Correct"],
                ["wrong", "Wrong"],
                ["attacks", "Attacks"],
                ["benign_actual", "Benign"],
                ["filtered", "Filtered"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => { setInspectorFilter(id); setInspectorPage(0); }}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs cursor-pointer border ${
                    inspectorFilter === id
                      ? "border-blue-600 bg-blue-50 text-blue-600"
                      : "border-gray-200 bg-white text-gray-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Two-column layout: FlowTable + FlowDetail — stacks on mobile */}
          <div
            className="flex flex-col lg:grid lg:gap-5"
            style={{ gridTemplateColumns: selectedFlow ? "45% 55%" : "1fr" }}
          >
            <FlowTable
              flows={filteredFlows}
              page={inspectorPage}
              setPage={setInspectorPage}
              pageSize={FLOWS_PER_PAGE}
              selectedFlowIdx={selectedFlowIdx}
              setSelectedFlowIdx={setSelectedFlowIdx}
            />

            {selectedFlow && (
              <div className="mt-4 lg:mt-0">
                <FlowDetail
                  flow={selectedFlow}
                  expandedPrompts={expandedPrompts}
                  setExpandedPrompts={setExpandedPrompts}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
