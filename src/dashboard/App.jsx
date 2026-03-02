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

// System pages
import Architecture from "./components/system/Architecture";
import Pipeline from "./components/system/Pipeline";
import RunLog from "./components/system/RunLog";

// Comparison pages
import AllExperiments from "./components/comparison/AllExperiments";
import MCPAblation from "./components/comparison/MCPAblation";

// Inspector
import FlowInspectorDrawer from "./components/inspector/FlowInspectorDrawer";

// Roadmap
import Roadmap from "./components/roadmap/Roadmap";

// Sub-tab definitions per top tab
const SUB_TABS = {
  results: [
    ["overview", "Overview"],
    ["story", "Experiments"],
    ["stage1", "Stage 1"],
    ["clustering", "Clustering"],
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

  const subTab = subTabs[topTab] || "";
  const setSubTab = (val) => setSubTabs(prev => ({ ...prev, [topTab]: val }));

  // Live status
  const { liveStatus, liveSummary, leakySummary, newResultNotif, s1 } = useLiveStatus();
  const [livePanelOpen, setLivePanelOpen] = useState(false);

  // Flow inspector (drawer)
  const inspector = useFlowInspector();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Run log
  const { runLogText, runLogLoading, runLogSearch, setRunLogSearch } = useRunLog(
    topTab === "system" && subTabs.system === "runlog"
  );

  // Thesis drafts
  const thesisDrafts = useThesisDrafts(topTab === "roadmap");

  // Stage 1 state
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  // Open flow inspector drawer
  const openInspector = useCallback((expId) => {
    inspector.setInspectorSource(expId);
    inspector.loadInspectorData(expId);
    setDrawerOpen(true);
  }, [inspector]);

  return (
    <>
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
        {/* ── Results ──────────────────────────────────────────── */}
        {topTab === "results" && subTab === "overview" && (
          <Overview s1={s1} />
        )}
        {topTab === "results" && subTab === "story" && (
          <ExperimentTimeline onInspectFlows={openInspector} />
        )}
        {topTab === "results" && subTab === "stage1" && (
          <Stage1Results
            s1={s1}
            leakySummary={leakySummary}
            liveStatus={liveStatus}
            onInspectFlows={openInspector}
            showCostBreakdown={showCostBreakdown}
            setShowCostBreakdown={setShowCostBreakdown}
          />
        )}
        {topTab === "results" && subTab === "clustering" && (
          <ClusteringResults onInspectFlows={openInspector} />
        )}

        {/* ── System ──────────────────────────────────────────── */}
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

        {/* ── Comparison ──────────────────────────────────────── */}
        {topTab === "comparison" && subTab === "all" && (
          <AllExperiments onInspectFlows={openInspector} />
        )}
        {topTab === "comparison" && subTab === "mcp" && (
          <MCPAblation s1={s1} />
        )}

        {/* ── Roadmap ─────────────────────────────────────────── */}
        {topTab === "roadmap" && (
          <Roadmap {...thesisDrafts} />
        )}
      </Shell>

      {/* Flow Inspector Drawer */}
      <FlowInspectorDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        inspector={inspector}
      />
    </>
  );
}
