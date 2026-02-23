# Bibliography & Research Resources

## Papers to Cite in Your Thesis

### Core LLM NIDS Papers

#### 1. arXiv 2507.04752 (2024) - PRIMARY CITATION
**Title**: "Large Language Models for Network Intrusion Detection Systems"  
**Authors**: [Check paper for exact authors]  
**URL**: https://arxiv.org/abs/2507.04752  
**Key Contributions**:
- Multi-agent LLM NIDS architecture
- nDPI-XGBoost-LLM pipeline
- Hybrid ML-LLM approach
- Evaluated on CICIDS2017/2018

**Citation Use**: Primary framework comparison, hybrid architecture justification

**BibTeX**:
```bibtex
@article{llm_nids_2024,
  title={Large Language Models for Network Intrusion Detection Systems},
  author={[Authors from paper]},
  journal={arXiv preprint arXiv:2507.04752},
  year={2024}
}
```

---

#### 2. Giorgio Zoppi - Cognitive NIDS (Medium Article)
**Title**: "Large Language Models for Network Intrusion Detection Systems"  
**URL**: [Medium URL - check your research notes]  
**Key Contributions**:
- Cognitive NIDS philosophy
- Multi-level explanations
- Intelligent querying patterns
- Alert fatigue mitigation

**Citation Use**: Explainability, cognitive reasoning approach

---

#### 3. Sec-Llama (IEEE 2024)
**Title**: "Sec-Llama: a Compact Fine-Tuned LLM for Network Intrusion Detection System"  
**Authors**: [Check IEEE Xplore]  
**Conference**: IEEE  
**Year**: 2024  
**DOI**: 10.1109/[check paper]  
**Key Contributions**:
- Fine-tuned Llama-2-7B for security
- LoRA adaptation technique
- Local deployment (no API costs)
- Domain-specific training datasets

**Citation Use**: Fine-tuning methodology, local LLM deployment

**BibTeX**:
```bibtex
@inproceedings{sec_llama_2024,
  title={Sec-Llama: a Compact Fine-Tuned LLM for Network Intrusion Detection System},
  author={[Authors]},
  booktitle={IEEE [Conference Name]},
  year={2024},
  organization={IEEE}
}
```

---

#### 4. eX-NIDS (arXiv 2025)
**Title**: "eX-NIDS: A Framework for Explainable Network Intrusion Detection System"  
**Authors**: [Check arXiv]  
**URL**: https://arxiv.org/abs/[paper number]  
**Year**: 2025  
**Key Contributions**:
- Explainable AI for NIDS
- SHAP + LLM explanations
- Post-hoc interpretability
- Counterfactual reasoning

**Citation Use**: Explainability techniques, XAI integration

---

### LLM Tool Use & Agent Papers

#### 5. ReAct: Reasoning and Acting in Language Models
**Title**: "ReAct: Synergizing Reasoning and Acting in Language Models"  
**Authors**: Yao et al.  
**Conference**: ICLR 2023  
**URL**: https://arxiv.org/abs/2210.03629  
**Key Contributions**:
- Chain-of-Thought + tool use
- Reasoning traces
- Action execution

**Citation Use**: Multi-agent reasoning, CoT prompting

**BibTeX**:
```bibtex
@inproceedings{yao2023react,
  title={ReAct: Synergizing Reasoning and Acting in Language Models},
  author={Yao, Shunyu and Zhao, Jeffrey and Yu, Dian and Du, Nan and Shafran, Izhak and Narasimhan, Karthik and Cao, Yuan},
  booktitle={International Conference on Learning Representations},
  year={2023}
}
```

---

#### 6. Toolformer
**Title**: "Toolformer: Language Models Can Teach Themselves to Use Tools"  
**Authors**: Schick et al. (Meta)  
**Conference**: NeurIPS 2023  
**URL**: https://arxiv.org/abs/2302.04761  
**Key Contributions**:
- Self-supervised tool learning
- API integration
- Few-shot tool use

**Citation Use**: Tool augmentation, API calls

**BibTeX**:
```bibtex
@article{schick2023toolformer,
  title={Toolformer: Language Models Can Teach Themselves to Use Tools},
  author={Schick, Timo and Dwivedi-Yu, Jane and Dessì, Roberto and Raileanu, Roberta and Lomeli, Maria and Zettlemoyer, Luke and Cancedda, Nicola and Scialom, Thomas},
  journal={arXiv preprint arXiv:2302.04761},
  year={2023}
}
```

---

#### 7. HuggingGPT
**Title**: "HuggingGPT: Solving AI Tasks with ChatGPT and its Friends in Hugging Face"  
**Authors**: Shen et al.  
**Conference**: NeurIPS 2023  
**URL**: https://arxiv.org/abs/2303.17580  
**Key Contributions**:
- LLM as controller/orchestrator
- Multi-model coordination
- Task planning

**Citation Use**: Multi-agent orchestration

---

### RAG (Retrieval-Augmented Generation) Papers

#### 8. RAG: Retrieval-Augmented Generation
**Title**: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"  
**Authors**: Lewis et al. (Facebook AI)  
**Conference**: NeurIPS 2020  
**URL**: https://arxiv.org/abs/2005.11401  
**Key Contributions**:
- Dense retrieval + generation
- External knowledge integration
- Vector search

**Citation Use**: Memory retrieval, historical context integration

**BibTeX**:
```bibtex
@inproceedings{lewis2020rag,
  title={Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks},
  author={Lewis, Patrick and Perez, Ethan and Piktus, Aleksandra and Petroni, Fabio and Karpukhin, Vladimir and Goyal, Naman and Küttler, Heinrich and Lewis, Mike and Yih, Wen-tau and Rocktäschel, Tim and others},
  booktitle={Advances in Neural Information Processing Systems},
  volume={33},
  pages={9459--9474},
  year={2020}
}
```

---

### Network Intrusion Detection (Traditional)

#### 9. CICIDS2018 Dataset Paper
**Title**: "Toward Generating a New Intrusion Detection Dataset and Intrusion Traffic Characterization"  
**Authors**: Sharafaldin et al.  
**Conference**: ICISSP 2018  
**Year**: 2018  
**Key Contributions**:
- Modern attack dataset
- 15 attack categories
- Real network traffic profiles

**Citation Use**: Dataset description, evaluation benchmark

**BibTeX**:
```bibtex
@inproceedings{sharafaldin2018cicids2018,
  title={Toward Generating a New Intrusion Detection Dataset and Intrusion Traffic Characterization},
  author={Sharafaldin, Iman and Lashkari, Arash Habibi and Ghorbani, Ali A},
  booktitle={4th International Conference on Information Systems Security and Privacy (ICISSP)},
  pages={108--116},
  year={2018}
}
```

---

#### 10. Survey: Machine Learning for NIDS
**Title**: "Machine Learning for Network Intrusion Detection: A Comprehensive Review"  
**Authors**: Liu & Lang  
**Journal**: IEEE Access  
**Year**: 2019  
**Key Contributions**:
- ML techniques comparison
- Feature engineering
- Limitations of traditional approaches

**Citation Use**: Traditional ML baseline, limitations

---

### Vector Databases & Embeddings

#### 11. Sentence-BERT
**Title**: "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks"  
**Authors**: Reimers & Gurevych  
**Conference**: EMNLP 2019  
**URL**: https://arxiv.org/abs/1908.10084  
**Key Contributions**:
- Efficient sentence embeddings
- Semantic similarity
- 384-dimensional vectors

**Citation Use**: Embedding model justification

**BibTeX**:
```bibtex
@inproceedings{reimers2019sentencebert,
  title={Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks},
  author={Reimers, Nils and Gurevych, Iryna},
  booktitle={Proceedings of the 2019 Conference on Empirical Methods in Natural Language Processing},
  year={2019}
}
```

---

### Model Context Protocol

#### 12. MCP Security Analysis (arXiv)
**Title**: "Security and Safety in the Model Context Protocol Ecosystem"  
**Authors**: [Check arXiv]  
**URL**: https://arxiv.org/html/2512.08290v2  
**Year**: 2024  
**Key Contributions**:
- MCP security considerations
- Client-host-server model
- Tool integration patterns

**Citation Use**: MCP architecture justification

---

### APT & Slow-Burn Attack Detection

#### 13. APT Detection Survey
**Title**: "Advanced Persistent Threat Detection: A Survey"  
**Authors**: Ghafir et al.  
**Journal**: IEEE Communications Surveys & Tutorials  
**Year**: 2018  
**Key Contributions**:
- APT characteristics
- Multi-stage attack patterns
- Detection challenges

**Citation Use**: Slow-burn attack motivation, APT patterns

---

#### 14. Time-Series Anomaly Detection with LLMs
**Title**: "Large Language Models for Time Series Anomaly Detection and Mitigation"  
**Authors**: [From your research notes]  
**URL**: https://dai.lids.mit.edu/wp-content/uploads/2025/08/Salim_Anomaly_Detection.pdf  
**Key Contributions**:
- Temporal pattern recognition
- Gradual escalation detection
- Time-series with LLMs

**Citation Use**: Temporal reasoning, trend detection

---

### XGBoost & Gradient Boosting

#### 15. XGBoost Paper
**Title**: "XGBoost: A Scalable Tree Boosting System"  
**Authors**: Chen & Guestrin  
**Conference**: KDD 2016  
**URL**: https://arxiv.org/abs/1603.02754  
**Key Contributions**:
- Gradient boosting algorithm
- Scalability optimizations
- Feature importance

**Citation Use**: ML filter justification

**BibTeX**:
```bibtex
@inproceedings{chen2016xgboost,
  title={XGBoost: A Scalable Tree Boosting System},
  author={Chen, Tianqi and Guestrin, Carlos},
  booktitle={Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining},
  pages={785--794},
  year={2016}
}
```

---

## Additional Resources

### Technical Documentation

#### ChromaDB
**URL**: https://docs.trychroma.com  
**Citation**: Software documentation

#### Model Context Protocol Specification
**URL**: https://modelcontextprotocol.io  
**Citation**: Protocol specification

#### Anthropic Claude API
**URL**: https://docs.anthropic.com  
**Citation**: LLM API documentation

---

### Related Theses & Dissertations

Search these for inspiration:

1. **USF ETD**: "LLMs in Network Intrusion Detection – A Comprehensive Analysis"
   - URL: https://digitalcommons.usf.edu/cgi/viewcontent.cgi?article=12223&context=etd

2. **UTC Honors Thesis**: "Survey on application of Large Language Models in network attack detection"
   - URL: https://scholar.utc.edu/cgi/viewcontent.cgi?article=1620&context=honors-theses

---

## Citation Guidelines for Your Thesis

### Chapter 1: Introduction
**Cite**:
- CICIDS2018 dataset paper (evaluation data)
- APT detection survey (motivation)
- ML for NIDS survey (traditional limitations)

### Chapter 2: Literature Review
**Cite**:
- arXiv 2507.04752 (primary LLM NIDS)
- Sec-Llama (fine-tuning)
- eX-NIDS (explainability)
- Giorgio Zoppi (cognitive approach)
- ReAct, Toolformer, HuggingGPT (multi-agent)
- RAG paper (retrieval-augmented generation)

### Chapter 3: Architecture
**Cite**:
- MCP security analysis (protocol choice)
- Sentence-BERT (embeddings)
- XGBoost (ML filter)
- ChromaDB documentation (storage)

### Chapter 4: Implementation
**Cite**:
- Python libraries (numpy, pandas, etc.)
- Claude API (LLM choice)
- CICIDS2018 (data source)

### Chapter 5: Evaluation
**Cite**:
- CICIDS2018 (benchmark)
- ML for NIDS survey (baseline comparison)
- Time-series anomaly detection (slow-burn metrics)

### Chapter 6: Conclusion
**Cite**:
- Key papers showing your improvements
- Future work directions

---

## Recommended Citation Manager

Use **Zotero** (free) or **Mendeley**:
1. Install browser extension
2. Import papers from arXiv/IEEE
3. Auto-generate BibTeX
4. Integrate with LaTeX/Word

---

## Academic Search Tips

### Finding Related Papers
```
Search terms:
- "LLM network intrusion detection"
- "large language model cybersecurity"
- "RAG intrusion detection"
- "temporal anomaly detection"
- "multi-agent security"
- "explainable NIDS"
```

### Databases
- **arXiv.org**: Preprints (ML/AI papers)
- **IEEE Xplore**: Conference papers (security)
- **Google Scholar**: Broad search
- **ACM Digital Library**: CS conferences
- **Semantic Scholar**: Citation graphs

---

## Important Note on Plagiarism

**DO NOT** copy code or text from papers without:
1. ✅ Proper citation
2. ✅ Paraphrasing (not word-for-word)
3. ✅ Using quotation marks for direct quotes
4. ✅ Referencing in your implementation

**Your contribution is**:
- Novel architecture (MCP + Vector DB + Multi-agent)
- Implementation (working code)
- Evaluation (CICIDS2018 + slow-burn scenarios)
- Analysis (comparison with baselines)

---

## Paper Reading Priority

### Must Read (Before Coding):
1. ✅ arXiv 2507.04752 - Primary framework
2. ✅ RAG paper - Memory retrieval
3. ✅ ReAct - Multi-agent reasoning

### Should Read (During Implementation):
4. ✅ Sec-Llama - Fine-tuning approach
5. ✅ eX-NIDS - Explainability
6. ✅ XGBoost - ML filter

### Optional (For Depth):
7. ⏳ APT detection survey
8. ⏳ Time-series anomaly detection
9. ⏳ MCP security analysis

---

## Thesis-Specific Citations

When writing your thesis, structure citations like:

### Motivation Section:
> "Traditional ML-based NIDS struggle to detect Advanced Persistent Threats (APTs) 
> that unfold gradually over days or weeks [Ghafir et al., 2018]. While recent 
> work has explored using Large Language Models (LLMs) for intrusion detection 
> [arXiv 2507.04752], these systems lack persistent memory to correlate events 
> across time windows..."

### Related Work Section:
> "Several frameworks have integrated LLMs into NIDS architectures. The nDPI-XGBoost-LLM 
> pipeline [arXiv 2507.04752] uses a hybrid approach where traditional ML pre-filters 
> traffic before LLM analysis. Sec-Llama [IEEE 2024] demonstrates domain-specific 
> fine-tuning of Llama-2-7B for security tasks. However, none of these approaches 
> incorporate persistent memory for temporal correlation..."

### Methodology Section:
> "Our architecture employs Retrieval-Augmented Generation (RAG) [Lewis et al., 2020] 
> to integrate historical context into LLM prompts. Flow summaries are embedded using 
> Sentence-BERT [Reimers & Gurevych, 2019] and stored in ChromaDB for efficient 
> semantic retrieval..."

---

**Keep this file updated as you find new papers during your research!**
