# LX-OS Hub — Vocode Voice Integration

Adds a voice interface to LX-OS Hub. Users can search the prompt library, execute prompts, and check benchmark scores via phone call or WebRTC voice chat.

## Architecture

```
Phone call / WebRTC
       ↓
   Vocode Cloud  (speech-to-text + LLM + text-to-speech)
       ↓
  server.py  (FastAPI — function call dispatcher)
       ↓
  agent.py   (LX-OS Hub API client)
       ↓
  LX-OS Hub API  (localhost:8000 or production URL)
```

## Setup

### 1. Install dependencies

```bash
cd integrations/vocode
pip install vocode fastapi uvicorn python-dotenv requests
```

### 2. Configure environment

```bash
export LXOS_HUB_API_BASE=http://localhost:8000
export LXOS_HUB_API_KEY=lxos_sess_YOUR_TOKEN
export VOCODE_API_KEY=your_vocode_api_key     # from app.vocode.dev
```

### 3. Start the voice server

```bash
python server.py
# Listening on http://0.0.0.0:3001
```

### 4. Connect Vocode to your server

In the [Vocode Dashboard](https://app.vocode.dev):

1. Create a new **Outbound Agent** or **Inbound Agent**
2. Set **Function Call URL** to: `https://YOUR_PUBLIC_URL/vocode/function-call`
3. Set **Agent Config URL** to: `https://YOUR_PUBLIC_URL/vocode/agent-config`

For local dev, use `ngrok http 3001` to get a public URL.

## Voice Commands (examples)

| You say | What happens |
|---|---|
| "Search for email prompts" | Calls `search_prompts("email")`, reads top 5 |
| "Tell me about that first prompt" | Calls `get_prompt_info(id)` |
| "Run it with topic set to machine learning" | Calls `run_prompt(id, {topic: "machine learning"})` |
| "What benchmarks do I have?" | Calls `list_benchmarks()` |
| "Give me some recommendations" | Calls `get_recommendations()` |
| "Is the hub online?" | Calls `health_check()` |

## Phone Integration (Twilio)

1. Buy a phone number on [Twilio](https://twilio.com)
2. Set the webhook URL to: `https://YOUR_PUBLIC_URL/twilio/inbound`
3. Set `TWILIO_NGROK_URL` env var to your public URL
4. Call your Twilio number — it connects to the voice agent

## WebRTC (Browser)

Use the [Vocode React SDK](https://docs.vocode.dev/open-source/react-sdk) to embed a voice button in the Hub frontend:

```tsx
import { VoiceWidget } from '@vocode/vocode-react-sdk';

<VoiceWidget
  config={{
    agentConfigUrl: 'http://localhost:3001/vocode/agent-config',
    functionCallUrl: 'http://localhost:3001/vocode/function-call',
  }}
/>
```

Add this to `services/web/app/_components/VoiceAssistant.tsx` and import in the Shell.
