# Current Project: SecretInterview Offline Assistant

## Objectives
- Deliver an interview coaching assistant that operates fully offline using a local LLM.
- Provide modular knowledge management with permanent and project-specific context.
- Ensure workflows align with the AI Governor framework for predictable delivery.

## Scope & Constraints
- Runtime environment is Electron with React frontend.
- Local LLM engines supported: Ollama, LM Studio, and vLLM.
- Responses must follow summary → explanation → closing pattern.
- Project updates occur by editing this file before each new engagement.

## Stakeholders
- Product Owner: Mia Santiago
- Engineering Lead: Alex Dela Cruz
- QA & Compliance: GovOps squad (automation + audits)

## Technology Stack
- Frontend: React + Tailwind within Electron shell
- Backend Services: Local HTTP adapters for LLM engines
- Tooling: Node.js, TypeScript, Webpack, Jest (unit tests), Playwright (UI tests)

## Success Criteria
- Interview flows run without external network dependency.
- Knowledge layering seamlessly merges permanent docs with this project file.
- AI responses cite workflow stages using the AI Governor reference when discussing governance.
