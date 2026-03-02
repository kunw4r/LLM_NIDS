/**
 * Computes error attribution — where in the pipeline did errors occur?
 * Separates Tier 1 RF errors from LLM pipeline errors.
 *
 * @param {Array} flows - Array of flow result objects from inspector data
 * @returns {Object} Error attribution breakdown
 */
export function computeErrorAttribution(flows) {
  if (!flows || flows.length === 0) {
    return null;
  }

  const attacks = flows.filter(f => f.label_actual === 1);
  const benign = flows.filter(f => f.label_actual === 0);

  // Attack flows
  const tier1FilteredAttacks = attacks.filter(f => f.tier1_filtered === true);
  const tier1PassedAttacks = attacks.filter(f => f.tier1_filtered !== true);
  const llmDetected = tier1PassedAttacks.filter(f => {
    const v = (f.verdict || "").toUpperCase();
    return v === "MALICIOUS" || v === "SUSPICIOUS";
  });
  const llmMissed = tier1PassedAttacks.filter(f => {
    const v = (f.verdict || "").toUpperCase();
    return v === "BENIGN" || v === "";
  });

  // Benign flows
  const tier1FilteredBenign = benign.filter(f => f.tier1_filtered === true);
  const tier1PassedBenign = benign.filter(f => f.tier1_filtered !== true);
  const llmCleared = tier1PassedBenign.filter(f => {
    const v = (f.verdict || "").toUpperCase();
    return v === "BENIGN";
  });
  const llmFalseAlarm = tier1PassedBenign.filter(f => {
    const v = (f.verdict || "").toUpperCase();
    return v === "MALICIOUS" || v === "SUSPICIOUS";
  });

  const totalAttacks = attacks.length;
  const totalBenign = benign.length;
  const tp = llmDetected.length;
  const fn = tier1FilteredAttacks.length + llmMissed.length;
  const tn = tier1FilteredBenign.length + llmCleared.length;
  const fp = llmFalseAlarm.length;

  return {
    totalAttacks,
    totalBenign,
    // Attack path
    tier1FilteredAttacks: tier1FilteredAttacks.length,
    tier1PassedAttacks: tier1PassedAttacks.length,
    llmTP: tp,
    llmFNFromLLM: llmMissed.length,
    // Benign path
    tier1FilteredBenign: tier1FilteredBenign.length,
    tier1PassedBenign: tier1PassedBenign.length,
    llmTN: llmCleared.length,
    llmFP: fp,
    // Summary
    tp,
    fn,
    tn,
    fp,
    recall: totalAttacks > 0 ? tp / totalAttacks : 0,
    fpr: totalBenign > 0 ? fp / totalBenign : 0,
    // Error sources
    fnFromTier1: tier1FilteredAttacks.length,
    fnFromLLM: llmMissed.length,
  };
}
