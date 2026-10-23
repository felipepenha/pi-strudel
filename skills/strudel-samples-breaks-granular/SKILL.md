---
name: strudel-samples-breaks-granular
description: Sample loading, drum machine banks, breakbeat slicing (slice, splice, chop, striate, scrub, loopAt, fit), choke groups, and wavetable scanning.
---
# Strudel Samples, Breakbeat Slicing & Granular Synthesis

## 1. Loading & Selecting Samples (`strudel.cc/learn/samples`)
- Built-in drums: `bd`, `sd`, `cp`, `hh`, `oh`, `cr`, `rd`, `ht`, `mt`, `lt`, `rim`, `cb`, `perc`, `misc`, `fx`, `casio`, `jazz`, `metal`, `east`, `crow`, `numbers`, `alphabet`.
- Built-in VCSL orchestral/acoustic & GM instruments: `piano`, `folkharp`, `gm_epiano1`, `gm_acoustic_bass`, `gm_synth_strings_1`, `gm_pad_warm`, `gm_lead_1_square`, etc.
- Select sample index via `:n` or `.n()`: `s("bd:2 sd:1")` or `s("hh*8").n(irand(4))`.
- Drum machine banks via `.bank()`:
  `"RolandTR808"`, `"RolandTR909"`, `"RolandTR707"`, `"RolandTR606"`, `"RolandTR626"`, `"LinnDrum"`, `"AkaiLinn"`, `"AkaiMPC60"`, `"OberheimDMX"`, `"EmuSP12"`, `"BossDR110"`, `"KorgMinipops"`, `"RhythmAce"`.
- Custom sample packs: `samples('github:tidalcycles/dirt-samples')` or `samples({ amen: 'https://.../amen.wav' })`.
- Alias creation: `soundAlias('RolandTR909_bd', 'k909')`.

## 2. Sample Playback & Choke Controls
- `.begin(0..1)` / `.end(0..1)` — Trim sample start and end points (`0` = start, `1` = end).
- `.speed(rate)` — Playback speed/pitch ratio (`1` = normal, `2` = +1 octave & 2x speed, `-1` = reverse playback!).
- `.unit("r" | "c" | "s")` — Controls how `speed` and `begin`/`end` are interpreted (`"r"` = rate default, `"c"` = cycle-locked, `"s"` = seconds).
- `.cut(groupNumber)` — Choke group! Stops any playing sample in the same group (classic open/closed hi-hat choke: `s("hh*6 oh hh").cut(1)`).
- `.loop(1)` / `.loopBegin(0..1)` / `.loopEnd(0..1)` — Loops a sub-region of a sample.
- `.stretch(ratio)` — Phase vocoder time-stretch without altering pitch.

## 3. Breakbeat Slicing & Granular Synthesis
- `.loopAt(cycles)` — Stretches/compresses a breakbeat or loop sample so it fits exactly `cycles` cycles at any CPS (`s("amen").loopAt(2)`).
- `.fit()` — Fits each sample event to the duration of its own step/hap in the pattern.
- `.chop(n)` — Granularizes each sample into `n` sequential micro-pieces (`s("amen").chop(16).rev()`).
- `.striate(n)` — Interleaves `n` progressive slices across multiple sample variations.
- `.slice(n, patternOfIndices)` — Slices a sample into `n` chunks and re-sequences them without changing pitch (`s("amen").slice(8, "0 1 2 3 0 2 [4 5] 7")`).
- `.splice(n, patternOfIndices)` — Like `.slice()`, but automatically adjusts playback `.speed()` so each slice stretches to fit its step duration seamlessly!
- `.scrub(positionPattern)` — Tape-head / granular scrubbing through a sample (`0` to `1`, e.g., `s("amen").scrub(saw.slow(2))` or `s("pad").scrub("0 0.25 0.5 0.75*4")`).
