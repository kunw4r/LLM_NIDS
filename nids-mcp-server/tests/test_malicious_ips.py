#!/usr/bin/env python3
"""
Test known malicious IPs against threat intelligence tool
This script tests the tool with IPs that should be flagged as malicious
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from tools.ip_threat_intel import check_ip_reputation, format_threat_summary, update_threat_feeds


async def test_known_malicious_ips():
    """Test with known malicious IPs"""
    print("=" * 70)
    print("Testing Known Malicious IPs")
    print("=" * 70)
    
    # Force update feeds first
    print("\n🔄 Fetching latest threat feeds...")
    update_threat_feeds(force=True)
    
    # Test IPs - mix of potentially malicious and clean
    test_cases = [
        {
            "ip": "1.1.1.1",
            "expected": "clean",
            "note": "Cloudflare DNS - should be clean"
        },
        {
            "ip": "8.8.8.8",
            "expected": "clean",
            "note": "Google DNS - should be clean"
        },
        {
            "ip": "185.220.101.1",
            "expected": "unknown",
            "note": "Tor exit node - may or may not be in feeds"
        },
        {
            "ip": "45.142.212.100",
            "expected": "potential",
            "note": "Potentially suspicious hosting IP"
        },
        {
            "ip": "192.168.1.1",
            "expected": "private",
            "note": "Private IP - not in public feeds"
        },
    ]
    
    results = []
    
    for test_case in test_cases:
        ip = test_case["ip"]
        expected = test_case["expected"]
        note = test_case["note"]
        
        print(f"\n{'='*70}")
        print(f"🔍 Testing: {ip}")
        print(f"📝 Note: {note}")
        print(f"🎯 Expected: {expected}")
        print("-" * 70)
        
        result = await check_ip_reputation(ip, update_feeds=False)
        summary = format_threat_summary(result)
        
        print(summary)
        
        # Show detailed findings if malicious
        if result.get("is_malicious"):
            print(f"\n📋 Detailed Findings:")
            for i, finding in enumerate(result.get("findings", []), 1):
                print(f"\n  Finding #{i}:")
                for key, value in finding.items():
                    print(f"    {key}: {value}")
        
        results.append({
            "ip": ip,
            "expected": expected,
            "is_malicious": result.get("is_malicious", False),
            "threat_count": result.get("threat_count", 0),
            "confidence": result.get("confidence", "none")
        })
        
        print()
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 Test Summary")
    print("=" * 70)
    
    for r in results:
        status = "🚨 MALICIOUS" if r["is_malicious"] else "✅ CLEAN"
        print(f"{status} | {r['ip']:20s} | Threats: {r['threat_count']} | Confidence: {r['confidence']}")
    
    print()


async def test_with_custom_blacklist():
    """Test with custom local blacklist"""
    print("\n" + "=" * 70)
    print("Testing Custom Local Blacklist")
    print("=" * 70)
    
    # Path to local blacklist
    blacklist_path = Path(__file__).parent / "data" / "local_blacklist.txt"
    
    print(f"\n📁 Blacklist file: {blacklist_path}")
    
    # Add a test IP to local blacklist
    test_malicious_ip = "198.51.100.123"
    
    print(f"\n➕ Adding test IP to local blacklist: {test_malicious_ip}")
    
    with open(blacklist_path, 'a') as f:
        f.write(f"\n# Test malicious IP (added by test script)\n")
        f.write(f"{test_malicious_ip}\n")
    
    print("✅ Added to blacklist")
    
    # Force reload feeds
    update_threat_feeds(force=True)
    
    # Test the IP
    print(f"\n🔍 Testing blacklisted IP: {test_malicious_ip}")
    print("-" * 70)
    
    result = await check_ip_reputation(test_malicious_ip, update_feeds=False)
    summary = format_threat_summary(result)
    
    print(summary)
    
    if result.get("is_malicious"):
        print("\n✅ SUCCESS: Local blacklist detection working!")
    else:
        print("\n❌ FAILED: IP not detected in local blacklist")
    
    # Clean up - remove test IP
    print(f"\n🧹 Cleaning up test entry...")
    with open(blacklist_path, 'r') as f:
        lines = f.readlines()
    
    with open(blacklist_path, 'w') as f:
        skip_next = False
        for line in lines:
            if test_malicious_ip in line:
                skip_next = True
                continue
            if skip_next and line.strip().startswith("#"):
                skip_next = False
                continue
            if not skip_next:
                f.write(line)
    
    print("✅ Cleanup complete")


async def main():
    """Run all malicious IP tests"""
    print("\n🧪 NIDS MCP Server - Malicious IP Detection Tests\n")
    
    await test_known_malicious_ips()
    await test_with_custom_blacklist()
    
    print("\n" + "=" * 70)
    print("✅ All tests complete!")
    print("=" * 70)
    print("\n💡 Notes:")
    print("  - Threat feeds are updated in real-time")
    print("  - Some IPs may not be in current feeds")
    print("  - Local blacklist allows custom threat definitions")
    print()


if __name__ == "__main__":
    asyncio.run(main())
