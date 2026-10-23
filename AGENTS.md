# AGENTS.md — Agent Guidelines for pi-strudel

`pi-strudel` is a live-coding music REPL and agentic co-composer extension package for the Pi coding agent (`@earendil-works/pi-coding-agent`).

## Core Responsibilities & Flow

1. **Zero-Latency Audio Execution:**
   - Direct Strudel expressions (e.g. `$d1: s("bd*4")`, `!note("c3")`, bare constructors like `s("bd sd")`) and slash commands are intercepted by the input router in `<1ms`. They evaluate directly locally in the Strudel engine and never trigger LLM roundtrips.
2. **Co-Composer Mode (Agent Path):**
   - Natural language musical prompts (e.g., "Add a syncopated Euclidean hi-hat pattern and sidechain a warm pad") are handled by the LLM.
   - The LLM receives the active session state (CPS, tracks, playing status) injected in the prompt context.
   - The LLM modifies playback using the registered agent tool `strudel_upsert_tracks` or silences playback using `strudel_hush`.
3. **Session Branching & DAG State:**
   - Whenever tracks are changed, the state is persisted via `pi.appendEntry("strudel/state", state)`.
   - Navigating branches in Pi's conversation DAG (`Ctrl+←` / `Ctrl+→`) automatically restores the music state associated with that point in time.
4. **Tempo Standards:**
   - Default CPS is `0.5` (120 BPM in 4/4 time; 1 cycle = 2 seconds = 4 beats).
   - `bpm = cps * 60 * 4`.
   - `cps = bpm / 240`.
