import { describe, it, expect } from "vitest";
import { StateStore } from "../extensions/strudel/engine/state-store.js";
import { ReplEngine } from "../extensions/strudel/engine/repl-engine.js";
import { AudioBridge } from "../extensions/strudel/engine/audio-bridge.js";
import { registerSlashCommands } from "../extensions/strudel/commands/slash-commands.js";
import { registerAgentTools } from "../extensions/strudel/tools/agent-tools.js";

describe("Phase 4: Slash Commands & Agent Tools", () => {
  it("registers and executes slash commands correctly", async () => {
    const store = new StateStore();
    const bridge = new AudioBridge();
    const engine = new ReplEngine(store, bridge);

    const commands = new Map<string, any>();
    const mockPi = {
      registerCommand: (name: string, def: any) => {
        commands.set(name, def);
      },
      appendEntry: () => {},
    } as any;

    registerSlashCommands(mockPi, store, engine, bridge);

    const notifications: string[] = [];
    const mockCtx = {
      cwd: "/tmp",
      ui: {
        setWidget: () => {},
        setStatus: () => {},
        notify: (msg: string) => notifications.push(msg),
      },
    } as any;

    // Test /bpm
    expect(commands.has("bpm")).toBe(true);
    await commands.get("bpm").handler("140", mockCtx);
    expect(store.getBpm()).toBe(140);
    expect(store.getCps()).toBe(140 / 240);

    // Test /cps
    expect(commands.has("cps")).toBe(true);
    await commands.get("cps").handler("0.5", mockCtx);
    expect(store.getCps()).toBe(0.5);

    // Test /track
    expect(commands.has("track")).toBe(true);
    await commands.get("track").handler('drums s("bd*4")', mockCtx);
    expect(store.getTrack("drums")?.code).toBe('s("bd*4")');
    expect(store.isPlaying()).toBe(true);

    // Test /mute
    expect(commands.has("mute")).toBe(true);
    await commands.get("mute").handler("drums", mockCtx);
    expect(store.getTrack("drums")?.muted).toBe(true);

    // Test /solo
    expect(commands.has("solo")).toBe(true);
    await commands.get("solo").handler("drums", mockCtx);
    expect(store.getTrack("drums")?.soloed).toBe(true);

    // Test /preset
    expect(commands.has("preset")).toBe(true);
    await commands.get("preset").handler("techno", mockCtx);
    expect(store.getTrack("acid")).toBeDefined();
    expect(store.getTrack("bass")).toBeDefined();
    expect(store.getCps()).toBe(0.54);

    // Test /hush
    expect(commands.has("hush")).toBe(true);
    await commands.get("hush").handler("", mockCtx);
    expect(store.isPlaying()).toBe(false);
  });

  it("executes strudel_upsert_tracks, strudel_get_state, and strudel_hush tools", async () => {
    const store = new StateStore();
    const bridge = new AudioBridge();
    const engine = new ReplEngine(store, bridge);

    const tools = new Map<string, any>();
    const mockPi = {
      registerTool: (def: any) => {
        tools.set(def.name, def);
      },
      appendEntry: () => {},
    } as any;

    registerAgentTools(mockPi, store, engine);

    const mockCtx = {
      ui: {
        setWidget: () => {},
        setStatus: () => {},
      },
    } as any;

    // 1. strudel_upsert_tracks with valid code
    const upsertTool = tools.get("strudel_upsert_tracks");
    expect(upsertTool).toBeDefined();

    const resValid = await upsertTool.execute(
      "call-1",
      {
        tracks: [
          { id: "d1", code: 's("bd*4")' },
          { id: "d2", code: 'note("<c2 eb2>")' },
        ],
        cps: 0.6,
      },
      undefined,
      undefined,
      mockCtx
    );

    expect(resValid.isError).toBe(false);
    expect(store.getCps()).toBe(0.6);
    expect(store.getTrack("d1")?.code).toBe('s("bd*4")');
    expect(store.isPlaying()).toBe(true);

    // 2. strudel_upsert_tracks with syntax error
    const resInvalid = await upsertTool.execute(
      "call-2",
      {
        tracks: [{ id: "bad", code: 's("unclosed string' }],
      },
      undefined,
      undefined,
      mockCtx
    );

    expect(resInvalid.isError).toBe(true);
    expect(resInvalid.content[0].text.toLowerCase()).toContain("compilation error");

    // 3. strudel_get_state
    const getStateTool = tools.get("strudel_get_state");
    const stateRes = await getStateTool.execute("call-3", {}, undefined, undefined, mockCtx);
    expect(stateRes.isError).toBe(false);
    const parsedState = JSON.parse(stateRes.content[0].text);
    expect(parsedState.cps).toBe(0.6);
    expect(parsedState.tracks["d1"]).toBeDefined();

    // 4. strudel_hush
    const hushTool = tools.get("strudel_hush");
    const hushRes = await hushTool.execute("call-4", {}, undefined, undefined, mockCtx);
    expect(hushRes.isError).toBe(false);
    expect(store.isPlaying()).toBe(false);
  });
});
