import { Type, type Static } from "@sinclair/typebox";
import type { ExtensionAPI, ExtensionToolContext, AgentToolResult } from "@earendil-works/pi-coding-agent";
import type { StateStore } from "../engine/state-store.js";
import type { ReplEngine } from "../engine/repl-engine.js";
import { renderReplWidget } from "../ui/repl-widget.js";

const UpsertTracksParams = Type.Object({
  tracks: Type.Array(
    Type.Object({
      id: Type.String({ description: "Track identifier, e.g. 'drums', 'bass', 'lead'" }),
      code: Type.String({ description: "Strudel code expression for this track" }),
      muted: Type.Optional(Type.Boolean({ description: "Whether this track is muted" })),
    }),
    { description: "Array of tracks to upsert or update" }
  ),
  cps: Type.Optional(
    Type.Number({ description: "Cycles per second (default 0.5 = 120 BPM in 4/4)" })
  ),
});

const EmptyParams = Type.Object({});

export function registerAgentTools(
  pi: ExtensionAPI,
  stateStore: StateStore,
  replEngine: ReplEngine
): void {
  // 1. strudel_upsert_tracks
  pi.registerTool({
    name: "strudel_upsert_tracks",
    label: "Strudel Upsert Tracks",
    description:
      "Updates or creates multi-track Strudel patterns in the live audio session. Validates mini-notation and syntax before updating.",
    parameters: UpsertTracksParams,
    execute: async (
      _toolCallId: string,
      params: Static<typeof UpsertTracksParams>,
      _signal: AbortSignal | undefined,
      _onUpdate: any,
      ctx: ExtensionToolContext
    ): Promise<AgentToolResult<any>> => {
      // Validate all track expressions first
      for (const track of params.tracks) {
        const check = replEngine.compileTrack(track.code);
        if (check.error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Syntax or mini-notation compilation error in track '$${track.id}': ${check.error}\nCode was: ${track.code}`,
              },
            ],
            details: { error: check.error, trackId: track.id },
          };
        }
      }

      // If valid, apply tempo update if provided
      if (typeof params.cps === "number" && params.cps > 0) {
        stateStore.setCps(params.cps);
      }

      // Upsert tracks
      for (const track of params.tracks) {
        stateStore.setTrack(track.id, track.code, Boolean(track.muted));
      }

      stateStore.setPlaying(true);
      replEngine.recompileAll();
      replEngine.start();

      // Checkpoint state into session DAG
      pi.appendEntry("strudel/state", stateStore.serialize());
      renderReplWidget(ctx, stateStore, replEngine.getCurrentCycle());

      const summary = params.tracks.map((t) => `$${t.id}: ${t.code}`).join("\n");
      return {
        isError: false,
        content: [
          {
            type: "text",
            text: `Successfully updated ${params.tracks.length} track(s) in live Strudel session at ${stateStore.getCps()} CPS (${stateStore.getBpm()} BPM):\n${summary}`,
          },
        ],
        details: { tracks: params.tracks, cps: stateStore.getCps() },
      };
    },
  });

  // 2. strudel_get_state
  pi.registerTool({
    name: "strudel_get_state",
    label: "Strudel Get State",
    description: "Returns the active Strudel session state, tempo, and all playing tracks.",
    parameters: EmptyParams,
    execute: async (): Promise<AgentToolResult<any>> => {
      const serialized = stateStore.serialize();
      const currentCycle = replEngine.getCurrentCycle();

      return {
        isError: false,
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...serialized,
                currentCycle: Number(currentCycle.toFixed(2)),
              },
              null,
              2
            ),
          },
        ],
        details: serialized,
      };
    },
  });

  // 3. strudel_hush
  pi.registerTool({
    name: "strudel_hush",
    label: "Strudel Hush",
    description: "Silences all playing Strudel tracks and halts the live audio scheduler immediately.",
    parameters: EmptyParams,
    execute: async (
      _toolCallId: string,
      _params: Static<typeof EmptyParams>,
      _signal: AbortSignal | undefined,
      _onUpdate: any,
      ctx: ExtensionToolContext
    ): Promise<AgentToolResult<any>> => {
      replEngine.stop();
      stateStore.setPlaying(false);
      pi.appendEntry("strudel/state", stateStore.serialize());
      renderReplWidget(ctx, stateStore, replEngine.getCurrentCycle());

      return {
        isError: false,
        content: [
          {
            type: "text",
            text: "All audio playback silenced (hushed).",
          },
        ],
        details: { playing: false },
      };
    },
  });
}
