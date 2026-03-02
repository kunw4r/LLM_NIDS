import { useState, useEffect } from "react";
import { RESULTS_BASE } from "../data/constants";
import { STAGE1_SUMMARY } from "../data/stage1";

export default function useLiveStatus() {
  const [liveStatus, setLiveStatus] = useState(null);
  const [liveSummary, setLiveSummary] = useState(null);
  const [leakySummary, setLeakySummary] = useState(null);
  const [newResultNotif, setNewResultNotif] = useState(null);

  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        let data;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const resp = await fetch("http://localhost:5001/api/status", { signal: controller.signal });
          clearTimeout(timeout);
          if (resp.ok) {
            const raw = await resp.json();
            data = raw.status || raw;
          }
        } catch (_) {
          const resp2 = await fetch(`${RESULTS_BASE}/stage1/live_status.json?t=${Date.now()}`);
          if (resp2.ok) data = await resp2.json();
        }
        if (data && (data.status === "running" || data.status === "paused" || data.status === "creating_batch")) {
          setLiveStatus(data);
        } else if (data && (data.status === "complete" || data.status === "all_done")) {
          const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
          if (Date.now() - updatedAt < 10 * 60 * 1000) {
            setLiveStatus(data);
          } else {
            setLiveStatus(null);
          }
        } else {
          setLiveStatus(null);
        }
        try {
          const summResp = await fetch(`${RESULTS_BASE}/stage1/running_summary.json?t=${Date.now()}`);
          if (summResp.ok) {
            const newSumm = await summResp.json();
            setLiveSummary(prev => {
              if (prev && newSumm.experiments && prev.experiments) {
                const prevTypes = new Set(prev.experiments.map(e => e.attack_type));
                const added = newSumm.experiments.filter(e => !prevTypes.has(e.attack_type));
                if (added.length > 0) {
                  const last = added[added.length - 1];
                  setNewResultNotif(`New result: ${last.attack_type} — ${last.recall}% recall`);
                  setTimeout(() => setNewResultNotif(null), 5000);
                }
              }
              return newSumm;
            });
          }
        } catch (_) {}
        if (!leakySummary) {
          try {
            const leakyResp = await fetch(`${RESULTS_BASE}/stage1/running_summary_leaky.json?t=${Date.now()}`);
            if (leakyResp.ok) setLeakySummary(await leakyResp.json());
          } catch (_) {}
        }
      } catch (_) {
        setLiveStatus(null);
      }
    };
    poll();
    timer = setInterval(poll, 15000);
    return () => clearInterval(timer);
  }, []);

  // Merge hardcoded STAGE1_SUMMARY with live data
  const s1 = (() => {
    const base = STAGE1_SUMMARY;
    if (!liveSummary?.experiments?.length) return base;
    const merged = liveSummary.experiments.length >= base.experiments.length ? liveSummary : base;
    const exps = merged.experiments || [];
    const totalFlows = exps.length * 1000;
    const totalCost = exps.reduce((s, e) => s + (e.cost || 0), 0);
    const bestExp = exps.reduce((best, e) => (e.f1 || 0) > (best.f1 || 0) ? e : best, exps[0] || {});
    const avgFpr = exps.length > 0 ? exps.reduce((s, e) => s + (e.fpr || 0), 0) / exps.length : 0;
    return {
      experiments: exps,
      overall: {
        best_f1: bestExp?.f1 || 0,
        best_detected: bestExp?.attack_type || "",
        total_flows: totalFlows,
        total_cost: totalCost,
        avg_fpr: avgFpr,
      },
    };
  })();

  return { liveStatus, liveSummary, leakySummary, newResultNotif, s1 };
}
