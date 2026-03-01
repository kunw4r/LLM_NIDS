### DDOS_attack-HOIC

#### Experimental Configuration

The DDOS_attack-HOIC experiment evaluated the AMATAS architecture against a batch of 1,000 network flows comprising 50 DDOS_attack-HOIC attack flows and 950 benign flows, yielding an attack prevalence of 5.0%. This ratio approximates realistic network conditions where malicious traffic constitutes a small fraction of total volume. All agents utilised the gpt-4o model with a Devil's Advocate weight of 30%. Flows were sorted chronologically within each source IP group to provide the temporal agent with coherent behavioural sequences. A Tier-1 Random Forest pre-filter with a threshold of 0.15 was applied, routing 941 of 1000 flows (94%) directly to a benign classification without incurring LLM cost. The remaining 59 flows were forwarded to the six-agent LLM pipeline for analysis by the four specialist agents (protocol, statistical, behavioural, and temporal), followed by the Devil's Advocate and orchestrator consensus stages.

#### Results

The system achieved a recall of 58.0%, correctly identifying 29 of 50 attack flows. Precision was 96.7%, with 1 benign flows incorrectly flagged as malicious, corresponding to a false positive rate of 0.1%. The combined F1 score was 72.5%. Of the 950 benign flows in the batch, 949 were correctly classified as benign, representing a benign accuracy of 99.9%. The total cost for the experiment was $1.79, yielding a cost per flow of $0.0018 and a cost per true positive of $0.062.

#### Detection Analysis

The system failed to detect 21 of the 50 attack flows, yielding 21 false negatives. These missed detections may be attributable to attack flows whose feature distributions closely resemble benign traffic patterns, rendering them indistinguishable to the specialist agents at the individual flow level. In such cases, the statistical and behavioural agents lack sufficient signal to differentiate the attack from legitimate network activity, and the temporal agent may not have had a sufficient density of related flows to identify suspicious patterns. 
The one false positives indicate that certain benign flows exhibited feature characteristics sufficiently anomalous to trigger unanimous or near-unanimous specialist agreement on a malicious verdict. The Devil's Advocate agent was unable to override these consensus decisions despite arguing for a benign interpretation. Reducing the false positive rate without sacrificing recall remains an area for improvement in subsequent iterations.

#### Comparison to Baseline

Compared to the Phase 3b baseline, which evaluated 150 flows using Claude Sonnet-4 and achieved 100% recall and 95.9% F1 at $0.074 per flow, the DDOS_attack-HOIC experiment yielded 42.0 percentage points lower recall and 23.4 percentage points lower F1. The cost per flow was $0.0018, 
representing a 98% reduction attributable primarily to the Tier-1 pre-filter eliminating the vast majority of flows from LLM processing. This cost advantage is central to the practical viability of LLM-based intrusion detection at production scale.

#### Summary

The DDOS_attack-HOIC evaluation demonstrates that the AMATAS architecture 
faces significant challenges detecting this attack type, with recall at 58.0%. The low detection rate suggests that DDOS_attack-HOIC flows exhibit feature distributions that closely mimic benign traffic, posing a fundamental challenge to flow-level analysis. Temporal clustering, which aggregates related flows before analysis, may provide the additional context required to distinguish these attacks from legitimate network activity. 
The total experiment cost of $1.79 confirms the economic viability of per-attack-type evaluation at this scale, supporting the continued execution of the Stage 1 evaluation across all fourteen CICIDS2018 attack categories.
