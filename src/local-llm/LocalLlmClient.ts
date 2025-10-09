import axios, { AxiosInstance } from 'axios';
import { LlmCallOptions, LlmInvocationResult, LlmMessage } from '../types/llm';

export type LocalLlmProvider = 'ollama' | 'lmstudio' | 'vllm' | 'openai-compatible' | 'custom';

export interface LocalLlmConfig {
  provider: LocalLlmProvider;
  baseUrl: string;
  model: string;
  requestTimeoutMs?: number;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  extraParams?: Record<string, unknown>;
}

export interface LocalLlmInvocationPayload {
  messages: LlmMessage[];
  options?: LlmCallOptions;
}

export class LocalLlmClient {
  private axiosInstance: AxiosInstance;

  constructor(private readonly config: LocalLlmConfig) {
    if (!config.baseUrl) {
      throw new Error('Local LLM baseUrl is required.');
    }
    if (!config.model) {
      throw new Error('Local LLM model is required.');
    }

    const trimmedBase = config.baseUrl.endsWith('/')
      ? config.baseUrl.slice(0, -1)
      : config.baseUrl;

    this.axiosInstance = axios.create({
      baseURL: trimmedBase,
      timeout: config.requestTimeoutMs ?? 60000,
    });
  }

  async invoke(
    payload: LocalLlmInvocationPayload,
    abortSignal?: AbortSignal
  ): Promise<LlmInvocationResult> {
    const provider = this.config.provider ?? 'openai-compatible';

    switch (provider) {
      case 'ollama':
        return this.invokeOllama(payload, abortSignal);
      case 'lmstudio':
      case 'vllm':
      case 'openai-compatible':
      case 'custom':
      default:
        return this.invokeOpenAICompatible(payload, abortSignal);
    }
  }

  private async invokeOpenAICompatible(
    payload: LocalLlmInvocationPayload,
    abortSignal?: AbortSignal
  ): Promise<LlmInvocationResult> {
    const body = {
      model: this.config.model,
      messages: payload.messages,
      temperature: payload.options?.temperature ?? this.config.temperature,
      top_p: payload.options?.top_p ?? this.config.top_p,
      max_tokens: payload.options?.max_tokens ?? this.config.max_tokens,
      stop: payload.options?.stop,
      ...(this.config.extraParams || {}),
    };

    const response = await this.axiosInstance.post(
      '/chat/completions',
      body,
      { signal: abortSignal }
    );

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Local LLM returned an unexpected response structure.');
    }

    return {
      content: response.data.choices[0].message.content,
      raw: response.data,
    };
  }

  private async invokeOllama(
    payload: LocalLlmInvocationPayload,
    abortSignal?: AbortSignal
  ): Promise<LlmInvocationResult> {
    const body = {
      model: this.config.model,
      messages: payload.messages,
      options: {
        temperature: payload.options?.temperature ?? this.config.temperature,
        top_p: payload.options?.top_p ?? this.config.top_p,
        ...(this.config.extraParams || {}),
      },
      stream: false,
    };

    const response = await this.axiosInstance.post(
      '/api/chat',
      body,
      { signal: abortSignal }
    );

    const message = response.data?.message?.content ?? response.data?.message;

    if (typeof message !== 'string') {
      throw new Error('Ollama response did not include text content.');
    }

    return {
      content: message,
      raw: response.data,
    };
  }
}

export function sanitizeMessages(messages: LlmMessage[]): LlmMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: typeof message.content === 'string'
      ? message.content
      : JSON.stringify(message.content),
  }));
}
