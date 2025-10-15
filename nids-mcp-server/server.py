#!/usr/bin/env python3
"""
NIDS MCP Server
A Model Context Protocol server providing network security analysis tools
"""

import asyncio
import json
from typing import Any
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Import tools
from tools.ip_geolocation import geolocate_ip, format_geolocation_summary, IP_GEOLOCATION_TOOL
from tools.ip_threat_intel import check_ip_reputation, format_threat_summary, IP_THREAT_INTEL_TOOL
from tools.mitre_attack import (
    query_technique, search_techniques, map_attack_to_mitre,
    format_technique_summary,
    QUERY_TECHNIQUE_TOOL, SEARCH_TECHNIQUES_TOOL, MAP_ATTACK_TOOL
)
from tools.abuseipdb import check_ip as abuseipdb_check, format_check_result as format_abuseipdb
from tools.alienvault_otx import check_ip_otx, search_pulses, format_otx_summary
# from tools.netflow_analyzer import get_notebook  # Disabled for now

# AbuseIPDB Tool Definition
ABUSEIPDB_TOOL = {
    "name": "check_ip_abuseipdb",
    "description": "Check IP address reputation using AbuseIPDB community database. Returns abuse confidence score (0-100%), attack categories (SSH bruteforce, DDoS, port scan, etc.), and report history from 800K+ security researchers.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "ip": {
                "type": "string",
                "description": "IP address to check against AbuseIPDB"
            },
            "max_age_days": {
                "type": "integer",
                "description": "Maximum age of reports to consider (default: 90 days)",
                "default": 90
            },
            "verbose": {
                "type": "boolean",
                "description": "Include detailed report history (default: true)",
                "default": True
            }
        },
        "required": ["ip"]
    }
}

# AlienVault OTX Tool Definitions
OTX_CHECK_IP_TOOL = {
    "name": "check_ip_otx",
    "description": "Check IP address against AlienVault OTX open-source threat intelligence. Returns threat pulses, malware families, MITRE ATT&CK techniques, and IOC context from 100K+ security researchers.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "ip": {
                "type": "string",
                "description": "IP address to check against OTX database"
            }
        },
        "required": ["ip"]
    }
}

OTX_SEARCH_PULSES_TOOL = {
    "name": "search_otx_pulses",
    "description": "Search AlienVault OTX threat pulses for specific attack types, malware families, or threat actors. Returns curated threat intelligence collections with IOCs and MITRE ATT&CK mappings.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query (e.g., 'DDoS', 'botnet', 'ransomware', 'SSH bruteforce')"
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of pulses to return (default: 10)",
                "default": 10
            }
        },
        "required": ["query"]
    }
}

# NetFlow Analyzer Tool Definitions (Disabled for now)
# RECORD_FLOW_TOOL = {
#     "name": "record_flow",
#     "description": "Record a NetFlow entry into working memory for behavioral analysis. Maintains per-IP queues (last 20 flows) enabling temporal pattern detection without full dataset memorization. Returns queue status and new IP indicators.",
#     "inputSchema": {
#         "type": "object",
#         "properties": {
#             "flow_data": {
#                 "type": "object",
#                 "description": "NetFlow record containing: src_ip (required), dst_ip, src_port, dst_port, protocol, duration, tot_fwd_pkts, tot_bwd_pkts, and other flow features",
#                 "required": ["src_ip"]
#             }
#         },
#         "required": ["flow_data"]
#     }
# }

# GET_IP_HISTORY_TOOL = {
#     "name": "get_ip_history",
#     "description": "Retrieve recent flow history for a specific IP from working memory. Returns last N flows (up to queue size) in chronological order, plus analyst observations. Use this to review what an IP has been doing recently.",
#     "inputSchema": {
#         "type": "object",
#         "properties": {
#             "ip_address": {
#                 "type": "string",
#                 "description": "IP address to query"
#             },
#             "limit": {
#                 "type": "integer",
#                 "description": "Maximum flows to return (default: all in queue)"
#             }
#         },
#         "required": ["ip_address"]
#     }
# }

# ANALYZE_IP_PATTERN_TOOL = {
#     "name": "analyze_ip_pattern",
#     "description": "Analyze behavioral patterns in IP's recent activity. Detects port scanning (high port diversity), reconnaissance (many targets), rapid-fire connections, protocol switching. Returns statistical analysis and behavioral flags for common attack patterns.",
#     "inputSchema": {
#         "type": "object",
#         "properties": {
#             "ip_address": {
#                 "type": "string",
#                 "description": "IP address to analyze"
#             }
#         },
#         "required": ["ip_address"]
#     }
# }

# DETECT_BEHAVIOR_CHANGE_TOOL = {
#     "name": "detect_behavior_change",
#     "description": "Detect significant behavioral shifts in IP activity by comparing recent flows to historical baseline. Identifies new ports, new targets, traffic volume spikes/drops. Useful for detecting attack escalation or compromised hosts.",
#     "inputSchema": {
#         "type": "object",
#         "properties": {
#             "ip_address": {
#                 "type": "string",
#                 "description": "IP address to analyze"
#             },
#             "window_size": {
#                 "type": "integer",
#                 "description": "Number of recent flows to compare (default: 5)",
#                 "default": 5
#             }
#         },
#         "required": ["ip_address"]
#     }
# }

# ADD_OBSERVATION_TOOL = {
#     "name": "add_observation",
#     "description": "Add a freeform observation or hypothesis to IP's investigation notes. Maintains context and reasoning across multiple tool calls - like an analyst writing notes. Use this to document your analysis, suspicions, or conclusions about an IP.",
#     "inputSchema": {
#         "type": "object",
#         "properties": {
#             "ip_address": {
#                 "type": "string",
#                 "description": "IP address being investigated"
#             },
#             "observation": {
#                 "type": "string",
#                 "description": "Freeform text observation or hypothesis"
#             }
#         },
#         "required": ["ip_address", "observation"]
#     }
# }

# Initialize MCP server
app = Server("nids-mcp-server")


@app.list_tools()
async def list_tools() -> list[Tool]:
    """
    List all available tools in the NIDS MCP server
    """
    return [
        Tool(
            name=IP_GEOLOCATION_TOOL["name"],
            description=IP_GEOLOCATION_TOOL["description"],
            inputSchema=IP_GEOLOCATION_TOOL["inputSchema"]
        ),
        Tool(
            name=IP_THREAT_INTEL_TOOL["name"],
            description=IP_THREAT_INTEL_TOOL["description"],
            inputSchema=IP_THREAT_INTEL_TOOL["inputSchema"]
        ),
        Tool(
            name=QUERY_TECHNIQUE_TOOL["name"],
            description=QUERY_TECHNIQUE_TOOL["description"],
            inputSchema=QUERY_TECHNIQUE_TOOL["inputSchema"]
        ),
        Tool(
            name=SEARCH_TECHNIQUES_TOOL["name"],
            description=SEARCH_TECHNIQUES_TOOL["description"],
            inputSchema=SEARCH_TECHNIQUES_TOOL["inputSchema"]
        ),
        Tool(
            name=MAP_ATTACK_TOOL["name"],
            description=MAP_ATTACK_TOOL["description"],
            inputSchema=MAP_ATTACK_TOOL["inputSchema"]
        ),
        Tool(
            name=ABUSEIPDB_TOOL["name"],
            description=ABUSEIPDB_TOOL["description"],
            inputSchema=ABUSEIPDB_TOOL["inputSchema"]
        ),
        Tool(
            name=OTX_CHECK_IP_TOOL["name"],
            description=OTX_CHECK_IP_TOOL["description"],
            inputSchema=OTX_CHECK_IP_TOOL["inputSchema"]
        ),
        Tool(
            name=OTX_SEARCH_PULSES_TOOL["name"],
            description=OTX_SEARCH_PULSES_TOOL["description"],
            inputSchema=OTX_SEARCH_PULSES_TOOL["inputSchema"]
        ),
        # NetFlow Analyzer Tools (Disabled for now)
        # Tool(
        #     name=RECORD_FLOW_TOOL["name"],
        #     description=RECORD_FLOW_TOOL["description"],
        #     inputSchema=RECORD_FLOW_TOOL["inputSchema"]
        # ),
        # Tool(
        #     name=GET_IP_HISTORY_TOOL["name"],
        #     description=GET_IP_HISTORY_TOOL["description"],
        #     inputSchema=GET_IP_HISTORY_TOOL["inputSchema"]
        # ),
        # Tool(
        #     name=ANALYZE_IP_PATTERN_TOOL["name"],
        #     description=ANALYZE_IP_PATTERN_TOOL["description"],
        #     inputSchema=ANALYZE_IP_PATTERN_TOOL["inputSchema"]
        # ),
        # Tool(
        #     name=DETECT_BEHAVIOR_CHANGE_TOOL["name"],
        #     description=DETECT_BEHAVIOR_CHANGE_TOOL["description"],
        #     inputSchema=DETECT_BEHAVIOR_CHANGE_TOOL["inputSchema"]
        # ),
        # Tool(
        #     name=ADD_OBSERVATION_TOOL["name"],
        #     description=ADD_OBSERVATION_TOOL["description"],
        #     inputSchema=ADD_OBSERVATION_TOOL["inputSchema"]
        # ),
        # More tools will be added here as we build them
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> list[TextContent]:
    """
    Handle tool execution requests
    """
    
    if name == "geolocate_ip":
        ip = arguments.get("ip")
        
        if not ip:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "error": "Missing required parameter: ip"
                }, indent=2)
            )]
        
        # Execute the geolocation
        result = await geolocate_ip(ip)
        
        # Format as JSON and summary
        response = {
            "data": result,
            "summary": format_geolocation_summary(result)
        }
        
        return [TextContent(
            type="text",
            text=json.dumps(response, indent=2)
        )]
    
    elif name == "check_ip_reputation":
        ip = arguments.get("ip")
        update_feeds = arguments.get("update_feeds", True)
        
        if not ip:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "error": "Missing required parameter: ip"
                }, indent=2)
            )]
        
        # Execute the threat intelligence check
        result = await check_ip_reputation(ip, update_feeds=update_feeds)
        
        # Format as JSON and summary
        response = {
            "data": result,
            "summary": format_threat_summary(result)
        }
        
        return [TextContent(
            type="text",
            text=json.dumps(response, indent=2)
        )]
    
    elif name == "query_mitre_technique":
        technique_id = arguments.get("technique_id")
        
        if not technique_id:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "error": "Missing required parameter: technique_id"
                }, indent=2)
            )]
        
        # Execute the MITRE query
        result = await query_technique(technique_id)
        
        # Format as JSON and summary
        response = {
            "data": result,
            "summary": format_technique_summary(result)
        }
        
        return [TextContent(
            type="text",
            text=json.dumps(response, indent=2)
        )]
    
    elif name == "search_mitre_techniques":
        query = arguments.get("query")
        
        if not query:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "error": "Missing required parameter: query"
                }, indent=2)
            )]
        
        # Execute the search
        result = await search_techniques(query)
        
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    
    elif name == "map_attack_to_mitre":
        attack_type = arguments.get("attack_type")
        
        if not attack_type:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "error": "Missing required parameter: attack_type"
                }, indent=2)
            )]
        
        # Execute the mapping
        result = await map_attack_to_mitre(attack_type)
        
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    
    elif name == "check_ip_abuseipdb":
        ip = arguments.get("ip")
        max_age_days = arguments.get("max_age_days", 90)
        verbose = arguments.get("verbose", True)
        
        if not ip:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "error": "Missing required parameter: ip"
                }, indent=2)
            )]
        
        # Execute the AbuseIPDB check
        result = abuseipdb_check(ip, max_age_days=max_age_days, verbose=verbose)
        
        # Format response with both JSON data and human-readable summary
        response = {
            "data": result,
            "summary": format_abuseipdb(result)
        }
        
        return [TextContent(
            type="text",
            text=json.dumps(response, indent=2)
        )]
    
    elif name == "check_ip_otx":
        ip = arguments.get("ip")
        
        if not ip:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "error": "Missing required parameter: ip"
                }, indent=2)
            )]
        
        # Execute the OTX check
        result = check_ip_otx(ip)
        
        # Format response with both JSON data and human-readable summary
        response = {
            "data": result,
            "summary": format_otx_summary(result)
        }
        
        return [TextContent(
            type="text",
            text=json.dumps(response, indent=2)
        )]
    
    elif name == "search_otx_pulses":
        query = arguments.get("query")
        limit = arguments.get("limit", 10)
        
        if not query:
            return [TextContent(
                type="text",
                text=json.dumps({
                    "error": "Missing required parameter: query"
                }, indent=2)
            )]
        
        # Execute the pulse search
        result = search_pulses(query, limit=limit)
        
        return [TextContent(
            type="text",
            text=json.dumps(result, indent=2)
        )]
    
    # NetFlow Analyzer Tool Handlers (Disabled for now)
    # elif name == "record_flow":
    #     flow_data = arguments.get("flow_data")
    #     
    #     if not flow_data:
    #         return [TextContent(
    #             type="text",
    #             text=json.dumps({
    #                 "error": "Missing required parameter: flow_data"
    #             }, indent=2)
    #         )]
    #     
    #     # Get the notebook instance and record the flow
    #     notebook = get_notebook()
    #     result = notebook.record_flow(flow_data)
    #     
    #     return [TextContent(
    #         type="text",
    #         text=json.dumps(result, indent=2)
    #     )]
    # 
    # elif name == "get_ip_history":
    #     ip_address = arguments.get("ip_address")
    #     limit = arguments.get("limit")
    #     
    #     if not ip_address:
    #         return [TextContent(
    #             type="text",
    #             text=json.dumps({
    #                 "error": "Missing required parameter: ip_address"
    #             }, indent=2)
    #         )]
    #     
    #     # Get the notebook instance and retrieve history
    #     notebook = get_notebook()
    #     result = notebook.get_ip_history(ip_address, limit=limit)
    #     
    #     return [TextContent(
    #         type="text",
    #         text=json.dumps(result, indent=2)
    #     )]
    # 
    # elif name == "analyze_ip_pattern":
    #     ip_address = arguments.get("ip_address")
    #     
    #     if not ip_address:
    #         return [TextContent(
    #             type="text",
    #             text=json.dumps({
    #                 "error": "Missing required parameter: ip_address"
    #             }, indent=2)
    #         )]
    #     
    #     # Get the notebook instance and analyze patterns
    #     notebook = get_notebook()
    #     result = notebook.analyze_ip_pattern(ip_address)
    #     
    #     return [TextContent(
    #         type="text",
    #         text=json.dumps(result, indent=2)
    #     )]
    # 
    # elif name == "detect_behavior_change":
    #     ip_address = arguments.get("ip_address")
    #     window_size = arguments.get("window_size", 5)
    #     
    #     if not ip_address:
    #         return [TextContent(
    #             type="text",
    #             text=json.dumps({
    #                 "error": "Missing required parameter: ip_address"
    #             }, indent=2)
    #         )]
    #     
    #     # Get the notebook instance and detect changes
    #     notebook = get_notebook()
    #     result = notebook.detect_behavior_change(ip_address, window_size=window_size)
    #     
    #     return [TextContent(
    #         type="text",
    #         text=json.dumps(result, indent=2)
    #     )]
    # 
    # elif name == "add_observation":
    #     ip_address = arguments.get("ip_address")
    #     observation = arguments.get("observation")
    #     
    #     if not ip_address or not observation:
    #         return [TextContent(
    #             type="text",
    #             text=json.dumps({
    #                 "error": "Missing required parameters: ip_address and observation"
    #             }, indent=2)
    #         )]
    #     
    #     # Get the notebook instance and add observation
    #     notebook = get_notebook()
    #     result = notebook.add_observation(ip_address, observation)
    #     
    #     return [TextContent(
    #         type="text",
    #         text=json.dumps(result, indent=2)
    #     )]
    
    # Handle unknown tools
    return [TextContent(
        type="text",
        text=json.dumps({
            "error": f"Unknown tool: {name}"
        }, indent=2)
    )]


async def main():
    """
    Main entry point for the MCP server
    """
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


if __name__ == "__main__":
    print("🚀 Starting NIDS MCP Server...", flush=True)
    asyncio.run(main())
