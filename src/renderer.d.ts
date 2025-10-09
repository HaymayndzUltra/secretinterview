export interface ElectronAPI {
  saveTempAudioFile(audioEncoded: ArrayBuffer): unknown;
  transcribeAudioFile(tempFilePath: any, arg1: { primaryLanguage: string; secondaryLanguage: string; api_base: any; openai_key: any; }): TranscriptionResult | PromiseLike<TranscriptionResult>;
  getConfig: () => Promise<any>;
  setConfig: (config: any) => Promise<void>;
  testLocalLLMConfig: (config: any) => Promise<{ success: boolean, error?: string }>;
  startRecording: () => Promise<Array<{id: string, name: string, thumbnail: string}>>;
  parsePDF: (pdfBuffer: ArrayBuffer) => Promise<{ text: string, error?: string }>;
  processImage: (imagePath: string) => Promise<string>;
  highlightCode: (code: string, language: string) => Promise<string>;
  getSystemAudioStream: () => Promise<string[]>;
  ipcRenderer: {
    removeAllListeners: any;
    invoke(channel: string, ...args: any[]): Promise<any>;
    send(channel: string, ...args: any[]): void;
    on(channel: string, listener: (event: any, ...args: any[]) => void): () => void;
    removeListener(channel: string, listener: (...args: any[]) => void): void;
  };
  callLocalLLM: (params: {
    config: any;
    messages: any[];
    signal?: AbortSignal;
  }) => Promise<{ content: string } | { error: string }>;
  transcribeAudio: (audioBuffer: ArrayBuffer, config: any) => Promise<TranscriptionResult>;
  readPromptTemplate: (templateName: string) => Promise<{ content: string } | { error: string }>;
  listPromptTemplates: () => Promise<{ templates: Array<{ name: string; filename: string }> } | { error: string }>;
  checkLocalAsrAvailability: () => Promise<any>;
  startLocalAsr: (options: any) => Promise<{ success: boolean; error?: string }>;
  stopLocalAsr: () => Promise<{ success: boolean }>;
  sendAudioToLocalAsr: (audioBuffer: ArrayBuffer) => void;
  loadKnowledgeContext: () => Promise<{
    permanent: Array<{ fileName: string; title: string; content: string; path: string }>;
    project: { fileName: string; title: string; content: string; path: string } | null;
    availableProjects: string[];
    error?: string;
  }>;
  saveProjectKnowledge: (payload: { content: string; fileName?: string }) => Promise<{ success: boolean; error?: string }>;
  setActiveProject: (fileName: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

declare global {
  interface MediaTrackConstraintSet {
    chromeMediaSource?: string;
    mandatory?: {
      chromeMediaSource?: string;
      chromeMediaSourceId?: string;
    };
  }
}
