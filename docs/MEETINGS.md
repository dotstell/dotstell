# Meetings and voice

How the Meeting assistant, dictation and recording work, for contributors.

## Parts

| Part | Where | Notes |
|---|---|---|
| Transcript reader | `src/lib/meetings/transcript.ts` | Pure functions. Reads WebVTT and SubRip (Zoom, Teams, Meet), Zoom audio-transcript and chat files, and plain text into `Speaker: text` lines. Strips markup. `chunkTranscript` splits on line boundaries. |
| Digest | `src/lib/meetings/digest.ts` | Reads a model reply into `{ summary, keyPoints, decisions, actionItems, openQuestions }`. The reply is untrusted: first complete JSON object only, every field type-checked and size-limited. `digestToHtml` escapes everything it writes into the note. |
| Orchestration | `src/lib/meetings/run.ts` | Client side. One request per chunk (so each stays inside the 60 s function limit), one retry per request, then a combine request; if combining fails the parts are merged locally. Supports cancel. |
| API | `src/app/api/ai/meeting/route.ts` | `mode: 'chunk'` or `'combine'`. Requires a signed-in user, rate limited, validates sizes, re-parses parts before combining. Returns `{ digest }`. |
| Panel | `src/components/ai/AIMeetingPanel.tsx` | Input, progress, review. Creates tasks through the normal `/api/tasks` and `/api/links` routes, only when the user presses the button. |
| Dictation | `src/hooks/useDictation.ts`, `src/lib/voice/dictation-assembler.ts`, `src/components/editor/DictationBar.tsx` | Browser `SpeechRecognition`. Android Chrome sends a new result for every update of a phrase, all marked final with confidence 0 and with words revised between them, and only the last with a real confidence. The assembler treats confidence 0 as a live guess: `src/lib/voice/live-text.ts` shows it in the note as provisional text and replaces that text in place on every update (so revised words correct themselves), and the confident result, or a pause (6 s), the end of the session or stop, makes it final. It also drops text a result repeats from earlier, at word boundaries and tolerating a revised word. The bar (`DictationBar`) is one slim row that can be dragged and keeps its place (`dotstell:dictation-bar-bottom`); it reports where it is through `src/lib/voice/layout.ts` so `live-text` can scroll the words being dictated clear of it. The provisional text is tinted by a decoration (`DictationHighlightExtension`), which is never saved with the note. Only the newest session is listened to. `RichTextEditor` ignores its own changes when they come back through the `content` prop (they can be a render out of date), so quick insertions are never rolled back. Open a note with `?dictationDebug` to see the raw events on the device. Text is inserted as a text node, never parsed as HTML. First use shows a notice about where the audio goes. |
| Dictation formatting | `src/lib/voice/format-dictation.ts`, `src/lib/voice/live-text.ts` | Fast engine only, English only (the language starts with `en`). `formatDictation(text, before, {spoken, lang})` reads comma, question mark, exclamation mark/point, full stop, new line and new paragraph anywhere in a phrase, and `period` only at the end of a phrase or alone (not after words like "the" or "time"). It then capitalises after `. ? !` and a line break, at the start of a paragraph (`before` is the paragraph text up to the insertion point) and the word I. `live-text` applies it to the provisional text (a line break shows as a space) and to the final text, where each line break becomes a new paragraph with `splitBlock`. Spoken punctuation is a toggle in the bar (`dotstell:dictation-spoken`, on by default). High accuracy text is not changed. |
| High accuracy dictation | `src/hooks/useAccurateDictation.ts`, `src/lib/voice/segmenter.ts`, `src/lib/voice/transcript-filter.ts` | The second dictation engine, chosen in the bar's options (`dotstell:dictation-engine`). Records the microphone, reads its loudness every 50 ms and cuts at pauses (`createSegmenter`: 700 ms of quiet after speech, 250 ms once a piece passes 18 s, never beyond 28 s; the background level is the quietest moment of the last 4 s so a steady hum is not speech). A new `MediaRecorder` is started before the old one is stopped so no sound falls between pieces, and a piece without enough voice is never sent. Pieces are transcribed one after another (`transcribeAudio` with `language` and the last 200 characters of text as `prompt`), retried once, and inserted in order through the same `live-text` commit path. `cleanTranscript` drops text made up for near-silence ("Thank you.") and an echoed prompt. A rejected key stops the run. Uses the key from `transcriptionTarget`, like Recording. |
| Recording | `src/hooks/useRecorder.ts`, `src/lib/voice/transcribe.ts` | `MediaRecorder` in 5-minute pieces (optionally mixing in shared-tab audio), each sent from the browser to OpenAI or Groq with the user's own key. Audio is held in memory only until its piece is transcribed. |

## Decisions

- **Speech-to-text goes browser to provider, not through the server.** It keeps audio off dotstell's servers and avoids Vercel's 4.5 MB request limit. This needs `https://api.openai.com` and `https://api.groq.com` in `connect-src` and `microphone=(self)` in `Permissions-Policy` (`next.config.ts`).
- **Summaries use the AI settings the user already has**, through the existing `/api/ai/*` pattern (config sent per request, never stored).
- **Anthropic and Ollama have no transcription API.** Recording uses, in order: a speech key chosen on its own (stored as `dotstell-stt-config` in this browser, set in the recording box), the chat provider when it is OpenAI, Groq or Gemini, or an OpenAI embeddings key. Gemini audio is converted to 16 kHz WAV in the browser first (`src/lib/voice/wav.ts`), because Gemini does not accept WebM. Pasting, files and dictation work with any provider.
- **macOS desktop** needs `NSMicrophoneUsageDescription`; it is in `src-tauri/Info.plist`.

## Not done

- Local Whisper in the desktop app.
- A Zoom account connection (OAuth, webhooks). Importing the transcript file covers most of the value.
- Speaker labels for recordings (the speech service does not return them).

## Providers

| Provider | Summaries | Asks for JSON | Speech-to-text |
|---|---|---|---|
| OpenAI | yes | `response_format` (not sent to `o1-mini`/`o1-preview`) | `whisper-1` |
| Groq | yes | `response_format`, low temperature | `whisper-large-v3-turbo` |
| Gemini | yes | `responseMimeType: application/json` | `generateContent` with inline WAV (not yet tried against the live service) |
| Anthropic | yes | no mode; the prompt asks for JSON and the reader is lenient | no, add a separate key |
| Ollama | yes | `format: json` (browser) / `response_format` (server), low temperature | no, add a separate key |

- If a provider or model rejects JSON mode with a 400, the server route asks again without it.
- **Ollama on the live site:** the dotstell server cannot reach the user's computer, so `AIMeetingPanel` and `AIWritingPanel` call Ollama from the browser (through the Local AI Agent) when `provider === 'ollama' && !isLocalHostname()`. On localhost, or when self-hosting, the server route is used.
- **Reasoning models (Qwen 3.5, Gemma 4 and similar):** they think before answering, and the thinking is counted in the reply limit (`num_predict` 2048), so by default `qwen3.5:4b` returned an empty reply on every meeting test. `ollamaChatBody` (browser, native `/api/chat`) sends `think: false` and the server route (`/v1/chat/completions`) sends `reasoning_effort: "none"` — the native API ignores the second and the `/v1` API ignores the first. Both retry once without the setting if Ollama answers 400 about it. The browser also asks for `num_ctx` 8192 on every request (Meetings still sets its own reply limit); the `/v1` API cannot set a context size. Measured on an RTX 2000 (8 GB) with four meeting cases (7 to 8 expected decisions, action items and open questions each, up to 8 model calls): `gemma4:e4b` thinking off scored full marks in 5 to 45 s; `qwen3.5:4b` off, full marks in 7 to 65 s; `phi4-mini` missed one item on each of the two harder cases (5 to 79 s); `gemma4:e4b` with thinking on was correct but about 3x slower.
- **Small models:** transcripts are cut into 1,500-character pieces for Ollama (9,000 for hosted models) and merged in groups of 8. In a test with `phi4-mini` (3.8B), 5,000-character pieces found 3 of 5 commitments, 1,500 found 4, and 800 found 4 to 5. The final action-item list is always the union of the parts, because a combine step can silently drop one.
- `OLLAMA_INTEGRATION=1 npx vitest run src/app/api/ai/ollama.integration.test.ts` runs the routes and the long-meeting pipeline against a real local Ollama (default model `phi4-mini`, set `OLLAMA_MODEL` to change it).

