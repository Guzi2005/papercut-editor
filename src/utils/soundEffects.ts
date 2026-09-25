/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Material sounds in the manner of Sketches: quiet, tactile and built from filtered noise rather
 * than tones, so they read as paper, graphite and steel instead of UI beeps. Drawing tools get a
 * continuous friction voice whose loudness follows stroke speed; everything else is a short cue.
 */

const MUTE_KEY = 'weave.soundMuted';

let audioCtx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let soundMuted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx = new AudioCtx();
    master = audioCtx.createGain();
    master.gain.value = 0.9;
    master.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** Two seconds of pink-ish noise, shared by every voice (Paul Kellet's filter). */
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = ctx.sampleRate * 2;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const out = noiseBuf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return noiseBuf;
}

export function isSoundMuted(): boolean {
  return soundMuted;
}

export function setSoundMuted(muted: boolean): void {
  soundMuted = muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
  if (muted) strokeEnd();
}

export function toggleSound(): boolean {
  setSoundMuted(!soundMuted);
  return soundMuted;
}

interface Burst {
  type: BiquadFilterType;
  freq: number;
  /** Frequency the filter glides to over the burst. */
  toFreq?: number;
  q?: number;
  gain: number;
  attack?: number;
  dur: number;
  delay?: number;
}

/** A single enveloped, filtered noise grain. */
function burst(ctx: AudioContext, b: Burst): void {
  const t = ctx.currentTime + (b.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = b.type;
  f.frequency.setValueAtTime(b.freq, t);
  if (b.toFreq) f.frequency.exponentialRampToValueAtTime(b.toFreq, t + b.dur);
  f.Q.value = b.q ?? 1;
  const g = ctx.createGain();
  const a = b.attack ?? 0.004;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(b.gain, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + b.dur);
  src.connect(f).connect(g).connect(master!);
  src.start(t, Math.random() * 1.5);
  src.stop(t + a + b.dur + 0.02);
}

/** A soft low body under a transient, the "weight" of a finger or a sheet landing. */
function thud(ctx: AudioContext, freq: number, gain: number, dur: number, delay = 0): void {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function play(fn: (ctx: AudioContext) => void): void {
  if (soundMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    fn(ctx);
  } catch {
    /* AudioContext not allowed yet */
  }
}

/** A cut is finished: the blades meet and the paper lets go. */
export function playPaperRustle(): void {
  play((ctx) => {
    burst(ctx, { type: 'bandpass', freq: 3400, q: 1.6, gain: 0.16, dur: 0.035 });
    burst(ctx, { type: 'bandpass', freq: 2600, toFreq: 1400, q: 1.2, gain: 0.07, dur: 0.09, delay: 0.03 });
  });
}

/** An appliqué is laid down: a sheet settling onto paper. */
export function playPaperPlace(): void {
  play((ctx) => {
    burst(ctx, { type: 'lowpass', freq: 1800, toFreq: 500, q: 0.7, gain: 0.12, attack: 0.012, dur: 0.11 });
    thud(ctx, 150, 0.05, 0.07);
  });
}

/** Something is thrown away: a sheet swept off the desk with a little crinkle. */
export function playDiscardSwoosh(): void {
  play((ctx) => {
    burst(ctx, { type: 'bandpass', freq: 2400, toFreq: 420, q: 0.8, gain: 0.1, attack: 0.03, dur: 0.22 });
    for (let i = 0; i < 4; i++) {
      burst(ctx, { type: 'bandpass', freq: 2500 + Math.random() * 2500, q: 3, gain: 0.03 + Math.random() * 0.03, dur: 0.012, delay: 0.02 + i * 0.035 + Math.random() * 0.02 });
    }
  });
}

/** Small UI acknowledgement: a fingertip tap on card. */
export function playCrispClick(): void {
  play((ctx) => {
    burst(ctx, { type: 'bandpass', freq: 2100, q: 1.4, gain: 0.07, attack: 0.001, dur: 0.018 });
    thud(ctx, 210, 0.035, 0.03);
  });
}

/** Picking up a different tool from the tray: a light wooden knock. */
export function playToolPick(): void {
  play((ctx) => {
    burst(ctx, { type: 'bandpass', freq: 1300, q: 2.2, gain: 0.06, attack: 0.001, dur: 0.025 });
    thud(ctx, 320, 0.03, 0.04);
  });
}

/** Undo / redo: a quick brush of the page, rising for redo and falling for undo. */
export function playHistory(redo = false): void {
  play((ctx) => {
    burst(ctx, redo
      ? { type: 'bandpass', freq: 900, toFreq: 2600, q: 0.9, gain: 0.05, attack: 0.02, dur: 0.09 }
      : { type: 'bandpass', freq: 2600, toFreq: 900, q: 0.9, gain: 0.05, attack: 0.02, dur: 0.09 });
  });
}

// ---------- Continuous stroke voices ----------

export type StrokeSound = 'pencil' | 'pen' | 'airbrush' | 'brush' | 'knife' | 'scissors';

interface StrokeProfile {
  /** Filter chain applied to the noise bed. */
  filters: { type: BiquadFilterType; freq: number; q?: number }[];
  /** Loudness at full speed. */
  max: number;
  /** Loudness while the tool rests on the paper without moving. */
  idle?: number;
  /** Screen px per ms that counts as full speed. */
  fullSpeed: number;
  /** Filter brightens by this factor at full speed. */
  brighten?: number;
  /** Paper-fibre ticks every this many px travelled. */
  tickEvery?: number;
  tick?: Omit<Burst, 'delay'>;
}

const PROFILES: Record<StrokeSound, StrokeProfile> = {
  pencil: {
    filters: [{ type: 'highpass', freq: 900 }, { type: 'bandpass', freq: 3600, q: 0.8 }],
    max: 0.22,
    fullSpeed: 1.4,
    brighten: 1.35,
    tickEvery: 9,
    tick: { type: 'bandpass', freq: 4200, q: 4, gain: 0.018, attack: 0.001, dur: 0.006 },
  },
  pen: {
    filters: [{ type: 'bandpass', freq: 1500, q: 0.7 }, { type: 'lowpass', freq: 3800 }],
    max: 0.14,
    fullSpeed: 1.6,
    brighten: 1.25,
  },
  airbrush: {
    filters: [{ type: 'highpass', freq: 4200 }, { type: 'lowpass', freq: 11000 }],
    max: 0.07,
    idle: 0.045,
    fullSpeed: 2,
  },
  brush: {
    filters: [{ type: 'lowpass', freq: 1300 }, { type: 'bandpass', freq: 650, q: 0.5 }],
    max: 0.2,
    fullSpeed: 1.8,
    brighten: 1.5,
  },
  knife: {
    filters: [{ type: 'bandpass', freq: 2700, q: 1.8 }],
    max: 0.12,
    fullSpeed: 1.2,
    brighten: 1.2,
    tickEvery: 14,
    tick: { type: 'bandpass', freq: 3200, q: 5, gain: 0.03, attack: 0.001, dur: 0.008 },
  },
  scissors: {
    filters: [{ type: 'bandpass', freq: 2100, q: 1.2 }, { type: 'highpass', freq: 700 }],
    max: 0.1,
    fullSpeed: 1.4,
    brighten: 1.3,
    tickEvery: 26,
    tick: { type: 'bandpass', freq: 2800, q: 2.5, gain: 0.05, attack: 0.001, dur: 0.02 },
  },
};

interface StrokeVoice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  filters: BiquadFilterNode[];
  profile: StrokeProfile;
  x: number;
  y: number;
  t: number;
  speed: number;
  travelled: number;
}

let voice: StrokeVoice | null = null;

/** Tool touches the paper; `x, y` are screen pixels. */
export function strokeStart(kind: StrokeSound, x: number, y: number): void {
  strokeEnd();
  if (soundMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const profile = PROFILES[kind];
    const src = ctx.createBufferSource();
    src.buffer = noise(ctx);
    src.loop = true;
    const filters = profile.filters.map((spec) => {
      const f = ctx.createBiquadFilter();
      f.type = spec.type;
      f.frequency.value = spec.freq;
      f.Q.value = spec.q ?? 0.7;
      return f;
    });
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    let node: AudioNode = src;
    filters.forEach((f) => (node = node.connect(f)));
    node.connect(gain).connect(master!);
    src.start(0, Math.random() * 1.5);
    if (profile.idle) gain.gain.setTargetAtTime(profile.idle, ctx.currentTime, 0.02);
    voice = { src, gain, filters, profile, x, y, t: performance.now(), speed: 0, travelled: 0 };
  } catch {
    voice = null;
  }
}

/** Tool moves; loudness and brightness follow a smoothed speed. */
export function strokeMove(x: number, y: number): void {
  const v = voice;
  if (!v || !audioCtx) return;
  const now = performance.now();
  const dt = Math.max(1, now - v.t);
  const dist = Math.hypot(x - v.x, y - v.y);
  v.speed += (dist / dt - v.speed) * Math.min(1, dt / 45);
  v.x = x;
  v.y = y;
  v.t = now;
  const p = v.profile;
  const level = Math.pow(Math.min(1, v.speed / p.fullSpeed), 0.7);
  const at = audioCtx.currentTime;
  v.gain.gain.setTargetAtTime(Math.max(p.idle ?? 0.0001, p.max * level), at, 0.03);
  if (p.brighten) {
    v.filters.forEach((f, i) => f.frequency.setTargetAtTime(p.filters[i].freq * (1 + (p.brighten! - 1) * level), at, 0.05));
  }
  if (p.tickEvery && p.tick) {
    v.travelled += dist;
    while (v.travelled >= p.tickEvery) {
      v.travelled -= p.tickEvery * (0.7 + Math.random() * 0.6);
      burst(audioCtx, { ...p.tick, gain: p.tick.gain * (0.5 + level), freq: p.tick.freq * (0.85 + Math.random() * 0.3) });
    }
  }
}

/** Tool lifts off. */
export function strokeEnd(): void {
  const v = voice;
  voice = null;
  if (!v || !audioCtx) return;
  try {
    const at = audioCtx.currentTime;
    v.gain.gain.cancelScheduledValues(at);
    v.gain.gain.setTargetAtTime(0.0001, at, 0.025);
    v.src.stop(at + 0.15);
  } catch {
    /* already stopped */
  }
}
