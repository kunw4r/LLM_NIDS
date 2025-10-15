#!/usr/bin/env python3
"""
Calculate detection metrics by comparing Cline predictions to ground truth labels.
Usage: python3 calculate_metrics.py <predictions_csv> <ground_truth_json>
"""

import json
import csv
import sys
from pathlib import Path

def load_ground_truth(json_path):
    """Load ground truth labels from JSON file."""
    with open(json_path, 'r') as f:
        data = json.load(f)
    # Handle nested structure - ground_truth is under 'ground_truth' key
    if isinstance(data, dict) and 'ground_truth' in data:
        data = data['ground_truth']
    return {str(item['flow_id']): item for item in data}

def load_predictions(csv_content):
    """Parse predictions from CSV string or file."""
    predictions = {}
    lines = csv_content.strip().split('\n')
    
    # Skip header
    for line in lines[1:]:
        if not line.strip():
            continue
        parts = line.split(',')
        if len(parts) >= 2:
            flow_id = parts[0].strip()
            verdict = parts[1].strip().upper()
            predictions[flow_id] = verdict
    
    return predictions

def calculate_metrics(predictions, ground_truth):
    """Calculate TP, TN, FP, FN and derived metrics."""
    tp = 0  # True Positive: Predicted ATTACK, Actually ATTACK
    tn = 0  # True Negative: Predicted BENIGN, Actually BENIGN
    fp = 0  # False Positive: Predicted ATTACK, Actually BENIGN
    fn = 0  # False Negative: Predicted BENIGN, Actually ATTACK
    
    results = []
    
    for flow_id in ground_truth.keys():
        actual = ground_truth[flow_id]
        # Handle both label formats: numeric (1/0) or string (ATTACK/BENIGN)
        actual_label_raw = actual.get('label', actual.get('label_name', 'UNKNOWN'))
        if actual_label_raw == 1 or str(actual_label_raw).upper() in ['ATTACK', '1']:
            actual_label = 'ATTACK'
        else:
            actual_label = 'BENIGN'
        
        actual_attack = actual.get('attack_type', 'N/A')
        
        predicted = predictions.get(flow_id, 'UNKNOWN')
        
        # Determine if actual is attack or benign
        is_actual_attack = actual_label == 'ATTACK'
        is_predicted_attack = predicted == 'ATTACK'
        
        if is_actual_attack and is_predicted_attack:
            tp += 1
            result = 'TP'
        elif not is_actual_attack and not is_predicted_attack:
            tn += 1
            result = 'TN'
        elif is_predicted_attack and not is_actual_attack:
            fp += 1
            result = 'FP'
        elif not is_predicted_attack and is_actual_attack:
            fn += 1
            result = 'FN'
        else:
            result = 'UNKNOWN'
        
        results.append({
            'flow_id': flow_id,
            'predicted': predicted,
            'actual': actual_label,
            'actual_attack_type': actual_attack,
            'result': result
        })
    
    # Calculate derived metrics
    total = tp + tn + fp + fn
    accuracy = (tp + tn) / total if total > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    return {
        'tp': tp,
        'tn': tn,
        'fp': fp,
        'fn': fn,
        'total': total,
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1_score': f1_score,
        'details': results
    }

def print_results(metrics, batch_name=""):
    """Print formatted results."""
    print("\n" + "="*60)
    print(f"{batch_name} DETECTION METRICS")
    print("="*60)
    
    print("\nCONFUSION MATRIX:")
    print(f"  True Positives (TP):  {metrics['tp']:2d}  (Correctly detected attacks)")
    print(f"  True Negatives (TN):  {metrics['tn']:2d}  (Correctly detected benign)")
    print(f"  False Positives (FP): {metrics['fp']:2d}  (Benign marked as attack)")
    print(f"  False Negatives (FN): {metrics['fn']:2d}  (Missed attacks)")
    print(f"  Total Flows:          {metrics['total']:2d}")
    
    print("\nPERFORMANCE METRICS:")
    print(f"  Accuracy:   {metrics['accuracy']*100:6.2f}%  (TP+TN)/Total")
    print(f"  Precision:  {metrics['precision']*100:6.2f}%  TP/(TP+FP)")
    print(f"  Recall:     {metrics['recall']*100:6.2f}%  TP/(TP+FN)")
    print(f"  F1 Score:   {metrics['f1_score']*100:6.2f}%  Harmonic mean of P&R")
    
    print("\nDETAILED FLOW-BY-FLOW RESULTS:")
    print("-"*60)
    print(f"{'Flow ID':<8} {'Predicted':<10} {'Actual':<10} {'Attack Type':<20} {'Result':<6}")
    print("-"*60)
    
    for detail in metrics['details']:
        attack_type = detail['actual_attack_type'] if detail['actual_attack_type'] else 'N/A'
        print(f"{detail['flow_id']:<8} {detail['predicted']:<10} {detail['actual']:<10} "
              f"{attack_type:<20} {detail['result']:<6}")
    
    print("="*60)
    
    # Interpretation
    print("\nINTERPRETATION:")
    if metrics['tp'] == metrics['total']:
        print("✓ PERFECT: All attacks detected, no false positives!")
    elif metrics['recall'] == 1.0:
        print("✓ EXCELLENT RECALL: All attacks detected (no false negatives)")
    elif metrics['recall'] >= 0.8:
        print("✓ GOOD: Detected most attacks")
    elif metrics['recall'] >= 0.5:
        print("⚠ MODERATE: Detected about half the attacks")
    else:
        print("✗ POOR: Missed most attacks")
    
    if metrics['fp'] > 0:
        print(f"⚠ WARNING: {metrics['fp']} false positive(s) detected")
    else:
        print("✓ NO FALSE POSITIVES: No benign flows marked as attacks")
    
    print()

def main():
    # Check if command-line arguments provided
    if len(sys.argv) >= 3:
        # Use command-line arguments
        predictions_file = Path(sys.argv[1])
        ground_truth_file = Path(sys.argv[2])
        
        if not predictions_file.exists():
            print(f"ERROR: Predictions file not found: {predictions_file}")
            sys.exit(1)
        
        if not ground_truth_file.exists():
            print(f"ERROR: Ground truth file not found: {ground_truth_file}")
            sys.exit(1)
        
        # Load predictions from file
        with open(predictions_file, 'r') as f:
            csv_output = f.read()
        
        # Extract batch name from file path
        batch_name = predictions_file.parent.name.upper()
        
    else:
        # For direct execution with hardcoded CSV from Cline's output (Batch 01)
        csv_output = """flow_id,verdict,confidence,attack_type,key_indicators,mitre,recommendation,tools_used
5,ATTACK,HIGH,FTP-BruteForce,Port 21; RST flag; 1ms duration; failed auth pattern; IP clean but behavior malicious,T1110,BLOCK,IP-Reputation
11,BENIGN,HIGH,N/A,Port 80; normal timing; standard web traffic,N/A,ALLOW,None
20,BENIGN,HIGH,N/A,Port 80; single packet; short duration; normal behavior,N/A,ALLOW,None
22,BENIGN,HIGH,N/A,Port 80; short duration; normal web traffic,N/A,ALLOW,None
43,ATTACK,HIGH,SSH-Bruteforce,Port 22; RST flag; instant failure; datacenter source; classic bruteforce,T1110.001,BLOCK,IP-Reputation;Geo
55,ATTACK,HIGH,FTP-BruteForce,Port 21; RST flag; 1ms duration; failed auth pattern; IP clean but behavior malicious,T1110,BLOCK,IP-Reputation
58,ATTACK,HIGH,SSH-Bruteforce,Port 22; RST flag; instant failure; datacenter source; classic bruteforce,T1110.001,BLOCK,IP-Reputation;Geo
62,BENIGN,HIGH,N/A,Port 8080; short duration; normal web traffic,N/A,ALLOW,None
65,BENIGN,HIGH,N/A,Port 8080; short duration; normal web traffic,N/A,ALLOW,None
66,BENIGN,HIGH,N/A,Port 8080; short duration; normal web traffic,N/A,ALLOW,None"""
        
        # Ground truth path
        ground_truth_file = Path.home() / "Desktop/NIDS_GROUND_TRUTH/labels/batch_01_labels.json"
        batch_name = "BATCH_01"
        
        if not ground_truth_file.exists():
            print(f"ERROR: Ground truth file not found at: {ground_truth_file}")
            print("Please ensure labels are at ~/Desktop/NIDS_GROUND_TRUTH/labels/batch_01_labels.json")
            sys.exit(1)
    
    # Load data
    ground_truth = load_ground_truth(ground_truth_file)
    predictions = load_predictions(csv_output)
    
    # Calculate metrics
    metrics = calculate_metrics(predictions, ground_truth)
    
    # Print results
    print_results(metrics, batch_name)
    
    # Return exit code based on performance
    if metrics['f1_score'] >= 0.8:
        return 0  # Good performance
    elif metrics['f1_score'] >= 0.5:
        return 1  # Moderate performance
    else:
        return 2  # Poor performance

if __name__ == "__main__":
    sys.exit(main())
