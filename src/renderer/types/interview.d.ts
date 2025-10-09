import type {
  ConversationMode,
  RefinedSuggestionsResult,
  StatusSnapshot,
  TranscriptSegment,
  WhisperPartial
} from '@shared/types';

declare global {
  interface Window {
    interview: {
      sendAudioChunk(buffer: ArrayBuffer): void;
      requestStatus(): Promise<StatusSnapshot>;
      onStatus(listener: (payload: StatusSnapshot) => void): void;
      onPartial(listener: (payload: WhisperPartial) => void): void;
      onFinal(listener: (payload: TranscriptSegment) => void): void;
      onAutosuggest(listener: (payload: RefinedSuggestionsResult) => void): void;
      overrideMode(mode: ConversationMode): void;
      sendHotkey(index: number): void;
    };
  }
}

export {};
