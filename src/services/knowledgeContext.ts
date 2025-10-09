import { KnowledgeContextPayload, KnowledgeLayer } from '../types/llm';

export interface UnifiedKnowledgeContext extends KnowledgeContextPayload {
  unifiedPromptFragment: string;
}

export function assembleUnifiedPrompt(permanent: KnowledgeLayer[], project: KnowledgeLayer | null): string {
  const sections: string[] = [];

  if (permanent.length > 0) {
    sections.push('## Permanent Knowledge Base');
    permanent.forEach(layer => {
      sections.push(`### ${layer.name}`);
      sections.push(layer.content.trim());
    });
  }

  if (project) {
    sections.push('## Project Knowledge Base');
    sections.push(`### ${project.name}`);
    sections.push(project.content.trim());
  }

  return sections.join('\n\n');
}

export async function loadUnifiedKnowledgeContext(): Promise<UnifiedKnowledgeContext> {
  const payload: KnowledgeContextPayload = await window.electronAPI.loadKnowledgeContext();
  const permanent = payload.permanent || [];
  const project = payload.project || null;

  return {
    permanent,
    project,
    unifiedPromptFragment: assembleUnifiedPrompt(permanent, project),
  };
}
