---
name: strudel-io-midi-osc-visuals
description: MIDI input/output, MIDI CC automation, MIDI clock sync, SuperDirt OSC routing, Csound integration, and visual/UI helpers (color, pianoroll, scope).
---
# Strudel External I/O (MIDI, OSC, Csound) & Visual Metadata

## 1. MIDI Output & CC Control (`strudel.cc/learn/midi`)
- `.midi('IAC Driver Bus 1')` (or `.midi()` for first available MIDI output port) — Sends note events over MIDI instead of internal WebAudio.
- `.midichan(1..16)` — Selects MIDI channel (default `1`).
- `.ccn(controllerNumber)` & `.ccv(value0to127)` — Sends MIDI Control Change messages (e.g., `ccn(74).ccv(sine.range(0, 127).segment(16)).midi()`).
- `.progNum(0..127)` — Sends MIDI Program Change.
- `.midibend(-1..1)` / `.miditouch(0..1)` — Pitch bend and aftertouch.
- `midicmd("clock*48, start/4").midi()` — Sends MIDI Clock and transport sync to external hardware/DAWs.
- `cc(controllerNumber)` — Reads incoming MIDI CC values from a hardware controller into a pattern parameter (`0` to `1`).

## 2. OSC & SuperDirt Output (`strudel.cc/learn/input-output`)
- `.osc()` — Routes pattern events over OSC UDP (port `57120`) to SuperCollider / SuperDirt or custom OSC listeners (supported natively in `pi-strudel` via `/audio osc`).

## 3. Csound Integration (`strudel.cc/learn/csound`)
- `await loadOrc('github:kunstmusik/csound-live-code/master/livecode.orc')`
- `.csound("FM1" | "Sub1" | "SSaw" | "MS20_bass" | "Plk")` — Routes pattern notes to a Csound instrument orchestra when running in browser-bridge mode.

## 4. Visual & TUI Metadata Helpers (`strudel.cc/learn/visual-feedback`)
- `.color("cyan" | "magenta" | "#ff0055")` — Tags `Hap` context with a color name/hex. In `pi-strudel`, the TUI ANSI highlighter maps `.color()` directly to 24-bit TrueColor terminal escape sequences (`\x1b[38;2;R;G;Bm`)!
- `._pianoroll()` / `._scope()` / `._spectrum()` / `._spiral()` / `._pitchwheel()` — Browser canvas visualizers (rendered automatically in `pi-strudel` when using `/audio browser` or converted to ASCII sparklines in the TUI widget).
