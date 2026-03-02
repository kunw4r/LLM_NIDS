import React from "react";
import { EXPERIMENTS } from "../../data/experiments";
import { STAGE1_SUMMARY, AGENT_COST_DATA, AGENT_COST_PER_EXPERIMENT } from "../../data/stage1";
import { AGENT_KEYS, STAGE1_ID_MAP } from "../../data/constants";
import { pct, dollar, verdictColor, verdictBg } from "../../lib/format";
import FlowTable from "./FlowTable";
import FlowDetail from "./FlowDetail";

export default function FlowInspectorDrawer({ open, onClose, inspector }) {
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
    lastFetched,
  } = inspector;

  const pieTotal = inspectorFlows.length || 1;

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 bg-white shadow-2xl transition-transform duration-300 overflow-y-auto"
        style={{ width: "60%" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold tracking-tight">Flow Inspector</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-4">
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

              {/* Experiment Summary Card */}
              {(() => {
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

                    {/* Metrics grid */}
                    <div className="grid grid-cols-6 gap-2 mb-4">
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

                    {/* Variables pills */}
                    {exp.variables && (
                      <div className="flex gap-2 flex-wrap mb-3">
                        {Object.entries(exp.variables).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[11px] text-gray-500">
                            {k.replace(/_/g, " ")}: <strong className="text-gray-700">{v}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Narrative */}
                    {exp.narrative && (
                      <div className="text-sm text-gray-700 leading-relaxed">
                        <strong>What we tried:</strong> {exp.narrative.tried}
                        <br /><strong>What happened:</strong> {exp.narrative.happened}
                        <br /><strong className="italic">Learned:</strong> <em>{exp.narrative.learned}</em>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Cost Breakdown Card */}
              {(() => {
                const meta = inspectorData?.evaluation_metadata;
                const agentStats = meta?.agent_stats;
                const tier1 = meta?.tier1 || {};
                const metrics = meta?.metrics?.confusion || {};

                let costData = null;
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
                  }
                }
                if (!costData) {
                  costData = {};
                  AGENT_KEYS.forEach(k => {
                    costData[k] = { cost: AGENT_COST_DATA[k].cost / 14, pct: AGENT_COST_DATA[k].pct };
                  });
                  costData._total = AGENT_COST_DATA.avgPerBatch;
                  costData._llmFlows = Math.round(AGENT_COST_DATA.totalLlmFlows / 14);
                  costData._filtered = Math.round(AGENT_COST_DATA.totalFiltered / 14);
                  costData._estWithout = AGENT_COST_DATA.estWithoutTier1 / 14;
                  costData._tp = 0;
                }

                if (!costData) return null;
                return (
                  <div className="border border-gray-200 rounded-lg p-4 mb-5 bg-gray-50/80">
                    <div className="text-sm font-bold mb-3">Cost Breakdown</div>
                    <div className="flex flex-col gap-1 mb-3">
                      {[...AGENT_KEYS].sort((a, b) => (costData[b]?.pct || 0) - (costData[a]?.pct || 0)).map(a => (
                        <div key={a} className="flex items-center gap-1.5">
                          <div className="w-20 text-[10px] text-gray-500 text-right">{AGENT_COST_DATA[a].label}</div>
                          <div className="flex-1 bg-gray-200 rounded-sm h-3.5 overflow-hidden">
                            <div
                              className="h-full rounded-sm"
                              style={{ width: `${(costData[a].pct / 45) * 100}%`, maxWidth: "100%", background: AGENT_COST_DATA[a].color }}
                            />
                          </div>
                          <div className="w-20 text-[10px] text-gray-500 font-mono">
                            ${costData[a].cost.toFixed(3)} ({costData[a].pct.toFixed(0)}%)
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
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
              <div className="grid grid-cols-4 gap-3 mb-5">
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

              {/* Search + filter bar */}
              <div className="flex gap-2 mb-3 items-center">
                <input
                  type="text"
                  placeholder="Search by flow #, verdict, or attack type..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm outline-none focus:border-blue-400"
                />
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
                    className={`px-3 py-2 rounded-md text-xs cursor-pointer border ${
                      inspectorFilter === id
                        ? "border-blue-600 bg-blue-50 text-blue-600"
                        : "border-gray-200 bg-white text-gray-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Two-column layout: FlowTable + FlowDetail */}
              <div
                className="grid gap-5"
                style={{ gridTemplateColumns: selectedFlow ? "1fr 1fr" : "1fr" }}
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
                  <FlowDetail
                    flow={selectedFlow}
                    expandedPrompts={expandedPrompts}
                    setExpandedPrompts={setExpandedPrompts}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
