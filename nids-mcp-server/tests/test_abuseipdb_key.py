"""
Quick test of AbuseIPDB with API key
"""
import requests
import time

API_KEY = "e5b9090d652537dbad0461bac957ea14738d2ef20bc713ae16524af49e28ab51dcc8c6376236ef19"

# Test with known malicious IPs
test_ips = [
    ("185.220.101.1", "Known Tor exit node"),
    ("45.142.212.61", "Known SSH bruteforce attacker"),
    ("8.8.8.8", "Google DNS (should be clean)"),
]

print("="*70)
print("AbuseIPDB API Test with Real Malicious IPs")
print("="*70)

for test_ip, description in test_ips:
    headers = {
        'Key': API_KEY,
        'Accept': 'application/json',
    }

    params = {
        'ipAddress': test_ip,
        'maxAgeInDays': '90',
        'verbose': ''
    }

    print(f"\n{'='*70}")
    print(f"🔍 Checking IP: {test_ip}")
    print(f"📝 Description: {description}")
    print(f"{'='*70}")

    try:
        response = requests.get(
            'https://api.abuseipdb.com/api/v2/check',
            headers=headers,
            params=params,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ Response received!")
            print(f"  IP Address: {data['data']['ipAddress']}")
            print(f"  Abuse Confidence Score: {data['data']['abuseConfidenceScore']}%")
            print(f"  Total Reports: {data['data']['totalReports']}")
            print(f"  Country: {data['data'].get('countryCode', 'Unknown')}")
            print(f"  ISP: {data['data'].get('isp', 'Unknown')}")
            print(f"  Usage Type: {data['data'].get('usageType', 'Unknown')}")
            
            if data['data']['totalReports'] > 0:
                print(f"\n⚠️  MALICIOUS IP DETECTED!")
                print(f"   Reported {data['data']['totalReports']} times")
                print(f"   Confidence: {data['data']['abuseConfidenceScore']}%")
                
                # Show categories if available
                if 'reports' in data['data'] and data['data']['reports']:
                    print(f"\n   Recent Reports:")
                    for report in data['data']['reports'][:3]:
                        print(f"   - {report.get('reportedAt', 'Unknown')}: Categories {report.get('categories', [])}")
            else:
                print(f"\n✅ Clean IP - No abuse reports")
        else:
            print(f"\n❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"\n❌ Exception: {e}")
    
    # Rate limit: be nice to the API
    time.sleep(1)

print(f"\n{'='*70}")
print("✅ All tests complete!")
print(f"{'='*70}")

# Test with known malicious IPs
test_ips = [
    "185.220.101.1",    # Known Tor exit node / malicious
    "45.142.212.61",    # Known SSH bruteforce attacker
    "8.8.8.8",          # Google DNS (should be clean)
]

for test_ip in test_ips:
    headers = {
        'Key': API_KEY,
        'Accept': 'application/json',
    }

    params = {
        'ipAddress': test_ip,
        'maxAgeInDays': '90',
        'verbose': ''
    }

    print(f"\n{'='*70}")
    print(f"🔍 Checking IP: {test_ip}")
    print(f"{'='*70}")

    try:
        response = requests.get(
            'https://api.abuseipdb.com/api/v2/check',
            headers=headers,
            params=params,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n✅ Response received!")
            print(f"  IP Address: {data['data']['ipAddress']}")
            print(f"  Abuse Confidence Score: {data['data']['abuseConfidenceScore']}%")
            print(f"  Total Reports: {data['data']['totalReports']}")
            print(f"  Country: {data['data'].get('countryCode', 'Unknown')}")
            print(f"  ISP: {data['data'].get('isp', 'Unknown')}")
            print(f"  Usage Type: {data['data'].get('usageType', 'Unknown')}")
            
            if data['data']['totalReports'] > 0:
                print(f"\n⚠️  MALICIOUS IP DETECTED!")
                print(f"   Reported {data['data']['totalReports']} times")
                print(f"   Confidence: {data['data']['abuseConfidenceScore']}%")
                
                # Show recent reports if available
                if 'reports' in data['data'] and data['data']['reports']:
                    print(f"\n   Recent Reports:")
                    for report in data['data']['reports'][:3]:
                        print(f"   - {report.get('reportedAt', 'Unknown date')}: {report.get('comment', 'No comment')[:80]}")
            else:
                print(f"\n✅ Clean IP - No abuse reports")
        else:
            print(f"\n❌ Error: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"\n❌ Exception: {e}")

