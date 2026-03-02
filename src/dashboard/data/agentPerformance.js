// Cross-experiment agent performance data
// Each entry: { signal, reason } where reason explains WHY the agent is strong/moderate/weak
// Derived from EXPECTED_AGENT_BEHAVIOR + attack signatures + Stage 1 results

const SIGNAL_MAP = {
  "FTP-BruteForce": {
    protocol:    { signal: "strong", reason: "Port 21 is FTP-specific; rapid SYN-RST patterns from failed logins create clear protocol anomalies" },
    statistical: { signal: "strong", reason: "Uniform short flows (~200-400 bytes) at sub-second intervals produce extreme statistical outliers in packet size and IAT distributions" },
    behavioural: { signal: "strong", reason: "Textbook T1110 brute force signature — repeated credential attempts on authentication port with dictionary attack timing" },
    temporal:    { signal: "strong", reason: "Dozens of same-IP same-port flows within seconds is the strongest temporal signal in the dataset; unambiguous burst pattern" },
  },
  "SSH-Bruteforce": {
    protocol:    { signal: "strong", reason: "Port 22 (SSH) with rapid connection cycling and consistent SYN-RST patterns clearly indicate failed authentication attempts" },
    statistical: { signal: "strong", reason: "Nearly identical profile to FTP brute force — uniform short flows, small payloads, sub-second intervals from single IP" },
    behavioural: { signal: "strong", reason: "Clear T1110 match; SSH dictionary attacks produce recognisable credential-guessing patterns" },
    temporal:    { signal: "strong", reason: "Repeated connections to port 22 from same IP within seconds; identical burst pattern to FTP brute force" },
  },
  "DDoS_attacks-LOIC-HTTP": {
    protocol:    { signal: "weak", reason: "Traffic uses standard HTTP ports (80/443) with valid protocol headers — individual flows are protocol-compliant" },
    statistical: { signal: "moderate", reason: "Individual flows look like normal HTTP requests; anomaly only visible in aggregate volume which single-flow analysis partially captures" },
    behavioural: { signal: "moderate", reason: "LOIC generates uniform request sizes (unlike legitimate browsing), but this pattern overlaps with legitimate API traffic" },
    temporal:    { signal: "moderate", reason: "Multiple IPs hitting same target helps, but distributed nature means per-IP flow count may be low — weaker signal than brute force" },
  },
  "DoS_attacks-Hulk": {
    protocol:    { signal: "weak", reason: "Standard HTTP traffic on ports 80/443 with no protocol-level anomalies; Hulk randomizes headers to look legitimate" },
    statistical: { signal: "moderate", reason: "High volume from single IP is detectable, but Hulk randomizes payload sizes specifically to defeat statistical profiling" },
    behavioural: { signal: "moderate", reason: "Randomized URLs, user-agents, and referrers make each request look unique — harder to match against flood signatures" },
    temporal:    { signal: "strong", reason: "Single IP generating hundreds of unique requests in rapid succession; temporal density is the strongest differentiator despite randomization" },
  },
  "DoS_attacks-SlowHTTPTest": {
    protocol:    { signal: "moderate", reason: "TCP flags show long-held connections on HTTP ports; incomplete request patterns are a subtle protocol anomaly" },
    statistical: { signal: "strong", reason: "Extreme duration (minutes+) with minimal data transfer creates the most distinctive statistical profile — 1000x duration of normal flows" },
    behavioural: { signal: "strong", reason: "Classic slow-rate DoS signature; connection exhaustion via slow POST/read is a well-documented attack pattern (T1499.001)" },
    temporal:    { signal: "strong", reason: "Multiple parallel long-duration connections from same IP to same target; temporally unique — no legitimate traffic holds connections this long" },
  },
  "DoS_attacks-GoldenEye": {
    protocol:    { signal: "weak", reason: "Uses legitimate HTTP Keep-Alive feature; individual connections look like normal persistent browsing sessions" },
    statistical: { signal: "moderate", reason: "Longer connections with periodic bursts have moderate statistical signal, but variable payload sizes mimic normal AJAX-heavy sites" },
    behavioural: { signal: "moderate", reason: "HTTP Keep-Alive abuse is recognisable but overlaps with legitimate usage (e.g., WebSocket, streaming, SPAs)" },
    temporal:    { signal: "strong", reason: "Single IP maintaining many simultaneous Keep-Alive connections over extended period; concurrent connection count is the key differentiator" },
  },
  "DoS_attacks-Slowloris": {
    protocol:    { signal: "moderate", reason: "Incomplete HTTP request headers are a protocol anomaly, but only detectable if the agent reasons about partial vs complete requests" },
    statistical: { signal: "strong", reason: "Extreme duration with near-zero data transfer; periodic small packets (keep-alive headers) create a uniquely anomalous statistical profile" },
    behavioural: { signal: "strong", reason: "Classic Slowloris signature — partial headers keeping connections alive is a well-known DoS technique documented in CVE databases" },
    temporal:    { signal: "strong", reason: "Many parallel connections from same IP, all with extreme duration and minimal data; temporal pattern is unmistakable" },
  },
  "DDOS_attack-HOIC": {
    protocol:    { signal: "weak", reason: "HTTP traffic is indistinguishable from legitimate at protocol level — boost scripts ensure valid headers and request formats" },
    statistical: { signal: "weak", reason: "Boost scripts specifically designed to mimic legitimate browsing distributions; flow statistics overlap with normal HTTP traffic" },
    behavioural: { signal: "weak", reason: "Boost scripts defeat pattern-based detection by randomizing everything — the hardest DDoS variant to signature-match" },
    temporal:    { signal: "weak", reason: "Distributed nature means per-source-IP flow counts may be low; less uniform than LOIC so temporal patterns are ambiguous" },
  },
  "DDOS_attack-LOIC-UDP": {
    protocol:    { signal: "strong", reason: "UDP to random destination ports is a clear protocol anomaly — no legitimate service listens on arbitrary ports" },
    statistical: { signal: "strong", reason: "Extreme volume, uniform packet sizes, random ports create massive statistical outliers across multiple dimensions" },
    behavioural: { signal: "strong", reason: "Textbook UDP flood pattern matching T1498; random-port UDP is unambiguous attack traffic" },
    temporal:    { signal: "strong", reason: "Single IP flooding many ports simultaneously; extreme flow density per IP with no legitimate explanation" },
  },
  "Bot": {
    protocol:    { signal: "weak", reason: "Mixed protocols (HTTP/HTTPS/DNS) to specific IPs; each individual connection uses standard protocols correctly" },
    statistical: { signal: "moderate", reason: "Periodic connections at regular intervals (beaconing) create subtle timing anomalies, but intervals can match legitimate update checks" },
    behavioural: { signal: "moderate", reason: "C2 beaconing pattern is recognisable but overlaps with software update checks, heartbeat monitors, and scheduled tasks" },
    temporal:    { signal: "moderate", reason: "Regular intervals to same destination over extended time is suggestive but not conclusive — legitimate cron jobs look identical" },
  },
  "Infilteration": {
    protocol:    { signal: "weak", reason: "DNS queries on port 53 over UDP — perfectly normal protocol usage; literally identical to legitimate DNS at protocol level" },
    statistical: { signal: "weak", reason: "Individual DNS queries (1 packet, 63-457 bytes) are statistically identical to benign DNS — no single-flow anomaly exists" },
    behavioural: { signal: "weak", reason: "Data encoded in subdomains is invisible in NetFlow features — only payload inspection (unavailable) could detect it" },
    temporal:    { signal: "weak", reason: "Only hope is aggregate query volume per IP, but individual temporal windows may not capture enough queries; 0% recall confirms limitation" },
  },
  "Brute_Force_-Web": {
    protocol:    { signal: "weak", reason: "HTTP POST to standard web ports; completely legitimate protocol usage indistinguishable from form submissions" },
    statistical: { signal: "moderate", reason: "Repeated POST requests with similar sizes in rapid succession from one IP; moderate anomaly but common in legitimate API usage" },
    behavioural: { signal: "moderate", reason: "Credential guessing via web forms matches T1110 pattern, but HTTP POST traffic is extremely common in normal web applications" },
    temporal:    { signal: "moderate", reason: "Rapid sequential POST requests from same IP to same endpoint is suggestive, but overlaps with AJAX-heavy apps and webhook triggers" },
  },
  "Brute_Force_-XSS": {
    protocol:    { signal: "weak", reason: "Standard HTTP requests on standard ports; XSS payloads are in request body/params, invisible at protocol level" },
    statistical: { signal: "moderate", reason: "Varying payload sizes (different XSS vectors) in rapid succession create moderate anomaly, but similar to normal browsing variety" },
    behavioural: { signal: "moderate", reason: "XSS scanning pattern recognisable by rapid sequential requests testing different inputs, but payload content not visible in NetFlow" },
    temporal:    { signal: "moderate", reason: "Rapid sequential requests from one IP to same target, but browsing sessions and API testing produce similar temporal patterns" },
  },
  "SQL_Injection": {
    protocol:    { signal: "weak", reason: "Standard HTTP requests; SQL payloads are in request parameters, completely invisible at the NetFlow protocol level" },
    statistical: { signal: "moderate", reason: "Rapid sequential requests with slightly larger payloads create moderate statistical signal; high volume from single IP helps" },
    behavioural: { signal: "moderate", reason: "SQL injection probe pattern matches T1190, but at NetFlow level the only signal is request frequency and timing, not payload content" },
    temporal:    { signal: "strong", reason: "Rapid sequential requests from one IP to same endpoint is a strong scanning pattern — temporal density explains the 98% recall" },
  },
};

// Convert signal strengths to numeric scores for visualization
export const SIGNAL_SCORE = { strong: 3, moderate: 2, weak: 1 };

export const AGENT_CROSS_PERFORMANCE = Object.fromEntries(
  Object.entries(SIGNAL_MAP).map(([attack, agents]) => [
    attack,
    Object.fromEntries(
      Object.entries(agents).map(([agent, data]) => [agent, { signal: data.signal, reason: data.reason, score: SIGNAL_SCORE[data.signal] }])
    ),
  ])
);

// Color mapping for heatmap cells
export const SIGNAL_COLORS = {
  strong:   { bg: "#dcfce7", text: "#166534", label: "Strong" },
  moderate: { bg: "#fef3c7", text: "#92400e", label: "Moderate" },
  weak:     { bg: "#fee2e2", text: "#991b1b", label: "Weak" },
};
