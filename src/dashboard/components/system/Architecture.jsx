import React, { useState } from "react";
import { AGENTS } from "../../data/agents";
import { AGENT_COST_DATA } from "../../data/stage1";
import { DATASET_SPLITS, RF_TRAINED_TYPES, RF_CAUGHT_UNSEEN, AGENT_KEYS, rfPillColor } from "../../data/constants";

export default function Architecture() {
  const [expandedPrompts, setExpandedPrompts] = useState({});

  return (
    <div>
      <h2 className="text-xl font-bold mb-6 tracking-tight">System Architecture</h2>

      {/* Full architecture diagram */}
      <div className="border border-gray-200 rounded-lg p-8 mb-6">
        <div className="flex flex-col items-center gap-3 font-mono text-sm">
          <div className="border border-gray-200 rounded-lg px-8 py-3 bg-gray-50 font-semibold">
            CICIDS2018 NetFlow v3 &middot; 20M flows &middot; 53 features
          </div>
          <div className="text-gray-400">&#8595;</div>
          <div className="border border-gray-200 rounded-lg px-6 py-3 bg-gray-50">
            Stratified Sample &middot; 1000 flows per batch (950 benign + 50 attack)
          </div>
          <div className="text-gray-400">&#8595;</div>
          <div className="border-2 border-blue-600 rounded-lg px-8 py-4 text-center">
            <div className="text-blue-600 font-semibold mb-1">Tier 1: Random Forest Pre-Filter</div>
            <div className="text-xs text-gray-500">Filters ~95% of flows as obviously benign</div>
            <div className="text-xs text-gray-500">Threshold: 0.15 &middot; Trained on development split</div>
          </div>
          <div className="flex gap-8 items-center">
            <div className="text-center">
              <div className="text-gray-400 text-xs">&#8595; ~50 flows</div>
              <div className="text-xs text-gray-500">Flagged for LLM analysis</div>
            </div>
            <div className="text-center">
              <div className="text-green-600 text-xs">&#8594; ~950 flows</div>
              <div className="text-xs text-gray-500">Classified BENIGN</div>
            </div>
          </div>
          <div className="text-gray-400">&#8595;</div>
          <div className="border border-gray-200 rounded-lg p-5 w-full max-w-xl">
            <div className="text-xs font-semibold text-gray-500 mb-3 text-center">Tier 2: 6-Agent Multi-Agent LLM Pipeline</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {AGENTS.filter(a => a.id !== "devils_advocate" && a.id !== "orchestrator").map(a => (
                <div key={a.id} className="border border-gray-200 rounded-md py-2 px-2 text-center">
                  <div className="text-xs font-semibold" style={{ color: a.color }}>{a.name}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{a.desc.slice(0, 30)}...</div>
                </div>
              ))}
            </div>
            <div className="flex justify-center text-gray-400 mb-2">&#8595;</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="border border-red-300 rounded-md p-2.5 text-center">
                <div className="text-xs font-semibold text-red-600">Devil's Advocate</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Counter-argument for benign</div>
              </div>
              <div className="border-2 border-blue-600 rounded-md p-2.5 text-center">
                <div className="text-xs font-semibold text-blue-600">Orchestrator</div>
                <div className="text-[10px] text-gray-400 mt-0.5">Weighted consensus verdict</div>
              </div>
            </div>
          </div>
          <div className="text-gray-400">&#8595;</div>
          <div className="border border-gray-200 rounded-lg px-8 py-3 bg-gray-50 font-medium">
            Verdict + Confidence + Attack Type + Full Reasoning Chain
          </div>
        </div>
      </div>

      {/* Agent Roles */}
      <h3 className="text-base font-semibold mb-4">Agent Roles</h3>
      <div className="grid grid-cols-3 gap-3">
        {AGENTS.map(a => {
          const isExpanded = expandedPrompts[`arch_${a.id}`];
          return (
            <div
              key={a.id}
              className="border border-gray-200 rounded-lg p-4"
              style={{ gridColumn: isExpanded ? "1 / -1" : undefined }}
            >
              <div className="text-sm font-semibold mb-1" style={{ color: a.color }}>{a.name}</div>
              <div className="text-xs text-gray-500 leading-relaxed mb-2">{a.desc}</div>
              <button
                onClick={() => setExpandedPrompts(prev => ({ ...prev, [`arch_${a.id}`]: !prev[`arch_${a.id}`] }))}
                className="bg-transparent border-none p-0 text-xs font-semibold cursor-pointer"
                style={{ color: a.color }}
              >
                {isExpanded ? "Hide Prompt \u25B2" : "View Prompt \u25BC"}
              </button>
              {isExpanded && (
                <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md text-xs leading-relaxed whitespace-pre-wrap break-words max-h-72 overflow-y-auto text-gray-700 font-mono">
                  {a.prompt}
                </pre>
              )}
            </div>
          );
        })}
      </div>

      {/* Agent Cost Distribution */}
      <div className="border border-gray-200 rounded-lg p-6 mt-6">
        <h3 className="text-base font-semibold mb-1">Agent Cost Distribution</h3>
        <p className="text-xs text-gray-500 mb-5">
          Averaged across all 14 Stage 1 experiments ({AGENT_COST_DATA.totalLlmFlows} LLM-analysed flows)
        </p>

        {/* Horizontal bar chart */}
        <div className="flex flex-col gap-2 mb-5">
          {[...AGENT_KEYS].sort((a, b) => AGENT_COST_DATA[b].pct - AGENT_COST_DATA[a].pct).map(a => {
            const d = AGENT_COST_DATA[a];
            return (
              <div key={a} className="flex items-center gap-2.5">
                <div className="w-24 text-xs font-medium text-gray-700 text-right">{d.label}</div>
                <div className="flex-1 bg-gray-100 rounded h-[22px] relative overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-300"
                    style={{ width: `${(d.pct / 30) * 100}%`, maxWidth: "100%", background: d.color }}
                  />
                </div>
                <div className="w-24 text-xs text-gray-500 text-right font-mono">
                  ${d.cost.toFixed(2)} ({d.pct}%)
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-900 font-mono">${AGENT_COST_DATA.avgPerLlmFlow.toFixed(3)}</div>
            <div className="text-xs text-gray-500 mt-1">avg cost per LLM-analysed flow</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-800 font-mono">${AGENT_COST_DATA.avgPerBatch.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">avg cost per 1,000-flow batch</div>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-900 font-mono">~${(AGENT_COST_DATA.estWithoutTier1 / 14).toFixed(0)}</div>
            <div className="text-xs text-gray-500 mt-1">Tier 1 saves per batch</div>
          </div>
        </div>

        {/* Insight */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <div className="text-xs text-gray-700 leading-relaxed">
            <strong>Orchestrator + DA account for {(AGENT_COST_DATA.orchestrator.pct + AGENT_COST_DATA.devils_advocate.pct).toFixed(1)}%</strong> of
            all LLM spend — they receive all specialist outputs as context, making their prompts significantly longer.
            Temporal agent cost varies most across attack types (8–41%) — higher for attacks with many flows from the same IP,
            as more connected flows are injected as context.
          </div>
        </div>
      </div>

      {/* Dataset info */}
      <div className="border border-gray-200 rounded-lg p-5 mt-6">
        <h3 className="text-sm font-semibold mb-3">Dataset: CICIDS2018 NetFlow v3</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm mb-5">
          {[
            { label: "Total Flows", value: "20,115,529" },
            { label: "Features", value: "53" },
            { label: "Attack Types", value: "14" },
            { label: "Benign Ratio", value: "87%" },
          ].map(d => (
            <div key={d.label}>
              <div className="text-xl font-bold">{d.value}</div>
              <div className="text-xs text-gray-500">{d.label}</div>
            </div>
          ))}
        </div>

        {/* Stacked proportion bar */}
        <div className="flex h-7 rounded-md overflow-hidden mb-4 border border-gray-200">
          <div className="flex items-center justify-center text-white text-xs font-semibold bg-blue-500" style={{ width: "35%" }}>Dev 35%</div>
          <div className="flex items-center justify-center text-white text-xs font-semibold bg-amber-500" style={{ width: "25%" }}>Val 25%</div>
          <div className="flex items-center justify-center text-white text-xs font-semibold bg-violet-500" style={{ width: "40%" }}>Test 40%</div>
        </div>

        {/* Legend */}
        <div className="flex gap-4 mb-5 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-200 inline-block" /> In RF training
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-200 inline-block" /> Caught unseen
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-200 inline-block" /> RF misses
          </span>
        </div>

        {/* Three split cards */}
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(DATASET_SPLITS).map(([key, split]) => {
            const borderColor = key === "development" ? "#3b82f6" : key === "validation" ? "#f59e0b" : "#8b5cf6";
            return (
              <div key={key} className="rounded-lg p-4 relative" style={{ border: `2px solid ${borderColor}` }}>
                <div className="flex justify-between items-center mb-2">
                  <div>
                    <div className="text-sm font-bold">{split.label}</div>
                    <div className="text-xs text-gray-500">{(split.flows / 1e6).toFixed(2)}M flows ({split.pct}%)</div>
                  </div>
                  {split.badge && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">{split.badge}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(split.attacks).map(([at, count]) => {
                    const pill = rfPillColor(at);
                    const display = count >= 1000 ? `${(count / 1000).toFixed(0)}K` : String(count);
                    return (
                      <span
                        key={at}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap"
                        style={{ background: pill.bg, color: pill.color }}
                      >
                        {at.replace(/_/g, " ").replace("attacks-", "")} ({display})
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data Integrity & Split Design */}
      <div className="border border-gray-200 rounded-lg p-6 mt-6">
        <h3 className="text-base font-semibold mb-4">Data Integrity &amp; Split Design</h3>

        {/* Flow diagram */}
        <div className="font-mono text-xs leading-relaxed bg-gray-50 rounded-lg p-6 mb-5 overflow-x-auto">
          <div className="flex flex-col items-center gap-1">
            <div className="border-2 border-blue-800 rounded-lg px-6 py-2.5 bg-blue-50 font-semibold text-center">
              NF-CICIDS2018-v3.csv&nbsp;&nbsp;(20.1M flows)
            </div>
            <div className="text-gray-400">|</div>
            <div className="flex gap-12 items-start">
              {/* Left branch: development */}
              <div className="flex flex-col items-center gap-1">
                <div className="border-2 border-blue-500 rounded-lg px-4 py-2.5 text-center">
                  <div className="font-semibold text-blue-800">development</div>
                  <div className="text-xs text-gray-500">7.04M flows &middot; 7 attack types</div>
                </div>
                <div className="text-gray-400">|</div>
                <div className="text-xs text-gray-500">80 / 20 split</div>
                <div className="text-gray-400">|</div>
                <div className="flex gap-4">
                  <div className="border-2 border-green-600 rounded-lg px-3 py-2.5 text-center">
                    <div className="font-semibold text-green-600">train</div>
                    <div className="text-xs text-gray-500">5.63M</div>
                    <div className="text-[10px] text-green-600 mt-0.5">RF trains here</div>
                  </div>
                  <div className="border-2 border-blue-600 rounded-lg px-3 py-2.5 text-center">
                    <div className="font-semibold text-blue-600">eval</div>
                    <div className="text-xs text-gray-500">1.41M</div>
                    <div className="text-[10px] text-blue-600 mt-0.5">Batch source</div>
                  </div>
                </div>
                <div className="text-[10px] text-green-600 mt-1 text-center">&#8593; RF never sees eval</div>
              </div>
              {/* Right branch: validation + test */}
              <div className="flex flex-col items-center gap-1">
                <div className="border-2 border-violet-500 rounded-lg px-4 py-2.5 text-center">
                  <div className="font-semibold text-violet-700">validation + test</div>
                  <div className="text-xs text-gray-500">13.07M flows &middot; 7 attack types</div>
                </div>
                <div className="text-gray-400 mt-2">&#8593;</div>
                <div className="text-xs text-gray-500 text-center max-w-[160px] leading-relaxed bg-green-50 px-2.5 py-1.5 rounded-md border border-green-200">
                  These results are fully clean — RF never trained here
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clean vs Rerun labels */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="border border-green-200 rounded-lg px-4 py-3 bg-green-50">
            <div className="text-sm font-semibold text-green-800 mb-1">
              <span className="mr-1.5">&#x1F7E2;</span>CLEAN (no overlap)
            </div>
            <div className="text-xs text-green-800 leading-relaxed">
              Bot, Infilteration, SQL_Injection, Brute_Force-XSS, Brute_Force-Web, DDOS-HOIC, DDOS-LOIC-UDP
            </div>
          </div>
          <div className="border border-blue-300 rounded-lg px-4 py-3 bg-blue-50">
            <div className="text-sm font-semibold text-blue-800 mb-1">
              <span className="mr-1.5">&#x1F535;</span>RERUN (clean split applied)
            </div>
            <div className="text-xs text-blue-800 leading-relaxed">
              FTP-BruteForce, SSH-Bruteforce, DDoS-LOIC-HTTP, DoS-Hulk, DoS-SlowHTTPTest, DoS-GoldenEye, DoS-Slowloris
            </div>
          </div>
        </div>

        {/* Explanation paragraph */}
        <p className="text-sm text-gray-700 leading-relaxed m-0 text-justify">
          During evaluation we identified a within-split overlap in the Tier 1 pre-filter training data.
          The original RF was trained on development.csv and evaluated on batches also sourced from development.csv.
          To ensure methodological rigour, development data was sub-split 80/20 and the RF retrained on the training
          partition only. The 7 affected attack types were rerun with batches sourced exclusively from the 20% holdout
          the RF never saw. The remaining 7 attack types were always sourced from separate validation and test splits
          and required no rerun.
        </p>
      </div>
    </div>
  );
}
