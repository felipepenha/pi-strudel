import { AudioContext } from "node-web-audio-api";
import { noteToMidi, midiToFreq } from "@strudel/core";
import type { AudioMode } from "./state-store.js";
import { WebSocketServer, WebSocket } from "ws";
import dgram from "node:dgram";

export class AudioBridge {
  private mode: AudioMode = "node";
  private audioCtx: AudioContext | null = null;
  private masterGain: any = null;
  private limiter: any = null;
  private noiseBuffer: any = null;
  private wss: WebSocketServer | null = null;
  private udpSocket: dgram.Socket | null = null;

  // Voice management to prevent voice compounding / buffer underruns
  private activeSynthVoices: Set<(fadeTime: number) => void> = new Set();
  private drumVoices: Map<string, (fadeTime: number) => void> = new Map();

  constructor(mode: AudioMode = "node") {
    this.mode = mode;
  }

  getMode(): AudioMode {
    return this.mode;
  }

  async setMode(mode: AudioMode): Promise<void> {
    this.mode = mode;
    if (mode === "browser") {
      this.initBrowserServer();
    } else if (mode === "osc") {
      this.initOscSocket();
    } else {
      this.initAudioContext();
    }
  }

  private initAudioContext(): AudioContext | null {
    if (!this.audioCtx) {
      try {
        const ctx: AudioContext = new (AudioContext as any)({ latencyHint: "playback" });
        this.audioCtx = ctx;
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }

        // Master Gain Bus with headroom for multi-track polyphony
        this.masterGain = ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.32, ctx.currentTime);

        // Brickwall soft-saturation waveshaper: mathematically guarantees signal never clips (+/-1.0)
        // Completely protects speakers and ears from harsh digital clipping distortion
        const shaper = (ctx as any).createWaveShaper?.();
        if (shaper) {
          const nSamples = 4096;
          const curve = new Float32Array(nSamples);
          for (let i = 0; i < nSamples; ++i) {
            const x = (i * 2) / nSamples - 1;
            // Smooth hyperbolic tangent transfer curve
            curve[i] = Math.tanh(x * 1.35);
          }
          shaper.curve = curve;
          shaper.oversample = "none";

          this.masterGain.connect(shaper);
          shaper.connect(ctx.destination);
        } else {
          this.masterGain.connect(ctx.destination);
        }

        this.createNoiseBuffer();
      } catch (err) {
        // If system audio is unavailable in headless environment
        this.audioCtx = null;
        this.masterGain = null;
        this.limiter = null;
      }
    }
    return this.audioCtx;
  }

  private getMasterBus(ctx: AudioContext): any {
    if (this.masterGain) {
      return this.masterGain;
    }
    return ctx.destination;
  }

  hush(): void {
    if (this.masterGain && this.audioCtx) {
      try {
        this.masterGain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        this.masterGain.gain.setValueAtTime(0.32, this.audioCtx.currentTime + 0.05);
      } catch {}
    }
    const now = this.audioCtx?.currentTime ?? 0;
    for (const stop of this.drumVoices.values()) {
      try { stop(now); } catch {}
    }
    this.drumVoices.clear();

    for (const stop of this.activeSynthVoices) {
      try { stop(now); } catch {}
    }
    this.activeSynthVoices.clear();
  }

  private createNoiseBuffer(): void {
    if (!this.audioCtx || this.noiseBuffer) return;
    try {
      const bufferSize = this.audioCtx.sampleRate * 2;
      const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
    } catch {
      this.noiseBuffer = null;
    }
  }

  private initBrowserServer(): void {
    if (!this.wss) {
      try {
        this.wss = new WebSocketServer({ port: 41234, host: "127.0.0.1" });
        this.wss.on("connection", (ws) => {
          ws.send(JSON.stringify({ type: "connected", timestamp: Date.now() }));
        });
      } catch (err) {
        console.error("Failed to start browser bridge WebSocket server:", err);
      }
    }
  }

  private initOscSocket(): void {
    if (!this.udpSocket) {
      try {
        this.udpSocket = dgram.createSocket("udp4");
      } catch (err) {
        console.error("Failed to create OSC UDP socket:", err);
      }
    }
  }

  dispatchHaps(haps: any[], referenceCycle?: number, cps: number = 0.5): void {
    if (!haps || haps.length === 0) return;

    if (this.mode === "browser") {
      this.broadcastBrowser(haps);
      return;
    }

    if (this.mode === "osc") {
      this.sendOsc(haps);
      return;
    }

    // Default Node WebAudio Mode
    const ctx = this.initAudioContext();
    if (!ctx) return;

    // Filter to onset-only events: ignore continuous slices of already-sounding haps
    const onsetsOnly = haps.filter((hap: any) => {
      if (typeof hap.hasOnset === "function") {
        return hap.hasOnset();
      }
      return true;
    });
    if (onsetsOnly.length === 0) return;

    // Polyphonic voice limiter to avoid event bursts / lag spikes
    const MAX_VOICES_PER_TICK = 16;
    const activeHaps = onsetsOnly.length > MAX_VOICES_PER_TICK ? onsetsOnly.slice(0, MAX_VOICES_PER_TICK) : onsetsOnly;

    // Dynamic polyphonic headroom scaling
    const polyScale = activeHaps.length > 3 ? Math.sqrt(3 / activeHaps.length) : 1.0;

    const baseLookahead = 0.1; // 100ms lookahead (matches official Strudel/Tidal scheduler latency)
    const isCycleNumber = typeof referenceCycle === "number" && referenceCycle < 100000;
    const refCycle = isCycleNumber ? referenceCycle : 0;
    const safeCps = Math.max(0.01, cps);

    for (const hap of activeHaps) {
      try {
        const hapBegin = Number(hap.whole?.begin ?? hap.part?.begin ?? refCycle);
        const cycleDelta = Math.max(0, hapBegin - refCycle);
        const timeOffsetSec = isCycleNumber ? cycleDelta / safeCps : 0;
        const scheduledTime = Math.max(ctx.currentTime + 0.03, ctx.currentTime + baseLookahead + timeOffsetSec);

        this.playHapNodeAudio(ctx, hap, scheduledTime, polyScale, safeCps);
      } catch (e) {
        // Voice failure should not crash scheduler
      }
    }
  }

  private playHapNodeAudio(ctx: AudioContext, hap: any, scheduledTime: number, polyScale: number, safeCps: number): void {
    const val = hap.value || {};
    const rawGain = typeof val.gain === "number" ? Math.max(0, Math.min(val.gain, 1.5)) : 0.4;
    const gainVal = Math.max(0.001, rawGain * polyScale);
    const sound = String(val.s || val.sound || "").toLowerCase();

    // Check synthesized drum sound
    if (sound === "bd") {
      this.playKick(ctx, scheduledTime, gainVal, val);
      return;
    }
    if (sound === "sd") {
      this.playSnare(ctx, scheduledTime, gainVal, val);
      return;
    }
    if (sound === "hh") {
      this.playHiHat(ctx, scheduledTime, gainVal, false);
      return;
    }
    if (sound === "oh") {
      this.playHiHat(ctx, scheduledTime, gainVal, true);
      return;
    }
    if (sound === "cp") {
      this.playClap(ctx, scheduledTime, gainVal);
      return;
    }
    if (sound === "rim") {
      this.playRimshot(ctx, scheduledTime, gainVal);
      return;
    }
    if (sound === "cb") {
      this.playCowbell(ctx, scheduledTime, gainVal);
      return;
    }

    // Melodic / tonal synth voice
    let freq = 0;
    if (typeof val.freq === "number") {
      freq = val.freq;
    } else if (val.note !== undefined) {
      const midi = typeof val.note === "number" ? val.note : noteToMidi(val.note);
      if (typeof midi === "number" && !isNaN(midi)) {
        freq = midiToFreq(midi);
      }
    } else if (val.n !== undefined) {
      const midi = 60 + Number(val.n);
      if (!isNaN(midi)) {
        freq = midiToFreq(midi);
      }
    }

    if (freq >= 20 && freq <= 12000) {
      this.playSynthNote(ctx, scheduledTime, freq, gainVal, val, hap, safeCps);
    }
  }

  private playKick(ctx: AudioContext, time: number, gainVal: number, val: any): void {
    // Choke previous kick to eliminate low-end mud & overlapping voice compounding
    this.drumVoices.get("bd")?.(time);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const startFreq = typeof val.penv === "number" ? Math.max(50, Math.min(600, 150 * Math.pow(2, val.penv / 12))) : 150;
    const endFreq = 42;
    const decay = typeof val.pdecay === "number" ? Math.max(0.02, Math.min(0.5, val.pdecay)) : 0.08;
    const dur = typeof val.decay === "number" ? Math.max(decay + 0.05, Math.min(1.0, val.decay)) : 0.28;

    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + decay);

    // Micro-fade attack eliminates click discontinuity at note onset
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, gainVal), time + 0.002);
    gain.gain.linearRampToValueAtTime(0, time + dur);

    osc.connect(gain);
    gain.connect(this.getMasterBus(ctx));

    const stopFn = (fadeTime: number) => {
      try {
        const ft = Math.max(ctx.currentTime, fadeTime);
        gain.gain.cancelScheduledValues(ft);
        gain.gain.setValueAtTime(gain.gain.value, ft);
        gain.gain.linearRampToValueAtTime(0, ft + 0.003);
        osc.stop(ft + 0.005);
      } catch {}
    };
    this.drumVoices.set("bd", stopFn);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
      if (this.drumVoices.get("bd") === stopFn) {
        this.drumVoices.delete("bd");
      }
    };

    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  private playSnare(ctx: AudioContext, time: number, gainVal: number, _val: any): void {
    // Choke previous snare
    this.drumVoices.get("sd")?.(time);

    const dur = 0.2;

    // Body tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
    oscGain.gain.setValueAtTime(0, time);
    oscGain.gain.linearRampToValueAtTime(Math.max(0.0001, gainVal * 0.7), time + 0.002);
    oscGain.gain.linearRampToValueAtTime(0, time + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.getMasterBus(ctx));

    let noiseNode: any = null;
    let noiseGainNode: any = null;

    // Noise snap
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1000, time);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0, time);
      noiseGain.gain.linearRampToValueAtTime(Math.max(0.0001, gainVal * 0.8), time + 0.002);
      noiseGain.gain.linearRampToValueAtTime(0, time + dur);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.getMasterBus(ctx));

      noiseNode = noise;
      noiseGainNode = noiseGain;

      noise.onended = () => {
        try {
          noise.disconnect();
          filter.disconnect();
          noiseGain.disconnect();
        } catch {}
      };

      noise.start(time);
      noise.stop(time + dur + 0.01);
    }

    const stopFn = (fadeTime: number) => {
      try {
        const ft = Math.max(ctx.currentTime, fadeTime);
        oscGain.gain.cancelScheduledValues(ft);
        oscGain.gain.setValueAtTime(oscGain.gain.value, ft);
        oscGain.gain.linearRampToValueAtTime(0, ft + 0.003);
        osc.stop(ft + 0.005);
        if (noiseNode && noiseGainNode) {
          noiseGainNode.gain.cancelScheduledValues(ft);
          noiseGainNode.gain.setValueAtTime(noiseGainNode.gain.value, ft);
          noiseGainNode.gain.linearRampToValueAtTime(0, ft + 0.003);
          noiseNode.stop(ft + 0.005);
        }
      } catch {}
    };
    this.drumVoices.set("sd", stopFn);

    osc.onended = () => {
      try {
        osc.disconnect();
        oscGain.disconnect();
      } catch {}
      if (this.drumVoices.get("sd") === stopFn) {
        this.drumVoices.delete("sd");
      }
    };

    osc.start(time);
    osc.stop(time + 0.13);
  }

  private playHiHat(ctx: AudioContext, time: number, gainVal: number, open: boolean): void {
    // Choke previous hat (open hats choked by closed hats or next open hat)
    this.drumVoices.get("hat")?.(time);

    const dur = open ? 0.35 : 0.06;
    if (!this.noiseBuffer) return;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(7500, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, gainVal * (open ? 0.5 : 0.35)), time + 0.002);
    gain.gain.linearRampToValueAtTime(0, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getMasterBus(ctx));

    const stopFn = (fadeTime: number) => {
      try {
        const ft = Math.max(ctx.currentTime, fadeTime);
        gain.gain.cancelScheduledValues(ft);
        gain.gain.setValueAtTime(gain.gain.value, ft);
        gain.gain.linearRampToValueAtTime(0, ft + 0.003);
        noise.stop(ft + 0.005);
      } catch {}
    };
    this.drumVoices.set("hat", stopFn);

    noise.onended = () => {
      try {
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
      if (this.drumVoices.get("hat") === stopFn) {
        this.drumVoices.delete("hat");
      }
    };

    noise.start(time);
    noise.stop(time + dur + 0.01);
  }

  private playClap(ctx: AudioContext, time: number, gainVal: number): void {
    this.drumVoices.get("cp")?.(time);

    if (!this.noiseBuffer) return;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1100, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, gainVal * 0.7), time + 0.002);
    gain.gain.linearRampToValueAtTime(0, time + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getMasterBus(ctx));

    const stopFn = (fadeTime: number) => {
      try {
        const ft = Math.max(ctx.currentTime, fadeTime);
        gain.gain.cancelScheduledValues(ft);
        gain.gain.setValueAtTime(gain.gain.value, ft);
        gain.gain.linearRampToValueAtTime(0, ft + 0.003);
        noise.stop(ft + 0.005);
      } catch {}
    };
    this.drumVoices.set("cp", stopFn);

    noise.onended = () => {
      try {
        noise.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
      if (this.drumVoices.get("cp") === stopFn) {
        this.drumVoices.delete("cp");
      }
    };

    noise.start(time);
    noise.stop(time + 0.16);
  }

  private playRimshot(ctx: AudioContext, time: number, gainVal: number): void {
    this.drumVoices.get("rim")?.(time);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1600, time);
    osc.frequency.exponentialRampToValueAtTime(400, time + 0.03);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, gainVal * 0.6), time + 0.002);
    gain.gain.linearRampToValueAtTime(0, time + 0.04);

    osc.connect(gain);
    gain.connect(this.getMasterBus(ctx));

    const stopFn = (fadeTime: number) => {
      try {
        const ft = Math.max(ctx.currentTime, fadeTime);
        gain.gain.cancelScheduledValues(ft);
        gain.gain.setValueAtTime(gain.gain.value, ft);
        gain.gain.linearRampToValueAtTime(0, ft + 0.003);
        osc.stop(ft + 0.005);
      } catch {}
    };
    this.drumVoices.set("rim", stopFn);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
      if (this.drumVoices.get("rim") === stopFn) {
        this.drumVoices.delete("rim");
      }
    };

    osc.start(time);
    osc.stop(time + 0.05);
  }

  private playCowbell(ctx: AudioContext, time: number, gainVal: number): void {
    this.drumVoices.get("cb")?.(time);

    const dur = 0.2;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = "square";
    osc2.type = "square";
    osc1.frequency.setValueAtTime(540, time);
    osc2.frequency.setValueAtTime(800, time);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1000, time);
    filter.Q.setValueAtTime(3, time);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, gainVal * 0.5), time + 0.002);
    gain.gain.linearRampToValueAtTime(0, time + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.getMasterBus(ctx));

    const stopFn = (fadeTime: number) => {
      try {
        const ft = Math.max(ctx.currentTime, fadeTime);
        gain.gain.cancelScheduledValues(ft);
        gain.gain.setValueAtTime(gain.gain.value, ft);
        gain.gain.linearRampToValueAtTime(0, ft + 0.003);
        osc1.stop(ft + 0.005);
        osc2.stop(ft + 0.005);
      } catch {}
    };
    this.drumVoices.set("cb", stopFn);

    osc1.onended = () => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
      if (this.drumVoices.get("cb") === stopFn) {
        this.drumVoices.delete("cb");
      }
    };

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur + 0.01);
    osc2.stop(time + dur + 0.01);
  }

  private playSynthNote(
    ctx: AudioContext,
    time: number,
    freq: number,
    gainVal: number,
    val: any,
    hap?: any,
    safeCps: number = 0.5
  ): void {
    // Polyphony cap: maximum 8 concurrent synth voices prevents CoreAudio buffer underruns
    if (this.activeSynthVoices.size >= 8) {
      const oldest = this.activeSynthVoices.values().next().value;
      if (oldest) {
        oldest(time);
        this.activeSynthVoices.delete(oldest);
      }
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Sound type & instrument shaping
    const sType = String(val.s || "sawtooth").toLowerCase();
    let attack = typeof val.attack === "number" ? Math.max(0.005, Math.min(1.0, val.attack)) : 0.01;
    let decay = typeof val.decay === "number" ? Math.max(0.01, Math.min(2.0, val.decay)) : 0.15;
    let sustain = typeof val.sustain === "number" ? Math.max(0.0, Math.min(1.0, val.sustain)) : 0.5;
    let release = typeof val.release === "number" ? Math.max(0.01, Math.min(2.0, val.release)) : 0.08;

    if (["sine", "square", "sawtooth", "triangle"].includes(sType)) {
      osc.type = sType as OscillatorType;
    } else if (sType.includes("piano") || sType.includes("epiano") || sType.includes("rhodes") || sType.includes("keys")) {
      osc.type = "sine";
      attack = 0.005;
      decay = 0.4;
      sustain = 0.2;
    } else if (sType.includes("bass")) {
      osc.type = "triangle";
    } else if (sType.includes("violin") || sType.includes("strings") || sType.includes("pad")) {
      osc.type = "sawtooth";
      attack = 0.05;
      sustain = 0.7;
      release = 0.2;
    } else {
      osc.type = "sawtooth";
    }

    osc.frequency.setValueAtTime(freq, time);

    // Only instantiate BiquadFilter if cutoff / lpf is explicitly requested (saves 50% DSP load)
    const hasFilter = typeof val.cutoff === "number" || typeof val.lpf === "number";
    let filter: any = null;
    if (hasFilter) {
      const rawCutoff = typeof val.cutoff === "number" ? val.cutoff : val.lpf;
      const cutoff = Math.max(40, Math.min(18000, rawCutoff));
      const rawRes = typeof val.resonance === "number" ? val.resonance : (typeof val.lpq === "number" ? val.lpq : 1);
      const resonance = Math.max(0.1, Math.min(15, rawRes));

      filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(cutoff, time);
      filter.Q.setValueAtTime(resonance, time);

      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    // Compute true note duration from Strudel hap
    const rawDur = hap?.duration ?? (hap?.whole ? Number(hap.whole.end) - Number(hap.whole.begin) : 0.25);
    const hapDurationCycles = Number(rawDur) || 0.25;
    const calculatedDuration = typeof val.duration === "number"
      ? val.duration
      : Math.max(0.04, Math.min(1.5, hapDurationCycles / safeCps));
    const noteDuration = calculatedDuration;

    // Strictly monotonic timeline:
    // t0 (start) < t1 (attack peak) < t2 (decay end) <= t3 (note end / sustain hold) < t4 (release end)
    const baseGain = Math.max(0.0001, gainVal);
    const susGain = Math.max(0.0001, baseGain * sustain);

    const t0 = time;
    const t1 = t0 + attack;
    const t2 = t1 + decay;
    const t3 = Math.max(t2, t0 + noteDuration);
    const t4 = t3 + release;

    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(baseGain, t1);
    gain.gain.linearRampToValueAtTime(susGain, t2);
    if (t3 > t2) {
      gain.gain.setValueAtTime(susGain, t3);
    }
    gain.gain.linearRampToValueAtTime(0, t4);

    gain.connect(this.getMasterBus(ctx));

    const stopFn = (fadeTime: number) => {
      try {
        const ft = Math.max(ctx.currentTime, fadeTime);
        gain.gain.cancelScheduledValues(ft);
        gain.gain.setValueAtTime(gain.gain.value, ft);
        gain.gain.linearRampToValueAtTime(0, ft + 0.004);
        osc.stop(ft + 0.006);
      } catch {}
    };
    this.activeSynthVoices.add(stopFn);

    osc.onended = () => {
      try {
        osc.disconnect();
        if (filter) filter.disconnect();
        gain.disconnect();
      } catch {}
      this.activeSynthVoices.delete(stopFn);
    };

    osc.start(t0);
    osc.stop(t4 + 0.01);
  }

  private broadcastBrowser(haps: any[]): void {
    if (!this.wss) return;
    const msg = JSON.stringify({ type: "haps", data: haps });
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  }

  private sendOsc(haps: any[]): void {
    if (!this.udpSocket) return;
    try {
      const payload = Buffer.from(JSON.stringify(haps));
      this.udpSocket.send(payload, 57120, "127.0.0.1");
    } catch {
      // Ignore UDP send errors
    }
  }

  async dispose(): Promise<void> {
    if (this.audioCtx) {
      try {
        await this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
      this.masterGain = null;
      this.limiter = null;
    }
    if (this.wss) {
      try {
        this.wss.close();
      } catch {}
      this.wss = null;
    }
    if (this.udpSocket) {
      try {
        this.udpSocket.close();
      } catch {}
      this.udpSocket = null;
    }
  }
}

export const globalAudioBridge = new AudioBridge();
