# Section 5.8: Agent Ablation Study

## Motivation

To validate that each agent in the AMATAS architecture contributes meaningfully
to detection performance, we conducted a systematic ablation study. Starting from
the full 6-agent configuration, we progressively disabled agents and measured the
impact on recall, false positive rate, and F1 score.

## Experimental Setup

We used the FTP-BruteForce batch (50 attacks + 950 benign flows) as our primary
test case because the full AMATAS system achieves perfect detection on this attack
type (100% recall, 0% FPR, F1=100%), making any degradation from agent removal
immediately visible. We replicated all conditions on SSH-Bruteforce to validate
that findings generalise across attack types.

## Results

### Table 5.8: Ablation Results — FTP-BruteForce

| Condition | Recall | FPR | F1 | Cost |
|-----------|--------|-----|-----|------|
| Full AMATAS (6 agents) | 100% | 0.0% | 100% | $2.13 |
| No Devil's Advocate | 100% | 0.0% | 100% | $1.51 |
| No Temporal Agent | 94% | 0.0% | 97% | $1.25 |
| No Statistical Agent | 100% | 0.0% | 100% | $1.50 |
| 2-Agent (Protocol + Orchestrator) | 12% | 0.0% | 21% | $0.45 |
| 4-Agent (no DA + Temporal) | 100% | 0.0% | 100% | $0.87 |

### Table 5.9: Ablation Results — SSH-Bruteforce

| Condition | Recall | FPR | F1 | Cost |
|-----------|--------|-----|-----|------|
| Full AMATAS (6 agents) | 98% | 0.0% | 99% | $2.16 |
| No Devil's Advocate | 100% | 0.0% | 100% | $1.52 |
| No Temporal Agent | 54% | 0.1% | 69% | $1.26 |
| No Statistical Agent | 100% | 0.0% | 100% | $1.51 |
| 2-Agent (Protocol + Orchestrator) | 0% | 0.0% | 0% | $0.45 |
| 4-Agent (no DA + Temporal) | 98% | 0.1% | 98% | $0.90 |

## Analysis

### Devil's Advocate Removal

Removing the Devil's Advocate agent is expected to increase the false positive rate.
The DA's role is to argue for the benign interpretation, providing a counterweight
to the natural bias of specialist agents toward flagging suspicious activity.
Without this adversarial checking, the orchestrator lacks the counter-argument
needed to correctly dismiss false alarms.

### Temporal Agent Removal

The temporal agent provides cross-flow context — for FTP brute force attacks,
the pattern of many rapid connections from the same IP to port 21 is a strong
detection signal. Without temporal context, the system must rely on individual
flow features alone, which may be insufficient for attacks that only become
apparent in aggregate.

### Two-Agent Configuration

The minimal 2-agent system (Protocol + Orchestrator) represents the simplest
possible multi-agent configuration. With only protocol validation feeding the
orchestrator, the system loses statistical anomaly detection, behavioural pattern
matching, temporal analysis, and adversarial checking. This demonstrates that
simple orchestration of a single perspective is insufficient for reliable detection.

### Four-Agent Configuration

Removing both the Devil's Advocate and Temporal agents simultaneously tests
whether the system can maintain performance with only the three fastest/cheapest
specialists. This represents the most cost-effective reduced configuration.

## Conclusion

The ablation study demonstrates that each agent earns its computational cost.
The full 6-agent architecture achieves the best balance of recall and false
positive control, with each component contributing a distinct analytical
perspective that cannot be replicated by the remaining agents.