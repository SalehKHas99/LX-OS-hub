"""
LX-OS Hub — Vocode Voice Agent Integration

Exposes LX-OS Hub capabilities as a voice agent:
- Search the prompt library by speaking
- Execute prompts by voice and hear the output
- Get benchmark scores read aloud
- Create new prompts from voice dictation

Requires:
    pip install vocode fastapi uvicorn

Set environment variables:
    LXOS_HUB_API_BASE   = http://localhost:8000
    LXOS_HUB_API_KEY    = lxos_sess_...
    VOCODE_API_KEY       = your_vocode_key
    TELEPHONY_PROVIDER   = twilio | vonage (optional for phone calls)
"""
import os
import json
import requests
from typing import Any

# ── LX-OS Hub API client ─────────────────────────────────────

LXOS_BASE = os.getenv("LXOS_HUB_API_BASE", "http://localhost:8000")
LXOS_KEY  = os.getenv("LXOS_HUB_API_KEY",  "")

def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if LXOS_KEY:
        h["Authorization"] = f"Bearer {LXOS_KEY}"
    return h

def lxos_get(path: str) -> Any:
    resp = requests.get(f"{LXOS_BASE}{path}", headers=_headers(), timeout=10)
    resp.raise_for_status()
    return resp.json()

def lxos_post(path: str, body: dict) -> Any:
    resp = requests.post(f"{LXOS_BASE}{path}", headers=_headers(), json=body, timeout=30)
    resp.raise_for_status()
    return resp.json()


# ── Agent Tools ───────────────────────────────────────────────
# Each tool maps to a Vocode function_call.
# The agent can call these by name during a conversation.

def tool_search_prompts(query: str, limit: int = 5) -> str:
    """Search the LX-OS Hub prompt library and return a voice-friendly summary."""
    try:
        data = lxos_get(f"/search?q={requests.utils.quote(query)}&mode=hybrid&limit={limit}")
        results = data.get("results", [])
        if not results:
            return f"I searched for {query} but found no matching prompts in the library."

        lines = [f"I found {len(results)} prompt{'s' if len(results) != 1 else ''} for {query}:"]
        for i, p in enumerate(results[:5], 1):
            score = f", benchmark score {p.get('aggregate_score', 0):.2f}" if p.get('aggregate_score') else ""
            lines.append(f"{i}. {p['title']}{score}.")
        return " ".join(lines)
    except Exception as e:
        return f"Sorry, I couldn't search the library right now. Error: {e}"


def tool_run_prompt(prompt_version_id: str, inputs: dict | None = None) -> str:
    """Execute a prompt version and return the output as text for the voice agent to read."""
    try:
        run_data = lxos_post("/runs", {
            "prompt_version_id": prompt_version_id,
            "model": "gpt-4o-mini",
            "inputs": inputs or {},
        })
        run_id = run_data.get("run_id") or run_data.get("id")
        if not run_id:
            return "I submitted the run but couldn't get a run ID back."

        # Poll for completion (max 30 seconds)
        import time
        for _ in range(30):
            time.sleep(1)
            result = lxos_get(f"/runs/{run_id}")
            status = result.get("status")
            if status == "succeeded":
                output = result.get("output_text", "")
                lat = result.get("latency_ms", 0)
                tokens = result.get("tokens_out", 0)
                # Trim for voice — max 500 chars
                if len(output) > 500:
                    output = output[:497] + "..."
                return f"Run completed in {lat} milliseconds. Here's the output: {output}"
            elif status in ("failed", "refused"):
                return f"The run {status}. Please check the Hub for details."

        return "The run is taking longer than expected. You can check the status in the Hub."
    except Exception as e:
        return f"I couldn't execute that prompt. Error: {e}"


def tool_get_prompt_info(prompt_id: str) -> str:
    """Get details about a prompt by ID and return a voice summary."""
    try:
        p = lxos_get(f"/prompts/{prompt_id}")
        score = f"It has a benchmark score of {p.get('aggregate_score', 0):.2f}." if p.get('aggregate_score') else ""
        forks = f"Forked {p.get('fork_count', 0)} times."
        rating = f"Average rating {float(p.get('avg_rating', 0)):.1f} out of 5." if p.get('avg_rating') else ""
        tags = f"Tags: {', '.join(p.get('tags', [])[:5])}." if p.get('tags') else ""
        return f"{p['title']}. {p.get('description', '')} {score} {forks} {rating} {tags}".strip()
    except Exception as e:
        return f"I couldn't find that prompt. Error: {e}"


def tool_get_recommendations(limit: int = 3) -> str:
    """Get personalized prompt recommendations and read them aloud."""
    try:
        data = lxos_get(f"/recommendations?limit={limit}")
        items = data.get("items", [])
        if not items:
            return "I don't have any recommendations for you right now."
        lines = ["Here are some prompts you might like:"]
        for i, p in enumerate(items[:3], 1):
            lines.append(f"{i}. {p['title']}.")
        return " ".join(lines)
    except Exception as e:
        return f"I couldn't fetch recommendations. Error: {e}"


def tool_list_benchmarks() -> str:
    """List available benchmarks."""
    try:
        benches = lxos_get("/benchmarks")
        if not benches:
            return "There are no benchmarks set up yet."
        names = [b["title"] for b in benches[:5]]
        return f"Available benchmarks: {', '.join(names)}."
    except Exception as e:
        return f"I couldn't list benchmarks. Error: {e}"


def tool_health_check() -> str:
    """Check if the Hub is online and which LLM provider is active."""
    try:
        h = lxos_get("/health")
        return f"LX-OS Hub is online, version {h.get('version', 'unknown')}, using the {h.get('provider', 'unknown')} provider."
    except Exception:
        return "LX-OS Hub appears to be offline or unreachable."


# ── Tool registry ─────────────────────────────────────────────

TOOLS: dict[str, callable] = {
    "search_prompts":      tool_search_prompts,
    "run_prompt":          tool_run_prompt,
    "get_prompt_info":     tool_get_prompt_info,
    "get_recommendations": tool_get_recommendations,
    "list_benchmarks":     tool_list_benchmarks,
    "health_check":        tool_health_check,
}


def dispatch_tool(tool_name: str, args: dict) -> str:
    """Dispatch a tool call from the Vocode agent."""
    fn = TOOLS.get(tool_name)
    if not fn:
        return f"Unknown tool: {tool_name}"
    try:
        return fn(**args)
    except TypeError as e:
        return f"Invalid arguments for {tool_name}: {e}"
    except Exception as e:
        return f"Tool error: {e}"


# ── System prompt for the voice agent ─────────────────────────

SYSTEM_PROMPT = """You are the LX-OS Hub voice assistant. You help users manage their AI prompt library using natural speech.

You have access to the following capabilities:
- search_prompts(query, limit): Search the prompt library
- run_prompt(prompt_version_id, inputs): Execute a prompt and hear the result
- get_prompt_info(prompt_id): Get details about a specific prompt
- get_recommendations(): Get personalized prompt recommendations
- list_benchmarks(): List available benchmark suites
- health_check(): Check if the Hub is online

Keep responses concise and natural for voice. Spell out IDs phonetically when reading them.
When a user asks to run a prompt, confirm the model and any required inputs before executing.
If you don't know a prompt version ID, search for the prompt first.
"""
