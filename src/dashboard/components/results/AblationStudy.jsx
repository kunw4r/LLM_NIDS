import React, { useState, useEffect } from "react";
import { ABLATION_CONDITIONS } from "../../data/ablation";
import { RESULTS_BASE } from "../../data/constants";
import RoutingControl from "./RoutingControl";

const METRIC_LABELS = { recall: "Recall", fpr: "FPR", f1: "F1", cost: "Cost" };

function pct(v) { return v != null ? `${(v * 100).toFixed(0)}%` : "—"; }
function dollar(v) { return v != null ? `$${v.toFixed(2)}` : "—"; }

function Bar({ value, max, color, label }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-12 text-right font-mono text-gray-600">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div style={{ width: `${w}%`, backgroundColor: color }} className="h-full rounded-full transition-all" />
      </div>
    </div>
  );
}

export default function AblationStudy() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAttack, setSelectedAttack] = useState("ftp");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const url = `${RESULTS_BASE.replace("/results", "")}/results/ablation/ablation_summary.json?t=${Date.now()}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();
        setData(json);
        setError(null);
      } catch (err) {
        try {
          const resp2 = await fetch(`./results/ablation/ablation_summary.json?t=${Date.now()}`);
          if (resp2.ok) {
            const json = await resp2.json();
            setData(json);
            setError(null);
          } else {
            setError(err.message);
          }
        } catch (_) {
          setError(err.message);
        }
      }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading ablation results...</div>;
  if (error) return <div className="text-center py-12 text-red-500">Failed to load ablation data: {error}</div>;
  if (!data) return null;

  const conditions = data.conditions || {};

  // Split by attack type
  const attackGroups = {};
  for (const [key, val] of Object.entries(conditions)) {
    const at = val.attack_type;
    if (!attackGroups[at]) attackGroups[at] = [];
    attackGroups[at].push({ key, ...val });
  }

  // Sort by condition order
  const condOrder = ABLATION_CONDITIONS.map(c => c.id);
  const sortFn = (a, b) => {
    const strip = k => k.replace(/_ssh$/, "").replace(/_hoic$/, "");
    const ia = condOrder.indexOf(strip(a.key));
    const ib = condOrder.indexOf(strip(b.key));
    return ia - ib;
  };
  Object.values(attackGroups).forEach(arr => arr.sort(sortFn));

  const attackTabs = [
    ["ftp", "FTP-BruteForce"],
    ["ssh", "SSH-Bruteforce"],
    ["hoic", "DDOS_attack-HOIC"],
  ].filter(([, at]) => attackGroups[at]?.length > 0);

  const attackTypeMap = { ftp: "FTP-BruteForce", ssh: "SSH-Bruteforce", hoic: "DDOS_attack-HOIC" };
  const results = attackGroups[attackTypeMap[selectedAttack]] || [];
  const attackLabel = attackTypeMap[selectedAttack] || selectedAttack;

  const maxRecall = 1;
  const maxCost = Math.max(...results.map(r => r.cost || 0), 0.01);

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Agent Ablation Study</h2>
        <span className="text-xs text-gray-400">Experiment 1</span>
      </div>
      <p className="text-sm text-gray-500 mb-6 max-w-2xl">
        Systematic removal of agents to quantify each one's contribution.
        Starting from the full 6-agent configuration with perfect detection,
        any degradation from agent removal reveals that agent's value.
      </p>

      {/* Attack type toggle */}
      <div className="flex gap-2 mb-6">
        {attackTabs.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSelectedAttack(id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer ${
              selectedAttack === id ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {results.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No {attackLabel} results available yet.</div>
      ) : (
        <>
          {/* Comparison table */}
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">Condition</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Recall</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">FPR</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">F1</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Cost</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">TP</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">FP</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">FN</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => {
                  const strip = k => k.replace(/_ssh$/, "").replace(/_hoic$/, "");
                  const cond = ABLATION_CONDITIONS.find(c => strip(r.key) === c.id);
                  const isBaseline = strip(r.key) === "full_amatas";
                  const cm = r.confusion || {};
                  return (
                    <tr key={r.key} className={`border-b border-gray-100 ${isBaseline ? "bg-green-50" : ""}`}>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cond?.color || "#6b7280" }} />
                          <span className={`text-sm ${isBaseline ? "font-semibold text-green-700" : "text-gray-700"}`}>
                            {r.label}
                          </span>
                        </div>
                        {cond && cond.disabled.length > 0 && (
                          <div className="text-[10px] text-gray-400 ml-4 mt-0.5">
                            Disabled: {cond.disabled.join(", ")}
                          </div>
                        )}
                      </td>
                      <td className={`text-right py-2.5 px-3 font-mono font-semibold ${r.recall < 0.5 ? "text-red-600" : r.recall < 0.95 ? "text-amber-600" : "text-green-600"}`}>
                        {pct(r.recall)}
                      </td>
                      <td className={`text-right py-2.5 px-3 font-mono ${r.fpr > 0.01 ? "text-red-600" : "text-green-600"}`}>
                        {pct(r.fpr)}
                      </td>
                      <td className={`text-right py-2.5 px-3 font-mono font-semibold ${r.f1 < 0.5 ? "text-red-600" : r.f1 < 0.95 ? "text-amber-600" : "text-green-600"}`}>
                        {pct(r.f1)}
                      </td>
                      <td className="text-right py-2.5 px-3 font-mono text-gray-600">{dollar(r.cost)}</td>
                      <td className="text-right py-2.5 px-3 font-mono text-green-600">{cm.tp ?? "—"}</td>
                      <td className="text-right py-2.5 px-3 font-mono text-red-600">{cm.fp ?? "—"}</td>
                      <td className="text-right py-2.5 px-3 font-mono text-amber-600">{cm.fn ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bar charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Recall bar chart */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recall by Condition</h3>
              <div className="space-y-2">
                {results.map(r => {
                  const cond = ABLATION_CONDITIONS.find(c => r.key.replace(/_ssh$/, "").replace(/_hoic$/, "") === c.id);
                  return (
                    <Bar
                      key={r.key}
                      value={r.recall || 0}
                      max={maxRecall}
                      color={cond?.color || "#6b7280"}
                      label={pct(r.recall)}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-gray-400 mt-2 px-14">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            {/* Cost bar chart */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cost by Condition</h3>
              <div className="space-y-2">
                {results.map(r => {
                  const cond = ABLATION_CONDITIONS.find(c => r.key.replace(/_ssh$/, "").replace(/_hoic$/, "") === c.id);
                  return (
                    <Bar
                      key={r.key}
                      value={r.cost || 0}
                      max={maxCost}
                      color={cond?.color || "#6b7280"}
                      label={dollar(r.cost)}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Key findings */}
          <div className="border border-blue-100 bg-blue-50/30 rounded-lg p-4 sm:p-5 mb-8">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Key Findings</h3>
            <div className="space-y-3 text-sm text-gray-700">
              {(() => {
                const baseline = results.find(r => r.key.replace(/_ssh$/, "").replace(/_hoic$/, "") === "full_amatas");
                const noDA = results.find(r => r.key.includes("no_devils"));
                const noTemporal = results.find(r => r.key.includes("no_temporal"));
                const twoAgent = results.find(r => r.key.includes("two_agent"));
                const findings = [];

                // DA harmful on ambiguous attacks
                if (noDA && baseline && noDA.recall > baseline.recall + 0.1) {
                  findings.push(
                    <div key="da-harmful" className="flex gap-2">
                      <span className="text-red-500 font-bold">!</span>
                      <span><strong>DA is counterproductive:</strong> Removing the Devil's Advocate improves recall from {pct(baseline.recall)} to {pct(noDA.recall)} and F1 from {pct(baseline.f1)} to {pct(noDA.f1)} — the 30% adversarial weight suppresses correct detections on ambiguous attacks.</span>
                    </div>
                  );
                } else if (noDA && noDA.fpr > 0 && baseline && baseline.fpr === 0) {
                  findings.push(
                    <div key="da-controls" className="flex gap-2">
                      <span className="text-red-500 font-bold">!</span>
                      <span><strong>DA controls false positives:</strong> Without the Devil's Advocate, FPR increases to {pct(noDA.fpr)}.</span>
                    </div>
                  );
                }

                if (twoAgent && twoAgent.recall < 0.5) {
                  findings.push(
                    <div key="two-agent" className="flex gap-2">
                      <span className="text-red-500 font-bold">!</span>
                      <span><strong>2-Agent collapse:</strong> Protocol + Orchestrator alone achieves only {pct(twoAgent.recall)} recall — simple orchestration of a single perspective is insufficient.</span>
                    </div>
                  );
                }

                if (noTemporal && baseline && noTemporal.recall < baseline.recall - 0.1) {
                  findings.push(
                    <div key="temporal" className="flex gap-2">
                      <span className="text-amber-500 font-bold">!</span>
                      <span><strong>Temporal agent is critical:</strong> Without temporal context, recall drops from {pct(baseline.recall)} to {pct(noTemporal.recall)} — cross-flow IP pattern analysis provides signal that individual flow features cannot.</span>
                    </div>
                  );
                }

                if (baseline && noDA && noDA.recall > baseline.recall + 0.1) {
                  findings.push(
                    <div key="adaptive" className="flex gap-2">
                      <span className="text-blue-500 font-bold">→</span>
                      <span><strong>DA weight needs adaptation:</strong> The fixed 30% DA weight is optimal for clear-signal attacks but harmful for ambiguous ones — an attack-type-adaptive weighting scheme would improve overall performance.</span>
                    </div>
                  );
                } else {
                  findings.push(
                    <div key="optimal" className="flex gap-2">
                      <span className="text-green-500 font-bold">+</span>
                      <span><strong>Full AMATAS is optimal:</strong> The complete 6-agent architecture achieves the best balance of recall, precision, and false positive control.</span>
                    </div>
                  );
                }

                return findings;
              })()}
            </div>
          </div>
        </>
      )}

      {/* Routing validation — paired experiment */}
      <div className="mt-10">
        <div className="flex items-baseline gap-3 mb-1 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Tier 1 Routing Validation</h2>
          <span className="text-xs text-gray-400">Experiment 2</span>
        </div>
        <p className="text-sm text-gray-500 mb-6 max-w-2xl">
          Control experiment replacing the trained Random Forest with random flow selection
          to confirm that cost reduction comes from intelligent routing, not random sampling.
        </p>
        <RoutingControl />
      </div>
    </div>
  );
}
