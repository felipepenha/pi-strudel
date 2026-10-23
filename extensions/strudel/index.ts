import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { globalStateStore, type SerializedStrudelState } from "./engine/state-store.js";
import { globalReplEngine } from "./engine/repl-engine.js";
import { globalAudioBridge } from "./engine/audio-bridge.js";

export default function (pi: ExtensionAPI) {
  // 1. Session start: restore last "strudel/state" custom entry from branch if present
  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    const branch = ctx.sessionManager.getBranch();
    for (let i = branch.length - 1; i >= 0; i--) {
      const entry = branch[i];
      if (entry.type === "custom" && entry.customType === "strudel/state" && entry.data) {
        globalStateStore.deserialize(entry.data as SerializedStrudelState);
        globalReplEngine.recompileAll();
        break;
      }
    }
  });

  // 2. Session tree navigation: hot-swap Strudel engine state when user jumps branches
  pi.on("session_tree", async (_event, ctx: ExtensionContext) => {
    const branch = ctx.sessionManager.getBranch();
    let restored = false;
    for (let i = branch.length - 1; i >= 0; i--) {
      const entry = branch[i];
      if (entry.type === "custom" && entry.customType === "strudel/state" && entry.data) {
        globalStateStore.deserialize(entry.data as SerializedStrudelState);
        globalReplEngine.recompileAll();
        restored = true;
        break;
      }
    }
    if (!restored) {
      globalStateStore.reset();
      globalReplEngine.recompileAll();
    }
  });

  // 3. Clean shutdown: cleanly stop audio clock and close sockets
  pi.on("session_shutdown", async () => {
    globalReplEngine.stop();
    await globalAudioBridge.dispose();
  });
}
