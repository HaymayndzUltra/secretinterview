import type { ConversationMode, StatusSnapshot } from '@shared/types';

export class SystemState {
  private asrReady = false;
  private llmReady = false;
  private dbReady = false;
  private mode: ConversationMode = 'discovery';

  public updateAsrReady(ready: boolean) {
    this.asrReady = ready;
  }

  public updateLlmReady(ready: boolean) {
    this.llmReady = ready;
  }

  public updateDbReady(ready: boolean) {
    this.dbReady = ready;
  }

  public setMode(mode: ConversationMode) {
    this.mode = mode;
  }

  public snapshot(): StatusSnapshot {
    return {
      asrReady: this.asrReady,
      llmReady: this.llmReady,
      dbReady: this.dbReady,
      mode: this.mode
    };
  }
}
