#!/usr/bin/env python3
"""Base agent class with retry, cost tracking, and structured JSON output.

Supports two LLM providers:
  - "anthropic" (default): Claude models via anthropic SDK
  - "openai": GPT models via openai SDK
"""

import json
import os
import re
import time

import anthropic


class BaseAgent:
    """Base class for all NIDS specialist agents.

    Provides:
    - LLM calling with retry (3 attempts, exponential backoff)
    - Per-call and cumulative cost tracking
    - JSON response parsing from LLM output
    - Multi-provider support (Anthropic, OpenAI)
    """

    # Per-model pricing (input, output) per token
    MODEL_PRICING = {
        # Anthropic
        "claude-sonnet-4-20250514": (3.0 / 1e6, 15.0 / 1e6),
        "claude-haiku-3-5-20251001": (0.80 / 1e6, 4.0 / 1e6),
        # OpenAI
        "gpt-4o-mini": (0.15 / 1e6, 0.60 / 1e6),
        "gpt-4o": (2.50 / 1e6, 10.0 / 1e6),
    }
    COST_INPUT = 3.0 / 1_000_000    # default fallback (Sonnet)
    COST_OUTPUT = 15.0 / 1_000_000

    def __init__(self, model: str, api_key: str, agent_name: str,
                 provider: str = "anthropic"):
        self.model = model
        self.provider = provider
        self.agent_name = agent_name

        # Initialize provider-specific client
        if provider == "openai":
            import openai
            openai_key = os.getenv("OPENAI_API_KEY") or api_key
            self.client = openai.OpenAI(api_key=openai_key, timeout=120.0)
        else:
            self.client = anthropic.Anthropic(api_key=api_key, timeout=120.0)

        # Set pricing based on model
        pricing = self.MODEL_PRICING.get(model)
        if pricing:
            self.COST_INPUT, self.COST_OUTPUT = pricing

        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost = 0.0
        self.call_count = 0

    def call_llm(self, system_prompt: str, user_prompt: str, max_retries: int = 3) -> dict:
        """Call the LLM with retry and exponential backoff.

        Returns dict with keys: text, input_tokens, output_tokens, cost.
        On failure after all retries, includes 'error' key.
        """
        if self.provider == "openai":
            return self._call_openai(system_prompt, user_prompt, max_retries)
        return self._call_anthropic(system_prompt, user_prompt, max_retries)

    def _call_anthropic(self, system_prompt: str, user_prompt: str, max_retries: int) -> dict:
        last_error = None
        for attempt in range(max_retries):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=4096,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                )
                input_tokens = response.usage.input_tokens
                output_tokens = response.usage.output_tokens
                cost = input_tokens * self.COST_INPUT + output_tokens * self.COST_OUTPUT

                self.total_input_tokens += input_tokens
                self.total_output_tokens += output_tokens
                self.total_cost += cost
                self.call_count += 1

                text = "".join(
                    b.text for b in response.content if hasattr(b, "text")
                )

                return {
                    "text": text,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cost": cost,
                }
            except anthropic.RateLimitError as e:
                last_error = e
                wait = 2 ** attempt * 5
                time.sleep(wait)
            except anthropic.APIError as e:
                last_error = e
                if attempt == max_retries - 1:
                    break
                wait = 2 ** attempt * 2
                time.sleep(wait)
            except Exception as e:
                last_error = e
                break

        return {
            "text": "",
            "input_tokens": 0,
            "output_tokens": 0,
            "cost": 0.0,
            "error": str(last_error),
        }

    def _call_openai(self, system_prompt: str, user_prompt: str, max_retries: int) -> dict:
        import openai

        last_error = None
        for attempt in range(max_retries):
            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    max_tokens=4096,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                )
                input_tokens = response.usage.prompt_tokens
                output_tokens = response.usage.completion_tokens
                cost = input_tokens * self.COST_INPUT + output_tokens * self.COST_OUTPUT

                self.total_input_tokens += input_tokens
                self.total_output_tokens += output_tokens
                self.total_cost += cost
                self.call_count += 1

                text = response.choices[0].message.content or ""

                return {
                    "text": text,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cost": cost,
                }
            except openai.RateLimitError as e:
                last_error = e
                wait = 2 ** attempt * 5
                time.sleep(wait)
            except openai.APIError as e:
                last_error = e
                if attempt == max_retries - 1:
                    break
                wait = 2 ** attempt * 2
                time.sleep(wait)
            except Exception as e:
                last_error = e
                break

        return {
            "text": "",
            "input_tokens": 0,
            "output_tokens": 0,
            "cost": 0.0,
            "error": str(last_error),
        }

    @staticmethod
    def parse_json_response(text: str) -> dict | None:
        """Extract JSON from LLM response text.

        Tries in order: markdown code block, raw JSON, embedded JSON object.
        Returns None if no valid JSON found.
        """
        # Try markdown code block
        json_match = re.search(r'```(?:json)?\s*\n(.*?)\n```', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Try raw JSON (whole text)
        stripped = text.strip()
        if stripped.startswith('{'):
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                pass

        # Try to find the largest top-level JSON object in text
        depth = 0
        start = None
        best = None
        for i, ch in enumerate(text):
            if ch == '{':
                if depth == 0:
                    start = i
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0 and start is not None:
                    candidate = text[start:i + 1]
                    try:
                        parsed = json.loads(candidate)
                        if best is None or len(candidate) > len(best[1]):
                            best = (parsed, candidate)
                    except json.JSONDecodeError:
                        pass
                    start = None

        if best is not None:
            return best[0]

        return None

    def analyze(self, flow_data: dict, **kwargs) -> dict:
        """Override in subclass. Analyze a flow and return structured result."""
        raise NotImplementedError

    def _make_error_result(self, error_msg: str) -> dict:
        """Standard error result format."""
        return {
            "verdict": "ERROR",
            "confidence": 0.0,
            "attack_type": None,
            "reasoning": error_msg,
            "key_findings": [],
            "tokens": {"input": 0, "output": 0},
            "cost": 0.0,
        }

    def _finalize_result(self, parsed: dict, llm_result: dict) -> dict:
        """Attach token/cost metadata to a parsed result."""
        parsed.setdefault("verdict", "SUSPICIOUS")
        parsed.setdefault("confidence", 0.3)
        parsed.setdefault("attack_type", None)
        parsed.setdefault("reasoning", "")
        parsed.setdefault("key_findings", [])
        parsed["tokens"] = {
            "input": llm_result["input_tokens"],
            "output": llm_result["output_tokens"],
        }
        parsed["cost"] = llm_result["cost"]
        return parsed

    def get_stats(self) -> dict:
        return {
            "agent_name": self.agent_name,
            "provider": self.provider,
            "model": self.model,
            "call_count": self.call_count,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_cost": self.total_cost,
        }
