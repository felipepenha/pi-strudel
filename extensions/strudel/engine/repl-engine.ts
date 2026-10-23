import * as core from "@strudel/core";
import * as mini from "@strudel/mini";
import * as tonal from "@strudel/tonal";
import * as xen from "@strudel/xen";
import { transpiler } from "@strudel/transpiler";
import { StateStore, globalStateStore } from "./state-store.js";
import { AudioBridge, globalAudioBridge } from "./audio-bridge.js";
import { highlightCode, type HighlightSpan } from "./highlighter.js";

export interface CompiledTrack {
  id: string;
  code: string;
  pattern: any;
  miniLocations: Array<{ start: number; end: number }>;
  error?: string;
}

export class ReplEngine {
  private stateStore: StateStore;
  private audioBridge: AudioBridge;
  private running = false;
  private compiledTracks = new Map<string, CompiledTrack>();
  private masterPattern: any = null;

  private schedulerTimer: NodeJS.Timeout | null = null;
  private startHrTime: bigint = process.hrtime.bigint();
  private startCycleOffset = 0;
  private lastDispatchedCycle = 0;
  private currentCycle = 0;

  private evalScope: Record<string, any>;

  constructor(
    stateStore: StateStore = globalStateStore,
    audioBridge: AudioBridge = globalAudioBridge
  ) {
    this.stateStore = stateStore;
    this.audioBridge = audioBridge;

    this.evalScope = {
      ...core,
      ...mini,
      ...tonal,
      ...xen,
      m: (mini as any).m || (mini as any).mini,
      setcps: (cps: number) => this.stateStore.setCps(cps),
      setcpm: (cpm: number) => this.stateStore.setCps(cpm / 60),
      hush: () => this.stop(),
    };

    // React to state store updates
    this.stateStore.subscribe(() => {
      this.syncFromStateStore();
    });
  }

  getScope(): Record<string, any> {
    return this.evalScope;
  }

  compileTrack(code: string): {
    pattern?: any;
    miniLocations: Array<{ start: number; end: number }>;
    error?: string;
  } {
    try {
      const transpiled = transpiler(code, {
        wrapAsync: false,
        addReturn: true,
        emitMiniLocations: true,
      });

      const scopeKeys = Object.keys(this.evalScope);
      const scopeVals = Object.values(this.evalScope);
      const fn = new Function(...scopeKeys, transpiled.output);
      const pat = fn(...scopeVals);

      if (!pat || typeof pat.queryArc !== "function") {
        return {
          miniLocations: transpiled.miniLocations || [],
          error: "Expression did not evaluate to a valid Strudel Pattern.",
        };
      }

      return {
        pattern: pat,
        miniLocations: transpiled.miniLocations || [],
      };
    } catch (err: any) {
      return {
        miniLocations: [],
        error: err.message || String(err),
      };
    }
  }

  recompileAll(): void {
    const tracks = this.stateStore.getTracks();
    this.compiledTracks.clear();

    const activePatterns: any[] = [];
    const hasSolo = Array.from(tracks.values()).some((t) => t.soloed);

    for (const [id, track] of tracks.entries()) {
      const res = this.compileTrack(track.code);
      if (res.pattern) {
        this.compiledTracks.set(id, {
          id,
          code: track.code,
          pattern: res.pattern,
          miniLocations: res.miniLocations,
        });

        // Determine if track should be active in master stack
        const isActive = hasSolo ? track.soloed : !track.muted;
        if (isActive) {
          activePatterns.push(res.pattern);
        }
      } else {
        this.compiledTracks.set(id, {
          id,
          code: track.code,
          pattern: null,
          miniLocations: [],
          error: res.error,
        });
      }
    }

    if (activePatterns.length > 0) {
      this.masterPattern = (core as any).stack(...activePatterns);
    } else {
      this.masterPattern = null;
    }
  }

  private syncFromStateStore(): void {
    // Recompile tracks if tracks set changed
    this.recompileAll();
  }

  getCurrentCycle(): number {
    if (!this.running) {
      return this.currentCycle;
    }
    const elapsedSec = Number(process.hrtime.bigint() - this.startHrTime) / 1e9;
    return this.startCycleOffset + elapsedSec * this.stateStore.getCps();
  }

  nudge(ms: number): void {
    const deltaCycles = (ms / 1000) * this.stateStore.getCps();
    this.startCycleOffset += deltaCycles;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.stateStore.setPlaying(true);
    this.startHrTime = process.hrtime.bigint();
    this.startCycleOffset = this.currentCycle;
    this.lastDispatchedCycle = this.currentCycle;

    if (!this.masterPattern) {
      this.recompileAll();
    }

    this.schedulerTimer = setInterval(() => {
      this.tick();
    }, 25);
  }

  stop(): void {
    this.running = false;
    this.stateStore.setPlaying(false);
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    this.currentCycle = this.getCurrentCycle();
  }

  isRunning(): boolean {
    return this.running;
  }

  private tick(): void {
    if (!this.running) return;

    const nowCycle = this.getCurrentCycle();
    this.currentCycle = nowCycle;

    if (this.masterPattern && nowCycle > this.lastDispatchedCycle) {
      try {
        const haps = this.masterPattern.queryArc(this.lastDispatchedCycle, nowCycle);
        if (haps && haps.length > 0) {
          this.audioBridge.dispatchHaps(haps, Date.now() / 1000);
        }
      } catch (err) {
        console.error("Error during master pattern dispatch:", err);
      }
    }

    this.lastDispatchedCycle = nowCycle;
  }

  getActiveLocations(trackId: string): HighlightSpan[] {
    const compiled = this.compiledTracks.get(trackId);
    if (!compiled || !compiled.pattern) return [];

    const cycle = this.getCurrentCycle();
    try {
      // Query a tiny window around current cycle for active haps
      const haps = compiled.pattern.queryArc(cycle, cycle + 0.01);
      const spans: HighlightSpan[] = [];

      for (const hap of haps) {
        const locations = hap.context?.locations;
        const color = hap.value?.color;
        if (Array.isArray(locations)) {
          for (const loc of locations) {
            if (typeof loc.start === "number" && typeof loc.end === "number") {
              spans.push({
                start: loc.start,
                end: loc.end,
                color,
              });
            }
          }
        }
      }
      return spans;
    } catch {
      return [];
    }
  }

  highlightTrack(trackId: string, code: string): string {
    const spans = this.getActiveLocations(trackId);
    return highlightCode(code, spans);
  }

  dispose(): void {
    this.stop();
    this.compiledTracks.clear();
    this.masterPattern = null;
  }
}

export const globalReplEngine = new ReplEngine();
