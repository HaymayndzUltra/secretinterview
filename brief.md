🧠 INTERVIEW ASSISTANT — FINAL PROJECT BRIEF (CLIENT-ONLY, AUTOSUGGEST, OFFLINE, 4090-OPTIMIZED)
Assumptions (explicit)

Client-only audio via loopback (hindi ka nata-transcribe).

100% offline (Whisper + LLM local lang).

Windows primary (WASAPI loopback). If macOS/Linux, may equivalent steps.

Hardware: RTX 4090 (24GB VRAM) + Ryzen 9 7900 → target sub-250ms partial captions, <900ms finalized TX→LLM → suggestion.

Goal #1: Auto-suggest lines (teleprompter-style, top-k suggestions) habang ka-call.

Goal #2: Discovery assist (clarifying questions, scope probing) kapag ang topic ay high-level.

0) One-liner

A GPU-accelerated, offline Electron app that listens to client-only audio, does real-time Whisper streaming, and generates top-3 autosuggestions (Discovery ↔ Technical) with hard links to transcript segments.

1) Outcomes & KPIs

ASR partial latency: P50 ≤ 200ms; P95 ≤ 350ms

TX finalize → 1st suggestion: P50 ≤ 900ms; P95 ≤ 1.3s

Suggestion CTR (hotkey pick rate) ≥ 40% after tuning

Mode accuracy (rule-based V1) ≥ 85%; manual override available

Zero mic leakage (no TX from your voice) across acceptance tests

2) Architecture (GPU-first)

Electron Main

Device binding (loopback only), workers orchestration, watchdogs.

Renderer (React + TS + Tailwind)

Live captions, Autosuggest Deck (top-3), one-tap insert, scrollback.

Workers

ASR Worker: faster-whisper (CTranslate2 CUDA FP16) streaming; VAD; segmenter.

LLM Worker: Ollama client + two-stage decoding (draft+refine) for latency.

DB Worker: SQLite (atomic TX↔RSP), batched writes.

Knowledge

/knowledge/permanent + /knowledge/project cached in memory.

Client audio (loopback) → AudioWorklet(512ms) → VAD → Faster-Whisper stream → TX-ID
                                           ↓
                                 Mode Detector (V1 rules)
                                           ↓
                           Context Builder (perm+project)
                                           ↓
             LLM Two-Stage (Draft small → Refiner 8B) → 3 suggestions → UI
                                           ↓
                                  Link RSP↔TX → SQLite

3) Audio Capture (Client-only, no mic)

Windows (recommended): WASAPI loopback of default output device.

Enforcement:

Whitelist deviceId = loopback; never bind mic; show badge Source: Client (Loopback).

If mic detected active → show warning chip: “Mic ignored (client-only).”

VAD & Segments

Frame: 512ms; Silence finalize: 800–1000ms (adaptive to SNR).

Max segment hard-cap: 5–6s to avoid prompt bloat.

4) ASR (4090-optimized)

Engine: faster-whisper (CTranslate2) with CUDA, FP16.

Model default: large-v3 or distil-large-v3 if you want extra headroom.

Low-latency flags:

compute_type="float16", device="cuda", beam_size=1 (greedy) for streaming;

vad_filter=True (external RNNoise optional), temperature=0.0 for stability;

Chunk hop ~0.5s, overlap 0.25s.

Tip: With 4090, large-v3 streaming is viable. If you want ultra-snappy finalization, try distil-large-v3.

Partial vs Final

Emit partials every ~250ms for on-screen live captions.

Trigger LLM only on finalized segments (TX) to avoid jitter.

5) Mode Detection (V1 rules, V2 classifier ready)

Discovery keywords: idea, plan, scope, budget, timeline, users, success, risk, milestone, goals

Technical keywords: api, sdk, framework, backend, frontend, deploy, testing, ci/cd, docker, kubernetes, database, schema, redis, queue, microservice, grpc, rest

Fallback to last mode (default Discovery).

UI toggle chip to force mode.

(Upgrade path): tiny on-device linear classifier (ONNX) using char/word n-grams to replace rules.

6) LLM (Two-Stage for latency)

Ollama endpoint: http://localhost:11434/api/generate, stream=false (strict JSON).

Stage A (Draft, ultra-fast): phi3:mini or llama3.2:3b-instruct (Q4/Q5) → draft 3 options in ~200–400ms.

Stage B (Refine): llama3.1:8b-instruct Q4_K_M (fits in 4090) → polish top-2 or re-rank to top-3, add structure (Summary/Next line/Follow-up question).

This gives you instant “good-enough” lines, then a near-instant polish pass—still under ~1s median.

Model switcher (UI): {phi3-mini, llama3.2-3B, llama3.1-8B, mistral-7B}.
Temps: Draft 0.7, Refine 0.4 (assertive).
Max tokens: 96–160 (short, punchy suggestions).
Stop sequences: \n\n, safety braces if JSON.

7) Context Builder (grounding)

Loads:

/knowledge/permanent/
  behavior_rules.md
  language_tone_guide.md
  response_style.md
  discovery_behavior.md
  ai_governor_framework.md
  resume.md
/knowledge/project/
  current_project.md


Prompt Skeleton (short, structured)

SYSTEM: You are the developer's Interview Copilot. Be concise and practical.
MODE: {{mode}}
CONTEXT: {{bulleted key points from knowledge cache}}
CLIENT SAID [{{tx.id}} @ {{tx.timestamp}}]: "{{tx.text}}"

Return strict JSON with 3 suggestions:
{
 "tx": "{{tx.id}}",
 "mode": "{{mode}}",
 "suggestions": [
   {"type":"say", "line":"..."},
   {"type":"probe", "line":"..."},
   {"type":"fallback", "line":"..."}
 ],
 "why": "one-line rationale"
}
Constraints: 1 sentence per line; no fluff; mirror client's vocabulary.

8) Autosuggest UX (teleprompter for you)

Autosuggest Deck (right panel): Top-3 lines with hotkeys 1/2/3.

Modes:

Discovery: Acknowledge → Ask → Reassure (suggestions bias toward probing).

Technical: Summary → Explanation → Confident Close (suggestions bias toward specifics).

“Pin to Prompt”: tap to append to a live notepad (so you can tweak before speaking).

Latency indicator (ms from TX finalize to top-1 ready).

Mode chip with manual toggle; show transition (Discovery → Technical).

9) Data Model & Linkage

Always 1:1 RSP ↔ TX anchor.

SQLite

CREATE TABLE IF NOT EXISTS transcript_segments (
  tx_id TEXT PRIMARY KEY,
  session_id TEXT,
  t0 REAL, t1 REAL,
  timestamp TEXT,
  text TEXT,
  mode_at_time TEXT CHECK(mode_at_time IN ('discovery','technical')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suggestions (
  rsp_id TEXT PRIMARY KEY,
  tx_id TEXT NOT NULL,
  mode TEXT CHECK(mode IN ('discovery','technical')),
  s1 TEXT, s2 TEXT, s3 TEXT,          -- top-3 lines
  rationale TEXT,                      -- short "why"
  raw_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tx_id) REFERENCES transcript_segments(tx_id)
);

CREATE INDEX IF NOT EXISTS idx_suggestions_tx ON suggestions(tx_id);


Example stored JSON

{
  "tx": "TX-142",
  "mode": "technical",
  "suggestions": [
    {"type": "say", "line": "We can expose that via a lightweight REST endpoint first, then harden behind an auth proxy."},
    {"type": "probe", "line": "Which parts must be real-time vs. can be eventual consistency?"},
    {"type": "fallback", "line": "Short term, I’ll prototype with Redis streams while we validate throughput."}
  ],
  "why": "Client asked about API reliability; emphasize phased rollout."
}

10) Performance Tuning (4090-specific)

ASR: CTranslate2 GPU FP16; beam_size=1; minimal timestamps. Use distil-large-v3 if you want faster finalization.

LLM:

Keep draft model resident (3–4GB VRAM Q4).

Refiner 8B resident (~5–7GB Q4_K_M).

Pin both in VRAM; avoid unload thrash.

Use prompt caching (static system + knowledge header).

Consider speculative decoding later (draft tokens verified by refiner) if supported locally.

DB: batch writes every 200ms; fsync every 1s or on blur/quit.

Pipeline: parallelize—while ASR finalizes next TX, LLM refines previous.

11) Security & Offline Guarantees

Network interceptor: allowlist localhost:11434 only; block others.

App data dir permissions 0700; optional passcode to open logs.

No telemetry. Everything stays local.

12) Error Handling

Traffic lights: ASR ready / LLM ready / DB ready.

If LLM down → queue TX with backoff; show “Refilling GPU context…”.

JSON guard: strict parse + bracket repair; if fail → show plain text with “non-JSON” banner.

13) Build & Distribution

Electron Builder (Win/macOS/Linux).

First-run:

Pull Ollama models (draft + refiner); verify free disk.

Whisper model download or bundled; GPU check (CUDA present).

14) Acceptance Tests (must pass)

Client-only: You speak, client speaks → TX only for client.

Live call (Zoom/Meet): top-3 suggestions appear <1s after client line.

Mode flip: Feed technical/discovery sentences → correct mode + suggestion style.

Stress: 60-min call, continuous; no memory creep; GPU residency stable.

Mic sabotage: Enable mic; app still binds loopback only; warning chip shows; no TX from your side.

15) Roadmap (Aggressive: 10–12 days)

D1–2: Electron skeleton; device whitelist (loopback only); UI stub.

D3: faster-whisper CUDA streaming + VAD + finalize rules.

D4: Context cache + mode detector + knowledge loader.

D5: Ollama integration; two-stage (draft→refine); strict JSON.

D6: Autosuggest Deck (top-3, hotkeys 1/2/3); latency metrics.

D7: SQLite schema + atomic TX↔RSP; scrollback.

D8: Perf tuning (4090 residency, prompt caching); failure modes.

D9–10: Acceptance tests, long-run soak, polish.

D11–12: Packaging, first-run guides (WASAPI/BlackHole), docs.

16) Copy-paste Snippets

Ollama call (strict JSON)

async function callOllama(prompt: string, model="llama3.1:8b-instruct-q4_K_M", temp=0.4){
  const r = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ model, prompt, stream:false, temperature: temp })
  });
  const raw = await r.text();
  return safeParseJSON(raw); // strict + repair fallback
}


Mode detector (V1)

export function detectMode(t: string, last:"discovery"|"technical"="discovery"){
  const T = ["api","sdk","framework","backend","frontend","deploy","testing","ci","cd","docker","kubernetes","database","schema","redis","queue","grpc","rest"];
  const D = ["idea","plan","scope","budget","timeline","users","success","risk","milestone","goals"];
  const s = t.toLowerCase();
  if (T.some(k=>s.includes(k))) return "technical";
  if (D.some(k=>s.includes(k))) return "discovery";
  return last;
}


Suggestion card shape

type Suggestion = { type:"say"|"probe"|"fallback", line:string };
type Rsp = { tx:string; mode:"discovery"|"technical"; suggestions:Suggestion[]; why:string };

Strong Opinionated Notes

With a 4090, don’t waste it: run both the draft and 8B refiner resident to eliminate model swap delays. This alone slashes your TX→suggestion time by ~300–500ms.

Greedy decoding on ASR + short caps (≤6s segments) beats fancy beams for your use case—speed > tiny WER gains.

Keep suggestions one sentence only. Long lines kill adoption; better to stack small turns.

The Deck should bias:

Discovery → at least 1 probe every TX.

Technical → at least 1 concrete next step (tool, endpoint, test).