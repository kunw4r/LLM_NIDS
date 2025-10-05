#!/usr/bin/env python3
"""
Test script for NIDS MCP Server tools
Tests each tool independently before MCP integration
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from tools.ip_geolocation import geolocate_ip, format_geolocation_summary


async def test_ip_geolocation():
    """Test the IP geolocation tool"""
    print("=" * 70)
    print("Testing IP Geolocation Tool")
    print("=" * 70)
    
    test_ips = [
        "8.8.8.8",           # Google DNS (public)
        "1.1.1.1",           # Cloudflare DNS (public)
        "192.168.1.1",       # Private IP
        "172.31.66.58",      # Private IP (from your dataset)
        "invalid_ip",        # Invalid IP
    ]
    
    for ip in test_ips:
        print(f"\n🔍 Testing IP: {ip}")
        print("-" * 70)
        
        result = await geolocate_ip(ip)
        summary = format_geolocation_summary(result)
        
        print(summary)
        print()


async def main():
    """Run all tests"""
    print("\n🧪 NIDS MCP Server - Tool Tests\n")
    
    await test_ip_geolocation()
    
    print("\n" + "=" * 70)
    print("✅ All tests complete!")
    print("=" * 70)
    print("\n💡 Next: Configure this server in Cline's MCP settings")
    print()


if __name__ == "__main__":
    asyncio.run(main())
