import * as core from "@strudel/core";
import * as mini from "@strudel/mini";
import * as tonal from "@strudel/tonal";
import * as xen from "@strudel/xen";
import { transpiler } from "@strudel/transpiler";
import { StateStore, globalStateStore } from "./state-store.js";
import { AudioBridge, globalAudioBridge } from "./audio-bridge.js";
import { highlightCode, type HighlightSpan } from "./highlighter.js";
import chordVoicingsModule from "chord-voicings";

const { dictionaryVoicing, minTopNoteDiff } =
  (chordVoicingsModule as any)?.default || chordVoicingsModule;

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

    // Register robust voicings that handle object values { chord: '...' }, rests (~), and fallback dictionaries
    let lastVoicing: any;
    (core as any).register("voicings", function (dictName: any, pat: any) {
      const dictKey = typeof dictName === "string" ? dictName : "ireal";
      const entry = (tonal as any).voicingRegistry?.[dictKey] || (tonal as any).voicingRegistry?.ireal;
      const dictionary = entry?.dictionary || {};
      const range = entry?.range || ["F3", "A4"];

      return pat
        .fmap((val: any) => {
          const chord = typeof val === "string" ? val : (val?.chord || val?.value || "");
          if (!chord || typeof chord !== "string" || chord === "~" || chord === "-") {
            return (core as any).silence;
          }
          const clean = chord.trim();
          try {
            const voiced = dictionaryVoicing({
              chord: clean,
              dictionary,
              range,
              picker: minTopNoteDiff,
              lastVoicing,
            });
            if (voiced && voiced.length > 0) {
              lastVoicing = voiced;
              return (core as any).stack(...voiced.map((n: string) => (core as any).note(n)));
            }
            if (dictKey !== "ireal" && (tonal as any).voicingRegistry?.ireal) {
              const fallback = dictionaryVoicing({
                chord: clean,
                dictionary: (tonal as any).voicingRegistry.ireal.dictionary,
                range,
                picker: minTopNoteDiff,
                lastVoicing,
              });
              if (fallback && fallback.length > 0) {
                lastVoicing = fallback;
                return (core as any).stack(...fallback.map((n: string) => (core as any).note(n)));
              }
            }
            return (core as any).silence;
          } catch {
            return (core as any).silence;
          }
        })
        .outerJoin();
    });

    (core as any).register("rootNotes", function (octave: any, pat: any) {
      const oct = typeof octave === "number" ? octave : 3;
      return pat
        .fmap((val: any) => {
          const chord = typeof val === "string" ? val : (val?.chord || val?.value || "");
          if (!chord || typeof chord !== "string" || chord === "~" || chord === "-") {
            return (core as any).silence;
          }
          const match = chord.trim().match(/^([a-gA-G][b#]?)/);
          if (!match) return (core as any).silence;
          const noteName = match[1].toLowerCase() + oct;
          return (core as any).note(noteName);
        })
        .outerJoin();
    });

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

    // Prevent catch-up burst on event-loop lag: if the cycle advanced by more than 0.25 cycles (e.g. LLM inference pause),
    // clamp lastDispatchedCycle so we skip past cycles instead of dumping dozens of accumulated notes into the audio bus at once
    const maxLagWindowCycles = 0.25;
    if (nowCycle - this.lastDispatchedCycle > maxLagWindowCycles) {
      this.lastDispatchedCycle = nowCycle - 0.05;
    }

    if (this.masterPattern && nowCycle > this.lastDispatchedCycle) {
      try {
        const haps = this.masterPattern.queryArc(this.lastDispatchedCycle, nowCycle);
        if (haps && haps.length > 0) {
          const cps = this.stateStore.getCps() || 0.5;
          this.audioBridge.dispatchHaps(haps, this.lastDispatchedCycle, cps);
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
