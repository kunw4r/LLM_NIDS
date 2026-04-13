import React, { useState } from "react";
import { BALANCED_META, BALANCED_RESULTS, BALANCED_AGGREGATE, BALANCED_REASONING_EXAMPLES } from "../../data/balanced";

export default function BalancedComparison() {
  const [expandedExample, setExpandedExample] = useState("xss-ike-port");

  // Group results by batch, with amatas + vanilla side by side
  const batchNames = [...new Set(BALANCED_RESULTS.map(r => r.batch))].sort();
  const getRow = (batch, mode) => BALANCED_RESULTS.find(r => r.batch === batch && r.mode === mode);

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────── */}
      <h2 className="text-xl font-bold mb-1 tracking-tight">Multi-Agent vs Single-LLM Baseline</h2>
      <p className="text-sm text-gray-500 mb-5">
        Balanced 50/50 batches (25 attack + 25 benign) fed directly to AMATAS (no Tier-1 RF pre-filter)
        and to a vanilla single-LLM baseline using the same engineered prompt. Identical flows, identical model (GPT-4o).
      </p>

      {/* ── Experiment Framing ───────────────────────────────────── */}
      <div className="border border-blue-100 bg-blue-50/30 rounded-lg p-5 mb-6 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">What We Tested</h3>
          <p className="text-sm text-gray-700 leading-relaxed m-0">
            To isolate the value of the multi-agent architecture from prompt engineering alone, each attack type was
            sent through <strong>two pipelines on identical flows</strong>: (1) the full AMATAS 6-agent system with no
            Tier-1 RF pre-filter, and (2) a vanilla single GPT-4o call per flow with the same attack-signature prompt
            used in the MCP Config B baseline. Batches were reduced to 50 flows with 50/50 class balance (25 attack,
            25 benign) to maximise the signal per batch and remove prevalence effects.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1.5">What We Gained</h3>
          <p className="text-sm text-gray-700 leading-relaxed m-0">
            Across {BALANCED_AGGREGATE.amatas.n_complete} completed attack types, AMATAS achieved <strong>{BALANCED_AGGREGATE.amatas.avg_recall}% recall / {BALANCED_AGGREGATE.amatas.avg_f1}% F1</strong>{" "}
            vs vanilla <strong>{BALANCED_AGGREGATE.vanilla.avg_recall}% / {BALANCED_AGGREGATE.vanilla.avg_f1}%</strong> —
            a <strong className="text-green-700">+{BALANCED_AGGREGATE.delta.recall.toFixed(1)} recall point</strong> and{" "}
            <strong className="text-green-700">+{BALANCED_AGGREGATE.delta.f1.toFixed(1)} F1 point</strong> advantage for the multi-agent system.
            Both modes ran on GPT-4o; the only difference is the architecture.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-purple-800 uppercase tracking-wide mb-1.5">What We Conclude</h3>
          <p className="text-sm text-gray-700 leading-relaxed m-0">
            The multi-agent architecture provides a <strong>substantial detection uplift over prompt engineering alone</strong>, even
            when both systems have access to the same attack signatures. The biggest gaps appear on attacks where
            cross-flow context matters (Bot C2 beaconing, XSS scanning) — exactly the cases where the Temporal Agent
            observes patterns that a per-flow single LLM cannot see. At 50/50 class balance, both systems become
            more trigger-happy than at 95/5, raising FPR across the board, but the relative advantage holds.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1.5">How to Read It</h3>
          <p className="text-sm text-gray-700 leading-relaxed m-0">
            These experiments use a different distribution than Stage 1 — 50/50 instead of 5/95. That raises FPR for
            both modes because the LLMs implicitly update their base rate. The <em>comparison between modes</em> is
            the key signal, not the absolute numbers. Stage 1 remains the realistic-prevalence baseline; this
            experiment is the architecture ablation.
          </p>
        </div>
      </div>

      {/* ── Aggregate Comparison Card ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-5">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-semibold text-emerald-900">AMATAS (6-agent, no Tier 1)</h3>
            <span className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">{BALANCED_AGGREGATE.amatas.n_complete} batches</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <Metric label="Recall" value={`${BALANCED_AGGREGATE.amatas.avg_recall}%`} />
            <Metric label="Precision" value={`${BALANCED_AGGREGATE.amatas.avg_precision}%`} />
            <Metric label="F1" value={`${BALANCED_AGGREGATE.amatas.avg_f1}%`} />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2 pt-2 border-t border-emerald-200">
            <Metric label="FPR" value={`${BALANCED_AGGREGATE.amatas.avg_fpr}%`} />
            <Metric label="Bal. Acc" value={`${BALANCED_AGGREGATE.amatas.avg_balanced_accuracy}%`} />
            <Metric label="MCC" value={BALANCED_AGGREGATE.amatas.avg_mcc.toFixed(2)} />
          </div>
          <div className="text-xs text-emerald-800">
            Total cost: <strong>${BALANCED_AGGREGATE.amatas.total_cost}</strong>{" "}
            <span className="text-gray-500">• 6 LLM calls per flow</span>
          </div>
        </div>

        <div className="border border-gray-200 bg-gray-50/60 rounded-lg p-5">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Vanilla single-LLM</h3>
            <span className="text-[10px] uppercase tracking-wide text-gray-600 font-semibold">{BALANCED_AGGREGATE.vanilla.n_complete} batches</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <Metric label="Recall" value={`${BALANCED_AGGREGATE.vanilla.avg_recall}%`} />
            <Metric label="Precision" value={`${BALANCED_AGGREGATE.vanilla.avg_precision}%`} />
            <Metric label="F1" value={`${BALANCED_AGGREGATE.vanilla.avg_f1}%`} />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2 pt-2 border-t border-gray-200">
            <Metric label="FPR" value={`${BALANCED_AGGREGATE.vanilla.avg_fpr}%`} />
            <Metric label="Bal. Acc" value={`${BALANCED_AGGREGATE.vanilla.avg_balanced_accuracy}%`} />
            <Metric label="MCC" value={BALANCED_AGGREGATE.vanilla.avg_mcc.toFixed(2)} />
          </div>
          <div className="text-xs text-gray-700">
            Total cost: <strong>${BALANCED_AGGREGATE.vanilla.total_cost}</strong>{" "}
            <span className="text-gray-500">• 1 LLM call per flow</span>
          </div>
        </div>
      </div>

      {/* ── Metric explainer ──────────────────────────────────────── */}
      <div className="border border-blue-200 bg-blue-50/30 rounded-lg p-4 mb-6">
        <h3 className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-2">Understanding the metrics (especially at 50/50 balance)</h3>
        <div className="text-xs text-gray-700 leading-relaxed space-y-1.5">
          <p className="m-0">
            <strong>F1</strong> is the harmonic mean of precision and recall. At 50/50 balance, <em>always predicting attack</em> gives
            F1 = 67% as a hard baseline — so any model scoring below that is worse than spam. Vanilla scores <strong className="text-red-700">below 67% on 5 attacks</strong>: Bot (29%),
            Brute_Force_XSS (34%), HOIC (37%), GoldenEye (46%), Hulk (49%), Slowloris (56%), and SQL_Injection (13%). Several of these are
            genuinely failing at both detection and FPR simultaneously.
          </p>
          <p className="m-0">
            <strong>Balanced Accuracy</strong> = (Recall + Specificity) / 2. Its hard floor is <strong>50%</strong> (random or all-attack). AMATAS averages <strong>{BALANCED_AGGREGATE.amatas.avg_balanced_accuracy}%</strong>,
            Vanilla <strong>{BALANCED_AGGREGATE.vanilla.avg_balanced_accuracy}%</strong>. This metric is immune to the "label everything" trick.
          </p>
          <p className="m-0">
            <strong>MCC (Matthews Correlation Coefficient)</strong> ranges from −1 to +1: +1=perfect, 0=random, −1=inverse. It's the single most honest
            metric for imbalanced binary classification because random guessing always gives 0 regardless of class ratio. AMATAS averages
            <strong> {BALANCED_AGGREGATE.amatas.avg_mcc.toFixed(2)}</strong>, Vanilla <strong>{BALANCED_AGGREGATE.vanilla.avg_mcc.toFixed(2)}</strong>. Bot vanilla scores <strong className="text-red-700">MCC = −0.21</strong> (worse than random) and
            SQL Injection vanilla scores <strong className="text-red-700">MCC = −0.07</strong> — both architectures where the single LLM is failing both directions.
          </p>
        </div>
      </div>

      {/* ── Per-batch Table ──────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-gray-800">Per-Attack Comparison</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Same batch, same flows, same model. Only the architecture differs.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-gray-500 uppercase tracking-wide">
                <th className="text-left px-3 py-2 font-semibold">Attack Type</th>
                <th className="text-right px-2 py-2 font-semibold text-emerald-700" colSpan="4">AMATAS</th>
                <th className="text-right px-2 py-2 font-semibold text-gray-600" colSpan="4">Vanilla</th>
                <th className="text-right px-2 py-2 font-semibold">Δ MCC</th>
              </tr>
              <tr className="text-gray-400 text-[9px] border-t border-gray-100">
                <th></th>
                <th className="text-right px-1 py-1 font-medium">Rec</th>
                <th className="text-right px-1 py-1 font-medium">F1</th>
                <th className="text-right px-1 py-1 font-medium">BalAcc</th>
                <th className="text-right px-1 py-1 font-medium">MCC</th>
                <th className="text-right px-1 py-1 font-medium">Rec</th>
                <th className="text-right px-1 py-1 font-medium">F1</th>
                <th className="text-right px-1 py-1 font-medium">BalAcc</th>
                <th className="text-right px-1 py-1 font-medium">MCC</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {batchNames.map(b => {
                const am = getRow(b, "amatas");
                const va = getRow(b, "vanilla");
                const delta = (am && va) ? (am.mcc - va.mcc) : null;
                const deltaClass = delta === null ? "text-gray-400" :
                                   delta > 0.05 ? "text-emerald-700 font-semibold" :
                                   delta < -0.05 ? "text-red-700 font-semibold" : "text-gray-600";
                const mccClass = (val) => val < 0 ? "text-red-700 font-semibold" :
                                          val < 0.1 ? "text-amber-700" :
                                          val >= 0.5 ? "text-emerald-700 font-semibold" : "text-gray-700";
                return (
                  <tr key={b} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-800">{b.replace(/_/g, " ")}</td>
                    <td className="text-right px-1 py-2 text-emerald-800">{am ? `${am.recall.toFixed(0)}%` : "—"}</td>
                    <td className="text-right px-1 py-2 text-emerald-800 font-medium">{am ? `${am.f1.toFixed(0)}%` : "—"}</td>
                    <td className="text-right px-1 py-2 text-gray-600">{am ? `${am.balanced_accuracy.toFixed(0)}%` : "—"}</td>
                    <td className={`text-right px-1 py-2 ${am ? mccClass(am.mcc) : "text-gray-400"}`}>{am ? am.mcc.toFixed(2) : "—"}</td>
                    <td className="text-right px-1 py-2 text-gray-700">{va ? `${va.recall.toFixed(0)}%` : "—"}</td>
                    <td className="text-right px-1 py-2 text-gray-700 font-medium">{va ? `${va.f1.toFixed(0)}%` : "—"}</td>
                    <td className="text-right px-1 py-2 text-gray-500">{va ? `${va.balanced_accuracy.toFixed(0)}%` : "—"}</td>
                    <td className={`text-right px-1 py-2 ${va ? mccClass(va.mcc) : "text-gray-400"}`}>{va ? va.mcc.toFixed(2) : "—"}</td>
                    <td className={`text-right px-2 py-2 ${deltaClass}`}>
                      {delta !== null ? (delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 text-[10px] text-gray-500 leading-relaxed">
          <strong>MCC colour legend:</strong>{" "}
          <span className="text-red-700 font-semibold">red = negative (worse than random)</span> ·{" "}
          <span className="text-amber-700">amber = near-zero (weak signal)</span> ·{" "}
          <span className="text-emerald-700 font-semibold">green = strong (≥ 0.5)</span>.
          "BalAcc" is balanced accuracy: (Recall + Specificity) / 2.
        </div>
      </div>

      {/* ── Why numbers differ from Stage 1 ───────────────────────── */}
      <div className="border border-amber-200 bg-amber-50/30 rounded-lg p-5 mb-6">
        <h3 className="text-sm font-bold text-amber-900 mb-2">Why these numbers don't match Stage 1</h3>
        <div className="text-xs text-gray-700 leading-relaxed space-y-2">
          <p className="m-0">
            Stage 1 reports <strong>83% recall / 0.09% FPR</strong> at 5% attack prevalence with Tier 1 RF. This page reports
            AMATAS at <strong>{BALANCED_AGGREGATE.amatas.avg_recall}% recall / {BALANCED_AGGREGATE.amatas.avg_fpr}% FPR</strong> at 50% prevalence without Tier 1. Both are correct — they answer different questions.
          </p>
          <p className="m-0">
            Recall is roughly comparable; <strong>FPR differs by ~300×</strong>. The reason is the Tier 1 RF pre-filter:
            in Stage 1, the RF silently auto-rejects ~95% of benign flows before they ever reach an LLM, so the agents only see
            ambiguous cases. Here we strip away Tier 1 and force every benign flow through the LLM pipeline, so the agents have to
            make the "this is normal" call themselves — and LLMs are conservative, preferring to flag anything slightly unusual.
          </p>
          <p className="m-0">
            This is actually the <strong>strongest argument for the two-tier architecture</strong>: the RF is not just a cost
            optimisation, it's load-bearing on false positive rate. Neither an LLM-only nor an RF-only system beats the combination.
          </p>
          <p className="m-0">
            <strong>Second factor:</strong> at 50/50 class balance the LLM's implicit prior shifts ("a lot of these are attacks"),
            making it more willing to flag. The engineered prompt is calibrated for 5% prevalence; flipping the ratio changes the
            optimal decision boundary. This is a known phenomenon called <em>prior drift</em> — not a bug.
          </p>
        </div>
      </div>

      {/* ── Reasoning Comparison ─────────────────────────────────── */}
      <h3 className="text-lg font-semibold text-gray-800 mb-1">Why the Multi-Agent System Wins</h3>
      <p className="text-sm text-gray-500 mb-4">
        Two concrete examples where AMATAS caught an attack the vanilla baseline missed. Both systems analysed the
        identical flow features with the same model — only the reasoning architecture differs.
      </p>

      <div className="space-y-4 mb-6">
        {BALANCED_REASONING_EXAMPLES.map(ex => {
          const isOpen = expandedExample === ex.id;
          return (
            <div key={ex.id} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedExample(isOpen ? null : ex.id)}
                className="w-full bg-gray-50 hover:bg-gray-100 border-b border-gray-200 px-4 py-3 text-left cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-800">
                    {ex.batch.replace(/_/g, " ")} · Flow {ex.flow_idx}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Ground truth: <span className="font-medium">{ex.actual}</span> ·
                    <span className="text-emerald-700 ml-1">AMATAS: {ex.amatas.verdict}</span> ·
                    <span className="text-red-700 ml-1">Vanilla: {ex.vanilla.verdict}</span>
                  </div>
                </div>
                <div className="text-gray-400 text-lg">{isOpen ? "−" : "+"}</div>
              </button>

              {isOpen && (
                <div className="p-4 space-y-4 bg-white">
                  {/* AMATAS side */}
                  <div className="border-l-4 border-emerald-500 pl-4">
                    <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-2">
                      AMATAS Multi-Agent Reasoning
                    </h4>
                    <div className="space-y-2">
                      {ex.amatas.specialists.map(s => (
                        <div key={s.name} className="text-xs">
                          <div className="flex items-baseline gap-2">
                            <span className="font-semibold text-gray-700">{s.name}:</span>
                            <span className={s.verdict === "SUSPICIOUS" || s.verdict === "MALICIOUS" ? "text-amber-700 font-medium" : "text-gray-500"}>
                              {s.verdict}
                            </span>
                          </div>
                          {s.findings.length > 0 && (
                            <ul className="list-disc list-inside ml-3 text-gray-600 mt-0.5">
                              {s.findings.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                          )}
                        </div>
                      ))}
                      <div className="text-xs">
                        <span className="font-semibold text-gray-700">Devil's Advocate:</span>{" "}
                        <span className="text-gray-600">(benign confidence {ex.amatas.devils_advocate.confidence_benign})</span>
                        <div className="ml-3 text-gray-600 italic">"{ex.amatas.devils_advocate.argument}"</div>
                      </div>
                      <div className="text-xs mt-2 pt-2 border-t border-gray-100">
                        <span className="font-semibold text-gray-700">Orchestrator final:</span>{" "}
                        <span className="text-emerald-700 font-medium">{ex.amatas.verdict}</span> →
                        <span className="text-gray-500"> predicted as {ex.amatas.predicted_type}</span>
                        <div className="text-gray-600 mt-1">{ex.amatas.final_reasoning}</div>
                      </div>
                    </div>
                  </div>

                  {/* Vanilla side */}
                  <div className="border-l-4 border-gray-400 pl-4">
                    <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                      Vanilla Single-LLM Reasoning
                    </h4>
                    <div className="text-xs">
                      <span className="font-semibold text-gray-700">Verdict:</span>{" "}
                      <span className="text-red-700 font-medium">{ex.vanilla.verdict}</span>
                      <div className="text-gray-600 mt-1 italic">"{ex.vanilla.reasoning}"</div>
                    </div>
                  </div>

                  {/* Analysis */}
                  <div className="bg-blue-50/50 border border-blue-200 rounded px-3 py-2">
                    <h4 className="text-xs font-semibold text-blue-900 uppercase tracking-wide mb-1">Why This Matters</h4>
                    <p className="text-xs text-gray-700 leading-relaxed m-0">{ex.analysis}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Cost Trade-off ───────────────────────────────────────── */}
      <div className="border border-amber-200 bg-amber-50/40 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-amber-900 mb-2">The Cost Trade-off</h3>
        <p className="text-xs text-gray-700 leading-relaxed mb-2">
          AMATAS costs <strong>~${BALANCED_AGGREGATE.delta.cost_ratio.toFixed(1)}× more</strong> than vanilla
          (${BALANCED_AGGREGATE.amatas.total_cost} vs ${BALANCED_AGGREGATE.vanilla.total_cost} for {BALANCED_AGGREGATE.amatas.n_complete} batches)
          because each flow requires 6 LLM calls instead of 1. In exchange, it delivers:
        </p>
        <ul className="text-xs text-gray-700 list-disc list-inside space-y-0.5 mb-2">
          <li><strong>+{BALANCED_AGGREGATE.delta.recall.toFixed(0)} percentage points of recall</strong> — catches attacks vanilla misses entirely</li>
          <li><strong>+{BALANCED_AGGREGATE.delta.f1.toFixed(0)} percentage points of F1</strong> — across-the-board improvement</li>
          <li><strong>Full explainable reasoning chains</strong> — six independent perspectives per verdict, auditable</li>
          <li><strong>Cross-flow temporal context</strong> — architectural capability unavailable to per-flow single-LLM systems</li>
        </ul>
        <p className="text-xs text-gray-700 leading-relaxed m-0">
          This is the core architectural justification: the Tier-1 RF pre-filter (not tested in this experiment) reduces
          the ~$8× multi-agent overhead to ~5% of the naive cost by routing obvious benign flows around the LLM stack
          entirely — combining both architectures gives you the explainability of multi-agent LLMs at economically
          viable scale.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-gray-800 tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}
