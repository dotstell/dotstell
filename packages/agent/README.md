# Dotstell Local AI Agent

**Version 1.1.0** · Zero dependencies · Node.js 18+

The Local AI Agent is a tiny HTTP proxy that runs on your machine and bridges the gap between the live dotstell.app web app and a local [Ollama](https://ollama.com) instance. The hosted app runs over `https://` — modern browsers block it from fetching `http://localhost` directly (Private Network Access spec). The agent adds the required headers and proxies everything to Ollama transparently.

> **You do not need the agent when running dotstell locally** (`localhost:3000` or `localhost:3100`). PNA restrictions only apply when using the live app at `dotstell.app`.

---

## Usage with dotstell.app

Follow these steps in order — skipping step 1 or 2 is the most common reason the agent shows a warning instead of a green badge.

**Step 1 — Install and start Ollama**

Download Ollama from [ollama.com](https://ollama.com) if you haven't already, then make sure it is running:

- **Windows:** Ollama usually auto-starts as a background service. Open `http://127.0.0.1:11434` in your browser — if it shows "Ollama is running" you're ready. If not, find **Ollama** in the Start Menu and launch it, or run `ollama serve` in a terminal.
- **macOS / Linux:** Run `ollama serve` if it isn't already running in the background.

> **Windows tip:** If `ollama serve` returns `bind: Only one usage of each socket address`, Ollama is already running — skip this step entirely.

**Step 2 — Pull a model** *(first time only)*

Dotstell needs two model types — one for chat/writing and one for semantic search (RAG). Pull one from each column:

| Purpose | Model | Size | Notes |
|---|---|---|---|
| **Chat** | `phi4-mini` | 3.8B | Best reasoning at small size, fast on CPU — recommended starting point |
| **Chat** | `qwen2.5:3b` | 3B | Strong and multilingual |
| **Chat** | `llama3.2` | 3B | Reliable all-rounder |
| **Chat** | `deepseek-r1:7b` | 7B | Best reasoning quality — needs a GPU |
| **Chat** | `qwen2.5:7b` | 7B | Excellent quality + multilingual — needs a GPU |
| **Embeddings** | `nomic-embed-text` | — | Required for semantic search and Related Notes |

```bash
ollama pull phi4-mini
ollama pull nomic-embed-text
```

> **No GPU?** Stick to 3–4B models (`phi4-mini`, `qwen2.5:3b`, `llama3.2`). 7B models are slow on CPU alone.

**Step 3 — Start the Dotstell Local AI Agent**

You do not need to clone this repo. Run directly via npx (Node.js 18+ required):

```bash
npx @dotstell/agent
```

Keep this terminal window open while you use Ollama in dotstell. The agent runs on `http://127.0.0.1:12345` and is loopback-only — not reachable from outside your machine. You should see a green `✓ Ollama is running` line in the output — if you see yellow `⚠ Ollama not detected` instead, go back to Step 1.

**Step 4 — Open dotstell.app → AI Settings → choose Ollama (Local)**

The settings modal shows a green **"Local Agent is running"** badge when the agent is detected. All AI features — Chat, Writing Assistant, Inline Assist, Summaries, Person Intelligence, AI Digest — route through the agent automatically.

---

## Run options

**npx** (no install required):

```bash
npx @dotstell/agent
```

**Single file download** (no npm):

```bash
curl -o dotstell-agent.mjs https://raw.githubusercontent.com/dotstell/dotstell/main/packages/agent/index.mjs
node dotstell-agent.mjs
```

**From a cloned repo:**

```bash
node packages/agent/index.mjs
# or: cd packages/agent && npm start
```

Expected output:

```
  ● dotstell  Local AI Agent v1.1.0

  Listening   http://127.0.0.1:12345
  Proxying    http://127.0.0.1:11434   ✓ Ollama is running

  App     https://dotstell.app
  GitHub  https://github.com/dotstell/dotstell  · ★ star if it's useful

  ────────────────────────────────────────────────
  Keep this running while using Ollama · Ctrl+C to stop
  ────────────────────────────────────────────────
```

> Output is color-coded in terminals that support ANSI colors. `✓ Ollama is running` appears in green; `⚠ Ollama not detected` appears in yellow if Ollama isn't up yet.

Verify the agent is running at [http://127.0.0.1:12345/health](http://127.0.0.1:12345/health) — returns a JSON health object including Ollama reachability status.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DOTSTELL_AGENT_PORT` | `12345` | Port the agent listens on |
| `OLLAMA_HOST` | `127.0.0.1` | Hostname of your Ollama instance |
| `OLLAMA_PORT` | `11434` | Port of your Ollama instance |

Example with a custom Ollama port:

```bash
OLLAMA_PORT=12000 node packages/agent/index.mjs
```

---

## How it works

```
Browser (dotstell.app)
  │
  │  POST http://127.0.0.1:12345/api/chat
  │  Origin: https://dotstell.app
  │
  ▼
Dotstell Local Agent  (127.0.0.1:12345)
  │  1. Validates Origin against allow-list
  │  2. Handles OPTIONS preflight:
  │     Access-Control-Allow-Origin: https://dotstell.app
  │     Access-Control-Allow-Private-Network: true
  │  3. Strips Origin/Referer headers before proxying
  │  4. Forwards request verbatim to Ollama
  │  5. Copies Ollama response, replaces CORS headers with own
  │
  ▼
Ollama  (127.0.0.1:11434)
  │
  └── Model inference
```

**Streaming:** Ollama's streaming responses (NDJSON from `/api/chat`) are forwarded chunk-by-chunk. The agent does not buffer the full response — latency is identical to calling Ollama directly.

**`/health` endpoint:** Returns `{ status: "ok", version: "1.0.0", ollama: true|false }`. The `ollama` field reflects whether the agent was able to reach Ollama at startup. The dotstell app polls this endpoint (with a 2-second timeout) to detect whether the agent is running before sending any AI requests.

---

## Why does this exist?

Modern browsers enforce the **Private Network Access (PNA)** specification (Chrome 115+, Firefox 120+). It blocks any `https://` page from making direct requests to `http://localhost` or `http://127.0.0.1` — even if Ollama is running fine and CORS is configured — unless the local server explicitly returns:

```
Access-Control-Allow-Private-Network: true
```

Ollama does not currently return this header. Without it, every chat request from `dotstell.app` to your local Ollama fails silently in the browser with a CORS/PNA error.

The Local Agent runs on `http://127.0.0.1:12345` (a permitted local address), accepts requests from dotstell origins, adds the required PNA header, and proxies everything to Ollama transparently.

---

## Security

The agent is designed to be safe to run persistently in the background:

- **Loopback only** — binds to `127.0.0.1`, never `0.0.0.0`. It is not reachable from other machines on your network.
- **Origin allow-list** — only requests from `https://dotstell.app`, `https://dotstell.com`, `https://*.vercel.app`, and localhost origins are accepted. All other origins receive a 403.
- **No credentials stored** — the agent never sees your AI provider API keys. Those are sent directly from your browser to the cloud providers (OpenAI, Gemini, etc.) over TLS.
- **No npm dependencies** — the entire agent is a single `index.mjs` file using only Node.js built-ins (`node:http`). No supply chain attack surface.
- **SSRF prevention** — only proxies to the configured Ollama host (default `127.0.0.1`). The target is not controllable by the browser request.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ollama serve` → `bind: Only one usage of each socket address` | Ollama is already running (Windows auto-start) | This is fine — skip `ollama serve` and just start the agent |
| Agent starts but "fetch failed" in app | Ollama is not running | Run `ollama serve` or check the system tray for the Ollama icon |
| "model not found" error | Model not pulled | Run `ollama pull <model-name>` |
| Agent not detected in AI Settings | Port 12345 in use | Set `DOTSTELL_AGENT_PORT=12346` and restart |
| CORS error despite agent running | App is on a non-allowed origin (e.g. custom domain) | The origin allow-list only covers known dotstell origins; file a GitHub issue |

---

## Package details

```json
{
  "name": "@dotstell/agent",
  "version": "1.1.0",
  "bin": { "dotstell-agent": "./index.mjs" },
  "engines": { "node": ">=18" }
}
```

If you have the repo cloned, you can install the binary globally: `npm install -g packages/agent` (from the repo root) and then start it with `dotstell-agent` from anywhere.
