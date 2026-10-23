import type { AudioMode } from "./state-store.js";

export class AudioBridge {
  private mode: AudioMode = "node";

  constructor(mode: AudioMode = "node") {
    this.mode = mode;
  }

  getMode(): AudioMode {
    return this.mode;
  }

  async setMode(mode: AudioMode): Promise<void> {
    this.mode = mode;
  }

  dispatchHaps(haps: any[], timeSec: number): void {
    // Audio synthesis dispatch implemented in Phase 3
  }

  async dispose(): Promise<void> {
    // Cleanup sockets, contexts
  }
}

export const globalAudioBridge = new AudioBridge();
