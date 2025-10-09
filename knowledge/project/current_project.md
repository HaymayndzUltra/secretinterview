# Active Project Brief

- **Client:** Placeholder Industries
- **Initiative:** Migration of Interview Assistant to fully offline local LLM workflow
- **Goals:**
  - Remove dependency on external APIs
  - Consolidate knowledge into permanent + project layers
  - Maintain AI Governor methodology across every interaction
- **Stack:** Electron, React, TypeScript, Local LLM runtime (Ollama default)
- **Key Considerations:**
  - Sessions must reload permanent knowledge on start
  - Project file is the only mutable knowledge artifact between engagements
  - Provide guidance on switching contexts by updating this document before new sessions
