---
name: strudel-synths-dsp-orbits
description: Superdough oscillators, wavetables (wt_*), ZZFX, FM synthesis, ADSR/pitch/filter envelopes, effects signal chain, orbits, and sidechain ducking.
---
# Strudel Synths, Envelopes, Signal Chain, Orbits & Ducking

## 1. Sound Sources & Synthesis (`strudel.cc/learn/synths`)
- Standard Oscillators: `.s("sine")`, `.s("sawtooth")`, `.s("square")`, `.s("triangle")`, `.s("supersaw")`, `.s("pulse")`.
- Noise Generators: `.s("white")`, `.s("pink")`, `.s("brown")`, `.s("crackle")` (tune crackle density with `.density()`).
- Wavetable Synthesis (`wt_*`): Over 1,000 Adventure Kid Wavetables (AKWF) built-in; any sample starting with `wt_` loops automatically (`note("c2 eb2").s("wt_digital").loopEnd(sine.range(0.1, 1))`).
- ZZFX 8-bit Procedural Synth: `.s("zzfx")` with parameters `zzfx`, `zrand`, `znoise`, `zsin`, `zsaw`, `ztri`.
- Unison / Supersaw Controls: `.detune(amount)` (oscillator detuning), `.n(voices)` (unison voice count on `supersaw`), `.pw(width)` (pulse width on `pulse`).
- FM Synthesis: `.fm(index)` (modulation depth), `.fmh(harmonicityRatio)` (`1, 2, 3` = harmonic, `1.414` = metallic bell), `.fmenv(depth)`, `.fmattack(s)`, `.fmdecay(s)`, `.fmsustain(0..1)`, `.fmrelease(s)`.
- Additive partials: `.partials([1, 0.5, 0.25, 0.1])`.

## 2. All 4 Envelope Types (`strudel.cc/learn/effects`)
1. **Amplitude ADSR:** `.attack(s)`, `.decay(s)`, `.sustain(0..1)`, `.release(s)`, or shorthand `.adsr("0.01:0.2:0.5:0.3")` / `.ad(0.01, 0.2)`. Duration gate: `.legato(multiplier)` or `.clip(multiplier)`.
2. **Low-Pass Filter Envelope:** `.lpenv(depth)` (positive or negative octaves), `.lpa(s)` / `.lpattack(s)`, `.lpd(s)` / `.lpdecay(s)`, `.lps(0..1)` / `.lpsustain(0..1)`, `.lpr(s)` / `.lprelease(s)`.
3. **High-Pass & Band-Pass Envelopes:** `.hpenv(depth)`, `.hpa(s)`, `.hpd(s)`, `.hps(0..1)`, `.hpr(s)` and `.bpenv(depth)`, `.bpa(s)`, `.bpd(s)`, `.bps(0..1)`, `.bpr(s)`.
4. **Pitch Envelope (Crucial for synthesized kicks/lazers):** `.penv(semitones)`, `.pattack(s)`, `.pdecay(s)`, `.psustain(0..1)`, `.prelease(s)`, `.pcurve(0..1)`, `.panchor(0..1)`.
   - *Pure Synth 909 Kick Example:* `note("c1*4").s("sine").penv(24).pdecay(0.06).decay(0.3).sustain(0).distort(1.5)`

## 3. Complete Superdough Effects Signal Chain (Ordered)
Note: Each effect can only appear once per pattern chain (repeating `.lpf()` overrides the previous value).
1. **Gain:** `.gain(0..2)` (pre-FX amplitude), `.velocity(0..1)`
2. **Filters:**
   - Low-pass: `.lpf(hz)` (alias `.cutoff()`), `.lpq(q)` (alias `.resonance()`)
   - High-pass: `.hpf(hz)` (alias `.hcutoff()`), `.hpq(q)`
   - Band-pass: `.bpf(hz)` (alias `.bandf()`), `.bpq(q)` (alias `.bandq()`)
   - Formant Vowel: `.vowel("a e i o u ae aa oe ue y uh un en an on")`
3. **Distortion & Lo-Fi:** `.coarse(factor)` (sample rate reduction), `.crush(bits)` (bitcrusher), `.shape(0..1)` (waveshaper), `.distort(amount)`
4. **Modulation & Dynamics:**
   - Vibrato: `.vib(hz)`, `.vibmod(semitones)`
   - Tremolo: `.tremolo(depth)` / `.tremolosync(cycles)`, `.tremolodepth(0..1)`, `.tremoloshape("sine"|"saw"|"square"|"tri")`, `.tremolophase(0..1)`
   - Phaser: `.phaser(rate)`, `.phaserdepth(0..1)`, `.phasersweep(hz)`, `.phasercenter(hz)`
   - Compressor: `.compressor("threshold:ratio:knee:attack:release")` (e.g., `.compressor("-20:10:5:0.005:0.05")`)
5. **Panning & Post-Gain:** `.pan(0..1)` (`0`=Left, `0.5`=Center, `1`=Right), `.postgain(0..2)` (alias `.post()`)
6. **Global Orbit Sends (Dry / Delay / Reverb):**
   - `.dry(0..1)`
   - `.delay(sendAmount)`, `.delaytime(seconds)` / `.delaysync(cycles)`, `.delayfeedback(0..0.95)` (alias `.delayfb()`)
   - `.room(sendAmount)`, `.size(0..1)` (alias `.roomsize()`), `.rlpf(hz)` (reverb damping), `.ir(sampleName)` (custom convolution impulse response)

## 4. Orbits & Sidechain Ducking (`orbit` & `duckorbit`)
- `.orbit(n)` — Routes pattern to bus `n` (default `1`). Delay and reverb settings are shared per orbit, so put heavy reverb pads on `.orbit(2)` and dry drums on `.orbit(1)`.
- **Sidechain Ducking:** Any kick/trigger can duck another orbit!
  - On the kick track: `s("bd*4").duckorbit(2).duckattack(0.02).duckdepth(0.85)`
  - On the bass/pad track: `note("c2").s("sawtooth").orbit(2)` (automatically pumps whenever the kick hits!).
