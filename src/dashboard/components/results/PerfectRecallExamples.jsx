import React, { useState } from "react";

// Real example flows pulled from results/stage1_test/ — each attack type that
// achieved 100% recall on the test set. Features are unmodified from the
// actual flow; reasoning/findings are from the agents that analysed that flow.
const PERFECT_EXAMPLES = [
  {
    id: "ftp-bruteforce",
    attack: "FTP-BruteForce",
    display: "FTP Brute Force",
    features: {
      L4_DST_PORT: 21,
      PROTOCOL: "6 (TCP)",
      FLOW_DURATION_MILLISECONDS: 1,
      IN_BYTES: 60,
      OUT_BYTES: 40,
      IN_PKTS: 1,
      OUT_PKTS: 1,
      TCP_FLAGS: "22 (SYN-ACK)",
    },
    signature: "1-millisecond TCP connection to port 21 (FTP), 60 bytes in + 40 bytes out, 1 packet each way, incomplete handshake.",
    why_easy: "A legitimate FTP session takes seconds to minutes and exchanges kilobytes of data. This is a single TCP probe with a failed handshake — the exact footprint of an automated credential scan. When dozens of identical flows repeat from the same source IP to the same target, the pattern is unmistakable.",
    agents: [
      { name: "Protocol", verdict: "SUSPICIOUS", finding: "Destination port 21 with ephemeral source port — client-initiated FTP, but the flow duration (1ms) is inconsistent with any real FTP interaction." },
      { name: "Statistical", verdict: "MALICIOUS", finding: "1ms duration with data exchange is the textbook fingerprint of a port scan. TCP_FLAGS=22 (SYN+ACK without completion) confirms no real session." },
      { name: "Behavioural", verdict: "MALICIOUS", finding: "Connection to authentication port (21) + very short duration matches the FTP brute force signature from MITRE T1110." },
      { name: "Temporal", verdict: "MALICIOUS", finding: "49 identical flows from the same source IP hitting the same destination — repetitive probing, uniform durations and packet sizes. Textbook brute-force campaign." },
    ],
  },
  {
    id: "ssh-bruteforce",
    attack: "SSH-Bruteforce",
    display: "SSH Brute Force",
    features: {
      L4_DST_PORT: 22,
      PROTOCOL: "6 (TCP)",
      FLOW_DURATION_MILLISECONDS: 382,
      IN_BYTES: 3164,
      OUT_BYTES: 3869,
      IN_PKTS: 23,
      OUT_PKTS: 23,
      TCP_FLAGS: "27 (SYN-FIN-PSH-ACK)",
    },
    signature: "Short (382ms) TCP session to port 22 (SSH), ~3KB each direction, 23 packets each way, exactly balanced — classic failed authentication handshake.",
    why_easy: "Real SSH sessions either last long (user typing commands) or transfer significant data (SCP/SFTP). A 382ms session with perfectly balanced 23×23 packets and ~3KB each way is the signature of a single credential attempt that got rejected. The temporal agent catches what individual flows don't show: the same src→dst→port combo repeating with identical shape, meaning the attacker is hammering the login.",
    agents: [
      { name: "Protocol", verdict: "BENIGN", finding: "On its own, the flow is shaped like a legitimate SSH attempt — port 22, balanced byte counts, normal TCP flags." },
      { name: "Statistical", verdict: "BENIGN", finding: "IN_BYTES and OUT_BYTES have a reasonable ratio for SSH; packet counts balanced." },
      { name: "Behavioural", verdict: "SUSPICIOUS", finding: "Short duration + authentication port — individual flow is plausible but fits the brute-force profile." },
      { name: "Temporal", verdict: "MALICIOUS", finding: "Same src→dst→port repeated with uniform flow durations and packet sizes. This cross-flow view is what clinches it — no individual flow looks malicious, but the pattern of identical attempts is diagnostic." },
    ],
  },
  {
    id: "slowloris",
    attack: "DoS_attacks-Slowloris",
    display: "DoS Slowloris",
    features: {
      L4_DST_PORT: 80,
      PROTOCOL: "6 (TCP)",
      FLOW_DURATION_MILLISECONDS: 2046,
      IN_BYTES: 454,
      OUT_BYTES: 164,
      IN_PKTS: 4,
      OUT_PKTS: 3,
      TCP_FLAGS: "26 (SYN-PSH-ACK)",
    },
    signature: "2-second TCP session to port 80 (HTTP), but only 454 bytes in + 164 bytes out across 4+3 packets. Held open, near-zero throughput.",
    why_easy: "A real HTTP page load sends multiple KB in under 200ms. Slowloris holds the socket open for seconds while drip-feeding fragments of a request to exhaust the web server's connection pool. The feature signature — long duration combined with nearly zero throughput — is the exact inverse of legitimate HTTP traffic, so detection is straightforward whenever temporal context is available.",
    agents: [
      { name: "Protocol", verdict: "BENIGN", finding: "Port 80 is normal HTTP, TCP flags look standard." },
      { name: "Statistical", verdict: "SUSPICIOUS", finding: "Asymmetry between bytes and packet count — unusually low throughput for a 2-second HTTP session." },
      { name: "Behavioural", verdict: "MALICIOUS", finding: "Repeated small requests on HTTP port with minimal data — classic Slowloris fingerprint (MITRE T1499)." },
      { name: "Temporal", verdict: "MALICIOUS", finding: "Many flows to the same destination with repeated long-duration low-throughput connections — attack holds connection pool saturated." },
    ],
  },
  {
    id: "slowhttptest",
    attack: "DoS_attacks-SlowHTTPTest",
    display: "DoS SlowHTTPTest",
    features: {
      L4_DST_PORT: 21,
      PROTOCOL: "6 (TCP)",
      FLOW_DURATION_MILLISECONDS: 1,
      IN_BYTES: 60,
      OUT_BYTES: 40,
      IN_PKTS: 1,
      OUT_PKTS: 1,
      TCP_FLAGS: "22 (SYN-ACK)",
    },
    signature: "1ms TCP probe with an incomplete handshake — same signature as a port scan. SlowHTTPTest generates a mix of scan probes and slow-read attacks.",
    why_easy: "The SlowHTTPTest tool in CICIDS2018 produces two flow shapes — slow-read HTTP connections (long duration, low throughput) and reconnaissance probes (1ms with TCP_FLAGS=22). Either shape is obviously anomalous; the probes look identical to port scans, so the statistical and temporal agents catch them instantly by pattern matching against repetitive probing from the same source.",
    agents: [
      { name: "Protocol", verdict: "BENIGN", finding: "Port 21 FTP service with ephemeral source port — no protocol anomaly on its own." },
      { name: "Statistical", verdict: "MALICIOUS", finding: "1ms with data exchange = scanning. Byte distribution doesn't match a real FTP interaction." },
      { name: "Behavioural", verdict: "SUSPICIOUS", finding: "Short duration + auth port matches scanning-then-brute-forcing preamble." },
      { name: "Temporal", verdict: "MALICIOUS", finding: "Same src→dst→port repeated with uniform flow durations and packet sizes (1ms, 60B in, 40B out). Campaign-level repetition." },
    ],
  },
  {
    id: "loic-udp",
    attack: "DDOS_attack-LOIC-UDP",
    display: "DDoS LOIC-UDP",
    features: {
      L4_DST_PORT: 80,
      PROTOCOL: "17 (UDP)",
      FLOW_DURATION_MILLISECONDS: 120876,
      IN_BYTES: 7495080,
      OUT_BYTES: 0,
      IN_PKTS: 124918,
      OUT_PKTS: 0,
      TCP_FLAGS: 0,
    },
    signature: "120-second UDP flood: 7.5 MB in, 125,000 packets in, ZERO packets or bytes out. Classic volumetric DDoS.",
    why_easy: "Everything about this flow screams attack: UDP on port 80 (HTTP is TCP, not UDP — protocol mismatch alone is a red flag), 125,000 one-way packets with no response, and 7.5 MB of traffic sustained for two minutes. This is the most obvious attack type in the entire dataset — a pure volumetric flood that looks nothing like any benign flow.",
    agents: [
      { name: "Protocol", verdict: "MALICIOUS", finding: "Mismatch: port 80 is HTTP (TCP), but this flow uses UDP (protocol 17). TCP_FLAGS=0 is incongruent with any real session." },
      { name: "Statistical", verdict: "MALICIOUS", finding: "Complete asymmetry: IN_BYTES=7,495,080 vs OUT_BYTES=0. IN_PKTS=124,918 vs OUT_PKTS=0. Zero reciprocity is impossible for any legitimate protocol." },
      { name: "Behavioural", verdict: "MALICIOUS", finding: "UDP flood signature — very high packet count, very short inter-arrival, no return traffic. MITRE T1498.001." },
      { name: "Temporal", verdict: "MALICIOUS", finding: "Repeated one-way floods to the same destination IP and port from the same source. Coordinated flooding attack." },
    ],
  },
];

export default function PerfectRecallExamples() {
  const [expanded, setExpanded] = useState("ftp-bruteforce");

  return (
    <div className="border border-green-200 bg-green-50/30 rounded-lg p-5 mb-6">
      <h3 className="text-sm font-bold text-green-900 mb-1">Why These 5 Attacks Hit 100% Recall — Example Flows</h3>
      <p className="text-xs text-gray-600 mb-4 leading-relaxed">
        Below are real flows from the test-set evaluation, one per 100%-recall attack type. Each example shows
        the raw flow features, the reasoning from each of the 4 specialist agents, and why the signature is
        effectively unmissable for any competent detector.
      </p>

      <div className="space-y-2">
        {PERFECT_EXAMPLES.map(ex => {
          const isOpen = expanded === ex.id;
          return (
            <div key={ex.id} className="border border-gray-200 rounded bg-white overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : ex.id)}
                className="w-full bg-white hover:bg-gray-50 px-4 py-3 text-left cursor-pointer flex items-center justify-between border-b border-gray-100"
              >
                <div>
                  <div className="text-sm font-semibold text-gray-800">{ex.display}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{ex.signature}</div>
                </div>
                <div className="text-gray-400 text-lg">{isOpen ? "−" : "+"}</div>
              </button>

              {isOpen && (
                <div className="p-4 bg-gray-50/50 space-y-3">
                  {/* Raw features */}
                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Flow features</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-white border border-gray-200 rounded p-2">
                      {Object.entries(ex.features).map(([k, v]) => (
                        <div key={k} className="text-[11px]">
                          <div className="text-gray-500">{k}</div>
                          <div className="font-mono text-gray-900 font-semibold">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Why easy */}
                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Why this is unmissable</div>
                    <p className="text-xs text-gray-700 leading-relaxed m-0 bg-white border border-gray-200 rounded p-2">
                      {ex.why_easy}
                    </p>
                  </div>

                  {/* Specialist agents */}
                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Specialist agent analysis (real reasoning from this flow)</div>
                    <div className="space-y-1.5">
                      {ex.agents.map(a => {
                        const color = a.verdict === "MALICIOUS" ? "border-red-400 bg-red-50/50" :
                                      a.verdict === "SUSPICIOUS" ? "border-amber-400 bg-amber-50/50" :
                                      "border-gray-300 bg-gray-50/50";
                        const tagColor = a.verdict === "MALICIOUS" ? "bg-red-100 text-red-800" :
                                         a.verdict === "SUSPICIOUS" ? "bg-amber-100 text-amber-800" :
                                         "bg-gray-100 text-gray-600";
                        return (
                          <div key={a.name} className={`border-l-2 ${color} px-2 py-1.5 rounded`}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[11px] font-bold text-gray-700">{a.name}</span>
                              <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded ${tagColor}`}>{a.verdict}</span>
                            </div>
                            <div className="text-[11px] text-gray-700 leading-snug">{a.finding}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Caveat footer */}
      <div className="mt-4 pt-3 border-t border-green-200">
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Important caveat on the 5 × 100%</div>
        <p className="text-xs text-gray-700 leading-relaxed m-0">
          Getting 100% on 50 attack flows does <strong>not</strong> mean the detector is perfect — the Wilson
          95% confidence interval for 50/50 detected is <strong>[93%, 100%]</strong>. With 500 flows, 2–4 misses
          would be expected, placing the true recall somewhere in the 96–99% range. These 5 attacks are
          genuinely the easiest in the dataset (one-way UDP floods, 1ms TCP probes, long-held low-throughput
          HTTP) so near-perfect detection is the expected behaviour of any competent NIDS — but "100%" should
          be read as "essentially all, within the uncertainty of a 50-sample test."
        </p>
      </div>
    </div>
  );
}
