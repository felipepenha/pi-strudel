import { describe, it, expect } from "vitest";
import {
  classifyInput,
  formatSessionStateHeader,
  handleInputEvent,
} from "../extensions/strudel/router/input-interceptor.js";
import { StateStore } from "../extensions/strudel/engine/state-store.js";
import { ReplEngine } from "../extensions/strudel/engine/repl-engine.js";

describe("Phase 2: Input Interceptor & Classification", () => {
  it("classifies track assignments ($d1: s('bd*4'))", () => {
    const res = classifyInput('$d1: s("bd*4")');
    expect(res).toEqual({
      kind: "track_assign",
      trackId: "d1",
      code: 's("bd*4")',
    });

    const resEq = classifyInput('$drums = note("<c2 eb2>")');
    expect(resEq).toEqual({
      kind: "track_assign",
      trackId: "drums",
      code: 'note("<c2 eb2>")',
    });
  });

  it("classifies raw bang expressions (!note('c3'))", () => {
    const res = classifyInput('!note("c3")');
    expect(res).toEqual({
      kind: "raw_eval",
      code: 'note("c3")',
    });
  });

  it("classifies bare root constructors (stepcat, arrange, s, note, chord, etc.)", () => {
    expect(classifyInput('stepcat("a [b c]", "d")')).toEqual({
      kind: "raw_eval",
      code: 'stepcat("a [b c]", "d")',
    });

    expect(classifyInput('arrange([8, intro], [16, drop])')).toEqual({
      kind: "raw_eval",
      code: 'arrange([8, intro], [16, drop])',
    });

    expect(classifyInput('s("bd sd")')).toEqual({
      kind: "raw_eval",
      code: 's("bd sd")',
    });

    expect(classifyInput('note("c3 e3 g3")')).toEqual({
      kind: "raw_eval",
      code: 'note("c3 e3 g3")',
    });

    expect(classifyInput('chord("<Cm9 Fm9>")')).toEqual({
      kind: "raw_eval",
      code: 'chord("<Cm9 Fm9>")',
    });
  });

  it("classifies plain English strings and slash commands as natural_language", () => {
    expect(classifyInput("Add a syncopated Euclidean hi-hat")).toEqual({
      kind: "natural_language",
    });

    expect(classifyInput("Make the pad more ambient and warm")).toEqual({
      kind: "natural_language",
    });

    expect(classifyInput("/hush")).toEqual({
      kind: "natural_language",
    });

    expect(classifyInput("/bpm 140")).toEqual({
      kind: "natural_language",
    });
  });

  it("enriches prompt with session state header when session is active", async () => {
    const store = new StateStore();
    store.setTrack("drums", 's("bd*4")');
    store.setPlaying(true);

    const header = formatSessionStateHeader(store);
    expect(header).toContain("Active Strudel Session State: CPS=0.50 (120 BPM)");
    expect(header).toContain("$drums: s(\"bd*4\")");

    const engine = new ReplEngine(store);
    const mockCtx = {
      ui: {
        setWidget: () => {},
        setStatus: () => {},
      },
    } as any;
    const mockPi = {
      appendEntry: () => {},
    } as any;

    const result = await handleInputEvent(
      { text: "drop the bass", type: "input", source: "user" as any },
      mockCtx,
      mockPi,
      store,
      engine
    );

    expect(result.action).toBe("transform");
    if (result.action === "transform") {
      expect(result.text).toContain("[Active Strudel Session State");
      expect(result.text).toContain("drop the bass");
    }
  });

  it("handles track_assign immediately without LLM turn", async () => {
    const store = new StateStore();
    const engine = new ReplEngine(store);
    let appendedType = "";
    let appendedData: any = null;

    const mockCtx = {
      ui: {
        setWidget: () => {},
        setStatus: () => {},
      },
    } as any;
    const mockPi = {
      appendEntry: (type: string, data: any) => {
        appendedType = type;
        appendedData = data;
      },
    } as any;

    const result = await handleInputEvent(
      { text: '$d1: s("bd*4")', type: "input", source: "user" as any },
      mockCtx,
      mockPi,
      store,
      engine
    );

    expect(result.action).toBe("handled");
    expect(store.getTrack("d1")?.code).toBe('s("bd*4")');
    expect(store.isPlaying()).toBe(true);
    expect(appendedType).toBe("strudel/state");
    expect(appendedData.tracks["d1"].code).toBe('s("bd*4")');
  });
});
