import React, { useState, useMemo } from "react";
import { EXPERIMENTS } from "../../data/experiments";

const pct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : "\u2014";
const pctInt = (v) => v != null ? `${Math.round(v * 100)}%` : "\u2014";

export default function AllExperiments({ onInspectFlows }) {
  const [compCategory, setCompCategory] = useState("all");
  const [compSort, setCompSort] = useState({ key: "f1", dir: "desc" });

  const compExps = useMemo(() => {
    let filtered = EXPERIMENTS;
    if (compCategory === "amatas") filtered = EXPERIMENTS.filter(e => e.phase !== "Phase 1");
    else if (compCategory === "mcp") filtered = EXPERIMENTS.filter(e => e.phase === "Phase 1");

    return [...filtered].sort((a, b) => {
      const av = a[compSort.key];
      const bv = b[compSort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return compSort.dir === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
      return compSort.dir === "desc" ? bv - av : av - bv;
    });
  }, [compCategory, compSort]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4 tracking-tight">All Experiments</h2>

      {/* F1 Score Timeline */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <div className="text-xs font-semibold text-gray-500 mb-3">F1 Score Timeline</div>
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {EXPERIMENTS.map(exp => {
            const h = Math.max(exp.f1 * 80, 4);
            const hue = exp.f1 >= 0.8 ? "#16a34a" : exp.f1 >= 0.5 ? "#d97706" : "#dc2626";
            return (
              <div key={exp.id} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[9px] text-gray-400">{pctInt(exp.f1)}</div>
                <div
                  className="w-full max-w-[32px] rounded-t transition-all duration-300"
                  style={{ height: h, background: hue }}
                />
                <div className="text-[8px] text-gray-400 text-center leading-tight max-w-[60px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {exp.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-4 items-center">
        <span className="text-xs text-gray-500">Filter:</span>
        {[
          ["all", "All"],
          ["amatas", "AMATAS"],
          ["mcp", "MCP"],
        ].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setCompCategory(id)}
            className={`px-3 py-1.5 rounded-md text-xs cursor-pointer border ${
              compCategory === id
                ? "border-blue-600 bg-blue-50 text-blue-600"
                : "border-gray-200 bg-white text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sortable table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              {[
                { key: "phase", label: "Category" },
                { key: "name", label: "Experiment" },
                { key: "f1", label: "F1" },
                { key: "recall", label: "Recall" },
                { key: "precision", label: "Precision" },
                { key: "cost", label: "Cost/flow" },
                { key: "model", label: "Model" },
                { key: "flows", label: "Flows" },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => setCompSort(s => ({
                    key: col.key,
                    dir: s.key === col.key && s.dir === "desc" ? "asc" : "desc",
                  }))}
                  className="px-4 py-3 font-semibold text-gray-500 text-xs border-b border-gray-200 cursor-pointer select-none"
                  style={{ textAlign: col.key === "name" || col.key === "phase" || col.key === "model" ? "left" : "right" }}
                >
                  {col.label} {compSort.key === col.key ? (compSort.dir === "desc" ? "\u2193" : "\u2191") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {compExps.map(exp => (
              <tr
                key={exp.id}
                onClick={() => onInspectFlows(exp.id)}
                className="border-b border-gray-100 cursor-pointer transition-colors hover:bg-gray-50"
              >
                <td className="px-4 py-2.5 text-xs text-gray-400">{exp.phase}</td>
                <td className="px-4 py-2.5 font-medium text-blue-600">{exp.name}</td>
                <td
                  className="px-4 py-2.5 text-right font-semibold"
                  style={{ color: exp.f1 >= 0.8 ? "#16a34a" : exp.f1 >= 0.5 ? "#d97706" : "#dc2626" }}
                >
                  {pct(exp.f1)}
                </td>
                <td className="px-4 py-2.5 text-right">{pct(exp.recall)}</td>
                <td className="px-4 py-2.5 text-right">{pct(exp.precision)}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">${(exp.cost / exp.flows).toFixed(4)}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{exp.model}</td>
                <td className="px-4 py-2.5 text-right">{exp.flows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
