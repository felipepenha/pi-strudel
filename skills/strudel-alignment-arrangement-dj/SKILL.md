---
name: strudel-alignment-arrangement-dj
description: Pattern alignment modes (.in, .out, .mix, .squeeze, .trig, .reset), song sections (arrange), crossfading (xfade), and live DJ transitions.
---
# Strudel Pattern Alignment, Song Arrangement & DJ Transitions

## 1. All 7 Pattern Alignment Modes (`strudel.cc/learn/alignment`)
When combining two patterns with different rhythmic structures (e.g., `a.add(b)` or `a.lpf(b)`), control which pattern dictates event timing:
1. `.out` (Default: `a.add(b)` / `a.add.out(b)`) — Structure comes from the **left (outer)** pattern `a`.
2. `.in` (`a.add.in(b)`) — Structure comes from the **right (inner)** pattern `b`.
3. `.mix` (`a.add.mix(b)`) — Structure comes from **both** patterns (events triggered wherever either `a` or `b` has an onset).
4. `.squeeze` (`a.add.squeeze(b)`) — Every single event in `a` has the **entire cycle** of `b` squeezed into its timespan!
5. `.squeezeout` (`a.add.squeezeout(b)`) — Every event in `b` has the entire cycle of `a` squeezed into its timespan.
6. `.reset` (`a.add.reset(b)` or `a.reset(triggerPattern)`) — Restarts pattern `a` from cycle `0` whenever `triggerPattern` fires an event (without changing speed).
7. `.restart` (`a.restart(triggerPattern)`) — Like `.reset()`, but resets the clock continuously to `0` on every trigger onset.

## 2. Multi-Bar Song Arrangement & Crossfading
- `arrange([cycles1, pat1], [cycles2, pat2], ...)` — Sequences full multi-cycle sections (e.g., `arrange([8, intro], [16, drop], [8, breakdown])`).
- `xfade(patA, position0to1, patB)` — Crossfades smoothly between two patterns.

## 3. Live-Coding DJ Moves for Multi-Track Sessions (`$drums`, `$bass`, `$lead`, `$pad`)
- **Tension / Build-up:** Apply `.hpf(saw.rangex(80, 2500).slow(4))` + `.room(saw.range(0.1, 0.8).slow(4))` to `$drums` and `$bass`, and replace kick with snare roll `s("sd*<4 8 16 32>")`.
- **The Drop:** Remove `.hpf()`, un-mute `$bass` on `.orbit(2)`, enable `.duckorbit(2).duckdepth(0.85)` on the `$drums` kick, and hit `s("cr/8")` on cycle 1.
- **Breakdown:** Drop `$drums` via `.mask("<0>")` or `/mute drums`, apply `.slow(2).jux(rev).room(0.85)` to `$lead` and `$pad`.
