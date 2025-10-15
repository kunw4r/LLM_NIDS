"""
Test script for AbuseIPDB integration

Tests the AbuseIPDB tool with various IP addresses including
known malicious IPs and benign IPs.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tools.abuseipdb import (
    check_ip,
    format_check_result,
    get_attack_categories_for_cicids,
    ATTACK_CATEGORIES,
    CICIDS_TO_ABUSEIPDB,
    check_ip_no_key
)


def test_without_api_key():
    """Test behavior when API key is not configured"""
    print("\n" + "="*70)
    print("TEST 1: Checking behavior without API key")
    print("="*70)
    
    result = check_ip_no_key("8.8.8.8")
    print(format_check_result(result))
    
    print("\n💡 Instructions to get API key:")
    if "instructions" in result:
        for instruction in result["instructions"]:
            print(f"   {instruction}")


def test_known_malicious_ip():
    """Test with a known malicious IP (if API key is available)"""
    print("\n" + "="*70)
    print("TEST 2: Checking known malicious IP")
    print("="*70)
    
    # This IP is commonly reported for SSH bruteforce attempts
    test_ip = "185.220.101.1"  # Known Tor exit node (often reported)
    
    result = check_ip(test_ip, max_age_days=90, verbose=True)
    print(format_check_result(result))


def test_benign_ip():
    """Test with Google DNS (should be clean or whitelisted)"""
    print("\n" + "="*70)
    print("TEST 3: Checking benign IP (Google DNS)")
    print("="*70)
    
    result = check_ip("8.8.8.8", max_age_days=90, verbose=False)
    print(format_check_result(result))


def test_cloudflare_dns():
    """Test with Cloudflare DNS"""
    print("\n" + "="*70)
    print("TEST 4: Checking Cloudflare DNS (1.1.1.1)")
    print("="*70)
    
    result = check_ip("1.1.1.1", max_age_days=90, verbose=False)
    print(format_check_result(result))


def test_attack_category_mapping():
    """Test CICIDS attack type to AbuseIPDB category mapping"""
    print("\n" + "="*70)
    print("TEST 5: Attack Category Mapping")
    print("="*70)
    
    print("\nCICIDS2018 Attack Type → AbuseIPDB Categories:")
    print("-" * 70)
    
    for attack_type, category_ids in CICIDS_TO_ABUSEIPDB.items():
        category_names = [ATTACK_CATEGORIES.get(cid, f"Unknown ({cid})") for cid in category_ids]
        print(f"\n{attack_type}:")
        for name in category_names:
            print(f"  • {name}")


def test_multiple_ips():
    """Test checking multiple IPs"""
    print("\n" + "="*70)
    print("TEST 6: Checking multiple IPs")
    print("="*70)
    
    test_ips = [
        ("8.8.8.8", "Google DNS - Should be clean"),
        ("1.1.1.1", "Cloudflare DNS - Should be clean"),
        ("185.220.101.1", "Tor exit node - May have reports"),
    ]
    
    for ip, description in test_ips:
        print(f"\n🔍 Checking {ip} ({description})...")
        result = check_ip(ip, max_age_days=90, verbose=False)
        
        if result.get("success"):
            score = result["abuse_confidence_score"]
            threat = result["threat_level"]
            reports = result["total_reports"]
            print(f"   Threat: {threat.upper()} | Score: {score}% | Reports: {reports}")
            
            if result.get("categories"):
                cats = [c["name"] for c in result["categories"]]
                print(f"   Categories: {', '.join(cats)}")
        else:
            print(f"   ❌ Error: {result.get('error')}")


def main():
    """Run all tests"""
    print("\n" + "="*70)
    print("AbuseIPDB Integration Test Suite")
    print("="*70)
    
    # Check if API key is set
    api_key = os.getenv("ABUSEIPDB_API_KEY", "")
    
    if not api_key:
        print("\n⚠️  API Key Not Found!")
        print("Set ABUSEIPDB_API_KEY environment variable to run full tests.")
        print("\nRunning limited tests...")
        test_without_api_key()
        test_attack_category_mapping()
        
        print("\n" + "="*70)
        print("ℹ️  To run full tests:")
        print("   1. Get free API key from https://www.abuseipdb.com/")
        print("   2. Run: export ABUSEIPDB_API_KEY='your-key-here'")
        print("   3. Re-run this test script")
        print("="*70)
        return
    
    print(f"\n✅ API Key found: {api_key[:10]}...{api_key[-4:]}")
    print("Running full test suite...\n")
    
    # Run all tests
    test_attack_category_mapping()
    test_benign_ip()
    test_cloudflare_dns()
    test_known_malicious_ip()
    test_multiple_ips()
    
    print("\n" + "="*70)
    print("✅ All tests complete!")
    print("="*70)


if __name__ == "__main__":
    main()
