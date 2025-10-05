"""
IP Geolocation Tool
Provides IP address geolocation and enrichment using ip-api.com (free, no API key required)
"""

import requests
import ipaddress
from typing import Dict, Any, Optional
from config import IP_API_ENDPOINT, IP_API_RATE_LIMIT


def is_valid_ip(ip: str) -> bool:
    """Validate if the string is a valid IPv4 or IPv6 address"""
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


def is_private_ip(ip: str) -> bool:
    """Check if IP is in private range"""
    try:
        ip_obj = ipaddress.ip_address(ip)
        return ip_obj.is_private
    except ValueError:
        return False


async def geolocate_ip(ip: str) -> Dict[str, Any]:
    """
    Geolocate an IP address and return enriched information
    
    Args:
        ip: IP address to geolocate (IPv4 or IPv6)
    
    Returns:
        Dictionary with geolocation data and metadata
    """
    # Validate IP
    if not is_valid_ip(ip):
        return {
            "success": False,
            "error": f"Invalid IP address: {ip}",
            "ip": ip
        }
    
    # Check if private IP
    if is_private_ip(ip):
        return {
            "success": True,
            "ip": ip,
            "is_private": True,
            "message": "Private IP address (RFC1918) - no public geolocation available",
            "ranges": {
                "10.0.0.0/8": "Private Class A",
                "172.16.0.0/12": "Private Class B",
                "192.168.0.0/16": "Private Class C",
                "0.0.0.0/8": "Special use"
            }
        }
    
    # Query ip-api.com
    try:
        url = IP_API_ENDPOINT.format(ip=ip)
        # Add fields parameter to get comprehensive data
        params = {
            "fields": "status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query"
        }
        
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        # Check if query was successful
        if data.get("status") == "fail":
            return {
                "success": False,
                "error": data.get("message", "Unknown error"),
                "ip": ip
            }
        
        # Format the response
        result = {
            "success": True,
            "ip": data.get("query", ip),
            "is_private": False,
            "location": {
                "country": data.get("country"),
                "country_code": data.get("countryCode"),
                "region": data.get("regionName"),
                "region_code": data.get("region"),
                "city": data.get("city"),
                "zip_code": data.get("zip"),
                "timezone": data.get("timezone"),
                "coordinates": {
                    "latitude": data.get("lat"),
                    "longitude": data.get("lon")
                }
            },
            "network": {
                "isp": data.get("isp"),
                "organization": data.get("org"),
                "asn": data.get("as"),
                "asn_name": data.get("asname")
            },
            "flags": {
                "is_mobile": data.get("mobile", False),
                "is_proxy": data.get("proxy", False),
                "is_hosting": data.get("hosting", False)
            }
        }
        
        return result
        
    except requests.RequestException as e:
        return {
            "success": False,
            "error": f"API request failed: {str(e)}",
            "ip": ip
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "ip": ip
        }


def format_geolocation_summary(geo_data: Dict[str, Any]) -> str:
    """
    Format geolocation data into a human-readable summary
    
    Args:
        geo_data: Dictionary from geolocate_ip()
    
    Returns:
        Formatted string summary
    """
    if not geo_data.get("success"):
        return f"❌ Geolocation failed: {geo_data.get('error', 'Unknown error')}"
    
    ip = geo_data.get("ip")
    
    if geo_data.get("is_private"):
        return f"🔒 {ip} is a private IP address (internal network)"
    
    loc = geo_data.get("location", {})
    net = geo_data.get("network", {})
    flags = geo_data.get("flags", {})
    
    summary_parts = [
        f"📍 IP: {ip}",
        f"🌍 Location: {loc.get('city', 'Unknown')}, {loc.get('region', 'Unknown')}, {loc.get('country', 'Unknown')}",
        f"🏢 ISP: {net.get('isp', 'Unknown')}",
        f"🔢 ASN: {net.get('asn', 'Unknown')} ({net.get('asn_name', 'Unknown')})",
    ]
    
    # Add flags if relevant
    flag_list = []
    if flags.get("is_proxy"):
        flag_list.append("Proxy")
    if flags.get("is_hosting"):
        flag_list.append("Hosting/Datacenter")
    if flags.get("is_mobile"):
        flag_list.append("Mobile")
    
    if flag_list:
        summary_parts.append(f"⚠️  Flags: {', '.join(flag_list)}")
    
    return "\n".join(summary_parts)


# MCP Tool Definition
IP_GEOLOCATION_TOOL = {
    "name": "geolocate_ip",
    "description": "Geolocate an IP address and get enriched information including country, city, ISP, ASN, and flags (proxy/hosting/mobile). Useful for identifying the origin of network traffic and detecting suspicious sources.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "ip": {
                "type": "string",
                "description": "IPv4 or IPv6 address to geolocate"
            }
        },
        "required": ["ip"]
    }
}
