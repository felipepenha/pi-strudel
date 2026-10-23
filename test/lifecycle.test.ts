import { describe, it, expect, vi } from "vitest";
import { StateStore } from "../extensions/strudel/engine/state-store.js";
import { ReplEngine } from "../extensions/strudel/engine/repl-engine.js";
import { AudioBridge } from "../extensions/strudel/engine/audio-bridge.js";

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
});
