import React, { useState, useCallback } from "react";

// Layout
import Shell from "./components/layout/Shell";

// Hooks
import useLiveStatus from "./hooks/useLiveStatus";
import useFlowInspector from "./hooks/useFlowInspector";
import useRunLog from "./hooks/useRunLog";
import useThesisDrafts from "./hooks/useThesisDrafts";

// Results pages
import Overview from "./components/results/Overview";
import ExperimentTimeline from "./components/results/ExperimentTimeline";
import Stage1Results from "./components/results/Stage1Results";
import ClusteringResults from "./components/results/ClusteringResults";
import FlowInspector from "./components/results/FlowInspector";
import ExperimentDetail from "./components/results/ExperimentDetail";

import { STAGE1_ID_MAP } from "./data/constants";

// System pages
import Architecture from "./components/system/Architecture";
import Pipeline from "./components/system/Pipeline";
import RunLog from "./components/system/RunLog";

// Comparison pages
import AllExperiments from "./components/comparison/AllExperiments";
import MCPAblation from "./components/comparison/MCPAblation";

// Roadmap
import Roadmap from "./components/roadmap/Roadmap";

// Sub-tab definitions per top tab
const SUB_TABS = {
  results: [
    ["overview", "Overview"],
    ["story", "Experiments"],
    ["stage1", "Stage 1"],
    ["clustering", "Clustering"],
    ["inspector", "Flow Inspector"],
  ],
  system: [
    ["architecture", "Architecture"],
    ["pipeline", "Pipeline"],
    ["runlog", "Run Log"],
  ],
  comparison: [
    ["all", "All Experiments"],
    ["mcp", "MCP Ablation"],
  ],
  roadmap: [],
};

const TOP_TABS = [
  ["results", "Results"],
  ["system", "System"],
  ["comparison", "Comparison"],
  ["roadmap", "Roadmap"],
];

export default function App() {
  // Navigation
  const [topTab, setTopTab] = useState("results");
  const [subTabs, setSubTabs] = useState({
    results: "overview",
    system: "architecture",
    comparison: "all",
    roadmap: "",
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

  // Thesis drafts
  const thesisDrafts = useThesisDrafts(topTab === "roadmap");

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

  // Open flow inspector — navigates to the inspector sub-tab
  const openInspector = useCallback((expId) => {
    inspector.setInspectorSource(expId);
    inspector.loadInspectorData(expId);
    setTopTab("results");
    setSubTabs(prev => ({ ...prev, results: "inspector" }));
  }, [inspector]);

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
      {/* -- Results -------------------------------------------------- */}
      {topTab === "results" && subTab === "overview" && (
        <Overview s1={s1} />
      )}
      {topTab === "results" && subTab === "story" && (
        <ExperimentTimeline onInspectFlows={openInspector} />
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
      {topTab === "results" && subTab === "clustering" && (
        <ClusteringResults onInspectFlows={openInspector} />
      )}
      {topTab === "results" && subTab === "inspector" && (
        <FlowInspector inspector={inspector} />
      )}

      {/* -- System --------------------------------------------------- */}
      {topTab === "system" && subTab === "architecture" && (
        <Architecture />
      )}
      {topTab === "system" && subTab === "pipeline" && (
        <Pipeline />
      )}
      {topTab === "system" && subTab === "runlog" && (
        <RunLog
          runLogText={runLogText}
          runLogLoading={runLogLoading}
          runLogSearch={runLogSearch}
          setRunLogSearch={setRunLogSearch}
        />
      )}

      {/* -- Comparison ----------------------------------------------- */}
      {topTab === "comparison" && subTab === "all" && (
        <AllExperiments onInspectFlows={openInspector} />
      )}
      {topTab === "comparison" && subTab === "mcp" && (
        <MCPAblation s1={s1} />
      )}

      {/* -- Roadmap -------------------------------------------------- */}
      {topTab === "roadmap" && (
        <Roadmap {...thesisDrafts} />
      )}
    </Shell>
  );
}
