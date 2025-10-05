# NIDS MCP Server

A **Model Context Protocol (MCP) server** providing network intrusion detection tools for analyzing NetFlow data and identifying security threats.

## 🎯 Purpose

This MCP server augments LLM capabilities (like Cline) with specialized cybersecurity tools for:
- IP geolocation and enrichment
- Threat intelligence lookups
- MITRE ATT&CK framework integration
- NetFlow traffic analysis and anomaly detection

## 🏗️ Architecture

```
nids-mcp-server/
├── server.py              # Main MCP server (stdio-based)
├── config.py              # Configuration and settings
├── requirements.txt       # Python dependencies
├── tools/                 # Individual tool implementations
│   ├── ip_geolocation.py  # ✅ Tool 1: IP geolocation
│   ├── ip_threat_intel.py # 🔜 Tool 2: Threat intelligence
│   ├── mitre_attack.py    # 🔜 Tool 3: MITRE ATT&CK queries
│   └── netflow_analyzer.py# 🔜 Tool 4: NetFlow analysis
└── utils/                 # Helper utilities
```

## 🛠️ Available Tools

### ✅ Tool 1: `geolocate_ip`

Geolocate any IP address and get enriched information.

**Input:**
```json
{
  "ip": "8.8.8.8"
}
```

**Output:**
```json
{
  "success": true,
  "ip": "8.8.8.8",
  "location": {
    "country": "United States",
    "city": "Mountain View",
    "coordinates": {"latitude": 37.4056, "longitude": -122.0775}
  },
  "network": {
    "isp": "Google LLC",
    "asn": "AS15169"
  },
  "flags": {
    "is_proxy": false,
    "is_hosting": true
  }
}
```

**Use Cases:**
- Identify suspicious traffic origins
- Detect connections from unexpected countries
- Flag proxy/VPN/hosting IPs
- Enrich NetFlow records with location context

---

## 📦 Installation

### 1. Install Dependencies

```bash
cd nids-mcp-server
pip install -r requirements.txt
```

### 2. Configure Cline to Use This Server

Add to your Cline MCP settings (`~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` on macOS):

```json
{
  "mcpServers": {
    "nids": {
      "command": "python3",
      "args": ["/Users/kunwa/Library/CloudStorage/OneDrive-Personal/UNI/SEM 2 2025/Thesis/nids-mcp-server/server.py"]
    }
  }
}
```

### 3. Restart Cline/VS Code

The server will be available in Cline's tool list!

---

## 🧪 Testing

### Standalone Test

Test the IP geolocation tool directly:

```bash
cd nids-mcp-server
python test_tools.py
```

### Through MCP (with Cline)

Once configured in Cline, you can ask:

```
"Can you geolocate the IP address 172.31.66.58?"
```

Cline will automatically call the `geolocate_ip` tool!

---

## 🔧 Configuration

Edit `config.py` to customize:
- API endpoints
- Detection thresholds
- Suspicious port definitions
- Dataset paths

---

## 📊 Dataset Integration

The server is designed to work with the **CICIDS2018 NetFlow dataset** (already split into development/validation/test sets).

Tools can access:
- **Development set** (`../datasets/development.csv`) - 7M flows for pattern learning
- **Validation set** (`../datasets/validation.csv`) - 5M flows for testing
- **Test set** (`../datasets/test.csv`) - 🔒 Reserved for final evaluation

---

## 🚀 Roadmap

- [x] Tool 1: IP Geolocation
- [ ] Tool 2: IP Threat Intelligence (abuse.ch feeds)
- [ ] Tool 3: MITRE ATT&CK Integration
- [ ] Tool 4: NetFlow Analyzer

---

## 📝 License

For educational/research use as part of thesis work.

---

## 🤝 Contributing

This is a thesis project. Suggestions welcome!
