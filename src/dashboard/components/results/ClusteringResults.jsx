import React from "react";

const CLUSTERING_ROWS = [
  { label: "Baseline (Stage 1)", recall: "0%", fpr: "0%", f1: "0%", tp: 0, fp: 2, fn: 50, llm: "~60", cost: "$0.80", id: "stage1_infilteration", color: "#dc2626" },
  { label: "A: Enriched Prompt Only", recall: "0%", fpr: "0%", f1: "0%", tp: 0, fp: 0, fn: 50, llm: "0", cost: "$0.00", id: "clustering_a", color: "#dc2626" },
  { label: "B: Temporal Clustering", recall: "52%", fpr: "17.9%", f1: "21.1%", tp: 26, fp: 170, fn: 24, llm: "222", cost: "$7.24", id: "clustering_b", color: "#d97706" },
  { label: "C: Enriched + Clustering", recall: "58%", fpr: "19.2%", f1: "22.2%", tp: 29, fp: 182, fn: 21, llm: "222", cost: "$7.79", id: "clustering_c", color: "#16a34a" },
];

const RECALL_BARS = [
  { label: "Baseline", value: 0, color: "#dc2626" },
  { label: "A: Prompt", value: 0, color: "#dc2626" },
  { label: "B: Cluster", value: 52, color: "#d97706" },
  { label: "C: Both", value: 58, color: "#16a34a" },
];

const COST_BARS = [
  { label: "Baseline", cost: 0.80, recall: 0, color: "#dc2626" },
  { label: "A: Prompt", cost: 0, recall: 0, color: "#dc2626" },
  { label: "B: Cluster", cost: 7.24, recall: 52, color: "#d97706" },
  { label: "C: Both", cost: 7.79, recall: 58, color: "#16a34a" },
];

export default function ClusteringResults({ onInspectFlows }) {
  return (
    <div>
      {/* Header */}
      <h2 className="text-xl font-bold mb-2 tracking-tight">Temporal Clustering — Infiltration Recovery</h2>
      <p className="text-sm text-gray-500 mb-5 leading-relaxed max-w-3xl">
        Infiltration scored 0% recall in Stage 1 — a double failure where Tier 1 RF filtered all 50 attack flows as
        benign and the LLM classified the remaining as benign (individual DNS queries are indistinguishable from
        legitimate traffic). Three conditions tested whether temporal clustering can recover detection.
      </p>

      {/* ── EXPERIMENT NARRATIVE — What / Gained / Conclude / Justify ── */}
      <div className="border border-blue-100 bg-blue-50/30 rounded-lg p-5 mb-5 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1.5">What We Tested</h3>
          <p className="text-sm text-gray-700 leading-relaxed m-0">
            <strong>Hypothesis:</strong> Infiltration's 0% recall is a context problem, not a model problem. Individual DNS
            exfiltration flows (port 53, UDP, 63-457 bytes) are statistically identical to legitimate DNS — no single-flow
            classifier can distinguish them. We tested whether <strong>grouping flows by source IP</strong> and injecting
            cluster-level aggregates (DNS query count, port diversity, time span) gives agents enough context to detect the
            pattern. Three conditions: (A) enriched prompts only, (B) temporal clustering only, (C) enriched prompts + clustering.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-1.5">What We Gained</h3>
          <div className="text-sm text-gray-700 leading-relaxed space-y-1">
            <p className="m-0">
              <strong>Recall recovered from 0% to 58%</strong> (Config C: enriched + clustering). Clustering alone (Config B)
              achieved 52% — proving that aggregate context is the primary driver. Enriched prompts alone (Config A) achieved
              0% because flows never reach the LLM without the clustering override of Tier 1 RF filtering. The clustering
              mechanism rescued 39/50 attack flows from RF filtering and injected MITRE ATT&CK T1048.003 (DNS exfiltration)
              context into agent prompts.
            </p>
            <p className="m-0 text-amber-800">
              <strong>Trade-off:</strong> FPR increased to 17.9-19.2% (170-182 false positives on 950 benign flows) because
              benign DNS clusters look structurally similar to attack DNS clusters. Cost increased to $7.24-$7.79 per batch
              (vs $0.80 baseline) because clustering sends 222 flows to the LLM pipeline instead of ~60.
            </p>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-purple-800 uppercase tracking-wide mb-1.5">What We Conclude</h3>
          <p className="text-sm text-gray-700 leading-relaxed m-0">
            Temporal clustering transforms an <strong>impossible detection task into a feasible one</strong>, but at the cost
            of precision. The 19.2% FPR is unacceptable for production deployment — it would generate ~190 false alarms per
            1,000 flows. However, this demonstrates a fundamental architectural insight: <strong>some attacks cannot be detected
            at the individual flow level</strong> and require session-level or cluster-level context. The v3 architecture
            (clustering + ML head + multi-agent) represents a third tier of analysis for flows that need aggregate reasoning.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Justification</h3>
          <p className="text-sm text-gray-700 leading-relaxed m-0">
            This experiment validates the v3 hypothesis and provides the thesis's most important negative result:
            <strong> flow-level NIDS has a fundamental detection ceiling</strong> for stealthy attacks. The 58% recall recovery
            proves that LLM agents can reason over aggregate context when provided — the limitation is not LLM capability
            but input granularity. This motivates future work on hierarchical detection (flow → cluster → session → host)
            and demonstrates why AMATAS's explainable reasoning is valuable: the agents' cluster-level analysis produces
            exactly the kind of evidence (46 DNS queries to 4 unique ports over 5,813 seconds) that a SOC analyst would
            use to triage infiltration alerts.
          </p>
        </div>
      </div>

      {/* Problem diagnosis */}
      <div className="border border-amber-400 rounded-lg p-4 mb-5 bg-amber-50">
        <div className="text-sm font-semibold text-amber-800 mb-2">Why Infiltration Failed in Stage 1</div>
        <div className="flex gap-6 text-xs text-amber-900">
          <div>
            <strong>46/50</strong> attack flows are DNS queries (port 53, UDP, 1 pkt, 63-457 bytes)
          </div>
          <div>
            <strong>40/50</strong> attacks filtered by Tier 1 RF as statistically identical to benign DNS
          </div>
          <div>
            <strong>10/50</strong> reached LLM — all classified BENIGN (individually indistinguishable)
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden mb-5">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-4 py-2.5 text-left border-b border-gray-200 font-semibold">Condition</th>
              <th className="px-4 py-2.5 text-center border-b border-gray-200 font-semibold">Recall</th>
              <th className="px-4 py-2.5 text-center border-b border-gray-200 font-semibold">FPR</th>
              <th className="px-4 py-2.5 text-center border-b border-gray-200 font-semibold">F1</th>
              <th className="px-4 py-2.5 text-center border-b border-gray-200 font-semibold">TP/FP/FN</th>
              <th className="px-4 py-2.5 text-center border-b border-gray-200 font-semibold">LLM Flows</th>
              <th className="px-4 py-2.5 text-right border-b border-gray-200 font-semibold">Cost</th>
              <th className="px-4 py-2.5 text-center border-b border-gray-200 font-semibold">Inspect</th>
            </tr>
          </thead>
          <tbody>
            {CLUSTERING_ROWS.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-2.5 border-b border-gray-100 font-medium">{row.label}</td>
                <td className="px-4 py-2.5 text-center border-b border-gray-100 font-bold" style={{ color: row.color }}>
                  {row.recall}
                </td>
                <td className="px-4 py-2.5 text-center border-b border-gray-100">{row.fpr}</td>
                <td className="px-4 py-2.5 text-center border-b border-gray-100">{row.f1}</td>
                <td className="px-4 py-2.5 text-center border-b border-gray-100 font-mono text-xs">
                  {row.tp}/{row.fp}/{row.fn}
                </td>
                <td className="px-4 py-2.5 text-center border-b border-gray-100">{row.llm}</td>
                <td className="px-4 py-2.5 text-right border-b border-gray-100">{row.cost}</td>
                <td className="px-4 py-2.5 text-center border-b border-gray-100">
                  <button
                    onClick={() => onInspectFlows(row.id)}
                    className="bg-transparent border border-gray-300 rounded px-2 py-0.5 cursor-pointer text-xs text-blue-600 hover:bg-blue-50"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Two side-by-side charts */}
      <div className="flex gap-5 mb-5">
        {/* Recall Recovery bar chart */}
        <div className="flex-1 border border-gray-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-500 mb-3">Recall Recovery</div>
          <div className="flex items-end gap-4 h-[120px]">
            {RECALL_BARS.map(b => (
              <div key={b.label} className="flex-1 text-center">
                <div className="text-xs font-bold mb-1" style={{ color: b.color }}>
                  {b.value}%
                </div>
                <div
                  className="rounded-t transition-all duration-300"
                  style={{
                    height: Math.max(b.value * 1.2, 3),
                    background: b.color,
                  }}
                />
                <div className="text-[10px] text-gray-400 mt-1 leading-tight">{b.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cost vs Detection chart */}
        <div className="flex-1 border border-gray-200 rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-500 mb-3">Cost vs Detection</div>
          <div className="flex items-end gap-4 h-[120px]">
            {COST_BARS.map(b => (
              <div key={b.label} className="flex-1 text-center">
                <div className="text-[10px] text-gray-500 mb-0.5">${b.cost.toFixed(2)}</div>
                <div className="text-xs font-bold mb-1" style={{ color: b.color }}>
                  {b.recall}%
                </div>
                <div
                  className="rounded-t opacity-70"
                  style={{
                    height: Math.max(b.cost * 10, 3),
                    background: b.color,
                  }}
                />
                <div className="text-[10px] text-gray-400 mt-1 leading-tight">{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key findings */}
      <div className="border border-gray-200 rounded-lg p-4 mb-5">
        <div className="text-sm font-semibold mb-3">Key Findings</div>
        <div className="flex flex-col gap-2.5 text-sm text-gray-700 leading-relaxed">
          <div>
            <strong className="text-blue-600">1. Clustering is the primary driver.</strong> IP-level clustering
            recovered recall from 0% to 52% by (a) overriding Tier 1 RF for suspicious clusters (39/50 attacks rescued)
            and (b) injecting aggregate context so LLM agents see the DNS exfiltration pattern.
          </div>
          <div>
            <strong className="text-blue-600">2. Enriched prompts are additive but insufficient alone.</strong> +6%
            recall when combined with clustering (52% to 58%), but 0% alone because flows never reach the LLM without
            clustering override.
          </div>
          <div>
            <strong className="text-blue-600">3. High FPR is the trade-off.</strong> 17.9-19.2% FPR because benign DNS
            clusters look similar to attack DNS clusters. Cluster context biases all 6 agents toward MALICIOUS for any
            DNS-heavy cluster.
          </div>
          <div>
            <strong className="text-blue-600">4. Total cost: $15.02</strong> across all 3 conditions ($0.00 + $7.24 +
            $7.79). 222 flows analysed by LLM per clustering condition (vs ~60 in baseline).
          </div>
        </div>
      </div>

      {/* How clustering works */}
      <div className="border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-semibold mb-3">How Temporal Clustering Works</div>
        <pre className="text-xs text-gray-700 leading-relaxed m-0 whitespace-pre-wrap font-mono">{`1. Group all flows by source IP address (IP-level clustering)
2. For each cluster: count DNS queries (port 53), unique ports, total bytes, time span
3. If cluster has >= 8 DNS queries → flag as suspicious
4. Suspicious cluster flows BYPASS Tier 1 RF filter → sent to LLM pipeline
5. Cluster summary injected into each flow's data (all 6 agents see it):
   "CLUSTER #7: 46 flows from 172.31.69.28 over 5813.0s.
    DNS queries: 43/46. Unique dst ports: 4.
    This cluster context is critical — the AGGREGATE PATTERN
    may indicate DNS exfiltration (T1048.003)."
6. Agents analyse individual flows BUT with cluster-level awareness`}</pre>
      </div>
    </div>
  );
}
