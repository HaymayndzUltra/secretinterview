import axios, { AxiosInstance } from 'axios';

export type LlmRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LocalLlmConfig {
  baseUrl: string;
  model: string;
  provider?: 'ollama' | 'lmstudio' | 'vllm' | 'generic';
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  requestPath?: string;
}

export interface InvokeLlmOptions {
  config: LocalLlmConfig;
  messages: LlmMessage[];
  signal?: AbortSignal;
}

export interface LocalLlmResult {
  content: string;
}

function sanitizeBaseUrl(url: string): string {
  if (!url) {
    return 'http://localhost:11434';
  }
  const trimmed = url.replace(/\/$/, '');
  return trimmed;
}

function createAxiosInstance(config: LocalLlmConfig, signal?: AbortSignal): AxiosInstance {
  return axios.create({
    baseURL: sanitizeBaseUrl(config.baseUrl),
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function invokeOllama(config: LocalLlmConfig, messages: LlmMessage[], signal?: AbortSignal): Promise<string> {
  const client = createAxiosInstance(config, signal);
  const response = await client.post('/api/chat', {
    model: config.model,
    messages,
    stream: false,
    options: {
      temperature: config.temperature ?? 0.7,
      top_p: config.topP ?? 0.9,
      num_predict: config.maxTokens,
    },
  });

  if (response.data?.message?.content) {
    return response.data.message.content as string;
  }

  if (Array.isArray(response.data?.messages)) {
    const last = response.data.messages[response.data.messages.length - 1];
    if (last?.content) {
      return last.content as string;
    }
  }

  throw new Error('Unexpected response from Ollama local LLM');
}

async function invokeLmStudio(config: LocalLlmConfig, messages: LlmMessage[], signal?: AbortSignal): Promise<string> {
  const client = createAxiosInstance(config, signal);
  const response = await client.post('/v1/chat/completions', {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7,
    top_p: config.topP ?? 0.9,
    max_tokens: config.maxTokens,
    stream: false,
  });

  const choice = response.data?.choices?.[0]?.message;
  if (choice?.content) {
    return choice.content as string;
  }
  throw new Error('Unexpected response from LM Studio local LLM');
}

async function invokeGeneric(config: LocalLlmConfig, messages: LlmMessage[], signal?: AbortSignal): Promise<string> {
  const client = createAxiosInstance(config, signal);
  const path = config.requestPath || '/v1/chat/completions';
  const response = await client.post(path, {
    model: config.model,
    messages,
    temperature: config.temperature ?? 0.7,
    top_p: config.topP ?? 0.9,
    max_tokens: config.maxTokens,
    stream: false,
  });

  const choice = response.data?.choices?.[0]?.message;
  if (choice?.content) {
    return choice.content as string;
  }
  throw new Error('Unexpected response from local LLM');
}

export async function invokeLocalLlm({ config, messages, signal }: InvokeLlmOptions): Promise<LocalLlmResult> {
  const provider = config.provider ?? 'ollama';
  let content: string;

  switch (provider) {
    case 'ollama':
      content = await invokeOllama(config, messages, signal);
      break;
    case 'lmstudio':
    case 'vllm':
      content = await invokeLmStudio(config, messages, signal);
      break;
    default:
      content = await invokeGeneric(config, messages, signal);
      break;
  }

  return { content: content.trim() };
}

export async function testLocalLlm(config: LocalLlmConfig): Promise<void> {
  const result = await invokeLocalLlm({
    config,
    messages: [
      { role: 'system', content: 'You are a diagnostic agent verifying connectivity.' },
      { role: 'user', content: 'Reply with the single word "online" if you received this message.' },
    ],
  });

  if (!/online/i.test(result.content)) {
    throw new Error('Local LLM responded unexpectedly. Received: ' + result.content.slice(0, 120));
  }
}
