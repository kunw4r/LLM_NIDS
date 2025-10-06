"""
MITRE ATT&CK Tool - Full GitHub Integration
Downloads complete MITRE ATT&CK data from official GitHub repository
No hardcoding - fetches all techniques dynamically
"""

import requests
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from pathlib import Path


# Cache settings
CACHE_DIR = Path(__file__).parent.parent / "data" / "mitre"
CACHE_FILE = CACHE_DIR / "mitre_attack_data.json"
CACHE_DURATION = timedelta(days=7)  # Update weekly

# MITRE ATT&CK GitHub URLs
MITRE_ATTACK_URL = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"
MITRE_ATTACK_GITHUB = "https://github.com/mitre/cti"


def download_mitre_data() -> Dict[str, Any]:
    """
    Download complete MITRE ATT&CK data from GitHub
    Returns parsed STIX bundle with all techniques
    """
    print("📥 Downloading MITRE ATT&CK data from GitHub...")
    print(f"   Source: {MITRE_ATTACK_URL}")
    
    try:
        response = requests.get(MITRE_ATTACK_URL, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        print(f"✅ Downloaded successfully ({len(response.content) / 1024 / 1024:.1f} MB)")
        
        return data
        
    except requests.RequestException as e:
        print(f"❌ Failed to download: {e}")
        raise Exception(f"Could not download MITRE ATT&CK data: {e}")


def parse_mitre_data(stix_bundle: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Parse STIX bundle and extract techniques, tactics, and relationships
    
    Returns:
        Dictionary with 'techniques', 'tactics', 'relationships', 'groups', 'software'
    """
    print("🔄 Parsing MITRE ATT&CK data...")
    
    techniques = {}
    tactics = {}
    relationships = []
    groups = {}
    software = {}
    
    objects = stix_bundle.get("objects", [])
    
    for obj in objects:
        obj_type = obj.get("type")
        
        # Extract techniques (attack-pattern)
        if obj_type == "attack-pattern":
            if obj.get("revoked") or obj.get("deprecated"):
                continue
                
            external_refs = obj.get("external_references", [])
            technique_id = None
            
            for ref in external_refs:
                if ref.get("source_name") == "mitre-attack":
                    technique_id = ref.get("external_id")
                    break
            
            if technique_id:
                # Extract kill chain phases (tactics)
                kill_chain = obj.get("kill_chain_phases", [])
                tactic_names = [phase.get("phase_name") for phase in kill_chain]
                
                techniques[technique_id] = {
                    "id": technique_id,
                    "name": obj.get("name"),
                    "description": obj.get("description", ""),
                    "tactics": tactic_names,
                    "platforms": obj.get("x_mitre_platforms", []),
                    "data_sources": obj.get("x_mitre_data_sources", []),
                    "detection": obj.get("x_mitre_detection", "No detection guidance available"),
                    "version": obj.get("x_mitre_version", "unknown"),
                    "created": obj.get("created"),
                    "modified": obj.get("modified"),
                    "stix_id": obj.get("id")
                }
        
        # Extract tactics (x-mitre-tactic)
        elif obj_type == "x-mitre-tactic":
            external_refs = obj.get("external_references", [])
            tactic_id = None
            
            for ref in external_refs:
                if ref.get("source_name") == "mitre-attack":
                    tactic_id = ref.get("external_id")
                    break
            
            if tactic_id:
                tactics[obj.get("x_mitre_shortname")] = {
                    "id": tactic_id,
                    "name": obj.get("name"),
                    "description": obj.get("description", ""),
                    "shortname": obj.get("x_mitre_shortname")
                }
        
        # Extract groups (intrusion-set)
        elif obj_type == "intrusion-set":
            if obj.get("revoked") or obj.get("deprecated"):
                continue
                
            external_refs = obj.get("external_references", [])
            group_id = None
            
            for ref in external_refs:
                if ref.get("source_name") == "mitre-attack":
                    group_id = ref.get("external_id")
                    break
            
            if group_id:
                groups[group_id] = {
                    "id": group_id,
                    "name": obj.get("name"),
                    "description": obj.get("description", ""),
                    "aliases": obj.get("aliases", [])
                }
        
        # Extract software (tool, malware)
        elif obj_type in ["tool", "malware"]:
            if obj.get("revoked") or obj.get("deprecated"):
                continue
                
            external_refs = obj.get("external_references", [])
            software_id = None
            
            for ref in external_refs:
                if ref.get("source_name") == "mitre-attack":
                    software_id = ref.get("external_id")
                    break
            
            if software_id:
                software[software_id] = {
                    "id": software_id,
                    "name": obj.get("name"),
                    "type": obj_type,
                    "description": obj.get("description", ""),
                    "platforms": obj.get("x_mitre_platforms", [])
                }
        
        # Extract relationships
        elif obj_type == "relationship":
            relationships.append({
                "source": obj.get("source_ref"),
                "target": obj.get("target_ref"),
                "type": obj.get("relationship_type"),
                "description": obj.get("description", "")
            })
    
    print(f"✅ Parsed {len(techniques)} techniques")
    print(f"✅ Parsed {len(tactics)} tactics")
    print(f"✅ Parsed {len(groups)} groups")
    print(f"✅ Parsed {len(software)} software")
    print(f"✅ Parsed {len(relationships)} relationships")
    
    return {
        "techniques": techniques,
        "tactics": tactics,
        "groups": groups,
        "software": software,
        "relationships": relationships,
        "metadata": {
            "downloaded": datetime.now().isoformat(),
            "source": MITRE_ATTACK_URL,
            "stix_version": stix_bundle.get("spec_version"),
            "stix_id": stix_bundle.get("id")
        }
    }


def save_cache(data: Dict[str, Any]):
    """Save parsed MITRE data to cache"""
    try:
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(CACHE_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"💾 Cached data saved to: {CACHE_FILE}")
    except Exception as e:
        print(f"⚠️  Warning: Could not save cache: {e}")


def load_cache() -> Optional[Dict[str, Any]]:
    """Load cached MITRE data if available and fresh"""
    if not CACHE_FILE.exists():
        print("📂 No cache found, will download fresh data")
        return None
    
    try:
        # Check cache age
        cache_age = datetime.now() - datetime.fromtimestamp(CACHE_FILE.stat().st_mtime)
        
        if cache_age > CACHE_DURATION:
            print(f"⏰ Cache is {cache_age.days} days old, will download fresh data")
            return None
        
        with open(CACHE_FILE, 'r') as f:
            data = json.load(f)
        
        print(f"✅ Loaded cached data ({cache_age.days} days old)")
        print(f"   Techniques: {len(data.get('techniques', {}))}")
        print(f"   Tactics: {len(data.get('tactics', {}))}")
        
        return data
        
    except Exception as e:
        print(f"⚠️  Warning: Could not load cache: {e}")
        return None


def get_mitre_data(force_update: bool = False) -> Dict[str, Any]:
    """
    Get MITRE ATT&CK data - from cache or download fresh
    
    Args:
        force_update: Force download even if cache is fresh
    
    Returns:
        Parsed MITRE data dictionary
    """
    if not force_update:
        cached = load_cache()
        if cached:
            return cached
    
    # Download and parse fresh data
    stix_bundle = download_mitre_data()
    parsed_data = parse_mitre_data(stix_bundle)
    save_cache(parsed_data)
    
    return parsed_data


async def query_technique(technique_id: str, force_update: bool = False) -> Dict[str, Any]:
    """
    Query a specific MITRE ATT&CK technique by ID
    
    Args:
        technique_id: MITRE technique ID (e.g., "T1110", "T1110.001")
        force_update: Force re-download of MITRE data
    
    Returns:
        Dictionary with technique information
    """
    # Get MITRE data
    mitre_data = get_mitre_data(force_update=force_update)
    techniques = mitre_data.get("techniques", {})
    
    # Normalize technique ID
    technique_id = technique_id.upper().strip()
    
    # Check if technique exists
    if technique_id in techniques:
        technique = techniques[technique_id]
        
        # Get mitigation info from relationships
        mitigations = []
        relationships = mitre_data.get("relationships", [])
        
        for rel in relationships:
            if rel.get("type") == "mitigates" and technique.get("stix_id") in rel.get("target", ""):
                mitigations.append(rel.get("description", ""))
        
        return {
            "success": True,
            "technique_id": technique["id"],
            "name": technique["name"],
            "tactics": technique["tactics"],
            "description": technique["description"],
            "platforms": technique.get("platforms", []),
            "data_sources": technique.get("data_sources", []),
            "detection": technique.get("detection", "No detection guidance available"),
            "mitigations": mitigations if mitigations else ["No specific mitigations documented"],
            "version": technique.get("version"),
            "created": technique.get("created"),
            "modified": technique.get("modified")
        }
    else:
        return {
            "success": False,
            "error": f"Technique {technique_id} not found in MITRE ATT&CK framework",
            "technique_id": technique_id,
            "total_techniques": len(techniques),
            "suggestion": "Check technique ID or try searching by name"
        }


async def search_techniques(query: str, force_update: bool = False) -> Dict[str, Any]:
    """
    Search for MITRE techniques by keyword
    
    Args:
        query: Search term (e.g., "brute force", "SSH", "DDoS")
        force_update: Force re-download of MITRE data
    
    Returns:
        Dictionary with matching techniques
    """
    # Get MITRE data
    mitre_data = get_mitre_data(force_update=force_update)
    techniques = mitre_data.get("techniques", {})
    
    query = query.lower()
    results = []
    
    for tech_id, technique in techniques.items():
        # Search in name, description, and tactics
        if (query in technique["name"].lower() or 
            query in technique["description"].lower() or
            any(query in tactic.lower() for tactic in technique.get("tactics", []))):
            
            results.append({
                "technique_id": tech_id,
                "name": technique["name"],
                "tactics": technique["tactics"],
                "platforms": technique.get("platforms", []),
                "description": technique["description"][:200] + "..." if len(technique["description"]) > 200 else technique["description"]
            })
    
    return {
        "success": True,
        "query": query,
        "result_count": len(results),
        "total_techniques": len(techniques),
        "results": sorted(results, key=lambda x: x["technique_id"])
    }


async def map_attack_to_mitre(attack_type: str, force_update: bool = False) -> Dict[str, Any]:
    """
    Map an attack type to relevant MITRE ATT&CK techniques using keyword search
    
    Args:
        attack_type: Attack type (e.g., "ssh_bruteforce", "ddos", "port_scan")
        force_update: Force re-download of MITRE data
    
    Returns:
        Dictionary with mapped MITRE techniques
    """
    # Map common attack types to search terms
    attack_mappings = {
        "ssh_bruteforce": ["brute force", "SSH", "password"],
        "ftp_bruteforce": ["brute force", "FTP"],
        "brute_force": ["brute force", "credential"],
        "bruteforce": ["brute force"],
        "ddos": ["denial of service", "network flood"],
        "dos": ["denial of service"],
        "port_scan": ["network service discovery", "port"],
        "sql_injection": ["exploit", "web application", "injection"],
        "botnet": ["command and control", "C2"],
        "infiltration": ["exfiltration"],
        "c2": ["command and control"],
        "web_attack": ["exploit public"],
        "malware": ["malware"]
    }
    
    attack_type = attack_type.lower().replace(" ", "_").replace("-", "_")
    
    # Get search terms for this attack type
    search_terms = attack_mappings.get(attack_type)
    
    if not search_terms:
        # Try partial matching
        for key in attack_mappings:
            if key in attack_type or attack_type in key:
                search_terms = attack_mappings[key]
                break
    
    if not search_terms:
        return {
            "success": False,
            "error": f"No mapping found for attack type: {attack_type}",
            "attack_type": attack_type,
            "available_types": list(attack_mappings.keys()),
            "suggestion": "Try searching directly or use one of the available attack types"
        }
    
    # Search for techniques matching any of the search terms
    all_results = []
    seen_ids = set()
    
    for term in search_terms:
        result = await search_techniques(term, force_update=force_update)
        for tech in result.get("results", []):
            tech_id = tech["technique_id"]
            if tech_id not in seen_ids:
                seen_ids.add(tech_id)
                # Get full details
                full_tech = await query_technique(tech_id, force_update=False)
                if full_tech.get("success"):
                    all_results.append(full_tech)
    
    return {
        "success": True,
        "attack_type": attack_type,
        "search_terms": search_terms,
        "technique_count": len(all_results),
        "techniques": all_results
    }


def format_technique_summary(technique_data: Dict[str, Any]) -> str:
    """Format technique data into human-readable summary"""
    if not technique_data.get("success"):
        error_msg = technique_data.get("error", "Unknown error")
        suggestion = technique_data.get("suggestion", "")
        return f"❌ Error: {error_msg}\n💡 {suggestion}" if suggestion else f"❌ Error: {error_msg}"
    
    parts = [
        f"🎯 Technique: {technique_data['technique_id']} - {technique_data['name']}",
        f"🏷️  Tactics: {', '.join(technique_data['tactics'])}",
        f"💻 Platforms: {', '.join(technique_data.get('platforms', ['N/A']))}",
        f"\n📖 Description:",
        f"   {technique_data['description'][:300]}{'...' if len(technique_data['description']) > 300 else ''}",
        f"\n🔍 Detection:",
        f"   {technique_data.get('detection', 'No detection guidance')[:200]}",
    ]
    
    mitigations = technique_data.get('mitigations', [])
    if mitigations and mitigations[0] != "No specific mitigations documented":
        parts.append(f"\n🛡️  Mitigations:")
        for i, mit in enumerate(mitigations[:2], 1):
            parts.append(f"   {i}. {mit[:150]}{'...' if len(mit) > 150 else ''}")
    
    return "\n".join(parts)


# MCP Tool Definitions
QUERY_TECHNIQUE_TOOL = {
    "name": "query_mitre_technique",
    "description": "Query a specific MITRE ATT&CK technique by ID (e.g., T1110). Fetches complete, up-to-date information directly from MITRE's official GitHub repository including description, detection methods, mitigations, and related tactics.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "technique_id": {
                "type": "string",
                "description": "MITRE ATT&CK technique ID (e.g., 'T1110', 'T1046', 'T1498')"
            },
            "force_update": {
                "type": "boolean",
                "description": "Force re-download of MITRE data (default: false)",
                "default": False
            }
        },
        "required": ["technique_id"]
    }
}

SEARCH_TECHNIQUES_TOOL = {
    "name": "search_mitre_techniques",
    "description": "Search the complete MITRE ATT&CK framework by keyword. Searches across technique names, descriptions, and tactics. Data fetched directly from MITRE's GitHub repository.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search keyword or phrase (e.g., 'brute force', 'SSH', 'denial of service')"
            },
            "force_update": {
                "type": "boolean",
                "description": "Force re-download of MITRE data (default: false)",
                "default": False
            }
        },
        "required": ["query"]
    }
}

MAP_ATTACK_TOOL = {
    "name": "map_attack_to_mitre",
    "description": "Map a network attack type to relevant MITRE ATT&CK techniques. Automatically searches the framework for matching techniques. Useful for understanding which TTPs are associated with observed attacks.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "attack_type": {
                "type": "string",
                "description": "Attack type to map (e.g., 'ssh_bruteforce', 'ddos', 'port_scan', 'sql_injection', 'botnet')"
            },
            "force_update": {
                "type": "boolean",
                "description": "Force re-download of MITRE data (default: false)",
                "default": False
            }
        },
        "required": ["attack_type"]
    }
}
