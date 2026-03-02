/**
 * Multiclass attack type classification analysis.
 *
 * The LLM outputs free-text attack type predictions (e.g., "Potential Brute Force")
 * while ground truth uses dataset labels (e.g., "FTP-BruteForce"). This module
 * performs fuzzy matching to evaluate multiclass accuracy.
 */

// Keyword-based mapping from ground truth attack types to expected LLM prediction patterns.
// Each entry: [ground truth label, [patterns that count as a correct match]]
const TYPE_MATCH_RULES = [
  ["FTP-BruteForce",         ["brute force", "ftp", "credential", "dictionary", "t1110"]],
  ["SSH-Bruteforce",         ["brute force", "ssh", "credential", "dictionary", "t1110"]],
  ["DDoS_attacks-LOIC-HTTP", ["ddos", "dos", "flood", "loic", "http flood", "volumetric"]],
  ["DoS_attacks-Hulk",       ["dos", "hulk", "flood", "http flood", "denial"]],
  ["DoS_attacks-SlowHTTPTest", ["dos", "slow", "slowhttp", "slow http", "slowpost", "connection exhaustion", "denial"]],
  ["DoS_attacks-GoldenEye",  ["dos", "goldeneye", "keep-alive", "keepalive", "http flood", "denial"]],
  ["DoS_attacks-Slowloris",  ["dos", "slowloris", "slow", "partial header", "connection exhaustion", "denial"]],
  ["DDOS_attack-HOIC",       ["ddos", "dos", "hoic", "flood", "http flood", "volumetric"]],
  ["DDOS_attack-LOIC-UDP",   ["ddos", "dos", "udp", "loic", "flood", "volumetric"]],
  ["Bot",                    ["bot", "botnet", "c2", "command and control", "beacon", "c&c"]],
  ["Infilteration",          ["infiltr", "exfil", "dns tunnel", "data exfil", "dns exfil", "covert"]],
  ["Brute_Force_-Web",       ["brute force", "web", "credential", "login", "authentication", "t1110"]],
  ["Brute_Force_-XSS",       ["xss", "cross-site", "script", "injection", "web attack"]],
  ["SQL_Injection",          ["sql", "injection", "sqli", "database", "t1190"]],
];

/**
 * Check if a predicted attack type matches the actual attack type.
 * Returns { match: boolean, category: "exact"|"fuzzy"|"none", detail: string }
 */
export function matchAttackType(actualType, predictedType) {
  if (!predictedType || !actualType || actualType === "Benign") {
    return { match: false, category: "none", detail: "No prediction" };
  }

  const predLower = predictedType.toLowerCase();
  const actualLower = actualType.toLowerCase().replace(/_/g, " ").replace(/-/g, " ");

  // Exact or near-exact match
  if (predLower.includes(actualLower) || actualLower.includes(predLower)) {
    return { match: true, category: "exact", detail: "Direct match" };
  }

  // Fuzzy match via keyword rules
  const rule = TYPE_MATCH_RULES.find(([gt]) => gt === actualType);
  if (rule) {
    const [, patterns] = rule;
    const matched = patterns.filter(p => predLower.includes(p));
    if (matched.length > 0) {
      return { match: true, category: "fuzzy", detail: `Matched: ${matched.join(", ")}` };
    }
  }

  // Check if prediction at least gets the category right (DoS, DDoS, Brute Force, etc.)
  const categories = [
    { keywords: ["dos", "denial"], types: ["DoS_attacks-Hulk", "DoS_attacks-SlowHTTPTest", "DoS_attacks-GoldenEye", "DoS_attacks-Slowloris", "DDoS_attacks-LOIC-HTTP", "DDOS_attack-HOIC", "DDOS_attack-LOIC-UDP"] },
    { keywords: ["brute", "credential"], types: ["FTP-BruteForce", "SSH-Bruteforce", "Brute_Force_-Web"] },
    { keywords: ["scan", "recon", "probe"], types: ["FTP-BruteForce", "SSH-Bruteforce", "Brute_Force_-Web", "Brute_Force_-XSS", "SQL_Injection"] },
  ];
  for (const cat of categories) {
    if (cat.types.includes(actualType) && cat.keywords.some(k => predLower.includes(k))) {
      return { match: true, category: "fuzzy", detail: "Category-level match" };
    }
  }

  return { match: false, category: "none", detail: `"${predictedType}" doesn't match "${actualType}"` };
}

/**
 * Compute multiclass classification stats from loaded flows.
 * @param {Array} flows - All flow results
 * @param {string} attackType - The ground truth attack type for this experiment
 * @returns {Object} Multiclass stats
 */
export function computeMulticlassStats(flows, attackType) {
  if (!flows || flows.length === 0) return null;

  const llmFlows = flows.filter(f => !f.tier1_filtered);
  const attackFlows = llmFlows.filter(f => f.label_actual === 1);
  const benignFlows = llmFlows.filter(f => f.label_actual === 0);

  // Orchestrator-level multiclass accuracy (on true attack flows that were correctly detected)
  const detectedAttacks = attackFlows.filter(f => {
    const v = (f.verdict || "").toUpperCase();
    return v === "MALICIOUS" || v === "SUSPICIOUS";
  });

  let orchCorrectType = 0;
  let orchWrongType = 0;
  let orchNoType = 0;
  const orchPredictions = {};
  const orchMatches = [];

  detectedAttacks.forEach(f => {
    const pred = f.attack_type_predicted || f.attack_category;
    if (!pred) {
      orchNoType++;
      orchMatches.push({ flow: f.flow_idx, predicted: null, match: false, detail: "No type predicted" });
      return;
    }
    orchPredictions[pred] = (orchPredictions[pred] || 0) + 1;
    const result = matchAttackType(attackType, pred);
    if (result.match) {
      orchCorrectType++;
    } else {
      orchWrongType++;
    }
    orchMatches.push({ flow: f.flow_idx, predicted: pred, match: result.match, detail: result.detail, category: result.category });
  });

  // Per-specialist attack type predictions on attack flows
  const specialistStats = {};
  ["protocol", "statistical", "behavioural", "temporal"].forEach(agentId => {
    let correct = 0, wrong = 0, noType = 0;
    const predictions = {};

    attackFlows.forEach(f => {
      const r = f.specialist_results?.[agentId];
      if (!r) return;
      const pred = r.attack_type;
      if (!pred) { noType++; return; }
      predictions[pred] = (predictions[pred] || 0) + 1;
      const result = matchAttackType(attackType, pred);
      if (result.match) correct++;
      else wrong++;
    });

    specialistStats[agentId] = { correct, wrong, noType, total: attackFlows.length, predictions };
  });

  // False alarm type predictions (benign flows wrongly flagged — what type did system think?)
  const fpFlows = benignFlows.filter(f => {
    const v = (f.verdict || "").toUpperCase();
    return v === "MALICIOUS" || v === "SUSPICIOUS";
  });
  const fpPredictions = {};
  fpFlows.forEach(f => {
    const pred = f.attack_type_predicted || f.attack_category || "Unknown";
    fpPredictions[pred] = (fpPredictions[pred] || 0) + 1;
  });

  return {
    totalAttackFlows: attackFlows.length,
    detectedAttackFlows: detectedAttacks.length,
    orchestrator: {
      correctType: orchCorrectType,
      wrongType: orchWrongType,
      noType: orchNoType,
      accuracy: detectedAttacks.length > 0 ? orchCorrectType / detectedAttacks.length : 0,
      predictions: orchPredictions,
      matches: orchMatches,
    },
    specialists: specialistStats,
    falsePositives: {
      count: fpFlows.length,
      predictions: fpPredictions,
    },
  };
}
