export function renderProgressBar(cycle: number, width = 8): string {
  const frac = ((cycle % 1) + 1) % 1;
  const filled = Math.min(width, Math.max(0, Math.floor(frac * width)));
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

export function renderSparkline(values: number[], width = 8): string {
  if (values.length === 0) return "░".repeat(width);
  const bars = [" ", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const max = Math.max(...values, 1);
  const recent = values.slice(-width);
  return recent
    .map((v) => {
      const idx = Math.min(bars.length - 1, Math.max(0, Math.floor((v / max) * (bars.length - 1))));
      return bars[idx];
    })
    .join("")
    .padStart(width, "░");
}
