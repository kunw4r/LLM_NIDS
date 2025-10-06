# NetFlow Sample for MCP Server Testing

## Test Scenario: SSH Brute Force Attack

Use this real NetFlow record from CICIDS2018 to test the MCP server integration with Cline.

### NetFlow Record (CSV Format)

```csv
FLOW_START_MILLISECONDS,FLOW_END_MILLISECONDS,IPV4_SRC_ADDR,L4_SRC_PORT,IPV4_DST_ADDR,L4_DST_PORT,PROTOCOL,L7_PROTO,IN_BYTES,IN_PKTS,OUT_BYTES,OUT_PKTS,TCP_FLAGS,CLIENT_TCP_FLAGS,SERVER_TCP_FLAGS,FLOW_DURATION_MILLISECONDS,DURATION_IN,DURATION_OUT,MIN_TTL,MAX_TTL,LONGEST_FLOW_PKT,SHORTEST_FLOW_PKT,MIN_IP_PKT_LEN,MAX_IP_PKT_LEN,SRC_TO_DST_SECOND_BYTES,DST_TO_SRC_SECOND_BYTES,RETRANSMITTED_IN_BYTES,RETRANSMITTED_IN_PKTS,RETRANSMITTED_OUT_BYTES,RETRANSMITTED_OUT_PKTS,SRC_TO_DST_AVG_THROUGHPUT,DST_TO_SRC_AVG_THROUGHPUT,NUM_PKTS_UP_TO_128_BYTES,NUM_PKTS_128_TO_256_BYTES,NUM_PKTS_256_TO_512_BYTES,NUM_PKTS_512_TO_1024_BYTES,NUM_PKTS_1024_TO_1514_BYTES,TCP_WIN_MAX_IN,TCP_WIN_MAX_OUT,ICMP_TYPE,ICMP_IPV4_TYPE,DNS_QUERY_ID,DNS_QUERY_TYPE,DNS_TTL_ANSWER,FTP_COMMAND_RET_CODE,SRC_TO_DST_IAT_MIN,SRC_TO_DST_IAT_MAX,SRC_TO_DST_IAT_AVG,SRC_TO_DST_IAT_STDDEV,DST_TO_SRC_IAT_MIN,DST_TO_SRC_IAT_MAX,DST_TO_SRC_IAT_AVG,DST_TO_SRC_IAT_STDDEV,Label,Attack

1518633543480,1518633543849,13.58.98.64,36526,172.31.69.25,22,6,92,3148,23,3869,23,27,27,27,369,368,368,63,63,1028,52,52,1028,10,8,0,0,0,0,68064,83654,35,7,1,2,1,26883,26847,0,0,0,0,0,0,0,95,16,29,0,132,16,35,1,SSH-Bruteforce
```

### Human-Readable Breakdown

**Flow Details:**
- **Source IP**: `13.58.98.64` (attacker)
- **Source Port**: `36526`
- **Destination IP**: `172.31.69.25` (victim)
- **Destination Port**: `22` (SSH)
- **Protocol**: `6` (TCP)
- **Attack Type**: `SSH-Bruteforce`

**Traffic Statistics:**
- **Duration**: 369 milliseconds
- **Incoming Bytes**: 3,148 bytes (23 packets)
- **Outgoing Bytes**: 3,869 bytes (23 packets)
- **Bidirectional**: Balanced traffic (typical of failed login attempts)

**Key Indicators:**
- ✅ Port 22 (SSH) - common bruteforce target
- ✅ Short duration (369ms) - quick connection attempt
- ✅ Balanced packet count - handshake + auth attempt + rejection
- ✅ Source IP: AWS EC2 (13.58.98.64 is Ohio region)
- ✅ Destination: Private RFC1918 (172.31.x.x)

---

## Suggested Test Prompts for Cline

### Test 1: Basic IP Analysis
```
I have a suspicious NetFlow connection. Can you analyze the source IP 13.58.98.64?

Use the geolocation tool to find where it's from, then check it against threat 
intelligence databases (AbuseIPDB and AlienVault OTX) to see if it's been 
reported as malicious.
```

**Expected Results:**
- Geographic location (likely Ohio, USA - AWS EC2)
- Hosting/cloud provider detection
- Threat intelligence results (may or may not be in databases)

---

### Test 2: Attack Identification
```
I detected a network flow with these characteristics:
- Source: 13.58.98.64
- Destination: 172.31.69.25:22 (SSH)
- Duration: 369ms
- Traffic: 3148 bytes in, 3869 bytes out (23 packets each way)
- Attack label from dataset: SSH-Bruteforce

Can you:
1. Verify if this looks like a bruteforce attack
2. Check if the source IP is malicious using threat intelligence
3. Map this attack to MITRE ATT&CK techniques
4. Provide defensive recommendations
```

**Expected Tool Usage:**
1. ✅ `geolocate_ip` - Source IP location
2. ✅ `check_ip_reputation` - abuse.ch feeds
3. ✅ `check_ip_abuseipdb` - Community reports
4. ✅ `check_ip_otx` - Threat pulses
5. ✅ `map_attack_to_mitre` - ATT&CK techniques for "SSH-Bruteforce"
6. ✅ `query_mitre_technique` - Details on T1110 (Brute Force)

---

### Test 3: Comprehensive Threat Analysis
```
Analyze this complete NetFlow record from our NIDS:

Source IP: 13.58.98.64:36526
Destination IP: 172.31.69.25:22
Protocol: TCP/SSH
Duration: 369ms
Bytes: 3148 in / 3869 out
Packets: 23 in / 23 out
Label: SSH-Bruteforce

Please perform a comprehensive threat analysis:
1. Geographic and network context (is this normal traffic?)
2. Threat intelligence lookup (all available sources)
3. Attack pattern identification
4. MITRE ATT&CK framework mapping
5. Recommended detection rules and mitigations
```

**Expected Workflow:**
1. IP Geolocation → AWS Ohio datacenter
2. Threat Intel → Check all 3 sources (abuse.ch, AbuseIPDB, OTX)
3. Attack Recognition → Port 22, bruteforce pattern
4. MITRE Mapping → T1110 (Brute Force), T1110.001 (Password Guessing), T1021.004 (SSH)
5. Recommendations → Account lockout, MFA, monitoring

---

### Test 4: Quick Triage
```
Quick triage needed: Is IP 13.58.98.64 malicious?
```

**Expected:**
- Quick check across all threat intel sources
- Summary of findings

---

## How to Run This Test

### Step 1: Configure Cline with MCP Server

1. Open VS Code
2. Ensure Cline extension is installed
3. Configure MCP server in Cline settings:
   ```json
   {
     "mcpServers": {
       "nids": {
         "command": "python3",
         "args": [
           "/Users/kunwa/Library/CloudStorage/OneDrive-Personal/UNI/SEM 2 2025/Thesis/nids-mcp-server/server.py"
         ]
       }
     }
   }
   ```

### Step 2: Start Cline Chat

1. Open Cline chat panel
2. Paste one of the test prompts above
3. Watch Cline automatically discover and use the MCP tools!

### Step 3: Verify Tool Usage

Check that Cline uses these tools:
- [ ] `geolocate_ip` - Geographic lookup
- [ ] `check_ip_reputation` - abuse.ch feeds
- [ ] `check_ip_abuseipdb` - Community database
- [ ] `check_ip_otx` - AlienVault OTX
- [ ] `map_attack_to_mitre` - Attack type mapping
- [ ] `query_mitre_technique` - Technique details
- [ ] `search_mitre_techniques` - Search for related techniques

---

## Expected Outputs

### IP Geolocation (13.58.98.64)
```
Location: Ashburn, Virginia, USA (or Ohio, USA)
ISP: Amazon.com, Inc.
ASN: AS14618
Type: Hosting/Data Center
```

### Threat Intelligence
- **abuse.ch**: Likely not found (unless recently reported)
- **AbuseIPDB**: May have reports if this IP has been used for attacks
- **AlienVault OTX**: May have pulses if part of AWS abuse campaigns

### MITRE ATT&CK Mapping
- **T1110**: Brute Force (Credential Access)
- **T1110.001**: Password Guessing
- **T1021.004**: Remote Services: SSH

---

## Success Criteria

✅ **Test Passes If:**
1. Cline automatically discovers available MCP tools
2. Cline calls appropriate tools for the query
3. Tools return valid data (no errors)
4. Cline synthesizes results into coherent analysis
5. Response includes:
   - Geographic context
   - Threat intelligence findings
   - MITRE ATT&CK mapping
   - Defensive recommendations

❌ **Test Fails If:**
1. Cline doesn't see the MCP tools
2. Tools return errors
3. API rate limits exceeded
4. Missing data from required tools

---

## Troubleshooting

**"MCP server not found"**
- Check server.py path in Cline config
- Ensure Python 3 is in PATH
- Test server manually: `python3 server.py`

**"API key errors"**
- Check AbuseIPDB key in config.py
- OTX works without key (limited)
- abuse.ch feeds don't need keys

**"No threat intelligence found"**
- This is normal! Not all IPs are in databases
- AWS IPs are often clean unless actively malicious
- Try known malicious IP: `185.220.101.1` (from earlier tests)

---

## Alternative Test IPs

If you want guaranteed threat intel hits:

**Known Malicious (from earlier tests):**
- `185.220.101.1` - Tor exit node, 100% confidence malicious
- `162.243.103.246` - Emotet C&C server
- `79.194.143.100` - QakBot C&C server

**Known Clean:**
- `8.8.8.8` - Google DNS
- `1.1.1.1` - Cloudflare DNS

---

## Next Steps After Testing

Once this manual test passes:
1. ✅ Validate all tools work via MCP
2. ✅ Confirm Cline can orchestrate multi-tool workflows
3. 🚀 Build NetFlow Analyzer tool (automates this analysis)
4. 🚀 Test on full CICIDS2018 dataset (20M flows)
5. 🚀 Measure detection accuracy on test set

---

**Good luck with your test!** 🎯

This will validate that your MCP server is production-ready before building the automated NetFlow analyzer.
