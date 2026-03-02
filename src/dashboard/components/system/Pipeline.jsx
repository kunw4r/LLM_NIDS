import React from "react";
import { AGENT_COST_DATA } from "../../data/stage1";
import { REFERENCES, cite } from "../../data/references";

export default function Pipeline() {
  const specialists = [
    { name: "Protocol", color: "#3b82f6", desc: "Port/flag/protocol validity checks" },
    { name: "Statistical", color: "#8b5cf6", desc: "Volume & timing anomaly detection" },
    { name: "Behavioural", color: "#f59e0b", desc: "Attack signature & MITRE mapping" },
    { name: "Temporal", color: "#ec4899", desc: "Cross-flow IP pattern analysis" },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-2 tracking-tight">How AMATAS Works</h2>
      <p className="text-sm text-gray-500 mb-8 max-w-3xl leading-relaxed">
        AMATAS uses a <strong>two-tier hybrid architecture</strong>: a traditional ML classifier (Random Forest) filters
        obvious benign traffic at near-zero cost, then a multi-agent LLM pipeline provides explainable analysis of
        suspicious flows. Every verdict includes full reasoning chains from 6 specialist agents.
      </p>

      {/* ─── A. DATA FLOW ──────────────────────────────────── */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <h3 className="text-sm font-bold mb-3">A. Data Flow — From Raw CSV to Verdict</h3>
        <div className="text-sm text-gray-700 leading-relaxed space-y-2">
          <p className="m-0">
            <strong>1. Batch creation:</strong> Raw CICIDS2018 NetFlow CSV &rarr; <code className="text-xs bg-gray-100 px-1 rounded">create_batch()</code> &rarr;
            <code className="text-xs bg-gray-100 px-1 rounded">flows.json</code> + <code className="text-xs bg-gray-100 px-1 rounded">ground_truth.json</code>.
            Each batch contains <strong>50 attack + 950 benign</strong> flows (5% attack prevalence, matching realistic traffic ratios).
          </p>
          <p className="m-0">
            <strong>2. Feature representation:</strong> Each flow is a JSON object with <strong>14 NetFlow features</strong> (selected from 53 available):
            packet counts, byte counts, duration, flow rate, protocol, ports, TCP flags, and inter-arrival times.
          </p>
          <p className="m-0">
            <strong>3. Agent communication:</strong> All agents run in the same Python process. Data passes between stages as
            in-memory dictionaries — no network calls, no serialization overhead. Specialists run in parallel via
            <code className="text-xs bg-gray-100 px-1 rounded">ThreadPoolExecutor(max_workers=4)</code>.
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs p-3 bg-gray-50 rounded-lg border border-gray-200 mt-3 flex-wrap">
          <span className="px-2.5 py-1 bg-gray-700 text-white rounded font-semibold">CSV</span>
          <span className="text-gray-400">&rarr;</span>
          <span className="px-2.5 py-1 bg-blue-800 text-white rounded">create_batch()</span>
          <span className="text-gray-400">&rarr;</span>
          <span className="px-2.5 py-1 bg-blue-600 text-white rounded">flows.json</span>
          <span className="text-gray-400">&rarr;</span>
          <span className="px-2.5 py-1 bg-green-600 text-white rounded">Tier 1 RF</span>
          <span className="text-gray-400">&rarr;</span>
          <span className="px-2.5 py-1 bg-purple-600 text-white rounded">LLM Pipeline</span>
          <span className="text-gray-400">&rarr;</span>
          <span className="px-2.5 py-1 bg-emerald-600 text-white rounded">results.json</span>
        </div>
      </div>

      {/* ─── B. TIER 1: ML PRE-FILTER ───────────────────────── */}
      <div className="border border-blue-200 rounded-lg p-5 mb-6 bg-blue-50/30">
        <h3 className="text-sm font-bold mb-3">
          B. Tier 1: Random Forest Pre-Filter
          <span className="text-[10px] text-gray-400 font-normal ml-2">{cite("Breiman2001")}</span>
        </h3>

        <div className="grid grid-cols-2 gap-5 mb-4">
          <div className="text-sm text-gray-700 leading-relaxed">
            <p className="m-0 mb-2">
              <strong>What is a Random Forest?</strong> An ensemble of 100 decision trees. Each tree independently
              classifies the flow, then the forest takes a majority vote. Individual trees may be weak, but their
              collective decision is robust — this is the "wisdom of crowds" for machine learning.
            </p>
            <p className="m-0 mb-2">
              <strong>Training:</strong> Trained on <strong>5.63 million flows</strong> from <code className="text-xs bg-gray-100 px-1 rounded">development.csv</code> using
              12 numeric features (packet counts, byte volumes, duration, flow rates). Training took several hours on a single machine.
            </p>
            <p className="m-0">
              <strong>Purpose:</strong> Assign each flow an attack probability P(attack). If P(attack) &lt; 0.15 &rarr;
              auto-classify as BENIGN and skip the expensive LLM pipeline entirely.
            </p>
          </div>

          <div className="text-sm text-gray-700 leading-relaxed">
            <p className="m-0 mb-2">
              <strong>Why threshold = 0.15?</strong> Tuned to achieve <strong>100% recall on the development set</strong> —
              the RF never misses an attack it has seen. This is deliberately conservative: we accept filtering fewer benign
              flows (lower efficiency) to guarantee no attacks are lost.
            </p>
            <p className="m-0 mb-2">
              <strong>Result:</strong> Filters ~95% of flows as benign at zero LLM cost. Only ~5% of flows (the uncertain
              and suspicious ones) proceed to the expensive multi-agent analysis.
            </p>
            <p className="m-0">
              <strong>Cost impact:</strong> Without Tier 1, a 1000-flow batch would cost ~$36 in LLM calls. With Tier 1,
              the same batch costs ~$2. That is a <strong>95% cost reduction</strong>.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs p-3 bg-white rounded-lg border border-blue-200 flex-wrap">
          <span className="px-2.5 py-1 bg-blue-800 text-white rounded font-semibold">1000 flows</span>
          <span className="text-gray-400">&rarr;</span>
          <span className="px-2.5 py-1 bg-green-600 text-white rounded">RF filter (P &lt; 0.15?)</span>
          <span className="text-gray-400">&rarr;</span>
          <span className="px-2.5 py-1 bg-blue-600 text-white rounded">~{Math.round(AGENT_COST_DATA.totalLlmFlows / 14)} to LLM</span>
          <span className="text-gray-300">|</span>
          <span className="px-2.5 py-1 bg-green-50 text-green-600 rounded border border-green-200">~{Math.round(AGENT_COST_DATA.totalFiltered / 14)} auto-benign</span>
        </div>
      </div>

      {/* ─── C. TIER 2: MULTI-AGENT LLM PIPELINE ────────────── */}
      <div className="border border-purple-200 rounded-lg p-5 mb-6 bg-purple-50/20">
        <h3 className="text-sm font-bold mb-3">
          C. Tier 2: Multi-Agent LLM Pipeline
          <span className="text-[10px] text-gray-400 font-normal ml-2">{cite("Minsky1986")}, {cite("Wei2022")}</span>
        </h3>

        {/* Phase 1: Parallel Specialists */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-full bg-pink-100 border-2 border-pink-500 text-pink-600 flex items-center justify-center text-xs font-bold">1</span>
            <span className="text-sm font-semibold">Parallel Specialist Analysis</span>
            <span className="text-[10px] text-gray-400">(4 agents, concurrent execution)</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed mb-3 ml-9 m-0">
            Four specialist agents analyse the same flow <strong>simultaneously</strong> via <code className="text-xs bg-gray-100 px-1 rounded">ThreadPoolExecutor(max_workers=4)</code>.
            Each agent gets the same 14 NetFlow features plus a role-specific system prompt. Each produces:
            verdict (BENIGN/SUSPICIOUS/MALICIOUS), confidence (0.0-1.0), attack type prediction, key evidence findings, and
            <strong> full reasoning text</strong> — the complete chain of thought, not just a label.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 ml-0 sm:ml-9">
            {specialists.map(a => (
              <div key={a.name} className="border border-gray-200 rounded-md p-3 text-center bg-white">
                <div className="text-xs font-semibold" style={{ color: a.color }}>{a.name}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{a.desc}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 ml-9 mt-2 m-0">
            Academic term: <em>parallel multi-agent deliberation</em> — an ensemble of specialists each contributing a
            unique analytical perspective, inspired by Minsky's Society of Mind.
          </p>
        </div>

        {/* Phase 2: Devil's Advocate */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-full bg-red-100 border-2 border-red-500 text-red-600 flex items-center justify-center text-xs font-bold">2</span>
            <span className="text-sm font-semibold">Adversarial Review — Devil's Advocate</span>
            <span className="text-[10px] text-gray-400">{cite("Sunstein2002")}</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed ml-9 m-0 mb-2">
            Receives all 4 specialist analyses and argues the <strong>strongest possible case for BENIGN</strong>,
            regardless of how many specialists voted malicious. Designed to prevent <em>group polarization</em> — the
            tendency for unanimous specialist agreement to create false confidence.
          </p>
          <div className="ml-9 flex gap-3">
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <div className="text-xs font-semibold text-red-600">Weight: 30%</div>
              <div className="text-[10px] text-gray-500">Validated empirically — 50% was too aggressive (Phase 3e)</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <div className="text-xs font-semibold text-red-600">Outputs</div>
              <div className="text-[10px] text-gray-500">Benign confidence, counter-argument, strongest benign indicator</div>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 ml-9 mt-2 m-0">
            Academic term: <em>adversarial deliberation</em> / <em>red team review</em> — a structured counterpoint mechanism
            that stress-tests the malicious hypothesis before consensus.
          </p>
        </div>

        {/* Phase 3: Orchestrator */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-full bg-emerald-100 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center text-xs font-bold">3</span>
            <span className="text-sm font-semibold">Consensus Aggregation — Orchestrator</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed ml-9 m-0 mb-2">
            Synthesizes all 5 agent analyses (4 specialists + DA) into a final verdict using weighted voting.
            The orchestrator considers specialist agreement level, individual confidence scores, and the Devil's Advocate
            counter-argument strength. Outputs: verdict, confidence, attack type, MITRE ATT&CK techniques, and a
            <strong> complete reasoning chain</strong> explaining the decision.
          </p>
          <div className="ml-9 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 text-xs text-gray-700">
            <strong>Consensus thresholds:</strong> 4/4 specialists agree + weak DA &rarr; MALICIOUS. 3/4 agree + moderate DA &rarr; SUSPICIOUS.
            2/4 agree or strong DA &rarr; requires orchestrator judgment. DA at 30% weight can soften but not override strong consensus.
          </div>
          <p className="text-[11px] text-gray-500 ml-9 mt-2 m-0">
            Academic term: <em>weighted ensemble aggregation</em> — combining multiple classifier outputs with
            non-uniform weights {cite("Breiman2001")}.
          </p>
        </div>
      </div>

      {/* ─── D. COST MODEL ───────────────────────────────── */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <h3 className="text-sm font-bold mb-3">D. Cost Model — Why Temporal Agent Costs 3x More</h3>
        <p className="text-sm text-gray-700 leading-relaxed mb-4 m-0">
          Each agent call costs money based on input + output tokens. The <strong>Temporal Agent</strong> receives not just
          the target flow but also all co-IP flows (other flows from the same source IP) as context — this can be 10-50
          additional flows for attacks with high temporal density. The <strong>Orchestrator</strong> and <strong>Devil's Advocate</strong>
          receive all specialist outputs as input, making their prompts 4-5x longer than individual specialists.
        </p>

        <div className="max-w-xl mb-4">
          {["temporal", "orchestrator", "devils_advocate", "behavioural", "statistical", "protocol"].map(a => (
            <div key={a} className="flex items-center gap-3 mb-2">
              <div className="w-28 text-xs text-gray-700 text-right">{AGENT_COST_DATA[a].label}</div>
              <div className="flex-1 h-[22px] bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full rounded flex items-center justify-end pr-2"
                  style={{ width: `${AGENT_COST_DATA[a].pct}%`, background: AGENT_COST_DATA[a].color }}
                >
                  <span className="text-xs font-bold text-white">{AGENT_COST_DATA[a].pct}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xl font-bold">${AGENT_COST_DATA.avgPerLlmFlow.toFixed(3)}</div>
            <div className="text-xs text-gray-500">per flow reaching LLM</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xl font-bold">${AGENT_COST_DATA.avgPerBatch.toFixed(2)}</div>
            <div className="text-xs text-gray-500">per 1,000-flow batch</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-xl font-bold text-green-800">~${(AGENT_COST_DATA.estWithoutTier1 / 14 - AGENT_COST_DATA.avgPerBatch).toFixed(0)}</div>
            <div className="text-xs text-gray-500">saved per batch by Tier 1</div>
          </div>
        </div>
      </div>

      {/* ─── E. WHERE THE MONEY GOES ─────────────────────── */}
      <div className="border border-gray-200 rounded-lg p-5 mb-6">
        <h3 className="text-sm font-bold mb-3">E. Where the Money Goes</h3>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-40 text-xs text-gray-700 text-right">Tier 1 filtered (free)</div>
            <div className="flex-1 h-[22px] bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-green-600 rounded flex items-center pl-2"
                style={{ width: `${Math.round(AGENT_COST_DATA.totalFiltered / 14000 * 100)}%` }}
              >
                <span className="text-xs font-bold text-white">{Math.round(AGENT_COST_DATA.totalFiltered / 14000 * 100)}%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-40 text-xs text-gray-700 text-right">LLM pipeline</div>
            <div className="flex-1 h-[22px] bg-gray-100 rounded overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded flex items-center pl-2"
                style={{ width: `${Math.round(AGENT_COST_DATA.totalLlmFlows / 14000 * 100)}%` }}
              >
                <span className="text-xs font-bold text-white">{Math.round(AGENT_COST_DATA.totalLlmFlows / 14000 * 100)}%</span>
              </div>
            </div>
          </div>
          <div className="ml-44 text-xs text-gray-500 mb-1">LLM cost split by agent:</div>
          {["protocol", "statistical", "behavioural", "temporal", "devils_advocate", "orchestrator"].map(a => (
            <div key={a} className="flex items-center gap-3 ml-10">
              <div className="w-28 text-xs text-gray-500 text-right">{AGENT_COST_DATA[a].label}</div>
              <div className="flex-1 h-3.5 bg-gray-100 rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm"
                  style={{ width: `${AGENT_COST_DATA[a].pct}%`, background: AGENT_COST_DATA[a].color }}
                />
              </div>
              <span className="text-xs text-gray-500 min-w-[35px]">{AGENT_COST_DATA[a].pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ─── F. ACADEMIC TERMINOLOGY ─────────────────────── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-bold m-0">F. Academic Terminology Reference</h3>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Dashboard Term</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Academic Term</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 border-b border-gray-200">Reference</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["4 parallel specialists", "Parallel multi-agent deliberation", "Minsky1986"],
              ["Devil's Advocate", "Adversarial deliberation / Red team review", "Sunstein2002"],
              ["Two-tier filter (RF + LLM)", "Hierarchical classification cascade", null],
              ["Orchestrator consensus", "Weighted ensemble aggregation", "Breiman2001"],
              ["Agent reasoning chains", "Chain-of-thought prompting", "Wei2022"],
              ["Temporal clustering (v3)", "Temporal pattern aggregation", null],
              ["CICIDS2018 NetFlow v3", "Benchmark IDS dataset", "Sharafaldin2018"],
            ].map(([dashboard, academic, refKey], i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-4 py-2 font-medium text-gray-700">{dashboard}</td>
                <td className="px-4 py-2 italic text-gray-600">{academic}</td>
                <td className="px-4 py-2 text-xs text-blue-600">
                  {refKey && REFERENCES[refKey] ? REFERENCES[refKey].short : "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
