import type { ExtensionContext, InputEvent, InputEventResult, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { StateStore } from "../engine/state-store.js";
import type { ReplEngine } from "../engine/repl-engine.js";
import { renderReplWidget } from "../ui/repl-widget.js";

export type InterceptResult =
  | { kind: "track_assign"; trackId: string; code: string }
  | { kind: "raw_eval"; code: string }
  | { kind: "natural_language" };

export const TRACK_REGEX = /^\$([a-zA-Z0-9_]+)\s*[:=]\s*([\s\S]+)$/;
export const RAW_BANG_REGEX = /^!\s*([\s\S]+)$/;
export const STRUDEL_CALL_REGEX =
  /^(s|sound|note|n|freq|stack|cat|seq|fastcat|slowcat|timeCat|stepcat|polymeter|arrange|run|all|samples|silence|hush|setcps|setcpm|chord|arp)\s*\(/;

export function classifyInput(rawText: string): InterceptResult {
  const trimmed = rawText.trim();
  if (!trimmed || trimmed.startsWith("/")) return { kind: "natural_language" };

  const trackMatch = trimmed.match(TRACK_REGEX);
  if (trackMatch) {
    return {
      kind: "track_assign",
      trackId: trackMatch[1],
      code: trackMatch[2].trim(),
    };
  }

  const bangMatch = trimmed.match(RAW_BANG_REGEX);
  if (bangMatch) {
    return { kind: "raw_eval", code: bangMatch[1].trim() };
  }

  if (STRUDEL_CALL_REGEX.test(trimmed)) {
    return { kind: "raw_eval", code: trimmed };
  }

  return { kind: "natural_language" };
}

export function formatSessionStateHeader(stateStore: StateStore): string {
  const tracks = stateStore.getTracks();
  const trackSummaries = Array.from(tracks.entries())
    .map(([id, t]) => `$${id}: ${t.code}${t.muted ? " [MUTED]" : ""}${t.soloed ? " [SOLO]" : ""}`)
    .join("; ");

  return `[Active Strudel Session State: CPS=${stateStore.getCps().toFixed(2)} (${stateStore.getBpm().toFixed(0)} BPM), Playing=${stateStore.isPlaying()}, Mode=${stateStore.getAudioMode()}${
    tracks.size > 0 ? `, Tracks: ${trackSummaries}` : ", Tracks: (none)"
  }]`;
}

export async function handleInputEvent(
  event: InputEvent,
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  stateStore: StateStore,
  replEngine: ReplEngine
): Promise<InputEventResult> {
  const classified = classifyInput(event.text);

  if (classified.kind === "track_assign") {
    stateStore.setTrack(classified.trackId, classified.code);
    stateStore.setPlaying(true);
    replEngine.recompileAll();
    replEngine.start();
    pi.appendEntry("strudel/state", stateStore.serialize());
    renderReplWidget(ctx, stateStore, replEngine.getCurrentCycle());
    return { action: "handled" };
  }

  if (classified.kind === "raw_eval") {
    // Assign to default track d1
    stateStore.setTrack("d1", classified.code);
    stateStore.setPlaying(true);
    replEngine.recompileAll();
    replEngine.start();
    pi.appendEntry("strudel/state", stateStore.serialize());
    renderReplWidget(ctx, stateStore, replEngine.getCurrentCycle());
    return { action: "handled" };
  }

  // Natural language
  const hasActiveSession = stateStore.isPlaying() || stateStore.getTracks().size > 0;
  if (hasActiveSession) {
    const header = formatSessionStateHeader(stateStore);
    return {
      action: "transform",
      text: `${header}\n\n${event.text}`,
    };
  }

  return { action: "continue" };
}
