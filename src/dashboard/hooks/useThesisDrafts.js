import { useState, useEffect } from "react";
import { RESULTS_BASE } from "../data/constants";

export default function useThesisDrafts(active) {
  const [thesisDrafts, setThesisDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState(null);
  const [selectedDraftContent, setSelectedDraftContent] = useState(null);

  useEffect(() => {
    if (!active || thesisDrafts.length > 0) return;
    const fetchIndex = async () => {
      try {
        const resp = await fetch(`${RESULTS_BASE.replace("/results", "")}/results/thesis_drafts/INDEX.md?t=${Date.now()}`);
        if (!resp.ok) return;
        const text = await resp.text();
        const rows = text.split("\n").filter(l => l.startsWith("|") && !l.includes("---") && !l.includes("Attack Type"));
        const drafts = rows.map(row => {
          const cols = row.split("|").map(c => c.trim()).filter(Boolean);
          if (cols.length < 4) return null;
          const fileMatch = cols[1].match(/\[(.+?)\]\((.+?)\)/);
          return { attack_type: cols[0], file: fileMatch?.[2] || cols[1], words: parseInt(cols[2]) || 0, generated: cols[3] };
        }).filter(Boolean);
        if (drafts.length > 0) setThesisDrafts(drafts);
      } catch (_) {}
    };
    fetchIndex();
  }, [active, thesisDrafts.length]);

  const loadDraft = async (draft) => {
    setSelectedDraft(draft);
    try {
      const resp = await fetch(`${RESULTS_BASE.replace("/results", "")}/results/thesis_drafts/${draft.file}?t=${Date.now()}`);
      if (resp.ok) setSelectedDraftContent(await resp.text());
      else setSelectedDraftContent("Failed to load draft.");
    } catch (_) { setSelectedDraftContent("Failed to load draft."); }
  };

  const closeDraft = () => { setSelectedDraftContent(null); setSelectedDraft(null); };

  return { thesisDrafts, selectedDraft, selectedDraftContent, loadDraft, closeDraft };
}
