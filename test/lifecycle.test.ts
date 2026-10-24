import { describe, it, expect, vi } from "vitest";
import { StateStore } from "../extensions/strudel/engine/state-store.js";
import { ReplEngine } from "../extensions/strudel/engine/repl-engine.js";
import { AudioBridge } from "../extensions/strudel/engine/audio-bridge.js";
import { ReplWidgetRenderer } from "../extensions/strudel/ui/repl-widget.js";

describe("Phase 1: Scaffolding and Lifecycle", () => {
  it("initializes StateStore with default 0.5 CPS and 120 BPM", () => {
    const store = new StateStore();
    expect(store.getCps()).toBe(0.5);
    expect(store.getBpm()).toBe(120);
    expect(store.isPlaying()).toBe(false);
  });

  it("serializes and deserializes state accurately", () => {
    const store = new StateStore();
    store.setCps(0.6);
    store.setPlaying(true);
    store.setTrack("d1", 's("bd*4")');

    const serialized = store.serialize();
    expect(serialized.cps).toBe(0.6);
    expect(serialized.playing).toBe(true);
    expect(serialized.tracks["d1"].code).toBe('s("bd*4")');

    const newStore = new StateStore();
    newStore.deserialize(serialized);
    expect(newStore.getCps()).toBe(0.6);
    expect(newStore.isPlaying()).toBe(true);
    expect(newStore.getTrack("d1")?.code).toBe('s("bd*4")');
  });

  it("ReplEngine starts and stops cleanly", () => {
    const store = new StateStore();
    const bridge = new AudioBridge();
    const engine = new ReplEngine(store, bridge);

    engine.start();
    expect(engine.isRunning()).toBe(true);
    expect(store.isPlaying()).toBe(true);

    engine.stop();
    expect(engine.isRunning()).toBe(false);
    expect(store.isPlaying()).toBe(false);
  });

  it("ReplWidgetRenderer flattens multi-line tracks and caps lines to prevent terminal flickering", () => {
    const store = new StateStore();
    const widget = new ReplWidgetRenderer();

    // Set 8 tracks with long multi-line codes
    store.setTrack("bass", `note("<\n  [d2 ~ ~ d2]  [~ d3 ~ d2]\n  [d2 ~ ~ d2]  [~ b2 ~ b3]\n>")\n  .s("sawtooth")\n  .lpf(1750)`);
    store.setTrack("chords", `note("<\n  [~ [f4,a4,c5,e5] ~ ~]\n  [~ [f4,b4,d5,e5] ~ [g4,a4,cs5,f5]]\n>")\n  .s("keys")`);
    store.setTrack("kick", `s("[bd ~] ~ [~ bd] ~")\n  .gain(1.15)`);
    store.setTrack("snare", `s("~ sd ~ sd")\n  .gain(0.95)`);
    store.setTrack("hats", `s("hh*16")\n  .gain("[0.8 0.35 0.6 0.35 0.85 0.35 0.6 0.45]*2")`);
    store.setTrack("ghost_snare", `s("[~ [sd:1?0.5]] [~ [sd:1?0.3]]")\n  .gain(0.35)`);
    store.setTrack("open_hat", `s("~ ~ ~ [~ oh]")\n  .gain(0.45)`);
    store.setTrack("rim", `s("~ rim ~ [rim ~]")\n  .gain(0.5)`);

    const lines = widget.formatWidgetLines(store, 10.5);

    // 8 tracks + header + footer = strictly 10 lines
    expect(lines.length).toBe(10);

    // Guaranteed ZERO embedded newlines across all lines
    for (const line of lines) {
      expect(line).not.toContain("\n");
      expect(line).not.toContain("\r");
    }
  });
});
