<p align="center">
  <h1 align="center">🎵 Pi Strudel (π · Strudel)</h1>
</p>

<p align="center">
  <a href="https://pi.dev">Pi Coding Agent</a> | <a href="https://strudel.cc">Strudel REPL</a> | <a href="https://tidalcycles.org">TidalCycles</a>
</p>
<p align="center">
  <a href="https://pi.dev"><img src="https://img.shields.io/badge/Harness-Pi%20Coding%20Agent-FF5252?style=for-the-badge" alt="Pi Coding Agent"></a>
  <a href="https://strudel.cc"><img src="https://img.shields.io/badge/Engine-Strudel%20REPL-1DB954?style=for-the-badge" alt="Strudel Live Coding"></a>
  <a href="https://github.com/earendil-works/pi"><img src="https://img.shields.io/badge/Latency-%3C1ms%20Zero--Token-blue?style=for-the-badge" alt="Zero Latency"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License: MIT"></a>
</p>

> **Live-Coding Music REPL & AI Co-Composer inside the Pi Terminal UI**  
> Powered by [Strudel](https://strudel.cc) & [@earendil-works/pi-coding-agent](https://github.com/earendil-works/pi).

`pi-strudel` turns your Pi coding session into a responsive live-coding music studio and algorave environment. Jam directly from the terminal input box with `<1ms` zero-latency audio updates, or collaborate with Pi's LLM as your agentic co-composer across 8 deep Strudel knowledge skills.

<table>
<tr><td><b>Zero-Latency Fast Path</b></td><td>Direct Strudel expressions (<code>$d1: s("bd*4")</code>, <code>!note("c3")</code>) evaluate in &lt;1ms locally in the Strudel engine without LLM roundtrips or token consumption.</td></tr>
<tr><td><b>Agentic Co-Composer</b></td><td>Natural language musical directions (e.g. <i>"Add a syncopated 909 groove and sidechain a warm pad"</i>) leverage 8 built-in Strudel skills and tool calls (<code>strudel_upsert_tracks</code>, <code>strudel_hush</code>).</td></tr>
<tr><td><b>Pi Session DAG Sync</b></td><td>Tracks persist as <code>strudel/state</code> entries in Pi's conversation tree. Branch navigation (<code>Ctrl+←</code> / <code>Ctrl+→</code>) automatically time-travels and restores music state.</td></tr>
<tr><td><b>Interactive TrueColor REPL</b></td><td>25 FPS ANSI TrueColor playhead widget with cycle progress meter, active track listing, and syntax-highlighted Strudel mini-notation.</td></tr>
<tr><td><b>3 Audio Backends</b></td><td>Switch seamlessly between <code>node</code> (built-in WebAudio synth &amp; drum machine), <code>browser</code> (WebSocket bridge with HTML5 canvas &amp; sample packs), and <code>osc</code> (SuperDirt / SuperCollider / DAW UDP routing).</td></tr>
<tr><td><b>8 Packaged Skills</b></td><td>100% comprehensive reference coverage of mini-notation, tonal harmony, Euclidean rhythms, breakbeat slicing, synths &amp; orbits, DJ transitions, and MIDI/OSC.</td></tr>
</table>

---

## Running Without Global Installation

It is **not** recommended to install this extension globally in `~/.pi/agent/settings.json`. Because this repository is configured as a full Pi package (with a `pi` manifest in `package.json`), you can install or configure it per-workspace via Git or a local directory, or load it per-invocation via CLI flags.

### Option 1: Configure as a Project-Local Package via Git (Recommended)

To configure the package for a specific workspace without installing it globally, you have two quick options:

#### A. Install via CLI (Fastest)

Run `pi install -l` inside your workspace directory:

```bash
mkdir my-music-session && cd my-music-session
pi install -l git:github.com/felipepenha/pi-strudel -a
```

This clones the repository into `my-music-session/.pi/git/` and configures `.pi/settings.json` automatically.

#### B. Manual `.pi/settings.json`

Create `.pi/settings.json` inside your working directory:

```text
my-music-session/
└── .pi/
    └── settings.json
```

Point `"packages"` to the Git repository:

```json
{
  "$schema": "https://pi.dev/schemas/settings.schema.json",
  "packages": [
    "git:github.com/felipepenha/pi-strudel"
  ]
}
```

*(Alternatively, HTTPS `https://github.com/felipepenha/pi-strudel.git` or SSH `git@github.com:felipepenha/pi-strudel.git` are also supported. For local development on cloned code, you can instead point to a local directory via `"packages": ["/path/to/pi-strudel"]` or `"extensions": ["/path/to/pi-strudel/extensions/strudel/index.ts"]`.)*

- Bundled skills (`/skill:strudel-core-mini-notation`, etc.) and tools are discovered automatically from the package manifest.
- Run `pi` from inside `my-music-session/` (pass `--approve` / `-a` to trust project-local settings non-interactively):

```bash
cd my-music-session
pi -a
```

### Updating the Package

When this repository is configured as a Git package in your workspace, you can easily pull the latest updates, audio engine enhancements, and skills:

```bash
# Update all project-local packages
pi update -a --extensions

# Or update this specific package
pi update -a git:github.com/felipepenha/pi-strudel

# Update both pi itself and all packages
pi update --all
```

Pi fetches the latest git commits, updates cached files, and reloads the extension and skills on your next session.

### Option 2: Load Directly via CLI (`--extension` / `-e`)

If you have cloned the repository locally and want to load the extension for a single run without any workspace configuration files:

```bash
git clone https://github.com/felipepenha/pi-strudel.git
cd pi-strudel
npm install
pi -e extensions/strudel/index.ts
```

*(You can also run `pi -e .` from within the cloned repository root).*

- All bundled skills (`/skill:strudel-core-mini-notation`, `/skill:strudel-synths-dsp-orbits`, etc.) and tools are discovered automatically.

### Model & Reasoning Effort Configuration

The extension works with any model provider configured in Pi (`google`, `openai`, `anthropic`, etc.). It uses your configured default model automatically, or you can set `defaultProvider` / `defaultModel` in `<workspace>/.pi/settings.json` or pass `--model` per invocation:

```bash
# Use your default configured model with high thinking effort
pi -a

# Explicitly specify a model and thinking level via Pi's --model flag
pi -a --model google/gemini-3.8-flash:high
pi -a --model anthropic/claude-3-7-sonnet
```

---

## ⚡ Usage & Live-Coding Workflows

### 1. Direct Pattern Entry (Fast Path: <1ms, 0 LLM Tokens)

Assign tracks directly using the `$` prefix or raw calls. The input router intercepts these expressions before the LLM is invoked, recompiling and hot-swapping patterns in under a millisecond:

```javascript
// Drums
$drums: s("bd*4 [~ sd]*2, hh*8").bank("RolandTR909")

// Bass
$bass: note("<c2 eb2 f2 g2>*2").s("sawtooth").lpf(800).lpq(4)

// Chords
$pad: chord("<Cm9 Fm9>").voicings('lefthand').s("triangle").room(0.8)
```

You can also use:
- `!<code>` to evaluate an expression directly: `!note("c3 e3 g3 b3")`
- `/s <code>` to quick-eval: `/s $lead: note("c4 eb4 g4 bb4").fast(2)`

### 2. Natural Language Co-Composing (Agent Path)

Type musical ideas in plain English into the Pi chat:

> *"Add a syncopated 909 groove and sidechain a warm Dorian pad to the kick"*  
> *"Drop the drums for 4 bars, filter the pad up with smooth Perlin noise, and introduce an arpeggiated acid line in C Dorian."*

Pi receives the active session state (CPS, tracks, playing status) injected in the prompt context, consults its 8 packaged Strudel skills, and updates playback using `strudel_upsert_tracks`.

### 3. Pi Session DAG History Sync

Every track change is automatically checkpointed to Pi's conversation tree (`strudel/state`).

When navigating branches in Pi's conversation DAG (`Ctrl+←` / `Ctrl+→`), the music engine restores the exact musical state from that point in time—allowing you to branch variations, explore alternative mixes, or revert to previous arrangements seamlessly.

### 4. Switchable Audio Backends

Switch backends at any time with `/audio <node|browser|osc>`:

1. **`node`** *(Default)*: Zero-setup built-in WebAudio synthesis with oscillators, filters, ADSR/pitch envelopes, and synthesized drum voices (`bd`, `sd`, `hh`, `oh`, `cp`, `rim`, `cb`). Pure CLI operation with no browser needed.
2. **`browser`**: Full WebAudio + samples + canvas visualizers via local WebSocket bridge (`127.0.0.1:41234`).
3. **`osc`**: SuperDirt / External DAW UDP routing (`127.0.0.1:57120`).

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
| `/audio` | `<node\|browser\|osc>` | Switches audio output backend (`node`, `browser`, `osc`) |
| `/preset` | `<techno\|dnb\|ambient\|house>` | Loads a curated multi-track groove preset |
| `/jam-save` | `<filename.strudel.js>` | Exports session to a runnable `.strudel.js` file |
| `/jam-load` | `<filename.strudel.js>` | Imports a saved Strudel session file into tracks |

---

## 🛠️ Agent Tools

Pi's LLM has access to 3 registered tools:

| Tool | Description |
| :--- | :--- |
| `strudel_upsert_tracks` | Validates syntax and updates multi-track patterns with instant hot-swapping and session DAG checkpointing. |
| `strudel_get_state` | Inspects current tempo, active cycle, audio backend, and all tracks. |
| `strudel_hush` | Silences all audio playback immediately. |

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

## 📄 License & Attributions

This repository is licensed under the **MIT License** (see [`LICENSE`](LICENSE)).

### Attributions

- [Strudel](https://strudel.cc) created by [Alex McLean](https://github.com/yaxu) and [Felix Roos](https://github.com/felixroos), licensed under GPL-3.0.
- [Pi Coding Agent](https://pi.dev) created by [Mario Zupan](https://github.com/earendil-works), licensed under MIT.
