import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../main/ipc/channels.js';
import type { RefinedSuggestionsResult, StatusSnapshot, TranscriptSegment, WhisperPartial, ConversationMode } from '@shared/types';

type Listener<T> = (payload: T) => void;

const api = {
  sendAudioChunk(buffer: ArrayBuffer) {
    ipcRenderer.send(IPC_CHANNELS.LOOPBACK_AUDIO_CHUNK, buffer);
  },
  requestStatus(): Promise<StatusSnapshot> {
    return ipcRenderer.invoke(IPC_CHANNELS.REQUEST_STATUS);
  },
  onStatus(listener: Listener<StatusSnapshot>) {
    ipcRenderer.on(IPC_CHANNELS.STATUS_SNAPSHOT, (_event, payload: StatusSnapshot) => listener(payload));
  },
  onPartial(listener: Listener<WhisperPartial>) {
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPT_PARTIAL, (_event, payload: WhisperPartial) => listener(payload));
  },
  onFinal(listener: Listener<TranscriptSegment>) {
    ipcRenderer.on(IPC_CHANNELS.TRANSCRIPT_FINAL, (_event, payload: TranscriptSegment) => listener(payload));
  },
  onAutosuggest(listener: Listener<RefinedSuggestionsResult>) {
    ipcRenderer.on(IPC_CHANNELS.AUTOSUGGEST_RESULT, (_event, payload: RefinedSuggestionsResult) => listener(payload));
  },
  overrideMode(mode: ConversationMode) {
    ipcRenderer.send(IPC_CHANNELS.MODE_OVERRIDE, mode);
  },
  sendHotkey(index: number) {
    ipcRenderer.send(IPC_CHANNELS.HOTKEY_TRIGGER, index);
  }
};

contextBridge.exposeInMainWorld('interview', api);

declare global {
  interface Window {
    interview: typeof api;
  }
}
