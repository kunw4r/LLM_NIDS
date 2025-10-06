# AlienVault OTX Setup Guide

## What is AlienVault OTX?

**AlienVault Open Threat Exchange (OTX)** is the world's first truly open threat intelligence community. It enables collaborative defense through:

- **100,000+ participants** sharing threat data
- **Pulse feeds** - curated threat intelligence collections
- **IOC (Indicators of Compromise)** with full context
- **MITRE ATT&CK** technique mapping
- **Free unlimited API access**

## Why OTX for NIDS?

1. **Open-Source**: Free, unlimited API access (perfect for academic research)
2. **Contextual Intelligence**: Not just "is this bad?" but "why is it bad?"
3. **Community-Driven**: Real security researchers sharing real threat data
4. **MITRE Integration**: Direct mapping to ATT&CK framework
5. **Complements AbuseIPDB**: OTX provides context, AbuseIPDB provides confidence scores

## Getting Started

### 1. Create Free Account

Visit: https://otx.alienvault.com/

- Click "Sign Up" (top right)
- Fill in details (email, username, password)
- Verify email address
- **No credit card required!**

### 2. Get Your API Key

1. Log into OTX
2. Go to: https://otx.alienvault.com/api
3. Your API key is displayed on the page
4. Copy the key (starts with a long hex string)

### 3. Configure in NIDS MCP Server

**Option A: Environment Variable (Recommended)**
```bash
export OTX_API_KEY='your-api-key-here'
```

**Option B: Update config.py**
```python
OTX_API_KEY = "your-api-key-here"
```

## Features Available

### 1. IP Reputation Check
```python
from tools.alienvault_otx import check_ip_otx

result = check_ip_otx("185.220.101.1")
# Returns: threat pulses, malware families, attack types, MITRE techniques
```

### 2. Search Threat Pulses
```python
from tools.alienvault_otx import search_pulses

result = search_pulses("DDoS", limit=10)
# Returns: Top 10 DDoS-related threat intelligence collections
```

### 3. Get Pulse Indicators
```python
from tools.alienvault_otx import get_pulse_indicators

result = get_pulse_indicators("pulse_id_here")
# Returns: All IOCs (IPs, domains, URLs, hashes) from that pulse
```

## API Limits

- **Free tier**: Unlimited API calls
- **Rate limit**: ~10 requests/second (reasonable use)
- **No daily/monthly limits**

## Testing Your Setup

Run the test script:
```bash
cd nids-mcp-server
python3 test_otx.py
```

Expected output:
- ✅ Malicious IP detected (with pulse data)
- ✅ Clean IP identified
- ✅ Search results for common attack types

## Data Sources

OTX aggregates threat intelligence from:
- Security researchers
- Honeypot networks
- Malware analysis platforms
- Government threat feeds
- Commercial security vendors
- Academic institutions

## Use Cases for Your Thesis

1. **Threat Context**: When IP is flagged, OTX provides "why" (associated campaigns, malware families)
2. **MITRE Mapping**: Automatic mapping of detected threats to ATT&CK techniques
3. **Historical Analysis**: Track how threats evolve over time
4. **False Positive Reduction**: Context helps distinguish noise from real threats

## Example Output

```
AlienVault OTX Threat Intelligence - 185.220.101.1
======================================================================

⚠️  THREAT DETECTED
   Total Pulses: 50

🦠 Malware Families:
   • Emotet
   • TrickBot

🎯 MITRE ATT&CK Techniques:
   • T1110.001 - Password Guessing
   • T1071.001 - Web Protocols

⚔️  Attack Types:
   • webscanner
   • bruteforce
   • scanning

📡 Threat Pulses (top 5 of 50):
   1. Webscanners 2018-02-09 thru current day
      Automated detection of webscanners based on 404
      Tags: webscanner, bruteforce, web app attack
```

## Troubleshooting

**"No results found"**
- IP might be clean
- OTX doesn't have data on this IP
- Check if API key is set correctly

**"API Error 401"**
- Invalid API key
- Check you copied the full key
- Try regenerating key on OTX website

**"Search returns 0 pulses"**
- API key required for search functionality
- Free accounts have full access
- Check your query terms

## Resources

- **OTX Website**: https://otx.alienvault.com/
- **API Documentation**: https://otx.alienvault.com/api
- **Pulse Directory**: https://otx.alienvault.com/browse/pulses
- **Community Forum**: https://forums.alienvault.com/

## Integration with Your Tools

OTX works alongside:
1. **IP Geolocation**: Geographic context
2. **IP Threat Intel (abuse.ch)**: C&C server detection
3. **MITRE ATT&CK**: Technique mapping
4. **AbuseIPDB**: Community confidence scores
5. **NetFlow Analyzer**: Real-time threat correlation

Together, these tools provide comprehensive threat intelligence for your NIDS!
