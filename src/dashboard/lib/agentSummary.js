import { AGENT_KEYS } from "../data/constants";

/**
 * Single pass over LLM-analyzed flows to compute per-agent summary statistics.
 * @param {Array} flows - All flow results (including tier1_filtered)
 * @returns {Object} Per-agent summary keyed by agent ID
 */
export function computeAgentSummaries(flows) {
  if (!flows || flows.length === 0) return null;

  const llmFlows = flows.filter(f => !f.tier1_filtered);
  if (llmFlows.length === 0) return null;

  const summaries = {};

  // Initialize accumulators for specialists
  const specialistKeys = ["protocol", "statistical", "behavioural", "temporal"];
  specialistKeys.forEach(id => {
    summaries[id] = {
      verdicts: { MALICIOUS: 0, SUSPICIOUS: 0, BENIGN: 0 },
      totalConfidence: 0,
      count: 0,
      attackTypes: {},
      findings: {},
      // temporal-specific
      temporalPatterns: {},
    };
  });

  // DA accumulator
  summaries.devils_advocate = {
    totalConfBenign: 0,
    count: 0,
    benignIndicators: {},
  };

  // Orchestrator accumulator
  summaries.orchestrator = {
    verdicts: { MALICIOUS: 0, SUSPICIOUS: 0, BENIGN: 0 },
    totalConfidence: 0,
    totalConsensus: 0,
    count: 0,
    mitreTechniques: {},
  };

  llmFlows.forEach(f => {
    // Specialists
    specialistKeys.forEach(id => {
      const r = f.specialist_results?.[id];
      if (!r) return;
      const acc = summaries[id];
      const v = (r.verdict || "").toUpperCase();
      if (acc.verdicts[v] !== undefined) acc.verdicts[v]++;
      acc.totalConfidence += r.confidence || 0;
      acc.count++;
      if (r.attack_type) acc.attackTypes[r.attack_type] = (acc.attackTypes[r.attack_type] || 0) + 1;
      const findings = r.key_findings || r.key_evidence || [];
      findings.forEach(fi => {
        if (typeof fi === "string" && fi.length > 0) {
          const short = fi.slice(0, 80);
          acc.findings[short] = (acc.findings[short] || 0) + 1;
        }
      });
      // temporal-specific
      if (id === "temporal" && r.temporal_pattern) {
        acc.temporalPatterns[r.temporal_pattern] = (acc.temporalPatterns[r.temporal_pattern] || 0) + 1;
      }
    });

    // DA
    const da = f.devils_advocate;
    if (da) {
      summaries.devils_advocate.totalConfBenign += da.confidence_benign || da.confidence || 0;
      summaries.devils_advocate.count++;
      if (da.strongest_benign_indicator) {
        const ind = da.strongest_benign_indicator.slice(0, 80);
        summaries.devils_advocate.benignIndicators[ind] = (summaries.devils_advocate.benignIndicators[ind] || 0) + 1;
      }
    }

    // Orchestrator
    const ov = (f.verdict || "").toUpperCase();
    if (summaries.orchestrator.verdicts[ov] !== undefined) summaries.orchestrator.verdicts[ov]++;
    summaries.orchestrator.totalConfidence += f.confidence || 0;
    summaries.orchestrator.totalConsensus += f.consensus_score || 0;
    summaries.orchestrator.count++;
    if (f.mitre_techniques) {
      f.mitre_techniques.forEach(t => {
        summaries.orchestrator.mitreTechniques[t] = (summaries.orchestrator.mitreTechniques[t] || 0) + 1;
      });
    }
  });

  // Compute derived stats
  const result = {};

  specialistKeys.forEach(id => {
    const acc = summaries[id];
    const topAttack = topKey(acc.attackTypes);
    const topFinding = topKey(acc.findings);
    result[id] = {
      verdicts: acc.verdicts,
      avgConfidence: acc.count > 0 ? acc.totalConfidence / acc.count : 0,
      count: acc.count,
      topAttackType: topAttack,
      topFinding: topFinding,
      temporalPatterns: id === "temporal" ? acc.temporalPatterns : undefined,
    };
  });

  const daAcc = summaries.devils_advocate;
  result.devils_advocate = {
    avgConfBenign: daAcc.count > 0 ? daAcc.totalConfBenign / daAcc.count : 0,
    count: daAcc.count,
    topBenignIndicator: topKey(daAcc.benignIndicators),
  };

  const orchAcc = summaries.orchestrator;
  result.orchestrator = {
    verdicts: orchAcc.verdicts,
    avgConfidence: orchAcc.count > 0 ? orchAcc.totalConfidence / orchAcc.count : 0,
    avgConsensus: orchAcc.count > 0 ? orchAcc.totalConsensus / orchAcc.count : 0,
    count: orchAcc.count,
    topMitreTechniques: Object.entries(orchAcc.mitreTechniques)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t),
  };

  return result;
}

function topKey(obj) {
  let best = null, bestCount = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (v > bestCount) { best = k; bestCount = v; }
  }
  return best;
}

/**
 * Generate a template-based narrative sentence from agent summary stats.
 */
export function generateAgentNarrative(agentId, summary, attackType) {
  if (!summary) return "";

  if (agentId === "devils_advocate") {
    const conf = (summary.avgConfBenign * 100).toFixed(0);
    const indicator = summary.topBenignIndicator || "standard traffic patterns";
    return `Averaged ${conf}% benign confidence across ${summary.count} flows. Most common argument: "${indicator}".`;
  }

  if (agentId === "orchestrator") {
    const conf = (summary.avgConfidence * 100).toFixed(0);
    const cons = (summary.avgConsensus * 100).toFixed(0);
    const mal = summary.verdicts.MALICIOUS;
    const sus = summary.verdicts.SUSPICIOUS;
    const ben = summary.verdicts.BENIGN;
    return `Rendered ${mal} MALICIOUS, ${sus} SUSPICIOUS, and ${ben} BENIGN verdicts. Average confidence: ${conf}%, average consensus: ${cons}%.`;
  }

  // Specialist agents
  const s = summary;
  const conf = (s.avgConfidence * 100).toFixed(0);
  const dominant = Object.entries(s.verdicts).sort((a, b) => b[1] - a[1])[0];
  const dominantPct = s.count > 0 ? ((dominant[1] / s.count) * 100).toFixed(0) : 0;

  let extra = "";
  if (agentId === "temporal" && s.temporalPatterns && Object.keys(s.temporalPatterns).length > 0) {
    const topPattern = topKey(s.temporalPatterns);
    extra = ` Dominant temporal pattern: "${topPattern}".`;
  }
  if (s.topFinding) {
    extra += ` Most common finding: "${s.topFinding}".`;
  }

  return `Classified ${dominantPct}% as ${dominant[0]} (avg confidence ${conf}%).${extra}`;
}
