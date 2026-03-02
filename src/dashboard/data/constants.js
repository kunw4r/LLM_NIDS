// GitHub raw base URL for result files
export const RESULTS_BASE = "https://raw.githubusercontent.com/kunw4r/LLM_NIDS/main/results";

export const FLOWS_PER_PAGE = 50;

// Dataset split metadata (from inventory.json)
export const DATASET_SPLITS = {
  development: {
    label: "Development", flows: 7040435, pct: 35,
    badge: "RF TRAINING DATA",
    attacks: {
      "FTP-BruteForce": 386720, "SSH-Bruteforce": 188474,
      "DDoS_attacks-LOIC-HTTP": 288589, "DoS_attacks-Hulk": 100076,
      "DoS_attacks-SlowHTTPTest": 105550, "DoS_attacks-GoldenEye": 61300,
      "DoS_attacks-Slowloris": 36040,
    },
  },
  validation: {
    label: "Validation", flows: 5028882, pct: 25,
    attacks: {
      "DDOS_attack-HOIC": 1032311, "DDOS_attack-LOIC-UDP": 3450,
      "Brute_Force_-Web": 1483, "Brute_Force_-XSS": 19, "SQL_Injection": 440,
    },
  },
  test: {
    label: "Test", flows: 8046212, pct: 40,
    attacks: {
      "Bot": 207703, "Infilteration": 188152,
      "Brute_Force_-Web": 135, "Brute_Force_-XSS": 461,
    },
  },
};

// Attack types in dev split → RF trained on these
export const RF_TRAINED_TYPES = new Set([
  "FTP-BruteForce", "SSH-Bruteforce", "DDoS_attacks-LOIC-HTTP",
  "DoS_attacks-Hulk", "DoS_attacks-SlowHTTPTest", "DoS_attacks-GoldenEye",
  "DoS_attacks-Slowloris",
]);

// Attack types RF catches despite not being in training
export const RF_CAUGHT_UNSEEN = new Set(["DDOS_attack-HOIC", "DDOS_attack-LOIC-UDP"]);

// Attack types NOT in dev split → fully clean evaluation
export const CLEAN_ATTACK_TYPES = new Set([
  "Bot", "Infilteration", "SQL_Injection", "Brute_Force_-Web", "Brute_Force_-XSS",
]);

export const rfPillColor = (at) => {
  if (RF_TRAINED_TYPES.has(at)) return { bg: "#dcfce7", color: "#166534", label: "In training" };
  if (RF_CAUGHT_UNSEEN.has(at)) return { bg: "#fef3c7", color: "#92400e", label: "Caught unseen" };
  return { bg: "#fee2e2", color: "#991b1b", label: "RF misses" };
};

export const AGENT_KEYS = ["protocol", "statistical", "behavioural", "temporal", "devils_advocate", "orchestrator"];

// File map for flow inspector
export const INSPECTOR_FILE_MAP = {
  baseline: "/results/final_mcp_evaluation_raw.json",
  iter_1: "/results/phase2_iter1_results.json",
  phase3a: "/results/phase3a_mini_results.json",
  phase3b: "/results/phase3b_full_results.json",
  phase3c: "/results/phase3c_medium_batch_100_results.json",
  phase3e: "/results/phase3e_da_tuned_results.json",
  batch3_stealthy: "/results/scaled/batch_3_stealthy_full_results.json",
  sonnet_20: "/results/scaled/batch1_sonnet_20_test.json",
  haiku_20: "/results/scaled/batch1_haiku_20_test.json",
  hybrid_20: "/results/scaled/batch1_hybrid_gpt4omini_20_test.json",
  gpt4omini_20: "/results/scaled/batch1_allgpt4omini_20_test.json",
  gpt4omini_1000: "/results/scaled/batch_3_stealthy_gpt4omini_results.json",
  stage1_ftp: "/results/stage1/FTP-BruteForce_results.json",
  stage1_ssh: "/results/stage1/SSH-Bruteforce_results.json",
  stage1_loic_http: "/results/stage1/DDoS_attacks-LOIC-HTTP_results.json",
  stage1_hulk: "/results/stage1/DoS_attacks-Hulk_results.json",
  stage1_slowhttp: "/results/stage1/DoS_attacks-SlowHTTPTest_results.json",
  stage1_goldeneye: "/results/stage1/DoS_attacks-GoldenEye_results.json",
  stage1_slowloris: "/results/stage1/DoS_attacks-Slowloris_results.json",
  stage1_hoic: "/results/stage1/DDOS_attack-HOIC_results.json",
  stage1_loic_udp: "/results/stage1/DDOS_attack-LOIC-UDP_results.json",
  stage1_bot: "/results/stage1/Bot_results.json",
  stage1_infilteration: "/results/stage1/Infilteration_results.json",
  stage1_web: "/results/stage1/Brute_Force_-Web_results.json",
  stage1_xss: "/results/stage1/Brute_Force_-XSS_results.json",
  stage1_sql: "/results/stage1/SQL_Injection_results.json",
  clustering_a: "/results/infiltration/enriched_prompt_results.json",
  clustering_b: "/results/infiltration/clustered_results.json",
  clustering_c: "/results/infiltration/combined_results.json",
};

export const STAGE1_ID_MAP = {
  "FTP-BruteForce": "stage1_ftp", "SSH-Bruteforce": "stage1_ssh",
  "DoS-SlowHTTPTest": "stage1_slowhttp", "DoS_attacks-SlowHTTPTest": "stage1_slowhttp",
  "DDoS_attacks-LOIC-HTTP": "stage1_loic_http", "DoS_attacks-Hulk": "stage1_hulk",
  "DoS_attacks-GoldenEye": "stage1_goldeneye", "DoS_attacks-Slowloris": "stage1_slowloris",
  "DDOS_attack-HOIC": "stage1_hoic", "DDOS_attack-LOIC-UDP": "stage1_loic_udp",
  "Bot": "stage1_bot", "Infilteration": "stage1_infilteration",
  "Brute_Force_-Web": "stage1_web", "Brute_Force_-XSS": "stage1_xss",
  "SQL_Injection": "stage1_sql",
};
