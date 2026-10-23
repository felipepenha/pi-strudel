export interface HighlightSpan {
  start: number;
  end: number;
  color?: string;
}

const COLOR_MAP: Record<string, [number, number, number]> = {
  cyan: [0, 255, 255],
  magenta: [255, 0, 255],
  yellow: [255, 255, 0],
  green: [0, 255, 0],
  red: [255, 0, 0],
  blue: [0, 100, 255],
  orange: [255, 140, 0],
  pink: [255, 105, 180],
  purple: [147, 112, 219],
  white: [255, 255, 255],
};

export function parseColorToRgb(color: string): [number, number, number] | null {
  const trimmed = color.trim().toLowerCase();
  if (COLOR_MAP[trimmed]) {
    return COLOR_MAP[trimmed];
  }
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    } else if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b];
    }
  }
  return null;
}

export function getAnsiEscapeForColor(color?: string): string {
  if (!color) {
    // Default high-contrast magenta background inverse style
    return "\x1b[1;97;45m";
  }
  const rgb = parseColorToRgb(color);
  if (rgb) {
    const [r, g, b] = rgb;
    // TrueColor background with bold dark foreground
    return `\x1b[48;2;${r};${g};${b};1;30m`;
  }
  return "\x1b[7m"; // Standard inverse fallback
}

export function highlightCode(code: string, spans: HighlightSpan[]): string {
  if (!spans || spans.length === 0) {
    return code;
  }

  // Filter valid spans within bounds
  const validSpans = spans
    .map((s) => ({
      start: Math.max(0, Math.min(s.start, code.length)),
      end: Math.max(0, Math.min(s.end, code.length)),
      color: s.color,
    }))
    .filter((s) => s.end > s.start);

  if (validSpans.length === 0) {
    return code;
  }

  // Merge overlapping or duplicate spans
  validSpans.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: HighlightSpan[] = [];
  for (const span of validSpans) {
    if (merged.length === 0) {
      merged.push({ ...span });
    } else {
      const last = merged[merged.length - 1];
      if (span.start < last.end) {
        // Overlap: extend end if larger
        if (span.end > last.end) {
          last.end = span.end;
        }
        if (span.color && !last.color) {
          last.color = span.color;
        }
      } else {
        merged.push({ ...span });
      }
    }
  }

  // Sort descending by start offset to inject without shifting prior indices
  merged.sort((a, b) => b.start - a.start);

  let result = code;
  for (const span of merged) {
    const prefix = getAnsiEscapeForColor(span.color);
    const suffix = "\x1b[0m";
    const before = result.slice(0, span.start);
    const target = result.slice(span.start, span.end);
    const after = result.slice(span.end);
    result = before + prefix + target + suffix + after;
  }

  // Safety: ensure trailing reset
  if (!result.endsWith("\x1b[0m")) {
    result += "\x1b[0m";
  }

  return result;
}
