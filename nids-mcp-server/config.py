"""
Configuration file for NIDS MCP Server
Stores API endpoints, file paths, and configuration settings
"""

import os
from pathlib import Path

# Project paths
PROJECT_ROOT = Path(__file__).parent.parent
DATASETS_DIR = PROJECT_ROOT / "datasets"
DEV_DATASET = DATASETS_DIR / "development.csv"
VAL_DATASET = DATASETS_DIR / "validation.csv"
TEST_DATASET = DATASETS_DIR / "test.csv"

# IP Geolocation API (free, no key required)
IP_API_ENDPOINT = "http://ip-api.com/json/{ip}"
IP_API_BATCH_ENDPOINT = "http://ip-api.com/batch"
IP_API_RATE_LIMIT = 45  # requests per minute

# MITRE ATT&CK TAXII Server
MITRE_TAXII_SERVER = "https://cti-taxii.mitre.org/taxii/"
MITRE_STIX_COLLECTION = "95ecc380-afe9-11e4-9b6c-751b66dd541e"

# Threat Intelligence (Open Source)
THREAT_FEEDS = {
    "abuse_ch_feodo": "https://feodotracker.abuse.ch/downloads/ipblocklist.json",
    "abuse_ch_ssl": "https://sslbl.abuse.ch/blacklist/sslipblacklist.txt",
}

# NetFlow Analysis Thresholds
THRESHOLDS = {
    # Port scanning detection
    "port_scan_threshold": 10,  # unique destination ports from same source
    
    # Traffic asymmetry (potential data exfiltration)
    "asymmetry_ratio": 10.0,  # IN_PKTS / OUT_PKTS ratio
    
    # High packet rate (potential flooding)
    "high_packet_rate": 1000,  # packets per second
    
    # Short duration high volume
    "burst_bytes_threshold": 1000000,  # 1MB in < 1 second
    
    # Retransmission threshold
    "retransmit_threshold": 0.1,  # 10% retransmission rate
}

# Suspicious ports (commonly targeted in attacks)
SUSPICIOUS_PORTS = {
    22: "SSH",
    23: "Telnet",
    445: "SMB",
    3389: "RDP",
    3306: "MySQL",
    5432: "PostgreSQL",
    1433: "MSSQL",
    27017: "MongoDB",
}

# Known attack port patterns
ATTACK_PORT_PATTERNS = {
    "ssh_brute_force": {"port": 22, "protocol": 6},
    "ftp_brute_force": {"port": 21, "protocol": 6},
    "rdp_attack": {"port": 3389, "protocol": 6},
    "dns_attack": {"port": 53, "protocol": 17},
}

# API Keys (optional, set via environment variables)
ABUSEIPDB_API_KEY = os.getenv("ABUSEIPDB_API_KEY", "e5b9090d652537dbad0461bac957ea14738d2ef20bc713ae16524af49e28ab51dcc8c6376236ef19")
OTX_API_KEY = os.getenv("OTX_API_KEY", None)  # Get free key from https://otx.alienvault.com/
