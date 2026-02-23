"""Phase 3: Multi-Agent NIDS - 6 specialist agents with orchestrated consensus."""

from .base_agent import BaseAgent
from .protocol_agent import ProtocolAgent
from .statistical_agent import StatisticalAgent
from .behavioural_agent import BehaviouralAgent
from .temporal_agent import TemporalAgent
from .devils_advocate_agent import DevilsAdvocateAgent
from .orchestrator_agent import OrchestratorAgent

__all__ = [
    "BaseAgent",
    "ProtocolAgent",
    "StatisticalAgent",
    "BehaviouralAgent",
    "TemporalAgent",
    "DevilsAdvocateAgent",
    "OrchestratorAgent",
]
