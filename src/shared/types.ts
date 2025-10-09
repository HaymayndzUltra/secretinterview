export type ConversationMode = 'discovery' | 'technical';

export interface TranscriptSegment {
  id: string;
  timestamp: string;
  text: string;
  confidence: number;
}

export interface SuggestionLine {
  id: string;
  txId: string;
  mode: ConversationMode;
  summary: string;
  nextLine: string;
  probe: string | null;
  why: string;
  createdAt: number;
}

export interface AutosuggestDeckState {
  activeTxId: string | null;
  mode: ConversationMode;
  suggestions: SuggestionLine[];
}

export interface StatusSnapshot {
  asrReady: boolean;
  llmReady: boolean;
  dbReady: boolean;
  mode: ConversationMode;
}

export interface WhisperPartial {
  id: string;
  text: string;
  avgLogProb: number;
  temperature: number;
}

export interface WhisperFinalizedSegment extends TranscriptSegment {
  partials: WhisperPartial[];
}

export interface GovernorFlag {
  code: 'none' | 'governor_block' | 'latency_risk';
  message?: string;
}

export interface DraftSuggestion {
  summary: string;
  nextLine: string;
  probe?: string;
  confidence: number;
}

export interface RefinedSuggestionsResult {
  txId: string;
  mode: ConversationMode;
  suggestions: SuggestionLine[];
  latencyMs: number;
}

export interface KnowledgeBundle {
  permanent: Record<string, string>;
  project: Record<string, string>;
}

export interface ContextEnvelope {
  systemPrompt: string;
  userPrompt: string;
  mode: ConversationMode;
  txId: string;
}
