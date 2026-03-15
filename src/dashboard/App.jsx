import React, { useState, useCallback } from "react";

// Layout
import Shell from "./components/layout/Shell";

// Hooks
import useLiveStatus from "./hooks/useLiveStatus";
import useFlowInspector from "./hooks/useFlowInspector";
import useRunLog from "./hooks/useRunLog";

// Story
import ResearchJourney from "./components/journey/ResearchJourney";

// Research Questions
import ResearchQuestions from "./components/journey/ResearchQuestions";

// Results pages
import Overview from "./components/results/Overview";
import Stage1Results from "./components/results/Stage1Results";
import ClusteringResults from "./components/results/ClusteringResults";
import ExperimentDetail from "./components/results/ExperimentDetail";
import MCPAblation from "./components/comparison/MCPAblation";
import AblationStudy from "./components/results/AblationStudy";

import { STAGE1_ID_MAP } from "./data/constants";

// Explainability
import SHAPComparison from "./components/explainability/SHAPComparison";
import FaithfulnessAudit from "./components/explainability/FaithfulnessAudit";

// System pages
import Architecture from "./components/system/Architecture";
import Pipeline from "./components/system/Pipeline";
import AgentDocs from "./components/system/AgentDocs";
import RunLog from "./components/system/RunLog";

// Sub-tab definitions per top tab
const SUB_TABS = {
  story: [],
  questions: [],
  results: [
    ["overview", "Overview"],
    ["stage1", "Stage 1"],
    ["ablation", "Ablation"],
    ["clustering", "Clustering"],
    ["mcp", "MCP Comparison"],
  ],
  explainability: [
    ["shap", "SHAP Comparison"],
    ["faithfulness", "Faithfulness Audit"],
  ],
  system: [
    ["architecture", "Architecture"],
    ["pipeline", "Pipeline"],
    ["agents", "Agents"],
    ["runlog", "Run Log"],
  ],
};

const TOP_TABS = [
  ["story", "Story"],
  ["questions", "Research Questions"],
  ["results", "Results"],
  ["explainability", "Explainability"],
  ["system", "System"],
];

export default function App() {
  // Navigation
  const [topTab, setTopTab] = useState("story");
  const [subTabs, setSubTabs] = useState({
    story: "",
    questions: "",
    results: "overview",
    explainability: "shap",
    system: "architecture",
  });

  // Experiment detail page state
  const [detailAttackType, setDetailAttackType] = useState(null);

  const subTab = subTabs[topTab] || "";
  const setSubTab = (val) => {
    setSubTabs(prev => ({ ...prev, [topTab]: val }));
    setDetailAttackType(null);
  };

  // Live status
  const { liveStatus, liveSummary, leakySummary, newResultNotif, s1 } = useLiveStatus();
  const [livePanelOpen, setLivePanelOpen] = useState(false);

  // Flow inspector (now full-page, not drawer)
  const inspector = useFlowInspector();

  // Run log
  const { runLogText, runLogLoading, runLogSearch, setRunLogSearch } = useRunLog(
    topTab === "system" && subTabs.system === "runlog"
  );

  // Stage 1 state
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  // Open experiment detail page for a Stage 1 attack type
  const openDetailPage = useCallback((attackType) => {
    const expId = STAGE1_ID_MAP[attackType];
    if (expId) {
      inspector.setInspectorSource(expId);
      inspector.loadInspectorData(expId);
    }
    setDetailAttackType(attackType);
    setTopTab("results");
    setSubTabs(prev => ({ ...prev, results: "stage1" }));
  }, [inspector]);

  // Close detail page — back to Stage 1 table
  const closeDetailPage = useCallback(() => {
    setDetailAttackType(null);
  }, []);

  // Open flow inspector — navigates to the Stage 1 detail page
  const openInspector = useCallback((expId) => {
    inspector.setInspectorSource(expId);
    inspector.loadInspectorData(expId);
  }, [inspector]);

  // Navigate to Results > Stage 1
  const navigateToResults = useCallback(() => {
    setTopTab("results");
    setSubTabs(prev => ({ ...prev, results: "stage1" }));
  }, []);

  // Navigate to a specific results sub-tab (used by Research Questions evidence links)
  const navigateToSubTab = useCallback((tab) => {
    // Map evidence linkTab values to actual navigation
    const tabMap = {
      overview: () => { setTopTab("results"); setSubTabs(prev => ({ ...prev, results: "overview" })); },
      stage1: () => { setTopTab("results"); setSubTabs(prev => ({ ...prev, results: "stage1" })); },
      ablation: () => { setTopTab("results"); setSubTabs(prev => ({ ...prev, results: "ablation" })); },
      clustering: () => { setTopTab("results"); setSubTabs(prev => ({ ...prev, results: "clustering" })); },
      mcp: () => { setTopTab("results"); setSubTabs(prev => ({ ...prev, results: "mcp" })); },
      shap: () => { setTopTab("explainability"); setSubTabs(prev => ({ ...prev, explainability: "shap" })); },
      faithfulness: () => { setTopTab("explainability"); setSubTabs(prev => ({ ...prev, explainability: "faithfulness" })); },
    };
    const fn = tabMap[tab];
    if (fn) fn();
  }, []);

  return (
    <Shell
      topTab={topTab}
      setTopTab={setTopTab}
      topTabs={TOP_TABS}
      subTab={subTab}
      setSubTab={setSubTab}
      subTabs={SUB_TABS[topTab] || []}
      liveStatus={liveStatus}
      liveSummary={liveSummary}
      livePanelOpen={livePanelOpen}
      setLivePanelOpen={setLivePanelOpen}
      newResultNotif={newResultNotif}
      lastFetched={inspector.lastFetched}
    >
      {/* -- Story ------------------------------------------------- */}
      {topTab === "story" && (
        <ResearchJourney
          onNavigateToDetail={openDetailPage}
          onNavigateToResults={navigateToResults}
        />
      )}

      {/* -- Research Questions ------------------------------------ */}
      {topTab === "questions" && (
        <ResearchQuestions onNavigateToTab={navigateToSubTab} />
      )}

      {/* -- Results ------------------------------------------------ */}
      {topTab === "results" && subTab === "overview" && (
        <Overview
          s1={s1}
          onNavigateToJourney={() => setTopTab("story")}
          onNavigateToTab={navigateToSubTab}
        />
      )}
      {topTab === "results" && subTab === "stage1" && !detailAttackType && (
        <Stage1Results
          s1={s1}
          leakySummary={leakySummary}
          liveStatus={liveStatus}
          onInspectFlows={openInspector}
          onOpenDetail={openDetailPage}
          showCostBreakdown={showCostBreakdown}
          setShowCostBreakdown={setShowCostBreakdown}
        />
      )}
      {topTab === "results" && subTab === "stage1" && detailAttackType && (
        <ExperimentDetail
          attackType={detailAttackType}
          inspector={inspector}
          onBack={closeDetailPage}
        />
      )}
      {topTab === "results" && subTab === "ablation" && (
        <AblationStudy />
      )}
      {topTab === "results" && subTab === "clustering" && (
        <ClusteringResults onInspectFlows={openInspector} />
      )}
      {topTab === "results" && subTab === "mcp" && (
        <MCPAblation s1={s1} onInspectFlows={openInspector} />
      )}

      {/* -- Explainability ---------------------------------------- */}
      {topTab === "explainability" && subTab === "shap" && (
        <SHAPComparison />
      )}
      {topTab === "explainability" && subTab === "faithfulness" && (
        <FaithfulnessAudit />
      )}

      {/* -- System ------------------------------------------------- */}
      {topTab === "system" && subTab === "architecture" && (
        <Architecture />
      )}
      {topTab === "system" && subTab === "pipeline" && (
        <Pipeline />
      )}
      {topTab === "system" && subTab === "agents" && (
        <AgentDocs />
      )}
      {topTab === "system" && subTab === "runlog" && (
        <RunLog
          runLogText={runLogText}
          runLogLoading={runLogLoading}
          runLogSearch={runLogSearch}
          setRunLogSearch={setRunLogSearch}
        />
      )}
    </Shell>
  );
}
