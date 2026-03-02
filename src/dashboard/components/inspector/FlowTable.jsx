import React from "react";
import { verdictColor, verdictBg, correctColor, isCorrect } from "../../lib/format";

export default function FlowTable({ flows, page, setPage, pageSize, selectedFlowIdx, setSelectedFlowIdx }) {
  const totalPages = Math.ceil(flows.length / pageSize);
  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, flows.length);
  const pageFlows = flows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[70vh] overflow-y-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-gray-50 z-[1]">
          <tr>
            {["#", "Actual", "Verdict", "Correct?", "Conf"].map(h => (
              <th
                key={h}
                className="text-left px-3 py-2.5 font-semibold text-gray-500 text-[11px] border-b border-gray-200"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageFlows.map(f => {
            const correct = isCorrect(f);
            const isSelected = selectedFlowIdx === f.flow_idx;
            const vUpper = (f.verdict || "").toUpperCase();
            const displayVerdict = f.tier1_filtered ? "FILTERED" : vUpper;

            let rowBg = "bg-white";
            if (isSelected) rowBg = "bg-blue-50";
            else if (f.tier1_filtered) rowBg = "bg-slate-50";
            else if (correct) rowBg = "bg-green-50/30";
            else rowBg = "bg-red-50/50";

            return (
              <tr
                key={f.flow_idx}
                onClick={() => setSelectedFlowIdx(isSelected ? null : f.flow_idx)}
                className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50/50 ${rowBg}`}
              >
                <td className="px-3 py-2 text-gray-400">{f.flow_idx}</td>
                <td className="px-3 py-2 text-[11px]">{f.attack_type_actual || "Benign"}</td>
                <td className="px-3 py-2">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      color: f.tier1_filtered ? "#94a3b8" : verdictColor(f.verdict),
                      background: f.tier1_filtered ? "#f1f5f9" : verdictBg(f.verdict),
                    }}
                  >
                    {displayVerdict}
                  </span>
                </td>
                <td className="px-3 py-2 text-[11px] font-semibold" style={{ color: correctColor(correct) }}>
                  {correct ? "Yes" : "No"}
                </td>
                <td className="px-3 py-2 text-gray-500">
                  {f.confidence != null ? `${(f.confidence * 100).toFixed(0)}%` : "\u2014"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="px-3 py-2.5 flex items-center justify-between border-t border-gray-200 text-xs text-gray-500">
        <span>Showing {start}\u2013{end} of {flows.length} flows</span>
        <div className="flex gap-1">
          <button
            onClick={() => setPage(0)}
            disabled={page === 0}
            className="px-2 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-default cursor-pointer"
          >
            &laquo;
          </button>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-2 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-default cursor-pointer"
          >
            &lsaquo; Prev
          </button>
          <span className="px-2 py-1 font-medium">
            Page {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-default cursor-pointer"
          >
            Next &rsaquo;
          </button>
          <button
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="px-2 py-1 rounded border border-gray-200 bg-white disabled:opacity-40 disabled:cursor-default cursor-pointer"
          >
            &raquo;
          </button>
        </div>
      </div>
    </div>
  );
}
