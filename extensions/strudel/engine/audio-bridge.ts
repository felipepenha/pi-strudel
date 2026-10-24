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
        this.audioCtx = new AudioContext();
        if (this.audioCtx.state === "suspended") {
          this.audioCtx.resume().catch(() => {});
        }

        // Master Gain Bus
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(0.45, this.audioCtx.currentTime);

        // Brickwall Limiter to prevent clipping / distortion bursts
        this.limiter = (this.audioCtx as any).createDynamicsCompressor?.() || null;
        if (this.limiter) {
          this.limiter.threshold.setValueAtTime(-2.0, this.audioCtx.currentTime);
          this.limiter.knee.setValueAtTime(0.0, this.audioCtx.currentTime);
          this.limiter.ratio.setValueAtTime(20.0, this.audioCtx.currentTime);
          this.limiter.attack.setValueAtTime(0.002, this.audioCtx.currentTime);
          this.limiter.release.setValueAtTime(0.08, this.audioCtx.currentTime);

          this.masterGain.connect(this.limiter);
          this.limiter.connect(this.audioCtx.destination);
        } else {
          this.masterGain.connect(this.audioCtx.destination);
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

    // Polyphonic voice limiter to avoid event bursts / lag spikes
    const MAX_VOICES_PER_TICK = 16;
    const activeHaps = haps.length > MAX_VOICES_PER_TICK ? haps.slice(0, MAX_VOICES_PER_TICK) : haps;

    // Dynamic polyphonic headroom scaling
    const polyScale = activeHaps.length > 3 ? Math.sqrt(3 / activeHaps.length) : 1.0;

    const baseLookahead = 0.03; // 30ms lookahead for smooth jitter-free WebAudio scheduling
    const isCycleNumber = typeof referenceCycle === "number" && referenceCycle < 100000;
    const refCycle = isCycleNumber ? referenceCycle : 0;
    const safeCps = Math.max(0.01, cps);

    for (const hap of activeHaps) {
      try {
        const hapBegin = Number(hap.whole?.begin ?? hap.part?.begin ?? refCycle);
        const cycleDelta = Math.max(0, hapBegin - refCycle);
        const timeOffsetSec = isCycleNumber ? cycleDelta / safeCps : 0;
        const scheduledTime = Math.max(ctx.currentTime + 0.015, ctx.currentTime + baseLookahead + timeOffsetSec);

        this.playHapNodeAudio(ctx, hap, scheduledTime, polyScale);
      } catch (e) {
        // Voice failure should not crash scheduler
      }
    }
  }

  private playHapNodeAudio(ctx: AudioContext, hap: any, scheduledTime: number, polyScale: number): void {
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
      this.playSynthNote(ctx, scheduledTime, freq, gainVal, val);
    }
  }

  private playKick(ctx: AudioContext, time: number, gainVal: number, val: any): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const startFreq = typeof val.penv === "number" ? Math.max(50, Math.min(600, 150 * Math.pow(2, val.penv / 12))) : 150;
    const endFreq = 42;
    const decay = typeof val.pdecay === "number" ? Math.max(0.02, Math.min(0.5, val.pdecay)) : 0.08;
    const dur = typeof val.decay === "number" ? Math.max(decay + 0.05, Math.min(1.0, val.decay)) : 0.28;

    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + decay);

    gain.gain.setValueAtTime(Math.max(0.0001, gainVal), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(gain);
    gain.connect(this.getMasterBus(ctx));

    osc.start(time);
    osc.stop(time + dur + 0.01);
  }

  private playSnare(ctx: AudioContext, time: number, gainVal: number, _val: any): void {
    const dur = 0.2;

    // Body tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
    oscGain.gain.setValueAtTime(Math.max(0.0001, gainVal * 0.7), time);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.getMasterBus(ctx));
    osc.start(time);
    osc.stop(time + 0.13);

    // Noise snap
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1000, time);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(Math.max(0.0001, gainVal * 0.8), time);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.getMasterBus(ctx));

      noise.start(time);
      noise.stop(time + dur + 0.01);
    }
  }

  private playHiHat(ctx: AudioContext, time: number, gainVal: number, open: boolean): void {
    const dur = open ? 0.35 : 0.06;
    if (!this.noiseBuffer) return;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(7500, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, gainVal * (open ? 0.5 : 0.35)), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getMasterBus(ctx));

    noise.start(time);
    noise.stop(time + dur + 0.01);
  }

  private playClap(ctx: AudioContext, time: number, gainVal: number): void {
    if (!this.noiseBuffer) return;
    const offsets = [0, 0.012, 0.024];
    for (const offset of offsets) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1200, time + offset);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0.0001, gainVal * 0.5), time + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + offset + 0.04);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.getMasterBus(ctx));

      noise.start(time + offset);
      noise.stop(time + offset + 0.05);
    }

    // Tail
    const tailNoise = ctx.createBufferSource();
    tailNoise.buffer = this.noiseBuffer;
    const tailFilter = ctx.createBiquadFilter();
    tailFilter.type = "bandpass";
    tailFilter.frequency.setValueAtTime(1000, time + 0.03);
    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(Math.max(0.0001, gainVal * 0.6), time + 0.03);
    tailGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

    tailNoise.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(this.getMasterBus(ctx));

    tailNoise.start(time + 0.03);
    tailNoise.stop(time + 0.23);
  }

  private playRimshot(ctx: AudioContext, time: number, gainVal: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1600, time);
    osc.frequency.exponentialRampToValueAtTime(400, time + 0.03);

    gain.gain.setValueAtTime(Math.max(0.0001, gainVal * 0.6), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);

    osc.connect(gain);
    gain.connect(this.getMasterBus(ctx));

    osc.start(time);
    osc.stop(time + 0.05);
  }

  private playCowbell(ctx: AudioContext, time: number, gainVal: number): void {
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

    gain.gain.setValueAtTime(Math.max(0.0001, gainVal * 0.5), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.getMasterBus(ctx));

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
    val: any
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Sound type & instrument shaping
    const sType = String(val.s || "sawtooth").toLowerCase();
    let defaultCutoff = 4000;
    let attack = typeof val.attack === "number" ? Math.max(0.005, Math.min(1.0, val.attack)) : 0.01;
    let decay = typeof val.decay === "number" ? Math.max(0.01, Math.min(2.0, val.decay)) : 0.15;
    let sustain = typeof val.sustain === "number" ? Math.max(0.0, Math.min(1.0, val.sustain)) : 0.5;
    let release = typeof val.release === "number" ? Math.max(0.01, Math.min(2.0, val.release)) : 0.2;

    if (["sine", "square", "sawtooth", "triangle"].includes(sType)) {
      osc.type = sType as OscillatorType;
    } else if (sType.includes("piano") || sType.includes("epiano") || sType.includes("rhodes") || sType.includes("keys")) {
      osc.type = "sine";
      attack = 0.005;
      decay = 0.4;
      sustain = 0.2;
      defaultCutoff = 6000;
    } else if (sType.includes("bass")) {
      osc.type = "triangle";
      defaultCutoff = 900;
    } else if (sType.includes("violin") || sType.includes("strings") || sType.includes("pad")) {
      osc.type = "sawtooth";
      attack = 0.05;
      sustain = 0.7;
      release = 0.4;
      defaultCutoff = 2500;
    } else {
      osc.type = "sawtooth";
    }

    osc.frequency.setValueAtTime(freq, time);

    // Filter
    const rawCutoff = typeof val.cutoff === "number" ? val.cutoff : (typeof val.lpf === "number" ? val.lpf : defaultCutoff);
    const cutoff = Math.max(40, Math.min(18000, rawCutoff));
    const rawRes = typeof val.resonance === "number" ? val.resonance : (typeof val.lpq === "number" ? val.lpq : 1);
    const resonance = Math.max(0.1, Math.min(15, rawRes));

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.setValueAtTime(resonance, time);

    const noteDuration = typeof val.duration === "number" ? Math.max(0.05, Math.min(5.0, val.duration)) : 0.3;

    // Guaranteed strictly monotonic timeline:
    // t0 (start) < t1 (attack peak) < t2 (decay end) <= t3 (note end / sustain hold) < t4 (release end)
    const baseGain = Math.max(0.0001, gainVal);
    const susGain = Math.max(0.0001, baseGain * sustain);

    const t0 = time;
    const t1 = t0 + attack;
    const t2 = t1 + decay;
    const t3 = Math.max(t2, t0 + noteDuration);
    const t4 = t3 + release;

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(baseGain, t1);
    gain.gain.exponentialRampToValueAtTime(susGain, t2);
    if (t3 > t2) {
      gain.gain.setValueAtTime(susGain, t3);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, t4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.getMasterBus(ctx));

    osc.start(t0);
    osc.stop(t4 + 0.02);
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
