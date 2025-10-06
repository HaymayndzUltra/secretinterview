import EventEmitter from "events";
import WebSocket, { RawData } from "ws";

export interface LocalAsrConnectionOptions {
  url: string;
  sampleRate: number;
  authToken?: string;
  language?: string;
  chunkMs?: number;
  handshakeTimeoutMs?: number;
}

export interface LocalAsrTranscriptEvent {
  transcript: string;
  isFinal?: boolean;
  confidence?: number;
}

export type LocalAsrStatus = "open" | "closed" | "connecting";

export declare interface LocalAsrClient {
  on(event: "status", listener: (status: { status: LocalAsrStatus }) => void): this;
  on(event: "transcript", listener: (event: LocalAsrTranscriptEvent) => void): this;
  on(event: "error", listener: (error: Error) => void): this;
}

export class LocalAsrClient extends EventEmitter {
  private socket: WebSocket | null = null;
  private readonly options: LocalAsrConnectionOptions;
  private isReady = false;

  constructor(options: LocalAsrConnectionOptions) {
    super();
    this.options = options;
  }

  public async connect(): Promise<void> {
    if (!this.options.url) {
      throw new Error("Missing local ASR endpoint URL");
    }

    if (this.socket) {
      this.dispose();
    }

    this.emit("status", { status: "connecting" });

    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.options.url, {
        handshakeTimeout: this.options.handshakeTimeoutMs ?? 5000,
      });

      const handleOpen = () => {
        this.socket = ws;
        this.isReady = true;
        this.emit("status", { status: "open" });
        const handshakePayload: Record<string, unknown> = {
          type: "config",
          sampleRate: this.options.sampleRate,
        };
        if (this.options.chunkMs) {
          handshakePayload.chunkMs = this.options.chunkMs;
        }
        if (this.options.language) {
          handshakePayload.language = this.options.language;
        }
        if (this.options.authToken) {
          handshakePayload.authToken = this.options.authToken;
        }
        try {
          ws.send(JSON.stringify(handshakePayload));
        } catch (err) {
          this.emit("error", err instanceof Error ? err : new Error(String(err)));
        }
        resolve();
      };

      const handleMessage = (data: RawData) => {
        try {
          let payload: string;
          if (typeof data === "string") {
            payload = data;
          } else if (data instanceof ArrayBuffer) {
            payload = Buffer.from(data).toString();
          } else if (Array.isArray(data)) {
            payload = Buffer.concat(data).toString();
          } else {
            payload = (data as Buffer).toString();
          }
          const parsed = JSON.parse(payload);
          if (parsed?.type === "transcript") {
            this.emit("transcript", {
              transcript: parsed.transcript ?? "",
              isFinal: parsed.is_final ?? parsed.isFinal ?? false,
              confidence: parsed.confidence,
            });
          } else if (parsed?.type === "status" && parsed.status) {
            this.emit("status", { status: parsed.status as LocalAsrStatus });
          }
        } catch (error) {
          this.emit("error", error instanceof Error ? error : new Error(String(error)));
        }
      };

      const handleError = (error: Error) => {
        cleanup();
        this.isReady = false;
        this.socket = null;
        this.emit("error", error);
        reject(error);
      };

      const handleClose = () => {
        cleanup();
        this.isReady = false;
        this.socket = null;
        this.emit("status", { status: "closed" });
      };

      const cleanup = () => {
        ws.off("open", handleOpen);
        ws.off("message", handleMessage);
        ws.off("error", handleError);
        ws.off("close", handleClose);
      };

      ws.on("open", handleOpen);
      ws.on("message", handleMessage);
      ws.on("error", handleError);
      ws.on("close", handleClose);
    });
  }

  public sendAudio(buffer: ArrayBuffer | SharedArrayBuffer | Buffer): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const payload = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      this.socket.send(payload, { binary: true });
    } catch (error) {
      this.emit("error", error instanceof Error ? error : new Error(String(error)));
    }
  }

  public dispose(): void {
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.close();
      } catch (error) {
        this.emit("error", error instanceof Error ? error : new Error(String(error)));
      }
      this.socket = null;
    }
    this.isReady = false;
    this.emit("status", { status: "closed" });
  }

  public get ready(): boolean {
    return this.isReady;
  }
}

export default LocalAsrClient;
