### DDOS_attack-LOIC-UDP

#### Experimental Configuration

The DDOS_attack-LOIC-UDP experiment evaluated the AMATAS architecture against a batch of 1,000 network flows comprising 50 DDOS_attack-LOIC-UDP attack flows and 950 benign flows, yielding an attack prevalence of 5.0%. This ratio approximates realistic network conditions where malicious traffic constitutes a small fraction of total volume. All agents utilised the gpt-4o model with a Devil's Advocate weight of 30%. Flows were sorted chronologically within each source IP group to provide the temporal agent with coherent behavioural sequences. A Tier-1 Random Forest pre-filter with a threshold of 0.15 was applied, routing 941 of 1000 flows (94%) directly to a benign classification without incurring LLM cost. The remaining 59 flows were forwarded to the six-agent LLM pipeline for analysis by the four specialist agents (protocol, statistical, behavioural, and temporal), followed by the Devil's Advocate and orchestrator consensus stages.

#### Results

The system achieved a recall of 100.0%, correctly identifying 50 of 50 attack flows. Precision was 92.6%, with 4 benign flows incorrectly flagged as malicious, corresponding to a false positive rate of 0.4%. The combined F1 score was 96.2%. Of the 950 benign flows in the batch, 946 were correctly classified as benign, representing a benign accuracy of 99.6%. The total cost for the experiment was $1.87, yielding a cost per flow of $0.0019 and a cost per true positive of $0.037.

#### Detection Analysis

The system achieved perfect recall, detecting all 50 attack flows without any false negatives. This indicates that the DDOS_attack-LOIC-UDP attack type produces feature-level signatures that are consistently identifiable by the specialist agents, even at the individual flow level. 
The four false positives indicate that certain benign flows exhibited feature characteristics sufficiently anomalous to trigger unanimous or near-unanimous specialist agreement on a malicious verdict. The Devil's Advocate agent was unable to override these consensus decisions despite arguing for a benign interpretation. Reducing the false positive rate without sacrificing recall remains an area for improvement in subsequent iterations.

#### Comparison to Baseline

Compared to the Phase 3b baseline, which evaluated 150 flows using Claude Sonnet-4 and achieved 100% recall and 95.9% F1 at $0.074 per flow, the DDOS_attack-LOIC-UDP experiment yielded 0.0 percentage points equivalent recall and 0.3 percentage points higher F1. The cost per flow was $0.0019, 
representing a 97% reduction attributable primarily to the Tier-1 pre-filter eliminating the vast majority of flows from LLM processing. This cost advantage is central to the practical viability of LLM-based intrusion detection at production scale.

#### Summary

The DDOS_attack-LOIC-UDP evaluation demonstrates that the AMATAS architecture 
achieves strong detection performance with an F1 of 96.2% and minimal false positives at realistic traffic distributions. The combination of high recall and low false positive rate indicates that this attack type is well-suited to the multi-agent analytical approach, producing sufficiently distinctive flow-level signatures for reliable detection. 
The total experiment cost of $1.87 confirms the economic viability of per-attack-type evaluation at this scale, supporting the continued execution of the Stage 1 evaluation across all fourteen CICIDS2018 attack categories.
