# Dotstell Local AI Agent

**Version 1.1.0** · Zero dependencies · Node.js 18+

The Local AI Agent is a tiny HTTP proxy that runs on your machine and bridges the gap between the live dotstell.app web app and a local [Ollama](https://ollama.com) instance.

---

## Why does this exist?

Modern browsers enforce the **Private Network Access (PNA)** specification (Chrome 115+, Firefox 120+). It blocks any `https://` page from making direct requests to `http://localhost` or `http://127.0.0.1` — even if Ollama is running fine and CORS is configured — unless the local server explicitly returns:

```
Access-Control-Allow-Private-Network: true
```

Ollama does not currently return this header. Without it, every chat request from `dotstell.app` to your local Ollama fails silently in the browser with a CORS/PNA error.

The Local Agent runs on `http://127.0.0.1:12345` (a permitted local address), accepts requests from dotstell origins, adds the required PNA header, and proxies everything to Ollama transparently.

**You do not need the agent when running dotstell locally** (`localhost:3000` or `localhost:3100`). PNA restrictions only apply when the web page is served over `https://`. The agent is only needed when using Ollama with the live app at `dotstell.app`.

---

## Quick start

**You do not need to clone the dotstell repo.** Run directly via npx:

```bash
npx @dotstell/agent
```

Or download the single file if you prefer not to use npm:

```bash
curl -o dotstell-agent.mjs https://raw.githubusercontent.com/dotstell/dotstell/main/packages/agent/index.mjs
node dotstell-agent.mjs
```

If you already have the repo cloned, run it from the repo root instead:

```bash
node packages/agent/index.mjs
# or: cd packages/agent && npm start
```

You should see:

```
Dotstell Local AI Agent v1.0.0 listening on http://127.0.0.1:12345
Proxying to Ollama at http://127.0.0.1:11434
```

Verify it is running by visiting [http://127.0.0.1:12345/health](http://127.0.0.1:12345/health) — it returns a JSON health object including the Ollama reachability status.

---

## Usage with dotstell.app

1. Make sure Ollama is running. On Windows it usually auto-starts — check `http://127.0.0.1:11434` in a browser. If it shows "Ollama is running" you can skip `ollama serve`. If not: `ollama serve`
2. Pull a model if you haven't: `ollama pull llama3.2` (or any model you want to use)
3. Start the agent: `npx @dotstell/agent` (or `node dotstell-agent.mjs` / `node packages/agent/index.mjs`)
4. Open [dotstell.app](https://dotstell.app) → AI Settings → choose **Ollama (Local)**
5. The settings modal shows a green "Local Agent is running" badge when it detects the agent on port 12345

The app checks for the agent automatically whenever Ollama is selected as the provider. All AI features — Chat, Assist, Summarize, Person Intelligence, AI Digest, embeddings — route through the agent when on the live app.

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
