"""
AbuseIPDB Integration Tool

Queries AbuseIPDB community-driven IP reputation database to check if IPs
have been reported for malicious activity with detailed attack categorization.

Features:
- Community-driven IP reputation (800K+ users)
- Attack category classification (SSH bruteforce, port scan, DDoS, etc.)
- Abuse confidence score (0-100%)
- Recent report history
- ISP and geolocation context

Free tier: 1,000 requests/day
API docs: https://docs.abuseipdb.com/
"""

import os
import sys
import requests
import json
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from pathlib import Path

# Add parent directory to path to import config
sys.path.insert(0, str(Path(__file__).parent.parent))
from config import ABUSEIPDB_API_KEY

# AbuseIPDB API configuration
ABUSEIPDB_API_URL = "https://api.abuseipdb.com/api/v2"

# Attack category mappings (AbuseIPDB category IDs)
# Reference: https://www.abuseipdb.com/categories
ATTACK_CATEGORIES = {
    3: "Fraud Orders",
    4: "DDoS Attack",
    5: "FTP Brute-Force",
    6: "Ping of Death",
    7: "Phishing",
    8: "Fraud VoIP",
    9: "Open Proxy",
    10: "Web Spam",
    11: "Email Spam",
    12: "Blog Spam",
    13: "VPN IP",
    14: "Port Scan",
    15: "Hacking",
    16: "SQL Injection",
    17: "Spoofing",
    18: "Brute-Force",
    19: "Bad Web Bot",
    20: "Exploited Host",
    21: "Web App Attack",
    22: "SSH",
    23: "IoT Targeted",
}

# Map CICIDS2018 attack types to AbuseIPDB categories
CICIDS_TO_ABUSEIPDB = {
    "DDoS": [4],  # DDoS Attack
    "DoS GoldenEye": [4],
    "DoS Hulk": [4],
    "DoS Slowhttptest": [4],
    "DoS slowloris": [4],
    "FTP-Patator": [5, 18],  # FTP Brute-Force, Brute-Force
    "SSH-Patator": [22, 18],  # SSH, Brute-Force
    "Infiltration": [15, 20],  # Hacking, Exploited Host
    "Bot": [19, 20],  # Bad Web Bot, Exploited Host
    "PortScan": [14],  # Port Scan
    "Brute Force": [18],  # Brute-Force
    "Web Attack – Brute Force": [18, 21],  # Brute-Force, Web App Attack
    "Web Attack – XSS": [21],  # Web App Attack
    "Web Attack – SQL Injection": [16, 21],  # SQL Injection, Web App Attack
}


def check_ip(ip_address: str, max_age_days: int = 90, verbose: bool = True) -> Dict[str, Any]:
    """
    Check an IP address against AbuseIPDB database.
    
    Args:
        ip_address: IP address to check
        max_age_days: Maximum age of reports to consider (default: 90 days)
        verbose: Include detailed report information
        
    Returns:
        Dictionary containing:
        - ip_address: The queried IP
        - is_whitelisted: Whether IP is whitelisted
        - abuse_confidence_score: 0-100% confidence of abuse
        - country_code: Country of origin
        - usage_type: Type of IP (e.g., Data Center, ISP)
        - isp: Internet Service Provider
        - domain: Domain name if available
        - total_reports: Total number of reports
        - num_distinct_users: Number of unique reporters
        - last_reported_at: Timestamp of last report
        - categories: List of attack categories
        - threat_level: Classification (none/low/medium/high/critical)
        - reports: Recent report details (if verbose)
    """
    
    # Check if API key is set
    if not ABUSEIPDB_API_KEY:
        return {
            "success": False,
            "error": "API key not configured",
            "message": "Set ABUSEIPDB_API_KEY environment variable or use check_ip_no_key() for limited functionality",
            "ip_address": ip_address
        }
    
    try:
        headers = {
            "Key": ABUSEIPDB_API_KEY,
            "Accept": "application/json"
        }
        
        params = {
            "ipAddress": ip_address,
            "maxAgeInDays": max_age_days,
            "verbose": verbose
        }
        
        response = requests.get(
            f"{ABUSEIPDB_API_URL}/check",
            headers=headers,
            params=params,
            timeout=10
        )
        response.raise_for_status()
        
        data = response.json()
        
        if "data" not in data:
            return {
                "success": False,
                "error": "Invalid API response",
                "ip_address": ip_address
            }
        
        ip_data = data["data"]
        
        # Classify threat level based on abuse confidence score
        score = ip_data.get("abuseConfidenceScore", 0)
        if score == 0:
            threat_level = "none"
        elif score < 25:
            threat_level = "low"
        elif score < 50:
            threat_level = "medium"
        elif score < 75:
            threat_level = "high"
        else:
            threat_level = "critical"
        
        # Get category names
        category_ids = ip_data.get("categories", [])
        categories = [
            {
                "id": cat_id,
                "name": ATTACK_CATEGORIES.get(cat_id, f"Unknown ({cat_id})")
            }
            for cat_id in category_ids
        ]
        
        result = {
            "success": True,
            "ip_address": ip_address,
            "is_whitelisted": ip_data.get("isWhitelisted", False),
            "abuse_confidence_score": score,
            "country_code": ip_data.get("countryCode", ""),
            "usage_type": ip_data.get("usageType", ""),
            "isp": ip_data.get("isp", ""),
            "domain": ip_data.get("domain", ""),
            "total_reports": ip_data.get("totalReports", 0),
            "num_distinct_users": ip_data.get("numDistinctUsers", 0),
            "last_reported_at": ip_data.get("lastReportedAt", ""),
            "categories": categories,
            "threat_level": threat_level,
        }
        
        # Add verbose report details if requested
        if verbose and "reports" in ip_data:
            result["reports"] = ip_data["reports"]
        
        return result
        
    except requests.exceptions.RequestException as e:
        return {
            "success": False,
            "error": f"API request failed: {str(e)}",
            "ip_address": ip_address
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "ip_address": ip_address
        }


def bulk_check_ips(ip_addresses: List[str], max_age_days: int = 90) -> Dict[str, Any]:
    """
    Check multiple IP addresses in a single request (requires paid plan).
    
    Args:
        ip_addresses: List of IP addresses (max 100 per request)
        max_age_days: Maximum age of reports to consider
        
    Returns:
        Dictionary mapping IP addresses to their check results
    """
    
    if not ABUSEIPDB_API_KEY:
        return {
            "success": False,
            "error": "API key not configured"
        }
    
    if len(ip_addresses) > 100:
        return {
            "success": False,
            "error": "Maximum 100 IPs per request"
        }
    
    try:
        headers = {
            "Key": ABUSEIPDB_API_KEY,
            "Accept": "application/json"
        }
        
        # Note: Bulk endpoint requires premium subscription
        # Free tier users should call check_ip() individually
        response = requests.get(
            f"{ABUSEIPDB_API_URL}/check-block",
            headers=headers,
            params={
                "network": ",".join(ip_addresses),
                "maxAgeInDays": max_age_days
            },
            timeout=15
        )
        response.raise_for_status()
        
        return response.json()
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Bulk check failed: {str(e)}"
        }


def get_attack_categories_for_cicids(attack_type: str) -> List[int]:
    """
    Get AbuseIPDB category IDs that match a CICIDS2018 attack type.
    
    Args:
        attack_type: CICIDS2018 attack type name
        
    Returns:
        List of AbuseIPDB category IDs
    """
    return CICIDS_TO_ABUSEIPDB.get(attack_type, [])


def format_check_result(result: Dict[str, Any]) -> str:
    """
    Format AbuseIPDB check result into human-readable text.
    
    Args:
        result: Result from check_ip()
        
    Returns:
        Formatted string summary
    """
    
    if not result.get("success"):
        return f"❌ Error: {result.get('error', 'Unknown error')}"
    
    ip = result["ip_address"]
    score = result["abuse_confidence_score"]
    threat = result["threat_level"]
    
    # Threat level emoji
    emoji_map = {
        "none": "✅",
        "low": "⚠️",
        "medium": "🟡",
        "high": "🟠",
        "critical": "🔴"
    }
    emoji = emoji_map.get(threat, "❓")
    
    output = [
        f"\n{'='*70}",
        f"AbuseIPDB Report for {ip}",
        f"{'='*70}",
        f"{emoji} Threat Level: {threat.upper()} (Confidence: {score}%)",
    ]
    
    if result.get("is_whitelisted"):
        output.append("✅ WHITELISTED (Trusted IP)")
    
    output.extend([
        f"\n📊 Statistics:",
        f"   Total Reports: {result['total_reports']}",
        f"   Distinct Reporters: {result['num_distinct_users']}",
    ])
    
    if result.get("last_reported_at"):
        output.append(f"   Last Reported: {result['last_reported_at']}")
    
    output.extend([
        f"\n🌍 Location & ISP:",
        f"   Country: {result.get('country_code', 'Unknown')}",
        f"   ISP: {result.get('isp', 'Unknown')}",
        f"   Usage Type: {result.get('usage_type', 'Unknown')}",
    ])
    
    if result.get("domain"):
        output.append(f"   Domain: {result['domain']}")
    
    # Categories
    categories = result.get("categories", [])
    if categories:
        output.append(f"\n🎯 Attack Categories:")
        for cat in categories:
            output.append(f"   • {cat['name']} (ID: {cat['id']})")
    else:
        output.append(f"\n🎯 Attack Categories: None reported")
    
    # Recent reports (if verbose)
    if "reports" in result and result["reports"]:
        output.append(f"\n📝 Recent Reports (last {len(result['reports'])}):")
        for i, report in enumerate(result["reports"][:5], 1):  # Show max 5
            reported_at = report.get("reportedAt", "Unknown")
            comment = report.get("comment", "No comment")
            output.append(f"   {i}. [{reported_at}] {comment[:100]}")
    
    output.append("="*70)
    
    return "\n".join(output)


def check_ip_no_key(ip_address: str) -> Dict[str, Any]:
    """
    Limited IP check without API key using public blacklist data.
    
    Note: This is a fallback method with limited functionality.
    For full features, set ABUSEIPDB_API_KEY environment variable.
    
    Args:
        ip_address: IP address to check
        
    Returns:
        Basic reputation information
    """
    
    # Try to check against AbuseIPDB's public blacklist
    # (Note: This is limited and may not be as current as API)
    
    try:
        # AbuseIPDB provides a daily updated blacklist (requires separate download)
        # For now, return a message directing users to get API key
        
        return {
            "success": False,
            "ip_address": ip_address,
            "message": "AbuseIPDB API key required for full functionality",
            "instructions": [
                "1. Sign up for free at https://www.abuseipdb.com/register",
                "2. Get your API key from https://www.abuseipdb.com/account/api",
                "3. Set environment variable: export ABUSEIPDB_API_KEY='your-key-here'",
                "4. Free tier: 1,000 requests/day"
            ]
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "ip_address": ip_address
        }


# Export main functions
__all__ = [
    "check_ip",
    "bulk_check_ips",
    "get_attack_categories_for_cicids",
    "format_check_result",
    "check_ip_no_key",
    "ATTACK_CATEGORIES",
    "CICIDS_TO_ABUSEIPDB"
]
