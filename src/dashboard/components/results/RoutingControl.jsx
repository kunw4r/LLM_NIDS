import React, { useState, useEffect } from "react";
import { RESULTS_BASE } from "../../data/constants";

function pct(v) { return v != null ? `${(v * 100).toFixed(0)}%` : "—"; }
function dollar(v) { return v != null ? `$${v.toFixed(2)}` : "—"; }

export default function RoutingControl() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const url = `${RESULTS_BASE.replace("/results", "")}/results/control/control_summary.json?t=${Date.now()}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        setData(await resp.json());
        setError(null);
      } catch (err) {
        try {
          const resp2 = await fetch(`./results/control/control_summary.json?t=${Date.now()}`);
          if (resp2.ok) { setData(await resp2.json()); setError(null); }
          else setError(err.message);
        } catch (_) { setError(err.message); }
      }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <div className="text-center py-8 text-gray-400">Loading routing control results...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Failed to load: {error}</div>;
  if (!data) return null;

  const conditions = data.conditions || {};
  const rows = [
    conditions.trained_rf,
    conditions.random_7pct,
    conditions.random_50pct,
  ].filter(Boolean);

  const colors = { "Trained RF (threshold 0.15)": "#10b981", "Random filter (7%)": "#ef4444", "Random filter (50%)": "#f59e0b" };

  return (
    <div className="border border-gray-200 rounded-lg p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Why Intelligent Routing Matters</h3>
      <p className="text-xs text-gray-500 mb-4">
        Replacing the trained Random Forest with random flow selection demonstrates
        that the RF provides intelligent routing, not just random sampling.
      </p>

      {rows.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">Experiment not yet complete.</div>
      ) : (
        <>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-2 pr-4 text-gray-500 font-medium">Filter Type</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Recall</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">FPR</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">F1</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Cost</th>
                  <th className="text-right py-2 px-2 text-gray-500 font-medium">Attacks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const isRF = r.filter_type === "trained_rf";
                  return (
                    <tr key={i} className={`border-b border-gray-100 ${isRF ? "bg-green-50" : ""}`}>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[r.label] || "#6b7280" }} />
                          <span className={isRF ? "font-semibold text-green-700" : "text-gray-700"}>
                            {r.label}
                          </span>
                        </div>
                      </td>
                      <td className={`text-right py-2 px-2 font-mono font-semibold ${r.recall < 0.5 ? "text-red-600" : r.recall < 0.95 ? "text-amber-600" : "text-green-600"}`}>
                        {pct(r.recall)}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-gray-600">{pct(r.fpr)}</td>
                      <td className={`text-right py-2 px-2 font-mono font-semibold ${r.f1 < 0.5 ? "text-red-600" : "text-green-600"}`}>
                        {pct(r.f1)}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-gray-600">{dollar(r.cost)}</td>
                      <td className="text-right py-2 px-2 font-mono text-gray-600">
                        {r.attacks_captured}/{r.attacks_total}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Recall comparison visual */}
          <div className="space-y-2 mb-4">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-28 sm:w-36 text-right text-gray-500 truncate">{r.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div
                    style={{ width: `${(r.recall || 0) * 100}%`, backgroundColor: colors[r.label] || "#6b7280" }}
                    className="h-full rounded-full flex items-center justify-end pr-1 transition-all"
                  >
                    <span className="text-[10px] text-white font-bold">{pct(r.recall)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-xs text-gray-500 italic border-t border-gray-100 pt-3">
            The trained RF at 7% selection rate achieves {pct(rows[0]?.recall)} recall — it specifically
            identifies attack flows. Random sampling at the same rate captures only {pct(rows[1]?.recall)} of attacks.
            {rows[2] && ` Even random 50% selection only achieves ${pct(rows[2].recall)} recall at ${dollar(rows[2].cost)} cost.`}
          </div>
        </>
      )}
    </div>
  );
}
