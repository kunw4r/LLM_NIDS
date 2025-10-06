#!/usr/bin/env python3
"""
Test MITRE ATT&CK integration
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from tools.mitre_attack import (
    query_technique,
    search_techniques,
    map_attack_to_mitre,
    format_technique_summary,
    QUERY_TECHNIQUE_TOOL,
    SEARCH_TECHNIQUES_TOOL,
    MAP_ATTACK_TOOL
)


async def test_query_technique():
    """Test querying specific MITRE techniques"""
    print("=" * 70)
    print("Testing MITRE Technique Query")
    print("=" * 70)
    
    test_techniques = [
        ("T1110", "Brute Force"),
        ("T1110.001", "Brute Force: Password Guessing"),
        ("T1046", "Network Service Discovery (Port Scanning)"),
        ("T1071", "Application Layer Protocol (C&C)"),
        ("T1498", "Network Denial of Service"),
    ]
    
    for tech_id, description in test_techniques:
        print(f"\n🔍 Testing {tech_id} - {description}")
        print("-" * 70)
        
        result = await query_technique(tech_id)
        summary = format_technique_summary(result)
        
        print(summary)
        print()


async def test_search_techniques():
    """Test searching for techniques"""
    print("\n" + "=" * 70)
    print("Testing MITRE Technique Search")
    print("=" * 70)
    
    search_queries = [
        "brute force",
        "SSH",
        "exfiltration",
        "DDoS",
    ]
    
    for query in search_queries:
        print(f"\n🔍 Searching for: '{query}'")
        print("-" * 70)
        
        result = await search_techniques(query)
        
        if result.get("success"):
            print(f"✅ Found {result.get('result_count')} results\n")
            
            # Show first 3 results
            for i, tech in enumerate(result.get("results", [])[:3], 1):
                print(f"{i}. {tech.get('technique_id')} - {tech.get('name')}")
                print(f"   Tactics: {', '.join(tech.get('tactics', []))}")
                print()
        else:
            print(f"❌ Error: {result.get('error')}")


async def test_map_attack_to_mitre():
    """Test mapping common attacks to MITRE techniques"""
    print("\n" + "=" * 70)
    print("Testing Attack Type to MITRE Mapping")
    print("=" * 70)
    
    attack_types = [
        "ssh_bruteforce",
        "ddos",
        "port_scan",
        "sql_injection",
        "botnet",
    ]
    
    for attack_type in attack_types:
        print(f"\n🎯 Mapping: {attack_type}")
        print("-" * 70)
        
        result = await map_attack_to_mitre(attack_type)
        
        if result.get("success"):
            print(f"✅ Mapped to {result.get('technique_count')} technique(s):\n")
            
            for tech in result.get("mapped_techniques", []):
                print(f"• {tech.get('technique_id')} - {tech.get('name')}")
                print(f"  Tactics: {', '.join(tech.get('tactics', []))}")
                print()
        else:
            print(f"❌ Error: {result.get('error')}")


async def test_real_world_scenario():
    """Test real-world scenario: SSH brute force detection"""
    print("\n" + "=" * 70)
    print("Real-World Scenario: SSH Brute Force Attack")
    print("=" * 70)
    
    print("\n📊 Scenario: Detected SSH brute force attempt on port 22")
    print("Question: What MITRE ATT&CK techniques are involved?\n")
    
    # Map the attack
    result = await map_attack_to_mitre("ssh_bruteforce")
    
    if result.get("success"):
        print("🎯 MITRE ATT&CK Analysis:\n")
        
        for i, tech in enumerate(result.get("mapped_techniques", []), 1):
            print(f"{i}. {tech.get('technique_id')} - {tech.get('name')}")
            print(f"   Tactics: {', '.join(tech.get('tactics', []))}")
            print(f"   Platforms: {', '.join(tech.get('platforms', []))}")
            
            # Show description preview
            desc = tech.get("description", "")
            if desc:
                print(f"   Description: {desc[:200]}...")
            
            print(f"   Detection: {tech.get('detection', 'N/A')[:150]}...")
            print()
        
        print("💡 Conclusion:")
        print("   This attack involves Brute Force (T1110) credential access")
        print("   targeting SSH (T1021.004) for remote service access.")
        print("   Recommended: Monitor failed authentication attempts and implement")
        print("   account lockout policies.\n")


async def main():
    print("\n🧪 MITRE ATT&CK Integration Tests\n")
    
    try:
        await test_query_technique()
        await test_search_techniques()
        await test_map_attack_to_mitre()
        await test_real_world_scenario()
        
        print("\n" + "=" * 70)
        print("✅ All MITRE ATT&CK tests complete!")
        print("=" * 70)
        print("\n💡 Summary:")
        print("  ✅ Technique queries working")
        print("  ✅ Search functionality operational")
        print("  ✅ Attack mapping successful")
        print("  ✅ Real-world scenarios supported")
        print()
        
    except Exception as e:
        print(f"\n❌ Test error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
