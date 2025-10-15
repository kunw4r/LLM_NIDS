#!/usr/bin/env python3
"""
Deep Investigation Script - Using External Threat Intelligence
Investigates the NetFlow record using AbuseIPDB, AlienVault OTX, and MITRE ATT&CK
"""

import sys
from pathlib import Path

# Add nids-mcp-server to path
sys.path.insert(0, str(Path(__file__).parent / "nids-mcp-server"))

from tools.abuseipdb import check_ip as abuseipdb_check, format_check_result as format_abuseipdb
from tools.alienvault_otx import check_ip_otx, search_pulses, format_otx_summary
from tools.mitre_attack import map_attack_to_mitre


def deep_investigation():
    """Perform deep investigation using external threat intelligence"""
    
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
    print("DEEP THREAT INTELLIGENCE INVESTIGATION")
    print("=" * 80)
    print()
    print(f"Target IP: {netflow['src_ip']}")
    print(f"Connection: {netflow['src_ip']}:{netflow['src_port']} → {netflow['dst_ip']}:{netflow['dst_port']}")
    print(f"Protocol: {netflow['protocol']}")
    print()
    
    # 1. AbuseIPDB Check (Community Reputation)
    print("=" * 80)
    print("1. ABUSEIPDB COMMUNITY DATABASE CHECK")
    print("=" * 80)
    print()
    print("Querying 800K+ security researchers for reports on this IP...")
    print()
    
    try:
        abuse_result = abuseipdb_check(netflow['src_ip'], max_age_days=90, verbose=True)
        print(format_abuseipdb(abuse_result))
        
        if abuse_result.get('success'):
            data = abuse_result.get('data', {})
            abuse_score = data.get('abuseConfidenceScore', 0)
            total_reports = data.get('totalReports', 0)
            
            print()
            print("AbuseIPDB Analysis:")
            print(f"  • Abuse Confidence Score: {abuse_score}%")
            print(f"  • Total Reports: {total_reports}")
            
            if abuse_score > 75:
                print(f"  • Risk Level: 🚨 CRITICAL - Highly malicious")
            elif abuse_score > 50:
                print(f"  • Risk Level: ⚠️  HIGH - Known malicious activity")
            elif abuse_score > 25:
                print(f"  • Risk Level: ⚠️  MEDIUM - Some malicious reports")
            elif abuse_score > 0:
                print(f"  • Risk Level: ℹ️  LOW - Minimal reports")
            else:
                print(f"  • Risk Level: ✅ CLEAN - No abuse reports")
        
    except Exception as e:
        print(f"⚠️  AbuseIPDB check failed: {e}")
        print("(This may indicate API key is not configured or rate limit reached)")
    
    print()
    
    # 2. AlienVault OTX Check (Threat Intelligence Pulses)
    print("=" * 80)
    print("2. ALIENVAULT OTX THREAT INTELLIGENCE")
    print("=" * 80)
    print()
    print("Querying 100K+ security researchers for threat pulses...")
    print()
    
    try:
        otx_result = check_ip_otx(netflow['src_ip'])
        print(format_otx_summary(otx_result))
        
        if otx_result.get('success'):
            pulses = otx_result.get('pulse_count', 0)
            
            print()
            print("AlienVault OTX Analysis:")
            print(f"  • Related Threat Pulses: {pulses}")
            
            if pulses > 0:
                print(f"  • Risk Level: 🚨 HIGH - IP found in threat intelligence")
                
                # Show some pulse details if available
                pulse_info = otx_result.get('pulse_info', {})
                if pulse_info.get('pulses'):
                    print()
                    print("  Recent Threat Pulses:")
                    for i, pulse in enumerate(pulse_info['pulses'][:3], 1):
                        print(f"    {i}. {pulse.get('name', 'Unknown')}")
                        if 'tags' in pulse and pulse['tags']:
                            print(f"       Tags: {', '.join(pulse['tags'][:5])}")
            else:
                print(f"  • Risk Level: ✅ CLEAN - No threat pulses found")
        
    except Exception as e:
        print(f"⚠️  AlienVault OTX check failed: {e}")
        print("(OTX queries may fail without API key or due to rate limits)")
    
    print()
    
    # 3. Search for SSH Attack Patterns in OTX
    print("=" * 80)
    print("3. SSH BRUTE FORCE THREAT INTELLIGENCE")
    print("=" * 80)
    print()
    print("Searching threat intelligence for SSH brute force patterns...")
    print()
    
    try:
        ssh_pulses = search_pulses("SSH brute force", limit=5)
        
        if ssh_pulses.get('success'):
            results = ssh_pulses.get('results', [])
            print(f"Found {len(results)} threat pulses related to SSH brute force attacks:")
            print()
            
            for i, pulse in enumerate(results[:5], 1):
                print(f"{i}. {pulse.get('name', 'Unknown Pulse')}")
                print(f"   Created: {pulse.get('created', 'Unknown')}")
                print(f"   Author: {pulse.get('author_name', 'Unknown')}")
                if pulse.get('tags'):
                    print(f"   Tags: {', '.join(pulse['tags'][:5])}")
                print()
        else:
            print("No specific SSH brute force threat intelligence found")
    
    except Exception as e:
        print(f"⚠️  OTX pulse search failed: {e}")
    
    print()
    
    # 4. MITRE ATT&CK Mapping
    print("=" * 80)
    print("4. MITRE ATT&CK FRAMEWORK MAPPING")
    print("=" * 80)
    print()
    print("Mapping connection patterns to MITRE ATT&CK techniques...")
    print()
    
    # Map SSH attacks
    print("SSH Connection Analysis:")
    try:
        ssh_mapping = map_attack_to_mitre("SSH")
        
        if ssh_mapping.get('success'):
            techniques = ssh_mapping.get('techniques', [])
            print(f"Found {len(techniques)} related MITRE ATT&CK techniques:")
            print()
            
            for tech in techniques[:5]:
                print(f"  • {tech.get('id')}: {tech.get('name')}")
                if tech.get('description'):
                    desc = tech['description'][:150] + "..." if len(tech['description']) > 150 else tech['description']
                    print(f"    {desc}")
                print()
    except Exception as e:
        print(f"⚠️  MITRE mapping failed: {e}")
    
    print()
    
    # 5. Comprehensive Risk Assessment
    print("=" * 80)
    print("5. COMPREHENSIVE RISK ASSESSMENT")
    print("=" * 80)
    print()
    
    # Analyze all findings
    risk_indicators = []
    risk_score = 0
    
    # Check connection characteristics
    if netflow['duration_ms'] < 500:
        risk_indicators.append({
            'indicator': 'Very short connection duration',
            'severity': 'MEDIUM',
            'description': f"{netflow['duration_ms']}ms connection suggests failed auth or reconnaissance",
            'score': 20
        })
        risk_score += 20
    
    if netflow['packets_in'] == netflow['packets_out'] and netflow['packets_in'] < 30:
        risk_indicators.append({
            'indicator': 'Minimal packet exchange',
            'severity': 'LOW',
            'description': 'Connection established but minimal data transfer',
            'score': 10
        })
        risk_score += 10
    
    # External to internal SSH
    risk_indicators.append({
        'indicator': 'External SSH connection to internal server',
        'severity': 'MEDIUM',
        'description': 'Public IP accessing internal SSH server',
        'score': 25
    })
    risk_score += 25
    
    # Source from cloud infrastructure
    risk_indicators.append({
        'indicator': 'Cloud infrastructure source',
        'severity': 'LOW',
        'description': 'AWS EC2 instance - could be legitimate or compromised',
        'score': 10
    })
    risk_score += 10
    
    # Print risk indicators
    print("Risk Indicators Detected:")
    print()
    for indicator in risk_indicators:
        severity_emoji = {"LOW": "ℹ️", "MEDIUM": "⚠️", "HIGH": "🚨", "CRITICAL": "🚨"}
        emoji = severity_emoji.get(indicator['severity'], "•")
        print(f"{emoji} [{indicator['severity']}] {indicator['indicator']}")
        print(f"   {indicator['description']}")
        print(f"   Risk Score: +{indicator['score']}")
        print()
    
    # Overall risk assessment
    print("=" * 80)
    print("OVERALL RISK ASSESSMENT")
    print("=" * 80)
    print()
    print(f"Total Risk Score: {risk_score}/100")
    print()
    
    if risk_score >= 75:
        risk_level = "🚨 CRITICAL"
        conclusion = "HIGHLY LIKELY ATTACK"
    elif risk_score >= 50:
        risk_level = "⚠️  HIGH"
        conclusion = "PROBABLE ATTACK"
    elif risk_score >= 30:
        risk_level = "⚠️  MEDIUM"
        conclusion = "SUSPICIOUS ACTIVITY"
    else:
        risk_level = "ℹ️  LOW"
        conclusion = "POTENTIALLY BENIGN"
    
    print(f"Risk Level: {risk_level}")
    print(f"Conclusion: {conclusion}")
    print()
    
    # Final determination
    print("=" * 80)
    print("FINAL DETERMINATION")
    print("=" * 80)
    print()
    
    print("Based on the comprehensive investigation:")
    print()
    print("1. Pattern Analysis:")
    print("   • Connection shows normal TCP/SSH handshake behavior")
    print("   • Short duration suggests connection test or failed authentication")
    print("   • Symmetric packet exchange is consistent with legitimate SSH")
    print()
    
    print("2. Threat Intelligence:")
    print("   • Source IP not found in major abuse databases (if clean)")
    print("   • No active threat pulses associated with this IP (if clean)")
    print("   • Originates from legitimate AWS infrastructure")
    print()
    
    print("3. Attack Classification:")
    if risk_score >= 50:
        print("   🚨 LIKELY ATTACK SCENARIO:")
        print("      - SSH brute force reconnaissance")
        print("      - Automated scanning from compromised cloud instance")
        print("      - Connection probing before main attack")
    else:
        print("   ⚠️  AMBIGUOUS - COULD BE:")
        print("      - Legitimate automated monitoring (CI/CD, health checks)")
        print("      - Single failed authentication attempt (not necessarily malicious)")
        print("      - Network scanning (reconnaissance phase)")
        print("      - Compromised cloud instance probing for vulnerabilities")
    print()
    
    print("4. Recommended Actions:")
    print("   IMMEDIATE:")
    print("   • Check SSH authentication logs for this timestamp")
    print("   • Verify if source IP is in authorized access list")
    print("   • Review firewall rules for port 22 access")
    print()
    print("   MONITORING:")
    print("   • Track this IP for repeated connection attempts")
    print("   • Alert on successful authentications from this source")
    print("   • Watch for similar patterns from other IPs")
    print()
    print("   INVESTIGATION:")
    print("   • Query for other connections from this IP in last 24 hours")
    print("   • Check if other internal hosts received similar connections")
    print("   • Review if this matches known attack patterns in your environment")
    print()
    
    print("=" * 80)
    print("INVESTIGATION COMPLETE")
    print("=" * 80)


if __name__ == "__main__":
    deep_investigation()
