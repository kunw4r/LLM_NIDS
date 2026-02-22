import { useState, useEffect, Fragment } from "react";

// ── Polling hook ─────────────────────────────────────────────────────────────
// Silent fetch on interval — no loading spinners, just smooth updates.

function usePolling(url, interval = 15000) {
  const [data, setData] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(url);
        if (res.ok && active) {
          setData(await res.json());
          setFetchedAt(Date.now());
        }
      } catch {
        // Silent — no error states
      }
    };
    poll();
    const id = setInterval(poll, interval);
    return () => { active = false; clearInterval(id); };
  }, [url, interval]);

  return [data, fetchedAt];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const verdictColor = (v) => {
  if (!v) return "#1a1a1a";
  const u = v.toUpperCase();
  if (u === "MALICIOUS") return "#dc2626";
  if (u === "BENIGN") return "#16a34a";
  if (u === "SUSPICIOUS") return "#d97706";
  return "#1a1a1a";
};

const recallText = (r) => r >= 80 ? "#16a34a" : r >= 40 ? "#d97706" : "#dc2626";
const recallBg = (r) => r >= 80 ? "#f0fdf4" : r >= 40 ? "#fffbeb" : "#fef2f2";

const AGENTS = ["Protocol", "Statistical", "Behavioral", "Temporal", "Devil's Advocate", "Orchestrator"];

// ── LiveTab ──────────────────────────────────────────────────────────────────

function LiveTab({ status, control, sendCommand }) {
  if (!status) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg" style={{ color: "#9ca3af" }}>
          Waiting for experiment to start...
        </p>
        <p className="text-sm mt-2" style={{ color: "#d1d5db" }}>
          The pipeline will appear here when it begins.
        </p>
      </div>
    );
  }

  const { experiment, progress, last_flow, metrics, recent, queue } = status;
  const cmd = control?.command || "run";
  const stateLabel = cmd === "run" ? "Running" : cmd === "pause" ? "Paused" : "Stopped";
  const stateColor = cmd === "run" ? "#16a34a" : cmd === "pause" ? "#d97706" : "#dc2626";
  const pct = progress ? (progress.flows_done / progress.flows_total * 100) : 0;

  return (
    <div className="space-y-10">

      {/* ── A: Current Experiment Status ── */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: stateColor }}
          />
          <span className="text-sm font-medium" style={{ color: stateColor }}>
            Pipeline: {stateLabel}
          </span>
        </div>

        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              Running: {experiment?.name || "\u2014"}
            </h2>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              Stage {experiment?.stage ?? "\u2014"} &middot; Experiment{" "}
              {experiment?.number ?? "\u2014"} of {experiment?.total ?? "\u2014"}
            </p>
          </div>

          <div className="flex gap-2">
            {cmd === "run" && (
              <>
                <ControlBtn onClick={() => sendCommand("pause")}>
                  Pause after this flow
                </ControlBtn>
                <ControlBtn onClick={() => sendCommand("stop")}>
                  Stop after this batch
                </ControlBtn>
              </>
            )}
            {cmd === "pause" && (
              <>
                <ControlBtn onClick={() => sendCommand("run")} primary>
                  Resume
                </ControlBtn>
                <ControlBtn onClick={() => sendCommand("stop")}>
                  Stop after this batch
                </ControlBtn>
              </>
            )}
            {cmd === "stop" && (
              <ControlBtn onClick={() => sendCommand("run")} primary>
                Resume
              </ControlBtn>
            )}
          </div>
        </div>

        {(cmd === "pause" || cmd === "stop") && (
          <p className="text-xs mt-3" style={{ color: "#9ca3af" }}>
            {cmd === "pause"
              ? "Processing will pause after the current flow. Review results before continuing."
              : "Pipeline will stop after the current experiment. Resume in the morning to continue."}
          </p>
        )}

        <div className="mt-6">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: "#e5e7eb" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${pct}%`,
                background: "#2563eb",
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <p className="text-sm mt-2" style={{ color: "#6b7280" }}>
            {progress?.flows_done?.toLocaleString()} /{" "}
            {progress?.flows_total?.toLocaleString()} flows analysed
            {progress?.cost != null && <> &middot; ${progress.cost.toFixed(2)} spent</>}
            {progress?.eta && <> &middot; ~{progress.eta}</>}
          </p>
        </div>
      </section>

      {/* ── B: Last Flow Analysed ── */}
      {last_flow && (
        <section>
          <h3
            className="text-sm font-medium mb-4"
            style={{ color: "#6b7280" }}
          >
            What each agent said about the most recent flow
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {AGENTS.map((name) => {
              const a = last_flow.agents?.[name];
              if (!a) return null;
              return (
                <div
                  key={name}
                  className="rounded-lg p-4 text-center"
                  style={{ border: "1px solid #e5e7eb" }}
                >
                  <div className="text-xs mb-2" style={{ color: "#6b7280" }}>
                    {name}
                  </div>
                  <div
                    className="text-sm font-semibold"
                    style={{ color: verdictColor(a.verdict) }}
                  >
                    {a.verdict}
                    {name === "Orchestrator" && (
                      <span className="ml-1">
                        {last_flow.correct ? " \u2713" : " \u2717"}
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#9ca3af" }}>
                    conf: {a.confidence?.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-sm mt-4" style={{ color: "#6b7280" }}>
            Flow {last_flow.number} &mdash; {last_flow.actual} (actual) &mdash;
            Verdict:{" "}
            <span
              style={{
                color: verdictColor(last_flow.verdict),
                fontWeight: 600,
              }}
            >
              {last_flow.verdict}
            </span>{" "}
            {last_flow.correct ? "\u2713" : "\u2717"}
          </p>
        </section>
      )}

      {/* ── C: Running Metrics ── */}
      {metrics && (
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricBox
              label="Attacks Detected"
              num={metrics.attacks_detected}
              denom={metrics.attacks_seen}
              suffix="seen"
            />
            <MetricBox
              label="False Positives"
              num={metrics.false_positives}
              denom={metrics.benign_seen}
              suffix="seen"
            />
          </div>
          <p className="text-xs mt-2" style={{ color: "#9ca3af" }}>
            Updates every 10 flows
          </p>
        </section>
      )}

      {/* ── D: Recent Verdicts ── */}
      {recent && recent.length > 0 && (
        <section>
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: "#6b7280" }}
          >
            Recent Verdicts
          </h3>
          <div
            className="rounded-lg overflow-hidden"
            style={{
              border: "1px solid #e5e7eb",
              maxHeight: 320,
              overflowY: "auto",
            }}
          >
            {recent.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-2 text-sm"
                style={{
                  borderBottom:
                    i < recent.length - 1 ? "1px solid #f3f4f6" : "none",
                }}
              >
                <span
                  className="font-mono text-xs"
                  style={{ color: "#9ca3af", minWidth: 48 }}
                >
                  #{r.flow}
                </span>
                <span className="flex-1" style={{ color: "#6b7280" }}>
                  {r.actual}
                </span>
                <span
                  className="font-medium"
                  style={{ color: verdictColor(r.verdict) }}
                >
                  {r.verdict}
                </span>
                <span>{r.correct ? "\u2713" : "\u2717"}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── E: Experiment Queue ── */}
      {queue && queue.length > 0 && (
        <section>
          <h3
            className="text-sm font-medium mb-3"
            style={{ color: "#6b7280" }}
          >
            Experiment Queue
          </h3>
          <div className="space-y-1">
            {queue.map((q, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 text-sm">
                <span
                  style={{
                    color:
                      q.status === "complete"
                        ? "#16a34a"
                        : q.status === "running"
                        ? "#2563eb"
                        : "#d1d5db",
                    width: 16,
                    textAlign: "center",
                  }}
                >
                  {q.status === "complete"
                    ? "\u2713"
                    : q.status === "running"
                    ? "\u25b6"
                    : ""}
                </span>
                <span
                  style={{
                    color: q.status === "queued" ? "#9ca3af" : "#1a1a1a",
                    fontWeight: q.status === "queued" ? 400 : 500,
                  }}
                >
                  {q.name}
                </span>
                <span
                  className="ml-auto text-xs"
                  style={{
                    color:
                      q.status === "running"
                        ? "#2563eb"
                        : q.status === "complete"
                        ? "#6b7280"
                        : "#d1d5db",
                  }}
                >
                  {q.status === "complete" &&
                    `recall: ${q.recall}%  fpr: ${q.fpr}%  $${q.cost?.toFixed(2)}`}
                  {q.status === "running" && `running \u2014 ${q.progress}% done`}
                  {q.status === "queued" && "queued"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Small reusable pieces ────────────────────────────────────────────────────

function ControlBtn({ children, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm rounded-lg border transition-colors cursor-pointer"
      style={{
        borderColor: primary ? "#2563eb" : "#e5e7eb",
        background: primary ? "#2563eb" : "transparent",
        color: primary ? "white" : "#1a1a1a",
      }}
      onMouseOver={(e) => {
        if (!primary) e.currentTarget.style.background = "#f9fafb";
      }}
      onMouseOut={(e) => {
        if (!primary) e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function MetricBox({ label, num, denom, suffix }) {
  const pct = denom > 0 ? Math.round((num / denom) * 100) : 0;
  return (
    <div className="rounded-lg p-6" style={{ border: "1px solid #e5e7eb" }}>
      <div className="text-sm" style={{ color: "#6b7280" }}>
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">
        {num} / {denom} {suffix}
        <span
          className="text-sm font-normal ml-2"
          style={{ color: "#6b7280" }}
        >
          ({pct}%)
        </span>
      </div>
    </div>
  );
}

// ── ExperimentTable (shared by Results + Stage 1) ────────────────────────────

function ExperimentTable({ experiments }) {
  const [sortKey, setSortKey] = useState("attack_type");
  const [sortDir, setSortDir] = useState("asc");
  const [expanded, setExpanded] = useState(null);

  if (!experiments || experiments.length === 0) {
    return (
      <p className="text-sm py-8 text-center" style={{ color: "#9ca3af" }}>
        No results yet. Data will appear as experiments complete.
      </p>
    );
  }

  const sorted = [...experiments].sort((a, b) => {
    const av = a[sortKey],
      bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number")
      return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  const toggle = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const arrow = (key) =>
    sortKey !== key ? "" : sortDir === "asc" ? " \u2191" : " \u2193";

  const cols = [
    { key: "attack_type", label: "Attack Type" },
    { key: "recall", label: "Recall" },
    { key: "fpr", label: "FPR" },
    { key: "f1", label: "F1" },
    { key: "cost", label: "Cost" },
    { key: "cost_per_tp", label: "$/TP" },
  ];

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid #e5e7eb" }}
    >
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
            {cols.map((c) => (
              <th
                key={c.key}
                onClick={() => toggle(c.key)}
                className="text-left px-4 py-3 font-medium cursor-pointer select-none"
                style={{ color: "#6b7280" }}
              >
                {c.label}
                {arrow(c.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((exp) => (
            <Fragment key={exp.attack_type}>
              <tr
                onClick={() =>
                  setExpanded(
                    expanded === exp.attack_type ? null : exp.attack_type
                  )
                }
                className="cursor-pointer transition-colors"
                style={{ borderBottom: "1px solid #f3f4f6" }}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "#f9fafb")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <td className="px-4 py-3 font-medium">{exp.attack_type}</td>
                <td
                  className="px-4 py-3"
                  style={{
                    color: recallText(exp.recall),
                    background: recallBg(exp.recall),
                  }}
                >
                  {exp.recall}%
                </td>
                <td
                  className="px-4 py-3"
                  style={{
                    background: exp.fpr > 30 ? "#fef2f2" : "transparent",
                  }}
                >
                  {exp.fpr}%
                </td>
                <td className="px-4 py-3">{exp.f1}%</td>
                <td className="px-4 py-3">${exp.cost?.toFixed(2)}</td>
                <td className="px-4 py-3">${exp.cost_per_tp?.toFixed(2)}</td>
              </tr>
              {expanded === exp.attack_type && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-5"
                    style={{
                      background: "#fafafa",
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    <div className="flex flex-wrap gap-8 items-start">
                      {exp.confusion && (
                        <div>
                          <div
                            className="text-xs font-medium mb-2"
                            style={{ color: "#6b7280" }}
                          >
                            Confusion Matrix
                          </div>
                          <div
                            className="grid grid-cols-2 gap-1"
                            style={{ maxWidth: 200 }}
                          >
                            {[
                              {
                                label: "TP",
                                val: exp.confusion.tp,
                                bg: "#f0fdf4",
                              },
                              {
                                label: "FN",
                                val: exp.confusion.fn,
                                bg: "#fef2f2",
                              },
                              {
                                label: "FP",
                                val: exp.confusion.fp,
                                bg: "#fffbeb",
                              },
                              {
                                label: "TN",
                                val: exp.confusion.tn,
                                bg: "#f0fdf4",
                              },
                            ].map((c) => (
                              <div
                                key={c.label}
                                className="rounded p-3 text-center"
                                style={{ background: c.bg }}
                              >
                                <div
                                  className="text-xs"
                                  style={{ color: "#6b7280" }}
                                >
                                  {c.label}
                                </div>
                                <div className="text-lg font-semibold">
                                  {c.val}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {exp.confusion && (
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div
                            className="text-xs font-medium mb-2"
                            style={{ color: "#6b7280" }}
                          >
                            Summary
                          </div>
                          <p
                            className="text-sm"
                            style={{ color: "#374151", lineHeight: 1.7 }}
                          >
                            AMATAS detected {exp.confusion.tp} of{" "}
                            {exp.confusion.tp + exp.confusion.fn} attacks. It
                            incorrectly flagged {exp.confusion.fp} of{" "}
                            {exp.confusion.fp + exp.confusion.tn} normal flows.
                          </p>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── ResultsTab ───────────────────────────────────────────────────────────────

function ResultsTab({ summary }) {
  const o = summary?.overall;

  return (
    <div className="space-y-8">
      {o && (
        <div className="rounded-lg p-6" style={{ border: "1px solid #e5e7eb" }}>
          <div
            className="space-y-1 text-sm"
            style={{ color: "#374151", lineHeight: 1.7 }}
          >
            <p>
              Best detected:{" "}
              <strong>{o.best_detected}</strong> ({o.best_recall}% recall)
            </p>
            <p>
              Hardest to detect:{" "}
              <strong>{o.hardest}</strong> ({o.hardest_recall}% recall)
            </p>
            <p>
              Average false positive rate: <strong>{o.avg_fpr}%</strong>
            </p>
            <p>
              Total spent: <strong>${o.total_cost?.toFixed(2)}</strong>
            </p>
          </div>
        </div>
      )}

      <ExperimentTable experiments={summary?.experiments} />
    </div>
  );
}

// ── ArchitectureTab ──────────────────────────────────────────────────────────

function ArchitectureTab() {
  const [showComp, setShowComp] = useState(false);

  const descs = [
    ["Protocol Analyzer", "Examines ports, protocols, and connection patterns to identify known attack signatures."],
    ["Statistical Analyzer", "Compares packet sizes, byte ratios, and flow duration against baseline distributions."],
    ["Behavioral Analyzer", "Looks at what the connection is doing \u2014 scanning, exfiltrating, or behaving normally."],
    ["Temporal Analyzer", "Tracks patterns over time \u2014 repeated connections, sudden bursts, slow-and-low activity."],
    ["Devil\u2019s Advocate", "Argues against the majority. If everyone says attack, it looks for reasons it might be benign."],
    ["Orchestrator", "Weighs all opinions and makes the final call. Can override individuals but respects consensus."],
  ];

  return (
    <div className="space-y-10">
      <p className="text-lg" style={{ color: "#374151", lineHeight: 1.7 }}>
        AMATAS works like a panel of specialists examining the same evidence
        from different angles.
      </p>

      {/* Pipeline diagram */}
      <div className="flex flex-col items-center gap-4 py-4">
        <DiagramBox>Network Flow</DiagramBox>
        <Arrow />
        <div className="flex flex-wrap justify-center gap-3">
          {["Protocol", "Statistical", "Behavioral", "Temporal"].map((n) => (
            <div
              key={n}
              className="rounded-lg px-4 py-2 text-sm"
              style={{ border: "1px solid #2563eb", color: "#2563eb" }}
            >
              {n}
            </div>
          ))}
        </div>
        <Arrow />
        <div
          className="rounded-lg px-5 py-2 text-sm"
          style={{ border: "1px solid #d97706", color: "#d97706" }}
        >
          Devil&rsquo;s Advocate
        </div>
        <Arrow />
        <div
          className="rounded-lg px-5 py-3 text-sm font-medium"
          style={{ background: "#2563eb", color: "white" }}
        >
          Orchestrator
        </div>
        <Arrow />
        <div className="text-sm font-semibold flex gap-3">
          <span style={{ color: "#dc2626" }}>MALICIOUS</span>
          <span style={{ color: "#d1d5db" }}>/</span>
          <span style={{ color: "#16a34a" }}>BENIGN</span>
        </div>
      </div>

      {/* Agent descriptions */}
      <div className="space-y-3">
        {descs.map(([name, desc]) => (
          <div key={name} className="flex gap-4 text-sm">
            <span className="font-medium shrink-0" style={{ width: 160 }}>
              {name}
            </span>
            <span style={{ color: "#6b7280" }}>{desc}</span>
          </div>
        ))}
      </div>

      {/* Expandable comparison */}
      <div>
        <button
          onClick={() => setShowComp(!showComp)}
          className="text-sm font-medium cursor-pointer"
          style={{
            color: "#2563eb",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          {showComp ? "\u25be" : "\u25b8"} How is this different from before?
        </button>
        {showComp && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              className="rounded-lg p-5"
              style={{ border: "1px solid #e5e7eb" }}
            >
              <div
                className="text-xs font-medium mb-3"
                style={{ color: "#9ca3af" }}
              >
                PHASE 1 &mdash; SINGLE AGENT
              </div>
              <ul
                className="space-y-2 text-sm list-none p-0 m-0"
                style={{ color: "#6b7280" }}
              >
                <li>One LLM analyses each flow alone</li>
                <li>
                  External tool calls (AbuseIPDB, OTX) return nothing for
                  private IPs
                </li>
                <li>No memory between flows</li>
                <li>
                  High precision but misses DoS, DDoS, Infiltration entirely
                </li>
              </ul>
            </div>
            <div
              className="rounded-lg p-5"
              style={{ border: "1px solid #2563eb" }}
            >
              <div
                className="text-xs font-medium mb-3"
                style={{ color: "#2563eb" }}
              >
                PHASE 3 &mdash; MULTI-AGENT
              </div>
              <ul
                className="space-y-2 text-sm list-none p-0 m-0"
                style={{ color: "#374151" }}
              >
                <li>Six specialised agents debate each flow</li>
                <li>Devil&rsquo;s Advocate reduces false positives</li>
                <li>Temporal agent tracks patterns across flows</li>
                <li>Recovers detection for previously invisible attacks</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DiagramBox({ children }) {
  return (
    <div
      className="rounded-lg px-6 py-3 text-sm font-medium"
      style={{ border: "1px solid #e5e7eb" }}
    >
      {children}
    </div>
  );
}

function Arrow() {
  return (
    <div className="text-lg" style={{ color: "#d1d5db", lineHeight: 1 }}>
      &darr;
    </div>
  );
}

// ── Stage1Tab ────────────────────────────────────────────────────────────────

function Stage1Tab({ summary }) {
  return (
    <div className="space-y-10">
      <p className="text-lg" style={{ color: "#374151", lineHeight: 1.7 }}>
        Real networks are 95%+ normal traffic. Previous experiments used
        70&ndash;92% attack traffic &mdash; unrealistic. Stage 1 tests each
        attack type with only 5% attacks in the batch.
      </p>

      {/* Batch design visual */}
      <section>
        <h3 className="text-sm font-medium mb-3" style={{ color: "#6b7280" }}>
          Batch Design
        </h3>
        <div
          className="rounded-lg overflow-hidden flex"
          style={{ height: 40, border: "1px solid #e5e7eb" }}
        >
          <div
            className="flex items-center justify-center text-xs font-medium"
            style={{
              flex: 19,
              background: "#f3f4f6",
              color: "#6b7280",
            }}
          >
            950 benign
          </div>
          <div
            className="flex items-center justify-center text-xs font-medium"
            style={{
              flex: 1,
              background: "#2563eb",
              color: "white",
              minWidth: 80,
            }}
          >
            50 attacks
          </div>
        </div>
        <p className="text-xs mt-2" style={{ color: "#9ca3af" }}>
          950 benign + 50 attacks = 1,000 flows per experiment
        </p>
      </section>

      <ExperimentTable experiments={summary?.experiments} />
    </div>
  );
}

// ── WhatsNextTab ─────────────────────────────────────────────────────────────

function WhatsNextTab() {
  const stages = [
    {
      name: "Stage 1",
      status: "running",
      title: "Per-attack-type at 5% prevalence",
      desc: "Each of the 14 attack types tested individually with 5% prevalence in a 1,000-flow batch. This isolates detection performance per attack type under realistic class imbalance, establishing a baseline for each category.",
    },
    {
      name: "Stage 2",
      status: "planned",
      title: "Mixed attack types, 10,000 flows",
      desc: "Multiple attack types combined in a single batch of 10,000 flows at 5% total attack prevalence. Tests whether the system can handle diverse concurrent threats without cross-contamination of detection signals.",
    },
    {
      name: "Stage 3",
      status: "planned",
      title: "Full coverage mixed batch",
      desc: "All 14 attack types present simultaneously in a large-scale batch. The ultimate test of the multi-agent system\u2019s ability to generalise across the full threat landscape at realistic prevalence.",
    },
  ];

  return (
    <div className="space-y-6">
      {stages.map((s) => (
        <div
          key={s.name}
          className="rounded-lg p-6"
          style={{ border: "1px solid #e5e7eb" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-semibold">{s.name}</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: s.status === "running" ? "#eff6ff" : "#f9fafb",
                color: s.status === "running" ? "#2563eb" : "#9ca3af",
                border: `1px solid ${
                  s.status === "running" ? "#bfdbfe" : "#e5e7eb"
                }`,
              }}
            >
              {s.status}
            </span>
          </div>
          <h3 className="text-base font-medium mb-2">{s.title}</h3>
          <p className="text-sm" style={{ color: "#6b7280", lineHeight: 1.7 }}>
            {s.desc}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function NIDSDashboard() {
  const [tab, setTab] = useState("live");
  const [liveStatus, liveFetched] = usePolling("/api/status", 15000);
  const [summary, summaryFetched] = usePolling("/api/summary", 15000);
  const [control, controlFetched] = usePolling("/api/control", 15000);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  useEffect(() => {
    const latest = Math.max(
      liveFetched || 0,
      summaryFetched || 0,
      controlFetched || 0
    );
    if (latest > 0) setLastUpdated(latest);
  }, [liveFetched, summaryFetched, controlFetched]);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const sendCommand = async (command) => {
    try {
      await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
    } catch {}
  };

  const o = summary?.overall;
  const bestF1 = o?.best_f1 != null ? `${o.best_f1}%` : "\u2014";
  const totalFlows =
    o?.total_flows?.toLocaleString() ??
    liveStatus?.progress?.flows_done?.toLocaleString() ??
    "\u2014";
  const totalCost =
    o?.total_cost != null
      ? `$${o.total_cost.toFixed(2)}`
      : liveStatus?.progress?.cost != null
      ? `$${liveStatus.progress.cost.toFixed(2)}`
      : "\u2014";

  const tabs = [
    { id: "live", label: "Live" },
    { id: "results", label: "Results" },
    { id: "architecture", label: "Architecture" },
    { id: "stage1", label: "Stage 1" },
    { id: "next", label: "What\u2019s Next" },
  ];

  return (
    <div
      className="min-h-screen bg-white"
      style={{
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        color: "#1a1a1a",
      }}
    >
      {/* ── Header ── */}
      <header className="max-w-4xl mx-auto px-6 pt-8 pb-4">
        <div className="flex items-baseline justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AMATAS</h1>
            <p className="text-sm mt-0.5" style={{ color: "#9ca3af" }}>
              LLM-based NIDS Research
            </p>
          </div>
          <div className="flex gap-8">
            {[
              { label: "Best F1", value: bestF1 },
              { label: "Flows Tested", value: totalFlows },
              { label: "Cost Spent", value: totalCost },
            ].map((s) => (
              <div key={s.label} className="text-right">
                <div className="text-xs" style={{ color: "#9ca3af" }}>
                  {s.label}
                </div>
                <div className="text-lg font-semibold">{s.value}</div>
              </div>
            ))}
          </div>
        </div>
        <hr className="mt-4" style={{ borderColor: "#e5e7eb" }} />
      </header>

      {/* ── Navigation ── */}
      <nav className="max-w-4xl mx-auto px-6 flex gap-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="pb-2 text-sm cursor-pointer"
            style={{
              color: tab === t.id ? "#2563eb" : "#9ca3af",
              fontWeight: tab === t.id ? 500 : 400,
              background: "none",
              border: "none",
              borderBottom:
                tab === t.id
                  ? "2px solid #2563eb"
                  : "2px solid transparent",
              padding: "0 0 8px 0",
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {tab === "live" && (
          <LiveTab
            status={liveStatus}
            control={control}
            sendCommand={sendCommand}
          />
        )}
        {tab === "results" && <ResultsTab summary={summary} />}
        {tab === "architecture" && <ArchitectureTab />}
        {tab === "stage1" && <Stage1Tab summary={summary} />}
        {tab === "next" && <WhatsNextTab />}
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-4xl mx-auto px-6 pb-8">
        <p className="text-xs" style={{ color: "#d1d5db" }}>
          Last updated {secondsAgo}s ago
        </p>
      </footer>
    </div>
  );
}
