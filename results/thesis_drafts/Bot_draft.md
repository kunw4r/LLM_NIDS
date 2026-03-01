### Bot

#### Experimental Configuration

The Bot experiment evaluated the AMATAS architecture against a batch of 1,000 network flows comprising 50 Bot attack flows and 950 benign flows, yielding an attack prevalence of 5.0%. This ratio approximates realistic network conditions where malicious traffic constitutes a small fraction of total volume. All agents utilised the gpt-4o model with a Devil's Advocate weight of 30%. Flows were sorted chronologically within each source IP group to provide the temporal agent with coherent behavioural sequences. A Tier-1 Random Forest pre-filter with a threshold of 0.15 was applied, routing 927 of 1000 flows (93%) directly to a benign classification without incurring LLM cost. The remaining 73 flows were forwarded to the six-agent LLM pipeline for analysis by the four specialist agents (protocol, statistical, behavioural, and temporal), followed by the Devil's Advocate and orchestrator consensus stages.

#### Results

The system achieved a recall of 82.0%, correctly identifying 41 of 50 attack flows. Precision was 87.2%, with 6 benign flows incorrectly flagged as malicious, corresponding to a false positive rate of 0.6%. The combined F1 score was 84.5%. Of the 950 benign flows in the batch, 944 were correctly classified as benign, representing a benign accuracy of 99.4%. The total cost for the experiment was $2.30, yielding a cost per flow of $0.0023 and a cost per true positive of $0.056.

#### Detection Analysis

The system failed to detect nine of the 50 attack flows, yielding nine false negatives. These missed detections may be attributable to attack flows whose feature distributions closely resemble benign traffic patterns, rendering them indistinguishable to the specialist agents at the individual flow level. In such cases, the statistical and behavioural agents lack sufficient signal to differentiate the attack from legitimate network activity, and the temporal agent may not have had a sufficient density of related flows to identify suspicious patterns. 
The six false positives indicate that certain benign flows exhibited feature characteristics sufficiently anomalous to trigger unanimous or near-unanimous specialist agreement on a malicious verdict. The Devil's Advocate agent was unable to override these consensus decisions despite arguing for a benign interpretation. Reducing the false positive rate without sacrificing recall remains an area for improvement in subsequent iterations.

#### Comparison to Baseline

Compared to the Phase 3b baseline, which evaluated 150 flows using Claude Sonnet-4 and achieved 100% recall and 95.9% F1 at $0.074 per flow, the Bot experiment yielded 18.0 percentage points lower recall and 11.4 percentage points lower F1. The cost per flow was $0.0023, 
representing a 97% reduction attributable primarily to the Tier-1 pre-filter eliminating the vast majority of flows from LLM processing. This cost advantage is central to the practical viability of LLM-based intrusion detection at production scale.

#### Summary

The Bot evaluation demonstrates that the AMATAS architecture 
achieves strong detection performance with an F1 of 84.5% and minimal false positives at realistic traffic distributions. The combination of high recall and low false positive rate indicates that this attack type is well-suited to the multi-agent analytical approach, producing sufficiently distinctive flow-level signatures for reliable detection. 
The total experiment cost of $2.30 confirms the economic viability of per-attack-type evaluation at this scale, supporting the continued execution of the Stage 1 evaluation across all fourteen CICIDS2018 attack categories.

#### Data Integrity Note

The Bot attack type appears exclusively in the test partition and was not present in the intended RF training data (development split). The initial RF, trained on all 20 million flows, had exposure to Bot flows during training, potentially learning to filter them — an instance of data leakage. This experiment was therefore rerun with a clean RF trained only on the 7.04 million development flows. 
Comparing the leaky and clean results: recall moved from 82.0% to 82.0% (+0.0 pp), F1 from 84.5% to 84.5% (+0.0 pp), and cost from $2.30 to $2.30 (+$0.00). 
The minimal difference suggests that the leakage had negligible practical impact on detection performance for this attack type.
