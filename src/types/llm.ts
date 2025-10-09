export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type LocalLlmProvider = 'ollama' | 'openai-compatible';

export interface LocalLlmConfig {
  provider: LocalLlmProvider;
  baseUrl: string;
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  requestTimeoutMs?: number;
}

export interface KnowledgeLayer {
  name: string;
  path: string;
  type: 'permanent' | 'project';
  content: string;
}

export interface KnowledgeContextPayload {
  permanent: KnowledgeLayer[];
  project: KnowledgeLayer | null;
}
