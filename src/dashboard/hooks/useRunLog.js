import { useState, useEffect } from "react";
import { RESULTS_BASE } from "../data/constants";

export default function useRunLog(active) {
  const [runLogText, setRunLogText] = useState(null);
  const [runLogLoading, setRunLogLoading] = useState(false);
  const [runLogSearch, setRunLogSearch] = useState("");

  useEffect(() => {
    if (!active || runLogText !== null) return;
    setRunLogLoading(true);
    fetch(`${RESULTS_BASE}/stage1/run_log.txt?t=${Date.now()}`)
      .then(r => r.ok ? r.text() : Promise.reject("Failed"))
      .then(t => { setRunLogText(t); setRunLogLoading(false); })
      .catch(() => { setRunLogText("ERROR: Could not load run_log.txt"); setRunLogLoading(false); });
  }, [active, runLogText]);

  return { runLogText, runLogLoading, runLogSearch, setRunLogSearch };
}
