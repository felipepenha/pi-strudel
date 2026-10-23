---
name: strudel-accumulation-signals-random
description: Layering and canon functions (superimpose, layer, off, echo, stut, jux) plus continuous modulation signals (sine, saw, perlin, rand) and PRNG seeds.
---
# Strudel Accumulation, Layering, Signals & Randomness

## 1. Accumulation & Multi-Voice Layering (`strudel.cc/learn/accumulation`)
Use these to turn thin single-line patterns into lush polyphonic/polyrhythmic textures:
- `.superimpose(fn1, fn2, ...)` — Plays the original pattern stacked with modified copies (`x.superimpose(y => y.add(note(12)).late(1/8))`).
- `.layer(fn1, fn2, ...)` — Like `superimpose`, but does NOT include the unmodified dry pattern unless you include `x => x` (`note("c3 e3").layer(x => x.s("sawtooth"), x => x.s("square").add(note(12)))`).
- `.off(timeOffset, fn)` — Stacks the original pattern with a copy shifted by `timeOffset` and modified by `fn` (`n("0 2 4").off(1/8, x => x.add(7).gain(0.6))`).
- `.echo(times, time, feedback)` — Generates rhythmic pattern-level echoes before audio DSP (`note("c4").echo(3, 1/8, 0.7)`).
- `.echoWith(times, time, (pat, index) => ...)` — Echoes where each repeat `index` is transformed progressively (e.g., pitching up an octave or filtering each echo: `.echoWith(4, 1/8, (p, i) => p.add(note(i*5)).gain(0.8**i))`).
- `.stut(times, feedback, time)` — Classic Tidal stutter alias for `.echo()`.
- `.jux(fn)` / `.juxBy(width, fn)` — Applies `fn` only to the right stereo channel (or panned by `width`), keeping the original on the left (`.jux(rev)`).

## 2. Continuous Signals & LFO Modulation (`strudel.cc/learn/signals`)
Continuous signals must be scaled with `.range(min, max)` (or `.rangex(min, max)` for exponential frequency scaling) and optionally discretized with `.segment(n)`:
- Waveforms (0 to 1): `sine`, `cosine`, `saw`, `isaw` (inverted saw), `tri`, `square`
- Bipolar waveforms (-1 to 1): `sine2`, `cosine2`, `saw2`, `isaw2`, `tri2`, `square2`
- Noise & Random Signals:
  - `rand` — Uniform random value between 0 and 1 (`rand2` for -1 to 1).
  - `irand(n)` — Random integer between `0` and `n - 1` (e.g., `n(irand(8).segment(8))`).
  - `perlin` — Smooth, organic 1D Perlin noise between 0 and 1 (e.g., `.lpf(perlin.rangex(200, 4000))`).
  - `brand` / `brandBy(prob)` — Binary coin-flip signal (`0` or `1`).
  - `choose(a, b, c)` / `wchoose([a, weight1], [b, weight2])` — Continuous random selection (use `chooseCycles` to pick once per cycle).
  - `.seed(n)` — Seeds the random number generator for reproducible randomness, or pair with `.ribbon(offset, cycles)` to lock a random bar into a repeating groove.
