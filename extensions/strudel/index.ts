import type { ExtensionAPI, ExtensionContext, InputEvent } from "@earendil-works/pi-coding-agent";
import { globalStateStore, type SerializedStrudelState } from "./engine/state-store.js";
import { globalReplEngine } from "./engine/repl-engine.js";
import { globalAudioBridge } from "./engine/audio-bridge.js";
import { handleInputEvent } from "./router/input-interceptor.js";
import { renderReplWidget, globalReplWidgetRenderer } from "./ui/repl-widget.js";
import { registerSlashCommands } from "./commands/slash-commands.js";
import { registerAgentTools } from "./tools/agent-tools.js";

export default function (pi: ExtensionAPI) {
  // 1. Register all slash commands and agent tools
  registerSlashCommands(pi, globalStateStore, globalReplEngine, globalAudioBridge);
  registerAgentTools(pi, globalStateStore, globalReplEngine);

  // 2. Session start: restore last "strudel/state" custom entry from branch if present
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
    renderReplWidget(ctx, globalStateStore, globalReplEngine.getCurrentCycle());
    globalReplWidgetRenderer.startRenderLoop(
      ctx,
      globalStateStore,
      () => globalReplEngine.getCurrentCycle(),
      (trackId, code) => globalReplEngine.highlightTrack(trackId, code)
    );
  });

  // 3. Session tree navigation: hot-swap Strudel engine state when user jumps branches
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
    renderReplWidget(ctx, globalStateStore, globalReplEngine.getCurrentCycle());
  });

  // 4. Clean shutdown: cleanly stop audio clock and close sockets
  pi.on("session_shutdown", async () => {
    globalReplWidgetRenderer.dispose();
    globalReplEngine.stop();
    await globalAudioBridge.dispose();
  });

  // 5. Zero-latency Strudel code input interception
  pi.on("input", async (event: InputEvent, ctx: ExtensionContext) => {
    return handleInputEvent(event, ctx, pi, globalStateStore, globalReplEngine);
  });
}
