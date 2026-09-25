/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Authentic Craft Sound Engine (Web Audio API Synthesizer)
 * Provides real-time physical acoustic feedback without external audio files.
 * - Paper rustle & scissor cutting (新增剪纸切片、下刀)
 * - Whoosh discard sweep ("xiu的一声" 丢弃、删除)
 * - Wooden craft clicks (锚点吸附、节点操作)
 */

let audioCtx: AudioContext | null = null;
let soundMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function isSoundMuted(): boolean {
  return soundMuted;
}

export function setSoundMuted(muted: boolean): void {
  soundMuted = muted;
}

export function toggleSound(): boolean {
  soundMuted = !soundMuted;
  return soundMuted;
}

/**
 * 悉悉索索的剪纸声 (Crisp folk paper scissor snip & paper sheet rustle)
 * Simulates scissors shearing through Xuan paper with white noise burst and resonant filtering.
 */
export function playPaperRustle(): void {
  if (soundMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // 1. Noise buffer for paper fiber friction
    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    // Filter to simulate paper shearing frequency response
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.12);
    filter.Q.setValueAtTime(3.5, now);

    // Gain envelope: crisp attack, rapid decay with gentle rustle tail
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.22, now + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

    whiteNoise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    whiteNoise.start(now);
    whiteNoise.stop(now + 0.14);

    // 2. Secondary soft metal scissor click
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.04);

    oscGain.gain.setValueAtTime(0.08, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  } catch {
    // AudioContext blocked or not allowed yet
  }
}

/**
 * 丢弃操作 xiu 的一声 (Dynamic whoosh / pitch-drop sweep)
 */
export function playDiscardSwoosh(): void {
  if (soundMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Sine/saw pitch-drop frequency sweep (880Hz down to 180Hz)
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.18);

    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);

    // Subtle whoosh noise air movement
    const bufferSize = Math.floor(ctx.sampleRate * 0.16);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.16);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.17);
  } catch {
    // Graceful fallback
  }
}

/**
 * 清脆木榫/锚点操作声 (Crisp click for adding polyline point, anchor selection)
 */
export function playCrispClick(): void {
  if (soundMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.035);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);
  } catch {}
}
