import React from "react";

const ROADMAP_ITEMS = [
  {
    title: "Stage 1: All 14 Attack Types",
    desc: "Per-attack evaluation across all 14 CICIDS2018 attack types. 1000 flows each (50 attack + 950 benign) with Tier-1 RF pre-filtering + GPT-4o 6-agent pipeline. 12/14 types detected at 82%+ recall. Total cost: $27.35.",
    status: "Complete",
    statusColor: "#16a34a",
    icon: "\u2713",
  },
  {
    title: "MCP Comparison Experiment",
    desc: "Three single-agent configs tested: zero-shot (90% recall, 41% FPR), engineered prompt (67% recall, 27% FPR), + MITRE tool (70% recall, 30% FPR). AMATAS v2 achieves 88% F1 with 1.1% FPR.",
    status: "Complete",
    statusColor: "#16a34a",
    icon: "\u2713",
  },
  {
    title: "Infiltration Clustering (v3)",
    desc: "IP-level temporal clustering recovered Infiltration recall from 0% to 58%. Three conditions tested: enriched prompt only (0%), clustering only (52%), both combined (58%). Clustering overrides Tier 1 RF for suspicious DNS clusters, injecting aggregate context into LLM pipeline. Cost: $15.02 total.",
    status: "Complete",
    statusColor: "#16a34a",
    icon: "\u2713",
  },
  {
    title: "Test Set Final Evaluation",
    desc: "Run complete AMATAS v2/v3 pipeline on held-out test.csv (8.05M flows). Final thesis evaluation \u2014 no parameter tuning allowed.",
    status: "Planned",
    statusColor: "#6b7280",
    icon: "\u25CB",
  },
  {
    title: "Thesis Write-Up",
    desc: "Compile all experimental results. Key contributions: two-tier ML+LLM architecture, per-attack-type evaluation, explainable multi-agent reasoning, and the role of temporal context in NIDS. 8 weeks remaining.",
    status: "In Progress",
    statusColor: "#2563eb",
    icon: "\u25B6",
  },
];

export default function Roadmap({ thesisDrafts, selectedDraft, selectedDraftContent, loadDraft, closeDraft }) {
  return (
    <div>
      {/* What's Next */}
      <h2 className="text-xl font-bold mb-6 tracking-tight">What's Next</h2>
      <div className="flex flex-col gap-4 max-w-[700px] mb-12">
        {ROADMAP_ITEMS.map(item => (
          <div key={item.title} className="border border-gray-200 rounded-lg p-5">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold m-0">
                <span className="mr-2" style={{ color: item.statusColor }}>{item.icon}</span>
                {item.title}
              </h3>
              <span
                className="px-2.5 py-0.5 rounded text-[11px] font-medium"
                style={{
                  color: item.statusColor,
                  border: `1px solid ${item.statusColor}30`,
                  background: `${item.statusColor}08`,
                }}
              >
                {item.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed m-0">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Thesis Drafts */}
      <h2 className="text-xl font-bold mb-1 tracking-tight">Thesis Chapter Drafts</h2>
      <p className="text-sm text-gray-500 mb-6">
        Auto-generated academic prose from experiment results. Each draft covers one attack type evaluation.
      </p>

      {/* Empty state */}
      {thesisDrafts.length === 0 && !selectedDraftContent && (
        <div className="border border-gray-200 rounded-lg p-12 text-center text-gray-400">
          <p className="text-base mb-2">No thesis drafts generated yet</p>
          <p className="text-sm">
            Run{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">
              python scripts/generate_chapter_draft.py results/stage1/FTP-BruteForce_results.json
            </code>{" "}
            to generate the first draft.
          </p>
        </div>
      )}

      {/* Drafts table */}
      {thesisDrafts.length > 0 && !selectedDraftContent && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                {["Attack Type", "Words", "Generated", ""].map(h => (
                  <th
                    key={h}
                    className={`${h === "" ? "text-right" : "text-left"} px-4 py-3 font-semibold text-gray-500 text-xs border-b border-gray-200`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {thesisDrafts.map(d => (
                <tr
                  key={d.file}
                  className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                  onClick={() => loadDraft(d)}
                >
                  <td className="px-4 py-3 font-medium text-blue-600">{d.attack_type}</td>
                  <td className="px-4 py-3 text-gray-500">{d.words}</td>
                  <td className="px-4 py-3 text-gray-500">{d.generated}</td>
                  <td className="px-4 py-3 text-right text-blue-600 text-xs">View &#8594;</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Draft viewer */}
      {selectedDraftContent && (
        <div>
          {/* Back + actions bar */}
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={closeDraft}
              className="px-3.5 py-1.5 border border-gray-200 rounded-md bg-transparent cursor-pointer text-sm text-gray-700 hover:bg-gray-50"
            >
              &#8592; Back to list
            </button>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-400">
                {selectedDraftContent.split(/\s+/).length} words
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(selectedDraftContent)}
                className="px-3.5 py-1.5 border border-gray-200 rounded-md bg-transparent cursor-pointer text-xs text-gray-700 hover:bg-gray-50"
              >
                Copy
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([selectedDraftContent], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = selectedDraft?.file || "draft.md";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3.5 py-1.5 border border-blue-600 rounded-md bg-blue-600 cursor-pointer text-xs text-white font-medium hover:bg-blue-700"
              >
                Download .md
              </button>
            </div>
          </div>

          {/* Rendered markdown */}
          <div className="border border-gray-200 rounded-lg p-8 bg-gray-50/80 leading-[1.8] text-sm text-gray-700">
            {selectedDraftContent.split("\n").map((line, i) => {
              if (line.startsWith("#### "))
                return <h4 key={i} className="text-[15px] font-semibold text-gray-900 mt-6 mb-2">{line.replace("#### ", "")}</h4>;
              if (line.startsWith("### "))
                return <h3 key={i} className="text-lg font-bold text-gray-900 mb-3 tracking-tight">{line.replace("### ", "")}</h3>;
              if (line.trim() === "")
                return <div key={i} className="h-2" />;
              return <p key={i} className="m-0 mb-3 text-justify">{line}</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
