import React from "react";
import { EXPERIMENTS } from "../../data/experiments";
import { AGENT_COST_DATA, STAGE1_SUMMARY } from "../../data/stage1";
import { DIFFICULTY_TIERS, ATTACK_DESCRIPTIONS } from "../../data/attacks";
import { dollar } from "../../lib/format";
import AgentHeatmap from "./AgentHeatmap";

export default function Overview({ s1, onNavigateToJourney }) {
  const totalFP = s1.experiments.reduce((s, e) => s + (e.confusion?.fp || 0), 0);
  const totalTN = s1.experiments.reduce((s, e) => s + (e.confusion?.tn || 0), 0);
  const fpr = ((totalFP / (totalFP + totalTN)) * 100).toFixed(1);
  const avgRecall = (() => {
    const exps = s1.experiments.filter(e => e.recall > 0);
    return exps.length > 0 ? Math.round(exps.reduce((s, e) => s + (e.recall || 0), 0) / exps.length) : 0;
  })();
  const highRecallCount = s1.experiments.filter(e => (e.recall || 0) >= 82).length;
  const avgF1 = Math.round(s1.experiments.reduce((s, e) => s + (e.f1 || 0), 0) / s1.experiments.length);
  const bestF1 = Math.max(...EXPERIMENTS.map(e => e.f1));

  return (
    <div className="space-y-8">
      {/* What This System Does */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4">What This System Does</h2>
        <div className="text-sm text-gray-700 leading-relaxed max-w-3xl space-y-4">
          <p>
            AMATAS is a multi-agent LLM system for network intrusion detection. Unlike traditional ML approaches
            which produce a binary flag with no explanation, AMATAS uses 6 specialised agents that each analyse
            a network flow from a different perspective and produce human-readable reasoning for every decision.
          </p>
          <p>
            The system was evaluated on CICIDS2018 NetFlow v3 across 14 attack types at realistic 5% attack
            prevalence — 950 benign flows and 50 attack flows per batch. A Random Forest pre-filter routes obvious
            benign traffic around the expensive LLM pipeline, reducing cost by 95%.
          </p>
          <p>
            AMATAS v2 achieved {fpr}% false positive rate across {(totalFP + totalTN).toLocaleString()} benign
            flows while detecting {avgRecall}% of attacks on average. {highRecallCount} of 14 attack types were
            detected at 82%+ recall. Total evaluation cost: {dollar(s1.overall.total_cost)}.
          </p>
        </div>
      </div>

      {/* MCP Callout */}
      <div className="border border-blue-300 rounded-lg p-5 bg-blue-50">
        <div className="text-sm font-bold text-blue-800 mb-2">About MCP in this system</div>
        <div className="text-sm text-blue-900 leading-relaxed space-y-2">
          <p>AMATAS does <strong>not</strong> use MCP tools for detection. The 6 agents reason purely from network flow features using their pre-trained knowledge.</p>
          <p>MCP was evaluated separately (see MCP Comparison sub-tab) and found to provide minimal uplift on this dataset — external threat intel tools return no useful data on private/anonymised IPs.</p>
          <p>The multi-agent architecture itself is the contribution — specialised roles + adversarial checking outperforms any single-agent configuration.</p>
        </div>
      </div>

      {/* Hero Numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Stage 1 Best F1", value: `${s1.overall.best_f1 || Math.round(bestF1 * 100)}%`, sub: s1.overall.best_detected || "—" },
          { label: "Stage 1 Flows", value: s1.overall.total_flows.toLocaleString(), sub: `${s1.experiments.length} x 1,000-flow batches` },
          { label: "Stage 1 Cost", value: dollar(s1.overall.total_cost), sub: `$${s1.overall.total_cost > 0 ? (s1.overall.total_cost / s1.experiments.length).toFixed(2) : '0'}/batch avg` },
          { label: "Stage 1 Coverage", value: `${s1.experiments.length} / 14`, sub: s1.experiments.length >= 14 ? "All attack types evaluated" : "Attack types evaluated" },
        ].map(h => (
          <div key={h.label} className="border border-gray-200 rounded-lg p-6">
            <div className="text-4xl font-bold tracking-tight text-gray-900">{h.value}</div>
            <div className="text-sm font-semibold text-gray-900 mt-1">{h.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{h.sub}</div>
          </div>
        ))}
      </div>

      {/* Key Findings */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-5">Key Findings</h3>
        <div className="space-y-5">
          <div className="border-l-[3px] border-green-600 pl-4">
            <div className="text-sm font-bold text-gray-900 mb-1">1. Multi-agent beats single-agent</div>
            <div className="text-sm text-gray-700 leading-relaxed">
              AMATAS v2 achieved {avgF1}% avg F1 vs 62.8% for the best single-agent configuration (zero-shot GPT-4o-mini).
              The gap comes from specialised roles + adversarial checking — the Devil's Advocate reduced FPR from
              41% (single agent) to {s1.overall.avg_fpr.toFixed(1)}% (AMATAS).
            </div>
          </div>
          <div className="border-l-[3px] border-violet-600 pl-4">
            <div className="text-sm font-bold text-gray-900 mb-1">2. External tools provide minimal uplift</div>
            <div className="text-sm text-gray-700 leading-relaxed">
              Adding MITRE ATT&CK tool access to a single agent improved recall by only 3.3% at +$0.09 cost.
              External threat intelligence is ineffective on anonymised dataset IPs.
            </div>
          </div>
          <div className="border-l-[3px] border-blue-600 pl-4">
            <div className="text-sm font-bold text-gray-900 mb-1">3. Cost reduction via ML pre-filter</div>
            <div className="text-sm text-gray-700 leading-relaxed mb-3">
              The Tier 1 RF pre-filter reduced per-batch LLM cost from ~${(AGENT_COST_DATA.estWithoutTier1 / 14).toFixed(0)} to ~${AGENT_COST_DATA.avgPerBatch.toFixed(2)} (95% reduction)
              by routing obviously benign traffic around the LLM pipeline.
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-800">${AGENT_COST_DATA.avgPerBatch.toFixed(2)}</div>
                <div className="text-[11px] text-gray-500">avg per 1,000-flow batch</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-800">${(AGENT_COST_DATA.estWithoutTier1 / 14).toFixed(0)}</div>
                <div className="text-[11px] text-gray-500">estimated without Tier 1</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-800">95%</div>
                <div className="text-[11px] text-gray-500">cost reduction</div>
              </div>
            </div>
            {/* Agent cost bar */}
            <div className="mt-3">
              <div className="text-[11px] text-gray-500 mb-1.5">Agent cost distribution</div>
              <div className="flex h-4 rounded overflow-hidden">
                {["protocol", "statistical", "behavioural", "temporal", "devils_advocate", "orchestrator"].map(a => (
                  <div key={a} style={{ width: `${AGENT_COST_DATA[a].pct}%`, background: AGENT_COST_DATA[a].color }} title={`${AGENT_COST_DATA[a].label}: ${AGENT_COST_DATA[a].pct}%`} />
                ))}
              </div>
              <div className="flex gap-3 mt-1.5 flex-wrap">
                {["temporal", "orchestrator", "devils_advocate", "behavioural", "statistical", "protocol"].map(a => (
                  <span key={a} className="text-[10px] text-gray-500 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: AGENT_COST_DATA[a].color }} />
                    {AGENT_COST_DATA[a].label} {AGENT_COST_DATA[a].pct}%
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="border-l-[3px] border-red-600 pl-4">
            <div className="text-sm font-bold text-gray-900 mb-1">4. Infiltration: flow-level limitation</div>
            <div className="text-sm text-gray-700 leading-relaxed">
              Infiltration attacks (DNS exfiltration) achieved 0% recall. Individual flows are statistically
              identical to legitimate DNS queries — undetectable at the NetFlow feature level without temporal
              clustering. This motivates the v3 clustering contribution.
            </div>
          </div>
          <div className="border-l-[3px] border-amber-500 pl-4">
            <div className="text-sm font-bold text-gray-900 mb-1">5. Explainability advantage</div>
            <div className="text-sm text-gray-700 leading-relaxed">
              Every detection includes full agent reasoning, connected flow evidence, and attack classification.
              Click any flow in the Flow Inspector to see exactly why it was flagged — impossible with traditional ML.
            </div>
          </div>
        </div>
      </div>

      {/* Difficulty Tier Breakdown */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-4">Detection Difficulty Tiers</h3>
        <p className="text-sm text-gray-500 mb-4">
          Attack types grouped by how distinctive their NetFlow signatures are — harder attacks mimic legitimate traffic more closely.
        </p>
        {Object.entries(DIFFICULTY_TIERS).map(([tier, data]) => {
          const tierExps = data.attacks.map(at => s1.experiments.find(e => e.attack_type === at)).filter(Boolean);
          const tierAvgF1 = tierExps.length > 0 ? Math.round(tierExps.reduce((s, e) => s + (e.f1 || 0), 0) / tierExps.length) : 0;
          return (
            <div key={tier} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold" style={{ color: data.color }}>{data.label}</span>
                <span className="text-xs text-gray-400">Avg F1: {tierAvgF1}%</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.attacks.map(at => {
                  const exp = s1.experiments.find(e => e.attack_type === at);
                  if (!exp) return null;
                  return (
                    <span key={at} className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px] border border-gray-200 bg-gray-50">
                      <span className="text-gray-600">{at.replace(/_/g, " ")}</span>
                      <span className="font-bold" style={{ color: exp.f1 >= 90 ? "#16a34a" : exp.f1 >= 70 ? "#d97706" : "#dc2626" }}>
                        F1 {exp.f1}%
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Agent Performance Summary */}
      <AgentHeatmap />

      {/* Understanding the Metrics */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-2">Understanding the Metrics</h3>
        <p className="text-sm text-gray-500 mb-4">
          These metrics are used throughout the dashboard to evaluate AMATAS performance. Here's what each one means.
        </p>

        {/* Confusion matrix visual */}
        <div className="mb-5">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">The Confusion Matrix</div>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            Every detection outcome falls into one of four categories. The confusion matrix counts how many flows ended up in each:
          </p>
          <div className="grid max-w-md mx-auto mb-3" style={{ gridTemplateColumns: "120px 1fr 1fr" }}>
            <div className="p-2 text-xs text-gray-500"></div>
            <div className="p-2 text-xs font-semibold text-gray-500 text-center border-b border-gray-200">System says Benign</div>
            <div className="p-2 text-xs font-semibold text-gray-500 text-center border-b border-gray-200">System says Attack</div>
            <div className="p-2 text-xs font-semibold text-gray-500 border-r border-gray-200">Actually Benign</div>
            <div className="p-3 text-center bg-green-50 rounded-tl">
              <div className="text-sm font-bold text-green-700">TN</div>
              <div className="text-[10px] text-gray-500">True Negative</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Correct: benign flow, correctly ignored</div>
            </div>
            <div className="p-3 text-center bg-red-50 rounded-tr">
              <div className="text-sm font-bold text-red-700">FP</div>
              <div className="text-[10px] text-gray-500">False Positive</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Error: benign flow, wrongly flagged</div>
            </div>
            <div className="p-2 text-xs font-semibold text-gray-500 border-r border-gray-200">Actually Attack</div>
            <div className="p-3 text-center bg-red-50 rounded-bl">
              <div className="text-sm font-bold text-red-700">FN</div>
              <div className="text-[10px] text-gray-500">False Negative</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Error: attack missed entirely</div>
            </div>
            <div className="p-3 text-center bg-green-50 rounded-br">
              <div className="text-sm font-bold text-green-700">TP</div>
              <div className="text-[10px] text-gray-500">True Positive</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Correct: attack detected</div>
            </div>
          </div>
        </div>

        {/* Metric definitions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              name: "Recall (Sensitivity)",
              formula: "TP / (TP + FN)",
              color: "#16a34a",
              desc: "Of all actual attacks, what percentage did we catch? A recall of 84% means 42 of 50 attacks were detected and 8 were missed. In security, missed attacks are dangerous — we want this as high as possible.",
            },
            {
              name: "Precision",
              formula: "TP / (TP + FP)",
              color: "#2563eb",
              desc: "Of all flows we flagged as attacks, what percentage were actually attacks? Low precision means many false alarms — the system cries wolf too often, wasting analyst time.",
            },
            {
              name: "F1 Score",
              formula: "2 × (Precision × Recall) / (Precision + Recall)",
              color: "#7c3aed",
              desc: "The harmonic mean of precision and recall — a single number that balances both. F1 of 90%+ means the system catches most attacks without too many false alarms. This is the primary metric used throughout the dashboard.",
            },
            {
              name: "False Positive Rate (FPR)",
              formula: "FP / (FP + TN)",
              color: "#dc2626",
              desc: "Of all benign flows, what percentage were wrongly flagged? In a network with millions of flows, even 1% FPR means thousands of false alarms per day. AMATAS targets <1% FPR.",
            },
            {
              name: "Cost per TP ($/TP)",
              formula: "Total LLM Cost / True Positives",
              color: "#d97706",
              desc: "How much did each correctly detected attack cost in LLM API calls? Lower is better. Varies from $0.02 (brute force) to $0.23 (stealthy attacks) depending on how many flows reach the LLM pipeline.",
            },
          ].map(m => (
            <div key={m.name} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="text-sm font-bold" style={{ color: m.color }}>{m.name}</div>
              </div>
              <div className="text-[11px] font-mono bg-gray-50 px-2 py-1 rounded mb-2 text-gray-600">
                {m.formula}
              </div>
              <div className="text-xs text-gray-600 leading-relaxed">{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* CICIDS2018 Dataset */}
      <div className="border border-gray-200 rounded-lg p-6">
        <h3 className="text-base font-bold tracking-tight mb-2">The Dataset: CICIDS2018 NetFlow v3</h3>
        <p className="text-sm text-gray-500 mb-4">
          All AMATAS experiments use the Canadian Institute for Cybersecurity's 2018 Intrusion Detection dataset — the most widely used modern IDS benchmark.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Total Flows", value: "20.1M" },
            { label: "Features", value: "53 (14 used)" },
            { label: "Attack Types", value: "14" },
            { label: "Benign Ratio", value: "~87%" },
          ].map(s => (
            <div key={s.label} className="text-center py-3 bg-gray-50 rounded-lg">
              <div className="text-xl font-bold text-gray-900">{s.value}</div>
              <div className="text-[10px] text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="text-sm text-gray-700 leading-relaxed space-y-2">
          <p className="m-0">
            <strong>Why this dataset?</strong> CICIDS2018 is the standard benchmark in IDS research. It contains
            realistic network traffic captured over 10 days in a controlled lab environment, including both legitimate
            user activity and 14 different attack types. The NetFlow v3 variant provides aggregated flow-level features
            (packet counts, byte volumes, timing) rather than raw packet captures.
          </p>
          <p className="m-0">
            <strong>Three-way split:</strong> The dataset is split into <strong>development</strong> (7.04M flows, 35%) for
            training the RF pre-filter, <strong>validation</strong> (5.03M flows, 25%) for tuning hyperparameters, and
            <strong> test</strong> (8.05M flows, 40%) as a held-out final evaluation set. Different attack types appear in
            different splits — this is important because the RF was only trained on development-split attacks.
          </p>
          <p className="m-0">
            <strong>Why NetFlow, not raw packets?</strong> NetFlow features are what real-world network monitoring systems
            actually collect. Raw packet inspection is computationally expensive and raises privacy concerns. If AMATAS
            works on NetFlow, it can plug into existing network infrastructure.
          </p>
          <p className="m-0">
            <strong>Limitation:</strong> All IP addresses in the dataset are anonymized (private ranges like 172.31.x.x).
            This means external threat intelligence tools (AbuseIPDB, OTX) return no data — which is why AMATAS relies on
            flow features and agent reasoning rather than external lookups.
          </p>
        </div>
      </div>

      {/* Journey link */}
      {onNavigateToJourney && (
        <div className="border border-gray-200 rounded-lg p-5 text-center">
          <p className="text-sm text-gray-600 mb-2">Want the full story behind these results?</p>
          <button
            onClick={onNavigateToJourney}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium cursor-pointer border-none"
          >
            Start the Research Journey &rarr;
          </button>
        </div>
      )}

      {/* Architecture diagram */}
      <div className="border border-gray-200 rounded-lg p-8">
        <h3 className="text-sm font-semibold mb-6 text-gray-900">Architecture</h3>
        <div className="flex flex-col items-center gap-2 font-mono text-sm">
          <div className="border border-gray-200 rounded-lg px-6 py-2.5 bg-gray-50">Network Flow (53 features)</div>
          <div className="text-gray-400">&darr;</div>
          <div className="flex items-center gap-4">
            <div className="border-2 border-blue-600 rounded-lg px-5 py-2.5 text-blue-600 font-semibold">Tier 1 RF Filter</div>
            <div className="text-gray-400">&rarr;</div>
            <div className="border border-gray-300 rounded-lg px-5 py-2.5 text-gray-500 bg-green-50">BENIGN — filtered (95%)</div>
          </div>
          <div className="text-gray-400">&darr; 5% flagged</div>
          <div className="border border-gray-200 rounded-lg p-4 flex gap-3">
            {["Protocol", "Statistical", "Behavioural", "Temporal"].map(a => (
              <div key={a} className="border border-gray-200 rounded-md px-3.5 py-2 text-xs font-medium">{a}</div>
            ))}
          </div>
          <div className="text-gray-400">&darr;</div>
          <div className="border border-red-300 rounded-lg px-5 py-2.5 text-red-600 font-medium">Devil's Advocate</div>
          <div className="text-gray-400">&darr;</div>
          <div className="border-2 border-blue-600 rounded-lg px-5 py-2.5 text-blue-600 font-semibold">Orchestrator</div>
          <div className="text-gray-400">&darr;</div>
          <div className="border border-gray-200 rounded-lg px-6 py-2.5 bg-gray-50 font-medium">MALICIOUS / BENIGN + Attack Type + Reasoning</div>
        </div>
      </div>
    </div>
  );
}
