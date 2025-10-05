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
