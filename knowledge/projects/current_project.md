# Current Project: SecretInterview Offline LLM Migration

## Goals
- Replace all external GPT dependencies with a fully local inference stack.
- Maintain interview workflow fidelity, including prompt assembly and behavioral modules.
- Introduce modular knowledge layers so the team can swap project context quickly.

## Requirements
- Primary LLM engine: Ollama running on localhost with the `llama3` family model.
- Knowledge files stored as Markdown and loaded before every interview response.
- Ensure AI Governor guidance is referenced for governance, automation, and compliance discussions.

## Tech Stack
- Electron + React frontend
- Local Whisper or Deepgram fallback for transcription
- Node-based orchestration for knowledge assembly and local LLM routing

## Key Constraints
- Application must run without internet access.
- Project context changes happen by replacing `current_project.md` before starting a session.
- Responses must keep the Filipino-English tone requested by stakeholders.
