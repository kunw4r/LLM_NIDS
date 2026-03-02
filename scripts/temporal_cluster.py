"""
Temporal clustering for AMATAS v3 experiments.

Groups flows by source IP and identifies suspicious clusters
(e.g., many DNS queries from one IP = potential DNS exfiltration).

Supports two modes:
- Time-windowed: groups flows within a time window (for short-lived attacks)
- IP-level: groups ALL flows per IP (for slow/distributed attacks like Infilteration)

Usage:
    from scripts.temporal_cluster import cluster_flows, get_override_flow_ids

    # IP-level (default, best for Infilteration)
    cluster_info = cluster_flows(flows, ip_level=True)
    override_ids = get_override_flow_ids(cluster_info, dns_threshold=8)

    # Time-windowed
    cluster_info = cluster_flows(flows, ip_level=False, time_window_ms=300000)
    override_ids = get_override_flow_ids(cluster_info, dns_threshold=10)
"""

from collections import defaultdict


def cluster_flows(flows, time_window_ms=300000, min_cluster_size=3, ip_level=True):
    """Group flows by source IP, optionally within time windows.

    Args:
        flows: list of flow dicts with flow_id, IPV4_SRC_ADDR,
               FLOW_START_MILLISECONDS, L4_DST_PORT, PROTOCOL
        time_window_ms: clustering window in ms (default 5 min, ignored if ip_level=True)
        min_cluster_size: minimum flows to form a cluster
        ip_level: if True, group ALL flows per IP (no time windowing)

    Returns:
        dict mapping flow_id -> {cluster_id, cluster_size, dns_count,
        unique_ports, time_span_ms, cluster_summary_text}
    """
    # Group by source IP
    ip_flows = defaultdict(list)
    for flow in flows:
        src_ip = flow.get("IPV4_SRC_ADDR", "unknown")
        ip_flows[src_ip].append(flow)

    cluster_info = {}
    cluster_id = 0

    for src_ip, group in ip_flows.items():
        group.sort(key=lambda f: f.get("FLOW_START_MILLISECONDS", 0))

        if ip_level:
            # IP-level: treat all flows from this IP as one cluster
            windows = [group] if len(group) >= min_cluster_size else []
        else:
            # Time-windowed: sliding window clustering
            windows = []
            clustered_ids = set()
            for start_idx in range(len(group)):
                if group[start_idx].get("flow_id") in clustered_ids:
                    continue
                end_idx = start_idx
                start_ts = group[start_idx].get("FLOW_START_MILLISECONDS", 0)
                while (end_idx + 1 < len(group) and
                       group[end_idx + 1].get("FLOW_START_MILLISECONDS", 0) - start_ts <= time_window_ms):
                    end_idx += 1
                window = group[start_idx:end_idx + 1]
                if len(window) >= min_cluster_size:
                    windows.append(window)
                    clustered_ids.update(f.get("flow_id") for f in window)

        for window_flows in windows:
            # Check no double-clustering
            if any(f.get("flow_id") in cluster_info for f in window_flows):
                continue

            dns_count = sum(
                1 for f in window_flows
                if f.get("L4_DST_PORT") == 53 or f.get("L4_SRC_PORT") == 53
            )
            unique_ports = len(set(
                f.get("L4_DST_PORT", 0) for f in window_flows
            ))
            timestamps = [f.get("FLOW_START_MILLISECONDS", 0) for f in window_flows]
            time_span_ms = max(timestamps) - min(timestamps) if len(timestamps) > 1 else 0

            total_bytes_in = sum(f.get("IN_BYTES", 0) for f in window_flows)
            total_bytes_out = sum(f.get("OUT_BYTES", 0) for f in window_flows)
            protocols = set(f.get("PROTOCOL", 0) for f in window_flows)

            summary = (
                f"CLUSTER #{cluster_id}: {len(window_flows)} flows from {src_ip} "
                f"over {time_span_ms/1000:.1f}s. "
                f"DNS queries: {dns_count}/{len(window_flows)}. "
                f"Unique dst ports: {unique_ports}. "
                f"Total bytes in/out: {total_bytes_in}/{total_bytes_out}. "
                f"Protocols: {sorted(protocols)}. "
                f"This cluster context is critical — individual flows may look benign, "
                f"but the AGGREGATE PATTERN across this cluster may indicate "
                f"DNS exfiltration (T1048.003), C2 beaconing (T1071), or infiltration."
            )

            for flow in window_flows:
                fid = flow.get("flow_id")
                cluster_info[fid] = {
                    "cluster_id": cluster_id,
                    "cluster_size": len(window_flows),
                    "dns_count": dns_count,
                    "unique_ports": unique_ports,
                    "time_span_ms": time_span_ms,
                    "cluster_summary_text": summary,
                }

            cluster_id += 1

    # Assign singleton info for unclustered flows
    for flow in flows:
        fid = flow.get("flow_id")
        if fid not in cluster_info:
            cluster_info[fid] = {
                "cluster_id": None,
                "cluster_size": 1,
                "dns_count": 0,
                "unique_ports": 1,
                "time_span_ms": 0,
                "cluster_summary_text": None,
            }

    return cluster_info


def get_override_flow_ids(cluster_info, dns_threshold=8):
    """Return set of flow_ids in suspicious clusters that should bypass Tier 1.

    A cluster is suspicious if it has >= dns_threshold DNS queries,
    suggesting potential DNS exfiltration or C2 communication.

    Args:
        cluster_info: output of cluster_flows()
        dns_threshold: minimum DNS query count to flag cluster

    Returns:
        set of flow_ids that should bypass RF filter
    """
    suspicious_clusters = set()
    for fid, info in cluster_info.items():
        if info["cluster_id"] is not None and info["dns_count"] >= dns_threshold:
            suspicious_clusters.add(info["cluster_id"])

    override_ids = set()
    for fid, info in cluster_info.items():
        if info["cluster_id"] in suspicious_clusters:
            override_ids.add(fid)

    return override_ids
