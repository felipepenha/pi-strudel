declare module "@strudel/core" {
  export const noteToMidi: (note: string | number) => number;
  export const midiToFreq: (midi: number) => number;
  export const stack: (...patterns: any[]) => any;
  export const s: (source: any) => any;
  export const note: (source: any) => any;
  export const silence: any;
  const all: Record<string, any>;
  export default all;
}

declare module "@strudel/mini" {
  export const mini: (code: string, offset?: number) => any;
  export const m: (code: string, offset?: number) => any;
  const all: Record<string, any>;
  export default all;
}

declare module "@strudel/transpiler" {
  export interface TranspileOptions {
    wrapAsync?: boolean;
    addReturn?: boolean;
    emitMiniLocations?: boolean;
    emitWidgets?: boolean;
    id?: string;
  }
  export interface TranspileResult {
    output: string;
    miniLocations?: Array<{ start: number; end: number }>;
    widgets?: any[];
  }
  export const transpiler: (code: string, options?: TranspileOptions) => TranspileResult;
  export const evaluate: (code: string, scope?: any) => Promise<any>;
}

declare module "@strudel/tonal" {
  export const scale: (name: string) => any;
  export const voicings: (name: string) => any;
  export const rootNotes: (octave?: number) => any;
  const all: Record<string, any>;
  export default all;
}

declare module "@strudel/xen" {
  export const edo: (steps: number) => any;
  const all: Record<string, any>;
  export default all;
}

declare module "@strudel/osc" {
  export const osc: (options?: any) => any;
}

declare module "node-web-audio-api" {
  export class AudioContext {
    currentTime: number;
    sampleRate: number;
    state: "suspended" | "running" | "closed";
    destination: any;
    createOscillator(): any;
    createGain(): any;
    createBiquadFilter(): any;
    createBuffer(channels: number, length: number, sampleRate: number): any;
    createBufferSource(): any;
    resume(): Promise<void>;
    close(): Promise<void>;
  }
}
