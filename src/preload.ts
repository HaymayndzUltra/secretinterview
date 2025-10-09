import { contextBridge, ipcRenderer } from 'electron';
import fs from 'fs';
import path from 'path';

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  setConfig: (config: any) => ipcRenderer.invoke('set-config', config),
  testLocalLlm: (config: any) => ipcRenderer.invoke('test-local-llm', config),
  parsePDF: (buffer: ArrayBuffer) => ipcRenderer.invoke('parsePDF', buffer),
  processImage: (path: string) => ipcRenderer.invoke('process-image', path),
  highlightCode: (code: string, language: string) => ipcRenderer.invoke('highlight-code', code, language),
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
      ipcRenderer.on(channel, listener);
      return () => ipcRenderer.removeListener(channel, listener);
    },
    removeListener: (channel: string, listener: (event: any, ...args: any[]) => void) => ipcRenderer.removeListener(channel, listener),
  },
  callLocalLlm: (params: any) => ipcRenderer.invoke('call-local-llm', params),
  loadAudioProcessor: (): Promise<string> => ipcRenderer.invoke('load-audio-processor'),
  getSystemAudioStream: () => ipcRenderer.invoke('get-system-audio-stream'),
  transcribeAudioFile: (filePath: string, config: any) => ipcRenderer.invoke('transcribe-audio-file', filePath, config),
  saveTempAudioFile: (audioBuffer: ArrayBuffer) => ipcRenderer.invoke('save-temp-audio-file', audioBuffer),
  transcribeAudio: (audioBuffer: ArrayBuffer, config: any) => ipcRenderer.invoke('transcribe-audio', audioBuffer, config),
  readPromptTemplate: (templateName: string) => ipcRenderer.invoke('read-prompt-template', templateName),
  listPromptTemplates: () => ipcRenderer.invoke('list-prompt-templates'),
  loadKnowledgeContext: () => ipcRenderer.invoke('load-knowledge-context'),
  checkLocalAsrAvailability: () => ipcRenderer.invoke('check-local-asr'),
  startLocalAsr: (options: any) => ipcRenderer.invoke('start-local-asr', options),
  stopLocalAsr: () => ipcRenderer.invoke('stop-local-asr'),
  sendAudioToLocalAsr: (audioBuffer: ArrayBuffer) => ipcRenderer.send('send-audio-to-local-asr', audioBuffer),
});
