// All 7 MCP configurations + AMATAS baseline + tool catalog

export const MCP_CONFIGS = [
  {
    id: "A", label: "A: Zero-Shot", model: "GPT-4o-mini",
    category: "ip-dependent", color: "#d97706", bg: "#fffbeb",
    tools: [], toolDescriptions: [],
    ipDependent: false,
    description: "Raw flow features sent to GPT-4o-mini with no system prompt or tools. Baseline for what a cheap model can do out of the box.",
    metrics: { recall: 90.0, precision: 48.2, f1: 62.8, fpr: 41.4, cost: 0.0084, costPerFlow: 0.0001, totalToolCalls: 0, avgToolsPerFlow: 0 },
    confusion: { tp: 27, fp: 29, tn: 41, fn: 3 },
  },
  {
    id: "B", label: "B: Engineered Prompt", model: "GPT-4o",
    category: "ip-dependent", color: "#3b82f6", bg: "#eff6ff",
    tools: [], toolDescriptions: [],
    ipDependent: false,
    description: "Detailed system prompt with attack signatures, feature explanations, and decision guidelines. No tools — all reasoning from prompt-encoded knowledge.",
    metrics: { recall: 66.7, precision: 51.3, f1: 58.0, fpr: 27.1, cost: 0.3679, costPerFlow: 0.0037, totalToolCalls: 0, avgToolsPerFlow: 0 },
    confusion: { tp: 20, fp: 19, tn: 51, fn: 10 },
  },
  {
    id: "C", label: "C: + MITRE Tool", model: "GPT-4o",
    category: "ip-dependent", color: "#8b5cf6", bg: "#f5f3ff",
    tools: ["query_mitre_technique"],
    toolDescriptions: ["MITRE ATT&CK technique lookup"],
    ipDependent: true,
    description: "Engineered prompt plus MITRE ATT&CK lookup tool. Tests whether structured threat intelligence improves detection.",
    metrics: { recall: 70.0, precision: 50.0, f1: 58.3, fpr: 30.0, cost: 0.4537, costPerFlow: 0.0045, totalToolCalls: 0, avgToolsPerFlow: 0 },
    confusion: { tp: 21, fp: 21, tn: 49, fn: 9 },
  },
  {
    id: "D", label: "D: Feature Decoders", model: "GPT-4o",
    category: "dataset-compatible", color: "#b45309", bg: "#fef3c7",
    tools: ["iana_port_lookup", "decode_protocol", "decode_tcp_flags"],
    toolDescriptions: ["IANA port → service name", "Protocol number → name", "TCP flags bitmask → flag names"],
    ipDependent: false,
    description: "Three dataset-compatible tools that decode numeric features into human-readable values. No IP lookups — works on anonymised data.",
    metrics: { recall: 36.7, precision: 36.7, f1: 36.7, fpr: 27.1, cost: 0.919, costPerFlow: 0.0092, totalToolCalls: 265, avgToolsPerFlow: 2.6 },
    confusion: { tp: 11, fp: 19, tn: 51, fn: 19 },
  },
  {
    id: "E", label: "E: + DShield Intel", model: "GPT-4o",
    category: "dataset-compatible", color: "#a16207", bg: "#fef3c7",
    tools: ["iana_port_lookup", "decode_protocol", "decode_tcp_flags", "dshield_port_intel"],
    toolDescriptions: ["IANA port → service name", "Protocol number → name", "TCP flags bitmask → flag names", "DShield port activity statistics"],
    ipDependent: false,
    description: "Feature decoders plus DShield port intelligence — provides real-world port scanning statistics from SANS Internet Storm Center.",
    metrics: { recall: 50.0, precision: 44.1, f1: 46.9, fpr: 27.1, cost: 0.963, costPerFlow: 0.0096, totalToolCalls: 287, avgToolsPerFlow: 2.9 },
    confusion: { tp: 15, fp: 19, tn: 51, fn: 15 },
  },
  {
    id: "F", label: "F: + CVE Lookup", model: "GPT-4o",
    category: "dataset-compatible", color: "#92400e", bg: "#fef3c7",
    tools: ["iana_port_lookup", "decode_protocol", "decode_tcp_flags", "dshield_port_intel", "cve_lookup"],
    toolDescriptions: ["IANA port → service name", "Protocol number → name", "TCP flags bitmask → flag names", "DShield port activity statistics", "CVE vulnerability database search"],
    ipDependent: false,
    description: "All previous tools plus CVE vulnerability lookup — can check if the target service/port has known vulnerabilities.",
    metrics: { recall: 36.7, precision: 39.3, f1: 37.9, fpr: 24.3, cost: 1.0135, costPerFlow: 0.0101, totalToolCalls: 293, avgToolsPerFlow: 2.9 },
    confusion: { tp: 11, fp: 17, tn: 53, fn: 19 },
  },
  {
    id: "G", label: "G: Full Toolkit", model: "GPT-4o",
    category: "dataset-compatible", color: "#78350f", bg: "#fef3c7",
    tools: ["iana_port_lookup", "decode_protocol", "decode_tcp_flags", "dshield_port_intel", "cve_lookup", "query_mitre_technique", "search_mitre_techniques"],
    toolDescriptions: ["IANA port → service name", "Protocol number → name", "TCP flags bitmask → flag names", "DShield port activity statistics", "CVE vulnerability database search", "MITRE ATT&CK technique lookup", "MITRE ATT&CK keyword search"],
    ipDependent: false,
    description: "Maximum tooling — all 7 dataset-compatible tools including MITRE ATT&CK. Tests whether comprehensive external knowledge helps.",
    metrics: { recall: 40.0, precision: 38.7, f1: 39.3, fpr: 27.1, cost: 1.0771, costPerFlow: 0.0108, totalToolCalls: 297, avgToolsPerFlow: 3.0 },
    confusion: { tp: 12, fp: 19, tn: 51, fn: 18 },
  },
];

export const AMATAS_BASELINE = {
  id: "AMATAS", label: "AMATAS v2", model: "GPT-4o (6-agent + RF)",
  category: "multi-agent", color: "#16a34a", bg: "#f0fdf4",
  description: "Six specialist agents + Devil's Advocate + Orchestrator with Tier-1 RF pre-filter. The full AMATAS architecture.",
  metrics: { recall: 85, precision: 97, f1: 88, fpr: 1.1, cost: 27.35, costPerFlow: 0.0020 },
};

// All tools across all configs with metadata
export const MCP_TOOL_CATALOG = [
  // IP-dependent tools (from original MCP server, configs A-C era)
  { name: "abuseipdb_check", description: "Check IP reputation against AbuseIPDB database", category: "Threat Intelligence", worksOnAnonymized: false, usedIn: [], note: "Returns empty on private/anonymised IPs" },
  { name: "otx_ip_lookup", description: "Query AlienVault OTX for IP threat indicators", category: "Threat Intelligence", worksOnAnonymized: false, usedIn: [], note: "Returns empty on private/anonymised IPs" },
  { name: "geolocate_ip", description: "Geolocate IP address to country/city/ASN", category: "Threat Intelligence", worksOnAnonymized: false, usedIn: [], note: "Returns private range for all IPs" },
  { name: "reverse_dns", description: "Reverse DNS lookup for IP address", category: "Threat Intelligence", worksOnAnonymized: false, usedIn: [], note: "No PTR records for private IPs" },
  { name: "whois_lookup", description: "WHOIS registration data for IP address", category: "Threat Intelligence", worksOnAnonymized: false, usedIn: [], note: "Returns RFC1918 private range info" },
  { name: "shodan_host", description: "Shodan host information (ports, services, vulns)", category: "Threat Intelligence", worksOnAnonymized: false, usedIn: [], note: "No data for private IPs" },
  // Dataset-compatible tools
  { name: "iana_port_lookup", description: "Maps port number to IANA registered service name (e.g., 22 → SSH, 80 → HTTP)", category: "Feature Decoder", worksOnAnonymized: true, usedIn: ["D", "E", "F", "G"] },
  { name: "decode_protocol", description: "Converts protocol number to name (e.g., 6 → TCP, 17 → UDP)", category: "Feature Decoder", worksOnAnonymized: true, usedIn: ["D", "E", "F", "G"] },
  { name: "decode_tcp_flags", description: "Decodes TCP flags bitmask to individual flag names (e.g., 22 → SYN+RST+ACK)", category: "Feature Decoder", worksOnAnonymized: true, usedIn: ["D", "E", "F", "G"] },
  { name: "dshield_port_intel", description: "SANS Internet Storm Center port activity — scanning frequency, recent attacks targeting this port", category: "Port Intelligence", worksOnAnonymized: true, usedIn: ["E", "F", "G"] },
  { name: "cve_lookup", description: "Search NVD/CVE database for vulnerabilities related to a service or port", category: "Vulnerability Intel", worksOnAnonymized: true, usedIn: ["F", "G"] },
  { name: "query_mitre_technique", description: "Look up a specific MITRE ATT&CK technique by ID (e.g., T1110 → Brute Force)", category: "Threat Framework", worksOnAnonymized: true, usedIn: ["C", "G"] },
  { name: "search_mitre_techniques", description: "Keyword search across MITRE ATT&CK techniques database", category: "Threat Framework", worksOnAnonymized: true, usedIn: ["G"] },
];

export const TOOLS_HURT_NARRATIVE = {
  title: "The Key Finding: Tools Hurt Performance",
  summary: "Adding tools to a single-agent system consistently degraded detection accuracy compared to the engineered-prompt-only baseline.",
  comparison: {
    baseline: { config: "B", label: "Engineered Prompt (no tools)", f1: 58.0 },
    worst: { config: "D", label: "Feature Decoders (3 tools)", f1: 36.7 },
    delta: -21.3,
  },
  explanation: "Tools provide true but irrelevant context. When the agent calls iana_port_lookup and learns that port 80 is HTTP, it anchors on 'this is normal web traffic' rather than analysing the actual flow statistics (packet sizes, timing, byte ratios) that reveal the attack. The tool output displaces direct feature analysis — the model's context window fills with factually correct but diagnostically useless information.",
};
