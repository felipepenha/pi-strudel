import { describe, it, expect } from "vitest";
import { StateStore } from "../extensions/strudel/engine/state-store.js";
import { ReplEngine } from "../extensions/strudel/engine/repl-engine.js";

describe("Bugfix: chord voicings and rootNotes with rests and objects", () => {
  it("evaluates chord('<Dm9 G13 Cmaj9 A7alt>').voicings('lefthand') without match is not a function error", () => {
    const store = new StateStore();
    const engine = new ReplEngine(store);

    const code = 'chord("<Dm9 G13 Cmaj9 A7alt>").voicings(\'lefthand\').s("gm_epiano1")';
    const compiled = engine.compileTrack(code);
    expect(compiled.error).toBeUndefined();
    expect(compiled.pattern).toBeDefined();

    // Query across 1 cycle: should produce multiple voiced haps
    const haps = compiled.pattern.queryArc(0, 1);
    expect(haps.length).toBeGreaterThan(0);
    expect(haps[0].value.note).toBeDefined();
    expect(haps[0].value.s).toBe("gm_epiano1");
  });

  it("handles complex syncopated chords with rests [~ Dm9] without throwing or muting", () => {
    const store = new StateStore();
    const engine = new ReplEngine(store);

    const code =
      'chord("<[~ Dm9 ~ Dm9] [~ G13 ~ [~ G13]] [~ Cmaj9 ~ Cmaj9] [~ Em7 ~ A7b9]>").voicings(\'lefthand\').s("gm_epiano1")';
    const compiled = engine.compileTrack(code);
    expect(compiled.error).toBeUndefined();
    expect(compiled.pattern).toBeDefined();

    const haps = compiled.pattern.queryArc(0, 1);
    expect(haps.length).toBeGreaterThan(0);
  });

  it("handles rootNotes on chords with rests cleanly", () => {
    const store = new StateStore();
    const engine = new ReplEngine(store);

    const code = 'chord("<[~ Dm9] [~ G13]>").rootNotes(2).s("sawtooth")';
    const compiled = engine.compileTrack(code);
    expect(compiled.error).toBeUndefined();
    expect(compiled.pattern).toBeDefined();

    const haps = compiled.pattern.queryArc(0, 1);
    expect(haps.length).toBeGreaterThan(0);
    expect(haps[0].value.s).toBe("sawtooth");
  });
});
