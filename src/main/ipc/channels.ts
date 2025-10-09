export const IPC_CHANNELS = {
  LOOPBACK_STATUS: 'loopback/status',
  LOOPBACK_AUDIO_CHUNK: 'loopback/audio-chunk',
  LOOPBACK_READY: 'loopback/ready',
  TRANSCRIPT_PARTIAL: 'transcript/partial',
  TRANSCRIPT_FINAL: 'transcript/final',
  AUTOSUGGEST_READY: 'autosuggest/ready',
  AUTOSUGGEST_RESULT: 'autosuggest/result',
  STATUS_SNAPSHOT: 'status/snapshot',
  REQUEST_STATUS: 'status/request',
  REQUEST_KNOWLEDGE: 'knowledge/request',
  KNOWLEDGE_PAYLOAD: 'knowledge/payload',
  MODE_OVERRIDE: 'mode/override',
  GOVERNOR_FLAG: 'governor/flag',
  HOTKEY_TRIGGER: 'deck/hotkey'
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
