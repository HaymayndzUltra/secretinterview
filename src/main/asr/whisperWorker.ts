import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import type { TranscriptSegment, WhisperPartial } from '@shared/types';

interface WhisperMessage {
  type: 'partial' | 'final' | 'ready' | 'error';
  payload?: unknown;
}

export class WhisperWorker extends EventEmitter {
  private process: ChildProcessWithoutNullStreams | null = null;

  constructor(private pythonPath = 'python') {
    super();
  }

  public start(): void {
    if (this.process) return;
    const scriptPath = path.resolve(__dirname, 'whisper_stream.py');
    this.process = spawn(this.pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const message = JSON.parse(line) as WhisperMessage;
          switch (message.type) {
            case 'partial':
              this.emit('partial', message.payload as WhisperPartial);
              break;
            case 'final':
              this.emit('final', message.payload as TranscriptSegment);
              break;
            case 'ready':
              this.emit('ready');
              break;
            case 'error':
              this.emit('error', new Error(String(message.payload ?? 'unknown error')));
              break;
            default:
              break;
          }
        } catch (error) {
          this.emit('error', new Error(`Malformed message: ${line}`));
        }
      }
    });

    this.process.stderr.on('data', (chunk) => {
      this.emit('error', new Error(chunk.toString()));
    });

    this.process.on('exit', (code) => {
      if (code !== 0) {
        this.emit('error', new Error(`Whisper worker exited with code ${code}`));
      }
      this.process = null;
    });
  }

  public sendAudio(buffer: Buffer): void {
    if (!this.process) {
      throw new Error('Whisper worker is not running');
    }
    const payload = JSON.stringify({ type: 'audio', payload: buffer.toString('base64') });
    this.process.stdin.write(`${payload}\n`);
  }

  public stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}
