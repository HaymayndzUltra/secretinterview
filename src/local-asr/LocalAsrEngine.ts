import { EventEmitter } from 'events';
import net from 'net';

export interface LocalAsrConfig {
  host: string;
  port: number;
  authToken?: string;
  sampleRate: number;
  language?: string;
  encoding?: 'pcm_s16le';
  readinessTimeoutMs?: number;
}

export interface LocalAsrTranscriptEvent {
  transcript: string;
  isFinal: boolean;
  latencyMs?: number;
  confidence?: number;
}

export interface LocalAsrStatusEvent {
  status: 'connecting' | 'open' | 'closed';
}

export declare interface LocalAsrEngine {
  on(event: 'status', listener: (status: LocalAsrStatusEvent) => void): this;
  on(event: 'transcript', listener: (payload: LocalAsrTranscriptEvent) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  off(event: 'status', listener: (status: LocalAsrStatusEvent) => void): this;
  off(event: 'transcript', listener: (payload: LocalAsrTranscriptEvent) => void): this;
  off(event: 'error', listener: (error: Error) => void): this;
}

export class LocalAsrEngine extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private ready = false;

  async start(config: LocalAsrConfig): Promise<void> {
    await this.stop();

    const readinessTimeout = config.readinessTimeoutMs ?? 2_000;

    this.emit('status', { status: 'connecting' });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Local ASR connection timeout'));
      }, readinessTimeout);

      const socket = net.createConnection({ host: config.host, port: config.port }, () => {
        clearTimeout(timeout);
        this.socket = socket;
        this.ready = true;
        this.emit('status', { status: 'open' });
        if (config.authToken) {
          socket.write(
            JSON.stringify({ type: 'auth', token: config.authToken }) + '\n'
          );
        }
        socket.write(
          JSON.stringify({
            type: 'config',
            format: config.encoding ?? 'pcm_s16le',
            sampleRate: config.sampleRate,
            language: config.language ?? 'en',
          }) + '\n'
        );
        resolve();
      });

      socket.on('data', (chunk) => this.handleData(chunk));
      socket.on('close', () => {
        this.emit('status', { status: 'closed' });
        this.cleanup();
      });
      socket.on('error', (error) => {
        if (!this.ready) {
          clearTimeout(timeout);
          reject(error);
        } else {
          this.emit('error',
            error instanceof Error ? error : new Error(String(error))
          );
        }
      });
    });
  }

  sendAudio(buffer: Buffer): void {
    if (!this.socket || !this.ready) {
      throw new Error('Local ASR engine is not ready');
    }
    if (buffer.length === 0) {
      return;
    }
    this.socket.write(buffer);
  }

  async stop(): Promise<void> {
    if (this.socket) {
      await new Promise<void>((resolve) => {
        const socket = this.socket;
        if (!socket) {
          resolve();
          return;
        }
        const handleClose = () => {
          socket.removeListener('error', handleError);
          resolve();
        };
        const handleError = () => {
          socket.removeListener('close', handleClose);
          resolve();
        };
        socket.once('close', handleClose);
        socket.once('error', handleError);
        socket.end();
      });
    }
    this.cleanup();
  }

  isReady(): boolean {
    return this.ready;
  }

  private cleanup() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.destroy();
    }
    this.socket = null;
    this.ready = false;
    this.buffer = Buffer.alloc(0);
  }

  private handleData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    let newlineIndex = this.buffer.indexOf(0x0a);
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex).toString('utf-8').trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        this.handleMessage(line);
      }
      newlineIndex = this.buffer.indexOf(0x0a);
    }
  }

  private handleMessage(message: string) {
    try {
      const payload = JSON.parse(message);
      if (payload.type === 'transcript' && typeof payload.text === 'string') {
        this.emit('transcript', {
          transcript: payload.text,
          isFinal: Boolean(payload.final ?? payload.isFinal ?? true),
          latencyMs: payload.latencyMs ?? payload.latency_ms,
          confidence: payload.confidence,
        });
      } else if (payload.type === 'error' && payload.message) {
        this.emit('error', new Error(payload.message));
      }
    } catch (error) {
      this.emit(
        'error',
        error instanceof Error
          ? error
          : new Error(`Failed to parse local ASR message: ${message}`)
      );
    }
  }
}
