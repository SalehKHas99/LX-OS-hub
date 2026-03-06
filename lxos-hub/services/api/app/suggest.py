"""
Suggestion engine: lint-only (deterministic) + optional LLM-assisted.
All suggestions are stored for auditability.
"""
import json
from app.dsl import parse, validate
from app.config import OPENAI_API_KEY, ANTHROPIC_API_KEY, llm_provider

SAFE_TRANSFORMS = [
    "tighten_constraints_clarity",
    "add_assumptions_section",
    "add_refusal_templates",
    "add_format_guardrails",
    "shorten_output_to_Z1",
    "reorder_pipeline_for_verification",
]

FORBIDDEN_TRANSFORMS = [
    "weaken_safety_rules",
    "add_stealth_instructions",
    "bypass_prism",
    "claim_tool_without_node",
]


def run_lint(dsl_yaml: str) -> list[dict]:
    """Run deterministic lint rules. Returns suggestion list."""
    try:
        dsl = parse(dsl_yaml)
        return validate(dsl)
    except ValueError as e:
        return [{"severity": "error", "id": "parse_error", "title": "YAML parse error",
                 "rationale": str(e), "patch": None}]


def run_llm_suggestions(dsl_yaml: str, goal: str = "") -> list[dict]:
    """
    Call LLM to suggest improvements. Returns parsed suggestion list.
    Falls back to empty list if no provider available.
    """
    provider = llm_provider()
    if provider == "simulated":
        return [{"severity": "info", "id": "llm_unavailable",
                 "title": "LLM suggestions unavailable",
                 "rationale": "No OPENAI_API_KEY or ANTHROPIC_API_KEY configured. Lint-only mode active.",
                 "patch": None}]

    system_prompt = """You are an expert LX-OS prompt system auditor.
Given a DSL YAML prompt system, suggest concrete improvements.
Respond ONLY with a JSON array of suggestion objects with keys:
  id (snake_case), severity (info|warning|error), title, rationale, patch (null or object).
Focus on: safety rails, pipeline completeness, output clarity, assumption hygiene.
NEVER suggest weakening safety constraints or bypassing verification."""

    user_content = f"Goal: {goal or 'improve reliability and clarity'}\n\nDSL:\n{dsl_yaml}"

    try:
        import requests as http
        if provider == "anthropic":
            from app.config import ANTHROPIC_API_KEY
            resp = http.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json"},
                json={"model": "claude-haiku-4-5-20251001", "max_tokens": 1024,
                      "system": system_prompt,
                      "messages": [{"role": "user", "content": user_content}]},
                timeout=20,
            )
            text = resp.json()["content"][0]["text"]
        else:
            from app.config import OPENAI_API_KEY
            resp = http.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
                json={"model": "gpt-4o-mini", "max_tokens": 1024,
                      "messages": [{"role": "system", "content": system_prompt},
                                   {"role": "user", "content": user_content}]},
                timeout=20,
            )
            text = resp.json()["choices"][0]["message"]["content"]

        # Strip markdown fences
        clean = text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        suggestions = json.loads(clean)
        # Safety filter: never return suggestions that weaken safety
        return [s for s in suggestions if not any(ft in str(s).lower() for ft in FORBIDDEN_TRANSFORMS)]
    except Exception as e:
        return [{"severity": "info", "id": "llm_error", "title": "LLM suggestion failed",
                 "rationale": str(e), "patch": None}]


def get_suggestions(dsl_yaml: str, mode: str = "lint_only", goal: str = "") -> list[dict]:
    lint = run_lint(dsl_yaml)
    if mode == "lint_plus_llm":
        llm = run_llm_suggestions(dsl_yaml, goal)
        # Deduplicate by id
        seen = {s["id"] for s in lint}
        llm_new = [s for s in llm if s["id"] not in seen]
        return lint + llm_new
    return lint
