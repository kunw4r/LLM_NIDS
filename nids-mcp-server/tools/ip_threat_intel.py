"""
IP Threat Intelligence Tool
Checks IP addresses against open-source threat intelligence feeds
Uses abuse.ch feeds (Feodo Tracker, SSL Blacklist) and local blacklists
"""

import requests
import ipaddress
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path
from config import THREAT_FEEDS


# Cache for threat feeds (to avoid repeated downloads)
_threat_cache = {
    "feodo": {"data": None, "last_updated": None},
    "sslbl": {"data": None, "last_updated": None},
    "local": {"data": set(), "last_updated": None}
}


def is_valid_ip(ip: str) -> bool:
    """Validate if the string is a valid IPv4 or IPv6 address"""
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


def load_feodo_tracker() -> Dict[str, Any]:
    """
    Load Feodo Tracker botnet C&C IP list from abuse.ch
    https://feodotracker.abuse.ch/
    """
    try:
        response = requests.get(THREAT_FEEDS["abuse_ch_feodo"], timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # Convert to searchable format
        ip_list = {}
        for entry in data:
            ip = entry.get("ip_address")
            if ip:
                ip_list[ip] = {
                    "malware": entry.get("malware", "Unknown"),
                    "status": entry.get("status", "Unknown"),
                    "first_seen": entry.get("first_seen"),
                    "last_online": entry.get("last_online"),
                    "confidence": "high",
                    "source": "Feodo Tracker (abuse.ch)"
                }
        
        return ip_list
        
    except Exception as e:
        print(f"Warning: Failed to load Feodo Tracker: {e}")
        return {}


def load_sslbl() -> set:
    """
    Load SSL Blacklist from abuse.ch
    https://sslbl.abuse.ch/
    """
    try:
        response = requests.get(THREAT_FEEDS["abuse_ch_ssl"], timeout=10)
        response.raise_for_status()
        
        # Parse text format (comments start with #)
        ip_set = set()
        for line in response.text.splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                # Extract IP (format might be "IP:PORT" or just "IP")
                ip_part = line.split(":")[0] if ":" in line else line
                if is_valid_ip(ip_part):
                    ip_set.add(ip_part)
        
        return ip_set
        
    except Exception as e:
        print(f"Warning: Failed to load SSL Blacklist: {e}")
        return set()


def load_local_blacklist() -> set:
    """
    Load local blacklist from file (if exists)
    Format: One IP per line, comments start with #
    """
    blacklist_path = Path(__file__).parent.parent / "data" / "local_blacklist.txt"
    
    if not blacklist_path.exists():
        return set()
    
    try:
        ip_set = set()
        with open(blacklist_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    if is_valid_ip(line):
                        ip_set.add(line)
        return ip_set
    except Exception as e:
        print(f"Warning: Failed to load local blacklist: {e}")
        return set()


def update_threat_feeds(force: bool = False) -> None:
    """
    Update threat intelligence feeds
    
    Args:
        force: Force update even if recently updated
    """
    global _threat_cache
    
    # Check if we need to update (don't update more than once per hour)
    if not force and _threat_cache["feodo"]["last_updated"]:
        age = (datetime.now() - _threat_cache["feodo"]["last_updated"]).seconds
        if age < 3600:  # 1 hour
            return
    
    print("🔄 Updating threat intelligence feeds...")
    
    # Load Feodo Tracker
    _threat_cache["feodo"]["data"] = load_feodo_tracker()
    _threat_cache["feodo"]["last_updated"] = datetime.now()
    
    # Load SSL Blacklist
    _threat_cache["sslbl"]["data"] = load_sslbl()
    _threat_cache["sslbl"]["last_updated"] = datetime.now()
    
    # Load local blacklist
    _threat_cache["local"]["data"] = load_local_blacklist()
    _threat_cache["local"]["last_updated"] = datetime.now()
    
    print(f"✅ Loaded {len(_threat_cache['feodo']['data'])} Feodo IPs")
    print(f"✅ Loaded {len(_threat_cache['sslbl']['data'])} SSL Blacklist IPs")
    print(f"✅ Loaded {len(_threat_cache['local']['data'])} local blacklist IPs")


async def check_ip_reputation(ip: str, update_feeds: bool = True) -> Dict[str, Any]:
    """
    Check IP reputation against threat intelligence feeds
    
    Args:
        ip: IP address to check
        update_feeds: Whether to update feeds if not recently updated
    
    Returns:
        Dictionary with threat intelligence information
    """
    # Validate IP
    if not is_valid_ip(ip):
        return {
            "success": False,
            "error": f"Invalid IP address: {ip}",
            "ip": ip
        }
    
    # Check if private IP
    try:
        ip_obj = ipaddress.ip_address(ip)
        if ip_obj.is_private:
            return {
                "success": True,
                "ip": ip,
                "is_private": True,
                "is_malicious": False,
                "message": "Private IP address - not in public threat feeds"
            }
    except ValueError:
        pass
    
    # Update feeds if needed
    if update_feeds:
        update_threat_feeds(force=False)
    
    # Check against all feeds
    findings = []
    is_malicious = False
    confidence = "none"
    
    # Check Feodo Tracker
    if _threat_cache["feodo"]["data"] and ip in _threat_cache["feodo"]["data"]:
        feodo_data = _threat_cache["feodo"]["data"][ip]
        findings.append({
            "source": "Feodo Tracker (abuse.ch)",
            "category": "Botnet C&C",
            "malware": feodo_data["malware"],
            "status": feodo_data["status"],
            "first_seen": feodo_data["first_seen"],
            "last_online": feodo_data["last_online"],
            "confidence": "high"
        })
        is_malicious = True
        confidence = "high"
    
    # Check SSL Blacklist
    if _threat_cache["sslbl"]["data"] and ip in _threat_cache["sslbl"]["data"]:
        findings.append({
            "source": "SSL Blacklist (abuse.ch)",
            "category": "Malicious SSL/TLS",
            "confidence": "high"
        })
        is_malicious = True
        confidence = "high"
    
    # Check local blacklist
    if _threat_cache["local"]["data"] and ip in _threat_cache["local"]["data"]:
        findings.append({
            "source": "Local Blacklist",
            "category": "Custom",
            "confidence": "high"
        })
        is_malicious = True
        confidence = "high"
    
    # Build response
    result = {
        "success": True,
        "ip": ip,
        "is_private": False,
        "is_malicious": is_malicious,
        "confidence": confidence,
        "threat_count": len(findings),
        "findings": findings,
        "checked_sources": [
            "Feodo Tracker (abuse.ch)",
            "SSL Blacklist (abuse.ch)",
            "Local Blacklist"
        ],
        "last_updated": _threat_cache["feodo"]["last_updated"].isoformat() if _threat_cache["feodo"]["last_updated"] else None
    }
    
    return result


def format_threat_summary(threat_data: Dict[str, Any]) -> str:
    """
    Format threat intelligence data into a human-readable summary
    
    Args:
        threat_data: Dictionary from check_ip_reputation()
    
    Returns:
        Formatted string summary
    """
    if not threat_data.get("success"):
        return f"❌ Threat check failed: {threat_data.get('error', 'Unknown error')}"
    
    ip = threat_data.get("ip")
    
    if threat_data.get("is_private"):
        return f"🔒 {ip} is a private IP address (not in public threat feeds)"
    
    is_malicious = threat_data.get("is_malicious", False)
    confidence = threat_data.get("confidence", "none")
    findings = threat_data.get("findings", [])
    
    if not is_malicious:
        return f"✅ {ip} is CLEAN - No threats found in {len(threat_data.get('checked_sources', []))} sources"
    
    # Build threat summary
    summary_parts = [
        f"⚠️  IP: {ip}",
        f"🚨 Status: MALICIOUS (Confidence: {confidence.upper()})",
        f"📊 Found in {len(findings)} threat feed(s):",
    ]
    
    for i, finding in enumerate(findings, 1):
        source = finding.get("source", "Unknown")
        category = finding.get("category", "Unknown")
        
        detail = f"   {i}. [{source}] {category}"
        
        # Add extra details if available
        if "malware" in finding:
            detail += f" - {finding['malware']}"
        if "status" in finding:
            detail += f" ({finding['status']})"
        
        summary_parts.append(detail)
    
    # Add recommendations
    summary_parts.append("\n💡 Recommended Actions:")
    summary_parts.append("   • Block this IP immediately")
    summary_parts.append("   • Investigate any connections from/to this IP")
    summary_parts.append("   • Check for compromise indicators")
    
    return "\n".join(summary_parts)


# MCP Tool Definition
IP_THREAT_INTEL_TOOL = {
    "name": "check_ip_reputation",
    "description": "Check an IP address against multiple threat intelligence feeds (abuse.ch Feodo Tracker, SSL Blacklist, local blacklist). Returns malicious status, confidence level, and detailed findings from each source. Use this to identify known malicious IPs, botnets, C&C servers, and SSL threats.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "ip": {
                "type": "string",
                "description": "IPv4 or IPv6 address to check against threat intelligence feeds"
            },
            "update_feeds": {
                "type": "boolean",
                "description": "Whether to update threat feeds before checking (default: true)",
                "default": True
            }
        },
        "required": ["ip"]
    }
}
