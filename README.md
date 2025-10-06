# LLM-Augmented Network Intrusion Detection System (NIDS)

> A thesis project exploring LLM-augmented network intrusion detection using Model Context Protocol (MCP) and the CICIDS2018 dataset.

## 🎯 Project Overview

This project investigates how Large Language Models (LLMs) can enhance network intrusion detection by leveraging external tools through the Model Context Protocol (MCP). The system analyzes NetFlow data to identify and classify security threats using a combination of:

- **IP Intelligence**: Geolocation and threat reputation lookups
- **MITRE ATT&CK Framework**: Mapping network behaviors to attack techniques
- **NetFlow Analysis**: Heuristic-based anomaly detection
- **LLM Reasoning**: Context-aware threat assessment and explanation

## 🏗️ Architecture

```
LLM_NIDS/
├── nids-mcp-server/           # MCP server with security tools
│   ├── server.py              # Main MCP server
│   ├── tools/                 # Individual tool implementations
│   │   ├── ip_geolocation.py  # ✅ IP geolocation
│   │   ├── ip_threat_intel.py # 🔜 Threat intelligence
│   │   ├── mitre_attack.py    # 🔜 MITRE ATT&CK queries
│   │   └── netflow_analyzer.py# 🔜 NetFlow analysis
│   └── config.py              # Configuration
├── datasets/                  # CICIDS2018 NetFlow splits
│   ├── development.csv        # 35% - For tool development
│   ├── validation.csv         # 25% - For tuning
│   └── test.csv              # 40% - For final evaluation
└── split_dataset.py           # Dataset splitting utility
```

## 📊 Dataset

**CICIDS2018 NetFlow v3** - 20 million flow records with 53 features

- **Benign Traffic**: 87% (17.5M flows)
- **Attack Types**: 14 different attack categories
  - DDoS (HOIC, LOIC-HTTP, LOIC-UDP)
  - DoS (Hulk, GoldenEye, Slowloris, SlowHTTPTest)
  - Brute Force (FTP, SSH, Web, XSS)
  - Bot, Infiltration, SQL Injection

### Dataset Split
- **Development** (35%): 7M flows - Pattern learning and tool building
- **Validation** (25%): 5M flows - Testing and threshold tuning
- **Test** (40%): 8M flows - Final evaluation (not used during development)

## 🛠️ MCP Tools

### ✅ Implemented

#### 1. **IP Geolocation** (`geolocate_ip`)
- Geolocates any IPv4/IPv6 address
- Returns: Country, city, ISP, ASN, coordinates
- Flags: Proxy, hosting, mobile connections
- Handles private IPs correctly
- **API**: ip-api.com (free, no key required)

#### 2. **IP Threat Intelligence** (`check_ip_reputation`)
- Checks IPs against multiple threat feeds
- Sources: Feodo Tracker, SSL Blacklist (abuse.ch), local blacklist
- Returns: Malicious status, confidence, detailed findings
- Identifies: Botnets, C&C servers, SSL threats
- Auto-updates feeds (cached for 1 hour)

#### 3. **MITRE ATT&CK Framework** (`query_mitre_technique`, `search_mitre_techniques`, `map_attack_to_mitre`)
- **691 techniques** dynamically loaded from official MITRE GitHub
- Query specific techniques by ID (e.g., T1110.001)
- Search techniques by keywords
- Map CICIDS2018 attacks to MITRE tactics
- Auto-updates weekly from: https://github.com/mitre/cti

#### 4. **AbuseIPDB** (`check_ip_abuseipdb`)
- Community-driven IP reputation (800K+ researchers)
- Attack category classification (SSH, DDoS, port scan, etc.)
- Abuse confidence score (0-100%)
- Report history and context
- **API**: Free tier - 1,000 requests/day
- **Setup**: See [ABUSEIPDB_SETUP.md](nids-mcp-server/ABUSEIPDB_SETUP.md)

### 🔜 In Progress

#### 5. **AlienVault OTX** (`check_ip_otx`)
- Open-source threat intelligence platform
- IOC (Indicators of Compromise) with context
- Pulse feeds from global community
- Network indicators (IPs, domains, URLs, hashes)

#### 6. **NetFlow Analyzer** (`analyze_netflow`)
- Heuristic-based anomaly detection
- Pattern matching for known attacks
- Statistical analysis of traffic flows
- MITRE ATT&CK technique mapping

## 🚀 Setup

### Prerequisites
- Python 3.9+
- LLM client supporting MCP (e.g., Cline, Claude Desktop)

### Installation

```bash
# Clone repository
git clone git@github.com:kunw4r/LLM_NIDS.git
cd LLM_NIDS

# Install dependencies
cd nids-mcp-server
pip install -r requirements.txt

# Test tools
python test_tools.py
```

### Configure MCP Client

Add to your MCP settings (e.g., Cline):

```json
{
  "mcpServers": {
    "nids": {
      "command": "python3",
      "args": ["/path/to/LLM_NIDS/nids-mcp-server/server.py"]
    }
  }
}
```

## 🧪 Usage

### Standalone Testing
```bash
cd nids-mcp-server
python test_tools.py
```

### Through LLM (Cline)
```
"Can you geolocate the IP address 8.8.8.8?"
"Is 185.220.101.1 a known malicious IP?"
"Check the reputation of 192.168.1.100"
"What MITRE ATT&CK technique is associated with SSH brute forcing?"
```

## 📈 Research Goals

1. **Tool Augmentation**: Demonstrate LLM effectiveness with specialized security tools
2. **Explainability**: Generate human-readable threat explanations
3. **Detection Accuracy**: Measure precision/recall vs traditional NIDS
4. **False Positive Reduction**: Leverage LLM context understanding
5. **Attack Classification**: Map network behavior to MITRE ATT&CK framework

## 📝 Development Log

- **2025-10-06**: Tool 2 - IP Threat Intelligence ✅
  - Implemented threat feed integration (abuse.ch)
  - Added Feodo Tracker (botnet C&C) support
  - Added SSL Blacklist support
  - Local blacklist functionality
  - Auto-caching with 1-hour refresh
  - All tests passing ✅
  
- **2025-10-06**: Git repository setup ✅
  - Repository: [github.com/kunw4r/LLM_NIDS](https://github.com/kunw4r/LLM_NIDS)
  - Configured .gitignore for large datasets
  - All code committed and pushed
  
- **2025-10-05**: Project initialization
  - Dataset split with stratification ✅
  - MCP server architecture designed ✅
  - IP geolocation tool implemented and tested ✅

## 🤝 Contributing

This is a thesis project. Feedback and suggestions welcome!

## 📄 License

For educational/research purposes.

## 📧 Contact

Kunwar - [GitHub](https://github.com/kunw4r)

---

**Status**: 🚧 Active Development | **Progress**: 2/4 tools complete
