import React from "react";

/**
 * Visual funnel showing WHERE errors occur in the pipeline.
 * Separates Tier 1 RF mistakes from LLM pipeline mistakes.
 */
export default function ErrorAttribution({ attribution }) {
  if (!attribution) return null;

  const {
    totalAttacks, totalBenign,
    tier1FilteredAttacks, tier1PassedAttacks,
    llmTP, llmFNFromLLM,
    tier1FilteredBenign, tier1PassedBenign,
    llmTN, llmFP,
    fnFromTier1, fnFromLLM,
  } = attribution;

  return (
    <div className="border border-gray-200 rounded-lg p-3 sm:p-5 mb-5 overflow-x-auto">
      <div className="text-sm font-bold mb-1">Error Attribution — Where Did Mistakes Happen?</div>
      <p className="text-xs text-gray-500 mb-4">Traces each flow through the pipeline to identify whether Tier 1 (RF) or Tier 2 (LLM) caused misclassifications.</p>

      {/* Attack path */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-700 mb-2">Attack Flows ({totalAttacks})</div>
        <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono">
          <span className="px-2.5 py-1.5 bg-red-100 text-red-800 rounded font-semibold">{totalAttacks} attacks</span>
          <span className="text-gray-400">&rarr;</span>
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">Tier 1 RF</span>
          <span className="text-gray-400">&rarr;</span>

          {/* Branch: passed to LLM */}
          <span className="flex items-center gap-1.5">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">{tier1PassedAttacks} passed</span>
            <span className="text-gray-400">&rarr;</span>
            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded border border-purple-200">LLM</span>
            <span className="text-gray-400">&rarr;</span>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded font-semibold">{llmTP} TP</span>
            {llmFNFromLLM > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-semibold">{llmFNFromLLM} missed (FN)</span>
              </>
            )}
          </span>
        </div>
        {tier1FilteredAttacks > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 ml-[168px] text-xs font-mono">
            <span className="text-gray-400">&searr;</span>
            <span className="px-2 py-1 bg-red-200 text-red-900 rounded font-semibold">{tier1FilteredAttacks} filtered out (FN)</span>
            <span className="text-[10px] text-red-500 font-normal">Tier 1 error</span>
          </div>
        )}
      </div>

      {/* Benign path */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-700 mb-2">Benign Flows ({totalBenign})</div>
        <div className="flex items-center gap-1.5 flex-wrap text-xs font-mono">
          <span className="px-2.5 py-1.5 bg-green-100 text-green-800 rounded font-semibold">{totalBenign} benign</span>
          <span className="text-gray-400">&rarr;</span>
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200">Tier 1 RF</span>
          <span className="text-gray-400">&rarr;</span>

          <span className="flex items-center gap-1.5">
            <span className="px-2 py-1 bg-green-50 text-green-700 rounded">{tier1FilteredBenign} filtered (TN)</span>
          </span>
        </div>
        {tier1PassedBenign > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 ml-[168px] text-xs font-mono">
            <span className="text-gray-400">&searr;</span>
            <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">{tier1PassedBenign} to LLM</span>
            <span className="text-gray-400">&rarr;</span>
            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded border border-purple-200">LLM</span>
            <span className="text-gray-400">&rarr;</span>
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded">{llmTN} cleared (TN)</span>
            {llmFP > 0 && (
              <>
                <span className="text-gray-300">|</span>
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-semibold">{llmFP} false alarm (FP)</span>
                <span className="text-[10px] text-red-500 font-normal">LLM error</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Summary sentence */}
      <div className="bg-gray-50 rounded-md px-4 py-3 text-sm text-gray-700 leading-relaxed">
        <strong>Summary:</strong>{" "}
        Of {totalAttacks} attacks: Tier 1 correctly passed {tier1PassedAttacks} to LLM
        {fnFromTier1 > 0 ? ` (${fnFromTier1} lost at filter)` : ""}.{" "}
        LLM detected {llmTP} of {tier1PassedAttacks}
        {llmFNFromLLM > 0 ? ` (${llmFNFromLLM} missed)` : ""}.{" "}
        Net: <strong>{llmTP} TP</strong>, <strong>{fnFromTier1 + llmFNFromLLM} FN</strong>
        {fnFromTier1 > 0 && llmFNFromLLM > 0 ? ` (${fnFromTier1} Tier 1 + ${llmFNFromLLM} LLM)` :
         fnFromTier1 > 0 ? ` (all Tier 1)` : llmFNFromLLM > 0 ? ` (all LLM)` : ""}.
        {llmFP > 0 ? ` ${llmFP} false positive${llmFP !== 1 ? "s" : ""} from LLM.` : " Zero false positives."}
      </div>
    </div>
  );
}
