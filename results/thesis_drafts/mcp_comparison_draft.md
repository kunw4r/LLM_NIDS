### MCP Comparison Experiments

#### Experimental Design

To contextualise the AMATAS multi-agent architecture, three single-agent configurations were evaluated on a shared 100-flow batch comprising 10 FTP-BruteForce, 10 SSH-Bruteforce, 10 DoS-Hulk, and 70 benign flows sourced from the RF evaluation holdout (dev_eval.csv). Each configuration uses a single LLM call per flow with no Tier-1 pre-filtering, isolating the effect of prompt design and tool access on detection quality.

#### Configuration A: Zero-Shot Baseline

The first configuration provides the LLM with a minimal system prompt containing only the instruction to classify the flow as BENIGN, SUSPICIOUS, or MALICIOUS. No attack signatures, no feature explanations, no calibration guidance.

Using gpt-4o-mini, Config A achieved 90.0% recall with 41.4% FPR (F1: 62.8%) at $0.01. This establishes the baseline performance achievable without domain engineering.

#### Configuration B: Engineered Prompt

The second configuration augments the system prompt with detailed attack pattern signatures covering brute force, denial-of-service variants (GoldenEye, Slowloris, Hulk, LOIC, HOIC), web application attacks, botnet communication, and infiltration patterns. Crucially, it also includes benign traffic calibration: the prompt explicitly states that private RFC1918 IPs are expected (not suspicious), and requires positive evidence of anomaly before flagging.

Config B achieved 66.7% recall with 27.1% FPR (F1: 58.0%) at $0.37. The engineered prompt provides the single agent with the domain knowledge needed for NetFlow classification.

#### Configuration C: Engineered Prompt + MITRE ATT&CK Tool

The third configuration extends Config B with access to MITRE ATT&CK lookup tools via OpenAI function calling, simulating the MCP tool-use paradigm from Phase 1. The agent can query specific technique IDs (e.g., T1110 for Brute Force) or search by keyword to enrich its analysis with official ATT&CK descriptions, detection guidance, and tactic classifications.

Config C achieved 70.0% recall with 30.0% FPR (F1: 58.3%) at $0.45. The marginal F1 difference of +0.3 percentage points versus Config B suggests that MITRE ATT&CK tooling provides minimal uplift when the engineered prompt already encodes the relevant attack signatures. The tool adds cost ($0.09 additional) without proportional accuracy gains.

#### Comparison with AMATAS v2

The AMATAS v2 multi-agent system (6 specialist agents + Tier-1 RF pre-filter) achieves 85% recall with 1.1% FPR (F1: 88%) at $2.59/1000 flows using GPT-4o. The best single-agent configuration (Config A) achieved 62.8% F1, demonstrating a 25.2 percentage point gap that the multi-agent architecture bridges through specialised analytical roles and adversarial cross-checking.

#### Key Findings

1. **Prompt engineering provides the largest single-agent improvement.** The gap between zero-shot and engineered prompts demonstrates that domain knowledge injection is the primary driver of single-agent NIDS performance.

2. **MITRE ATT&CK tooling provides marginal uplift.** When attack signatures are already encoded in the prompt, external tool lookups add cost without proportional accuracy gains. This validates the Phase 1 finding that external tools are of limited value on anonymised datasets.

3. **Multi-agent AMATAS outperforms all single-agent configurations.** Specialised analytical roles (protocol validation, statistical anomaly detection, behavioural pattern matching, temporal correlation) combined with adversarial cross-checking via the Devil's Advocate produce more reliable classifications than any single-agent approach.

4. **External tools are limited by data quality, not tool quality.** The MITRE ATT&CK framework is comprehensive, but its value is constrained when applied to anonymised synthetic traffic where IP reputation, geolocation, and threat intelligence feeds return no useful data.
