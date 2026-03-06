"""
LX-OS Hub — Vocode Voice Server

Exposes a FastAPI endpoint that Vocode calls with function_call requests.
Also provides a WebRTC demo endpoint and an inbound Twilio webhook.

Run:
    pip install vocode fastapi uvicorn python-dotenv
    python server.py

Environment:
    LXOS_HUB_API_BASE   = http://localhost:8000
    LXOS_HUB_API_KEY    = lxos_sess_...
    VOCODE_API_KEY       = your_vocode_key
    HOST_PORT            = 3001
"""
import json
import os
from typing import Any

import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from agent import dispatch_tool, SYSTEM_PROMPT

app = FastAPI(title="LX-OS Hub Voice Agent", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Vocode SDK origin — tighten in production
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# ── Vocode function call handler ─────────────────────────────

@app.post("/vocode/function-call")
async def handle_function_call(request: Request) -> JSONResponse:
    """
    Vocode sends function call requests here when the LLM decides to use a tool.
    Format: { "name": "search_prompts", "arguments": {"query": "summarizer"} }
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(400, "Invalid JSON body")

    tool_name = body.get("name", "")
    raw_args  = body.get("arguments", {})

    # Arguments may arrive as a JSON string (from some Vocode versions)
    if isinstance(raw_args, str):
        try:
            args = json.loads(raw_args)
        except Exception:
            args = {}
    else:
        args = raw_args

    result = dispatch_tool(tool_name, args)
    return JSONResponse({"result": result})


# ── Vocode agent config endpoint ─────────────────────────────

@app.get("/vocode/agent-config")
def get_agent_config() -> dict[str, Any]:
    """
    Returns the Vocode agent configuration.
    Used when initializing a Vocode conversation programmatically.
    """
    return {
        "type":           "agent_config",
        "initial_message": "Hello! I'm your LX-OS Hub assistant. I can search your prompt library, run prompts, and check benchmark scores. What would you like to do?",
        "prompt": {
            "content": SYSTEM_PROMPT,
        },
        "functions": [
            {
                "name": "search_prompts",
                "description": "Search the LX-OS Hub prompt library by keyword",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Search query" },
                        "limit": { "type": "integer", "description": "Max results (default 5)", "default": 5 },
                    },
                    "required": ["query"],
                },
            },
            {
                "name": "run_prompt",
                "description": "Execute a prompt version and return the output",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "prompt_version_id": { "type": "string", "description": "The prompt version UUID to run" },
                        "inputs": { "type": "object", "description": "Optional input variables as key-value pairs" },
                    },
                    "required": ["prompt_version_id"],
                },
            },
            {
                "name": "get_prompt_info",
                "description": "Get detailed information about a specific prompt",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "prompt_id": { "type": "string", "description": "The prompt UUID" },
                    },
                    "required": ["prompt_id"],
                },
            },
            {
                "name": "get_recommendations",
                "description": "Get personalized prompt recommendations based on run history",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": { "type": "integer", "description": "Number of recommendations", "default": 3 },
                    },
                },
            },
            {
                "name": "list_benchmarks",
                "description": "List all available benchmark suites",
                "parameters": { "type": "object", "properties": {} },
            },
            {
                "name": "health_check",
                "description": "Check if the LX-OS Hub API is online",
                "parameters": { "type": "object", "properties": {} },
            },
        ],
    }


# ── Health ────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "lxos-hub-voice-agent"}


# ── Twilio inbound webhook (optional) ────────────────────────

@app.post("/twilio/inbound")
async def twilio_inbound(request: Request) -> str:
    """
    Twilio calls this when someone calls your phone number.
    Returns TwiML that connects the call to the Vocode agent.

    Set TWILIO_NGROK_URL to your public-facing URL.
    """
    ngrok = os.getenv("TWILIO_NGROK_URL", "https://your-ngrok-url.ngrok.io")
    # Returns TwiML XML — Twilio streams audio to Vocode's WebSocket
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://{ngrok.replace('https://','')}/vocode/stream" />
  </Connect>
</Response>"""


if __name__ == "__main__":
    port = int(os.getenv("HOST_PORT", "3001"))
    print(f"LX-OS Hub Voice Agent running on http://0.0.0.0:{port}")
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
