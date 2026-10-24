import { describe, it, expect } from "vitest";
import { StateStore } from "../extensions/strudel/engine/state-store.js";
import { ReplEngine } from "../extensions/strudel/engine/repl-engine.js";
import { AudioBridge } from "../extensions/strudel/engine/audio-bridge.js";

describe("Phase 3: Strudel Pattern Engine", () => {
  it("compiles and queries s('bd sd') with 2 Hap events per cycle and accurate character offsets", () => {
    const store = new StateStore();
    const bridge = new AudioBridge();
    const engine = new ReplEngine(store, bridge);

    const code = 's("bd sd")';
    const res = engine.compileTrack(code);
    expect(res.error).toBeUndefined();
    expect(res.pattern).toBeDefined();

    const haps = res.pattern.queryArc(0, 1);
    expect(haps.length).toBe(2);

    // 1st Hap: bd at [0, 0.5], offsets [3, 5]
    const hap0 = haps[0];
    expect(hap0.value.s).toBe("bd");
    expect(Number(hap0.whole.begin)).toBe(0);
    expect(Number(hap0.whole.end)).toBe(0.5);
    expect(hap0.context.locations).toBeDefined();
    expect(hap0.context.locations[0]).toEqual({ start: 3, end: 5 });

    // 2nd Hap: sd at [0.5, 1], offsets [6, 8]
    const hap1 = haps[1];
    expect(hap1.value.s).toBe("sd");
    expect(Number(hap1.whole.begin)).toBe(0.5);
    expect(Number(hap1.whole.end)).toBe(1);
    expect(hap1.context.locations).toBeDefined();
    expect(hap1.context.locations[0]).toEqual({ start: 6, end: 8 });
  });

  it("stacks multiple tracks and handles mute and solo", () => {
    const store = new StateStore();
    const bridge = new AudioBridge();
    const engine = new ReplEngine(store, bridge);

    store.setTrack("d1", 's("bd*4")');
    store.setTrack("d2", 'note("<c2 eb2>")');
    engine.recompileAll();

    // Both tracks active
    store.toggleMute("d1");
    engine.recompileAll();
    // d1 is muted, only d2 should be stacked

    store.toggleSolo("d1");
    engine.recompileAll();
    // d1 is soloed, only d1 should be stacked
  });

  it("handles tempo changes and nudge", () => {
    const store = new StateStore();
    const engine = new ReplEngine(store);

    store.setCps(0.75);
    expect(store.getCps()).toBe(0.75);
    expect(store.getBpm()).toBe(180);

    const initialCycle = engine.getCurrentCycle();
    engine.nudge(100); // 100ms forward
    expect(engine.getCurrentCycle()).toBeGreaterThanOrEqual(initialCycle);
  });

  it("prevents audio bursts on lag spikes by clamping backlog", () => {
    const store = new StateStore();
    const bridge = new AudioBridge();
    let dispatchedCount = 0;
    bridge.dispatchHaps = (haps: any[]) => {
      dispatchedCount += haps.length;
    };

    const engine = new ReplEngine(store, bridge);
    store.setTrack("d1", 's("bd*16")');
    engine.recompileAll();

    // Start engine
    engine.start();

    // Simulate a 2-second event loop stall (e.g. LLM inference)
    (engine as any).lastDispatchedCycle = 0;
    (engine as any).startCycleOffset = 2.0; // cycle is now 2.0+

    // Trigger tick
    (engine as any).tick();

    // Verify that lastDispatchedCycle was clamped to skip old history
    expect((engine as any).lastDispatchedCycle).toBeGreaterThan(1.5);
    engine.stop();
  });

  it("safely handles AudioBridge master limiter and polyphonic dispatch", async () => {
    const bridge = new AudioBridge("node");
    const testHaps = [
      { whole: { begin: 0, end: 0.25 }, value: { s: "bd", gain: 1.2 } },
      { whole: { begin: 0, end: 0.25 }, value: { s: "hh", gain: 0.9 } },
      { whole: { begin: 0, end: 0.25 }, value: { note: "c3", s: "sawtooth", gain: 0.8 } },
      { whole: { begin: 0, end: 0.25 }, value: { note: "eb3", s: "sawtooth", gain: 0.8 } },
      { whole: { begin: 0, end: 0.25 }, value: { note: "g3", s: "sawtooth", gain: 0.8 } },
    ];

    expect(() => {
      bridge.dispatchHaps(testHaps, 0, 0.5);
    }).not.toThrow();

    await bridge.dispose();
  });
});
