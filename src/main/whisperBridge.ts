import { app, BrowserWindow } from "electron";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import path from "path";
import fs from "fs";

type WhisperState = "idle" | "loading" | "ready" | "error" | "stopped";

export interface WhisperStatusPayload {
  state: WhisperState;
  message?: string;
}

export interface WhisperTranscriptPayload {
  text: string;
  isFinal: boolean;
}

export interface WhisperStartOptions {
  language?: string;
  modelPath?: string;
  binaryPath?: string;
  translate?: boolean;
  sampleRate?: number;
}

interface InternalOptions extends WhisperStartOptions {
  resolvedBinary: string;
  resolvedModel: string;
  sampleRate: number;
}

const DEFAULT_SAMPLE_RATE = 16000;

export class WhisperStreamBridge {
  private process: ChildProcessWithoutNullStreams | null = null;
  private stdoutBuffer = "";
  private mainWindow: BrowserWindow | null = null;
  private ready = false;
  private options: InternalOptions | null = null;

  constructor(getWindow?: () => BrowserWindow | null) {
    if (getWindow) {
      this.getWindow = getWindow;
    }
  }

  public setWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  public start(options: WhisperStartOptions = {}): WhisperStatusPayload {
    if (this.process) {
      // Already running, emit current status to ensure renderer is in sync
      this.sendStatus({ state: this.ready ? "ready" : "loading" });
      return { state: this.ready ? "ready" : "loading" };
    }

    try {
      this.options = this.resolveOptions(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.sendStatus({ state: "error", message });
      return { state: "error", message };
    }

    const { resolvedBinary, resolvedModel, language, translate, sampleRate } = this.options;

    this.ready = false;
    this.stdoutBuffer = "";

    const args = this.buildArgs({
      model: resolvedModel,
      language,
      translate,
      sampleRate,
    });

    try {
      this.process = spawn(resolvedBinary, args, {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.sendStatus({ state: "error", message });
      this.process = null;
      return { state: "error", message };
    }

    this.sendStatus({ state: "loading" });

    this.process.stdout.on("data", (data) => this.handleStdout(data));
    this.process.stderr.on("data", (data) => this.handleStderr(data));

    this.process.on("error", (error) => {
      this.sendStatus({ state: "error", message: error.message });
      this.stop();
    });

    this.process.on("close", (code, signal) => {
      const message = code === 0 || signal === "SIGTERM"
        ? undefined
        : `Whisper process exited (${code ?? signal ?? "unknown"})`;
      this.sendStatus({ state: "stopped", message });
      this.process = null;
      this.ready = false;
    });

    return { state: "loading" };
  }

  public stop(): void {
    if (!this.process) {
      return;
    }
    try {
      this.process.stdin.end();
    } catch (error) {
      console.warn("Failed to close whisper stdin", error);
    }
    this.process.kill();
    this.process = null;
    this.ready = false;
    this.sendStatus({ state: "stopped" });
  }

  public pushAudioChunk(chunk: ArrayBuffer | Buffer): void {
    if (!this.process || !this.options) {
      return;
    }

    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (buffer.length === 0) {
      return;
    }

    if (!this.ready) {
      // allow the backend to catch up while the model is loading
      // the process will start consuming chunks once ready
      // we still write to stdin to avoid losing buffered audio
    }

    try {
      this.process.stdin.write(buffer);
    } catch (error) {
      console.warn("Failed to push audio chunk", error);
      this.sendStatus({
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private getWindow(): BrowserWindow | null {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow;
    }
    const windows = BrowserWindow.getAllWindows();
    return windows.length ? windows[0] : null;
  }

  private resolveOptions(options: WhisperStartOptions): InternalOptions {
    const baseDir = app.isPackaged
      ? path.join(process.resourcesPath, "whisper")
      : path.join(app.getAppPath(), "whisper");

    const binaryPath = options.binaryPath
      ? options.binaryPath
      : path.join(
          baseDir,
          process.platform === "win32" ? "whisper-stream.exe" : "whisper-stream"
        );

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Whisper binary not found at ${binaryPath}`);
    }

    const modelPath = options.modelPath
      ? options.modelPath
      : path.join(baseDir, "models", "ggml-base.en.bin");

    if (!fs.existsSync(modelPath)) {
      throw new Error(`Whisper model not found at ${modelPath}`);
    }

    const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;

    return {
      ...options,
      resolvedBinary: binaryPath,
      resolvedModel: modelPath,
      sampleRate,
    };
  }

  private buildArgs({
    model,
    language,
    translate,
    sampleRate,
  }: {
    model: string;
    language?: string;
    translate?: boolean;
    sampleRate: number;
  }): string[] {
    const args: string[] = [
      "--model",
      model,
      "--stream",
      "--step",
      "1",
      "--sample-rate",
      sampleRate.toString(),
      "--no-timestamps",
      "--output-json-stream",
    ];

    if (language && language !== "auto") {
      args.push("--language", language);
    }

    if (translate) {
      args.push("--translate");
    }

    return args;
  }

  private handleStdout(data: Buffer): void {
    this.stdoutBuffer += data.toString();

    let newlineIndex = this.stdoutBuffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
      if (line) {
        this.processStdoutLine(line);
      }
      newlineIndex = this.stdoutBuffer.indexOf("\n");
    }
  }

  private processStdoutLine(line: string): void {
    if (!this.ready) {
      this.ready = true;
      this.sendStatus({ state: "ready" });
    }

    let update: WhisperTranscriptPayload | null = null;

    try {
      const payload = JSON.parse(line);
      update = this.parseJsonPayload(payload);
      if (!update && payload && typeof payload === "object") {
        const maybeStatus = (payload as { state?: WhisperState }).state;
        if (maybeStatus) {
          this.sendStatus(payload as WhisperStatusPayload);
          return;
        }
      }
    } catch (error) {
      // Not JSON, fall back to string parsing
      update = this.parseTextLine(line);
    }

    if (update) {
      this.sendTranscript(update);
    }
  }

  private parseJsonPayload(payload: any): WhisperTranscriptPayload | null {
    if (!payload) {
      return null;
    }

    if (Array.isArray(payload)) {
      const last = payload[payload.length - 1];
      if (last && typeof last.text === "string") {
        return {
          text: last.text,
          isFinal: Boolean(last.is_final ?? last.final ?? false),
        };
      }
      return null;
    }

    if (typeof payload !== "object") {
      return null;
    }

    if (typeof payload.text === "string") {
      return {
        text: payload.text,
        isFinal: Boolean(payload.is_final ?? payload.final ?? payload.type === "final"),
      };
    }

    if (typeof payload.result === "string") {
      return {
        text: payload.result,
        isFinal: Boolean(payload.is_final ?? payload.final ?? true),
      };
    }

    if (Array.isArray(payload.segments)) {
      const segments = payload.segments;
      const combined = segments.map((segment: any) => segment.text || "").join(" ").trim();
      if (combined) {
        const last = segments[segments.length - 1];
        return {
          text: combined,
          isFinal: Boolean(last?.is_final ?? last?.final ?? payload.is_final ?? false),
        };
      }
    }

    return null;
  }

  private parseTextLine(line: string): WhisperTranscriptPayload | null {
    const cleaned = line.replace(/\u001b\[[0-9;]*m/g, "").trim();
    if (!cleaned) {
      return null;
    }

    const finalMatch = cleaned.match(/\[final\]$/i);
    const text = finalMatch ? cleaned.replace(/\[final\]$/i, "").trim() : cleaned;

    return {
      text,
      isFinal: Boolean(finalMatch),
    };
  }

  private handleStderr(data: Buffer): void {
    const text = data.toString();
    if (!this.ready) {
      const normalized = text.toLowerCase();
      if (
        normalized.includes("listening") ||
        normalized.includes("ready") ||
        normalized.includes("recording") ||
        normalized.includes("awaiting audio") ||
        normalized.includes("model loaded")
      ) {
        this.ready = true;
        this.sendStatus({ state: "ready" });
      }
    }
  }

  private sendStatus(status: WhisperStatusPayload): void {
    const window = this.getWindow();
    if (!window) {
      return;
    }
    window.webContents.send("whisper:status", status);
  }

  private sendTranscript(payload: WhisperTranscriptPayload): void {
    const window = this.getWindow();
    if (!window) {
      return;
    }
    window.webContents.send("whisper:transcript", payload);
  }
}

