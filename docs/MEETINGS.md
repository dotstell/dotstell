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
| Dictation | `src/hooks/useDictation.ts`, `src/components/editor/DictationBar.tsx` | Browser `SpeechRecognition`. Text is inserted as a text node, never parsed as HTML. First use shows a notice about where the audio goes. |
| Recording | `src/hooks/useRecorder.ts`, `src/lib/voice/transcribe.ts` | `MediaRecorder` in 5-minute pieces (optionally mixing in shared-tab audio), each sent from the browser to OpenAI or Groq with the user's own key. Audio is held in memory only until its piece is transcribed. |

## Decisions

- **Speech-to-text goes browser to provider, not through the server.** It keeps audio off dotstell's servers and avoids Vercel's 4.5 MB request limit. This needs `https://api.openai.com` and `https://api.groq.com` in `connect-src` and `microphone=(self)` in `Permissions-Policy` (`next.config.ts`).
- **Summaries use the AI settings the user already has**, through the existing `/api/ai/*` pattern (config sent per request, never stored).
- **Anthropic, Gemini and Ollama have no transcription API**, so recording needs an OpenAI or Groq key. Pasting, files and dictation work with any provider.
- **macOS desktop** needs `NSMicrophoneUsageDescription`; it is in `src-tauri/Info.plist`.

## Not done

- Local Whisper in the desktop app.
- A Zoom account connection (OAuth, webhooks). Importing the transcript file covers most of the value.
- Speaker labels for recordings (the speech service does not return them).
