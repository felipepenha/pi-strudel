import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { StateStore, AudioMode } from "../engine/state-store.js";
import type { ReplEngine } from "../engine/repl-engine.js";
import type { AudioBridge } from "../engine/audio-bridge.js";
import { renderReplWidget, globalReplWidgetRenderer } from "../ui/repl-widget.js";
import { classifyInput } from "../router/input-interceptor.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export function registerSlashCommands(
  pi: ExtensionAPI,
  stateStore: StateStore,
  replEngine: ReplEngine,
  audioBridge: AudioBridge
): void {
  // Helper to sync and refresh UI
  const syncState = (ctx: ExtensionCommandContext) => {
    pi.appendEntry("strudel/state", stateStore.serialize());
    renderReplWidget(ctx, stateStore, replEngine.getCurrentCycle());
  };

  // 1. /strudel [on|off|toggle]
  pi.registerCommand("strudel", {
    description: "Toggles the live Strudel REPL widget visibility (/strudel [on|off|toggle])",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const mode = args.trim().toLowerCase();
      if (mode === "on") {
        globalReplWidgetRenderer.setVisible(true);
      } else if (mode === "off") {
        globalReplWidgetRenderer.setVisible(false);
      } else {
        globalReplWidgetRenderer.toggleVisible();
      }
      renderReplWidget(ctx, stateStore, replEngine.getCurrentCycle());
      ctx.ui.notify(`Strudel REPL widget is now ${globalReplWidgetRenderer.isVisible() ? "visible" : "hidden"}`);
    },
  });

  // 2. /s <code | $track: code>
  pi.registerCommand("s", {
    description: "Fast-eval alias to evaluate Strudel code or assign a track (/s $d1: s('bd*4'))",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const input = args.trim();
      if (!input) {
        ctx.ui.notify("Usage: /s <code | $track: code>", "warning");
        return;
      }
      const classified = classifyInput(input);
      if (classified.kind === "track_assign") {
        stateStore.setTrack(classified.trackId, classified.code);
      } else {
        stateStore.setTrack("d1", input);
      }
      stateStore.setPlaying(true);
      replEngine.recompileAll();
      replEngine.start();
      syncState(ctx);
    },
  });

  // 3 & 4. /hush and /panic
  const hushHandler = async (_args: string, ctx: ExtensionCommandContext) => {
    replEngine.stop();
    stateStore.setPlaying(false);
    syncState(ctx);
    ctx.ui.notify("Strudel audio playback silenced.");
  };

  pi.registerCommand("hush", {
    description: "Emergency Stop: Immediately halts audio playback and scheduler",
    handler: hushHandler,
  });

  pi.registerCommand("panic", {
    description: "Alias for /hush: Immediately halts audio playback and scheduler",
    handler: hushHandler,
  });

  // 5. /play
  pi.registerCommand("play", {
    description: "Resumes or starts live audio playback",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      replEngine.recompileAll();
      replEngine.start();
      stateStore.setPlaying(true);
      syncState(ctx);
      ctx.ui.notify("Strudel playback started.");
    },
  });

  // 6. /pause
  pi.registerCommand("pause", {
    description: "Pauses audio playback without clearing active patterns",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      replEngine.stop();
      stateStore.setPlaying(false);
      syncState(ctx);
      ctx.ui.notify("Strudel playback paused.");
    },
  });

  // 7. /cps <number>
  pi.registerCommand("cps", {
    description: "Sets tempo in Cycles Per Second (/cps 0.5)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const val = parseFloat(args.trim());
      if (isNaN(val) || val <= 0) {
        ctx.ui.notify("Please specify a valid positive CPS (e.g. /cps 0.5)", "warning");
        return;
      }
      stateStore.setCps(val);
      syncState(ctx);
      ctx.ui.notify(`Tempo set to ${stateStore.getCps().toFixed(2)} CPS (${stateStore.getBpm().toFixed(0)} BPM)`);
    },
  });

  // 8. /bpm <number> [beatsPerCycle]
  pi.registerCommand("bpm", {
    description: "Sets tempo in BPM (/bpm 120 or /bpm 140 4)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const parts = args.trim().split(/\s+/);
      const bpm = parseFloat(parts[0]);
      const beats = parts[1] ? parseFloat(parts[1]) : 4;

      if (isNaN(bpm) || bpm <= 0) {
        ctx.ui.notify("Please specify a valid positive BPM (e.g. /bpm 120)", "warning");
        return;
      }
      stateStore.setBpm(bpm, beats);
      syncState(ctx);
      ctx.ui.notify(`Tempo set to ${stateStore.getBpm().toFixed(0)} BPM (${stateStore.getCps().toFixed(2)} CPS)`);
    },
  });

  // 9 & 10. /track and /t
  const trackHandler = async (args: string, ctx: ExtensionCommandContext) => {
    const trimmed = args.trim();
    const match = trimmed.match(/^([a-zA-Z0-9_]+)\s+([\s\S]+)$/);
    if (!match) {
      ctx.ui.notify("Usage: /track <id> <code> (e.g. /track d1 s(\"bd sd\"))", "warning");
      return;
    }
    const trackId = match[1];
    const code = match[2];

    stateStore.setTrack(trackId, code);
    stateStore.setPlaying(true);
    replEngine.recompileAll();
    replEngine.start();
    syncState(ctx);
    ctx.ui.notify(`Updated track $${trackId}`);
  };

  pi.registerCommand("track", {
    description: "Assigns or updates a named track (/track d1 s('bd sd'))",
    handler: trackHandler,
  });

  pi.registerCommand("t", {
    description: "Alias for /track: Assigns or updates a named track",
    handler: trackHandler,
  });

  // 11. /mute <trackId | all>
  pi.registerCommand("mute", {
    description: "Toggles mute on a track or mutes all (/mute drums or /mute all)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const target = args.trim().replace(/^\$/, "");
      if (target === "all") {
        stateStore.muteAll();
        ctx.ui.notify("Muted all tracks.");
      } else if (stateStore.getTrack(target)) {
        const isMuted = stateStore.toggleMute(target);
        ctx.ui.notify(`Track $${target} is now ${isMuted ? "muted" : "unmuted"}.`);
      } else {
        ctx.ui.notify(`Track $${target} not found.`, "warning");
        return;
      }
      replEngine.recompileAll();
      syncState(ctx);
    },
  });

  // 12. /solo <trackId | off>
  pi.registerCommand("solo", {
    description: "Solos a specific track or clears solo mode (/solo bass or /solo off)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const target = args.trim().replace(/^\$/, "");
      if (target === "off" || target === "none" || !target) {
        stateStore.clearSolo();
        ctx.ui.notify("Cleared solo.");
      } else if (stateStore.getTrack(target)) {
        const isSolo = stateStore.toggleSolo(target);
        ctx.ui.notify(`Track $${target} solo is now ${isSolo ? "active" : "disabled"}.`);
      } else {
        ctx.ui.notify(`Track $${target} not found.`, "warning");
        return;
      }
      replEngine.recompileAll();
      syncState(ctx);
    },
  });

  // 13. /clear <trackId | all>
  pi.registerCommand("clear", {
    description: "Deletes a specific track or clears all tracks (/clear d1 or /clear all)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const target = args.trim().replace(/^\$/, "");
      if (target === "all" || !target) {
        stateStore.clearTracks();
        ctx.ui.notify("Cleared all tracks.");
      } else {
        const deleted = stateStore.deleteTrack(target);
        if (deleted) {
          ctx.ui.notify(`Deleted track $${target}.`);
        } else {
          ctx.ui.notify(`Track $${target} not found.`, "warning");
          return;
        }
      }
      replEngine.recompileAll();
      syncState(ctx);
    },
  });

  // 14. /nudge <ms>
  pi.registerCommand("nudge", {
    description: "Shifts clock phase offset forward/backward in milliseconds (/nudge 20)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const ms = parseFloat(args.trim());
      if (isNaN(ms)) {
        ctx.ui.notify("Usage: /nudge <ms> (e.g. /nudge 20)", "warning");
        return;
      }
      replEngine.nudge(ms);
      syncState(ctx);
      ctx.ui.notify(`Nudged clock by ${ms}ms.`);
    },
  });

  // 15. /audio <node|browser|osc>
  pi.registerCommand("audio", {
    description: "Switches audio backend mode (/audio node | /audio browser | /audio osc)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const mode = args.trim().toLowerCase() as AudioMode;
      if (!["node", "browser", "osc"].includes(mode)) {
        ctx.ui.notify("Available audio modes: node, browser, osc", "warning");
        return;
      }
      await audioBridge.setMode(mode);
      stateStore.setAudioMode(mode);
      syncState(ctx);
      ctx.ui.notify(`Switched audio backend to '${mode}'.`);
    },
  });

  // 16. /preset <techno|dnb|ambient|house>
  pi.registerCommand("preset", {
    description: "Loads a curated multi-track groove preset (/preset techno|dnb|ambient|house)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const name = args.trim().toLowerCase();
      stateStore.clearTracks();

      if (name === "techno") {
        stateStore.setCps(0.54); // 130 BPM
        stateStore.setTrack("drums", 's("bd*4, [~ cp]*2, [~ [hh|oh]]*4").bank("RolandTR909")');
        stateStore.setTrack("bass", 'note("<c2 c2 c2 [eb2 g2]>*2").s("sawtooth").lpf(800).lpq(4).duckorbit(2)');
        stateStore.setTrack("acid", 'note("c3(3,8) eb3(5,8)").s("sawtooth").lpf(sine.range(400, 3000)).lpq(8)');
      } else if (name === "dnb") {
        stateStore.setCps(0.72); // 174 BPM
        stateStore.setTrack("drums", 's("bd ~ ~ bd sd ~ bd ~").bank("RolandTR808").fast(1.4)');
        stateStore.setTrack("amen", 's("amen").loopAt(2).slice(8, "0 1 2 3 0 2 [4 5] 7")');
        stateStore.setTrack("reese", 'note("<c1 eb1 f1 bb1>").s("supersaw").detune(0.3).lpf(600)');
      } else if (name === "ambient") {
        stateStore.setCps(0.35); // 84 BPM
        stateStore.setTrack("pad", "chord(\"<Cm9 Fm9 Abmaj7 Gm7>\").voicings('lefthand').s(\"triangle\").room(0.8).slow(2)");
        stateStore.setTrack("shimmer", 'note("c5(3,8) eb5(5,8)").s("sine").delay(0.6).delaytime(0.375).room(0.9)');
      } else if (name === "house") {
        stateStore.setCps(0.52); // 125 BPM
        stateStore.setTrack("drums", 's("bd*4, [~ clp]*2, [~ oh]*4, hh*16?0.7").bank("RolandTR909")');
        stateStore.setTrack("bass", 'note("<c2 c2 eb2 f2>").s("sawtooth").lpf(700).duckorbit(2)');
        stateStore.setTrack("chords", 'chord("<Dm7 Em7 Am7 G7>").s("piano").room(0.4)');
      } else {
        ctx.ui.notify("Available presets: techno, dnb, ambient, house", "warning");
        return;
      }

      stateStore.setPlaying(true);
      replEngine.recompileAll();
      replEngine.start();
      syncState(ctx);
      ctx.ui.notify(`Loaded '${name}' preset!`);
    },
  });

  // 17. /jam-save <filename>
  pi.registerCommand("jam-save", {
    description: "Exports the current multi-track session to a JS file (/jam-save session.strudel.js)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const filename = args.trim() || `jam-${Date.now()}.strudel.js`;
      const targetPath = path.isAbsolute(filename) ? filename : path.join(ctx.cwd, filename);

      const lines: string[] = [
        `// Strudel Jam Export - ${new Date().toISOString()}`,
        `// Tempo: ${stateStore.getCps()} CPS (${stateStore.getBpm()} BPM)`,
        `setcps(${stateStore.getCps()});\n`,
      ];

      for (const [id, track] of stateStore.getTracks().entries()) {
        const comment = track.muted ? "// [MUTED] " : "";
        lines.push(`${comment}$${id}: ${track.code}`);
      }

      await fs.writeFile(targetPath, lines.join("\n"), "utf8");
      ctx.ui.notify(`Saved Strudel session to ${filename}`);
    },
  });

  // 18. /jam-load <filename>
  pi.registerCommand("jam-load", {
    description: "Loads a saved Strudel session file into tracks (/jam-load session.strudel.js)",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const filename = args.trim();
      if (!filename) {
        ctx.ui.notify("Usage: /jam-load <filename.strudel.js>", "warning");
        return;
      }
      const targetPath = path.isAbsolute(filename) ? filename : path.join(ctx.cwd, filename);
      try {
        const content = await fs.readFile(targetPath, "utf8");
        const lines = content.split("\n");

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("//")) continue;

          if (trimmed.startsWith("setcps(")) {
            const m = trimmed.match(/setcps\(([\d.]+)\)/);
            if (m) stateStore.setCps(parseFloat(m[1]));
            continue;
          }

          const classified = classifyInput(trimmed);
          if (classified.kind === "track_assign") {
            stateStore.setTrack(classified.trackId, classified.code);
          }
        }

        stateStore.setPlaying(true);
        replEngine.recompileAll();
        replEngine.start();
        syncState(ctx);
        ctx.ui.notify(`Loaded Strudel session from ${filename}`);
      } catch (err: any) {
        ctx.ui.notify(`Failed to load file: ${err.message}`, "error");
      }
    },
  });
}
