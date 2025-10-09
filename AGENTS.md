🧠 INTERVIEW ASSISTANT — FULL LOCAL BUILD SPEC (CLIENT-ONLY STREAM VERSION)
PURPOSE

Gumawa ng fully offline, local Interview Assistant app na:

Gumagamit lang ng client’s voice bilang input sa ASR

Gumagamit ng local Whisper (streaming) para sa real-time transcription

Gumagamit ng local Ollama LLM para sa sagot generation

May context-aware switching (Discovery → Technical Mode)

At nakalink bawat AI response sa exact transcript segment ng client

⚙️ CORE SYSTEM ARCHITECTURE
Component	Tool / Framework	Notes
Frontend	React + TypeScript + TailwindCSS	Electron Renderer
Backend	Electron Main Process	Controls audio & LLM flow
Speech-to-Text (ASR)	Local Whisper (faster-whisper or whisper.cpp in streaming mode)	Client-only voice stream
LLM Engine	Ollama (mistral, llama3, or phi3-mini)	All offline
Storage	SQLite + electron-store	Transcript + response logs
Knowledge System	Local file-based + JSON in-memory cache	/knowledge/permanent + /knowledge/project
🎧 AUDIO & TRANSCRIPTION FLOW
Design

Single-speaker, client-only capture.
AI will not transcribe user/developer speech.

System Audio (client)
  ↓
AudioWorkletNode
  ↓
Whisper Stream (512ms buffer)
  ↓
Transcript Segment (TX-ID)
  ↓
ContextBuilder → Ollama
  ↓
AI Response (RSP-ID)
  ↓
UI Teleprompter + Log Store

Output Format
{
  "id": "TX-014",
  "timestamp": "00:02:37",
  "speaker": "client",
  "text": "Can you tell me how you manage revisions?"
}


Implementation Notes:

Use VAD (voice activity detection) to mark silence and finalize segments.

Each transcript segment triggers an AI generation event.

No speaker detection logic required.

🧩 CONTEXT BUILDER ENGINE
Responsibilities

Load permanent knowledge

Load current project context

Detect conversation mode (discovery or technical)

Assemble full prompt for local Ollama call

File Structure
/knowledge/permanent/
├── behavior_rules.md
├── language_tone_guide.md
├── response_style.md
├── discovery_behavior.md
├── ai_governor_framework.md
└── resume.md
/knowledge/project/
└── current_project.md

Example Context Assembly
SYSTEM ROLE:
You are the user's Interview Assistant.
You reply as if you are the developer speaking directly to the client.

ACTIVE MODE: Discovery

LOADED KNOWLEDGE:
- behavior_rules.md
- language_tone_guide.md
- discovery_behavior.md
- resume.md
- current_project.md

CLIENT INPUT [TX-014]:
"Can you tell me how you manage revisions?"

🧭 MODE DETECTION ENGINE
Purpose

Auto-switch between Discovery and Technical modes
based on transcript content.

Rules
function detectMode(text: string): "discovery" | "technical" {
  const technical = ["api", "framework", "backend", "frontend", "deploy", "testing"];
  const discovery = ["idea", "plan", "thinking", "scope", "budget", "timeline"];

  const t = text.toLowerCase();
  if (technical.some(k => t.includes(k))) return "technical";
  if (discovery.some(k => t.includes(k))) return "discovery";
  return sessionState.lastMode || "discovery";
}

Mode Summary
Mode	Response Structure	Tone	Goal
Discovery	Acknowledge → Ask → Reassure	Friendly	Clarify project goals
Technical	Summary → Explanation → Confident Close	Assertive	Show workflow expertise
🤖 LOCAL LLM (OLLAMA) INTEGRATION
Engine Endpoint
http://localhost:11434/api/generate

Example Call
const result = await fetch("http://localhost:11434/api/generate", {
  method: "POST",
  body: JSON.stringify({
    model: "mistral:instruct",
    prompt: assembledPrompt,
    stream: false,
    temperature: 0.7
  }),
});

Expected Response
{
  "response_id": "RSP-014",
  "source_transcript": "TX-014",
  "mode": "discovery",
  "text": "Okay, I understand your concern about revisions. How often do you plan to iterate?"
}

🧱 RESPONSE STRUCTURE & LINKAGE

Every AI output must be anchored to a transcript segment:

{
  "response_id": "RSP-014",
  "source_transcript": "TX-014",
  "client_text": "Can you tell me how you manage revisions?",
  "assistant_mode": "discovery",
  "assistant_response": {
    "summary": "I handle revisions through versioned tasks in my Governor workflow.",
    "explanation": "Each update triggers a CI/CD validation and documentation sync.",
    "closing": "That way, every iteration stays traceable and organized."
  }
}


Database Schema (SQLite):

Field	Description
tx_id	transcript segment ID
rsp_id	linked response ID
timestamp	timestamp from audio stream
mode	discovery / technical
client_text	original question
assistant_text	AI final answer
summary	1-line recap for context recall
💻 UI DESIGN (TELEPROMPTER + CONTEXT VIEW)
Layout Concept
───────────────────────────────
🗣 [TX-014]  Client: "How do you handle revisions?"
───────────────────────────────
🤖 [RSP-014]  Mode: Discovery
I handle revisions through versioned tasks...
───────────────────────────────

UI Behaviors

Highlight the current transcript (TX-ID) when AI response arrives.

Show mode and link to RSP-ID.

Enable scrollback to previous Q&A pairs.

Optionally show “mode transition” indicator (Discovery → Technical).

⚙️ PIPELINE SUMMARY
🎤 Client speaks
↓
Whisper streaming (local)
↓
Transcript TX-ID generated
↓
Mode detection (discovery / technical)
↓
Context builder loads relevant knowledge
↓
Prompt assembled and sent to Ollama (local)
↓
AI response generated (RSP-ID)
↓
Response displayed + linked to TX-ID
↓
Saved to local SQLite

⚡ OPTIMIZATIONS

Keep Whisper model small (base or tiny.en) for sub-300ms latency.

Run Ollama on a quantized model (mistral:7b-q4) for speed.

Cache permanent knowledge in memory (load once at app init).

Use background thread for DB writes to avoid blocking UI.

Allow toggling between LLMs (mistral, phi3, llama3) via dropdown.

✅ OUTPUT EXPECTATIONS
Feature	Behavior
Speech Input	Client audio only
Transcription	Real-time, low latency
Response Mapping	Each AI reply linked to transcript segment
Mode Auto-switch	Context-based (keywords)
Knowledge Usage	From local .md files (cached in memory)
LLM	Fully local via Ollama
Storage	Local SQLite, permanent logs
UI	Teleprompter + transcript pairing
Offline Operation	100% offline, no API calls