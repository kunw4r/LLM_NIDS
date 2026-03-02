import React, { useState, useMemo } from "react";

// Data
import { ATTACK_DESCRIPTIONS, ATTACK_MITRE_MAP, EXPECTED_AGENT_BEHAVIOR } from "../../data/attacks";
import { STAGE1_SUMMARY, AGENT_COST_DATA, AGENT_COST_PER_EXPERIMENT } from "../../data/stage1";
import { AGENT_KEYS, STAGE1_ID_MAP } from "../../data/constants";
import { AGENTS } from "../../data/agents";

// Lib
import { computeErrorAttribution } from "../../lib/errorAttribution";
import { computeAgentSummaries, generateAgentNarrative } from "../../lib/agentSummary";
import { dollar, pct, verdictColor, verdictBg } from "../../lib/format";

// Components
import ErrorAttribution from "./ErrorAttribution";
import ReasoningShowcase from "./ReasoningShowcase";
import FlowTable from "../inspector/FlowTable";
import FlowDetail from "../inspector/FlowDetail";

export default function ExperimentDetail({ attackType, inspector, onBack }) {
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [agentSummaryOpen, setAgentSummaryOpen] = useState(true);

  const {
    inspectorData, inspectorLoading, inspectorError,
    inspectorFilter, setInspectorFilter,
    selectedFlowIdx, setSelectedFlowIdx,
    inspectorPage, setInspectorPage,
    searchQuery, setSearchQuery,
    inspectorFlows, filteredFlows, selectedFlow, pieCounts,
    FLOWS_PER_PAGE, expandedPrompts, setExpandedPrompts,
  } = inspector;

  const attackInfo = ATTACK_DESCRIPTIONS[attackType];
  const mitreTechniques = ATTACK_MITRE_MAP[attackType] || [];
  const expectedBehavior = EXPECTED_AGENT_BEHAVIOR[attackType] || {};
  const experiment = STAGE1_SUMMARY.experiments.find(e => e.attack_type === attackType);
  const cm = experiment?.confusion || {};
  const perExpCost = AGENT_COST_PER_EXPERIMENT[attackType];

  // Compute attribution and agent summaries from loaded flows
  const attribution = useMemo(
    () => inspectorFlows.length > 0 ? computeErrorAttribution(inspectorFlows) : null,
    [inspectorFlows]
  );
  const agentSummaries = useMemo(
    () => inspectorFlows.length > 0 ? computeAgentSummaries(inspectorFlows) : null,
    [inspectorFlows]
  );

  const pieTotal = inspectorFlows.length || 1;

  // Difficulty styling
  const diffColor = !attackInfo ? "#6b7280"
    : attackInfo.difficulty === "Hardest" || attackInfo.difficulty === "Hard" ? "#dc2626"
    : attackInfo.difficulty === "Medium" ? "#d97706" : "#16a34a";
  const diffBg = !attackInfo ? "#f9fafb"
    : attackInfo.difficulty === "Hardest" || attackInfo.difficulty === "Hard" ? "#fef2f2"
    : attackInfo.difficulty === "Medium" ? "#fffbeb" : "#f0fdf4";

  return (
    <div>
      {/* ── Section 1: Header + Back ─────────────────────────── */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="text-xs text-blue-600 cursor-pointer bg-transparent border-none p-0 mb-3 hover:underline"
        >
          &larr; Back to Stage 1 Results
        </button>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs text-gray-400">Stage 1 Results</span>
          <span className="text-xs text-gray-300">/</span>
          <span className="text-xs text-gray-600 font-medium">{attackInfo?.name || attackType}</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight m-0 mb-2">
          {attackInfo?.name || attackType}
        </h2>
        <div className="flex gap-2 items-center flex-wrap">
          {attackInfo && (
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600">
              {attackInfo.category}
            </span>
          )}
          {attackInfo && (
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ color: diffColor, background: diffBg }}>
              {attackInfo.difficulty}
            </span>
          )}
          {mitreTechniques.map(t => (
            <span key={t.id} className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
              {t.id}: {t.name}
            </span>
          ))}
        </div>
      </div>

      {/* ── Section 2: Attack Explainer (collapsible) ──────── */}
      {attackInfo && (
        <div className="border border-gray-200 rounded-lg mb-5 overflow-hidden">
          <button
            onClick={() => setExplainerOpen(p => !p)}
            className="w-full flex justify-between items-center px-5 py-3 bg-gray-50 cursor-pointer border-none text-left"
          >
            <span className="text-sm font-semibold text-gray-700">About This Attack</span>
            <span className="text-xs text-gray-400">{explainerOpen ? "Collapse" : "Expand"}</span>
          </button>
          {explainerOpen && (
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 leading-relaxed mb-3">{attackInfo.description} {attackInfo.howItWorks}</p>
              <div className="text-xs text-gray-600 mb-3">
                <strong>Detection signature:</strong> {attackInfo.signature}
              </div>
              <div className="text-xs text-gray-500 mb-4 italic">{attackInfo.difficultyReason}</div>

              {/* Expected agent behavior */}
              {Object.keys(expectedBehavior).length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-gray-600 mb-2">Expected Agent Behavior</div>
                  <div className="grid grid-cols-2 gap-2">
                    {AGENTS.map(agent => {
                      const exp = expectedBehavior[agent.id];
                      if (!exp) return null;
                      return (
                        <div key={agent.id} className="border border-gray-100 rounded-md p-2.5">
                          <div className="text-[11px] font-semibold mb-0.5" style={{ color: agent.color }}>
                            {agent.name}
                          </div>
                          <div className="text-[11px] text-gray-600 leading-relaxed">{exp}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Section 3: Experiment Config ───────────────────── */}
      <div className="border border-gray-200 rounded-lg p-4 mb-5 bg-gray-50/60">
        <div className="text-xs font-semibold text-gray-500 mb-2">Experiment Configuration</div>
        <div className="flex gap-4 flex-wrap text-xs text-gray-700">
          <span><strong>Model:</strong> GPT-4o</span>
          <span><strong>Tier 1 Threshold:</strong> 0.15</span>
          <span><strong>Batch:</strong> {attackInfo ? `${attackInfo.batchComposition.attack}a / ${attackInfo.batchComposition.benign}b` : "50a / 950b"}</span>
          <span><strong>DA Weight:</strong> 30%</span>
          <span><strong>Cost Limit:</strong> $5.00</span>
          <span><strong>Seed:</strong> 42</span>
          {attackInfo && <span><strong>Dataset:</strong> {attackInfo.datasetSplit} ({attackInfo.totalInDataset.toLocaleString()} total)</span>}
        </div>
      </div>

      {/* ── Section 4: Results Summary ─────────────────────── */}
      {experiment && (
        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Left: Confusion matrix + metrics */}
          <div className="border border-gray-200 rounded-lg p-5">
            <div className="text-sm font-semibold mb-3">Results</div>

            {/* Confusion matrix */}
            <div className="grid mb-4" style={{ gridTemplateColumns: "90px 1fr 1fr", maxWidth: 300 }}>
              <div className="p-2 text-xs text-gray-500"></div>
              <div className="p-2 text-xs font-semibold text-gray-500 text-center border-b border-gray-200">Pred Benign</div>
              <div className="p-2 text-xs font-semibold text-gray-500 text-center border-b border-gray-200">Pred Attack</div>
              <div className="p-2 text-xs font-semibold text-gray-500 border-r border-gray-200">True Benign</div>
              <div className="p-2 text-center text-lg font-bold text-green-600 bg-green-50 rounded-tl">{cm.tn}</div>
              <div className="p-2 text-center text-lg font-bold rounded-tr" style={{ color: cm.fp > 0 ? "#dc2626" : "#16a34a", background: cm.fp > 0 ? "#fef2f2" : "#f0fdf4" }}>{cm.fp}</div>
              <div className="p-2 text-xs font-semibold text-gray-500 border-r border-gray-200">True Attack</div>
              <div className="p-2 text-center text-lg font-bold rounded-bl" style={{ color: cm.fn > 0 ? "#dc2626" : "#16a34a", background: cm.fn > 0 ? "#fef2f2" : "#f0fdf4" }}>{cm.fn}</div>
              <div className="p-2 text-center text-lg font-bold text-green-600 bg-green-50 rounded-br">{cm.tp}</div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Recall", value: `${experiment.recall}%`, color: experiment.recall >= 80 ? "#16a34a" : experiment.recall >= 50 ? "#d97706" : "#dc2626" },
                { label: "FPR", value: `${experiment.fpr}%`, color: experiment.fpr === 0 ? "#16a34a" : "#dc2626" },
                { label: "F1", value: `${experiment.f1}%`, color: "#2563eb" },
              ].map(m => (
                <div key={m.label} className="text-center py-2 border border-gray-200 rounded-md">
                  <div className="text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
                  <div className="text-[10px] text-gray-500">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Verdict distribution bar */}
            {inspectorFlows.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Verdict Distribution</div>
                <div className="flex h-4 rounded overflow-hidden">
                  {[
                    { count: pieCounts.malicious, color: "#dc2626", label: "Malicious" },
                    { count: pieCounts.suspicious, color: "#d97706", label: "Suspicious" },
                    { count: pieCounts.benign, color: "#16a34a", label: "Benign" },
                    { count: pieCounts.filtered, color: "#9ca3af", label: "Filtered" },
                  ].filter(s => s.count > 0).map(s => (
                    <div
                      key={s.label}
                      style={{ width: `${(s.count / pieTotal) * 100}%`, background: s.color }}
                      title={`${s.label}: ${s.count}`}
                    />
                  ))}
                </div>
                <div className="flex gap-3 mt-1">
                  {[
                    { count: pieCounts.malicious, color: "#dc2626", label: "Malicious" },
                    { count: pieCounts.suspicious, color: "#d97706", label: "Suspicious" },
                    { count: pieCounts.benign, color: "#16a34a", label: "Benign" },
                    { count: pieCounts.filtered, color: "#9ca3af", label: "Filtered" },
                  ].filter(s => s.count > 0).map(s => (
                    <span key={s.label} className="text-[10px] text-gray-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm inline-block" style={{ background: s.color }} />
                      {s.label} {s.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Error attribution + RF vs LLM */}
          <div>
            <ErrorAttribution attribution={attribution} />
            {perExpCost && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/60">
                <div className="text-xs text-gray-600 leading-relaxed">
                  <strong>Tier 1 filtered {perExpCost.filtered}</strong> of 1000 flows ({((perExpCost.filtered / 1000) * 100).toFixed(0)}%) — <strong>LLM analysed {perExpCost.llmFlows}</strong>.
                </div>
                {attribution && (
                  <div className="text-xs text-gray-500 mt-1">
                    {attribution.fnFromTier1 > 0
                      ? `RF missed ${attribution.fnFromTier1} attack${attribution.fnFromTier1 !== 1 ? "s" : ""}`
                      : "RF caught all attacks"}
                    {" | "}
                    {attribution.fnFromLLM > 0
                      ? `LLM missed ${attribution.fnFromLLM} attack${attribution.fnFromLLM !== 1 ? "s" : ""}`
                      : "LLM caught all passed attacks"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Section 5: Cost Breakdown ──────────────────────── */}
      {perExpCost && (
        <div className="border border-gray-200 rounded-lg p-5 mb-5">
          <div className="text-sm font-semibold mb-3">Cost Breakdown</div>

          {/* Horizontal bars */}
          <div className="flex flex-col gap-1.5 mb-4">
            {[...AGENT_KEYS].sort((a, b) => (perExpCost[b] || 0) - (perExpCost[a] || 0)).map(a => {
              const cost = perExpCost[a] || 0;
              const pctVal = perExpCost.total > 0 ? (cost / perExpCost.total * 100) : 0;
              return (
                <div key={a} className="flex items-center gap-2">
                  <div className="w-24 text-xs text-gray-500 text-right">{AGENT_COST_DATA[a].label}</div>
                  <div className="flex-1 bg-gray-100 rounded-sm h-4 overflow-hidden">
                    <div
                      className="h-full rounded-sm flex items-center justify-end pr-1"
                      style={{ width: `${(pctVal / 45) * 100}%`, maxWidth: "100%", background: AGENT_COST_DATA[a].color }}
                    >
                      {pctVal >= 10 && <span className="text-[9px] text-white font-semibold">{pctVal.toFixed(0)}%</span>}
                    </div>
                  </div>
                  <div className="w-28 text-[11px] text-gray-500 font-mono">${cost.toFixed(3)} ({pctVal.toFixed(0)}%)</div>
                </div>
              );
            })}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-5 gap-2">
            {[
              { label: "Total cost", value: dollar(perExpCost.total), bg: "bg-green-50", color: "text-green-800" },
              { label: "Cost/flow", value: `$${(perExpCost.total / 1000).toFixed(4)}`, bg: "bg-blue-50", color: "text-blue-800" },
              { label: "Cost/TP", value: cm.tp > 0 ? `$${(perExpCost.total / cm.tp).toFixed(3)}` : "\u2014", bg: "bg-yellow-50", color: "text-yellow-800" },
              { label: "Tier 1 saved", value: `$${(perExpCost.filtered * (perExpCost.total / (perExpCost.llmFlows || 1))).toFixed(2)}`, bg: "bg-green-50", color: "text-green-800" },
              { label: "Without Tier 1", value: `$${perExpCost.estWithout.toFixed(0)}`, bg: "bg-red-50", color: "text-red-900" },
            ].map(s => (
              <div key={s.label} className={`text-center py-2.5 px-1 ${s.bg} rounded-md`}>
                <div className={`text-sm font-bold ${s.color} font-mono`}>{s.value}</div>
                <div className="text-[9px] text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 6: Agent Summaries ─────────────────────── */}
      {agentSummaries && (
        <div className="mb-5">
          <button
            onClick={() => setAgentSummaryOpen(p => !p)}
            className="text-sm font-semibold mb-3 cursor-pointer bg-transparent border-none p-0 text-gray-900 hover:text-blue-600"
          >
            Agent Summaries {agentSummaryOpen ? "\u25BC" : "\u25B6"}
          </button>
          {agentSummaryOpen && (
            <div className="grid grid-cols-2 gap-3">
              {AGENTS.map(agent => {
                const s = agentSummaries[agent.id];
                if (!s) return null;
                const narrative = generateAgentNarrative(agent.id, s, attackType);
                const isSpecialist = agent.id !== "devils_advocate" && agent.id !== "orchestrator";
                const isDA = agent.id === "devils_advocate";
                const isOrch = agent.id === "orchestrator";

                return (
                  <div key={agent.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold uppercase" style={{ color: agent.color }}>{agent.name}</span>
                      <span className="text-[10px] text-gray-400">{s.count || 0} flows</span>
                    </div>

                    {/* Specialist verdict stacked bar */}
                    {isSpecialist && s.verdicts && (
                      <div className="mb-2">
                        <div className="flex h-3 rounded overflow-hidden mb-1">
                          {[
                            { key: "MALICIOUS", color: "#dc2626" },
                            { key: "SUSPICIOUS", color: "#d97706" },
                            { key: "BENIGN", color: "#16a34a" },
                          ].filter(v => s.verdicts[v.key] > 0).map(v => (
                            <div
                              key={v.key}
                              style={{ width: `${(s.verdicts[v.key] / (s.count || 1)) * 100}%`, background: v.color }}
                              title={`${v.key}: ${s.verdicts[v.key]}`}
                            />
                          ))}
                        </div>
                        <div className="flex gap-2 text-[9px] text-gray-500">
                          <span style={{ color: "#dc2626" }}>{s.verdicts.MALICIOUS} mal</span>
                          <span style={{ color: "#d97706" }}>{s.verdicts.SUSPICIOUS} sus</span>
                          <span style={{ color: "#16a34a" }}>{s.verdicts.BENIGN} ben</span>
                        </div>
                      </div>
                    )}

                    {/* Specialist stats */}
                    {isSpecialist && (
                      <div className="text-[11px] text-gray-500 mb-1">
                        Avg confidence: <strong>{(s.avgConfidence * 100).toFixed(0)}%</strong>
                        {s.topAttackType && <> | Top type: <strong>{s.topAttackType}</strong></>}
                      </div>
                    )}

                    {/* Temporal patterns */}
                    {agent.id === "temporal" && s.temporalPatterns && Object.keys(s.temporalPatterns).length > 0 && (
                      <div className="flex gap-1 flex-wrap mb-1">
                        {Object.entries(s.temporalPatterns).sort((a, b) => b[1] - a[1]).map(([p, c]) => (
                          <span key={p} className="px-1.5 py-0.5 bg-pink-50 text-pink-700 rounded text-[9px]">
                            {p}: {c}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* DA stats */}
                    {isDA && (
                      <div className="mb-1">
                        <div className="text-[11px] text-gray-500">
                          Avg benign confidence: <strong>{(s.avgConfBenign * 100).toFixed(0)}%</strong>
                        </div>
                        {s.topBenignIndicator && (
                          <div className="text-[10px] text-gray-400 mt-0.5 truncate" title={s.topBenignIndicator}>
                            Top argument: "{s.topBenignIndicator}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Orchestrator stats */}
                    {isOrch && (
                      <div className="mb-2">
                        <div className="flex h-3 rounded overflow-hidden mb-1">
                          {[
                            { key: "MALICIOUS", color: "#dc2626" },
                            { key: "SUSPICIOUS", color: "#d97706" },
                            { key: "BENIGN", color: "#16a34a" },
                          ].filter(v => s.verdicts[v.key] > 0).map(v => (
                            <div
                              key={v.key}
                              style={{ width: `${(s.verdicts[v.key] / (s.count || 1)) * 100}%`, background: v.color }}
                              title={`${v.key}: ${s.verdicts[v.key]}`}
                            />
                          ))}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          Avg confidence: <strong>{(s.avgConfidence * 100).toFixed(0)}%</strong>
                          {" | "}Avg consensus: <strong>{(s.avgConsensus * 100).toFixed(0)}%</strong>
                        </div>
                        {s.topMitreTechniques?.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {s.topMitreTechniques.map(t => (
                              <span key={t} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px]">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Narrative */}
                    <div className="text-[11px] text-gray-600 leading-relaxed mt-1 border-t border-gray-100 pt-2">
                      {narrative}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Section 7: Reasoning Showcase ──────────────────── */}
      {inspectorFlows.length > 0 && (
        <ReasoningShowcase flows={inspectorFlows} />
      )}

      {/* ── Section 8: Flow Inspector ──────────────────────── */}
      {inspectorLoading && (
        <div className="border border-gray-200 rounded-lg p-12 text-center text-gray-500">
          Loading flow data...
        </div>
      )}

      {inspectorError && !inspectorData && (
        <div className="border border-red-300 rounded-lg p-6 bg-red-50 text-red-600 text-sm">
          Failed to load: {inspectorError}
        </div>
      )}

      {inspectorFlows.length > 0 && (
        <>
          <div className="text-sm font-semibold mb-3">Flow Inspector</div>

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

          {/* Two-column: table + detail */}
          <div
            className="grid gap-5"
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
  );
}
