---
name: strudel-tonal-harmony-xen
description: Pitches, MIDI notes, frequencies, scales, modes, chord symbols, voice leading (.voicings), arpeggios, pattern transposition, and microtonal/xenharmonic (.xen/.edo) tuning.
---
# Strudel Tonal Functions, Harmony, Voicings & Microtonality

## 1. Pitch & Note Functions (`strudel.cc/learn/tonal`)
- `note("c4 eb4 g4 b4")` — Plays named notes (supports flats `b`, sharps `#`, octave numbers) or MIDI note numbers (`60` = `c4`).
- `n("0 2 4 7").scale("C:minor")` — Plays zero-indexed scale degrees locked to any root and scale/mode.
- `freq("220 330 440")` — Plays exact frequencies in Hz.
- `.octave(n)` — Shifts pattern octave (default `3`).
- `.transpose(semitones)` — Transposes notes by semitones or interval strings (`"P5"`, `"M3"`).

## 2. Scales & Modes (`.scale()`)
Format: `.scale("Root:scaleName")` or `.scale("C4:dorian")` (includes root octave!).
- Diatonic Modes: `major` (`ionian`), `dorian`, `phrygian`, `lydian`, `mixolydian`, `minor` (`aeolian`), `locrian`.
- Minor & Jazz Variants: `harmonic minor`, `melodic minor`, `phrygian dominant`, `lydian dominant`, `altered`, `bebop`, `whole tone`, `diminished` (`whole-half` / `half-whole`).
- Pentatonic & Blues: `major pentatonic`, `minor pentatonic`, `blues`, `egyptian`.
- World / Historical Scales: `hirajoshi`, `iwato`, `kumoi`, `insen`, `pelog`, `prometheus`, `enigmatic`, `double harmonic major`.
- `.scaleTranspose(steps)` — Transposes inside the current scale by scale steps (diatonic transposition!).

## 3. Chords, Voicings & Arpeggios
- `chord("<Cm9 Dm7b5 Fm7 G7alt>")` — Defines chord progressions using standard jazz/pop symbols (`maj7`, `m7`, `7`, `m9`, `maj9`, `sus4`, `dim7`, `m7b5`, `7b9`, `7#9`, `add9`, `6/9`).
- `.voicings('lefthand')` (or `.dict('ireal' | 'lefthand' | 'guidetones' | 'triads')`) — Applies smooth voice-leading so adjacent chords minimize finger movement around `.anchor("c4")`.
- `.rootNotes(octave)` — Extracts the root note of each chord in a progression for instant basslines (`chord("<Cm7 Cm7 Fm7 G7>").rootNotes(2).s("sawtooth")`).
- `.arp("0 1 2 3 2 1")` — Arpeggiates voiced chords by voice index.

## 4. Arithmetic & Microtonality / Xenharmonic (`@strudel/xen`)
- Arithmetic combinators: `.add()`, `.sub()`, `.mul()`, `.div()`, `.mod()` (e.g., `n("0 2 4").add("<0 2 4 -1>").scale("C:minor")`).
- Equal Divisions of the Octave (EDO): `n("0 3 6 11 15 19").edo(19)` (divides octave into 19 equal steps instead of 12!).
- Just Intonation / Ratios: `freq("200").mul("1 9/8 5/4 4/3 3/2 5/3 15/8")` or `.xen(tuningTable)`.
