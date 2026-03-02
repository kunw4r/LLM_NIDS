import { useState, useCallback, useRef } from "react";
import { RESULTS_BASE, INSPECTOR_FILE_MAP, FLOWS_PER_PAGE } from "../data/constants";

// In-memory cache: avoids re-fetching 2MB files when navigating back and forth
const dataCache = new Map();

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
    setSelectedFlowIdx(null);
    setInspectorPage(0);
    setInspectorFilter("all");
    setSearchQuery("");

    // Return cached data instantly if available
    if (dataCache.has(sourceId)) {
      setInspectorData(dataCache.get(sourceId));
      setInspectorError(null);
      setLastFetched(new Date());
      return;
    }

    setInspectorLoading(true);
    setInspectorError(null);
    setInspectorData(null);
    const path = INSPECTOR_FILE_MAP[sourceId];
    if (!path) { setInspectorError("No flow data available for this experiment"); setInspectorLoading(false); return; }
    try {
      // Use 5-min cache window instead of per-request busting
      const cacheBuster = Math.floor(Date.now() / 300000);
      const url = `${RESULTS_BASE.replace("/results", "")}${path}?t=${cacheBuster}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      dataCache.set(sourceId, data);
      setInspectorData(data);
      setLastFetched(new Date());
    } catch (err) {
      setInspectorError(err.message);
      try {
        const resp2 = await fetch("." + path);
        if (resp2.ok) {
          const data = await resp2.json();
          dataCache.set(sourceId, data);
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

  // Single-pass pie counts instead of 4x .filter()
  const pieCounts = (() => {
    const c = { malicious: 0, suspicious: 0, benign: 0, filtered: 0 };
    for (const f of inspectorFlows) {
      if (f.tier1_filtered) { c.filtered++; continue; }
      const v = (f.verdict || "").toUpperCase();
      if (v === "MALICIOUS") c.malicious++;
      else if (v === "SUSPICIOUS") c.suspicious++;
      else if (v === "BENIGN") c.benign++;
    }
    return c;
  })();

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
