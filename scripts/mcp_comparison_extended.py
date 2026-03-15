#!/usr/bin/env python3
"""MCP Comparison — Extended Configs D/E/F/G with dataset-compatible tools.

Builds on the original 3 configs (A/B/C) by testing tools that actually work
on anonymized/synthetic data (no dependency on real public IPs).

Config D: Engineered prompt + IANA port-service + protocol decoder + TCP flag decoder
Config E: Engineered prompt + D tools + DShield port intelligence
Config F: Engineered prompt + D + E tools + CVE vulnerability lookup
Config G: Engineered prompt + all above + MITRE ATT&CK (full toolkit)

Same batch as original: 10 FTP + 10 SSH + 10 DoS-Hulk + 70 benign (100 flows)
Same model: GPT-4o

Usage:
    python scripts/mcp_comparison_extended.py
"""

import json
import os
import sys
import time
import requests
import numpy as np
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass

RESULTS_DIR = PROJECT_ROOT / "results" / "mcp"
BATCH_DIR = PROJECT_ROOT / "data" / "batches" / "mcp_comparison"
MITRE_TOOLS_PATH = PROJECT_ROOT / "nids-mcp-server" / "tools"
sys.path.insert(0, str(MITRE_TOOLS_PATH.parent))

HARD_BUDGET = 8.00  # USD across all new configs

MODEL_PRICING = {
    "gpt-4o": (2.50 / 1e6, 10.0 / 1e6),
    "gpt-4o-2024-08-06": (2.50 / 1e6, 10.0 / 1e6),
}

# ═══════════════════════════════════════════════════════════════════════════════
# TOOL IMPLEMENTATIONS — All work on synthetic/anonymized data
# ═══════════════════════════════════════════════════════════════════════════════

# ── IANA Port-Service Registry (local lookup, no API call needed) ────────────
IANA_SERVICES = {
    7: "echo", 20: "ftp-data", 21: "ftp", 22: "ssh", 23: "telnet",
    25: "smtp", 53: "dns", 67: "dhcp-server", 68: "dhcp-client",
    69: "tftp", 80: "http", 88: "kerberos", 110: "pop3", 119: "nntp",
    123: "ntp", 135: "msrpc", 137: "netbios-ns", 138: "netbios-dgm",
    139: "netbios-ssn", 143: "imap", 161: "snmp", 162: "snmptrap",
    179: "bgp", 194: "irc", 389: "ldap", 443: "https", 445: "microsoft-ds",
    465: "smtps", 514: "syslog", 515: "printer", 520: "rip", 523: "ibm-db2",
    554: "rtsp", 587: "submission", 631: "ipp", 636: "ldaps",
    993: "imaps", 995: "pop3s", 1080: "socks", 1433: "ms-sql-s",
    1434: "ms-sql-m", 1521: "oracle", 1723: "pptp", 2049: "nfs",
    2082: "cpanel", 2083: "cpanel-ssl", 2086: "whm", 2087: "whm-ssl",
    3306: "mysql", 3389: "ms-wbt-server", 5060: "sip", 5061: "sips",
    5432: "postgresql", 5900: "vnc", 5985: "wsman", 5986: "wsmans",
    6379: "redis", 6667: "irc", 8080: "http-proxy", 8443: "https-alt",
    8888: "http-alt", 9090: "zeus-admin", 9200: "elasticsearch",
    27017: "mongodb",
}

def handle_iana_port_lookup(args):
    """Look up IANA registered service for a port number."""
    port = args.get("port")
    protocol = args.get("protocol", "tcp").lower()
    if port is None:
        return {"success": False, "error": "port parameter required"}
    port = int(port)
    service = IANA_SERVICES.get(port)
    if service:
        is_well_known = port < 1024
        is_ephemeral = port >= 49152
        is_registered = 1024 <= port < 49152
        return {
            "success": True, "port": port, "service_name": service,
            "transport_protocol": protocol,
            "port_class": "well-known" if is_well_known else "registered" if is_registered else "ephemeral",
            "description": f"IANA-registered service '{service}' on {protocol.upper()}/{port}",
            "security_notes": _port_security_notes(port, service),
        }
    else:
        return {
            "success": True, "port": port, "service_name": None,
            "transport_protocol": protocol,
            "port_class": "ephemeral" if port >= 49152 else "unregistered/dynamic",
            "description": f"No IANA-registered service for {protocol.upper()}/{port}",
            "security_notes": "Unregistered port; could be application-specific or ephemeral source port.",
        }

def _port_security_notes(port, service):
    notes = {
        21: "FTP: Clear-text authentication. Common brute force target (T1110). Check for rapid connection attempts.",
        22: "SSH: Common brute force target (T1110). Look for repeated short connections from same source.",
        23: "Telnet: Clear-text protocol, severe security risk. Should not be exposed.",
        25: "SMTP: Email relay. Can be used for spam or phishing (T1566).",
        53: "DNS: Can be used for DNS tunneling (T1071.004) or amplification attacks.",
        80: "HTTP: Web traffic. Target for HTTP floods (DoS), web app attacks (SQLi, XSS).",
        123: "NTP: Can be used for amplification DDoS attacks.",
        443: "HTTPS: Encrypted web traffic. Hard to inspect. Used by C2 channels.",
        445: "SMB: Common target for EternalBlue, WannaCry. Lateral movement (T1021.002).",
        3306: "MySQL: Database. Should never be exposed externally. Brute force target.",
        3389: "RDP: Remote Desktop. High-value brute force target (T1021.001).",
        5432: "PostgreSQL: Database. Should never be exposed externally.",
        8080: "HTTP-proxy: Alternative web port. Common for web applications and proxies.",
    }
    return notes.get(port, f"Standard service '{service}' on port {port}.")


# ── Protocol Decoder ─────────────────────────────────────────────────────────
PROTOCOL_MAP = {
    0: ("HOPOPT", "IPv6 Hop-by-Hop Option"),
    1: ("ICMP", "Internet Control Message Protocol — ping, traceroute, error messages"),
    2: ("IGMP", "Internet Group Management Protocol — multicast group management"),
    6: ("TCP", "Transmission Control Protocol — reliable, connection-oriented, stateful"),
    17: ("UDP", "User Datagram Protocol — unreliable, connectionless, stateless"),
    41: ("IPv6-encap", "IPv6 encapsulation"),
    47: ("GRE", "Generic Routing Encapsulation — tunneling protocol"),
    50: ("ESP", "Encapsulating Security Payload — IPsec encryption"),
    51: ("AH", "Authentication Header — IPsec authentication"),
    58: ("ICMPv6", "ICMP for IPv6"),
    89: ("OSPF", "Open Shortest Path First — routing protocol"),
    132: ("SCTP", "Stream Control Transmission Protocol — reliable message-oriented"),
}

def handle_protocol_decode(args):
    """Decode IP protocol number to name and description."""
    proto = args.get("protocol_number")
    if proto is None:
        return {"success": False, "error": "protocol_number parameter required"}
    proto = int(proto)
    if proto in PROTOCOL_MAP:
        name, desc = PROTOCOL_MAP[proto]
        return {
            "success": True, "protocol_number": proto,
            "protocol_name": name, "description": desc,
            "is_connection_oriented": proto == 6,
            "is_encrypted": proto in (50, 51),
        }
    return {
        "success": True, "protocol_number": proto,
        "protocol_name": f"Protocol-{proto}", "description": f"Less common IP protocol number {proto}",
        "is_connection_oriented": False, "is_encrypted": False,
    }


# ── TCP Flag Decoder ─────────────────────────────────────────────────────────
TCP_FLAG_BITS = [
    (0x01, "FIN", "Connection teardown — no more data from sender"),
    (0x02, "SYN", "Synchronize sequence numbers — connection initiation"),
    (0x04, "RST", "Reset connection — abrupt termination, rejected attempt, or error"),
    (0x08, "PSH", "Push data immediately — do not buffer"),
    (0x10, "ACK", "Acknowledgment — confirms receipt of data"),
    (0x20, "URG", "Urgent pointer — out-of-band data"),
    (0x40, "ECE", "ECN-Echo — congestion notification"),
    (0x80, "CWR", "Congestion Window Reduced"),
]

def handle_tcp_flags_decode(args):
    """Decode TCP flags bitmask to individual flag names and security implications."""
    flags_value = args.get("flags_value")
    if flags_value is None:
        return {"success": False, "error": "flags_value parameter required"}
    flags_value = int(flags_value)

    active_flags = []
    inactive_flags = []
    for bit, name, desc in TCP_FLAG_BITS:
        if flags_value & bit:
            active_flags.append({"flag": name, "description": desc})
        else:
            inactive_flags.append(name)

    flag_names = [f["flag"] for f in active_flags]

    # Security analysis
    security_notes = []
    if "SYN" in flag_names and "ACK" not in flag_names and "RST" not in flag_names:
        security_notes.append("SYN-only: Could indicate SYN scan or initial connection attempt.")
    if "RST" in flag_names:
        security_notes.append("RST present: Connection was reset. In aggregate flow flags, indicates at least one rejected/aborted connection during the flow lifetime.")
    if "SYN" in flag_names and "RST" in flag_names:
        security_notes.append("SYN+RST combination: Connection attempts that were rejected. Common in brute force (failed login) and port scanning.")
    if "FIN" in flag_names and "SYN" in flag_names:
        security_notes.append("FIN+SYN: Full connection lifecycle observed (setup through teardown). Normal for completed connections.")
    if "PSH" in flag_names and "ACK" in flag_names:
        security_notes.append("PSH+ACK: Active data transfer occurred. Normal for established connections.")
    if flags_value == 0:
        security_notes.append("No TCP flags set: Likely a non-TCP flow (UDP/ICMP) or a NULL scan.")
    if "SYN" in flag_names and "FIN" in flag_names and "PSH" in flag_names and "ACK" in flag_names:
        security_notes.append("Multiple lifecycle flags (SYN+FIN+PSH+ACK): Complete session observed. Normal aggregate for a standard TCP connection.")

    return {
        "success": True,
        "flags_value": flags_value,
        "flags_binary": format(flags_value, '08b'),
        "active_flags": active_flags,
        "inactive_flags": inactive_flags,
        "flag_summary": "+".join(flag_names) if flag_names else "NONE",
        "security_analysis": security_notes,
        "note": "TCP_FLAGS in NetFlow is the cumulative OR of all TCP flags across the entire flow, not a single packet."
    }


# ── DShield Port Intelligence (live API, no auth needed) ─────────────────────
_dshield_cache = {}

def handle_dshield_port(args):
    """Query SANS DShield for real-world attack statistics on a port."""
    port = args.get("port")
    if port is None:
        return {"success": False, "error": "port parameter required"}
    port = int(port)

    if port in _dshield_cache:
        return _dshield_cache[port]

    try:
        resp = requests.get(
            f"https://isc.sans.edu/api/port/{port}?json",
            headers={"User-Agent": "AMATAS-Thesis-Research/1.0 (kunwar@university)"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            # DShield returns a list with one entry
            if isinstance(data, list) and data:
                entry = data[0]
            elif isinstance(data, dict):
                entry = data
            else:
                entry = {}

            result = {
                "success": True,
                "port": port,
                "records": int(entry.get("records", 0)),
                "targets": int(entry.get("targets", 0)),
                "sources": int(entry.get("sources", 0)),
                "tcp_records": int(entry.get("tcprecords", 0)),
                "udp_records": int(entry.get("udprecords", 0)),
                "service_name": entry.get("servicename", "unknown"),
                "threat_level": _classify_port_threat(int(entry.get("records", 0)), int(entry.get("sources", 0))),
                "description": f"DShield global statistics for port {port}. "
                    f"Records: {entry.get('records', 0)}, "
                    f"Unique attackers: {entry.get('sources', 0)}, "
                    f"Unique targets: {entry.get('targets', 0)}.",
            }
            _dshield_cache[port] = result
            return result
        else:
            return {"success": False, "error": f"DShield API returned {resp.status_code}"}
    except Exception as e:
        return {"success": False, "error": f"DShield API error: {str(e)[:100]}"}


def _classify_port_threat(records, sources):
    if sources > 10000:
        return "HIGH — heavily targeted port with thousands of unique attackers globally"
    elif sources > 1000:
        return "MEDIUM — moderately targeted port"
    elif sources > 100:
        return "LOW — occasionally targeted"
    else:
        return "MINIMAL — rarely targeted"


# ── CVE Vulnerability Lookup (Shodan CVEDB, free, no auth) ───────────────────
_cve_cache = {}

def handle_cve_lookup(args):
    """Search for known CVEs affecting a service/product."""
    query = args.get("query", "")
    if not query:
        return {"success": False, "error": "query parameter required (e.g., 'openssh', 'vsftpd', 'apache httpd')"}

    if query in _cve_cache:
        return _cve_cache[query]

    try:
        resp = requests.get(
            f"https://cvedb.shodan.io/cves?product={query}&count=true&limit=5&sort_by_epss=true",
            headers={"User-Agent": "AMATAS-Thesis-Research/1.0"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            cves = data.get("cves", [])
            total = data.get("total", 0)

            result = {
                "success": True,
                "query": query,
                "total_cves": total,
                "top_cves": [
                    {
                        "cve_id": c.get("cve_id", ""),
                        "summary": (c.get("summary", "") or "")[:200],
                        "cvss": c.get("cvss", 0),
                        "epss": c.get("epss", 0),
                        "published": c.get("published_time", ""),
                    }
                    for c in cves[:5]
                ],
                "description": f"Found {total} known vulnerabilities for '{query}'. "
                    f"{'High vulnerability count suggests this is a commonly targeted service.' if total > 50 else 'Moderate vulnerability history.'}",
            }
            _cve_cache[query] = result
            return result
        else:
            return {"success": False, "error": f"CVEDB API returned {resp.status_code}"}
    except Exception as e:
        return {"success": False, "error": f"CVEDB error: {str(e)[:100]}"}


# ── MITRE (reuse from original mcp_comparison.py) ────────────────────────────
def handle_mitre_tool_call(fn_name, fn_args):
    from tools.mitre_attack import get_mitre_data
    mitre_data = get_mitre_data()
    techniques = mitre_data.get("techniques", {})

    if fn_name == "query_mitre_technique":
        tid = fn_args.get("technique_id", "").upper().strip()
        if tid in techniques:
            t = techniques[tid]
            return {"success": True, "technique_id": tid, "name": t["name"],
                    "tactics": t["tactics"], "description": t["description"][:500],
                    "detection": t.get("detection", "")[:300]}
        return {"success": False, "error": f"Technique {tid} not found"}

    elif fn_name == "search_mitre_techniques":
        query = fn_args.get("query", "").lower()
        results = []
        for tid, t in techniques.items():
            if query in t["name"].lower() or query in t["description"].lower():
                results.append({"technique_id": tid, "name": t["name"],
                                "tactics": t["tactics"], "description": t["description"][:150]})
                if len(results) >= 5:
                    break
        return {"success": True, "query": query, "result_count": len(results), "results": results}

    return {"success": False, "error": f"Unknown tool: {fn_name}"}


# ═══════════════════════════════════════════════════════════════════════════════
# TOOL DISPATCH & OPENAI DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

TOOL_HANDLERS = {
    "iana_port_lookup": handle_iana_port_lookup,
    "decode_protocol": handle_protocol_decode,
    "decode_tcp_flags": handle_tcp_flags_decode,
    "dshield_port_intel": handle_dshield_port,
    "cve_lookup": handle_cve_lookup,
    "query_mitre_technique": handle_mitre_tool_call,
    "search_mitre_techniques": handle_mitre_tool_call,
}

OPENAI_TOOLS_FEATURE = [
    {"type": "function", "function": {
        "name": "iana_port_lookup",
        "description": "Look up the IANA-registered service name for a port number. Returns service name, port classification (well-known/registered/ephemeral), and security notes.",
        "parameters": {"type": "object", "properties": {
            "port": {"type": "integer", "description": "Port number to look up (0-65535)"},
            "protocol": {"type": "string", "description": "Transport protocol: 'tcp' or 'udp'", "default": "tcp"},
        }, "required": ["port"]},
    }},
    {"type": "function", "function": {
        "name": "decode_protocol",
        "description": "Decode an IP protocol number to its name and description. E.g., 6=TCP, 17=UDP, 1=ICMP.",
        "parameters": {"type": "object", "properties": {
            "protocol_number": {"type": "integer", "description": "IP protocol number from the PROTOCOL field"},
        }, "required": ["protocol_number"]},
    }},
    {"type": "function", "function": {
        "name": "decode_tcp_flags",
        "description": "Decode a TCP flags bitmask value into individual flag names (SYN, ACK, RST, FIN, PSH, URG) with security analysis. Note: NetFlow TCP_FLAGS is the cumulative OR of all flags across the entire flow.",
        "parameters": {"type": "object", "properties": {
            "flags_value": {"type": "integer", "description": "TCP_FLAGS numeric value from the NetFlow record"},
        }, "required": ["flags_value"]},
    }},
]

OPENAI_TOOLS_DSHIELD = [
    {"type": "function", "function": {
        "name": "dshield_port_intel",
        "description": "Query SANS DShield Internet Storm Center for real-world global attack statistics on a port. Returns number of attack records, unique attacker sources, and threat level. This data reflects actual Internet-wide scanning and attack activity.",
        "parameters": {"type": "object", "properties": {
            "port": {"type": "integer", "description": "Port number to query"},
        }, "required": ["port"]},
    }},
]

OPENAI_TOOLS_CVE = [
    {"type": "function", "function": {
        "name": "cve_lookup",
        "description": "Search for known CVE vulnerabilities affecting a software product or service. Returns top CVEs ranked by EPSS (exploit probability). Use with service names like 'openssh', 'vsftpd', 'apache httpd', 'nginx'.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "Product or service name to search (e.g., 'openssh', 'proftpd', 'apache')"},
        }, "required": ["query"]},
    }},
]

OPENAI_TOOLS_MITRE = [
    {"type": "function", "function": {
        "name": "query_mitre_technique",
        "description": "Query a specific MITRE ATT&CK technique by ID. Returns description, detection methods, and tactics.",
        "parameters": {"type": "object", "properties": {
            "technique_id": {"type": "string", "description": "MITRE ATT&CK technique ID (e.g., 'T1110', 'T1498')"},
        }, "required": ["technique_id"]},
    }},
    {"type": "function", "function": {
        "name": "search_mitre_techniques",
        "description": "Search MITRE ATT&CK by keyword. Returns matching techniques with IDs and descriptions.",
        "parameters": {"type": "object", "properties": {
            "query": {"type": "string", "description": "Search keyword (e.g., 'brute force', 'denial of service')"},
        }, "required": ["query"]},
    }},
]

# ── Config definitions ───────────────────────────────────────────────────────

# Import the engineered prompt from original comparison
from scripts.mcp_comparison import ENGINEERED_SYSTEM

TOOL_AUGMENTED_SYSTEM = ENGINEERED_SYSTEM + """

You have access to tools that can help you analyse this flow more accurately.
USE THEM. Before classifying, you should:
1. Use decode_protocol to identify the exact transport protocol.
2. Use decode_tcp_flags to understand which TCP flags are set (if TCP).
3. Use iana_port_lookup to identify what service the destination port is registered for.
4. Use any other available tools (DShield, CVE, MITRE) to enrich your analysis.

Do NOT guess protocol names, flag values, or service names — use the tools to verify.

Add to your JSON response:
  "tools_used": ["tool1", "tool2", ...]
"""

CONFIGS = {
    "D": {
        "name": "D: Feature decoders (IANA + protocol + TCP flags)",
        "tools": OPENAI_TOOLS_FEATURE,
        "system": TOOL_AUGMENTED_SYSTEM,
    },
    "E": {
        "name": "E: Feature decoders + DShield port intel",
        "tools": OPENAI_TOOLS_FEATURE + OPENAI_TOOLS_DSHIELD,
        "system": TOOL_AUGMENTED_SYSTEM,
    },
    "F": {
        "name": "F: Feature decoders + DShield + CVE lookup",
        "tools": OPENAI_TOOLS_FEATURE + OPENAI_TOOLS_DSHIELD + OPENAI_TOOLS_CVE,
        "system": TOOL_AUGMENTED_SYSTEM,
    },
    "G": {
        "name": "G: Full toolkit (all above + MITRE ATT&CK)",
        "tools": OPENAI_TOOLS_FEATURE + OPENAI_TOOLS_DSHIELD + OPENAI_TOOLS_CVE + OPENAI_TOOLS_MITRE,
        "system": TOOL_AUGMENTED_SYSTEM,
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
# LLM CALLING (extended to handle multiple tool call rounds)
# ═══════════════════════════════════════════════════════════════════════════════

def call_openai(model, system_prompt, user_prompt, tools=None):
    import openai
    client = openai.OpenAI(timeout=120.0)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    kwargs = dict(model=model, max_tokens=2048, messages=messages)
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    pricing = MODEL_PRICING.get(model, (2.50 / 1e6, 10.0 / 1e6))
    total_cost = 0.0
    total_in = 0
    total_out = 0
    all_tool_calls = []
    max_rounds = 5  # Prevent infinite tool-call loops

    for round_num in range(max_rounds):
        response = client.chat.completions.create(**kwargs)
        total_in += response.usage.prompt_tokens
        total_out += response.usage.completion_tokens
        total_cost += response.usage.prompt_tokens * pricing[0] + response.usage.completion_tokens * pricing[1]

        msg = response.choices[0].message

        if not msg.tool_calls:
            # No more tool calls — return final text
            text = msg.content or ""
            parsed = parse_json(text)
            return parsed, total_cost, text, {"input": total_in, "output": total_out}, all_tool_calls

        # Process tool calls
        messages.append(msg)
        for tc in msg.tool_calls:
            fn_name = tc.function.name
            fn_args = json.loads(tc.function.arguments)

            # Dispatch to handler
            if fn_name in ("query_mitre_technique", "search_mitre_techniques"):
                result = handle_mitre_tool_call(fn_name, fn_args)
            elif fn_name in TOOL_HANDLERS:
                result = TOOL_HANDLERS[fn_name](fn_args)
            else:
                result = {"success": False, "error": f"Unknown tool: {fn_name}"}

            all_tool_calls.append({
                "round": round_num + 1,
                "tool": fn_name,
                "args": fn_args,
                "result_preview": str(result)[:300],
            })
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result),
            })

        # Remove tools for next round to avoid infinite loops on last round
        if round_num == max_rounds - 2:
            kwargs.pop("tools", None)
            kwargs.pop("tool_choice", None)
        kwargs["messages"] = messages

    # Fallback
    return {"verdict": "SUSPICIOUS", "confidence": 0.3, "reasoning": "Max tool rounds exceeded"}, total_cost, "", {"input": total_in, "output": total_out}, all_tool_calls


def parse_json(text):
    import re
    m = re.search(r'```(?:json)?\s*\n(.*?)\n```', text, re.DOTALL)
    if m:
        try: return json.loads(m.group(1))
        except: pass
    stripped = text.strip()
    if stripped.startswith('{'):
        try: return json.loads(stripped)
        except: pass
    depth = 0; start = None; best = None
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0: start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                try:
                    parsed = json.loads(text[start:i+1])
                    if best is None or (i+1-start) > len(best[1]):
                        best = (parsed, text[start:i+1])
                except: pass
                start = None
    return best[0] if best else {"verdict": "SUSPICIOUS", "confidence": 0.3, "reasoning": "Parse failed"}


# ═══════════════════════════════════════════════════════════════════════════════
# EXPERIMENT RUNNER
# ═══════════════════════════════════════════════════════════════════════════════

def log(msg):
    ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def run_config(config_key, flows, labels, budget_remaining):
    cfg = CONFIGS[config_key]
    model = "gpt-4o-2024-08-06"

    log(f"\n{'='*60}")
    log(f"CONFIG {config_key}: {cfg['name']}")
    log(f"Tools: {len(cfg['tools'])} | Budget: ${budget_remaining:.2f}")
    log(f"{'='*60}")

    results = []
    total_cost = 0.0
    total_tool_calls = 0

    for i, (flow, label) in enumerate(zip(flows, labels)):
        if total_cost >= budget_remaining:
            log(f"  BUDGET at flow {i}")
            break

        flow_features = {k: v for k, v in flow.items() if k != "flow_id"}
        user_prompt = f"Analyze this NetFlow record:\n\n{json.dumps(flow_features, indent=2)}"

        t0 = time.time()
        try:
            parsed, cost, raw, tokens, tool_calls = call_openai(
                model, cfg["system"], user_prompt, tools=cfg["tools"]
            )
        except Exception as e:
            log(f"  ERROR flow {i}: {e}")
            parsed = {"verdict": "SUSPICIOUS", "confidence": 0.3, "reasoning": str(e)}
            cost, tokens, tool_calls = 0.0, {"input": 0, "output": 0}, []
        elapsed = time.time() - t0

        verdict = parsed.get("verdict", "SUSPICIOUS").upper()
        total_cost += cost
        total_tool_calls += len(tool_calls)

        results.append({
            "flow_idx": i,
            "flow_id": flow.get("flow_id", i),
            "verdict": verdict,
            "confidence": parsed.get("confidence", 0.5),
            "attack_type_predicted": parsed.get("attack_type"),
            "reasoning": parsed.get("reasoning", ""),
            "key_findings": parsed.get("key_findings", []),
            "mitre_techniques": parsed.get("mitre_techniques", []),
            "tools_used": parsed.get("tools_used", []),
            "label_actual": label["label"],
            "attack_type_actual": label["attack_type"],
            "cost_usd": cost,
            "time_seconds": elapsed,
            "tokens": tokens,
            "tool_calls": tool_calls,
        })

        if (i + 1) % 10 == 0 or i == len(flows) - 1:
            is_pred_pos = verdict in ("MALICIOUS", "SUSPICIOUS")
            is_actual_pos = label["label"] == 1
            correct = "OK" if (is_pred_pos == is_actual_pos) else "MISS" if is_actual_pos else "FP"
            log(f"  [{i+1}/{len(flows)}] {label['attack_type']:<20} -> {verdict:<10} ({correct}) tools:{len(tool_calls)} ${total_cost:.3f}")

    # Metrics
    tp = sum(1 for r, l in zip(results, labels[:len(results)]) if r["verdict"] in ("MALICIOUS", "SUSPICIOUS") and l["label"] == 1)
    fp = sum(1 for r, l in zip(results, labels[:len(results)]) if r["verdict"] in ("MALICIOUS", "SUSPICIOUS") and l["label"] == 0)
    fn = sum(1 for r, l in zip(results, labels[:len(results)]) if r["verdict"] == "BENIGN" and l["label"] == 1)
    tn = sum(1 for r, l in zip(results, labels[:len(results)]) if r["verdict"] == "BENIGN" and l["label"] == 0)

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0

    metrics = {
        "config": config_key,
        "config_name": cfg["name"],
        "model": model,
        "total_flows": len(results),
        "total_cost": round(total_cost, 4),
        "total_tool_calls": total_tool_calls,
        "avg_tools_per_flow": round(total_tool_calls / len(results), 1) if results else 0,
        "recall": round(recall * 100, 1),
        "precision": round(precision * 100, 1),
        "f1": round(f1 * 100, 1),
        "fpr": round(fpr * 100, 1),
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "cost_per_flow": round(total_cost / len(results), 4) if results else 0,
    }

    log(f"\n  Results: Recall={metrics['recall']}% | FPR={metrics['fpr']}% | F1={metrics['f1']}% | Cost=${metrics['total_cost']}")
    log(f"  Confusion: TP={tp} FP={fp} FN={fn} TN={tn}")
    log(f"  Tool calls: {total_tool_calls} total ({metrics['avg_tools_per_flow']}/flow avg)")

    return {"metrics": metrics, "results": results}


def main():
    log("=" * 60)
    log("MCP COMPARISON — EXTENDED (Configs D/E/F/G)")
    log(f"Budget: ${HARD_BUDGET} | Dataset-compatible tools")
    log("=" * 60)

    # Load existing batch
    with open(BATCH_DIR / "flows.json") as f:
        flows = json.load(f)
    with open(BATCH_DIR / "ground_truth.json") as f:
        gt = json.load(f)
    labels = gt["ground_truth"]
    log(f"Loaded batch: {len(flows)} flows")

    total_spent = 0.0
    all_results = {}

    for config_key in ["D", "E", "F", "G"]:
        budget = max(2.00, (HARD_BUDGET - total_spent) / (ord("G") - ord(config_key) + 1))
        result = run_config(config_key, flows, labels, budget)
        total_spent += result["metrics"]["total_cost"]
        all_results[config_key] = result

        # Save per-config results
        with open(RESULTS_DIR / f"config_{config_key.lower()}_results.json", "w") as f:
            json.dump(result, f, indent=2)
        log(f"  Saved config_{config_key.lower()}_results.json")

    # Load original results for comparison
    original_configs = {}
    for letter in ["a", "b", "c"]:
        path = RESULTS_DIR / f"config_{letter}_results.json"
        if path.exists():
            with open(path) as f:
                data = json.load(f)
            original_configs[letter.upper()] = data["metrics"]

    # Print comparison table
    print(f"\n{'='*100}")
    print(f"FULL COMPARISON: ALL 7 CONFIGS")
    print(f"{'='*100}")
    print(f"{'Config':<50} | {'Recall':>7} | {'FPR':>5} | {'F1':>5} | {'Cost':>7} | {'Tools/flow':>10}")
    print("-" * 100)

    for letter in ["A", "B", "C"]:
        if letter in original_configs:
            m = original_configs[letter]
            names = {"A": "A: Zero-shot (gpt-4o-mini)", "B": "B: Engineered prompt", "C": "C: Engineered + MITRE only"}
            print(f"{names[letter]:<50} | {m['recall']:>6.1f}% | {m['fpr']:>4.1f}% | {m['f1']:>4.1f}% | ${m['total_cost']:>6.2f} | {'N/A':>10}")

    for letter in ["D", "E", "F", "G"]:
        m = all_results[letter]["metrics"]
        print(f"{m['config_name']:<50} | {m['recall']:>6.1f}% | {m['fpr']:>4.1f}% | {m['f1']:>4.1f}% | ${m['total_cost']:>6.2f} | {m['avg_tools_per_flow']:>10.1f}")

    print(f"{'AMATAS v2 (6-agent + RF) [5% attack, 1000 flows]':<50} | {'85.0':>6}% | {'1.1':>4}% | {'88.0':>4}% | ${'2.59':>6} | {'N/A':>10}")
    print("-" * 100)
    print(f"Extended configs cost: ${total_spent:.2f}")

    # Save extended summary
    summary = {
        "extended_configs": {k: v["metrics"] for k, v in all_results.items()},
        "original_configs": original_configs,
        "amatas_baseline": {"recall": 85, "fpr": 1.1, "f1": 88, "cost_per_1000": 2.59},
        "total_cost": round(total_spent, 4),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tools_tested": {
            "D": ["iana_port_lookup", "decode_protocol", "decode_tcp_flags"],
            "E": ["iana_port_lookup", "decode_protocol", "decode_tcp_flags", "dshield_port_intel"],
            "F": ["iana_port_lookup", "decode_protocol", "decode_tcp_flags", "dshield_port_intel", "cve_lookup"],
            "G": ["iana_port_lookup", "decode_protocol", "decode_tcp_flags", "dshield_port_intel", "cve_lookup", "query_mitre_technique", "search_mitre_techniques"],
        },
    }
    with open(RESULTS_DIR / "extended_comparison_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    log(f"\nDone! Total: ${total_spent:.2f} / ${HARD_BUDGET:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
