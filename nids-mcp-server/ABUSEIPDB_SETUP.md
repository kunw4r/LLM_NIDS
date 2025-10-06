# AbuseIPDB Setup Guide

## What is AbuseIPDB?

AbuseIPDB is a community-driven IP reputation database with **800,000+ security researchers** reporting malicious IPs. It provides:

- **Attack categorization**: SSH bruteforce, DDoS, port scanning, SQL injection, etc.
- **Abuse confidence score**: 0-100% reliability rating
- **Report history**: See when and how IPs were reported
- **Free tier**: 1,000 requests/day (perfect for research/testing)

## Why Use It for NIDS?

Perfect alignment with CICIDS2018 attack types:
- ✅ DDoS Detection → AbuseIPDB Category: "DDoS Attack"
- ✅ SSH Bruteforce → Categories: "SSH", "Brute-Force"
- ✅ Port Scanning → Category: "Port Scan"
- ✅ SQL Injection → Category: "SQL Injection"
- ✅ Botnet Activity → Categories: "Bad Web Bot", "Exploited Host"

## Getting Your Free API Key

### Step 1: Sign Up (Free)
1. Go to https://www.abuseipdb.com/register
2. Enter your email and create a password
3. Verify your email address

### Step 2: Get API Key
1. Log in to https://www.abuseipdb.com/
2. Click on your username (top right)
3. Select "API" from the dropdown menu
4. Or go directly to: https://www.abuseipdb.com/account/api
5. Copy your API key (looks like: `a1b2c3d4e5f6...`)

### Step 3: Set Environment Variable

**macOS/Linux (in terminal):**
```bash
export ABUSEIPDB_API_KEY='your-api-key-here'
```

**To make it permanent (add to ~/.zshrc or ~/.bashrc):**
```bash
echo 'export ABUSEIPDB_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

**Windows (Command Prompt):**
```cmd
set ABUSEIPDB_API_KEY=your-api-key-here
```

**Windows (PowerShell):**
```powershell
$env:ABUSEIPDB_API_KEY="your-api-key-here"
```

### Step 4: Verify Setup
```bash
cd nids-mcp-server
python3 test_abuseipdb.py
```

You should see successful API responses!

## Free Tier Limits

| Feature | Free Tier |
|---------|-----------|
| Requests/day | 1,000 |
| Requests/minute | ~17 |
| Data retention | 30 days |
| Bulk check | ❌ No |
| Commercial use | ❌ No |

**Perfect for:**
- ✅ Academic research
- ✅ Thesis projects
- ✅ Testing and development
- ✅ Personal projects

## Usage Examples

### Check Single IP
```python
from tools.abuseipdb import check_ip, format_check_result

result = check_ip("185.220.101.1")  # Known Tor exit node
print(format_check_result(result))
```

### Check with Custom Settings
```python
result = check_ip(
    ip_address="1.2.3.4",
    max_age_days=30,  # Only reports from last 30 days
    verbose=True       # Include detailed report history
)
```

### Map CICIDS Attack to Categories
```python
from tools.abuseipdb import get_attack_categories_for_cicids, ATTACK_CATEGORIES

# Get categories for SSH bruteforce
categories = get_attack_categories_for_cicids("SSH-Patator")
# Returns: [22, 18] (SSH, Brute-Force)

for cat_id in categories:
    print(ATTACK_CATEGORIES[cat_id])
# Output:
# SSH
# Brute-Force
```

## Troubleshooting

### "API key not configured" Error
- Make sure you've set the `ABUSEIPDB_API_KEY` environment variable
- Restart your terminal after setting the variable
- Verify with: `echo $ABUSEIPDB_API_KEY`

### Rate Limit Exceeded
- Free tier: 1,000 requests/day
- Wait 24 hours or upgrade to paid plan
- Cache results to reduce API calls

### Invalid API Key
- Check for typos in your API key
- Make sure you copied the entire key
- Regenerate key from https://www.abuseipdb.com/account/api

## Alternative: Running Without API Key

The tool will still work with limited functionality:
- Shows attack category mappings
- Displays error messages with setup instructions
- Won't perform actual IP lookups

This is useful for:
- Understanding the tool structure
- Testing integration without API access
- Development and debugging

## Resources

- **API Documentation**: https://docs.abuseipdb.com/
- **Register**: https://www.abuseipdb.com/register
- **Category List**: https://www.abuseipdb.com/categories
- **Pricing**: https://www.abuseipdb.com/pricing

## Support

If you encounter issues:
1. Check the test script: `python3 test_abuseipdb.py`
2. Review error messages for specific guidance
3. Verify API key is correctly set
4. Check AbuseIPDB status page for outages
