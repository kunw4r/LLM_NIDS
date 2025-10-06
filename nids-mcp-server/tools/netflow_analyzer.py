"""
NetFlow Analyzer - Working Memory System for Behavioral Analysis

This tool provides a per-IP queue system (like an analyst's notepad) for tracking
and analyzing NetFlow behavioral patterns. Uses sliding window memory (last 20 flows
per IP) to enable LLM-driven anomaly detection and pattern recognition.

Research Questions:
- How many flows before LLM identifies attack pattern?
- Can LLM detect behavior changes in per-IP queues?
- Does queue size affect accuracy (10 vs 20 vs 50)?
- Can LLM generalize to novel attacks not in training?

Academic Foundation: Tool-augmented LLMs (ReAct, Toolformer, HuggingGPT)
"""

import json
import sqlite3
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import statistics


class NetFlowNotebook:
    """
    Working memory system for NetFlow behavioral analysis.
    
    Maintains per-IP queues (deque with maxlen) to track recent flows,
    enabling temporal pattern analysis without full dataset memorization.
    
    Think of this as an analyst's notepad - tracks what's happened recently
    with each IP, notes observations, and enables pattern recognition.
    """
    
    def __init__(self, queue_size: int = 20, db_path: Optional[str] = None):
        """
        Initialize the NetFlow working memory system.
        
        Args:
            queue_size: Maximum flows to remember per IP (sliding window)
            db_path: Path to SQLite database for persistence (optional)
        """
        self.queue_size = queue_size
        
        # Per-IP queues: {ip_address: deque([flow1, flow2, ...])}
        self.ip_queues: Dict[str, deque] = {}
        
        # Per-IP observations: {ip_address: [observation1, observation2, ...]}
        self.ip_observations: Dict[str, List[str]] = {}
        
        # Global statistics for context
        self.stats = {
            'total_flows_processed': 0,
            'unique_ips_seen': 0,
            'session_start': datetime.now().isoformat()
        }
        
        # Optional persistence
        self.db_path = db_path or str(Path(__file__).parent.parent / 'netflow_memory.db')
        self._init_db()
    
    def _init_db(self):
        """Initialize SQLite database for optional persistence."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Table for flow history (per-IP queues)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS flow_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_address TEXT NOT NULL,
                flow_data TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                UNIQUE(ip_address, timestamp)
            )
        ''')
        
        # Table for analyst observations
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS observations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip_address TEXT NOT NULL,
                observation TEXT NOT NULL,
                timestamp TEXT NOT NULL
            )
        ''')
        
        # Index for fast IP lookups
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_ip_address 
            ON flow_history(ip_address)
        ''')
        
        conn.commit()
        conn.close()
    
    def record_flow(self, flow_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Record a NetFlow entry into the working memory system.
        
        Automatically manages per-IP queues with sliding window (FIFO).
        When queue reaches maxlen, oldest flow is automatically removed.
        
        Args:
            flow_data: Dictionary containing NetFlow fields
                Required: src_ip, dst_ip, src_port, dst_port, protocol
                Optional: duration, tot_fwd_pkts, tot_bwd_pkts, etc.
        
        Returns:
            Dictionary with recording status and queue info
        """
        # Extract source IP (primary tracking dimension)
        src_ip = flow_data.get('src_ip')
        if not src_ip:
            return {
                'success': False,
                'error': 'Missing src_ip field'
            }
        
        # Initialize queue for new IPs
        if src_ip not in self.ip_queues:
            self.ip_queues[src_ip] = deque(maxlen=self.queue_size)
            self.ip_observations[src_ip] = []
            self.stats['unique_ips_seen'] += 1
        
        # Add timestamp if not present
        if 'timestamp' not in flow_data:
            flow_data['timestamp'] = datetime.now().isoformat()
        
        # Record to queue (automatic FIFO when full)
        self.ip_queues[src_ip].append(flow_data)
        self.stats['total_flows_processed'] += 1
        
        # Optional: Persist to database
        self._persist_flow(src_ip, flow_data)
        
        return {
            'success': True,
            'ip_address': src_ip,
            'queue_size': len(self.ip_queues[src_ip]),
            'queue_max': self.queue_size,
            'total_flows_for_ip': self.stats['total_flows_processed'],
            'is_new_ip': len(self.ip_queues[src_ip]) == 1
        }
    
    def get_ip_history(self, ip_address: str, limit: Optional[int] = None) -> Dict[str, Any]:
        """
        Retrieve recent flow history for a specific IP from working memory.
        
        Returns flows from the per-IP queue in chronological order.
        This is the LLM's view into what's happened with this IP recently.
        
        Args:
            ip_address: IP address to query
            limit: Maximum number of flows to return (default: all in queue)
        
        Returns:
            Dictionary with flow history and metadata
        """
        # Check if IP has ANY data (flows or observations)
        has_flows = ip_address in self.ip_queues
        has_observations = ip_address in self.ip_observations
        
        if not has_flows and not has_observations:
            return {
                'ip_address': ip_address,
                'flows': [],
                'total_flows': 0,
                'observations': [],
                'status': 'unknown_ip'
            }
        
        # Get flows if they exist
        flows = []
        if has_flows:
            flows = list(self.ip_queues[ip_address])
            if limit:
                flows = flows[-limit:]  # Most recent N flows
        
        return {
            'ip_address': ip_address,
            'flows': flows,
            'total_flows': len(flows),
            'queue_capacity': self.queue_size,
            'observations': self.ip_observations.get(ip_address, []),
            'status': 'active' if has_flows else 'observations_only'
        }
    
    def analyze_ip_pattern(self, ip_address: str) -> Dict[str, Any]:
        """
        Analyze behavioral patterns in IP's recent activity.
        
        Provides statistical analysis of flows to help LLM identify:
        - Port scanning behavior (many unique dst_ports)
        - Rate anomalies (sudden spikes in activity)
        - Protocol consistency (TCP vs UDP switching)
        - Target diversity (many unique dst_ips)
        
        Args:
            ip_address: IP address to analyze
        
        Returns:
            Dictionary with behavioral analysis metrics
        """
        if ip_address not in self.ip_queues or len(self.ip_queues[ip_address]) == 0:
            return {
                'ip_address': ip_address,
                'error': 'No flow history available',
                'status': 'insufficient_data'
            }
        
        flows = list(self.ip_queues[ip_address])
        
        # Extract behavioral metrics
        dst_ports = [f.get('dst_port') for f in flows if f.get('dst_port')]
        dst_ips = [f.get('dst_ip') for f in flows if f.get('dst_ip')]
        protocols = [f.get('protocol') for f in flows if f.get('protocol')]
        durations = [f.get('duration', 0) for f in flows]
        fwd_pkts = [f.get('tot_fwd_pkts', 0) for f in flows]
        bwd_pkts = [f.get('tot_bwd_pkts', 0) for f in flows]
        
        analysis = {
            'ip_address': ip_address,
            'total_flows': len(flows),
            'time_window': {
                'first_seen': flows[0].get('timestamp', 'unknown'),
                'last_seen': flows[-1].get('timestamp', 'unknown')
            },
            'port_behavior': {
                'unique_dst_ports': len(set(dst_ports)),
                'port_diversity_ratio': len(set(dst_ports)) / len(dst_ports) if dst_ports else 0,
                'most_common_port': max(set(dst_ports), key=dst_ports.count) if dst_ports else None,
                'ports': sorted(set(dst_ports)) if len(set(dst_ports)) <= 10 else f"{len(set(dst_ports))} unique ports"
            },
            'target_behavior': {
                'unique_dst_ips': len(set(dst_ips)),
                'target_diversity_ratio': len(set(dst_ips)) / len(dst_ips) if dst_ips else 0,
                'targets': list(set(dst_ips)) if len(set(dst_ips)) <= 5 else f"{len(set(dst_ips))} unique targets"
            },
            'protocol_behavior': {
                'unique_protocols': len(set(protocols)),
                'protocol_distribution': {str(p): protocols.count(p) for p in set(protocols)},
                'is_consistent': len(set(protocols)) == 1
            },
            'traffic_statistics': {
                'avg_duration': round(statistics.mean(durations), 2) if durations else 0,
                'avg_fwd_packets': round(statistics.mean(fwd_pkts), 2) if fwd_pkts else 0,
                'avg_bwd_packets': round(statistics.mean(bwd_pkts), 2) if bwd_pkts else 0,
                'duration_stdev': round(statistics.stdev(durations), 2) if len(durations) > 1 else 0
            },
            'behavioral_flags': []
        }
        
        # Add behavioral flags for common attack patterns
        if analysis['port_behavior']['unique_dst_ports'] > 10:
            analysis['behavioral_flags'].append({
                'flag': 'HIGH_PORT_DIVERSITY',
                'description': f"Contacted {analysis['port_behavior']['unique_dst_ports']} different ports",
                'severity': 'high',
                'possible_attack': 'Port Scanning'
            })
        
        if analysis['target_behavior']['unique_dst_ips'] > 5:
            analysis['behavioral_flags'].append({
                'flag': 'HIGH_TARGET_DIVERSITY',
                'description': f"Contacted {analysis['target_behavior']['unique_dst_ips']} different hosts",
                'severity': 'medium',
                'possible_attack': 'Network Reconnaissance'
            })
        
        if not analysis['protocol_behavior']['is_consistent']:
            analysis['behavioral_flags'].append({
                'flag': 'PROTOCOL_SWITCHING',
                'description': f"Used {analysis['protocol_behavior']['unique_protocols']} different protocols",
                'severity': 'low',
                'possible_attack': 'Protocol Tunneling or Evasion'
            })
        
        # Check for rapid-fire behavior (short durations, many flows)
        if len(flows) >= 10 and analysis['traffic_statistics']['avg_duration'] < 1000:
            analysis['behavioral_flags'].append({
                'flag': 'RAPID_FIRE_CONNECTIONS',
                'description': f"Average flow duration: {analysis['traffic_statistics']['avg_duration']}ms",
                'severity': 'high',
                'possible_attack': 'DDoS, Brute Force, or Automated Scanning'
            })
        
        return analysis
    
    def detect_behavior_change(self, ip_address: str, window_size: int = 5) -> Dict[str, Any]:
        """
        Detect significant behavioral shifts in IP activity.
        
        Compares recent flows (last window_size) to historical baseline
        to identify anomalous changes that might indicate attack escalation,
        compromised host, or new attack phase.
        
        Args:
            ip_address: IP address to analyze
            window_size: Number of recent flows to compare (default: 5)
        
        Returns:
            Dictionary with behavior change detection results
        """
        if ip_address not in self.ip_queues or len(self.ip_queues[ip_address]) < window_size * 2:
            return {
                'ip_address': ip_address,
                'error': f'Need at least {window_size * 2} flows for behavior change detection',
                'status': 'insufficient_data'
            }
        
        flows = list(self.ip_queues[ip_address])
        
        # Split into baseline (older flows) and recent (newer flows)
        baseline = flows[:-window_size]
        recent = flows[-window_size:]
        
        # Compare port behavior
        baseline_ports = set(f.get('dst_port') for f in baseline if f.get('dst_port'))
        recent_ports = set(f.get('dst_port') for f in recent if f.get('dst_port'))
        
        # Compare target behavior
        baseline_ips = set(f.get('dst_ip') for f in baseline if f.get('dst_ip'))
        recent_ips = set(f.get('dst_ip') for f in recent if f.get('dst_ip'))
        
        # Compare traffic volumes
        baseline_fwd = [f.get('tot_fwd_pkts', 0) for f in baseline]
        recent_fwd = [f.get('tot_fwd_pkts', 0) for f in recent]
        
        changes = {
            'ip_address': ip_address,
            'window_size': window_size,
            'baseline_flows': len(baseline),
            'recent_flows': len(recent),
            'changes_detected': []
        }
        
        # Detect port behavior change
        new_ports = recent_ports - baseline_ports
        if len(new_ports) > 0:
            changes['changes_detected'].append({
                'type': 'NEW_PORTS',
                'description': f"Started targeting {len(new_ports)} new port(s): {sorted(list(new_ports))[:5]}",
                'severity': 'medium'
            })
        
        # Detect target behavior change
        new_targets = recent_ips - baseline_ips
        if len(new_targets) > 0:
            changes['changes_detected'].append({
                'type': 'NEW_TARGETS',
                'description': f"Started targeting {len(new_targets)} new host(s): {list(new_targets)[:3]}",
                'severity': 'high'
            })
        
        # Detect traffic volume spike
        if baseline_fwd and recent_fwd:
            baseline_avg = statistics.mean(baseline_fwd)
            recent_avg = statistics.mean(recent_fwd)
            if baseline_avg > 0:
                change_ratio = recent_avg / baseline_avg
                if change_ratio > 2.0:
                    changes['changes_detected'].append({
                        'type': 'TRAFFIC_SPIKE',
                        'description': f"Forward packet rate increased {change_ratio:.1f}x (baseline: {baseline_avg:.0f}, recent: {recent_avg:.0f})",
                        'severity': 'high'
                    })
                elif change_ratio < 0.5:
                    changes['changes_detected'].append({
                        'type': 'TRAFFIC_DROP',
                        'description': f"Forward packet rate decreased {1/change_ratio:.1f}x (baseline: {baseline_avg:.0f}, recent: {recent_avg:.0f})",
                        'severity': 'low'
                    })
        
        changes['status'] = 'behavior_changed' if changes['changes_detected'] else 'stable'
        
        return changes
    
    def add_observation(self, ip_address: str, observation: str) -> Dict[str, Any]:
        """
        Add a freeform observation or hypothesis to IP's investigation notes.
        
        This allows the LLM to maintain context and reasoning across multiple
        tool calls - like an analyst writing notes in their notebook.
        
        Args:
            ip_address: IP address being investigated
            observation: Freeform text observation or hypothesis
        
        Returns:
            Dictionary confirming observation was recorded
        """
        if ip_address not in self.ip_observations:
            self.ip_observations[ip_address] = []
        
        timestamped_obs = {
            'timestamp': datetime.now().isoformat(),
            'observation': observation
        }
        
        self.ip_observations[ip_address].append(timestamped_obs)
        
        # Persist to database
        self._persist_observation(ip_address, observation)
        
        return {
            'success': True,
            'ip_address': ip_address,
            'observation': observation,
            'total_observations': len(self.ip_observations[ip_address])
        }
    
    def get_session_stats(self) -> Dict[str, Any]:
        """Get overall session statistics for context."""
        return {
            'stats': self.stats,
            'active_ips': len(self.ip_queues),
            'queue_size': self.queue_size,
            'db_path': self.db_path
        }
    
    def _persist_flow(self, ip_address: str, flow_data: Dict[str, Any]):
        """Persist flow to database (maintains last queue_size flows per IP)."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Insert new flow
            cursor.execute('''
                INSERT OR IGNORE INTO flow_history (ip_address, flow_data, timestamp)
                VALUES (?, ?, ?)
            ''', (ip_address, json.dumps(flow_data), flow_data.get('timestamp')))
            
            # Cleanup: Keep only last queue_size flows per IP
            cursor.execute('''
                DELETE FROM flow_history
                WHERE ip_address = ? AND id NOT IN (
                    SELECT id FROM flow_history
                    WHERE ip_address = ?
                    ORDER BY timestamp DESC
                    LIMIT ?
                )
            ''', (ip_address, ip_address, self.queue_size))
            
            conn.commit()
            conn.close()
        except Exception as e:
            # Non-critical - memory-based queues still work
            pass
    
    def _persist_observation(self, ip_address: str, observation: str):
        """Persist observation to database."""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO observations (ip_address, observation, timestamp)
                VALUES (?, ?, ?)
            ''', (ip_address, observation, datetime.now().isoformat()))
            
            conn.commit()
            conn.close()
        except Exception as e:
            # Non-critical
            pass


# Global instance (singleton pattern for MCP server)
_notebook_instance = None

def get_notebook(queue_size: int = 20) -> NetFlowNotebook:
    """Get or create the global NetFlowNotebook instance."""
    global _notebook_instance
    if _notebook_instance is None:
        _notebook_instance = NetFlowNotebook(queue_size=queue_size)
    return _notebook_instance
