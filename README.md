# 🎵 pi-strudel

> **Live-Coding Music REPL & AI Co-Composer inside the Pi Terminal UI**  
> Powered by [Strudel](https://strudel.cc) & [@earendil-works/pi-coding-agent](https://github.com/earendil-works/pi).

`pi-strudel` turns your Pi coding session into a responsive live-coding music studio and algorave environment. Jam directly from the terminal input box with `<1ms` zero-latency audio updates, or collaborate with Pi's LLM as your agentic co-composer across 8 deep Strudel knowledge skills.

---

## ⚡ Features

- **⚡ Zero-Latency Fast Path (<1ms, 0 LLM Tokens):** Type `$d1: s("bd*4")` or `!note("c3")` to instantly update patterns and hear live audio without touching the LLM.
- **🤖 Co-Composer Agent Path:** Ask Pi in plain English (*"Add a syncopated 909 groove and sidechain a warm Dorian pad to the kick"*); Pi inspects active session state and modifies tracks via `strudel_upsert_tracks`.
- **🌳 Pi Session DAG History Sync:** Seamlessly jump across Pi's conversation branches (`Ctrl+←` / `Ctrl+→`); music live-reloads to match your session branch state.
- **🖥️ 25 FPS ANSI TrueColor REPL Widget:** Real-time playhead progress bar, cycle meter, and AST token highlighting with TrueColor terminal styling.
- **🔊 3 Switchable Audio Backends:**
  1. `node` *(Default)*: Zero-setup built-in WebAudio synthesis with oscillators, filters, ADSR/pitch envelopes, and synthesized drum voices (`bd`, `sd`, `hh`, `oh`, `cp`, `rim`, `cb`).
  2. `browser`: Full WebAudio + samples + canvas visualizers via local WebSocket bridge (`127.0.0.1:41234`).
  3. `osc`: SuperDirt / External DAW UDP routing (`127.0.0.1:57120`).
- **📚 8 Comprehensive Strudel Skills:** 100% coverage of Strudel mini-notation, tonal harmony, breakbeat slicing, synths, and DJ transitions.

---

## 📦 Installation

Install directly into Pi:

```bash
pi install git:github.com/felipepenha/pi-strudel
```

Or run locally during development:

```bash
git clone https://github.com/felipepenha/pi-strudel.git
cd pi-strudel
npm install
npm test
pi -e .
```

---

## 🚀 Quickstart

### 1. Direct Pattern Entry (Fast Path)

Assign tracks directly using the `$` prefix or raw calls:

```javascript
// Drums
$drums: s("bd*4 [~ sd]*2, hh*8").bank("RolandTR909")

// Bass
$bass: note("<c2 eb2 f2 g2>*2").s("sawtooth").lpf(800).lpq(4)

// Chords
$pad: chord("<Cm9 Fm9>").voicings('lefthand').s("triangle").room(0.8)
```

### 2. Natural Language Co-Composing (Agent Path)

Type natural language instructions into the Pi prompt:

> *"Drop the drums for 4 bars, filter the pad up with smooth Perlin noise, and introduce an arpeggiated acid line in C Dorian."*

Pi receives the current session state header automatically, reasons about the music using its 8 skills, and calls `strudel_upsert_tracks`.

---

## ⌨️ Slash Commands

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/strudel` | `[on\|off\|toggle]` | Show, hide, or toggle the live REPL widget |
| `/s` | `<code \| $track: code>` | Fast-eval alias for quick pattern entry |
| `/hush` / `/panic` | *(none)* | Emergency stop: Immediately silences audio playback |
| `/play` | *(none)* | Starts or resumes live audio playback |
| `/pause` | *(none)* | Pauses audio playback without clearing tracks |
| `/cps` | `<number>` | Sets tempo in Cycles Per Second (default `0.5` = 120 BPM in 4/4) |
| `/bpm` | `<number> [beatsPerCycle]` | Sets tempo in BPM (converts to CPS, default 4 beats/cycle) |
| `/track` / `/t` | `<id> <code>` | Assigns or updates a named track (`/track d1 s("bd sd")`) |
| `/mute` | `<trackId \| all>` | Toggles mute on a track, or mutes all tracks |
| `/solo` | `<trackId \| off>` | Solos a track, or clears solo mode |
| `/clear` | `<trackId \| all>` | Deletes a track or clears all session tracks |
| `/nudge` | `<ms>` | Shifts clock phase forward or backward in milliseconds |
| `/audio` | `<node\|browser\|osc>` | Switches audio output backend |
| `/preset` | `<techno\|dnb\|ambient\|house>` | Loads a curated multi-track groove preset |
| `/jam-save` | `<filename.strudel.js>` | Exports session to a runnable `.strudel.js` file |
| `/jam-load` | `<filename.strudel.js>` | Imports a saved Strudel session file into tracks |

---

## 🛠️ Agent Tools

Pi's LLM has access to 3 registered tools:

- `strudel_upsert_tracks`: Validates syntax and updates multi-track patterns with instant hot-swapping and session DAG checkpointing.
- `strudel_get_state`: Inspects current tempo, active cycle, audio backend, and all tracks.
- `strudel_hush`: Silences all playback.

---

## 📖 8 Packaged Strudel Skills

Located under `skills/*/SKILL.md`:

1. **`strudel-core-mini-notation`**: Core chaining, quotes semantics, mini-notation syntax reference, and pattern constructors.
2. **`strudel-time-structure-modifiers`**: Gating, masking, Euclidean rhythms (`euclid`), speed (`fast`/`slow`), direction, and windowing.
3. **`strudel-accumulation-signals-random`**: Layering (`superimpose`, `off`, `echoWith`), continuous signals (`sine`, `perlin`), and PRNG seeds.
4. **`strudel-samples-breaks-granular`**: Sample packs, drum banks (`RolandTR909`), breakbeat chopping (`slice`, `splice`, `loopAt`), and granular scrubbing.
5. **`strudel-synths-dsp-orbits`**: Superdough oscillators, wavetables, ADSR/filter/pitch envelopes, DSP chain, orbits, and sidechain ducking (`duckorbit`).
6. **`strudel-tonal-harmony-xen`**: Diatonic and world scales, chord voicings (`lefthand`), root extraction, arpeggios, and microtonal EDO tunings.
7. **`strudel-alignment-arrangement-dj`**: Alignment modes (`.in`, `.out`, `.mix`, `.squeeze`), song arrangements (`arrange`), and live DJ transitions.
8. **`strudel-io-midi-osc-visuals`**: Web MIDI output/clock, SuperDirt OSC, Csound, and ANSI TrueColor visual metadata (`.color()`).

---

## 🧪 Testing & Verification

Run the full test suite with Vitest:

```bash
npm run typecheck
npm test
```

---

## 📄 License

MIT © [Felipe Penha](https://github.com/felipepenha)
