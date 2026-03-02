import React, { useState, useEffect } from "react";
import { EXPERIMENTS, getPhaseGroups } from "../../data/experiments";
import { pct, pctInt, dollar } from "../../lib/format";

export default function ExperimentTimeline({ onInspectFlows }) {
  const [storyExpId, setStoryExpId] = useState(EXPERIMENTS[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const storyExp = EXPERIMENTS.find(x => x.id === storyExpId) || EXPERIMENTS[0];
  const storyIdx = EXPERIMENTS.findIndex(x => x.id === storyExpId);
  const phaseGroups = getPhaseGroups();

  useEffect(() => {
    const handler = (e) => {
      const idx = EXPERIMENTS.findIndex(x => x.id === storyExpId);
      if (e.key === "ArrowLeft" && idx > 0) setStoryExpId(EXPERIMENTS[idx - 1].id);
      else if (e.key === "ArrowRight" && idx < EXPERIMENTS.length - 1) setStoryExpId(EXPERIMENTS[idx + 1].id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [storyExpId]);

  return (
    <div>
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(p => !p)}
        className="md:hidden mb-3 px-3 py-2 border border-gray-200 rounded-md text-xs text-gray-600 cursor-pointer bg-white w-full text-left"
      >
        {sidebarOpen ? "Hide experiments" : `Viewing: ${storyExp.name} — tap to switch`}
      </button>

      <div className="flex flex-col md:grid md:gap-8" style={{ gridTemplateColumns: "280px 1fr", minHeight: "70vh" }}>
        {/* Sidebar — hidden on mobile unless toggled */}
        <div className={`${sidebarOpen ? "block" : "hidden"} md:block border-b md:border-b-0 md:border-r border-gray-200 pb-4 md:pb-0 md:pr-6 mb-4 md:mb-0`}>
          {phaseGroups.map(group => (
            <div key={group.label} className="mb-4 md:mb-6">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{group.label}</div>
              {group.experiments.map(exp => (
                <button
                  key={exp.id}
                  onClick={() => { setStoryExpId(exp.id); setSidebarOpen(false); }}
                  className={`flex justify-between items-center w-full px-3 py-2 mb-0.5 border-none rounded-md cursor-pointer text-left text-sm ${
                    storyExpId === exp.id ? "bg-blue-50 text-blue-600 font-semibold" : "bg-transparent text-gray-700"
                  }`}
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap mr-2">{exp.name}</span>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">F1 {pctInt(exp.f1)}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-3 mb-2 flex-wrap">
            <span className="text-[11px] text-gray-400 font-medium">{storyExp.phase}</span>
            <span className="text-[11px] text-gray-300">&middot;</span>
            <span className="text-[11px] text-gray-400">{storyExp.date}</span>
            <span className="text-[11px] text-gray-300">&middot;</span>
            <span className="text-[11px] text-gray-400">{storyExp.model}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-4 sm:mb-6">{storyExp.name}</h2>

          {/* What we tried */}
          <div className="mb-5 sm:mb-7">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What we tried</h3>
            <p className="text-sm leading-relaxed text-gray-700">{storyExp.narrative.tried}</p>
          </div>

          {/* What happened */}
          <div className="mb-5 sm:mb-7">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What happened</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
              {[
                { label: "F1", value: pct(storyExp.f1) },
                { label: "Precision", value: pct(storyExp.precision) },
                { label: "Recall", value: pct(storyExp.recall) },
                { label: "Cost", value: dollar(storyExp.cost) },
              ].map(m => (
                <div key={m.label} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <div className="text-lg sm:text-[28px] font-bold tracking-tight">{m.value}</div>
                  <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{m.label}</div>
                </div>
              ))}
            </div>
            <p className="text-sm leading-relaxed text-gray-700">{storyExp.narrative.happened}</p>
          </div>

          {/* Batch Composition */}
          <details className="mb-5 sm:mb-7 border border-gray-200 rounded-lg">
            <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-500">
              Batch Composition &middot; {storyExp.flows} flows
            </summary>
            <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "True Positives", val: storyExp.confusion.tp, color: "text-green-600" },
                { label: "False Positives", val: storyExp.confusion.fp, color: "text-red-600" },
                { label: "True Negatives", val: storyExp.confusion.tn, color: "text-blue-600" },
                { label: "False Negatives", val: storyExp.confusion.fn, color: "text-amber-600" },
              ].map(c => (
                <div key={c.label} className="text-center py-3 px-2 bg-gray-50 rounded-md">
                  <div className={`text-xl sm:text-2xl font-bold ${c.color}`}>{c.val}</div>
                  <div className="text-[10px] sm:text-[11px] text-gray-500">{c.label}</div>
                </div>
              ))}
            </div>
            {storyExp.verdicts && (
              <div className="px-4 pb-2">
                <div className="text-xs text-gray-500 mb-2">Verdict distribution</div>
                <div className="flex h-2 rounded overflow-hidden bg-gray-100">
                  <div style={{ width: `${(storyExp.verdicts.benign / storyExp.flows) * 100}%` }} className="bg-green-600" />
                  <div style={{ width: `${(storyExp.verdicts.suspicious / storyExp.flows) * 100}%` }} className="bg-amber-600" />
                  <div style={{ width: `${(storyExp.verdicts.malicious / storyExp.flows) * 100}%` }} className="bg-red-600" />
                </div>
                <div className="flex gap-3 sm:gap-4 mt-1 text-[10px] sm:text-[11px] text-gray-400 flex-wrap">
                  <span>Benign: {storyExp.verdicts.benign}</span>
                  <span>Suspicious: {storyExp.verdicts.suspicious}</span>
                  <span>Malicious: {storyExp.verdicts.malicious}</span>
                </div>
              </div>
            )}
          </details>

          {/* Per-attack breakdown for stealthy */}
          {storyExp.id === "batch3_stealthy" && (
            <details className="mb-5 sm:mb-7 border border-gray-200 rounded-lg">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-gray-500">Per-Attack Breakdown</summary>
              <div className="px-4 pb-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200"><th className="text-left py-2 text-gray-500 font-medium">Attack Type</th><th className="text-right py-2 text-gray-500 font-medium">Recall</th><th className="text-right py-2 text-gray-500 font-medium">Detected/Total</th></tr></thead>
                  <tbody>
                    {[
                      { type: "SQL Injection", detected: 280, total: 300, recall: 0.933 },
                      { type: "XSS (Brute Force)", detected: 273, total: 319, recall: 0.856 },
                      { type: "Infiltration", detected: 115, total: 300, recall: 0.383 },
                    ].map(a => (
                      <tr key={a.type} className="border-b border-gray-100"><td className="py-2">{a.type}</td><td className="text-right py-2 font-semibold">{pct(a.recall)}</td><td className="text-right py-2 text-gray-500">{a.detected}/{a.total}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {/* What we learned */}
          <div className="mb-5 sm:mb-7">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">What we learned</h3>
            <p className="text-sm leading-relaxed text-gray-700 italic">{storyExp.narrative.learned}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 sm:gap-3 mb-5 sm:mb-7 flex-wrap">
            <button onClick={() => onInspectFlows(storyExp.id)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium cursor-pointer border-none">
              Inspect Flows &rarr;
            </button>
            {storyExp.narrative.nextId && (
              <button onClick={() => setStoryExpId(storyExp.narrative.nextId)} className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 border border-gray-200 rounded-md text-xs sm:text-sm font-medium cursor-pointer bg-white text-gray-700">
                Next &rarr; {EXPERIMENTS.find(e => e.id === storyExp.narrative.nextId)?.name}
              </button>
            )}
          </div>

          {/* Prev/Next */}
          <div className="flex justify-between border-t border-gray-200 pt-4 mt-4">
            <button disabled={storyIdx === 0} onClick={() => setStoryExpId(EXPERIMENTS[storyIdx - 1]?.id)} className={`px-3 sm:px-4 py-2 border border-gray-200 rounded-md text-xs sm:text-sm bg-white ${storyIdx === 0 ? "text-gray-300 cursor-default" : "text-gray-700 cursor-pointer"}`}>
              &larr; Prev
            </button>
            <span className="text-[10px] sm:text-xs text-gray-400 self-center">{storyIdx + 1} / {EXPERIMENTS.length}</span>
            <button disabled={storyIdx === EXPERIMENTS.length - 1} onClick={() => setStoryExpId(EXPERIMENTS[storyIdx + 1]?.id)} className={`px-3 sm:px-4 py-2 border border-gray-200 rounded-md text-xs sm:text-sm bg-white ${storyIdx === EXPERIMENTS.length - 1 ? "text-gray-300 cursor-default" : "text-gray-700 cursor-pointer"}`}>
              Next &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
