// Ablation study results — populated after experiments complete
// Updated by: scripts/ablation_study.py → results/ablation/ablation_summary.json

export const ABLATION_CONDITIONS = [
  { id: "full_amatas", label: "Full AMATAS (6 agents)", disabled: [], color: "#10b981" },
  { id: "no_devils_advocate", label: "No Devil's Advocate", disabled: ["devils_advocate"], color: "#ef4444" },
  { id: "no_temporal", label: "No Temporal Agent", disabled: ["temporal"], color: "#ec4899" },
  { id: "no_statistical", label: "No Statistical Agent", disabled: ["statistical"], color: "#8b5cf6" },
  { id: "four_agent", label: "4-Agent (no DA + Temporal)", disabled: ["devils_advocate", "temporal"], color: "#f59e0b" },
  { id: "two_agent", label: "2-Agent (Protocol + Orch)", disabled: ["statistical", "behavioural", "temporal", "devils_advocate"], color: "#6b7280" },
];

// Will be filled from ablation_summary.json after experiments complete
// Placeholder structure — real values injected at build or runtime
export const ABLATION_RESULTS = {
  ftp: {},
  ssh: {},
};

// Random filter control results
export const CONTROL_CONDITIONS = [
  { id: "trained_rf", label: "Trained RF (7%)", color: "#10b981" },
  { id: "random_7pct", label: "Random filter (7%)", color: "#ef4444" },
  { id: "random_50pct", label: "Random filter (50%)", color: "#f59e0b" },
];

export const CONTROL_RESULTS = {};
