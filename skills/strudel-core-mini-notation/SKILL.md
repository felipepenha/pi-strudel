---
name: strudel-core-mini-notation
description: Core Strudel syntax, JavaScript method chaining, mini-notation grammar, pattern constructors, and tempo (CPS/CPM). Always load first when generating Strudel code.
---
# Strudel Core Syntax, Mini-Notation & Pattern Constructors

## 1. Golden Syntax Rules
1. **Left-to-right chaining ONLY:** `note("c3 eb3 g3").s("sawtooth").lpf(800).room(0.4)`. NEVER use Haskell/Tidal operators (`$`, `#`, `|+`, `<~`).
2. **Quotes Semantics:**
   - Double quotes `"..."` or backticks `` `...` `` are parsed as **Mini-Notation AST** by `@strudel/transpiler`.
   - Single quotes `'...'` are passed as **raw JS strings** (e.g., `.scale('C:minor')` or `.voicings('lefthand')`).
3. **Tempo (`cps` and `cpm`):**
   - Strudel's default tempo is **`0.5` CPS** (1 cycle = 2 seconds = 1 bar of 4/4 at 120 BPM).
   - Formula: `cps = bpm / 60 / 4` (for 4/4 time).
   - Global tempo functions: `setcps(0.5)` (cycles per second) or `setcpm(30)` (cycles per minute, where `cpm = bpm / 4`).
   - Pattern-level tempo: `.cps(0.6)` or `.cpm(35)`.

## 2. Complete Mini-Notation Reference
| Operator | Meaning | Example |
| :--- | :--- | :--- |
| `x y z` | Sequence evenly across 1 cycle | `s("bd sd hh cp")` |
| `~` or `-` | Rest / silence | `s("bd ~ sd -")` |
| `[x y]` | Subdivide step into sub-cycle | `s("bd [sd sd] hh [cp hh]")` |
| `<x y z>` | Slow alternation (1 element per cycle) | `note("<c3 eb3 g3 f3>")` |
| `x*n` | Speed up / multiply density by `n` | `s("hh*8")` |
| `x/n` | Slow down / span over `n` cycles | `note("[c4 e4 g4 b4]/2")` |
| `x, y` | Polyrhythm / parallel stack inside mini | `s("bd*4, [~ cp]*2, hh*8")` |
| `{x y, a b c}` | Polymeter (steps align across cycles) | `note("{c3 eb3, g3 f3 d3}")` |
| `x@n` | Elongate step weight (duration = `n` units) | `note("c3@3 eb3")` (3/4 + 1/4) |
| `x!n` | Replicate step `n` times without speeding | `s("bd!3 sd")` (same as `"bd bd bd sd"`) |
| `x _` | Tie / extend previous event across steps | `note("c3 _ _ eb3")` (same as `"c3@3 eb3"`) |
| `x?` or `x?p` | Degrade / drop with probability `p` (default 0.5) | `s("hh*16?0.3")` |
| `x \| y` | Random choice each cycle | `s("bd [sd\|cp] hh [oh\|cr]")` |
| `x(p,s,o)` | Euclidean rhythm (`p` pulses, `s` steps, `o` offset) | `s("bd(3,8) sd(5,16,3)")` |
| `x:n` | Sample index or parameter shorthand | `s("hh:2 sd:4")` |
| `^` | Stepwise count marker for `stepcat`/`pace` | `stepcat("a [^b c] d", "e f")` |

## 3. Core JS Pattern Constructors
- `cat(p1, p2, ...)` / `slowcat(...)` — Plays patterns sequentially, 1 per cycle (same as `<p1 p2>`).
- `seq(p1, p2, ...)` / `fastcat(...)` — Squeezes all patterns into 1 cycle (same as `[p1 p2]`).
- `stack(p1, p2, ...)` — Plays patterns simultaneously in parallel (same as `p1, p2`).
- `timeCat([w1, p1], [w2, p2])` — Concatenates with proportional weights (same as `@`).
- `stepcat(p1, p2)` / `pace(n)` / `expand(n)` / `extend(n)` / `polymeter(p1, p2)` / `grow(n)` / `zip(p1, p2)` — Stepwise pattern composition where cycle length adapts to step count.
- `run(n)` — Ascending integer pattern `0 .. n-1` (e.g., `n(run(8)).scale("C:minor")`).
- `silence` — Empty pattern producing no events.
- `register('myFx', pat => pat.lpf(800).room(0.5))` — Registers a custom chainable method.
- `all(x => x.lpf(1000))` — Applies a transformation to the global output of all playing patterns.
