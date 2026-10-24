import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { StateStore } from "../engine/state-store.js";
import { renderProgressBar } from "./ascii-meter.js";

export class ReplWidgetRenderer {
  private visible = true;
  private timer: NodeJS.Timeout | null = null;

  isVisible(): boolean {
    return this.visible;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  toggleVisible(): boolean {
    this.visible = !this.visible;
    return this.visible;
  }

  formatWidgetLines(
    stateStore: StateStore,
    cycle = 0,
    highlightTrack?: (id: string, code: string) => string
  ): string[] {
    const cpsStr = stateStore.getCps().toFixed(2);
    const bpmStr = stateStore.getBpm().toFixed(0);
    const cycleStr = cycle.toFixed(1);
    const meter = renderProgressBar(cycle, 8);
    const statusIcon = stateStore.isPlaying() ? "▶" : "⏸";

    const header = `╭─ STRUDEL LIVE REPL ── CPS: ${cpsStr} (${bpmStr} BPM) ── Cycle: ${cycleStr} ── ${meter} ${statusIcon} ─╮`;
    const footer = `╰─────────┴─ Tip: Type \`$track: code\` for instant eval, or ask Pi in plain text ───────╯`;

    const tracks = stateStore.getTracks();
    const body: string[] = [];

    if (tracks.size === 0) {
      body.push(`│ (no active tracks) — Type \`$d1: s("bd sd")\` to start playing                     │`);
    } else {
      for (const [id, track] of tracks.entries()) {
        const idCol = `$${id}`.padEnd(7, " ");
        let prefix = "";
        if (track.soloed) {
          prefix = "\x1b[33m[SOLO]\x1b[0m ";
        } else if (track.muted) {
          prefix = "\x1b[90m[MUTED]\x1b[0m ";
        }

        const highlightedCode = highlightTrack
          ? highlightTrack(id, track.code)
          : track.code;

        body.push(`│ ${idCol} │ ${prefix}${highlightedCode}`);
      }
    }

    return [header, ...body, footer];
  }

  render(
    ctx: ExtensionContext,
    stateStore: StateStore,
    cycle = 0,
    highlightTrack?: (id: string, code: string) => string
  ): void {
    if (!this.visible) {
      ctx.ui.setWidget("strudel-repl", undefined);
      ctx.ui.setStatus("strudel", undefined);
      return;
    }

    const lines = this.formatWidgetLines(stateStore, cycle, highlightTrack);
    ctx.ui.setWidget("strudel-repl", lines);

    const trackCount = stateStore.getTracks().size;
    const playState = stateStore.isPlaying() ? "▶" : "⏸";
    const statusText = `🎵 ${stateStore.getBpm().toFixed(0)} BPM (${stateStore.getCps().toFixed(2)} CPS) | ${trackCount} track${trackCount === 1 ? "" : "s"} ${playState}`;
    ctx.ui.setStatus("strudel", statusText);
  }

  startRenderLoop(
    ctx: ExtensionContext,
    stateStore: StateStore,
    getCycle: () => number,
    highlightTrack?: (id: string, code: string) => string
  ): void {
    this.stopRenderLoop();
    // 5 FPS = 200ms interval (prevents terminal screen tearing / event-loop starvation)
    this.timer = setInterval(() => {
      if (stateStore.isPlaying() && this.visible) {
        this.render(ctx, stateStore, getCycle(), highlightTrack);
      }
    }, 200);
  }

  stopRenderLoop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.stopRenderLoop();
  }
}

export const globalReplWidgetRenderer = new ReplWidgetRenderer();

export function renderReplWidget(
  ctx: ExtensionContext,
  stateStore: StateStore,
  cycle = 0,
  highlightTrack?: (id: string, code: string) => string
): void {
  globalReplWidgetRenderer.render(ctx, stateStore, cycle, highlightTrack);
}
