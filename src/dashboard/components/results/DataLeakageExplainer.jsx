import React, { useState } from "react";

export default function DataLeakageExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-amber-300 bg-amber-50/30 rounded-lg mb-6 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 text-left cursor-pointer flex items-center justify-between hover:bg-amber-50/50 transition-colors"
      >
        <div>
          <div className="text-sm font-bold text-amber-900">What was the original data leakage, and how was it fixed?</div>
          <div className="text-xs text-gray-600 mt-0.5">
            The first Stage 1 run had hidden data leakage that artificially deflated FPR. Click to expand.
          </div>
        </div>
        <div className="text-amber-700 text-lg">{open ? "−" : "+"}</div>
      </button>

      {open && (
        <div className="px-5 py-4 border-t border-amber-200 bg-white space-y-4 text-sm text-gray-700 leading-relaxed">
          {/* The bug */}
          <div>
            <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide mb-1">The Bug — Within-Distribution Benign Leakage</h4>
            <p className="m-0">
              In the original Stage 1 runs, each 1,000-flow batch was assembled by sampling 50 attack flows
              for the target attack type and then drawing the 950 benign flows from <strong>the same CSV
              split</strong> (usually <code className="bg-gray-100 px-1 rounded text-[11px]">development.csv</code>, which was also
              the RF training source). The Tier 1 Random Forest had therefore already <em>seen those exact
              benign flows</em> during training — or at minimum, benign flows drawn from the same distribution
              the RF had memorised.
            </p>
            <p className="m-0 mt-2">
              The result: the RF's false positive rate on the benign half of every batch was <strong>artificially
              close to zero</strong>, because it had already learned those specific flows were benign. The
              reported FPR looked impressive but it was measuring training-set memorisation, not generalisation.
            </p>
          </div>

          {/* How it was detected */}
          <div>
            <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">How The Leakage Was Detected</h4>
            <p className="m-0">
              Two signs gave it away. First, Stage 1 FPR was an order of magnitude lower than any comparable
              NIDS paper reports for a random forest on this dataset — too good to be true. Second, comparing
              per-attack FPR across splits revealed that attacks drawn from <code className="bg-gray-100 px-1 rounded text-[11px]">validation.csv</code> or
              <code className="bg-gray-100 px-1 rounded text-[11px]">test.csv</code> (where benign flows were not in the RF's training set)
              had noticeably higher FPRs than attacks drawn from <code className="bg-gray-100 px-1 rounded text-[11px]">development.csv</code>.
              The gap pointed directly at benign sample source as the confound.
            </p>
          </div>

          {/* The fix */}
          <div>
            <h4 className="text-xs font-bold text-green-800 uppercase tracking-wide mb-1">The Fix — Clean Data Separation</h4>
            <p className="m-0">
              The rerun (<code className="bg-gray-100 px-1 rounded text-[11px]">run_clean_stage1.py</code>) enforces that every benign flow
              in a batch comes from a split the RF never saw during training. The final pipeline now uses:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-0.5 text-xs text-gray-700">
              <li><strong>RF training data:</strong> <code className="bg-gray-100 px-1 rounded">development.csv + validation.csv</code> combined (12 million flows)</li>
              <li><strong>Evaluation data:</strong> <code className="bg-gray-100 px-1 rounded">test.csv</code> — the held-out 8M flow split, never touched during training</li>
              <li><strong>Both attack and benign flows</strong> in every evaluation batch come from the test split, so the RF has zero prior exposure</li>
            </ul>
            <p className="m-0 mt-2">
              The revised results drop the "free FPR" advantage. Recall on the hard attacks dropped slightly
              (HOIC 70% → 66%, Infiltration 0% → 34% — the temporal clustering improvements offset this), but
              the numbers are now honest. The current dashboard numbers reflect the clean rerun.
            </p>
          </div>

          {/* What to say in the meeting */}
          <div className="bg-blue-50/60 border border-blue-200 rounded p-3">
            <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wide mb-1">What to Say in the Meeting</h4>
            <p className="m-0 text-xs text-gray-700">
              "The first Stage 1 run had a subtle leakage: the benign flows in each evaluation batch were sampled
              from the same CSV the RF was trained on, so the false positive rate measured training memorisation
              rather than generalisation. We caught this by cross-checking FPR across batches drawn from different
              splits — attacks from held-out splits had systematically higher FPR than attacks from the training
              split. The fix was to redraw every evaluation batch from the held-out test split only, so no flow
              in any batch was ever seen by the RF during training. We retrained the RF on development + validation
              (12M flows), evaluated on the held-out 8M test split, and the current numbers reflect that clean setup.
              The honest numbers are slightly less flattering on the easy attacks but substantially better on
              Infiltration because of the temporal clustering work done in parallel."
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
