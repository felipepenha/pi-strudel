import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { StateStore } from "../engine/state-store.js";
import { renderProgressBar } from "./ascii-meter.js";

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function truncateAnsi(str: string, maxVisible: number): string {
  if (stripAnsi(str).length <= maxVisible) {
    return str;
  }
  let visible = 0;
  let out = "";
  let i = 0;
  while (i < str.length && visible < maxVisible - 3) {
    if (str[i] === "\x1b" && str[i + 1] === "[") {
      const end = str.indexOf("m", i);
      if (end !== -1) {
        out += str.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }
    out += str[i];
    visible++;
    i++;
  }
  return out + "...\x1b[0m";
}

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

        const rawHighlighted = highlightTrack
          ? highlightTrack(id, track.code)
          : track.code;

        // Flatten all newlines and excessive whitespace into a single line
        const singleLine = rawHighlighted.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
        // Truncate to maximum 65 visible columns to prevent line-wrapping across terminal rows
        const truncatedCode = truncateAnsi(singleLine, 65);

        body.push(`│ ${idCol} │ ${prefix}${truncatedCode}`);
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
