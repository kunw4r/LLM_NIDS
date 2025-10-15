#!/usr/bin/env python3
"""
NetFlow Record Analysis Script
Analyzes a single NetFlow record with threat intelligence and geolocation
"""

import asyncio
import sys
from pathlib import Path

# Add nids-mcp-server to path
sys.path.insert(0, str(Path(__file__).parent / "nids-mcp-server"))

from tools.ip_threat_intel import check_ip_reputation, format_threat_summary
from tools.ip_geolocation import geolocate_ip


def analyze_netflow_record():
    """Analyze the provided NetFlow record"""
    
    # NetFlow Record Data
    netflow = {
        "src_ip": "13.58.98.64",
        "src_port": 36526,
        "dst_ip": "172.31.69.25",
        "dst_port": 22,
        "protocol": "TCP/SSH",
        "duration_ms": 369,
        "bytes_in": 3148,
        "bytes_out": 3869,
        "packets_in": 23,
        "packets_out": 23
    }
    
    print("=" * 80)
    print("NETFLOW RECORD ANALYSIS")
    print("=" * 80)
    print()
    
    # 1. Basic Flow Information
    print("📊 FLOW INFORMATION")
    print("-" * 80)
    print(f"Source:       {netflow['src_ip']}:{netflow['src_port']}")
    print(f"Destination:  {netflow['dst_ip']}:{netflow['dst_port']}")
    print(f"Protocol:     {netflow['protocol']}")
    print(f"Duration:     {netflow['duration_ms']}ms")
    print(f"Bytes:        {netflow['bytes_in']:,} in / {netflow['bytes_out']:,} out (Total: {netflow['bytes_in'] + netflow['bytes_out']:,})")
    print(f"Packets:      {netflow['packets_in']} in / {netflow['packets_out']} out (Total: {netflow['packets_in'] + netflow['packets_out']})")
    print()
    
    # 2. Traffic Pattern Analysis
    print("🔍 TRAFFIC PATTERN ANALYSIS")
    print("-" * 80)
    
    # Packet size analysis
    total_bytes = netflow['bytes_in'] + netflow['bytes_out']
    total_packets = netflow['packets_in'] + netflow['packets_out']
    avg_packet_size = total_bytes / total_packets if total_packets > 0 else 0
    
    print(f"Average Packet Size:  {avg_packet_size:.1f} bytes")
    print(f"Packet Symmetry:      {'Perfect' if netflow['packets_in'] == netflow['packets_out'] else 'Asymmetric'} (23 in = 23 out)")
    print(f"Byte Ratio (in/out):  {netflow['bytes_in']/netflow['bytes_out']:.2f}")
    print(f"Connection Duration:  Short ({netflow['duration_ms']}ms - typical for SSH handshake)")
    print()
    
    # SSH-specific analysis
    print("🔐 SSH-SPECIFIC ANALYSIS")
    print("-" * 80)
    print(f"Target Service:       SSH (Port 22)")
    print(f"Connection Type:      {'Successful handshake' if netflow['packets_in'] == netflow['packets_out'] else 'Incomplete'}")
    print(f"Handshake Pattern:    Symmetric packet exchange suggests TCP 3-way handshake + SSH banner exchange")
    print(f"Session State:        {'Established' if netflow['packets_in'] > 5 else 'Initial connection'}")
    print()
    
    # 3. IP Address Analysis
    print("🌐 IP ADDRESS ANALYSIS")
    print("-" * 80)
    
    # Source IP analysis
    print(f"Source IP: {netflow['src_ip']}")
    print(f"  • IP Type:           Public IP (AWS IP range 13.0.0.0/8)")
    print(f"  • Source Port:       {netflow['src_port']} (Ephemeral port - normal for client)")
    
    # Destination IP analysis
    print(f"\nDestination IP: {netflow['dst_ip']}")
    print(f"  • IP Type:           Private IP (RFC 1918: 172.16.0.0/12)")
    print(f"  • Network Context:   Internal network / AWS VPC")
    print(f"  • Service:           SSH Server (Port 22)")
    print()
    
    # 4. Threat Intelligence Check
    print("🛡️  THREAT INTELLIGENCE CHECK")
    print("-" * 80)
    
    # Check source IP reputation
    print(f"Checking source IP: {netflow['src_ip']}...")
    try:
        threat_result = asyncio.run(check_ip_reputation(netflow['src_ip']))
        print(format_threat_summary(threat_result))
    except Exception as e:
        print(f"⚠️  Threat check failed: {e}")
    
    print()
    
    # Check destination IP (should be private)
    print(f"Checking destination IP: {netflow['dst_ip']}...")
    try:
        threat_result = asyncio.run(check_ip_reputation(netflow['dst_ip']))
        print(format_threat_summary(threat_result))
    except Exception as e:
        print(f"⚠️  Threat check failed: {e}")
    
    print()
    
    # 5. Geolocation Check
    print("📍 GEOLOCATION ANALYSIS")
    print("-" * 80)
    
    try:
        geo_result = asyncio.run(geolocate_ip(netflow['src_ip']))
        if geo_result.get('success'):
            loc = geo_result.get('location', {})
            net = geo_result.get('network', {})
            flags = geo_result.get('flags', {})
            
            print(f"Source IP Location: {netflow['src_ip']}")
            print(f"  • Country:      {loc.get('country', 'Unknown')}")
            print(f"  • City:         {loc.get('city', 'Unknown')}")
            print(f"  • Region:       {loc.get('region', 'Unknown')}")
            print(f"  • ISP:          {net.get('isp', 'Unknown')}")
            print(f"  • Organization: {net.get('organization', 'Unknown')}")
            print(f"  • ASN:          {net.get('asn', 'Unknown')}")
            print(f"  • Timezone:     {loc.get('timezone', 'Unknown')}")
            
            # Add flags if present
            flag_list = []
            if flags.get('is_proxy'):
                flag_list.append('Proxy')
            if flags.get('is_hosting'):
                flag_list.append('Hosting/Datacenter')
            if flags.get('is_mobile'):
                flag_list.append('Mobile')
            if flag_list:
                print(f"  • Flags:        {', '.join(flag_list)}")
        else:
            print(f"⚠️  Geolocation failed: {geo_result.get('error', 'Unknown error')}")
    except Exception as e:
        print(f"⚠️  Geolocation check failed: {e}")
    
    print()
    
    # 6. Security Assessment
    print("🔒 SECURITY ASSESSMENT")
    print("-" * 80)
    
    findings = []
    risk_level = "LOW"
    
    # Analyze SSH characteristics
    if netflow['dst_port'] == 22:
        findings.append({
            "type": "SSH Connection",
            "severity": "INFO",
            "description": "SSH connection to internal server from external source"
        })
    
    # Check for suspicious patterns
    if netflow['duration_ms'] < 500:
        findings.append({
            "type": "Short Duration",
            "severity": "INFO",
            "description": f"Very short connection ({netflow['duration_ms']}ms) - typical for handshake or failed authentication"
        })
    
    # Symmetric packet count
    if netflow['packets_in'] == netflow['packets_out']:
        findings.append({
            "type": "Symmetric Traffic",
            "severity": "INFO",
            "description": "Perfect packet symmetry suggests normal TCP handshake + initial SSH exchange"
        })
    
    # Small byte count
    if total_bytes < 10000:
        findings.append({
            "type": "Small Data Transfer",
            "severity": "INFO",
            "description": f"Minimal data transfer ({total_bytes} bytes) - connection establishment phase"
        })
    
    # External to internal SSH
    if netflow['src_ip'].startswith(('13.', '3.', '18.', '34.')):  # Common AWS ranges
        findings.append({
            "type": "Cloud Source",
            "severity": "MEDIUM",
            "description": "Connection originates from cloud infrastructure (AWS) - verify if legitimate"
        })
        risk_level = "MEDIUM"
    
    # Print findings
    for i, finding in enumerate(findings, 1):
        severity_emoji = {"INFO": "ℹ️", "LOW": "⚠️", "MEDIUM": "⚠️", "HIGH": "🚨"}
        emoji = severity_emoji.get(finding['severity'], "•")
        print(f"{emoji}  [{finding['severity']}] {finding['type']}")
        print(f"    {finding['description']}")
        print()
    
    # 7. Behavioral Indicators
    print("🎯 BEHAVIORAL INDICATORS")
    print("-" * 80)
    
    print("Connection Characteristics:")
    print(f"  • Connection Pattern:     Legitimate SSH handshake pattern")
    print(f"  • Data Exchange:          Minimal (handshake + banner)")
    print(f"  • Session Completion:     {'Complete' if netflow['packets_in'] > 10 else 'Partial/Incomplete'}")
    print(f"  • Behavior Type:          {'Successful connection' if netflow['bytes_out'] > netflow['bytes_in'] else 'Investigation required'}")
    print()
    
    print("Possible Scenarios:")
    print("  1. ✅ Legitimate SSH access from authorized external source (e.g., bastion host, CI/CD)")
    print("  2. ⚠️  SSH connection attempt (successful handshake, possible failed authentication)")
    print("  3. ⚠️  Automated SSH scanner (but packet count suggests more than just scan)")
    print("  4. ⚠️  SSH brute force attempt (single attempt - would need to see more flows)")
    print()
    
    # 8. Recommendations
    print("💡 RECOMMENDATIONS")
    print("-" * 80)
    print(f"Risk Level: {risk_level}")
    print()
    print("Immediate Actions:")
    print("  1. Verify if 13.58.98.64 is an authorized source (check allow-list)")
    print("  2. Review SSH authentication logs on 172.31.69.25 for this connection")
    print("  3. Check if authentication was successful or failed")
    print("  4. Verify the source IP belongs to legitimate infrastructure")
    print()
    print("Monitoring:")
    print("  • Track this source IP for repeated connection attempts")
    print("  • Monitor for successful authentications from this IP")
    print("  • Watch for any privilege escalation or lateral movement")
    print("  • Set up alert if connection frequency increases")
    print()
    print("Context Required:")
    print("  • Is this a known bastion host or jump server?")
    print("  • Is this IP in your organization's cloud infrastructure?")
    print("  • Are automated SSH connections expected from this source?")
    print("  • Review historical connections from this IP")
    print()
    
    # 9. Summary
    print("=" * 80)
    print("📋 SUMMARY")
    print("=" * 80)
    print()
    print(f"This NetFlow record shows a short-lived SSH connection from a public AWS IP")
    print(f"({netflow['src_ip']}) to an internal server ({netflow['dst_ip']}:22). The connection")
    print(f"exhibits normal TCP/SSH handshake patterns with symmetric packet exchange and")
    print(f"minimal data transfer, suggesting either:")
    print()
    print(f"  • A legitimate but brief SSH session (connection test, automation)")
    print(f"  • A failed authentication attempt after successful TCP handshake")
    print(f"  • Initial reconnaissance before establishing a full session")
    print()
    print(f"The connection is NOT immediately suspicious, but requires context about whether")
    print(f"this source IP is authorized for SSH access. Review authentication logs and")
    print(f"historical patterns to determine if this is normal or requires investigation.")
    print()
    print("=" * 80)


if __name__ == "__main__":
    analyze_netflow_record()
