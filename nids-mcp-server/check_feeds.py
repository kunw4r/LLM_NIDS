#!/usr/bin/env python3
"""
Check what IPs are actually in the threat feeds
"""

import requests
import json

print("Checking Feodo Tracker feed...")
print("=" * 70)

try:
    response = requests.get("https://feodotracker.abuse.ch/downloads/ipblocklist.json", timeout=10)
    response.raise_for_status()
    data = response.json()
    
    print(f"✅ Total entries in Feodo Tracker: {len(data)}")
    
    if data:
        print(f"\n📋 Sample entries (first 10):")
        for i, entry in enumerate(data[:10], 1):
            ip = entry.get("ip_address", "N/A")
            malware = entry.get("malware", "N/A")
            status = entry.get("status", "N/A")
            first_seen = entry.get("first_seen", "N/A")
            print(f"  {i}. {ip:20s} | {malware:15s} | Status: {status} | First seen: {first_seen}")
        
        # Get a currently active one
        active_entries = [e for e in data if e.get("status") == "online"]
        print(f"\n🔴 Active (online) C&C servers: {len(active_entries)}")
        
        if active_entries:
            print(f"\n🎯 Active malicious IPs to test:")
            for entry in active_entries[:5]:
                print(f"   {entry.get('ip_address')} - {entry.get('malware')}")
    else:
        print("⚠️  No entries found in feed")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n" + "=" * 70)
print("Checking SSL Blacklist feed...")
print("=" * 70)

try:
    response = requests.get("https://sslbl.abuse.ch/blacklist/sslipblacklist.txt", timeout=10)
    response.raise_for_status()
    
    lines = [l.strip() for l in response.text.splitlines() if l.strip() and not l.startswith("#")]
    
    print(f"✅ Total IPs in SSL Blacklist: {len(lines)}")
    
    if lines:
        print(f"\n📋 Sample IPs (first 10):")
        for i, line in enumerate(lines[:10], 1):
            print(f"  {i}. {line}")
    else:
        print("⚠️  No IPs found in feed")
        
except Exception as e:
    print(f"❌ Error: {e}")
