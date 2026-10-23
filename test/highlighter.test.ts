import { describe, it, expect } from "vitest";
import {
  highlightCode,
  parseColorToRgb,
  getAnsiEscapeForColor,
} from "../extensions/strudel/engine/highlighter.js";

describe("Phase 3: AST Location Highlighter", () => {
  it("parses color strings and hex codes to RGB", () => {
    expect(parseColorToRgb("cyan")).toEqual([0, 255, 255]);
    expect(parseColorToRgb("magenta")).toEqual([255, 0, 255]);
    expect(parseColorToRgb("#ff0000")).toEqual([255, 0, 0]);
    expect(parseColorToRgb("#00f")).toEqual([0, 0, 255]);
    expect(parseColorToRgb("invalid_color_xyz")).toBeNull();
  });

  it("generates TrueColor ANSI sequences for known colors and hex", () => {
    const cyanAnsi = getAnsiEscapeForColor("cyan");
    expect(cyanAnsi).toContain("48;2;0;255;255");

    const hexAnsi = getAnsiEscapeForColor("#ff0055");
    expect(hexAnsi).toContain("48;2;255;0;85");

    const defaultAnsi = getAnsiEscapeForColor();
    expect(defaultAnsi).toContain("\x1b[1;97;45m");
  });

  it("highlights code tokens with accurate offsets without shifting indices", () => {
    const code = 's("bd sd")';
    // Highlight 'bd' (start: 3, end: 5)
    const highlighted = highlightCode(code, [{ start: 3, end: 5 }]);
    expect(highlighted).toContain('\x1b[1;97;45mbd\x1b[0m');
    expect(highlighted).toContain('sd');
    expect(highlighted.endsWith("\x1b[0m")).toBe(true);
  });

  it("highlights multiple tokens accurately with colors", () => {
    const code = 's("bd sd")';
    const highlighted = highlightCode(code, [
      { start: 3, end: 5, color: "cyan" },
      { start: 6, end: 8, color: "magenta" },
    ]);

    expect(highlighted).toContain("48;2;0;255;255;1;30mbd\x1b[0m");
    expect(highlighted).toContain("48;2;255;0;255;1;30msd\x1b[0m");
  });

  it("returns unchanged code when spans array is empty", () => {
    const code = 's("bd*4")';
    expect(highlightCode(code, [])).toBe(code);
  });
});
