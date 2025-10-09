# Project: SecretInterview Modernization

## Goals
- Deliver a fully offline interview simulation tool for engineering candidates.
- Replace cloud LLM calls with a local inference stack to ensure privacy and reliability.
- Standardize interview coaching outputs around the AI Governor Framework.

## Requirements
- Integrate with Ollama-compatible models (default: `llama3.1:8b`) served locally.
- Support modular knowledge loading so each client engagement can swap project files without code changes.
- Maintain electron-based UI/UX with existing prompt assembly features.

## Stack & Tooling
- Electron + React front-end
- Local ASR via Whisper or Deepgram fallback
- Local LLM served via HTTP on `http://localhost:11434`

## Risks & Considerations
- Ensure prompt context stays within token limits when combining permanent + project knowledge.
- Validate latency of local model before live interviews; cache knowledge context to reduce overhead.
- Provide clear guidance when the local model is unreachable or misconfigured.
