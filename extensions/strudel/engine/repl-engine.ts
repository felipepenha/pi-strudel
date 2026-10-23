import { StateStore, globalStateStore } from "./state-store.js";
import { AudioBridge, globalAudioBridge } from "./audio-bridge.js";

export class ReplEngine {
  private stateStore: StateStore;
  private audioBridge: AudioBridge;
  private running = false;
  private currentCycle = 0;

  constructor(stateStore: StateStore = globalStateStore, audioBridge: AudioBridge = globalAudioBridge) {
    this.stateStore = stateStore;
    this.audioBridge = audioBridge;
  }

  start(): void {
    this.running = true;
    this.stateStore.setPlaying(true);
  }

  stop(): void {
    this.running = false;
    this.stateStore.setPlaying(false);
  }

  isRunning(): boolean {
    return this.running;
  }

  getCurrentCycle(): number {
    return this.currentCycle;
  }

  recompileAll(): void {
    // Implemented in Phase 3
  }

  dispose(): void {
    this.stop();
  }
}

export const globalReplEngine = new ReplEngine();
