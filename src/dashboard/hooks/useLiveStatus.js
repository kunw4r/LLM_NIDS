import { useState, useEffect, useRef } from "react";
import { RESULTS_BASE } from "../data/constants";
import { STAGE1_SUMMARY } from "../data/stage1";

/**
 * Fetches live experiment status from GitHub (or local backend).
 *
 * Performance: All network fetches run in parallel and never block
 * initial render — the hardcoded STAGE1_SUMMARY is returned immediately.
 */
export default function useLiveStatus() {
  const [liveStatus, setLiveStatus] = useState(null);
  const [liveSummary, setLiveSummary] = useState(null);
  const [leakySummary, setLeakySummary] = useState(null);
  const [newResultNotif, setNewResultNotif] = useState(null);
  const leakyFetched = useRef(false);

  useEffect(() => {
    let timer;
    const poll = async () => {
      // Try localhost backend first (fast fail — 1.5s timeout, non-blocking)
      const localPromise = fetchLocal();

      // Fetch all GitHub files in parallel (don't wait for localhost)
      const [statusData, summData, leakyData] = await Promise.all([
        localPromise.then(d => d).catch(() =>
          fetchJSON(`${RESULTS_BASE}/stage1/live_status.json?t=${Date.now()}`)
        ),
        fetchJSON(`${RESULTS_BASE}/stage1/running_summary.json?t=${Date.now()}`),
        leakyFetched.current ? Promise.resolve(null) :
          fetchJSON(`${RESULTS_BASE}/stage1/running_summary_leaky.json?t=${Date.now()}`),
      ]);

      // Process live status
      if (statusData) {
        const data = statusData.status ? statusData : statusData;
        if (data.status === "running" || data.status === "paused" || data.status === "creating_batch") {
          setLiveStatus(data);
        } else if (data.status === "complete" || data.status === "all_done") {
          const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
          setLiveStatus(Date.now() - updatedAt < 10 * 60 * 1000 ? data : null);
        } else {
          setLiveStatus(null);
        }
      } else {
        setLiveStatus(null);
      }

      // Process running summary
      if (summData?.experiments) {
        setLiveSummary(prev => {
          if (prev?.experiments && summData.experiments) {
            const prevTypes = new Set(prev.experiments.map(e => e.attack_type));
            const added = summData.experiments.filter(e => !prevTypes.has(e.attack_type));
            if (added.length > 0) {
              const last = added[added.length - 1];
              setNewResultNotif(`New result: ${last.attack_type} — ${last.recall}% recall`);
              setTimeout(() => setNewResultNotif(null), 5000);
            }
          }
          return summData;
        });
      }

      // Process leaky summary (only fetch once)
      if (leakyData && !leakyFetched.current) {
        leakyFetched.current = true;
        setLeakySummary(leakyData);
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

/** Try localhost backend with a short timeout */
async function fetchLocal() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const resp = await fetch("http://localhost:5001/api/status", { signal: controller.signal });
    clearTimeout(timeout);
    if (resp.ok) {
      const raw = await resp.json();
      return raw.status || raw;
    }
  } catch (_) {
    clearTimeout(timeout);
  }
  return null;
}

/** Fetch JSON with silent failure */
async function fetchJSON(url) {
  try {
    const resp = await fetch(url);
    if (resp.ok) return resp.json();
  } catch (_) {}
  return null;
}
