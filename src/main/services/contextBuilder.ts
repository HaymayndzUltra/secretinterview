import type { ContextEnvelope, KnowledgeBundle, TranscriptSegment } from '@shared/types';
import { ModeDetector } from './modeDetector.js';

const SYSTEM_HEADER = `You are the user's Interview Assistant. Respond as the developer speaking to the client. Keep replies offline-first.`;

export class ContextBuilder {
  private knowledge: KnowledgeBundle | null = null;
  private modeDetector: ModeDetector;

  constructor(modeDetector: ModeDetector) {
    this.modeDetector = modeDetector;
  }

  public prime(knowledge: KnowledgeBundle): void {
    this.knowledge = knowledge;
  }

  private buildKnowledgeBlock(): string {
    if (!this.knowledge) {
      return 'Knowledge not yet loaded.';
    }
    const { permanent, project } = this.knowledge;
    const sections = [
      'LOADED KNOWLEDGE:',
      ...Object.entries(permanent).map(([file, content]) => `# ${file}\n${content}`),
      ...Object.entries(project).map(([file, content]) => `# ${file}\n${content}`)
    ];
    return sections.join('\n\n');
  }

  public assemble(tx: TranscriptSegment): ContextEnvelope {
    const mode = this.modeDetector.detect(tx.text);
    const header = `${SYSTEM_HEADER}\nACTIVE MODE: ${mode.toUpperCase()}`;
    const knowledgeBlock = this.buildKnowledgeBlock();
    const userPrompt = [
      `CLIENT INPUT [${tx.id}] (${tx.timestamp}):`,
      `"${tx.text}"`,
      'Return JSON: {"response_id","source_transcript","mode","assistant_response":{"summary","next_line","probe"},"why"}'
    ].join('\n');

    return {
      systemPrompt: `${header}\n${knowledgeBlock}`,
      userPrompt,
      mode,
      txId: tx.id
    };
  }
}
