#!/usr/bin/env python3
"""
Test script for NetFlow Analyzer working memory system

Tests the per-IP queue functionality with realistic SSH bruteforce scenarios
from the CICIDS2018 dataset.
"""

import json
from tools.netflow_analyzer import NetFlowNotebook  # Import class directly


def test_basic_flow_recording():
    """Test basic flow recording and queue management."""
    print("\n" + "="*80)
    print("TEST 1: Basic Flow Recording")
    print("="*80)
    
    notebook = NetFlowNotebook(queue_size=5)  # Create new instance
    
    # Record a simple flow
    flow1 = {
        'src_ip': '13.58.98.64',
        'dst_ip': '172.31.69.25',
        'src_port': 45678,
        'dst_port': 22,
        'protocol': 6,
        'duration': 369000,
        'tot_fwd_pkts': 23,
        'tot_bwd_pkts': 23
    }
    
    result = notebook.record_flow(flow1)
    print(f"\n✅ Recorded flow: {json.dumps(result, indent=2)}")
    assert result['success'] == True
    assert result['is_new_ip'] == True
    assert result['queue_size'] == 1


def test_ssh_bruteforce_simulation():
    """Simulate SSH bruteforce attack with multiple connection attempts."""
    print("\n" + "="*80)
    print("TEST 2: SSH Bruteforce Attack Simulation")
    print("="*80)
    
    # Use default queue size of 20 for realistic testing
    notebook = NetFlowNotebook(queue_size=20)
    attacker_ip = '13.58.98.64'
    target_ip = '172.31.69.25'
    
    # Simulate 15 rapid SSH connection attempts (bruteforce pattern)
    print(f"\n📡 Simulating 15 SSH connection attempts from {attacker_ip} to {target_ip}:22...")
    
    for i in range(15):
        flow = {
            'src_ip': attacker_ip,
            'dst_ip': target_ip,
            'src_port': 50000 + i,  # Different source port each time
            'dst_port': 22,  # Always targeting SSH
            'protocol': 6,  # TCP
            'duration': 300 + (i * 10),  # Very short connections
            'tot_fwd_pkts': 20 + i,
            'tot_bwd_pkts': 20 + i,
            'flow_byts_s': 50000 + (i * 1000),
            'flow_pkts_s': 100 + (i * 5)
        }
        result = notebook.record_flow(flow)
        if i < 3 or i >= 12:  # Print first 3 and last 3
            print(f"  Flow {i+1}: Queue size = {result['queue_size']}")
    
    print(f"\n✅ Recorded {result['queue_size']} flows in queue")


def test_ip_history_retrieval():
    """Test retrieving IP history from working memory."""
    print("\n" + "="*80)
    print("TEST 3: IP History Retrieval")
    print("="*80)
    
    # Reuse the same IP from previous test - create notebook with same queue size
    notebook = NetFlowNotebook(queue_size=20)
    attacker_ip = '13.58.98.64'
    
    # First, populate with the same 15 flows
    for i in range(15):
        flow = {
            'src_ip': attacker_ip,
            'dst_ip': '172.31.69.25',
            'src_port': 50000 + i,
            'dst_port': 22,
            'protocol': 6,
            'duration': 300 + (i * 10),
            'tot_fwd_pkts': 20 + i,
            'tot_bwd_pkts': 20 + i
        }
        notebook.record_flow(flow)
    
    # Get full history
    history = notebook.get_ip_history(attacker_ip)
    print(f"\n📋 History for {attacker_ip}:")
    print(f"  Total flows in queue: {history['total_flows']}")
    print(f"  Queue capacity: {history['queue_capacity']}")
    print(f"  Status: {history['status']}")
    
    # Get limited history
    recent = notebook.get_ip_history(attacker_ip, limit=3)
    print(f"\n📋 Last 3 flows:")
    for i, flow in enumerate(recent['flows'], 1):
        print(f"  {i}. {flow['src_ip']}:{flow['src_port']} → {flow['dst_ip']}:{flow['dst_port']}")
    
    # Now we should have 15 flows (queue size is 20)
    assert history['total_flows'] == 15
    assert recent['total_flows'] == 3


def test_pattern_analysis():
    """Test behavioral pattern analysis."""
    print("\n" + "="*80)
    print("TEST 4: Behavioral Pattern Analysis")
    print("="*80)
    
    # Create fresh notebook with 15 SSH bruteforce flows
    notebook = NetFlowNotebook(queue_size=20)
    attacker_ip = '13.58.98.64'
    
    for i in range(15):
        flow = {
            'src_ip': attacker_ip,
            'dst_ip': '172.31.69.25',
            'src_port': 50000 + i,
            'dst_port': 22,
            'protocol': 6,
            'duration': 300 + (i * 10),
            'tot_fwd_pkts': 20 + i,
            'tot_bwd_pkts': 20 + i
        }
        notebook.record_flow(flow)
    
    analysis = notebook.analyze_ip_pattern(attacker_ip)
    
    print(f"\n🔍 Pattern Analysis for {attacker_ip}:")
    print(f"  Total flows analyzed: {analysis['total_flows']}")
    print(f"\n  Port Behavior:")
    print(f"    Unique destination ports: {analysis['port_behavior']['unique_dst_ports']}")
    print(f"    Port diversity ratio: {analysis['port_behavior']['port_diversity_ratio']:.2f}")
    print(f"    Most common port: {analysis['port_behavior']['most_common_port']}")
    
    print(f"\n  Target Behavior:")
    print(f"    Unique targets: {analysis['target_behavior']['unique_dst_ips']}")
    print(f"    Target diversity ratio: {analysis['target_behavior']['target_diversity_ratio']:.2f}")
    
    print(f"\n  Traffic Statistics:")
    print(f"    Avg duration: {analysis['traffic_statistics']['avg_duration']}ms")
    print(f"    Avg forward packets: {analysis['traffic_statistics']['avg_fwd_packets']}")
    print(f"    Avg backward packets: {analysis['traffic_statistics']['avg_bwd_packets']}")
    
    print(f"\n  Behavioral Flags: {len(analysis['behavioral_flags'])} detected")
    for flag in analysis['behavioral_flags']:
        print(f"    🚩 {flag['flag']}: {flag['description']}")
        print(f"       Severity: {flag['severity']} | Possible attack: {flag['possible_attack']}")
    
    # SSH bruteforce with avg duration ~400ms should trigger RAPID_FIRE flag (avg < 1000ms, flows >= 10)
    assert len(analysis['behavioral_flags']) >= 1
    flag_types = [f['flag'] for f in analysis['behavioral_flags']]
    assert 'RAPID_FIRE_CONNECTIONS' in flag_types


def test_behavior_change_detection():
    """Test behavior change detection by simulating attack escalation."""
    print("\n" + "="*80)
    print("TEST 5: Behavior Change Detection")
    print("="*80)
    
    # Create notebook with 15 SSH flows
    notebook = NetFlowNotebook(queue_size=20)
    attacker_ip = '13.58.98.64'
    
    for i in range(15):
        flow = {
            'src_ip': attacker_ip,
            'dst_ip': '172.31.69.25',
            'src_port': 50000 + i,
            'dst_port': 22,
            'protocol': 6,
            'duration': 300 + (i * 10),
            'tot_fwd_pkts': 20 + i,
            'tot_bwd_pkts': 20 + i
        }
        notebook.record_flow(flow)
    
    # Add 5 more flows targeting a DIFFERENT port (attack escalation)
    print(f"\n🔄 Simulating attack escalation - switching from SSH (22) to HTTP (80)...")
    
    for i in range(5):
        flow = {
            'src_ip': attacker_ip,
            'dst_ip': '172.31.69.25',
            'src_port': 60000 + i,
            'dst_port': 80,  # NEW TARGET PORT
            'protocol': 6,
            'duration': 500 + (i * 20),
            'tot_fwd_pkts': 100 + (i * 10),  # HIGHER TRAFFIC
            'tot_bwd_pkts': 100 + (i * 10)
        }
        notebook.record_flow(flow)
    
    # Detect behavior change
    change = notebook.detect_behavior_change(attacker_ip, window_size=5)
    
    print(f"\n🔍 Behavior Change Detection:")
    print(f"  Baseline flows: {change['baseline_flows']}")
    print(f"  Recent flows: {change['recent_flows']}")
    print(f"  Window size: {change['window_size']}")
    print(f"  Status: {change['status']}")
    print(f"\n  Changes detected: {len(change['changes_detected'])}")
    
    for i, change_item in enumerate(change['changes_detected'], 1):
        print(f"    {i}. {change_item['type']}: {change_item['description']}")
        print(f"       Severity: {change_item['severity']}")
    
    assert change['status'] == 'behavior_changed'
    assert len(change['changes_detected']) > 0


def test_observations():
    """Test adding analyst observations."""
    print("\n" + "="*80)
    print("TEST 6: Analyst Observations")
    print("="*80)
    
    notebook = NetFlowNotebook(queue_size=20)
    attacker_ip = '13.58.98.64'
    
    # Add observations (like an analyst would)
    obs1 = notebook.add_observation(
        attacker_ip,
        "Detected rapid SSH connection attempts with varying source ports - classic bruteforce pattern"
    )
    print(f"\n📝 Observation 1 added: {obs1['total_observations']} total")
    
    obs2 = notebook.add_observation(
        attacker_ip,
        "Attack escalated from SSH (port 22) to HTTP (port 80) - possible web application exploitation attempt"
    )
    print(f"📝 Observation 2 added: {obs2['total_observations']} total")
    
    obs3 = notebook.add_observation(
        attacker_ip,
        "Recommend blocking this IP - high confidence malicious activity. Map to MITRE T1110 (Brute Force)"
    )
    print(f"📝 Observation 3 added: {obs3['total_observations']} total")
    
    # Retrieve history with observations
    history = notebook.get_ip_history(attacker_ip)
    
    print(f"\n📋 All observations for {attacker_ip}:")
    print(f"  DEBUG: history['observations'] = {history['observations']}")
    for i, obs in enumerate(history['observations'], 1):
        print(f"  {i}. [{obs['timestamp'][:19]}] {obs['observation']}")
    
    # We added 3 observations in this test
    assert len(history['observations']) == 3


def test_port_scanning_simulation():
    """Test detection of port scanning behavior."""
    print("\n" + "="*80)
    print("TEST 7: Port Scanning Detection")
    print("="*80)
    
    notebook = NetFlowNotebook(queue_size=20)
    scanner_ip = '192.168.1.100'
    target_ip = '10.0.0.50'
    
    # Simulate port scan - same target, many different ports
    print(f"\n🔍 Simulating port scan from {scanner_ip} to {target_ip}...")
    
    common_ports = [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995, 1723, 3306, 3389, 5900, 8080, 8443]
    
    for port in common_ports:
        flow = {
            'src_ip': scanner_ip,
            'dst_ip': target_ip,
            'src_port': 50000,
            'dst_port': port,
            'protocol': 6,
            'duration': 50,  # Very short - SYN scan
            'tot_fwd_pkts': 1,  # Just SYN packet
            'tot_bwd_pkts': 0   # No response
        }
        notebook.record_flow(flow)
    
    # Analyze the pattern
    analysis = notebook.analyze_ip_pattern(scanner_ip)
    
    print(f"\n🔍 Port Scan Analysis:")
    print(f"  Unique ports scanned: {analysis['port_behavior']['unique_dst_ports']}")
    print(f"  Port diversity ratio: {analysis['port_behavior']['port_diversity_ratio']:.2f}")
    print(f"  Unique targets: {analysis['target_behavior']['unique_dst_ips']}")
    
    print(f"\n  Behavioral Flags:")
    for flag in analysis['behavioral_flags']:
        print(f"    🚩 {flag['flag']}: {flag['description']}")
        print(f"       Possible attack: {flag['possible_attack']}")
    
    # Should detect HIGH_PORT_DIVERSITY flag
    flag_types = [f['flag'] for f in analysis['behavioral_flags']]
    assert 'HIGH_PORT_DIVERSITY' in flag_types


def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("🧪 NetFlow Analyzer Test Suite")
    print("Testing per-IP queue system with behavioral analysis")
    print("="*80)
    
    try:
        test_basic_flow_recording()
        test_ssh_bruteforce_simulation()
        test_ip_history_retrieval()
        test_pattern_analysis()
        test_behavior_change_detection()
        test_observations()
        test_port_scanning_simulation()
        
        print("\n" + "="*80)
        print("✅ ALL TESTS PASSED!")
        print("="*80)
        print("\nNetFlow Analyzer is ready for integration with MCP server.")
        print("You can now test with Cline using the record_flow, get_ip_history,")
        print("analyze_ip_pattern, detect_behavior_change, and add_observation tools.")
        print("="*80 + "\n")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        raise
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        raise


if __name__ == "__main__":
    main()
