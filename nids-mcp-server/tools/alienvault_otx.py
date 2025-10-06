"""
AlienVault OTX (Open Threat Exchange) Integration Tool

Queries AlienVault OTX open-source threat intelligence platform for
comprehensive threat context including pulses, IOCs, and malware analysis.

Features:
- Open-source threat intelligence platform
- Pulse feeds (curated threat collections)
- IOC (Indicators of Compromise) with context
- Network indicators (IPs, domains, URLs, file hashes)
- Malware family information
- Related threat actors
- MITRE ATT&CK technique mapping

Free: Completely free, unlimited API calls
Community: 100,000+ participants sharing threat data
API docs: https://otx.alienvault.com/api
"""

import os
import requests
import json
from typing import Dict, Any, Optional, List
from datetime import datetime

# AlienVault OTX API configuration
OTX_API_URL = "https://otx.alienvault.com/api/v1"
OTX_API_KEY = os.getenv("OTX_API_KEY", "")  # Optional: set in environment

# OTX Indicator types
INDICATOR_TYPES = {
    'IPv4': 'IPv4',
    'IPv6': 'IPv6',
    'domain': 'domain',
    'hostname': 'hostname',
    'url': 'URL',
    'file_hash_md5': 'FileHash-MD5',
    'file_hash_sha1': 'FileHash-SHA1',
    'file_hash_sha256': 'FileHash-SHA256',
}


def check_ip_otx(ip_address: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Check an IP address against AlienVault OTX for threat intelligence.
    
    Args:
        ip_address: IP address to check
        api_key: Optional OTX API key (for higher rate limits and full access)
    
    Returns:
        Dictionary containing OTX intelligence data
    """
    if not api_key:
        api_key = OTX_API_KEY
    
    result = {
        'ip_address': ip_address,
        'threat_found': False,
        'pulses': [],
        'malware_families': [],
        'attack_types': [],
        'mitre_techniques': [],
        'reputation_score': 0,
        'total_pulses': 0,
        'last_seen': None,
        'error': None
    }
    
    try:
        # OTX API endpoints for IP
        sections = [
            'general',      # General IP info
            'reputation',   # Reputation score
            'malware',      # Associated malware
            'url_list',     # URLs hosted on this IP
            'passive_dns',  # DNS history
        ]
        
        headers = {}
        if api_key:
            headers['X-OTX-API-KEY'] = api_key
        
        # Query each section
        for section in sections:
            try:
                url = f"{OTX_API_URL}/indicators/IPv4/{ip_address}/{section}"
                response = requests.get(url, headers=headers, timeout=10)
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Process general section
                    if section == 'general':
                        if 'pulse_info' in data:
                            pulses = data['pulse_info'].get('pulses', [])
                            result['total_pulses'] = len(pulses)
                            
                            # Extract pulse information
                            for pulse in pulses[:10]:  # Limit to top 10
                                pulse_info = {
                                    'name': pulse.get('name', 'Unknown'),
                                    'description': pulse.get('description', '')[:200],
                                    'created': pulse.get('created', ''),
                                    'tags': pulse.get('tags', []),
                                    'attack_ids': pulse.get('attack_ids', []),
                                    'malware_families': pulse.get('malware_families', []),
                                    'industries': pulse.get('industries', []),
                                    'references': pulse.get('references', [])
                                }
                                result['pulses'].append(pulse_info)
                                
                                # Collect malware families
                                for malware in pulse.get('malware_families', []):
                                    if malware and malware not in result['malware_families']:
                                        result['malware_families'].append(malware)
                                
                                # Collect MITRE ATT&CK IDs
                                for attack_id in pulse.get('attack_ids', []):
                                    if attack_id and attack_id.get('id') not in result['mitre_techniques']:
                                        result['mitre_techniques'].append(attack_id.get('id'))
                                
                                # Collect attack types from tags
                                for tag in pulse.get('tags', []):
                                    if any(keyword in tag.lower() for keyword in 
                                          ['ddos', 'bruteforce', 'scan', 'bot', 'malware', 'phishing']):
                                        if tag not in result['attack_types']:
                                            result['attack_types'].append(tag)
                    
                    # Process reputation section
                    elif section == 'reputation':
                        if 'reputation' in data:
                            rep = data['reputation']
                            result['reputation_score'] = rep.get('reputation', 0)
                            if rep.get('threat_score'):
                                result['threat_score'] = rep.get('threat_score')
                    
                    # Process malware section
                    elif section == 'malware':
                        if 'data' in data and data['data']:
                            result['malware_samples'] = len(data['data'])
                            result['last_seen'] = data['data'][0].get('datetime_int') if data['data'] else None
                
                elif response.status_code == 404:
                    # No data found for this IP (could be clean)
                    continue
                else:
                    result['error'] = f"API error for {section}: {response.status_code}"
            
            except Exception as e:
                # Continue even if one section fails
                continue
        
        # Determine if threat was found
        result['threat_found'] = (
            result['total_pulses'] > 0 or 
            len(result['malware_families']) > 0 or
            result['reputation_score'] < 0
        )
        
    except Exception as e:
        result['error'] = str(e)
    
    return result


def search_pulses(query: str, api_key: Optional[str] = None, limit: int = 10) -> Dict[str, Any]:
    """
    Search AlienVault OTX pulses for specific threat information.
    
    Args:
        query: Search query (attack type, malware family, etc.)
        api_key: Optional OTX API key
        limit: Maximum number of results
    
    Returns:
        Dictionary containing matching pulses
    """
    if not api_key:
        api_key = OTX_API_KEY
    
    result = {
        'query': query,
        'pulses': [],
        'total_count': 0,
        'error': None
    }
    
    try:
        headers = {}
        if api_key:
            headers['X-OTX-API-KEY'] = api_key
        
        # Search pulses
        url = f"{OTX_API_URL}/search/pulses"
        params = {'q': query, 'limit': limit}
        
        response = requests.get(url, headers=headers, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            result['total_count'] = data.get('count', 0)
            
            for pulse in data.get('results', []):
                pulse_info = {
                    'id': pulse.get('id'),
                    'name': pulse.get('name'),
                    'description': pulse.get('description', '')[:200],
                    'created': pulse.get('created'),
                    'modified': pulse.get('modified'),
                    'tags': pulse.get('tags', []),
                    'references': pulse.get('references', []),
                    'indicator_count': pulse.get('indicator_count', 0),
                    'attack_ids': pulse.get('attack_ids', []),
                    'malware_families': pulse.get('malware_families', []),
                }
                result['pulses'].append(pulse_info)
        else:
            result['error'] = f"Search failed: {response.status_code}"
    
    except Exception as e:
        result['error'] = str(e)
    
    return result


def get_pulse_indicators(pulse_id: str, api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Get indicators (IOCs) from a specific OTX pulse.
    
    Args:
        pulse_id: OTX pulse ID
        api_key: Optional OTX API key
    
    Returns:
        Dictionary containing pulse indicators
    """
    if not api_key:
        api_key = OTX_API_KEY
    
    result = {
        'pulse_id': pulse_id,
        'indicators': [],
        'indicator_types': {},
        'error': None
    }
    
    try:
        headers = {}
        if api_key:
            headers['X-OTX-API-KEY'] = api_key
        
        url = f"{OTX_API_URL}/pulses/{pulse_id}/indicators"
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            for indicator in data.get('results', []):
                ioc = {
                    'type': indicator.get('type'),
                    'indicator': indicator.get('indicator'),
                    'description': indicator.get('description', ''),
                    'created': indicator.get('created'),
                }
                result['indicators'].append(ioc)
                
                # Count by type
                ioc_type = indicator.get('type')
                result['indicator_types'][ioc_type] = result['indicator_types'].get(ioc_type, 0) + 1
        else:
            result['error'] = f"Failed to get indicators: {response.status_code}"
    
    except Exception as e:
        result['error'] = str(e)
    
    return result


def format_otx_summary(otx_data: Dict[str, Any]) -> str:
    """
    Format OTX data into a human-readable summary.
    
    Args:
        otx_data: Data from check_ip_otx()
    
    Returns:
        Formatted string summary
    """
    summary = []
    summary.append("=" * 70)
    summary.append(f"AlienVault OTX Threat Intelligence - {otx_data['ip_address']}")
    summary.append("=" * 70)
    
    if otx_data['error']:
        summary.append(f"\n❌ Error: {otx_data['error']}")
        return "\n".join(summary)
    
    # Threat status
    if otx_data['threat_found']:
        summary.append(f"\n⚠️  THREAT DETECTED")
        summary.append(f"   Total Pulses: {otx_data['total_pulses']}")
        
        if otx_data['reputation_score']:
            summary.append(f"   Reputation Score: {otx_data['reputation_score']}")
    else:
        summary.append(f"\n✅ No threats found in OTX database")
        return "\n".join(summary)
    
    # Malware families
    if otx_data['malware_families']:
        summary.append(f"\n🦠 Malware Families ({len(otx_data['malware_families'])}):")
        for malware in otx_data['malware_families'][:5]:
            summary.append(f"   • {malware}")
    
    # MITRE ATT&CK techniques
    if otx_data['mitre_techniques']:
        summary.append(f"\n🎯 MITRE ATT&CK Techniques ({len(otx_data['mitre_techniques'])}):")
        for technique in otx_data['mitre_techniques'][:5]:
            summary.append(f"   • {technique}")
    
    # Attack types
    if otx_data['attack_types']:
        summary.append(f"\n⚔️  Attack Types:")
        for attack_type in otx_data['attack_types'][:5]:
            summary.append(f"   • {attack_type}")
    
    # Top pulses
    if otx_data['pulses']:
        summary.append(f"\n📡 Threat Pulses (showing top 5 of {otx_data['total_pulses']}):")
        for i, pulse in enumerate(otx_data['pulses'][:5], 1):
            summary.append(f"\n   {i}. {pulse['name']}")
            if pulse['description']:
                desc = pulse['description'][:100] + "..." if len(pulse['description']) > 100 else pulse['description']
                summary.append(f"      {desc}")
            if pulse['tags']:
                summary.append(f"      Tags: {', '.join(pulse['tags'][:5])}")
            if pulse['malware_families']:
                summary.append(f"      Malware: {', '.join(pulse['malware_families'])}")
    
    summary.append("\n" + "=" * 70)
    return "\n".join(summary)


# Main test
if __name__ == "__main__":
    print("Testing AlienVault OTX integration...\n")
    
    # Test IPs
    test_ips = [
        ("185.220.101.1", "Known malicious IP"),
        ("8.8.8.8", "Google DNS (clean)"),
    ]
    
    for ip, description in test_ips:
        print(f"\n{'='*70}")
        print(f"Testing: {ip} - {description}")
        print(f"{'='*70}")
        
        result = check_ip_otx(ip)
        print(format_otx_summary(result))
        
        # Also test raw output
        print(f"\nRaw data (first 500 chars):")
        print(json.dumps(result, indent=2)[:500])
