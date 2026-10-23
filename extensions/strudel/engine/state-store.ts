export interface TrackState {
  id: string;
  code: string;
  muted: boolean;
  soloed: boolean;
}

export type AudioMode = "node" | "browser" | "osc";

export interface SerializedStrudelState {
  cps: number;
  bpm: number;
  playing: boolean;
  audioMode: AudioMode;
  tracks: Record<string, TrackState>;
}

export class StateStore {
  private cps = 0.5; // Modern Strudel default: 0.5 CPS = 120 BPM in 4/4
  private playing = false;
  private audioMode: AudioMode = "node";
  private tracks = new Map<string, TrackState>();
  private listeners = new Set<() => void>();

  constructor() {}

  getCps(): number {
    return this.cps;
  }

  setCps(cps: number): void {
    if (cps > 0) {
      this.cps = cps;
      this.notify();
    }
  }

  getBpm(beatsPerCycle = 4): number {
    return this.cps * 60 * beatsPerCycle;
  }

  setBpm(bpm: number, beatsPerCycle = 4): void {
    if (bpm > 0) {
      this.cps = bpm / (60 * beatsPerCycle);
      this.notify();
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.notify();
  }

  getAudioMode(): AudioMode {
    return this.audioMode;
  }

  setAudioMode(mode: AudioMode): void {
    this.audioMode = mode;
    this.notify();
  }

  getTracks(): Map<string, TrackState> {
    return this.tracks;
  }

  getTrack(id: string): TrackState | undefined {
    return this.tracks.get(id);
  }

  setTrack(id: string, code: string, muted = false, soloed = false): void {
    const existing = this.tracks.get(id);
    this.tracks.set(id, {
      id,
      code,
      muted: existing ? existing.muted : muted,
      soloed: existing ? existing.soloed : soloed,
    });
    this.notify();
  }

  deleteTrack(id: string): boolean {
    const res = this.tracks.delete(id);
    if (res) this.notify();
    return res;
  }

  clearTracks(): void {
    this.tracks.clear();
    this.notify();
  }

  toggleMute(id: string): boolean {
    const track = this.tracks.get(id);
    if (track) {
      track.muted = !track.muted;
      this.notify();
      return track.muted;
    }
    return false;
  }

  setMute(id: string, muted: boolean): void {
    const track = this.tracks.get(id);
    if (track) {
      track.muted = muted;
      this.notify();
    }
  }

  muteAll(): void {
    for (const track of this.tracks.values()) {
      track.muted = true;
    }
    this.notify();
  }

  unmuteAll(): void {
    for (const track of this.tracks.values()) {
      track.muted = false;
    }
    this.notify();
  }

  toggleSolo(id: string): boolean {
    const track = this.tracks.get(id);
    if (track) {
      track.soloed = !track.soloed;
      this.notify();
      return track.soloed;
    }
    return false;
  }

  setSolo(id: string, soloed: boolean): void {
    const track = this.tracks.get(id);
    if (track) {
      track.soloed = soloed;
      this.notify();
    }
  }

  clearSolo(): void {
    for (const track of this.tracks.values()) {
      track.soloed = false;
    }
    this.notify();
  }

  serialize(): SerializedStrudelState {
    const tracksObj: Record<string, TrackState> = {};
    for (const [k, v] of this.tracks.entries()) {
      tracksObj[k] = { ...v };
    }
    return {
      cps: this.cps,
      bpm: this.getBpm(),
      playing: this.playing,
      audioMode: this.audioMode,
      tracks: tracksObj,
    };
  }

  deserialize(data: Partial<SerializedStrudelState>): void {
    if (typeof data.cps === "number" && data.cps > 0) {
      this.cps = data.cps;
    }
    if (typeof data.playing === "boolean") {
      this.playing = data.playing;
    }
    if (data.audioMode && ["node", "browser", "osc"].includes(data.audioMode)) {
      this.audioMode = data.audioMode;
    }
    if (data.tracks && typeof data.tracks === "object") {
      this.tracks.clear();
      for (const [k, v] of Object.entries(data.tracks)) {
        this.tracks.set(k, {
          id: v.id || k,
          code: v.code || "",
          muted: Boolean(v.muted),
          soloed: Boolean(v.soloed),
        });
      }
    }
    this.notify();
  }

  reset(): void {
    this.cps = 0.5;
    this.playing = false;
    this.tracks.clear();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error("StateStore listener error:", err);
      }
    }
  }
}

export const globalStateStore = new StateStore();
