import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { WebContents } from 'electron';

type LocalAsrRuntimeConfig = {
  enabled: boolean;
  binaryPath: string;
  modelPath?: string;
  device?: string;
  extraArgs?: string[];
  chunkMilliseconds: number;
  endpointMilliseconds: number;
  env?: Record<string, string>;
};

const DEFAULT_CONFIG: LocalAsrRuntimeConfig = {
  enabled: false,
  binaryPath: '',
  modelPath: '',
  device: 'cuda:0',
  extraArgs: [],
  chunkMilliseconds: 200,
  endpointMilliseconds: 800,
  env: {},
};

type TranscriptPayload = {
  transcript: string;
  is_final: boolean;
  confidence?: number;
  latency_ms?: number;
};

type StatusPayload = {
  status: 'starting' | 'ready' | 'stopped' | 'error';
  message?: string;
};

export class LocalAsrManager extends EventEmitter {
  private config: LocalAsrRuntimeConfig = { ...DEFAULT_CONFIG };
  private process: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = '';
  private currentWebContents: WebContents | null = null;
  private chunkQueue: { id: number; buffer: Buffer; timestamp: number }[] = [];
  private writing = false;
  private nextChunkId = 1;
  private ready = false;
  private statusMessage: string | null = null;
  private pendingChunkTimestamps = new Map<number, number>();

  configure(config?: Partial<LocalAsrRuntimeConfig>): void {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getStatus() {
    return {
      enabled: this.config.enabled,
      binaryPath: this.config.binaryPath,
      available: this.isConfigured(),
      running: Boolean(this.process),
      ready: this.ready,
      statusMessage: this.statusMessage,
    };
  }

  getCurrentWebContents(): WebContents | null {
    return this.currentWebContents;
  }

  isConfigured(): boolean {
    if (!this.config.enabled) {
      return false;
    }
    if (!this.config.binaryPath) {
      return false;
    }
    try {
      const resolved = path.resolve(this.config.binaryPath);
      return fs.existsSync(resolved);
    } catch {
      return false;
    }
  }

  async startSession(
    webContents: WebContents,
    options: { language?: string; sampleRate: number }
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Local ASR engine is not configured or binary is missing.' };
    }

    if (this.process) {
      await this.stopSession();
    }

    const resolvedBinary = path.resolve(this.config.binaryPath);

    try {
      this.statusMessage = 'Spawning local ASR process';
      const args: string[] = [];
      if (this.config.modelPath) {
        args.push('--model', this.config.modelPath);
      }
      if (options.language) {
        args.push('--language', options.language);
      }
      if (this.config.device) {
        args.push('--device', this.config.device);
      }
      if (this.config.chunkMilliseconds) {
        args.push('--chunk-ms', String(this.config.chunkMilliseconds));
      }
      if (this.config.endpointMilliseconds) {
        args.push('--endpoint-ms', String(this.config.endpointMilliseconds));
      }
      if (this.config.extraArgs && this.config.extraArgs.length > 0) {
        args.push(...this.config.extraArgs);
      }

      this.process = spawn(resolvedBinary, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...this.config.env },
      });
      this.currentWebContents = webContents;
      this.stdoutBuffer = '';
      this.chunkQueue = [];
      this.writing = false;
      this.nextChunkId = 1;
      this.ready = false;

      this.process.stdout.on('data', (data: Buffer) => this.handleStdout(data));
      this.process.stderr.on('data', (data: Buffer) => {
        const message = data.toString();
        this.emit('status', { status: 'error', message });
      });
      this.process.on('close', (code) => {
        this.statusMessage = `Local ASR process exited with code ${code}`;
        this.emit('status', { status: 'stopped', message: this.statusMessage });
        this.cleanupProcess();
      });
      this.process.on('error', (err) => {
        this.statusMessage = err.message;
        this.emit('status', { status: 'error', message: err.message });
        this.cleanupProcess();
      });

      this.emit('status', { status: 'starting', message: 'Starting local ASR engine' });

      await this.sendControlMessage({
        type: 'start',
        sample_rate: options.sampleRate,
        chunk_ms: this.config.chunkMilliseconds,
        endpoint_ms: this.config.endpointMilliseconds,
        language: options.language,
      });

      await this.waitForReady(4000);

      return { success: true };
    } catch (error: any) {
      this.cleanupProcess();
      return { success: false, error: error?.message || 'Failed to start local ASR engine.' };
    }
  }

  async stopSession(): Promise<void> {
    if (!this.process) {
      return;
    }

    try {
      await this.sendControlMessage({ type: 'stop' });
    } catch (error) {
      // ignore send error during shutdown
    }

    this.cleanupProcess();
    this.emit('status', { status: 'stopped', message: 'Local ASR session stopped' });
  }

  sendAudioChunk(audioBuffer: ArrayBuffer): boolean {
    if (!this.process) {
      return false;
    }

    const chunkId = this.nextChunkId++;
    const payload = {
      type: 'chunk',
      chunk_id: chunkId,
      audio: Buffer.from(audioBuffer).toString('base64'),
      chunk_sent_at: Date.now(),
    };
    this.pendingChunkTimestamps.set(chunkId, payload.chunk_sent_at);
    this.chunkQueue.push({ id: chunkId, buffer: Buffer.from(JSON.stringify(payload) + '\n'), timestamp: payload.chunk_sent_at });
    this.flushQueue();
    return true;
  }

  private flushQueue(): void {
    if (!this.process || this.writing) {
      return;
    }

    const item = this.chunkQueue.shift();
    if (!item) {
      return;
    }

    this.writing = true;
    this.process.stdin.write(item.buffer, () => {
      this.writing = false;
      this.flushQueue();
    });
  }

  private async sendControlMessage(message: Record<string, any>) {
    if (!this.process) {
      throw new Error('Local ASR process not running');
    }
    return new Promise<void>((resolve, reject) => {
      const payload = Buffer.from(JSON.stringify(message) + '\n');
      this.process!.stdin.write(payload, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private waitForReady(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ready) {
        resolve();
        return;
      }

      const onReady = () => {
        this.ready = true;
        cleanup();
        resolve();
      };

      const onError = (payload: StatusPayload) => {
        if (payload.status === 'error') {
          cleanup();
          reject(new Error(payload.message || 'Local ASR failed to start'));
        }
      };

      const timer = setTimeout(() => {
        cleanup();
        // Resolve anyway to allow engines without explicit ready message
        resolve();
      }, timeoutMs);

      const cleanup = () => {
        clearTimeout(timer);
        this.off('internal-ready', onReady);
        this.off('status', onError);
      };

      this.on('internal-ready', onReady);
      this.on('status', onError);
    });
  }

  private handleStdout(data: Buffer) {
    this.stdoutBuffer += data.toString();
    let newlineIndex = this.stdoutBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      if (line) {
        this.processLine(line);
      }
      newlineIndex = this.stdoutBuffer.indexOf('\n');
    }
  }

  private processLine(line: string) {
    try {
      const message = JSON.parse(line);
      switch (message.type) {
        case 'ready':
        case 'started': {
          this.ready = true;
          this.statusMessage = 'Local ASR ready';
          this.emit('status', { status: 'ready', message: this.statusMessage });
          this.emit('internal-ready');
          break;
        }
        case 'transcript': {
          const payload: TranscriptPayload = {
            transcript: message.transcript || message.text || '',
            is_final: Boolean(message.is_final ?? message.final ?? false),
            confidence: message.confidence,
            latency_ms: message.latency_ms,
          };
          if (message.chunk_id && message.chunk_sent_at) {
            payload.latency_ms = Date.now() - Number(message.chunk_sent_at);
          } else if (message.chunk_id && this.pendingChunkTimestamps.has(message.chunk_id)) {
            const sentAt = this.pendingChunkTimestamps.get(message.chunk_id);
            if (typeof sentAt === 'number') {
              payload.latency_ms = Date.now() - sentAt;
            }
          }
          if (message.chunk_id) {
            this.pendingChunkTimestamps.delete(message.chunk_id);
          }
          this.emit('transcript', payload);
          break;
        }
        case 'status': {
          const payload: StatusPayload = {
            status: message.status,
            message: message.message,
          };
          if (payload.status === 'ready') {
            this.ready = true;
            this.emit('internal-ready');
          }
          this.statusMessage = payload.message || null;
          this.emit('status', payload);
          break;
        }
        case 'error': {
          const payload: StatusPayload = {
            status: 'error',
            message: message.message,
          };
          this.statusMessage = payload.message || null;
          this.emit('status', payload);
          break;
        }
        default: {
          this.emit('status', { status: 'error', message: `Unknown message type from local ASR: ${message.type}` });
        }
      }
    } catch (error: any) {
      this.emit('status', { status: 'error', message: `Failed to parse local ASR output: ${error.message}` });
    }
  }

  private cleanupProcess() {
    if (this.process) {
      this.process.stdout.removeAllListeners();
      this.process.stderr.removeAllListeners();
      this.process.removeAllListeners();
      this.process.kill('SIGTERM');
    }
    this.process = null;
    this.currentWebContents = null;
    this.stdoutBuffer = '';
    this.chunkQueue = [];
    this.writing = false;
    this.ready = false;
    this.pendingChunkTimestamps.clear();
  }
}

export default LocalAsrManager;
