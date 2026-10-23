---
name: strudel-time-structure-modifiers
description: Rhythmic gating, masking, Euclidean rhythms, time shifting, conditional modifiers, and cycle windowing (zoom, compress, ribbon, inside/outside).
---
# Strudel Time, Structure & Conditional Modifiers

## 1. Structural Gating & Euclidean Modifiers
- `.struct("1 0 1 1 0 1 0 0")` or `.struct("x ~ x x ~ x ~ ~")` — Applies a rhythmic boolean structure to any pattern.
- `.mask("<1 1 1 0>")` — Lets events through on `1`/`true`, silences them on `0`/`false` (without changing underlying timing).
- `.euclid(pulses, steps)` — Applies a Euclidean rhythm.
- `.euclidRot(pulses, steps, rotation)` — Euclidean rhythm rotated by `rotation` steps.
- `.euclidLegato(pulses, steps)` — Euclidean rhythm where each pulse is stretched to last until the next pulse.

## 2. Speed, Phase & Direction
- `.fast(n)` / `.slow(n)` — Multiply or divide pattern speed.
- `.fastGap(n)` — Speeds up pattern into the first `1/n` of the cycle, leaving the rest silent.
- `.early(cycles)` / `.late(cycles)` — Nudges pattern backward or forward in time (e.g., `.late("<0 0.02>")`).
- `.rev()` — Reverses every cycle.
- `.palindrome()` — Plays forward on odd cycles, backward on even cycles.
- `.iter(n)` / `.iterBack(n)` — Divides cycle into `n` parts and rotates starting subdivision each cycle.
- `.ply(n)` — Repeats each individual event `n` times within its own timespan (great for glitch/trap rolls: `.every(4, x => x.ply(4))`).
- `.linger(fraction)` — Loops only the first `fraction` of the cycle (e.g., `.linger(0.25)` repeats the first quarter 4 times).
- `.swingBy(amount, subdivisions)` / `.swing(amount)` — Adds shuffle/swing to subdivisions.
- `.segment(n)` — Samples a continuous signal into `n` discrete events per cycle (e.g., `n(sine.range(0,7).segment(8))`).

## 3. Windowing & Meta-Cycle Functions
- `.compress(start, end)` — Squeezes the entire cycle into the `[start, end]` slice (between `0` and `1`), leaving silence outside.
- `.zoom(start, end)` — Extracts the `[start, end]` slice of a cycle and stretches it to fill the whole cycle.
- `.ribbon(offset, cycles)` / `.rib(offset, cycles)` — Loops a specific chunk of time from a random or evolving pattern (turns random `rand`/`perlin` into a repeating deterministic loop!).
- `.inside(n, fn)` — Scales down by `n`, applies `fn`, then scales back up (applies `fn` at sub-cycle resolution).
- `.outside(n, fn)` — Scales up by `n`, applies `fn`, then scales back down (applies `fn` across multi-cycle phrases).

## 4. Conditional & Probabilistic Modifiers
- `.every(n, fn)` / `.firstOf(n, fn)` / `.lastOf(n, fn)` — Applies `fn` once every `n` cycles.
- `.when(booleanPattern, fn)` — Applies `fn` whenever `booleanPattern` is truthy.
- `.whenmod(modulo, offset, fn)` — Applies `fn` when `(cycle % modulo) >= offset` (e.g., `.whenmod(8, 6, x => x.fast(2))` for a 2-bar fill every 8 bars).
- `.chunk(n, fn)` / `.chunkBack(n, fn)` — Divides pattern into `n` parts and applies `fn` to one shifting part per cycle.
- `.sometimesBy(prob, fn)`:
  - `.always(fn)` (1.0), `.almostAlways(fn)` (0.9), `.often(fn)` (0.75), `.sometimes(fn)` (0.5), `.rarely(fn)` (0.25), `.almostNever(fn)` (0.1), `.never(fn)` (0.0).
- `.someCyclesBy(prob, fn)` / `.someCycles(fn)` — Applies `fn` to entire cycles at random rather than event-by-event.
- `.degrade()` / `.degradeBy(prob)` / `.undegradeBy(prob)` — Randomly drops events.
