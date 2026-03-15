#!/usr/bin/env python3
"""
Faithfulness Audit for AMATAS Agent Reasoning Chains

Extracts factual claims from agent reasoning/key_evidence text and verifies
them against the actual flow features. Reports:
  - Total claims extracted
  - Claims that reference verifiable flow features
  - Of those, how many are factually correct vs. incorrect
  - Confabulation rate (incorrect claims / verifiable claims)

Output: JSON report + human-readable summary, suitable for thesis inclusion.
"""

import json
import re
import sys
from pathlib import Path
from collections import defaultdict

# ── Mappings ──────────────────────────────────────────────────────────────────

PROTOCOL_MAP = {
    1: "ICMP", 6: "TCP", 17: "UDP", 58: "ICMPv6",
    # common aliases
}
PROTOCOL_NAMES = {v.lower(): k for k, v in PROTOCOL_MAP.items()}

# TCP flag bitmask (standard Netflow TCP_FLAGS encoding)
TCP_FLAG_BITS = {
    "FIN": 0x01, "SYN": 0x02, "RST": 0x04, "PSH": 0x08,
    "ACK": 0x10, "URG": 0x20, "ECE": 0x40, "CWR": 0x80,
}

# Well-known ports
WELL_KNOWN_PORTS = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS",
    80: "HTTP", 443: "HTTPS", 110: "POP3", 143: "IMAP",
    3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 8080: "HTTP-alt",
    8443: "HTTPS-alt", 445: "SMB", 139: "NetBIOS", 161: "SNMP",
}

RESULTS_DIR = Path(__file__).parent.parent / "results" / "stage1"

# ── Claim extractors ─────────────────────────────────────────────────────────

def extract_port_claims(text):
    """Extract claims about port numbers from text."""
    claims = []
    # "port 21", "Port 21", "port number 21", "destination port 21"
    for m in re.finditer(
        r'(?:destination|dst|source|src|L4_DST_PORT|L4_SRC_PORT)[\s_]*(?:port)?[\s:=]*(\d+)',
        text, re.IGNORECASE
    ):
        port = int(m.group(1))
        # determine direction from context
        ctx = text[max(0, m.start()-40):m.end()+40].lower()
        direction = "dst" if any(w in ctx for w in ["dest", "dst", "l4_dst"]) else \
                    "src" if any(w in ctx for w in ["source", "src", "l4_src"]) else "unknown"
        claims.append({"type": "port", "value": port, "direction": direction,
                        "raw": m.group(0).strip()})

    # "port 21" without direction prefix
    for m in re.finditer(r'\bport\s+(\d+)\b', text, re.IGNORECASE):
        port = int(m.group(1))
        # skip if already captured with direction
        if not any(c["value"] == port for c in claims):
            claims.append({"type": "port", "value": port, "direction": "either",
                            "raw": m.group(0).strip()})

    # "L4_DST_PORT 21" or "L4_SRC_PORT 40332" (exact field references)
    for m in re.finditer(r'(L4_(?:DST|SRC)_PORT)\s+(\d+)', text):
        field = m.group(1)
        port = int(m.group(2))
        direction = "dst" if "DST" in field else "src"
        if not any(c["value"] == port and c["direction"] == direction for c in claims):
            claims.append({"type": "port_exact", "value": port, "direction": direction,
                            "field": field, "raw": m.group(0).strip()})
    return claims


def extract_protocol_claims(text):
    """Extract claims about protocol type."""
    claims = []
    # "PROTOCOL 6", "PROTOCOL: 6"
    for m in re.finditer(r'PROTOCOL\s*[:=]?\s*(\d+)', text):
        claims.append({"type": "protocol_num", "value": int(m.group(1)),
                        "raw": m.group(0).strip()})

    # "TCP", "UDP", "ICMP" as protocol assertions (not in generic words)
    for m in re.finditer(r'\b(TCP|UDP|ICMPv?6?)\b', text):
        name = m.group(1).upper()
        if name == "ICMPV6":
            name = "ICMPv6"
        claims.append({"type": "protocol_name", "value": name,
                        "raw": m.group(0).strip()})
    return claims


def extract_tcp_flag_claims(text):
    """Extract claims about TCP flags."""
    claims = []
    # "TCP_FLAGS 22", "TCP_FLAGS: 22"
    for m in re.finditer(r'TCP_FLAGS\s*[:=]?\s*(\d+)', text):
        claims.append({"type": "tcp_flags_num", "value": int(m.group(1)),
                        "raw": m.group(0).strip()})

    # Individual flag names: "SYN flag", "RST flag", "SYN-ACK", "SYN+ACK"
    for m in re.finditer(
        r'\b((?:SYN|ACK|RST|FIN|PSH|URG|ECE|CWR)(?:[\s+\-/,]+(?:SYN|ACK|RST|FIN|PSH|URG|ECE|CWR))*)\b',
        text
    ):
        flags_str = m.group(1).upper()
        flag_names = re.split(r'[\s+\-/,]+', flags_str)
        flag_names = [f.strip() for f in flag_names if f.strip() in TCP_FLAG_BITS]
        if flag_names:
            claims.append({"type": "tcp_flag_names", "value": flag_names,
                            "raw": m.group(0).strip()})
    return claims


def extract_numeric_claims(text):
    """Extract claims about specific numeric feature values."""
    claims = []

    # Exact field references: "IN_BYTES 60", "OUT_PKTS 0", "FLOW_DURATION_MILLISECONDS 1"
    field_patterns = [
        ("IN_BYTES", r'IN_BYTES\s*[:=]?\s*(\d+)'),
        ("OUT_BYTES", r'OUT_BYTES\s*[:=]?\s*(\d+)'),
        ("IN_PKTS", r'IN_PKTS?\s*[:=]?\s*(\d+)'),
        ("OUT_PKTS", r'OUT_PKTS?\s*[:=]?\s*(\d+)'),
        ("FLOW_DURATION_MILLISECONDS", r'(?:FLOW_)?DURATION(?:_MILLISECONDS)?\s*[:=]?\s*(\d+)\s*(?:ms|millisecond)?'),
        ("SRC_TO_DST_IAT_MAX", r'SRC_TO_DST_IAT_MAX\s*[:=]?\s*(\d+)'),
        ("DST_TO_SRC_IAT_MAX", r'DST_TO_SRC_IAT_MAX\s*[:=]?\s*(\d+)'),
        ("DNS_QUERY_ID", r'DNS_QUERY_ID\s*[:=]?\s*(\d+)'),
    ]
    for field, pattern in field_patterns:
        for m in re.finditer(pattern, text, re.IGNORECASE):
            claims.append({"type": "numeric_exact", "field": field,
                            "value": int(m.group(1)), "raw": m.group(0).strip()})

    # Natural language numeric claims
    # "60 bytes in" / "IN_BYTES of 60" / "received 60 bytes"
    for m in re.finditer(r'(\d+)\s*bytes?\s*(?:in\b|inbound|received|from src)', text, re.IGNORECASE):
        val = int(m.group(1))
        if not any(c.get("field") == "IN_BYTES" and c["value"] == val for c in claims):
            claims.append({"type": "numeric_natural", "field": "IN_BYTES",
                            "value": val, "raw": m.group(0).strip()})

    for m in re.finditer(r'(\d+)\s*bytes?\s*(?:out\b|outbound|sent|to dst)', text, re.IGNORECASE):
        val = int(m.group(1))
        if not any(c.get("field") == "OUT_BYTES" and c["value"] == val for c in claims):
            claims.append({"type": "numeric_natural", "field": "OUT_BYTES",
                            "value": val, "raw": m.group(0).strip()})

    # "1 packet" / "single packet"
    for m in re.finditer(r'(?:(\d+)|single|one)\s*packets?\s*(?:in\b|inbound|received)', text, re.IGNORECASE):
        val = int(m.group(1)) if m.group(1) else 1
        if not any(c.get("field") == "IN_PKTS" and c["value"] == val for c in claims):
            claims.append({"type": "numeric_natural", "field": "IN_PKTS",
                            "value": val, "raw": m.group(0).strip()})

    for m in re.finditer(r'(?:(\d+)|single|one)\s*packets?\s*(?:out\b|outbound|sent)', text, re.IGNORECASE):
        val = int(m.group(1)) if m.group(1) else 1
        if not any(c.get("field") == "OUT_PKTS" and c["value"] == val for c in claims):
            claims.append({"type": "numeric_natural", "field": "OUT_PKTS",
                            "value": val, "raw": m.group(0).strip()})

    # Duration: "duration of 1ms" / "1 ms duration" / "short duration (1ms)"
    for m in re.finditer(r'(?:duration\s*(?:of\s*)?|lasting\s*)(\d+)\s*(?:ms|millisecond)', text, re.IGNORECASE):
        val = int(m.group(1))
        if not any(c.get("field") == "FLOW_DURATION_MILLISECONDS" and c["value"] == val for c in claims):
            claims.append({"type": "numeric_natural", "field": "FLOW_DURATION_MILLISECONDS",
                            "value": val, "raw": m.group(0).strip()})
    return claims


def extract_ip_claims(text):
    """Extract claims about IP addresses."""
    claims = []
    for m in re.finditer(r'\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b', text):
        ip = m.group(1)
        # Determine src/dst from context
        ctx = text[max(0, m.start()-50):m.end()+50].lower()
        direction = "src" if any(w in ctx for w in ["source", "src_addr", "src ip"]) else \
                    "dst" if any(w in ctx for w in ["dest", "dst_addr", "dst ip"]) else "either"
        claims.append({"type": "ip", "value": ip, "direction": direction,
                        "raw": m.group(0).strip()})
    return claims


def extract_service_claims(text):
    """Extract claims about what service a port represents."""
    claims = []
    # "FTP service", "SSH server", "port 21 (FTP)", "HTTP traffic"
    service_patterns = {
        "FTP": 21, "SSH": 22, "Telnet": 23, "SMTP": 25, "DNS": 53,
        "HTTP": 80, "HTTPS": 443, "RDP": 3389, "SMB": 445,
    }
    for service, expected_port in service_patterns.items():
        pattern = rf'\b{service}\b\s*(?:service|server|port|traffic|connection|protocol)?'
        for m in re.finditer(pattern, text, re.IGNORECASE):
            # Check if a port is mentioned nearby
            ctx = text[max(0, m.start()-60):m.end()+60]
            port_match = re.search(r'port\s*(\d+)', ctx, re.IGNORECASE)
            if port_match:
                claimed_port = int(port_match.group(1))
                claims.append({"type": "service_port", "service": service,
                                "claimed_port": claimed_port, "expected_port": expected_port,
                                "raw": m.group(0).strip()})
    return claims


def extract_ephemeral_port_claims(text):
    """Extract claims about ports being ephemeral (>1023 or >49151)."""
    claims = []
    for m in re.finditer(r'(?:ephemeral|high|dynamic|random)\s*(?:source\s*)?port', text, re.IGNORECASE):
        # Find the port number nearby
        ctx = text[max(0, m.start()-60):m.end()+60]
        port_match = re.search(r'(?:port\s*)?(\d{4,5})', ctx)
        if port_match:
            port = int(port_match.group(1))
            claims.append({"type": "ephemeral_port", "value": port,
                            "raw": f"{m.group(0)} ({port})"})
    return claims


# ── Claim verification ───────────────────────────────────────────────────────

def verify_claim(claim, flow_features):
    """
    Verify a single claim against flow features.
    Returns: (verifiable: bool, correct: bool|None, detail: str)
    """
    ct = claim["type"]

    if ct in ("port", "port_exact"):
        port = claim["value"]
        direction = claim["direction"]
        src = flow_features.get("L4_SRC_PORT")
        dst = flow_features.get("L4_DST_PORT")
        if direction == "dst":
            return True, port == dst, f"claimed dst={port}, actual dst={dst}"
        elif direction == "src":
            return True, port == src, f"claimed src={port}, actual src={src}"
        else:  # "either"
            match = (port == src or port == dst)
            return True, match, f"claimed port={port}, actual src={src} dst={dst}"

    elif ct == "protocol_num":
        actual = flow_features.get("PROTOCOL")
        return True, claim["value"] == actual, f"claimed={claim['value']}, actual={actual}"

    elif ct == "protocol_name":
        actual_num = flow_features.get("PROTOCOL")
        actual_name = PROTOCOL_MAP.get(actual_num, f"unknown({actual_num})")
        claimed = claim["value"]
        expected_num = PROTOCOL_NAMES.get(claimed.lower())
        if expected_num is not None:
            return True, expected_num == actual_num, f"claimed {claimed} (={expected_num}), actual={actual_name} (={actual_num})"
        return False, None, f"unrecognised protocol name: {claimed}"

    elif ct == "tcp_flags_num":
        actual = flow_features.get("TCP_FLAGS")
        return True, claim["value"] == actual, f"claimed={claim['value']}, actual={actual}"

    elif ct == "tcp_flag_names":
        actual_flags = flow_features.get("TCP_FLAGS", 0)
        all_correct = True
        details = []
        for flag_name in claim["value"]:
            bit = TCP_FLAG_BITS.get(flag_name, 0)
            is_set = bool(actual_flags & bit)
            details.append(f"{flag_name}={'set' if is_set else 'NOT set'}")
            if not is_set:
                all_correct = False
        return True, all_correct, f"flags={actual_flags}: {', '.join(details)}"

    elif ct in ("numeric_exact", "numeric_natural"):
        field = claim["field"]
        actual = flow_features.get(field)
        if actual is not None:
            return True, claim["value"] == actual, f"{field}: claimed={claim['value']}, actual={actual}"
        return False, None, f"field {field} not in flow"

    elif ct == "ip":
        src = flow_features.get("IPV4_SRC_ADDR", "")
        dst = flow_features.get("IPV4_DST_ADDR", "")
        ip = claim["value"]
        direction = claim["direction"]
        if direction == "src":
            return True, ip == src, f"claimed src={ip}, actual src={src}"
        elif direction == "dst":
            return True, ip == dst, f"claimed dst={ip}, actual dst={dst}"
        else:
            match = (ip == src or ip == dst)
            return True, match, f"claimed ip={ip}, actual src={src} dst={dst}"

    elif ct == "service_port":
        # Check if the service-port association claim is correct
        claimed_port = claim["claimed_port"]
        expected_port = claim["expected_port"]
        correct = claimed_port == expected_port
        return True, correct, f"{claim['service']} → port {claimed_port} (expected {expected_port})"

    elif ct == "ephemeral_port":
        port = claim["value"]
        is_ephemeral = port > 1023
        return True, is_ephemeral, f"port {port} {'is' if is_ephemeral else 'is NOT'} ephemeral (>1023)"

    return False, None, "unknown claim type"


# ── Main audit logic ─────────────────────────────────────────────────────────

def collect_text_from_flow(flow_result):
    """Gather all reasoning text and key_evidence from a flow's agents."""
    texts = []

    # Orchestrator reasoning
    if flow_result.get("reasoning"):
        texts.append(("orchestrator", flow_result["reasoning"]))

    # Specialist agents
    for agent_name, agent_data in flow_result.get("specialist_results", {}).items():
        if isinstance(agent_data, dict):
            if agent_data.get("reasoning"):
                texts.append((agent_name, agent_data["reasoning"]))
            for ev in agent_data.get("key_evidence", []):
                texts.append((agent_name, ev))

    # Devil's advocate
    da = flow_result.get("devils_advocate", {})
    if isinstance(da, dict):
        if da.get("counter_argument"):
            texts.append(("devils_advocate", da["counter_argument"]))
        if da.get("strongest_benign_indicator"):
            texts.append(("devils_advocate", da["strongest_benign_indicator"]))
        for alt in da.get("alternative_explanations", []):
            texts.append(("devils_advocate", alt))

    return texts


def audit_flow(flow_result):
    """Audit all claims in a single flow's reasoning."""
    features = flow_result.get("flow_features", {})
    text_sources = collect_text_from_flow(flow_result)

    all_claims = []
    seen_claims = set()  # deduplicate

    for agent_name, text in text_sources:
        extractors = [
            extract_port_claims,
            extract_protocol_claims,
            extract_tcp_flag_claims,
            extract_numeric_claims,
            extract_ip_claims,
            extract_service_claims,
            extract_ephemeral_port_claims,
        ]
        for extractor in extractors:
            for claim in extractor(text):
                # Deduplicate by (type, value, direction/field)
                key = (claim["type"], str(claim.get("value", "")),
                       claim.get("direction", claim.get("field", "")))
                if key not in seen_claims:
                    seen_claims.add(key)
                    claim["agent"] = agent_name
                    verifiable, correct, detail = verify_claim(claim, features)
                    claim["verifiable"] = verifiable
                    claim["correct"] = correct
                    claim["detail"] = detail
                    all_claims.append(claim)

    return all_claims


def audit_results_file(filepath):
    """Audit all LLM-analyzed flows in one results file."""
    with open(filepath) as f:
        data = json.load(f)

    attack_type = filepath.stem.replace("_results", "")
    flows_audited = 0
    all_claims = []

    for flow in data["results"]:
        if flow.get("tier1_filtered", False):
            continue
        flows_audited += 1
        claims = audit_flow(flow)
        for c in claims:
            c["flow_idx"] = flow["flow_idx"]
            c["attack_type"] = attack_type
            c["verdict"] = flow.get("verdict", "")
            c["actual_label"] = flow.get("attack_type_actual", "")
        all_claims.extend(claims)

    return attack_type, flows_audited, all_claims


def main():
    # Find all primary results files (exclude overlap/validation)
    results_files = sorted(RESULTS_DIR.glob("*_results.json"))
    results_files = [f for f in results_files
                     if "overlap" not in f.name
                     and "validation" not in f.name
                     and "gpt4o" not in f.name
                     and "tier1_gpt4o" not in f.name]

    print(f"Found {len(results_files)} result files to audit\n")

    grand_claims = []
    per_attack = {}
    per_agent = defaultdict(lambda: {"total": 0, "verifiable": 0, "correct": 0, "incorrect": 0})
    total_flows = 0

    for filepath in results_files:
        attack_type, n_flows, claims = audit_results_file(filepath)
        total_flows += n_flows
        per_attack[attack_type] = {
            "flows_audited": n_flows,
            "total_claims": len(claims),
            "verifiable": sum(1 for c in claims if c["verifiable"]),
            "correct": sum(1 for c in claims if c["correct"] is True),
            "incorrect": sum(1 for c in claims if c["correct"] is False),
            "unverifiable": sum(1 for c in claims if not c["verifiable"]),
        }
        grand_claims.extend(claims)

        # Per-agent stats
        for c in claims:
            agent = c["agent"]
            per_agent[agent]["total"] += 1
            if c["verifiable"]:
                per_agent[agent]["verifiable"] += 1
                if c["correct"]:
                    per_agent[agent]["correct"] += 1
                else:
                    per_agent[agent]["incorrect"] += 1

    # ── Compute summary stats ─────────────────────────────────────────────
    total_claims = len(grand_claims)
    verifiable = sum(1 for c in grand_claims if c["verifiable"])
    correct = sum(1 for c in grand_claims if c["correct"] is True)
    incorrect = sum(1 for c in grand_claims if c["correct"] is False)
    unverifiable = total_claims - verifiable

    faithfulness_rate = (correct / verifiable * 100) if verifiable > 0 else 0
    confabulation_rate = (incorrect / verifiable * 100) if verifiable > 0 else 0

    # ── Per claim-type breakdown ──────────────────────────────────────────
    per_type = defaultdict(lambda: {"total": 0, "verifiable": 0, "correct": 0, "incorrect": 0})
    for c in grand_claims:
        ct = c["type"]
        per_type[ct]["total"] += 1
        if c["verifiable"]:
            per_type[ct]["verifiable"] += 1
            if c["correct"]:
                per_type[ct]["correct"] += 1
            else:
                per_type[ct]["incorrect"] += 1

    # ── Collect example incorrect claims ──────────────────────────────────
    incorrect_examples = [c for c in grand_claims if c["correct"] is False][:20]

    # ── Print human-readable report ───────────────────────────────────────
    print("=" * 70)
    print("  AMATAS FAITHFULNESS AUDIT REPORT")
    print("=" * 70)
    print(f"\n  Files audited:     {len(results_files)}")
    print(f"  Flows audited:     {total_flows} (LLM-analyzed only, Tier1-filtered excluded)")
    print(f"  Total claims:      {total_claims}")
    print(f"  Verifiable:        {verifiable} ({verifiable/total_claims*100:.1f}%)" if total_claims else "")
    print(f"  Unverifiable:      {unverifiable} ({unverifiable/total_claims*100:.1f}%)" if total_claims else "")
    print(f"\n  ── Verifiable Claims ──")
    print(f"  Correct:           {correct} ({faithfulness_rate:.1f}%)")
    print(f"  Incorrect:         {incorrect} ({confabulation_rate:.1f}%)")
    print(f"\n  FAITHFULNESS RATE: {faithfulness_rate:.1f}%")
    print(f"  CONFABULATION RATE: {confabulation_rate:.1f}%")

    print(f"\n{'─' * 70}")
    print(f"  PER-AGENT BREAKDOWN")
    print(f"{'─' * 70}")
    print(f"  {'Agent':<20} {'Claims':>7} {'Verif.':>7} {'Correct':>8} {'Wrong':>7} {'Faith%':>7}")
    print(f"  {'─'*20} {'─'*7} {'─'*7} {'─'*8} {'─'*7} {'─'*7}")
    for agent in ["protocol", "statistical", "behavioural", "temporal", "devils_advocate", "orchestrator"]:
        s = per_agent.get(agent, {"total": 0, "verifiable": 0, "correct": 0, "incorrect": 0})
        faith = (s["correct"] / s["verifiable"] * 100) if s["verifiable"] > 0 else 0
        print(f"  {agent:<20} {s['total']:>7} {s['verifiable']:>7} {s['correct']:>8} {s['incorrect']:>7} {faith:>6.1f}%")

    print(f"\n{'─' * 70}")
    print(f"  PER-CLAIM-TYPE BREAKDOWN")
    print(f"{'─' * 70}")
    print(f"  {'Claim Type':<25} {'Total':>6} {'Verif.':>7} {'Correct':>8} {'Wrong':>7} {'Faith%':>7}")
    print(f"  {'─'*25} {'─'*6} {'─'*7} {'─'*8} {'─'*7} {'─'*7}")
    for ct in sorted(per_type.keys()):
        s = per_type[ct]
        faith = (s["correct"] / s["verifiable"] * 100) if s["verifiable"] > 0 else 0
        print(f"  {ct:<25} {s['total']:>6} {s['verifiable']:>7} {s['correct']:>8} {s['incorrect']:>7} {faith:>6.1f}%")

    print(f"\n{'─' * 70}")
    print(f"  PER-ATTACK-TYPE BREAKDOWN")
    print(f"{'─' * 70}")
    print(f"  {'Attack Type':<30} {'Flows':>6} {'Claims':>7} {'Correct':>8} {'Wrong':>7} {'Faith%':>7}")
    print(f"  {'─'*30} {'─'*6} {'─'*7} {'─'*8} {'─'*7} {'─'*7}")
    for at in sorted(per_attack.keys()):
        s = per_attack[at]
        faith = (s["correct"] / s["verifiable"] * 100) if s["verifiable"] > 0 else 0
        print(f"  {at:<30} {s['flows_audited']:>6} {s['total_claims']:>7} {s['correct']:>8} {s['incorrect']:>7} {faith:>6.1f}%")

    if incorrect_examples:
        print(f"\n{'─' * 70}")
        print(f"  SAMPLE INCORRECT CLAIMS (up to 20)")
        print(f"{'─' * 70}")
        for i, c in enumerate(incorrect_examples, 1):
            print(f"\n  [{i}] {c['attack_type']} flow {c['flow_idx']} — {c['agent']}")
            print(f"      Claim: {c['raw']}")
            print(f"      Type:  {c['type']}")
            print(f"      Detail: {c['detail']}")

    # ── Save JSON report ──────────────────────────────────────────────────
    report = {
        "summary": {
            "files_audited": len(results_files),
            "flows_audited": total_flows,
            "total_claims": total_claims,
            "verifiable_claims": verifiable,
            "unverifiable_claims": unverifiable,
            "correct_claims": correct,
            "incorrect_claims": incorrect,
            "faithfulness_rate_pct": round(faithfulness_rate, 2),
            "confabulation_rate_pct": round(confabulation_rate, 2),
        },
        "per_agent": dict(per_agent),
        "per_claim_type": dict(per_type),
        "per_attack_type": per_attack,
        "incorrect_examples": incorrect_examples[:20],
    }

    output_path = RESULTS_DIR / "faithfulness_audit.json"
    with open(output_path, "w") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"\n\nFull report saved to: {output_path}")


if __name__ == "__main__":
    main()
