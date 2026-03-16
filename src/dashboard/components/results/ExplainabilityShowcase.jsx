import React, { useState } from "react";
import { verdictColor, verdictBg } from "../../lib/format";

/**
 * Curated examples of agent reasoning chains, hardcoded for instant rendering.
 * These are real flows from Stage 1 experiments — not synthetic.
 */
const CURATED_EXAMPLES = [
  {
    id: "ftp_disagreement",
    title: "FTP Brute-Force — Protocol Agent Disagrees",
    subtitle: "4 agents analyze an FTP connection. Protocol says benign (valid port 21 handshake). Temporal spots the pattern.",
    flowIdx: 783,
    attackType: "FTP-BruteForce",
    trueLabel: "Attack",
    finalVerdict: "SUSPICIOUS",
    finalConfidence: 0.65,
    mitre: ["T1110"],
    agreed: ["statistical", "behavioural", "temporal"],
    disagreed: ["protocol"],
    agents: [
      {
        name: "Protocol", color: "#3b82f6", verdict: "BENIGN", confidence: 0.90,
        evidence: ["Port 21 aligns with FTP service", "Ephemeral source port 40332", "TCP protocol consistent with FTP"],
        reasoning: "The record shows a connection to port 21 with a SYN-ACK TCP flag set, indicative of a legitimate FTP server response to a connection attempt. The source port is in the ephemeral range. All protocol fields are consistent with standard FTP operations.",
      },
      {
        name: "Statistical", color: "#8b5cf6", verdict: "SUSPICIOUS", confidence: 0.75,
        evidence: ["Very short flow duration (1ms) with data transfer", "Single packet each direction — unusual for FTP", "Zero inter-arrival time"],
        reasoning: "The flow has a very short duration of 1ms with both IN and OUT packets and bytes, which is unusual for legitimate FTP traffic on port 21. The quick succession suggests it could be part of a scanning attempt or automated brute-force login cycle.",
      },
      {
        name: "Behavioural", color: "#f59e0b", verdict: "SUSPICIOUS", confidence: 0.80,
        evidence: ["Repeated connections to authentication port 21", "Small packet sizes (60 bytes in, 40 bytes out)", "Short flow duration characteristic of rapid login attempts"],
        reasoning: "The NetFlow record indicates a connection attempt to an FTP port (21) with a very short duration (1ms) and small packet sizes, which are characteristic of rapid, repeated authentication attempts seen in brute-force attacks.",
      },
      {
        name: "Temporal", color: "#ec4899", verdict: "MALICIOUS", confidence: 0.95,
        evidence: ["Repetitive patterns in flow characteristics", "Same source-destination-port combination repeated 49 times", "Uniform flow durations and packet sizes across all connections"],
        reasoning: "The flows from this source IP exhibit a pattern of repetitive, short-duration connections to the same destination IP and port (FTP service on port 21). Each flow is identical in duration, size, and TCP flags — a signature of automated brute-force tooling cycling through credential lists.",
      },
    ],
    da: {
      confidence: 0.35,
      strongestBenign: "The SYN-ACK flag combination is a standard server response to a legitimate client connection request, typical for initial connection handshakes in FTP operations.",
      counter: "This flow can be interpreted as a benign connection attempt from a client trying to establish a connection to an FTP server. The port usage is standard, the packet sizes are consistent with protocol overhead, and the traffic pattern could represent normal server monitoring.",
    },
    orchestratorReasoning: "The synthesis of the analyses indicates mixed signals. The Protocol Agent supports a benign interpretation, citing valid FTP setup characteristics. However, the other specialists indicate anomalous behavior: Statistical and Behavioural agents describe extremely short duration and small packet sizes characteristic of brute-force tooling, while the Temporal agent provides the strongest evidence — 49 identical connections from the same IP to port 21 over a short period, a clear automated credential-stuffing pattern. The Devil's Advocate argues for a legitimate connection, but the temporal pattern is decisive. Verdict: SUSPICIOUS with MITRE ATT&CK T1110 (Brute Force).",
  },
  {
    id: "ssh_split",
    title: "SSH Brute-Force — 2v2 Agent Split",
    subtitle: "Protocol and Statistical see valid SSH traffic. Behavioural and Temporal catch the attack pattern. Orchestrator breaks the tie.",
    flowIdx: 29,
    attackType: "SSH-Bruteforce",
    trueLabel: "Attack",
    finalVerdict: "SUSPICIOUS",
    finalConfidence: 0.65,
    mitre: ["T1110.001"],
    agreed: ["behavioural", "temporal"],
    disagreed: ["protocol", "statistical"],
    agents: [
      {
        name: "Protocol", color: "#3b82f6", verdict: "BENIGN", confidence: 0.95,
        evidence: ["Destination port 22 aligns with SSH service", "TCP protocol (6) expected for SSH", "SYN+FIN+PSH+ACK flags indicate complete session"],
        reasoning: "The destination port 22 is the standard SSH service port. The protocol is TCP (6), which is the expected transport for SSH. Flag combination shows SYN, FIN, PSH+ACK — a complete session lifecycle. All protocol fields are internally consistent with a legitimate encrypted remote access session.",
      },
      {
        name: "Statistical", color: "#8b5cf6", verdict: "BENIGN", confidence: 0.80,
        evidence: ["Balanced bidirectional traffic (3148 bytes in, 3869 bytes out)", "Equal packet counts (11 each direction)", "Duration of 14,826ms suggests an interactive session"],
        reasoning: "The flow shows balanced bidirectional traffic with equal packet counts, consistent with SSH's encrypted interactive protocol. The 14-second duration and byte volumes suggest a legitimate login session with key exchange, authentication, and possibly command execution.",
      },
      {
        name: "Behavioural", color: "#f59e0b", verdict: "MALICIOUS", confidence: 0.90,
        evidence: ["Repeated connections to authentication port 22", "Pattern matches credential-stuffing behaviour", "Multiple short sessions from same source IP"],
        reasoning: "Despite the individual flow looking like a legitimate SSH session, the broader pattern reveals repeated connections to port 22 from this source. This matches the credential-stuffing variant of brute-force attacks where each connection attempts a full authentication handshake with different credentials.",
      },
      {
        name: "Temporal", color: "#ec4899", verdict: "MALICIOUS", confidence: 0.95,
        evidence: ["High frequency of connections to same destination", "49 flows from this IP to port 22 in analysis window", "Consistent session duration suggests automated tooling"],
        reasoning: "Cross-flow analysis reveals 49 connections from this source IP to the same destination port 22. Each connection follows an identical pattern — connect, authenticate, disconnect — at regular intervals. This temporal density is the defining signature of automated SSH brute-force tooling, not manual administration.",
      },
    ],
    da: {
      confidence: 0.40,
      strongestBenign: "Balanced bidirectional traffic with equal packet counts and SYN, FIN, PSH+ACK flags consistent with legitimate SSH session lifecycle.",
      counter: "The flow could represent an automated systems administration script performing routine tasks across multiple servers — SSH connections with similar duration and byte counts are expected from configuration management tools like Ansible or Puppet.",
    },
    orchestratorReasoning: "The analyses present conflicting views. Protocol and Statistical agents find the traffic benign, noting standard SSH characteristics — correct port, balanced packets, reasonable duration. However, Behavioural and Temporal agents identify the critical pattern: 49 identical SSH sessions from the same source IP in rapid succession. No legitimate administrator opens 49 identical SSH sessions to the same server in a short window. The temporal evidence breaks the 2v2 tie — this is automated credential testing. The Devil's Advocate's configuration management argument fails because such tools maintain persistent connections rather than opening 49 short sessions. Verdict: SUSPICIOUS, T1110.001 (Password Guessing).",
  },
  {
    id: "hoic_da_suppression",
    title: "DDOS-HOIC — Devil's Advocate Suppresses Detection",
    subtitle: "Most agents flag suspicious HTTP traffic, but DA argues it's normal web browsing. This is why removing DA improves HOIC recall by 40pp.",
    flowIdx: 756,
    attackType: "DDOS_attack-HOIC",
    trueLabel: "Attack",
    finalVerdict: "SUSPICIOUS",
    finalConfidence: 0.55,
    mitre: ["T1498"],
    agreed: ["protocol", "statistical"],
    disagreed: ["behavioural", "temporal"],
    agents: [
      {
        name: "Protocol", color: "#3b82f6", verdict: "BENIGN", confidence: 0.95,
        evidence: ["Port 80 indicates standard HTTP service", "TCP protocol matches HTTP expectations", "PSH+ACK flags indicate normal data transfer"],
        reasoning: "Destination port 80 is the standard HTTP port. TCP protocol is expected for HTTP. The PSH+ACK flags indicate active data transfer, consistent with a web page request-response cycle. All protocol fields are internally consistent with legitimate web browsing.",
      },
      {
        name: "Statistical", color: "#8b5cf6", verdict: "BENIGN", confidence: 0.85,
        evidence: ["Balanced IN_PKTS and OUT_PKTS indicate bidirectional traffic", "Byte volumes consistent with web page retrieval", "Duration suggests normal HTTP request-response"],
        reasoning: "The flow exhibits balanced bidirectional communication typical of HTTP — a request generates a response. Packet counts and byte volumes are within normal range for web page retrieval. No statistical anomalies detected in isolation.",
      },
      {
        name: "Behavioural", color: "#f59e0b", verdict: "MALICIOUS", confidence: 0.90,
        evidence: ["HTTP traffic on port 80 matching HOIC DDoS pattern", "Request pattern consistent with HTTP flood tooling", "Uniform request structure across connections"],
        reasoning: "The HTTP traffic pattern matches the High Orbit Ion Cannon (HOIC) DDoS tool's signature: rapid, uniform HTTP requests to port 80 designed to overwhelm web server resources. While each individual flow looks like legitimate web traffic, the attack context reveals coordinated flooding.",
      },
      {
        name: "Temporal", color: "#ec4899", verdict: "SUSPICIOUS", confidence: 0.70,
        evidence: ["Rapid connections to same destination", "Moderate frequency but sustained pattern", "Multiple flows with similar characteristics"],
        reasoning: "Multiple HTTP connections from this source IP show a sustained pattern of requests, though the temporal density is moderate. The pattern could represent either aggressive web crawling or the early stages of an HTTP flood attack.",
      },
    ],
    da: {
      confidence: 0.65,
      strongestBenign: "Standard HTTP traffic on port 80 with balanced bidirectional communication is the most common pattern on the internet — this is what normal web browsing looks like.",
      counter: "This flow represents standard web browsing activity. Port 80 HTTP traffic with balanced request-response patterns is the most common type of network traffic on any corporate or residential network. The packet sizes and duration are consistent with loading a web page. The 'rapid connections' pattern could easily be a user browsing a content-rich website that requires multiple HTTP requests for images, scripts, and stylesheets.",
    },
    orchestratorReasoning: "The analyses present mixed evidence. Protocol and Statistical agents strongly suggest benign HTTP traffic, with all fields matching standard web browsing patterns. Behavioural flags the HOIC pattern but with limited individual-flow evidence. Temporal is only moderately suspicious. The Devil's Advocate makes a compelling argument — this looks identical to normal web browsing. The low consensus (55%) reflects genuine ambiguity. This is exactly the class of flow where DA suppresses correct detections: the DDoS attack deliberately mimics legitimate traffic, and DA's benign argument is technically correct for each individual flow. Verdict: SUSPICIOUS with low confidence.",
  },
];

const VERDICT_COLORS = { MALICIOUS: "#dc2626", SUSPICIOUS: "#d97706", BENIGN: "#16a34a" };

export default function ExplainabilityShowcase({ filter }) {
  const [expandedId, setExpandedId] = useState(null);

  const examples = filter
    ? CURATED_EXAMPLES.filter(e => e.attackType === filter)
    : CURATED_EXAMPLES;

  if (examples.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold mb-1">What AMATAS Explanations Look Like</h3>
        <p className="text-xs text-gray-500 mb-3">
          Real flows from Stage 1 experiments — click to see the full 6-agent reasoning chain.
          This is what makes AMATAS different from black-box classifiers: every verdict is traceable.
        </p>
      </div>

      {examples.map(ex => {
        const isOpen = expandedId === ex.id;
        return (
          <div key={ex.id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Clickable header */}
            <button
              onClick={() => setExpandedId(isOpen ? null : ex.id)}
              className="w-full text-left px-4 py-3 bg-white hover:bg-gray-50 cursor-pointer border-none"
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">{isOpen ? "\u25BC" : "\u25B6"}</span>
                    <span className="text-sm font-semibold text-gray-800">{ex.title}</span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      style={{ color: VERDICT_COLORS[ex.finalVerdict], background: verdictBg(ex.finalVerdict) }}
                    >
                      {ex.finalVerdict} {(ex.finalConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 m-0 leading-relaxed">{ex.subtitle}</p>
                </div>
                {/* Agent verdict pills */}
                <div className="flex gap-1 flex-shrink-0">
                  {ex.agents.map(a => (
                    <div
                      key={a.name}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                      style={{ background: VERDICT_COLORS[a.verdict] }}
                      title={`${a.name}: ${a.verdict}`}
                    >
                      {a.name[0]}
                    </div>
                  ))}
                </div>
              </div>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div className="border-t border-gray-200 px-4 py-4 bg-gray-50 space-y-3">
                {/* Decision timeline */}
                <div className="flex gap-1 items-stretch overflow-x-auto pb-1">
                  {ex.agents.map((a, i) => (
                    <React.Fragment key={a.name}>
                      {i > 0 && <div className="flex items-center text-gray-300 text-xs flex-shrink-0">&rarr;</div>}
                      <div
                        className="rounded-md px-2.5 py-1.5 text-center flex-shrink-0 min-w-[90px]"
                        style={{
                          background: verdictBg(a.verdict),
                          border: `1px solid ${VERDICT_COLORS[a.verdict]}30`,
                        }}
                      >
                        <div className="text-[10px] font-semibold" style={{ color: a.color }}>{a.name}</div>
                        <div className="text-[11px] font-medium" style={{ color: VERDICT_COLORS[a.verdict] }}>
                          {a.verdict} ({(a.confidence * 100).toFixed(0)}%)
                        </div>
                        <div className="text-[9px] text-gray-500 mt-0.5 leading-tight">
                          {a.evidence[0]?.slice(0, 50)}
                        </div>
                      </div>
                    </React.Fragment>
                  ))}
                  <div className="flex items-center text-gray-300 text-xs flex-shrink-0">&rarr;</div>
                  <div
                    className="rounded-md px-2.5 py-1.5 text-center flex-shrink-0 min-w-[90px]"
                    style={{ background: "#fef2f2", border: "1px solid #ef444430" }}
                  >
                    <div className="text-[10px] font-semibold text-red-500">Devil's Adv.</div>
                    <div className="text-[11px] font-medium text-green-600">
                      BENIGN ({(ex.da.confidence * 100).toFixed(0)}%)
                    </div>
                  </div>
                  <div className="flex items-center text-gray-300 text-xs flex-shrink-0">&rarr;</div>
                  <div
                    className="rounded-md px-2.5 py-1.5 text-center flex-shrink-0 min-w-[90px]"
                    style={{
                      background: verdictBg(ex.finalVerdict),
                      border: `2px solid ${VERDICT_COLORS[ex.finalVerdict]}`,
                    }}
                  >
                    <div className="text-[10px] font-semibold text-emerald-600">Orchestrator</div>
                    <div className="text-[11px] font-bold" style={{ color: VERDICT_COLORS[ex.finalVerdict] }}>
                      {ex.finalVerdict} ({(ex.finalConfidence * 100).toFixed(0)}%)
                    </div>
                  </div>
                </div>

                {/* Agent disagreement callout */}
                {ex.disagreed.length > 0 && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded bg-amber-50 border border-amber-200">
                    <span className="font-semibold text-amber-700">Disagreement:</span>
                    <span className="text-amber-800">
                      {ex.disagreed.join(", ")} voted differently from {ex.agreed.join(", ")}
                    </span>
                  </div>
                )}

                {/* Specialist agent cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {ex.agents.map(a => (
                    <div key={a.name} className="border rounded-lg p-3 bg-white" style={{ borderColor: `${a.color}40` }}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold" style={{ color: a.color }}>{a.name} Agent</span>
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ color: VERDICT_COLORS[a.verdict], background: verdictBg(a.verdict) }}
                        >
                          {a.verdict} {(a.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="space-y-1 mb-2">
                        {a.evidence.map((e, i) => (
                          <div key={i} className="flex gap-1.5 text-[11px] text-gray-600">
                            <span className="text-gray-400 flex-shrink-0">&bull;</span>
                            <span>{e}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed m-0 italic">{a.reasoning}</p>
                    </div>
                  ))}
                </div>

                {/* Devil's Advocate */}
                <div className="border border-red-200 rounded-lg p-3 bg-red-50/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-red-600">Devil's Advocate</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-green-600 bg-green-50">
                      BENIGN {(ex.da.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-600 mb-1.5">
                    <strong>Strongest benign indicator:</strong> {ex.da.strongestBenign}
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed m-0 italic">{ex.da.counter}</p>
                </div>

                {/* Orchestrator final verdict */}
                <div
                  className="border-2 rounded-lg p-3"
                  style={{ borderColor: VERDICT_COLORS[ex.finalVerdict], background: verdictBg(ex.finalVerdict) }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-emerald-700">Orchestrator — Final Synthesis</span>
                    <div className="flex items-center gap-2">
                      {ex.mitre.map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600">{t}</span>
                      ))}
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{ color: VERDICT_COLORS[ex.finalVerdict], background: "#fff" }}
                      >
                        {ex.finalVerdict}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-700 leading-relaxed m-0">{ex.orchestratorReasoning}</p>
                </div>

                {/* Explainability callout */}
                <div className="text-[11px] text-gray-400 italic text-center pt-1">
                  This is one flow out of 1,000. Every LLM-analyzed flow has this full reasoning chain — click "Inspect Flows" to explore more.
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
