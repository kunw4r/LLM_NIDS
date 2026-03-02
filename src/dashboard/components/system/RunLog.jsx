import React from "react";

export default function RunLog({ runLogText, runLogLoading, runLogSearch, setRunLogSearch }) {
  const colorize = (line) => {
    let color = "#cdd6f4";
    let fontWeight = 400;
    if (/^[═=]{4,}/.test(line) || /^─{4,}/.test(line)) { color = "#585b70"; }
    else if (/^(AMATAS|FINAL SUMMARY|MODEL COMPARISON|WHY GPT|IMPLICATIONS|THREE-MODEL|SONNET)/.test(line)) { color = "#cba6f7"; fontWeight = 700; }
    else if (/^\[.*\]/.test(line) && /PASS/.test(line)) { color = "#a6e3a1"; }
    else if (/^\[.*\]/.test(line) && /FAIL/.test(line)) { color = "#f38ba8"; }
    else if (/VALIDATION FAILED|KILLED|Pipeline stopped/.test(line)) { color = "#f38ba8"; fontWeight = 600; }
    else if (/PASS/.test(line)) { color = "#a6e3a1"; }
    else if (/FAIL/.test(line)) { color = "#f38ba8"; }
    else if (/^\[2026-/.test(line)) { color = "#a6adc8"; }
    else if (/^┌|^├|^└|^│/.test(line)) { color = "#89b4fa"; }
    else if (/Batch saved|Creating batch|Ordering check/.test(line)) { color = "#94e2d5"; }
    else if (/^\s{2,}/.test(line) && /\d/.test(line)) { color = "#bac2de"; }
    return { color, fontWeight };
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-2 tracking-tight">Pipeline Run Log</h2>
      <p className="text-sm text-gray-500 mb-4 max-w-3xl leading-relaxed">
        Full execution log from the Stage 1 pipeline — model validation failures, three-model comparison, batch creation events, and timing data.
      </p>

      {runLogLoading && <p className="text-gray-500 italic">Loading run log...</p>}

      {runLogText && runLogText !== "ERROR: Could not load run_log.txt" && (
        <>
          <input
            type="text"
            placeholder="Search log..."
            value={runLogSearch}
            onChange={e => setRunLogSearch(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md w-80 mb-3 font-mono"
          />
          {runLogSearch && (() => {
            const count = runLogText.split("\n").filter(l => l.toLowerCase().includes(runLogSearch.toLowerCase())).length;
            return <div className="text-xs text-gray-500 mb-2">{count} matching line{count !== 1 ? "s" : ""}</div>;
          })()}
          <div
            className="rounded-lg px-6 py-5 overflow-x-auto overflow-y-auto"
            style={{ background: "#1e1e2e", maxHeight: 600, border: "1px solid #313244" }}
          >
            <pre className="m-0 text-xs leading-relaxed" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace" }}>
              {runLogText
                .split("\n")
                .map((line, idx) => ({ line, idx }))
                .filter(({ line }) => !runLogSearch || line.toLowerCase().includes(runLogSearch.toLowerCase()))
                .map(({ line, idx }) => {
                  const { color, fontWeight } = colorize(line);
                  return <span key={idx} style={{ color, fontWeight }}>{line}{"\n"}</span>;
                })}
            </pre>
          </div>
        </>
      )}

      {runLogText === "ERROR: Could not load run_log.txt" && (
        <p className="text-red-500">Could not load run_log.txt from GitHub. Make sure it has been pushed.</p>
      )}
    </div>
  );
}
