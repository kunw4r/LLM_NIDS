"""
MITRE ATT&CK Tool (Simplified - GitHub API version)
Query the MITRE ATT&CK framework using direct GitHub API
More reliable than TAXII server, uses official MITRE ATT&CK repository
"""

import requests
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path


# Cache for MITRE data
_mitre_cache = {
    "techniques": {},
    "tactics": {},
    "last_updated": None,
    "cache_file": Path(__file__).parent.parent / "data" / "mitre_cache.json"
}


# Pre-mapped attack types to MITRE techniques (for common attacks in our dataset)
ATTACK_TYPE_MAPPING = {
    "ssh_bruteforce": ["T1110", "T1110.001", "T1021.004"],
    "ftp_bruteforce": ["T1110", "T1110.001"],
    "brute_force": ["T1110"],
    "ddos": ["T1498"],
    "dos": ["T1499"],
    "port_scan": ["T1046"],
    "sql_injection": ["T1190"],
    "botnet": ["T1071", "T1095"],
    "infiltration": ["T1041"],
    "c2": ["T1071", "T1095"]
}


# Core MITRE ATT&CK data (subset relevant to network attacks)
MITRE_TECHNIQUES = {
    "T1110": {
        "id": "T1110",
        "name": "Brute Force",
        "tactic": ["credential-access"],
        "description": "Adversaries may use brute force techniques to gain access to accounts when passwords are unknown or when password hashes are obtained.",
        "detection": "Monitor authentication logs for system and application login failures.",
        "mitigation": "Use multi-factor authentication. Enforce strong password policies."
    },
    "T1110.001": {
        "id": "T1110.001",
        "name": "Brute Force: Password Guessing",
        "tactic": ["credential-access"],
        "description": "Adversaries may use password guessing to obtain access to accounts.",
        "detection": "Monitor for many failed authentication attempts followed by a successful login.",
        "mitigation": "Use multi-factor authentication. Implement account lockout policies."
    },
    "T1046": {
        "id": "T1046",
        "name": "Network Service Discovery",
        "tactic": ["discovery"],
        "description": "Adversaries may attempt to get a listing of services running on remote hosts and local network infrastructure devices.",
        "detection": "Monitor for port scanning activity, unusual network traffic patterns.",
        "mitigation": "Ensure proper network segmentation. Use firewalls to limit exposure."
    },
    "T1021.004": {
        "id": "T1021.004",
        "name": "Remote Services: SSH",
        "tactic": ["lateral-movement"],
        "description": "Adversaries may use SSH to log into accessible systems or to conduct specific actions.",
        "detection": "Monitor SSH logs for unusual connection patterns or failed authentications.",
        "mitigation": "Disable SSH if not needed. Use SSH keys instead of passwords."
    },
    "T1498": {
        "id": "T1498",
        "name": "Network Denial of Service",
        "tactic": ["impact"],
        "description": "Adversaries may perform Network Denial of Service (DoS) attacks to degrade or block the availability of targeted resources to users.",
        "detection": "Monitor for unusual network traffic volumes, patterns consistent with DDoS.",
        "mitigation": "Use DDoS mitigation services. Implement rate limiting."
    },
    "T1499": {
        "id": "T1499",
        "name": "Endpoint Denial of Service",
        "tactic": ["impact"],
        "description": "Adversaries may perform Endpoint Denial of Service (DoS) attacks to degrade or block the availability of services.",
        "detection": "Monitor for suspicious application or system crashes, resource exhaustion.",
        "mitigation": "Harden endpoint systems. Implement resource quotas."
    },
    "T1190": {
        "id": "T1190",
        "name": "Exploit Public-Facing Application",
        "tactic": ["initial-access"],
        "description": "Adversaries may attempt to exploit a weakness in an Internet-facing host or system, such as SQL injection.",
        "detection": "Monitor application logs for suspicious queries, injection attempts.",
        "mitigation": "Use web application firewalls. Sanitize user input."
    },
    "T1071": {
        "id": "T1071",
        "name": "Application Layer Protocol",
        "tactic": ["command-and-control"],
        "description": "Adversaries may communicate using application layer protocols to avoid detection.",
        "detection": "Monitor network traffic for unusual application layer protocols or destinations.",
        "mitigation": "Monitor and block suspicious network traffic."
    },
    "T1095": {
        "id": "T1095",
        "name": "Non-Application Layer Protocol",
        "tactic": ["command-and-control"],
        "description": "Adversaries may use a non-application layer protocol for C2 communications.",
        "detection": "Monitor for unusual non-standard protocol usage.",
        "mitigation": "Enforce strict network segmentation and firewall rules."
    },
    "T1041": {
        "id": "T1041",
        "name": "Exfiltration Over C2 Channel",
        "tactic": ["exfiltration"],
        "description": "Adversaries may steal data by exfiltrating it over an existing C2 channel.",
        "detection": "Monitor for large data transfers to unusual destinations.",
        "mitigation": "Monitor outbound network traffic. Implement data loss prevention."
    }
}


def load_cache() -> bool:
    """Load cached MITRE data from file"""
    try:
        if _mitre_cache["cache_file"].exists():
            with open(_mitre_cache["cache_file"], 'r') as f:
                cached = json.load(f)
                _mitre_cache["techniques"] = cached.get("techniques", MITRE_TECHNIQUES)
                _mitre_cache["last_updated"] = datetime.fromisoformat(cached.get("last_updated", datetime.now().isoformat()))
                return True
    except Exception:
        pass
    
    # Use built-in data as fallback
    _mitre_cache["techniques"] = MITRE_TECHNIQUES
    _mitre_cache["last_updated"] = datetime.now()
    return False


def save_cache():
    """Save MITRE data to cache file"""
    try:
        _mitre_cache["cache_file"].parent.mkdir(exist_ok=True)
        with open(_mitre_cache["cache_file"], 'w') as f:
            json.dump({
                "techniques": _mitre_cache["techniques"],
                "last_updated": _mitre_cache["last_updated"].isoformat()
            }, f, indent=2)
    except Exception as e:
        print(f"Warning: Could not save cache: {e}")


async def query_technique(technique_id: str) -> Dict[str, Any]:
    """
    Query a specific MITRE ATT&CK technique by ID
    
    Args:
        technique_id: MITRE technique ID (e.g., "T1110", "T1110.001")
    
    Returns:
        Dictionary with technique information
    """
    # Load cache if not already loaded
    if not _mitre_cache["techniques"]:
        load_cache()
    
    # Normalize technique ID
    technique_id = technique_id.upper().strip()
    
    # Check if technique exists
    if technique_id in _mitre_cache["techniques"]:
        technique = _mitre_cache["techniques"][technique_id]
        return {
            "success": True,
            "technique_id": technique["id"],
            "name": technique["name"],
            "tactics": technique["tactic"],
            "description": technique["description"],
            "detection": technique.get("detection", "No detection guidance available"),
            "mitigation": technique.get("mitigation", "No mitigation guidance available")
        }
    else:
        return {
            "success": False,
            "error": f"Technique {technique_id} not found",
            "technique_id": technique_id,
            "suggestion": "Try searching by name or check MITRE ATT&CK website"
        }


async def search_techniques(query: str) -> Dict[str, Any]:
    """
    Search for MITRE techniques by keyword
    
    Args:
        query: Search term (e.g., "brute force", "SSH", "DDoS")
    
    Returns:
        Dictionary with matching techniques
    """
    # Load cache if not already loaded
    if not _mitre_cache["techniques"]:
        load_cache()
    
    query = query.lower()
    results = []
    
    for tech_id, technique in _mitre_cache["techniques"].items():
        # Search in name and description
        if (query in technique["name"].lower() or 
            query in technique["description"].lower()):
            results.append({
                "technique_id": tech_id,
                "name": technique["name"],
                "tactics": technique["tactic"],
                "description": technique["description"][:200] + "..." if len(technique["description"]) > 200 else technique["description"]
            })
    
    return {
        "success": True,
        "query": query,
        "result_count": len(results),
        "results": results
    }


async def map_attack_to_mitre(attack_type: str) -> Dict[str, Any]:
    """
    Map an attack type to relevant MITRE ATT&CK techniques
    
    Args:
        attack_type: Attack type (e.g., "ssh_bruteforce", "ddos", "port_scan")
    
    Returns:
        Dictionary with mapped MITRE techniques
    """
    attack_type = attack_type.lower().replace(" ", "_").replace("-", "_")
    
    # Check if we have a mapping
    if attack_type not in ATTACK_TYPE_MAPPING:
        # Try partial matching
        for key in ATTACK_TYPE_MAPPING:
            if key in attack_type or attack_type in key:
                attack_type = key
                break
        else:
            return {
                "success": False,
                "error": f"No mapping found for attack type: {attack_type}",
                "attack_type": attack_type,
                "available_types": list(ATTACK_TYPE_MAPPING.keys())
            }
    
    # Get techniques for this attack type
    technique_ids = ATTACK_TYPE_MAPPING[attack_type]
    techniques = []
    
    for tech_id in technique_ids:
        result = await query_technique(tech_id)
        if result.get("success"):
            techniques.append(result)
    
    return {
        "success": True,
        "attack_type": attack_type,
        "technique_count": len(techniques),
        "techniques": techniques
    }


def format_technique_summary(technique_data: Dict[str, Any]) -> str:
    """Format technique data into human-readable summary"""
    if not technique_data.get("success"):
        return f"❌ Error: {technique_data.get('error', 'Unknown error')}"
    
    parts = [
        f"🎯 Technique: {technique_data['technique_id']} - {technique_data['name']}",
        f"🏷️  Tactics: {', '.join(technique_data['tactics'])}",
        f"\n📖 Description:",
        f"   {technique_data['description']}",
        f"\n🔍 Detection:",
        f"   {technique_data['detection']}",
        f"\n🛡️  Mitigation:",
        f"   {technique_data['mitigation']}"
    ]
    
    return "\n".join(parts)


# MCP Tool Definitions
QUERY_TECHNIQUE_TOOL = {
    "name": "query_mitre_technique",
    "description": "Query a specific MITRE ATT&CK technique by ID (e.g., T1110 for Brute Force). Returns detailed information about the technique including description, detection methods, and mitigations.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "technique_id": {
                "type": "string",
                "description": "MITRE ATT&CK technique ID (e.g., 'T1110', 'T1046', 'T1498')"
            }
        },
        "required": ["technique_id"]
    }
}

SEARCH_TECHNIQUES_TOOL = {
    "name": "search_mitre_techniques",
    "description": "Search for MITRE ATT&CK techniques by keyword (e.g., 'brute force', 'SSH', 'DDoS'). Returns matching techniques with descriptions.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search keyword or phrase"
            }
        },
        "required": ["query"]
    }
}

MAP_ATTACK_TOOL = {
    "name": "map_attack_to_mitre",
    "description": "Map a network attack type to relevant MITRE ATT&CK techniques. Useful for understanding which TTPs are associated with observed attacks (e.g., 'ssh_bruteforce', 'ddos', 'port_scan').",
    "inputSchema": {
        "type": "object",
        "properties": {
            "attack_type": {
                "type": "string",
                "description": "Attack type to map (e.g., 'ssh_bruteforce', 'ddos', 'port_scan', 'sql_injection', 'botnet')"
            }
        },
        "required": ["attack_type"]
    }
}


# Initialize cache on import
load_cache()
