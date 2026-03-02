import React from "react";

export default function LiveBanner({
  liveStatus,
  liveSummary,
  livePanelOpen,
  setLivePanelOpen,
}) {
  if (!liveStatus) return null;

  const progress = liveStatus.progress || 0;
  const total = liveStatus.total || 0;
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;
  const cost = liveStatus.cost != null ? `$${liveStatus.cost.toFixed(2)}` : "--";
  const experimentName = liveStatus.experiment || "Unknown";
  const status = liveStatus.status || "running";

  const completedExperiments = liveSummary?.completed || [];
  const queuedExperiments = liveSummary?.queued || [];
  const runningTotals = liveSummary?.totals || {};

  const statusBadge = {
    running: "bg-blue-100 text-blue-700",
    paused: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-blue-50 border-b border-blue-200">
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .live-pulse {
          animation: livePulse 2s ease-in-out infinite;
        }
      `}</style>

      {/* Clickable summary bar */}
      <button
        onClick={() => setLivePanelOpen(!livePanelOpen)}
        className="w-full max-w-6xl mx-auto px-8 py-3 flex items-center gap-4 text-left"
      >
        {/* Pulsing dot */}
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
          <span className="live-pulse absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
        </span>

        {/* Experiment name */}
        <span className="text-sm font-medium text-blue-900 truncate">
          {experimentName}
        </span>

        {/* Progress bar */}
        <div className="flex-1 max-w-xs bg-blue-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-blue-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Percentage */}
        <span className="text-xs font-mono text-blue-700 w-10 text-right">
          {percentage}%
        </span>

        {/* Cost */}
        <span className="text-xs font-mono text-blue-600">{cost}</span>

        {/* Status badge */}
        <span
          className={
            "text-xs font-medium px-2 py-0.5 rounded-full " +
            (statusBadge[status] || statusBadge.running)
          }
        >
          {status}
        </span>

        {/* Chevron */}
        <svg
          className={
            "w-4 h-4 text-blue-400 transition-transform flex-shrink-0 " +
            (livePanelOpen ? "rotate-180" : "")
          }
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded panel */}
      {livePanelOpen && (
        <div className="max-w-6xl mx-auto px-8 pb-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Experiment Queue */}
            <div>
              <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">
                Experiment Queue
              </h4>
              <ul className="space-y-1">
                {completedExperiments.map((exp, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-blue-700">
                    <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{exp}</span>
                  </li>
                ))}

                {/* Current */}
                <li className="flex items-center gap-2 text-xs text-blue-900 font-medium">
                  <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>{experimentName}</span>
                </li>

                {/* Queued */}
                {queuedExperiments.map((exp, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-blue-400">
                    <span className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />
                    </span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Running Totals */}
            <div>
              <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-2">
                Running Totals
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white bg-opacity-60 rounded-lg px-3 py-2">
                  <p className="text-xs text-blue-500">Recall</p>
                  <p className="text-sm font-semibold text-blue-900">
                    {runningTotals.recall != null ? `${runningTotals.recall}%` : "--"}
                  </p>
                </div>
                <div className="bg-white bg-opacity-60 rounded-lg px-3 py-2">
                  <p className="text-xs text-blue-500">FPR</p>
                  <p className="text-sm font-semibold text-blue-900">
                    {runningTotals.fpr != null ? `${runningTotals.fpr}%` : "--"}
                  </p>
                </div>
                <div className="bg-white bg-opacity-60 rounded-lg px-3 py-2">
                  <p className="text-xs text-blue-500">Avg F1</p>
                  <p className="text-sm font-semibold text-blue-900">
                    {runningTotals.f1 != null ? `${runningTotals.f1}%` : "--"}
                  </p>
                </div>
                <div className="bg-white bg-opacity-60 rounded-lg px-3 py-2">
                  <p className="text-xs text-blue-500">Total Cost</p>
                  <p className="text-sm font-semibold text-blue-900">
                    {runningTotals.cost != null ? `$${runningTotals.cost.toFixed(2)}` : "--"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
