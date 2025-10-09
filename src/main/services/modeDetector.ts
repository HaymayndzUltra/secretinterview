import type { ConversationMode } from '@shared/types';

const TECHNICAL_KEYWORDS = [
  'api',
  'sdk',
  'framework',
  'backend',
  'frontend',
  'deploy',
  'testing',
  'ci',
  'cd',
  'docker',
  'kubernetes',
  'database',
  'schema',
  'redis',
  'queue',
  'grpc',
  'rest',
  'microservice',
  'pipeline',
  'integration'
];

const DISCOVERY_KEYWORDS = [
  'idea',
  'plan',
  'scope',
  'budget',
  'timeline',
  'users',
  'success',
  'risk',
  'milestone',
  'goals',
  'vision',
  'stakeholder'
];

export class ModeDetector {
  private lastMode: ConversationMode = 'discovery';

  public detect(text: string): ConversationMode {
    const sentence = text.toLowerCase();
    if (TECHNICAL_KEYWORDS.some((keyword) => sentence.includes(keyword))) {
      this.lastMode = 'technical';
      return 'technical';
    }
    if (DISCOVERY_KEYWORDS.some((keyword) => sentence.includes(keyword))) {
      this.lastMode = 'discovery';
      return 'discovery';
    }
    return this.lastMode;
  }

  public override(mode: ConversationMode): void {
    this.lastMode = mode;
  }
}
