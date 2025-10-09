import axios from 'axios';
import { ChatMessage, LocalLlmConfig } from '../types/llm';

export class LocalLlmClient {
  constructor(private readonly config: LocalLlmConfig) {
    if (!config || !config.provider) {
      throw new Error('Local LLM configuration is missing.');
    }
    if (!config.baseUrl) {
      throw new Error('Local LLM base URL is not defined.');
    }
    if (!config.model) {
      throw new Error('Local LLM model is not defined.');
    }
  }

  async generate(messages: ChatMessage[], abortSignal?: AbortSignal): Promise<string> {
    switch (this.config.provider) {
      case 'ollama':
        return this.generateWithOllama(messages, abortSignal);
      case 'openai-compatible':
      default:
        return this.generateWithOpenAiCompatible(messages, abortSignal);
    }
  }

  private resolveUrl(pathname: string): string {
    const base = this.config.baseUrl.endsWith('/') ? this.config.baseUrl : `${this.config.baseUrl}/`;
    return new URL(pathname.replace(/^\//, ''), base).toString();
  }

  private async generateWithOllama(messages: ChatMessage[], abortSignal?: AbortSignal): Promise<string> {
    const payload = {
      model: this.config.model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      stream: false,
      options: {
        temperature: this.config.temperature ?? 0.7,
        top_p: this.config.topP ?? 0.9,
        num_predict: this.config.maxTokens,
      },
    };

    const response = await axios.post(
      this.resolveUrl('/api/chat'),
      payload,
      {
        timeout: this.config.requestTimeoutMs ?? 180000,
        signal: abortSignal,
      },
    );

    const data = response.data;
    if (data?.message?.content) {
      if (Array.isArray(data.message.content)) {
        return data.message.content.map((item: any) => item?.text ?? '').join('');
      }
      return data.message.content;
    }

    if (typeof data?.response === 'string') {
      return data.response;
    }

    throw new Error('Unexpected Ollama response payload.');
  }

  private async generateWithOpenAiCompatible(messages: ChatMessage[], abortSignal?: AbortSignal): Promise<string> {
    const payload = {
      model: this.config.model,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      temperature: this.config.temperature ?? 0.7,
      top_p: this.config.topP ?? 0.9,
      max_tokens: this.config.maxTokens,
    };

    const response = await axios.post(
      this.resolveUrl('/v1/chat/completions'),
      payload,
      {
        timeout: this.config.requestTimeoutMs ?? 180000,
        signal: abortSignal,
      },
    );

    const data = response.data;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content;
    }

    throw new Error('Unexpected OpenAI-compatible response payload.');
  }
}
