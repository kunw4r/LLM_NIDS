import React, { useState } from "react";
import { AGENT_COST_DATA, AGENT_COST_PER_EXPERIMENT } from "../../data/stage1";
import { RF_TRAINED_TYPES, RF_CAUGHT_UNSEEN, DATASET_SPLITS, AGENT_KEYS, STAGE1_ID_MAP } from "../../data/constants";
import { ATTACK_DESCRIPTIONS } from "../../data/attacks";
import { dollar } from "../../lib/format";

export default function Stage1Results({ s1, leakySummary, liveStatus, onInspectFlows, onOpenDetail, showCostBreakdown, setShowCostBreakdown }) {
  const [expandedS1Rows, setExpandedS1Rows] = useState({});

  return (
    <div>
      {/* Header */}
      <h2 className="text-xl font-bold mb-1 tracking-tight">Per-Attack-Type Detection at 5% Prevalence</h2>
      <p className="text-sm text-gray-500 mb-6">
        Each batch: 950 benign + 50 attack flows. Tier-1 RF pre-filter reduces LLM calls by ~95%.
      </p>

      {/* ── RECALL BAR CHART ──────────────────────────────────── */}
      <div className="border border-gray-200 rounded-lg p-6 mb-6">
        <div className="text-sm font-semibold mb-4">Detection Recall by Attack Type</div>
        {[...s1.experiments].sort((a, b) => (b.recall || 0) - (a.recall || 0)).map(exp => {
          const recall = exp.recall || 0;
          const barColor = recall === 0 ? "#dc2626" : recall >= 80 ? "#16a34a" : recall >= 50 ? "#d97706" : "#dc2626";
          return (
            <div key={exp.attack_type} className="flex items-center gap-2 mb-1.5">
              <div className="w-44 text-xs text-gray-700 text-right flex-shrink-0 overflow-hidden text-ellipsis whitespace-nowrap">
                {exp.attack_type.replace(/_/g, " ")}
              </div>
              <div className="flex-1 h-[22px] bg-gray-100 rounded overflow-hidden relative">
                {/* 80% threshold line */}
                <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-gray-400 z-10" style={{ left: "80%" }} />
                <div
                  className="h-full rounded flex items-center justify-end"
                  style={{
                    width: `${recall}%`,
                    background: barColor,
                    paddingRight: recall > 10 ? 8 : 0,
                    minWidth: recall > 0 ? 2 : 0,
                  }}
                >
                  {recall >= 15 && <span className="text-xs font-bold text-white">{recall}%</span>}
                </div>
              </div>
              {recall < 15 && <span className="text-xs font-semibold" style={{ color: barColor, minWidth: 35 }}>{recall}%</span>}
            </div>
          );
        })}
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <div className="w-44" />
          <div className="flex-1 relative">
            <span className="absolute text-[10px] text-gray-500" style={{ left: "78%" }}>80% threshold</span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Best F1", value: `${s1.overall.best_f1}%`, sub: s1.overall.best_detected || "\u2014" },
          { label: "Total Flows", value: s1.overall.total_flows.toLocaleString(), sub: `${s1.experiments.length} attack types tested` },
          { label: "Avg FPR", value: `${s1.overall.avg_fpr.toFixed(1)}%`, sub: "False positive rate" },
          { label: "Total Cost", value: dollar(s1.overall.total_cost), sub: `$${(s1.overall.total_cost / (s1.overall.total_flows || 1)).toFixed(4)}/flow` },
        ].map(c => (
          <div key={c.label} className="border border-gray-200 rounded-lg p-5">
            <div className="text-3xl font-bold tracking-tight">{c.value}</div>
            <div className="text-sm font-semibold text-gray-900 mt-1">{c.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Cost breakdown toggle */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setShowCostBreakdown(p => !p)}
          className={`px-3.5 py-1.5 rounded-md text-xs cursor-pointer border ${
            showCostBreakdown
              ? "border-blue-600 bg-blue-50 text-blue-600"
              : "border-gray-200 bg-white text-gray-500"
          }`}
        >
          {showCostBreakdown ? "Hide cost breakdown" : "Show cost breakdown"}
        </button>
      </div>

      {/* Results table with expandable confusion matrices */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              {["Attack Type", "Data Split", "Recall", "FPR", "F1", "Cost", "$/TP"].map(h => (
                <th
                  key={h}
                  className={`px-4 py-3 font-semibold text-gray-500 text-xs border-b border-gray-200 ${
                    h === "Attack Type" ? "text-left" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s1.experiments.map(exp => {
              const expId = STAGE1_ID_MAP[exp.attack_type];
              const isExpanded = expandedS1Rows[exp.attack_type];
              const cm = exp.confusion || {};
              return (
                <React.Fragment key={exp.attack_type}>
                  <tr
                    onClick={() => setExpandedS1Rows(p => ({ ...p, [exp.attack_type]: !p[exp.attack_type] }))}
                    className="cursor-pointer hover:bg-gray-50"
                    style={{ borderBottom: isExpanded ? "none" : "1px solid #f3f4f6" }}
                  >
                    <td className="px-4 py-3 font-medium text-blue-600">
                      <span className="mr-1.5 text-[10px] text-gray-400">{isExpanded ? "\u25BC" : "\u25B6"}</span>
                      {exp.attack_type}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {RF_TRAINED_TYPES.has(exp.attack_type) ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">dev_eval</span>
                      ) : RF_CAUGHT_UNSEEN.has(exp.attack_type) ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">validation</span>
                      ) : DATASET_SPLITS.test.attacks[exp.attack_type] != null ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">test</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">validation</span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-semibold"
                      style={{ color: (exp.recall || 0) >= 80 ? "#16a34a" : (exp.recall || 0) >= 50 ? "#d97706" : "#dc2626" }}
                    >
                      {exp.recall}%
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: exp.fpr > 5 ? "#dc2626" : "#6b7280" }}>
                      {exp.fpr}%
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">{exp.f1}%</td>
                    <td className="px-4 py-3 text-right text-gray-500">{dollar(exp.cost)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {exp.cost_per_tp === Infinity ? "\u2014" : dollar(exp.cost_per_tp)}
                    </td>
                  </tr>

                  {/* Expanded confusion matrix + attack info + cost breakdown */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={7} className="px-4 pb-4 bg-gray-50 border-b border-gray-200">
                        {/* Attack description */}
                        {(() => {
                          const info = ATTACK_DESCRIPTIONS[exp.attack_type];
                          if (!info) return null;
                          return (
                            <div className="mb-3 pb-3 border-b border-gray-200">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-xs font-bold text-gray-800">{info.name}</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-200 text-gray-600">{info.category}</span>
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                  style={{
                                    color: info.difficulty === "Hardest" || info.difficulty === "Hard" ? "#dc2626" : info.difficulty === "Medium" ? "#d97706" : "#16a34a",
                                    background: info.difficulty === "Hardest" || info.difficulty === "Hard" ? "#fef2f2" : info.difficulty === "Medium" ? "#fffbeb" : "#f0fdf4",
                                  }}
                                >
                                  {info.difficulty}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 leading-relaxed m-0 mb-1">{info.description} {info.howItWorks}</p>
                              <div className="text-[11px] text-gray-500">
                                <strong>Signature:</strong> {info.signature}
                              </div>
                              <div className="text-[11px] text-gray-500 mt-0.5">
                                <strong>Batch:</strong> {info.batchComposition.attack} attack + {info.batchComposition.benign} benign = {info.batchComposition.total} flows
                                <span className="text-gray-400 ml-2">({info.totalInDataset.toLocaleString()} total in {info.datasetSplit})</span>
                              </div>
                            </div>
                          );
                        })()}

                        <div className="flex gap-6 items-start">
                          {/* Confusion Matrix */}
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-gray-500 mb-2">Confusion Matrix</div>
                            <div className="grid max-w-xs" style={{ gridTemplateColumns: "100px 1fr 1fr" }}>
                              <div className="p-2 text-xs text-gray-500"></div>
                              <div className="p-2 text-xs font-semibold text-gray-500 text-center border-b border-gray-200">Pred Benign</div>
                              <div className="p-2 text-xs font-semibold text-gray-500 text-center border-b border-gray-200">Pred Attack</div>
                              <div className="p-2 text-xs font-semibold text-gray-500 border-r border-gray-200">True Benign</div>
                              <div className="p-2 text-center text-base font-bold text-green-600 bg-green-50 rounded-tl">{cm.tn}</div>
                              <div
                                className="p-2 text-center text-base font-bold rounded-tr"
                                style={{
                                  color: cm.fp > 0 ? "#dc2626" : "#16a34a",
                                  background: cm.fp > 0 ? "#fef2f2" : "#f0fdf4",
                                }}
                              >
                                {cm.fp}
                              </div>
                              <div className="p-2 text-xs font-semibold text-gray-500 border-r border-gray-200">True Attack</div>
                              <div
                                className="p-2 text-center text-base font-bold rounded-bl"
                                style={{
                                  color: cm.fn > 0 ? "#dc2626" : "#16a34a",
                                  background: cm.fn > 0 ? "#fef2f2" : "#f0fdf4",
                                }}
                              >
                                {cm.fn}
                              </div>
                              <div className="p-2 text-center text-base font-bold text-green-600 bg-green-50 rounded-br">{cm.tp}</div>
                            </div>
                            <div className="text-xs text-gray-700 mt-2.5 leading-relaxed">
                              Detected <strong>{cm.tp}</strong> of 50 attacks.{" "}
                              {cm.fp === 0
                                ? "Zero false alarms on 950 benign flows. "
                                : `${cm.fp} false alarm${cm.fp !== 1 ? "s" : ""} on 950 benign flows. `}
                              {cm.fn === 0 ? "No attacks missed." : `${cm.fn} attack${cm.fn !== 1 ? "s" : ""} missed.`}
                            </div>
                          </div>

                          {/* Quick actions */}
                          <div className="flex flex-col gap-2 min-w-[140px]">
                            {onOpenDetail && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenDetail(exp.attack_type);
                                }}
                                className="px-4 py-2 border border-blue-600 rounded-md bg-blue-600 text-white text-xs font-medium cursor-pointer"
                              >
                                View Detail
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                expId && onInspectFlows(expId);
                              }}
                              className="px-4 py-2 border border-gray-300 rounded-md bg-white text-gray-700 text-xs font-medium cursor-pointer"
                            >
                              Inspect Flows
                            </button>
                          </div>
                        </div>

                        {/* Inline cost breakdown bar — per-experiment data */}
                        {showCostBreakdown && (() => {
                          const perExp = AGENT_COST_PER_EXPERIMENT[exp.attack_type];
                          if (!perExp) return null;
                          return (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="text-xs text-gray-500 mb-1.5">
                                Agent cost distribution &middot; {perExp.llmFlows} flows to LLM &middot; {perExp.filtered} filtered
                              </div>
                              <div className="flex h-3.5 rounded overflow-hidden mb-1.5">
                                {AGENT_KEYS.map(a => {
                                  const pctVal = (perExp[a] / perExp.total * 100);
                                  return (
                                    <div
                                      key={a}
                                      style={{ width: `${pctVal}%`, background: AGENT_COST_DATA[a].color }}
                                      title={`${AGENT_COST_DATA[a].label}: $${perExp[a].toFixed(3)} (${pctVal.toFixed(0)}%)`}
                                    />
                                  );
                                })}
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                {[...AGENT_KEYS].sort((a, b) => perExp[b] - perExp[a]).map(a => {
                                  const pctVal = (perExp[a] / perExp.total * 100);
                                  return (
                                    <span key={a} className="text-[10px] text-gray-500 flex items-center gap-1">
                                      <span
                                        className="w-[7px] h-[7px] rounded-sm inline-block"
                                        style={{ background: AGENT_COST_DATA[a].color }}
                                      />
                                      {AGENT_COST_DATA[a].label} {pctVal.toFixed(0)}%
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cost insight */}
      {showCostBreakdown && (
        <div className="border border-gray-200 rounded-lg px-5 py-4 mt-3 bg-gray-50">
          <div className="text-xs text-gray-700 leading-relaxed mb-2.5">
            <strong>
              Orchestrator + Devil's Advocate account for ~
              {(AGENT_COST_DATA.orchestrator.pct + AGENT_COST_DATA.devils_advocate.pct).toFixed(0)}% of all LLM spend
            </strong>{" "}
            — they receive all specialist outputs as context, making their prompts significantly longer. Temporal agent
            cost varies most across attack types — higher for attacks with many flows from the same IP.
          </div>
          <div className="text-xs text-gray-500 leading-relaxed">
            DoS variants (Hulk, Slowloris, GoldenEye, SlowHTTPTest) show temporal costs of 40%+ because source IPs
            generate dozens of nearly identical flows that get injected as context. Brute-force and DDoS attacks show
            17-24% temporal cost due to fewer connected flows per IP. Infiltration is lowest overall ($0.80) because 97%
            of flows were filtered by Tier 1.
          </div>
        </div>
      )}

      {/* Remaining attack types — only show if pipeline still running */}
      {liveStatus && liveStatus.experiments_queued?.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-6 mt-4 text-center text-gray-400">
          <p className="text-sm mb-2">
            {liveStatus.experiments_queued.length} more attack type
            {liveStatus.experiments_queued.length !== 1 ? "s" : ""} queued for evaluation
          </p>
          <p className="text-xs">{liveStatus.experiments_queued.join(", ")}</p>
        </div>
      )}

      {/* Within-Split Impact Comparison — shows when rerun data exists for dev-split types */}
      {leakySummary?.experiments?.length > 0 &&
        (() => {
          const leakyByType = {};
          leakySummary.experiments.forEach(e => {
            leakyByType[e.attack_type] = e;
          });
          const cleanByType = {};
          s1.experiments.forEach(e => {
            cleanByType[e.attack_type] = e;
          });
          const affectedRows = [...RF_TRAINED_TYPES]
            .filter(at => leakyByType[at] && cleanByType[at])
            .map(at => {
              const leaky = leakyByType[at];
              const clean = cleanByType[at];
              return {
                at,
                leaky,
                clean,
                recallDelta: clean.recall - leaky.recall,
                f1Delta: clean.f1 - leaky.f1,
                costDelta: clean.cost - leaky.cost,
              };
            });
          if (affectedRows.length === 0) return null;
          return (
            <div className="border border-gray-200 rounded-lg overflow-hidden mt-5">
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                <div className="text-sm font-semibold">Within-Split Overlap Impact — Dev-Split Batches vs Clean Batches</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Comparing results from dev-sourced batches (RF overlap) vs val/test-sourced batches (no overlap)
                </div>
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    {["Attack Type", "Leaky Recall", "Clean Recall", "\u0394 Recall", "Leaky F1", "Clean F1", "\u0394 F1", "\u0394 Cost"].map(h => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 font-semibold text-gray-500 text-xs border-b border-gray-200 ${
                          h === "Attack Type" ? "text-left" : "text-right"
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {affectedRows.map(r => (
                    <tr key={r.at} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td className="px-3 py-2.5 font-medium">{r.at}</td>
                      <td className="px-3 py-2.5 text-right">{r.leaky.recall}%</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{r.clean.recall}%</td>
                      <td
                        className="px-3 py-2.5 text-right font-semibold"
                        style={{ color: r.recallDelta > 0 ? "#16a34a" : r.recallDelta < 0 ? "#dc2626" : "#6b7280" }}
                      >
                        {r.recallDelta > 0 ? "+" : ""}
                        {r.recallDelta}pp
                      </td>
                      <td className="px-3 py-2.5 text-right">{r.leaky.f1}%</td>
                      <td className="px-3 py-2.5 text-right font-semibold">{r.clean.f1}%</td>
                      <td
                        className="px-3 py-2.5 text-right font-semibold"
                        style={{ color: r.f1Delta > 0 ? "#16a34a" : r.f1Delta < 0 ? "#dc2626" : "#6b7280" }}
                      >
                        {r.f1Delta > 0 ? "+" : ""}
                        {r.f1Delta}pp
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-500">
                        {r.costDelta > 0 ? "+" : ""}
                        {dollar(r.costDelta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
    </div>
  );
}
