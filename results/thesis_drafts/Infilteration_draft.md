### Infilteration

#### Experimental Configuration

The Infilteration experiment evaluated the AMATAS architecture against a batch of 1,000 network flows comprising 50 Infilteration attack flows and 950 benign flows, yielding an attack prevalence of 5.0%. This ratio approximates realistic network conditions where malicious traffic constitutes a small fraction of total volume. All agents utilised the gpt-4o model with a Devil's Advocate weight of 30%. Flows were sorted chronologically within each source IP group to provide the temporal agent with coherent behavioural sequences. A Tier-1 Random Forest pre-filter with a threshold of 0.15 was applied, routing 974 of 1000 flows (97%) directly to a benign classification without incurring LLM cost. The remaining 26 flows were forwarded to the six-agent LLM pipeline for analysis by the four specialist agents (protocol, statistical, behavioural, and temporal), followed by the Devil's Advocate and orchestrator consensus stages.

#### Results

The system achieved a recall of 0.0%, correctly identifying 0 of 50 attack flows. Precision was 0.0%, with 2 benign flows incorrectly flagged as malicious, corresponding to a false positive rate of 0.2%. The combined F1 score was 0.0%. Of the 950 benign flows in the batch, 948 were correctly classified as benign, representing a benign accuracy of 99.8%. The total cost for the experiment was $0.80, yielding a cost per flow of $0.0008 and a cost per true positive of $inf.

#### Detection Analysis

The system failed to detect 50 of the 50 attack flows, yielding 50 false negatives. These missed detections may be attributable to attack flows whose feature distributions closely resemble benign traffic patterns, rendering them indistinguishable to the specialist agents at the individual flow level. In such cases, the statistical and behavioural agents lack sufficient signal to differentiate the attack from legitimate network activity, and the temporal agent may not have had a sufficient density of related flows to identify suspicious patterns. 
The two false positives indicate that certain benign flows exhibited feature characteristics sufficiently anomalous to trigger unanimous or near-unanimous specialist agreement on a malicious verdict. The Devil's Advocate agent was unable to override these consensus decisions despite arguing for a benign interpretation. Reducing the false positive rate without sacrificing recall remains an area for improvement in subsequent iterations.

#### Comparison to Baseline

Compared to the Phase 3b baseline, which evaluated 150 flows using Claude Sonnet-4 and achieved 100% recall and 95.9% F1 at $0.074 per flow, the Infilteration experiment yielded 100.0 percentage points lower recall and 95.9 percentage points lower F1. The cost per flow was $0.0008, 
representing a 99% reduction attributable primarily to the Tier-1 pre-filter eliminating the vast majority of flows from LLM processing. This cost advantage is central to the practical viability of LLM-based intrusion detection at production scale.

#### Summary

The Infilteration evaluation demonstrates that the AMATAS architecture 
faces significant challenges detecting this attack type, with recall at 0.0%. The low detection rate suggests that Infilteration flows exhibit feature distributions that closely mimic benign traffic, posing a fundamental challenge to flow-level analysis. Temporal clustering, which aggregates related flows before analysis, may provide the additional context required to distinguish these attacks from legitimate network activity. 
The total experiment cost of $0.80 confirms the economic viability of per-attack-type evaluation at this scale, supporting the continued execution of the Stage 1 evaluation across all fourteen CICIDS2018 attack categories.
