"""
Test script for AlienVault OTX integration
"""

import sys
sys.path.append('.')

from tools.alienvault_otx import check_ip_otx, search_pulses, format_otx_summary
import json

print("=" * 70)
print("AlienVault OTX Integration Test Suite")
print("=" * 70)

# Test 1: Known malicious IPs
print("\n" + "=" * 70)
print("TEST 1: Checking known malicious IP")
print("=" * 70)

malicious_ip = "185.220.101.1"  # Tor exit node with honeypot data
result = check_ip_otx(malicious_ip)
print(format_otx_summary(result))

# Test 2: Clean IP
print("\n" + "=" * 70)
print("TEST 2: Checking clean IP (Google DNS)")
print("=" * 70)

clean_ip = "8.8.8.8"
result = check_ip_otx(clean_ip)
print(format_otx_summary(result))

# Test 3: Search for specific threats
print("\n" + "=" * 70)
print("TEST 3: Searching for DDoS pulses")
print("=" * 70)

search_result = search_pulses("DDoS", limit=5)
print(f"\n🔍 Found {search_result['total_count']} pulses for 'DDoS'")
if search_result['pulses']:
    print("\nTop 5 DDoS-related pulses:")
    for i, pulse in enumerate(search_result['pulses'], 1):
        print(f"\n{i}. {pulse['name']}")
        if pulse['description']:
            desc = pulse['description'][:150]
            print(f"   {desc}...")
        print(f"   Tags: {', '.join(pulse['tags'][:5])}")
        if pulse['malware_families']:
            print(f"   Malware: {', '.join(pulse['malware_families'])}")

# Test 4: Search for Botnet
print("\n" + "=" * 70)
print("TEST 4: Searching for Botnet pulses")
print("=" * 70)

search_result = search_pulses("botnet", limit=5)
print(f"\n🔍 Found {search_result['total_count']} pulses for 'botnet'")
if search_result['pulses']:
    print("\nTop 5 botnet-related pulses:")
    for i, pulse in enumerate(search_result['pulses'], 1):
        print(f"\n{i}. {pulse['name']}")
        if pulse['description']:
            desc = pulse['description'][:150]
            print(f"   {desc}...")
        if pulse['indicator_count']:
            print(f"   Indicators: {pulse['indicator_count']} IOCs")

# Test 5: MITRE ATT&CK mapping
print("\n" + "=" * 70)
print("TEST 5: Checking for MITRE ATT&CK technique coverage")
print("=" * 70)

# Search for common CICIDS2018 attack types
attack_types = ["SSH bruteforce", "SQL injection", "port scan"]
for attack_type in attack_types:
    result = search_pulses(attack_type, limit=3)
    print(f"\n📊 {attack_type}: {result['total_count']} pulses found")
    
    # Check for MITRE techniques in results
    mitre_count = 0
    for pulse in result['pulses']:
        if pulse['attack_ids']:
            mitre_count += len(pulse['attack_ids'])
    
    if mitre_count > 0:
        print(f"   ✅ {mitre_count} MITRE ATT&CK techniques referenced")

print("\n" + "=" * 70)
print("✅ All AlienVault OTX tests complete!")
print("=" * 70)

print("\n💡 Key Features:")
print("   • Open-source threat intelligence")
print("   • Community-driven (100K+ participants)")
print("   • Free unlimited API access")
print("   • Pulse feeds with IOC context")
print("   • MITRE ATT&CK technique mapping")
print("   • Perfect complement to AbuseIPDB")
