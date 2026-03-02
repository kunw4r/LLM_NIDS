import { useState, useCallback } from "react";
import { RESULTS_BASE, INSPECTOR_FILE_MAP, FLOWS_PER_PAGE } from "../data/constants";

export default function useFlowInspector() {
  const [inspectorData, setInspectorData] = useState(null);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [inspectorError, setInspectorError] = useState(null);
  const [inspectorFilter, setInspectorFilter] = useState("all");
  const [selectedFlowIdx, setSelectedFlowIdx] = useState(null);
  const [inspectorPage, setInspectorPage] = useState(0);
  const [inspectorSource, setInspectorSource] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastFetched, setLastFetched] = useState(null);
  const [expandedPrompts, setExpandedPrompts] = useState({});

  const loadInspectorData = useCallback(async (sourceId) => {
    setInspectorLoading(true);
    setInspectorError(null);
    setSelectedFlowIdx(null);
    setInspectorPage(0);
    setInspectorFilter("all");
    setSearchQuery("");
    const path = INSPECTOR_FILE_MAP[sourceId];
    if (!path) { setInspectorError("No flow data available for this experiment"); setInspectorLoading(false); return; }
    try {
      const url = `${RESULTS_BASE.replace("/results", "")}${path}?t=${Date.now()}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setInspectorData(data);
      setLastFetched(new Date());
    } catch (err) {
      setInspectorError(err.message);
      try {
        const resp2 = await fetch("." + path);
        if (resp2.ok) {
          const data = await resp2.json();
          setInspectorData(data);
          setInspectorError(null);
          setLastFetched(new Date());
        }
      } catch (_) {}
    }
    setInspectorLoading(false);
  }, []);

  const inspectorFlows = inspectorData?.results || [];
  const filteredFlows = inspectorFlows.filter(f => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!String(f.flow_idx).includes(q) && !(f.verdict || "").toLowerCase().includes(q) && !(f.attack_type_actual || "").toLowerCase().includes(q)) return false;
    }
    if (inspectorFilter === "all") return true;
    if (inspectorFilter === "correct") { const actual = f.label_actual; const predicted = f.verdict?.toUpperCase() === "BENIGN" ? 0 : 1; return actual === predicted; }
    if (inspectorFilter === "wrong") { const actual = f.label_actual; const predicted = f.verdict?.toUpperCase() === "BENIGN" ? 0 : 1; return actual !== predicted; }
    if (inspectorFilter === "filtered") return f.tier1_filtered === true;
    if (inspectorFilter === "attacks") return f.label_actual === 1;
    if (inspectorFilter === "benign_actual") return f.label_actual === 0;
    if (inspectorFilter === "malicious") return f.verdict?.toUpperCase() === "MALICIOUS";
    if (inspectorFilter === "suspicious") return f.verdict?.toUpperCase() === "SUSPICIOUS";
    if (inspectorFilter === "benign") return f.verdict?.toUpperCase() === "BENIGN";
    return true;
  });

  const selectedFlow = selectedFlowIdx != null ? inspectorFlows.find(f => f.flow_idx === selectedFlowIdx) : null;

  const pieCounts = {
    malicious: inspectorFlows.filter(f => f.verdict?.toUpperCase() === "MALICIOUS").length,
    suspicious: inspectorFlows.filter(f => f.verdict?.toUpperCase() === "SUSPICIOUS").length,
    benign: inspectorFlows.filter(f => f.verdict?.toUpperCase() === "BENIGN").length,
    filtered: inspectorFlows.filter(f => f.tier1_filtered).length,
  };

  return {
    inspectorData, inspectorLoading, inspectorError,
    inspectorFilter, setInspectorFilter,
    selectedFlowIdx, setSelectedFlowIdx,
    inspectorPage, setInspectorPage,
    inspectorSource, setInspectorSource,
    searchQuery, setSearchQuery,
    lastFetched,
    expandedPrompts, setExpandedPrompts,
    loadInspectorData,
    inspectorFlows, filteredFlows, selectedFlow, pieCounts,
    FLOWS_PER_PAGE,
  };
}
