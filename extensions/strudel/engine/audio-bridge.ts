import { AudioContext } from "node-web-audio-api";
import { noteToMidi, midiToFreq } from "@strudel/core";
import type { AudioMode } from "./state-store.js";
import { WebSocketServer, WebSocket } from "ws";
import dgram from "node:dgram";

export class AudioBridge {
  private mode: AudioMode = "node";
  private audioCtx: AudioContext | null = null;
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
        this.createNoiseBuffer();
      } catch (err) {
        // If system audio is unavailable in headless environment
        this.audioCtx = null;
      }
    }
    return this.audioCtx;
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

  dispatchHaps(haps: any[], _timeSec: number): void {
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

    for (const hap of haps) {
      try {
        this.playHapNodeAudio(ctx, hap);
      } catch (e) {
        // Voice failure should not crash scheduler
      }
    }
  }

  private playHapNodeAudio(ctx: AudioContext, hap: any): void {
    const val = hap.value || {};
    const now = ctx.currentTime;
    const gainVal = typeof val.gain === "number" ? Math.max(0, Math.min(val.gain, 2)) : 0.4;
    const sound = String(val.s || val.sound || "").toLowerCase();

    // Check synthesized drum sound
    if (sound === "bd") {
      this.playKick(ctx, now, gainVal, val);
      return;
    }
    if (sound === "sd") {
      this.playSnare(ctx, now, gainVal, val);
      return;
    }
    if (sound === "hh") {
      this.playHiHat(ctx, now, gainVal, false);
      return;
    }
    if (sound === "oh") {
      this.playHiHat(ctx, now, gainVal, true);
      return;
    }
    if (sound === "cp") {
      this.playClap(ctx, now, gainVal);
      return;
    }
    if (sound === "rim") {
      this.playRimshot(ctx, now, gainVal);
      return;
    }
    if (sound === "cb") {
      this.playCowbell(ctx, now, gainVal);
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
      freq = midiToFreq(midi);
    }

    if (freq > 0) {
      this.playSynthNote(ctx, now, freq, gainVal, val);
    }
  }

  private playKick(ctx: AudioContext, time: number, gainVal: number, val: any): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const startFreq = typeof val.penv === "number" ? 150 * Math.pow(2, val.penv / 12) : 150;
    const endFreq = 42;
    const decay = typeof val.pdecay === "number" ? val.pdecay : 0.08;
    const dur = typeof val.decay === "number" ? val.decay : 0.28;

    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + decay);

    gain.gain.setValueAtTime(gainVal, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + dur);
  }

  private playSnare(ctx: AudioContext, time: number, gainVal: number, _val: any): void {
    const dur = 0.2;

    // Body tone
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.1);
    oscGain.gain.setValueAtTime(gainVal * 0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.12);

    // Noise snap
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(1000, time);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(gainVal * 0.8, time);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(time);
      noise.stop(time + dur);
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
    gain.gain.setValueAtTime(gainVal * (open ? 0.6 : 0.4), time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(time);
    noise.stop(time + dur);
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
      gain.gain.setValueAtTime(gainVal * 0.6, time + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.04);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(time + offset);
      noise.stop(time + offset + 0.04);
    }

    // Tail
    const tailNoise = ctx.createBufferSource();
    tailNoise.buffer = this.noiseBuffer;
    const tailFilter = ctx.createBiquadFilter();
    tailFilter.type = "bandpass";
    tailFilter.frequency.setValueAtTime(1000, time + 0.03);
    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(gainVal * 0.7, time + 0.03);
    tailGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

    tailNoise.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(ctx.destination);

    tailNoise.start(time + 0.03);
    tailNoise.stop(time + 0.22);
  }

  private playRimshot(ctx: AudioContext, time: number, gainVal: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(1600, time);
    osc.frequency.exponentialRampToValueAtTime(400, time + 0.03);

    gain.gain.setValueAtTime(gainVal * 0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.04);
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

    gain.gain.setValueAtTime(gainVal * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + dur);
    osc2.stop(time + dur);
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
    let attack = typeof val.attack === "number" ? val.attack : 0.01;
    let decay = typeof val.decay === "number" ? val.decay : 0.15;
    let sustain = typeof val.sustain === "number" ? val.sustain : 0.5;
    let release = typeof val.release === "number" ? val.release : 0.2;

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
    const cutoff = typeof val.cutoff === "number" ? val.cutoff : (typeof val.lpf === "number" ? val.lpf : defaultCutoff);
    const resonance = typeof val.resonance === "number" ? val.resonance : (typeof val.lpq === "number" ? val.lpq : 1);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, time);
    filter.Q.setValueAtTime(resonance, time);

    const noteDuration = typeof val.duration === "number" ? val.duration : 0.3;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(gainVal, time + attack);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainVal * sustain), time + attack + decay);
    gain.gain.setValueAtTime(Math.max(0.0001, gainVal * sustain), time + noteDuration);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + noteDuration + release);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + noteDuration + release + 0.01);
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
