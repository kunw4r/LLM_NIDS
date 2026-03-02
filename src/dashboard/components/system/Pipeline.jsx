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

        {/* Data Splits Explainer */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
            The Three Data Splits
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed mb-3 m-0">
            The 20.1M-flow CICIDS2018 dataset is split into three non-overlapping partitions. Each serves a different purpose
            and contains different attack types — this ensures the RF pre-filter is evaluated fairly.
          </p>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/50">
              <div className="text-xs font-bold text-blue-800 mb-0.5">Development (35%)</div>
              <div className="text-[11px] text-gray-600 mb-1">7.04M flows</div>
              <div className="text-[10px] text-gray-500 leading-relaxed">
                Used to <strong>train</strong> the RF pre-filter. Contains 7 attack types (FTP/SSH brute force, DDoS-LOIC-HTTP,
                DoS variants). Stage 1 experiments on these types use a <span className="font-mono bg-blue-100 px-1 rounded text-blue-800">dev_eval</span> badge
                because the RF has "seen" these attacks during training.
              </div>
            </div>
            <div className="border border-green-200 rounded-lg p-3 bg-green-50/50">
              <div className="text-xs font-bold text-green-800 mb-0.5">Validation (25%)</div>
              <div className="text-[11px] text-gray-600 mb-1">5.03M flows</div>
              <div className="text-[10px] text-gray-500 leading-relaxed">
                Used to <strong>tune</strong> hyperparameters (e.g., RF threshold of 0.15). Contains 5 attack types (DDOS-HOIC,
                LOIC-UDP, Web brute force, XSS, SQL injection). The RF never trained on these — experiments here test
                generalization.
              </div>
            </div>
            <div className="border border-purple-200 rounded-lg p-3 bg-purple-50/50">
              <div className="text-xs font-bold text-purple-800 mb-0.5">Test (40%)</div>
              <div className="text-[11px] text-gray-600 mb-1">8.05M flows</div>
              <div className="text-[10px] text-gray-500 leading-relaxed">
                <strong>Held out</strong> for final thesis evaluation. Contains Bot and Infiltration attacks. No parameters
                were tuned on this split — results represent true out-of-sample performance.
              </div>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 italic m-0">
            Why does the split matter? Attack types in the development split may be easier for the RF to filter correctly
            because it trained on similar flows. Validation/test split results are a stricter test of generalization.
          </p>
        </div>

        {/* 14 NetFlow Features */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
            The 14 NetFlow Features
          </h4>
          <p className="text-sm text-gray-600 leading-relaxed mb-3 m-0">
            CICIDS2018 provides 53 features per flow. We selected 14 based on variance analysis and domain relevance —
            enough to characterize flow behavior without overwhelming the LLM context window.
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {[
              { name: "PROTOCOL", cat: "Protocol", desc: "TCP (6), UDP (17), or ICMP (1)" },
              { name: "L4_SRC_PORT", cat: "Protocol", desc: "Source port number (0-65535)" },
              { name: "L4_DST_PORT", cat: "Protocol", desc: "Destination port number" },
              { name: "TCP_FLAGS", cat: "Protocol", desc: "Bitmask of SYN, ACK, RST, FIN, etc." },
              { name: "IN_PKTS", cat: "Volume", desc: "Inbound packet count" },
              { name: "OUT_PKTS", cat: "Volume", desc: "Outbound packet count" },
              { name: "IN_BYTES", cat: "Volume", desc: "Inbound byte count" },
              { name: "OUT_BYTES", cat: "Volume", desc: "Outbound byte count" },
              { name: "FLOW_DURATION_MILLISECONDS", cat: "Timing", desc: "Flow duration in ms" },
              { name: "SRC_TO_DST_AVG_THROUGHPUT", cat: "Rate", desc: "Average throughput src→dst (bps)" },
              { name: "DST_TO_SRC_AVG_THROUGHPUT", cat: "Rate", desc: "Average throughput dst→src (bps)" },
              { name: "NUM_PKTS_UP_TO_128_BYTES", cat: "Distribution", desc: "Count of small packets (≤128B)" },
              { name: "RETRANSMITTED_IN_PKTS", cat: "Quality", desc: "Retransmitted inbound packets" },
              { name: "RETRANSMITTED_OUT_PKTS", cat: "Quality", desc: "Retransmitted outbound packets" },
            ].map(f => (
              <div key={f.name} className="flex items-baseline gap-2 py-1 border-b border-gray-100">
                <code className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 flex-shrink-0">{f.name}</code>
                <span className="text-[10px] text-gray-500 truncate">{f.desc}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-500 italic mt-2 m-0">
            These 14 features capture four dimensions: <strong>protocol</strong> (what type of traffic), <strong>volume</strong> (how much data),
            <strong> timing</strong> (how long), and <strong>quality</strong> (retransmissions suggest connection issues). The remaining 39 features
            were dropped due to low variance, high correlation with retained features, or unavailability in the NetFlow v3 format.
          </p>
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
              <strong>Result:</strong> Filters ~95% of flows as benign at zero LLM cost. Only ~5% of flows (the uncertain
              and suspicious ones) proceed to the expensive multi-agent analysis.
            </p>
            <p className="m-0 mb-2">
              <strong>Cost impact:</strong> Without Tier 1, a 1000-flow batch would cost ~$36 in LLM calls. With Tier 1,
              the same batch costs ~$2. That is a <strong>95% cost reduction</strong>.
            </p>
            <p className="m-0">
              <strong>Limitation:</strong> The RF can only filter attacks it has learned to recognise. Infiltration (DNS exfiltration)
              is statistically identical to benign DNS — the RF passes 100% of those flows as benign. This motivated the
              v3 clustering override.
            </p>
          </div>
        </div>

        {/* Threshold Selection Explainer */}
        <div className="bg-white border border-blue-200 rounded-lg p-4 mb-4">
          <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">
            How We Selected the 0.15 Threshold
          </h4>
          <div className="text-sm text-gray-700 leading-relaxed space-y-2">
            <p className="m-0">
              The Random Forest doesn't output a binary yes/no — it outputs a <strong>probability P(attack)</strong> between
              0.0 and 1.0 for each flow. The threshold determines where we draw the line: flows below the threshold are
              auto-classified as benign (skip LLM), flows above it go to the LLM pipeline.
            </p>
            <p className="m-0">
              We tested multiple threshold values on the full 7.04M-flow development set to find the optimal trade-off:
            </p>
          </div>
          <div className="overflow-x-auto mt-3 mb-3">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-blue-50">
                  <th className="px-3 py-2 text-left font-semibold text-blue-800 border-b border-blue-200">Threshold</th>
                  <th className="px-3 py-2 text-right font-semibold text-blue-800 border-b border-blue-200">Attack Recall</th>
                  <th className="px-3 py-2 text-right font-semibold text-blue-800 border-b border-blue-200">Benign Filter Rate</th>
                  <th className="px-3 py-2 text-right font-semibold text-blue-800 border-b border-blue-200">Flows to LLM</th>
                  <th className="px-3 py-2 text-right font-semibold text-blue-800 border-b border-blue-200">Est. Cost/Batch</th>
                  <th className="px-3 py-2 text-left font-semibold text-blue-800 border-b border-blue-200">Trade-off</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { t: "0.50", recall: "97.2%", filter: "99.1%", llm: "~14", cost: "~$0.50", note: "Misses 2.8% of attacks — unacceptable for a security system", rc: "#dc2626" },
                  { t: "0.30", recall: "99.4%", filter: "98.5%", llm: "~20", cost: "~$0.72", note: "Still misses rare attacks; not safe enough", rc: "#d97706" },
                  { t: "0.15", recall: "100%", filter: "~95%", llm: "~50", cost: "~$1.95", note: "Zero attacks missed on dev set; 95% cost savings", rc: "#16a34a" },
                  { t: "0.05", recall: "100%", filter: "~85%", llm: "~150", cost: "~$5.40", note: "Same recall but sends 3x more flows to LLM — wasteful", rc: "#d97706" },
                  { t: "0.00", recall: "100%", filter: "0%", llm: "1000", cost: "~$36", note: "No filtering — every flow goes to LLM, defeats the purpose", rc: "#dc2626" },
                ].map(r => (
                  <tr key={r.t} className="border-b border-gray-100" style={{ background: r.t === "0.15" ? "#eff6ff" : undefined }}>
                    <td className="px-3 py-2 font-mono font-bold" style={{ color: r.t === "0.15" ? "#1d4ed8" : "#374151" }}>
                      {r.t} {r.t === "0.15" && <span className="text-[9px] font-sans text-blue-500 ml-1">CHOSEN</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold" style={{ color: r.rc }}>{r.recall}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.filter}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.llm}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.cost}</td>
                    <td className="px-3 py-2 text-gray-500">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-sm text-gray-700 leading-relaxed space-y-2">
            <p className="m-0">
              <strong>Why 0.15?</strong> It is the <em>highest threshold that achieves 100% attack recall</em> on the
              development set. The design principle is <strong>zero missed attacks</strong> — in a security system, a missed
              intrusion is far worse than an extra LLM call. We deliberately trade efficiency (filter rate) for safety (recall).
            </p>
            <p className="m-0">
              At 0.15, the RF says: "If fewer than 15 out of 100 trees think this flow is an attack, it is safe to skip."
              This is a very conservative bar — even if a flow looks slightly unusual, it still gets sent to the LLM for
              full analysis.
            </p>
            <p className="m-0 text-xs text-gray-500 italic">
              Note: 100% recall on the development set does not guarantee 100% recall on unseen data. Infiltration attacks
              (DNS exfiltration) are statistically identical to benign DNS and the RF cannot distinguish them at any threshold
              — this is why v3 introduced temporal clustering to bypass the RF for suspicious DNS clusters.
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

        {/* Verdict System Explainer */}
        <div className="mb-5 ml-9 border border-purple-200 rounded-lg p-4 bg-purple-50/40">
          <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wide mb-2">
            The Three-Tier Verdict System: BENIGN / SUSPICIOUS / MALICIOUS
          </h4>
          <div className="text-sm text-gray-700 leading-relaxed space-y-2">
            <p className="m-0">
              Unlike traditional IDS which output a binary <strong>benign/attack</strong> classification, AMATAS uses a
              three-tier verdict system. This is a deliberate design choice that reflects <strong>epistemic honesty</strong> —
              sometimes there isn't enough evidence to be certain either way.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 mb-3">
            <div className="rounded-lg p-3 bg-green-50 border border-green-200">
              <div className="text-sm font-bold text-green-700 mb-1">BENIGN</div>
              <div className="text-xs text-gray-600 leading-relaxed">
                The flow looks like normal, legitimate traffic. No specialist found meaningful anomalies, or the Devil's
                Advocate successfully argued that any anomalies have innocent explanations.
              </div>
              <div className="text-[10px] text-gray-500 mt-2 italic">
                Typical: 0-1 specialists flagged + strong DA argument, or orchestrator confidence &lt; 0.3
              </div>
            </div>
            <div className="rounded-lg p-3 bg-amber-50 border border-amber-200">
              <div className="text-sm font-bold text-amber-700 mb-1">SUSPICIOUS</div>
              <div className="text-xs text-gray-600 leading-relaxed">
                The flow has characteristics that <em>could</em> indicate an attack, but there's also a plausible benign
                explanation. The agents disagree or the evidence is ambiguous. Warrants further investigation.
              </div>
              <div className="text-[10px] text-gray-500 mt-2 italic">
                Typical: 2-3 specialists flagged, or strong specialist consensus weakened by strong DA counter-argument
              </div>
            </div>
            <div className="rounded-lg p-3 bg-red-50 border border-red-200">
              <div className="text-sm font-bold text-red-700 mb-1">MALICIOUS</div>
              <div className="text-xs text-gray-600 leading-relaxed">
                Strong evidence of attack from multiple perspectives. Specialist consensus is high and the Devil's Advocate
                could not find convincing benign explanations. The orchestrator is confident this is an attack.
              </div>
              <div className="text-[10px] text-gray-500 mt-2 italic">
                Typical: 3-4 specialists agree + weak DA, orchestrator confidence &gt; 0.7
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-700 leading-relaxed space-y-2">
            <p className="m-0">
              <strong>Why three tiers instead of two?</strong> A binary system forces the orchestrator to commit when evidence
              is genuinely ambiguous. SUSPICIOUS acts as a safety valve — it flags flows that need human attention without the
              false certainty of a MALICIOUS label. In a production NIDS, SUSPICIOUS flows could be queued for analyst review
              while MALICIOUS flows trigger immediate response.
            </p>
            <p className="m-0">
              <strong>How it maps to metrics:</strong> For evaluation purposes, both SUSPICIOUS and MALICIOUS count as
              "flagged" (positive detection). A flow is a <em>true positive</em> if it's an actual attack that was flagged
              as either SUSPICIOUS or MALICIOUS. This means SUSPICIOUS doesn't hurt recall — it still catches the attack,
              just with lower confidence.
            </p>
            <p className="m-0">
              <strong>Orchestrator consensus rules:</strong>
            </p>
          </div>
          <div className="overflow-x-auto mt-2">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-purple-50">
                  <th className="px-3 py-1.5 text-left font-semibold text-purple-800 border-b border-purple-200">Specialist Agreement</th>
                  <th className="px-3 py-1.5 text-left font-semibold text-purple-800 border-b border-purple-200">DA Strength</th>
                  <th className="px-3 py-1.5 text-left font-semibold text-purple-800 border-b border-purple-200">Final Verdict</th>
                  <th className="px-3 py-1.5 text-left font-semibold text-purple-800 border-b border-purple-200">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["4/4 MALICIOUS", "Weak", "MALICIOUS (high conf)", "All specialists agree and DA couldn't counter — strong evidence"],
                  ["4/4 MALICIOUS", "Strong", "SUSPICIOUS", "Unanimous but DA raises valid concerns — needs caution"],
                  ["3/4 MALICIOUS", "Weak-Moderate", "MALICIOUS (moderate conf)", "Strong majority with limited counter-evidence"],
                  ["3/4 MALICIOUS", "Strong", "SUSPICIOUS", "Majority but DA has a convincing alternative explanation"],
                  ["2/4 MALICIOUS", "Any", "SUSPICIOUS", "Split decision — evidence is genuinely ambiguous"],
                  ["1/4 MALICIOUS", "Any", "BENIGN", "Only one specialist sees an anomaly — likely a false alarm"],
                  ["0/4 MALICIOUS", "Any", "BENIGN", "No specialist found attack indicators"],
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-3 py-1.5 font-medium">{row[0]}</td>
                    <td className="px-3 py-1.5 text-gray-600">{row[1]}</td>
                    <td className="px-3 py-1.5">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        style={{
                          color: row[2].startsWith("MALICIOUS") ? "#dc2626" : row[2].startsWith("SUSPICIOUS") ? "#d97706" : "#16a34a",
                          background: row[2].startsWith("MALICIOUS") ? "#fef2f2" : row[2].startsWith("SUSPICIOUS") ? "#fffbeb" : "#f0fdf4",
                        }}
                      >
                        {row[2]}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-500">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-500 mt-2 m-0 italic">
            The Devil's Advocate carries 30% weight — enough to downgrade a verdict from MALICIOUS to SUSPICIOUS,
            but not enough to override unanimous specialist agreement entirely. This 30% weight was validated in Phase 3
            experiments (50% was tested in Phase 3e and found too aggressive — it suppressed true detections).
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
