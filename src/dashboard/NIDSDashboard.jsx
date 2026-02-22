import { useState, useEffect, Fragment } from "react";

// ── Polling hook (with error tracking) ───────────────────────────────────────

function usePolling(url, interval = 15000) {
  const [data, setData] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(url);
        if (res.ok && active) {
          setData(await res.json());
          setFetchedAt(Date.now());
          setError(false);
        } else if (active) {
          setError(true);
        }
      } catch {
        if (active) setError(true);
      }
    };
    poll();
    const id = setInterval(poll, interval);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [url, interval]);

  return [data, fetchedAt, error];
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

const recallText = (r) =>
  r >= 80 ? "#16a34a" : r >= 40 ? "#d97706" : "#dc2626";
const recallBg = (r) =>
  r >= 80 ? "#f0fdf4" : r >= 40 ? "#fffbeb" : "#fef2f2";
const f1Color = (f1) =>
  f1 >= 80 ? "#16a34a" : f1 >= 40 ? "#d97706" : "#dc2626";

const AGENTS = [
  "Protocol",
  "Statistical",
  "Behavioral",
  "Temporal",
  "Devil's Advocate",
  "Orchestrator",
];

// ── Experiment narrative data ────────────────────────────────────────────────

const STORY = [
  {
    id: 1,
    phase: 1,
    group: "Phase 1 \u2014 MCP Baseline",
    name: "Phase 1 MCP Baseline",
    short: "MCP Baseline",
    date: "2026-02-19",
    flows: 58,
    f1: 83.3,
    recall: 93.0,
    benignAcc: 13.3,
    cost: 3.98,
    tried:
      "Single Claude agent with 13 MCP tools (AbuseIPDB, OTX, geolocation). Every flow analysed by one agent that could call external threat databases.",
    happened:
      "The 83.3% F1 came entirely from the LLM\u2019s pre-trained knowledge \u2014 not the tools. External tools returned zero useful data because all IPs are private RFC1918 addresses. But 87% of benign flows were incorrectly flagged as suspicious or malicious.",
    learned:
      "External threat intelligence is useless for anonymised datasets. The LLM works better without tools than with them. False positive rate is catastrophically high.",
    nextLabel: "Phase 2 Iteration 1 \u2014 Temporal Memory",
  },
  {
    id: 2,
    phase: 2,
    group: "Phase 2 \u2014 Single Agent Iterations",
    name: "Phase 2 Iter 1 \u2014 Temporal Memory",
    short: "Temporal Memory",
    date: "2026-02-19",
    flows: 58,
    f1: 75.3,
    recall: 67.4,
    benignAcc: 66.7,
    cost: 6.73,
    tried:
      "Added SQLite temporal store tracking flows per source IP in a 60-second sliding window.",
    happened:
      "Temporal context only fired on 2 of 58 flows because the stratified batch spread flows across many IPs. Traded recall for specificity \u2014 a net negative.",
    learned:
      "Temporal memory needs dense same-IP sequences to be useful. Stratified sampling defeats temporal correlation by design.",
    nextLabel: "Phase 2 Iteration 2 \u2014 Benign Calibration",
  },
  {
    id: 3,
    phase: 2,
    group: "Phase 2 \u2014 Single Agent Iterations",
    name: "Phase 2 Iter 2 \u2014 Benign Calibration",
    short: "Benign Calibration",
    date: "2026-02-19",
    flows: 58,
    f1: 77.6,
    recall: 76.7,
    benignAcc: 40.0,
    cost: 7.18,
    tried:
      "Enhanced system prompt teaching the agent that empty threat intel on private IPs is normal, and to require positive evidence before flagging.",
    happened:
      "Calibration improved benign accuracy from 13% to 40% and rescued Infiltration detection (33%\u2192100%) but degraded volume attacks (DoS-Slowloris 100%\u219233%). Still couldn\u2019t beat the baseline.",
    learned:
      "Prompt calibration is a zero-sum game in single-agent systems. Every improvement in one dimension hurts another.",
    nextLabel: "Phase 2 Iteration 3 \u2014 Combined",
  },
  {
    id: 4,
    phase: 2,
    group: "Phase 2 \u2014 Single Agent Iterations",
    name: "Phase 2 Iter 3 \u2014 Combined",
    short: "Combined",
    date: "2026-02-19",
    flows: 58,
    f1: 45.2,
    recall: 32.6,
    benignAcc: 66.7,
    cost: 7.28,
    tried:
      "Stacked all three improvements \u2014 temporal memory + benign calibration + confidence threshold override.",
    happened:
      "The confidence override killed twice as many true positives as false positives. Four entire attack categories dropped to 0%. F1 collapsed from 83.3% to 45.2%.",
    learned:
      "This proved the single-agent ceiling. Every fix made something else worse. A fundamentally different architecture was needed.",
    nextLabel: "Phase 3a \u2014 AMATAS Mini",
  },
  {
    id: 5,
    phase: 3,
    group: "Phase 3 \u2014 Multi-Agent AMATAS",
    name: "Phase 3a \u2014 AMATAS Mini",
    short: "AMATAS Mini",
    date: "2026-02-20",
    flows: 58,
    f1: 71.6,
    recall: 55.8,
    benignAcc: 100,
    cost: 3.85,
    tried:
      "Replaced single agent with 6-agent AMATAS system. Four specialists + Devil\u2019s Advocate + Orchestrator. No MCP tools \u2014 pure LLM reasoning.",
    happened:
      "Perfect precision and perfect benign accuracy \u2014 the mirror image of Phase 1. But too conservative: the Devil\u2019s Advocate was too effective with only 3 flows per attack type, suppressing real detections.",
    learned:
      "Multi-agent debate eliminates false positives but needs sufficient attack density to maintain recall. 3 flows per attack type is not enough.",
    nextLabel: "Phase 3b \u2014 AMATAS Full",
  },
  {
    id: 6,
    phase: 3,
    group: "Phase 3 \u2014 Multi-Agent AMATAS",
    name: "Phase 3b \u2014 AMATAS Full",
    short: "AMATAS Full",
    date: "2026-02-20",
    flows: 150,
    f1: 95.9,
    recall: 100,
    benignAcc: 80,
    cost: 11.11,
    tried:
      "Same architecture, larger batch with 30 flows per attack type instead of 3.",
    happened:
      "Best result in the project. 100% recall with 80% benign accuracy. The temporal agent could see dense same-IP sequences and build evidence over time.",
    learned:
      "30 flows per attack type vs 3 was the critical difference. Temporal context density \u2014 not architecture changes \u2014 drives detection quality.",
    nextLabel: "Phase 3c \u2014 Realistic Distribution",
  },
  {
    id: 7,
    phase: 3,
    group: "Phase 3 \u2014 Multi-Agent AMATAS",
    name: "Phase 3c \u2014 Realistic Distribution",
    short: "Realistic Dist.",
    date: "2026-02-20",
    flows: 100,
    f1: 23.3,
    recall: 58.3,
    benignAcc: 53.4,
    cost: 6.51,
    tried:
      "Changed to 88% benign distribution to test realistic traffic conditions.",
    happened:
      "Catastrophic false positive explosion. 41 of 88 benign flows flagged as attacks. Specialists hallucinate attack patterns in normal traffic \u2014 HTTPS, DNS, NTP all flagged. 35 of 41 false positives had unanimous 4/4 specialist agreement.",
    learned:
      "The false positive problem is at the specialist level, not the orchestrator. When all four specialists agree a benign flow is malicious, neither the Devil\u2019s Advocate nor the Orchestrator can save it.",
    nextLabel: "Phase 3e \u2014 DA Weight Tuning",
  },
  {
    id: 8,
    phase: 3,
    group: "Phase 3 \u2014 Multi-Agent AMATAS",
    name: "Phase 3e \u2014 DA Weight Tuning",
    short: "DA Weight 50%",
    date: "2026-02-20",
    flows: 100,
    f1: 25.9,
    recall: 58.3,
    benignAcc: 60.2,
    cost: 6.54,
    tried:
      "Increased Devil\u2019s Advocate weight from 30% to 50% on same realistic batch.",
    happened:
      "Corrected 6 false positives with zero recall harm. But 34 remaining false positives had unanimous specialist agreement that the DA couldn\u2019t override even at 50% weight.",
    learned:
      "The false positive problem requires fixing specialist prompts, not tuning orchestrator weights. DA can correct borderline cases but not unanimous hallucinations.",
    nextLabel: "Scaled Stealthy \u2014 Sonnet",
  },
  {
    id: 9,
    phase: 3,
    group: "Phase 3 \u2014 Multi-Agent AMATAS",
    name: "Scaled Stealthy \u2014 Sonnet",
    short: "Stealthy 1K (Sonnet)",
    date: "2026-02-21",
    flows: 1000,
    f1: 82.3,
    recall: 72.7,
    benignAcc: 54.3,
    cost: 107.99,
    tried:
      "1,000-flow batch of 3 stealthy attack types that had 0% detection in Phase 3a \u2014 SQL Injection, XSS, Infiltration. Attack-type isolation + chronological IP ordering.",
    happened:
      "Recovered detection for all 3 previously invisible attacks. SQL Injection: 0%\u219293.3%. XSS: 0%\u219285.6%. Infiltration: 0%\u219238.3%. Temporal agent consumed 48% of total cost ($51.91).",
    learned:
      "Temporal context density was the key variable. Attacks that appeared undetectable in mixed traffic became detectable when isolated with enough same-type flows.",
    nextLabel: "Scaled Stealthy \u2014 GPT-4o-mini",
  },
  {
    id: 10,
    phase: 3,
    group: "Phase 3 \u2014 Multi-Agent AMATAS",
    name: "Scaled Stealthy \u2014 GPT-4o-mini",
    short: "Stealthy 1K (GPT-4o)",
    date: "2026-02-21",
    flows: 1000,
    f1: 95.8,
    recall: 100,
    benignAcc: 0,
    cost: 4.09,
    tried:
      "Same 1,000-flow batch using GPT-4o-mini for all agents \u2014 96% cheaper.",
    happened:
      "GPT-4o-mini exhibits systematic suspicious-by-default bias. Flags everything as malicious \u2014 100% recall is a trivial classifier artifact, not real detection. 0% benign accuracy.",
    learned:
      "Model selection critically affects architecture viability. A cheaper model that flags everything as malicious achieves high recall but is useless as a detector.",
    nextLabel: "Stage 1 \u2014 Realistic Evaluation",
  },
];

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
  const stateLabel =
    cmd === "run" ? "Running" : cmd === "pause" ? "Paused" : "Stopped";
  const stateColor =
    cmd === "run" ? "#16a34a" : cmd === "pause" ? "#d97706" : "#dc2626";
  const pct = progress
    ? (progress.flows_done / progress.flows_total) * 100
    : 0;

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
              {experiment?.number ?? "\u2014"} of{" "}
              {experiment?.total ?? "\u2014"}
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
            {progress?.cost != null && (
              <> &middot; ${progress.cost.toFixed(2)} spent</>
            )}
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
                    {a.confidence != null
                      ? `conf: ${a.confidence.toFixed(2)}`
                      : "\u00a0"}
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
                    q.recall != null &&
                    `recall: ${q.recall}%  fpr: ${q.fpr}%  $${q.cost?.toFixed(2)}`}
                  {q.status === "complete" && q.recall == null && "done"}
                  {q.status === "running" &&
                    `running \u2014 ${q.progress}% done`}
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
      className="px-3 py-1.5 text-sm rounded-lg border cursor-pointer"
      style={{
        borderColor: primary ? "#2563eb" : "#e5e7eb",
        background: primary ? "#2563eb" : "transparent",
        color: primary ? "white" : "#1a1a1a",
        transition: "background 0.15s",
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

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "#9ca3af" }}>
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// ── StoryTab ─────────────────────────────────────────────────────────────────

function StoryTab({ selectedId, setSelectedId, summary }) {
  // Build full list: static narratives + dynamic Stage 1
  const all = [...STORY];
  if (summary?.experiments) {
    summary.experiments.forEach((exp, i) => {
      all.push({
        id: 100 + i,
        phase: "s1",
        group: "Stage 1 \u2014 Realistic Evaluation",
        name: `Stage 1: ${exp.attack_type}`,
        short: exp.attack_type,
        date: "2026-02-22",
        flows: 1000,
        f1: exp.f1,
        recall: exp.recall,
        benignAcc: exp.fpr != null ? 100 - exp.fpr : null,
        cost: exp.cost,
        tried: `Testing ${exp.attack_type} at 5% prevalence in a 1,000-flow batch (950 benign + 50 attacks).`,
        happened: exp.confusion
          ? `Detected ${exp.confusion.tp} of ${exp.confusion.tp + exp.confusion.fn} attacks. Incorrectly flagged ${exp.confusion.fp} of ${exp.confusion.fp + exp.confusion.tn} normal flows. Recall: ${exp.recall}%, FPR: ${exp.fpr}%.`
          : `Recall: ${exp.recall}%, FPR: ${exp.fpr}%.`,
        learned:
          "Detailed analysis pending. Compare to historical results above.",
        nextLabel: null,
      });
    });
  }

  const current = all.find((e) => e.id === selectedId) || all[0];
  const idx = all.findIndex((e) => e.id === selectedId);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (e.key === "ArrowLeft" && prev) setSelectedId(prev.id);
      if (e.key === "ArrowRight" && next) setSelectedId(next.id);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, setSelectedId]);

  // Group by phase
  const groups = [];
  let lastGroup = null;
  all.forEach((exp) => {
    if (exp.group !== lastGroup) {
      groups.push({ label: exp.group, items: [] });
      lastGroup = exp.group;
    }
    groups[groups.length - 1].items.push(exp);
  });

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* ── Sidebar ── */}
      <div className="lg:w-56 lg:shrink-0">
        {groups.map((g) => (
          <div key={g.label} className="mb-5">
            <div
              className="text-xs font-medium mb-2 tracking-wide"
              style={{ color: "#9ca3af" }}
            >
              {g.label.toUpperCase()}
            </div>
            {g.items.map((exp) => (
              <button
                key={exp.id}
                onClick={() => setSelectedId(exp.id)}
                className="w-full text-left py-1.5 px-2 rounded text-sm cursor-pointer flex justify-between items-center"
                style={{
                  background:
                    selectedId === exp.id ? "#eff6ff" : "transparent",
                  color: selectedId === exp.id ? "#2563eb" : "#6b7280",
                  fontWeight: selectedId === exp.id ? 500 : 400,
                  border: "none",
                }}
              >
                <span className="truncate">{exp.short}</span>
                <span
                  className="text-xs ml-2 shrink-0 tabular-nums"
                  style={{ color: f1Color(exp.f1) }}
                >
                  {exp.f1}%
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-1">
          <h2 className="text-xl font-bold">{current.name}</h2>
          <span className="text-sm" style={{ color: "#9ca3af" }}>
            {current.date}
          </span>
        </div>
        <p className="text-xs mb-8" style={{ color: "#9ca3af" }}>
          {current.group} &middot; {current.flows} flows &middot; $
          {current.cost?.toFixed(2)}
        </p>

        {/* What we tried */}
        <section className="mb-8">
          <h3
            className="text-xs font-semibold tracking-wide mb-3"
            style={{ color: "#9ca3af", letterSpacing: "0.05em" }}
          >
            WHAT WE TRIED
          </h3>
          <p className="text-sm" style={{ color: "#374151", lineHeight: 1.7 }}>
            {current.tried}
          </p>
        </section>

        {/* What happened */}
        <section className="mb-8">
          <h3
            className="text-xs font-semibold tracking-wide mb-4"
            style={{ color: "#9ca3af", letterSpacing: "0.05em" }}
          >
            WHAT HAPPENED
          </h3>
          <div className="flex gap-8 mb-4">
            <Stat label="F1" value={`${current.f1}%`} />
            <Stat label="Recall" value={`${current.recall}%`} />
            <Stat
              label="Benign Acc"
              value={
                current.benignAcc != null ? `${current.benignAcc}%` : "\u2014"
              }
            />
          </div>
          <p className="text-sm" style={{ color: "#374151", lineHeight: 1.7 }}>
            {current.happened}
          </p>
        </section>

        {/* What we learned */}
        <section className="mb-8">
          <h3
            className="text-xs font-semibold tracking-wide mb-3"
            style={{ color: "#9ca3af", letterSpacing: "0.05em" }}
          >
            WHAT WE LEARNED
          </h3>
          <p className="text-sm" style={{ color: "#374151", lineHeight: 1.7 }}>
            {current.learned}
          </p>
        </section>

        {/* What we did next */}
        {current.nextLabel && next && (
          <section className="mb-8">
            <h3
              className="text-xs font-semibold tracking-wide mb-3"
              style={{ color: "#9ca3af", letterSpacing: "0.05em" }}
            >
              WHAT WE DID NEXT
            </h3>
            <button
              onClick={() => setSelectedId(next.id)}
              className="text-sm font-medium cursor-pointer"
              style={{
                color: "#2563eb",
                background: "none",
                border: "none",
                padding: 0,
              }}
            >
              Next: {current.nextLabel} &rarr;
            </button>
          </section>
        )}

        {/* Prev / Next navigation */}
        <div
          className="flex justify-between pt-6 mt-6"
          style={{ borderTop: "1px solid #e5e7eb" }}
        >
          {prev ? (
            <button
              onClick={() => setSelectedId(prev.id)}
              className="text-sm cursor-pointer"
              style={{
                color: "#6b7280",
                background: "none",
                border: "none",
                padding: 0,
              }}
            >
              &larr; {prev.short}
            </button>
          ) : (
            <span />
          )}
          {next ? (
            <button
              onClick={() => setSelectedId(next.id)}
              className="text-sm cursor-pointer"
              style={{
                color: "#6b7280",
                background: "none",
                border: "none",
                padding: 0,
              }}
            >
              {next.short} &rarr;
            </button>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ onSelect }) {
  return (
    <div
      className="flex items-end gap-0 py-4 mb-6 overflow-x-auto"
      style={{ minHeight: 56 }}
    >
      {STORY.map((exp, i) => (
        <Fragment key={exp.id}>
          <button
            onClick={() => onSelect(exp.id)}
            className="flex flex-col items-center cursor-pointer shrink-0 group"
            style={{ background: "none", border: "none", padding: "0 4px" }}
            title={`${exp.name}: F1 ${exp.f1}%`}
          >
            <div
              className="w-3 h-3 rounded-full mb-1"
              style={{
                background: f1Color(exp.f1),
                transition: "transform 0.15s",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.transform = "scale(1.4)")
              }
              onMouseOut={(e) =>
                (e.currentTarget.style.transform = "scale(1)")
              }
            />
            <span
              className="whitespace-nowrap"
              style={{ color: "#9ca3af", fontSize: 9, lineHeight: 1.2 }}
            >
              {exp.short}
            </span>
          </button>
          {i < STORY.length - 1 && (
            <div
              className="shrink-0 self-start mt-1.5"
              style={{
                height: 1,
                background: "#e5e7eb",
                minWidth: 12,
                flex: 1,
              }}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}

// ── ExperimentTable (shared by Comparison + Stage 1) ─────────────────────────

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
                className="cursor-pointer"
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
                                l: "TP",
                                v: exp.confusion.tp,
                                bg: "#f0fdf4",
                              },
                              {
                                l: "FN",
                                v: exp.confusion.fn,
                                bg: "#fef2f2",
                              },
                              {
                                l: "FP",
                                v: exp.confusion.fp,
                                bg: "#fffbeb",
                              },
                              {
                                l: "TN",
                                v: exp.confusion.tn,
                                bg: "#f0fdf4",
                              },
                            ].map((c) => (
                              <div
                                key={c.l}
                                className="rounded p-3 text-center"
                                style={{ background: c.bg }}
                              >
                                <div
                                  className="text-xs"
                                  style={{ color: "#6b7280" }}
                                >
                                  {c.l}
                                </div>
                                <div className="text-lg font-semibold">
                                  {c.v}
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

// ── ComparisonTab (formerly Results) ─────────────────────────────────────────

function ComparisonTab({ summary, goToStory }) {
  const o = summary?.overall;

  return (
    <div className="space-y-8">
      {/* Timeline */}
      <Timeline onSelect={goToStory} />

      {/* Summary card */}
      {o && (
        <div
          className="rounded-lg p-6"
          style={{ border: "1px solid #e5e7eb" }}
        >
          <div
            className="space-y-1 text-sm"
            style={{ color: "#374151", lineHeight: 1.7 }}
          >
            <p>
              Best detected: <strong>{o.best_detected}</strong> (
              {o.best_recall}% recall)
            </p>
            <p>
              Hardest to detect: <strong>{o.hardest}</strong> (
              {o.hardest_recall}% recall)
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
    [
      "Protocol Analyzer",
      "Examines ports, protocols, and connection patterns to identify known attack signatures.",
    ],
    [
      "Statistical Analyzer",
      "Compares packet sizes, byte ratios, and flow duration against baseline distributions.",
    ],
    [
      "Behavioral Analyzer",
      "Looks at what the connection is doing \u2014 scanning, exfiltrating, or behaving normally.",
    ],
    [
      "Temporal Analyzer",
      "Tracks patterns over time \u2014 repeated connections, sudden bursts, slow-and-low activity.",
    ],
    [
      "Devil\u2019s Advocate",
      "Argues against the majority. If everyone says attack, it looks for reasons it might be benign.",
    ],
    [
      "Orchestrator",
      "Weighs all opinions and makes the final call. Can override individuals but respects consensus.",
    ],
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
                <li>External tool calls return nothing for private IPs</li>
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
            style={{ flex: 19, background: "#f3f4f6", color: "#6b7280" }}
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
  const [storyId, setStoryId] = useState(1);
  const [liveStatus, liveFetched, liveErr] = usePolling("/api/status", 15000);
  const [summary, summaryFetched, summaryErr] = usePolling(
    "/api/summary",
    15000
  );
  const [control, controlFetched, controlErr] = usePolling(
    "/api/control",
    15000
  );
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  const anyError = liveErr && summaryErr && controlErr;
  const anyFetched = liveFetched || summaryFetched || controlFetched;

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

  // Navigate from timeline dot to story tab
  const goToStory = (id) => {
    setStoryId(id);
    setTab("story");
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
    { id: "story", label: "The Story" },
    { id: "comparison", label: "Comparison" },
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
      <nav className="max-w-4xl mx-auto px-6 flex gap-6 flex-wrap">
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
        {tab === "story" && (
          <StoryTab
            selectedId={storyId}
            setSelectedId={setStoryId}
            summary={summary}
          />
        )}
        {tab === "comparison" && (
          <ComparisonTab summary={summary} goToStory={goToStory} />
        )}
        {tab === "architecture" && <ArchitectureTab />}
        {tab === "stage1" && <Stage1Tab summary={summary} />}
        {tab === "next" && <WhatsNextTab />}
      </main>

      {/* ── Footer ── */}
      <footer className="max-w-4xl mx-auto px-6 pb-8">
        <p className="text-xs" style={{ color: "#d1d5db" }}>
          Last updated {secondsAgo}s ago &mdash; Status:{" "}
          {anyFetched ? (anyError ? "partial" : "ok") : "connecting..."}
        </p>
      </footer>
    </div>
  );
}
