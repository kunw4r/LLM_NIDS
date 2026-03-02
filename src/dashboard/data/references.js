// Literature references for academic citations throughout the dashboard
export const REFERENCES = {
  Breiman2001: {
    short: "Breiman (2001)",
    title: "Random Forests",
    venue: "Machine Learning, 45(1), 5\u201332",
    note: "Foundation for the Tier 1 Random Forest pre-filter.",
  },
  Sharafaldin2018: {
    short: "Sharafaldin et al. (2018)",
    title: "Toward Generating a New Intrusion Detection Dataset and Intrusion Traffic Characterization",
    venue: "ICISSP 2018",
    note: "The CICIDS2018 dataset used in this thesis.",
  },
  Minsky1986: {
    short: "Minsky (1986)",
    title: "The Society of Mind",
    venue: "Simon & Schuster",
    note: "Theoretical foundation for multi-agent specialist architecture.",
  },
  Sunstein2002: {
    short: "Sunstein (2002)",
    title: "The Law of Group Polarization",
    venue: "Journal of Political Philosophy, 10(2), 175\u2013195",
    note: "Motivates the Devil's Advocate for adversarial deliberation.",
  },
  Wei2022: {
    short: "Wei et al. (2022)",
    title: "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models",
    venue: "NeurIPS 2022",
    note: "Basis for requiring full reasoning chains from each agent.",
  },
  Sarhan2021: {
    short: "Sarhan et al. (2021)",
    title: "NetFlow Datasets for Machine Learning-Based Network Intrusion Detection Systems",
    venue: "Expert Systems with Applications",
    note: "NetFlow v3 feature engineering reference.",
  },
  Yao2023: {
    short: "Yao et al. (2023)",
    title: "Tree of Thoughts: Deliberate Problem Solving with Large Language Models",
    venue: "NeurIPS 2023",
    note: "Parallel specialist deliberation shares this structured reasoning approach.",
  },
};

// Inline citation component helper
export function cite(key) {
  const ref = REFERENCES[key];
  return ref ? `[${ref.short}]` : `[${key}]`;
}
