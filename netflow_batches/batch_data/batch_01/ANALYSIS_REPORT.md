# NetFlow Analysis Report

## Summary of Findings

### Flow Analysis
1. **IP: 18.221.219.4**
   - **Verdict**: Benign
   - **Geolocation**: Dublin, Ohio, United States
   - **ISP**: Amazon.com, Inc.
   - **Recommendation**: Allow

2. **IP: 18.219.5.43**
   - **Verdict**: Benign
   - **Geolocation**: Dublin, Ohio, United States
   - **ISP**: Amazon.com, Inc.
   - **Recommendation**: Allow

3. **IP: 172.31.69.25**
   - **Verdict**: Benign
   - **Geolocation**: Private IP address (RFC1918)
   - **Recommendation**: Allow

4. **IP: 172.31.69.28**
   - **Verdict**: Benign
   - **Geolocation**: Private IP address (RFC1918)
   - **Recommendation**: Allow

### Techniques Mapped to MITRE ATT&CK
- **Drive-by Compromise (T1189)**
- **Exploit Public-Facing Application (T1190)**
- **Active Scanning (T1595)**
- **Vulnerability Scanning (T1595.002)**
- **Wordlist Scanning (T1595.003)**
- **Scan Databases (T1596.005)**
- **Threat Intel Vendors (T1597.001)**

## Recommendations
- Monitor for suspicious network traffic that could indicate scanning or exploitation attempts.
- Ensure all publicly exposed services are intended to be so and restrict access to any that should only be available internally.
- Regularly scan externally facing systems for vulnerabilities and establish procedures to rapidly patch systems.
