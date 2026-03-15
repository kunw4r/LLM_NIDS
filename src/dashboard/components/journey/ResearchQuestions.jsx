import React from "react";
import { RESEARCH_QUESTIONS } from "../../data/researchQuestions";

export default function ResearchQuestions({ onNavigateToTab }) {
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-2">Research Questions</h2>
        <p className="text-sm text-gray-500 leading-relaxed max-w-3xl">
          Four research questions guide the AMATAS thesis. Each is answered with quantitative evidence from the Stage 1 evaluation,
          MCP comparison study, faithfulness audit, and ablation experiments.
        </p>
      </div>

      {RESEARCH_QUESTIONS.map((rq) => (
        <div key={rq.id} className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${rq.verdictColor}15`, color: rq.verdictColor }}>
                {rq.id}
              </span>
              <span className="text-xs font-semibold text-gray-500">{rq.shortLabel}</span>
            </div>
            <h3 className="text-sm font-bold text-gray-900 leading-snug">{rq.question}</h3>
          </div>

          {/* Verdict */}
          <div className="px-6 py-3 border-b border-gray-100" style={{ background: `${rq.verdictColor}08` }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">Verdict:</span>
              <span className="text-sm font-bold" style={{ color: rq.verdictColor }}>{rq.verdict}</span>
            </div>
          </div>

          {/* Answer */}
          <div className="px-6 py-4">
            <p className="text-sm text-gray-700 leading-relaxed mb-4">{rq.answer}</p>

            {/* Evidence cards */}
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Supporting Evidence</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {rq.evidence.map((ev, i) => (
                <button
                  key={i}
                  onClick={() => onNavigateToTab && onNavigateToTab(ev.linkTab)}
                  className="text-left border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors cursor-pointer bg-white"
                >
                  <div className="text-lg font-bold text-gray-900">{ev.metric}</div>
                  <div className="text-[11px] font-semibold text-gray-700 mt-0.5">{ev.title}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{ev.detail}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
