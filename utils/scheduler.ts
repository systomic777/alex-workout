import { getOrGenerateCore } from './guidance';
import type { Exercise } from '../types';

let ctx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
let activeSources: AudioBufferSourceNode[] = [];
let activeGainNodes: GainNode[] = [];

function getCtx() {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) throw new Error('AudioContext not supported');
  if (!ctx) ctx = new AudioContextClass();
  return ctx;
}

export async function ensureAudioUnlocked() {
  const c = getCtx();
  if (c.state === 'suspended') {
    try { await c.resume(); } catch {}
  }
}

export function stopScheduledAudio(fadeMs: number = 120) {
  const c = ctx;
  const now = c ? c.currentTime : 0;

  // fade out gains
  for (const g of activeGainNodes) {
    try {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0.0001, now + fadeMs / 1000);
    } catch {}
  }

  // stop sources slightly after fade
  for (const s of activeSources) {
    try {
      s.stop(now + (fadeMs / 1000) + 0.02);
    } catch {}
  }

  activeSources = [];
  activeGainNodes = [];
}

async function blobToBuffer(blob: Blob): Promise<AudioBuffer> {
  const c = getCtx();
  const ab = await blob.arrayBuffer();
  return await c.decodeAudioData(ab.slice(0));
}

async function getBuffer(exercises: Exercise[], token: string): Promise<AudioBuffer> {
  const key = `core:${token}`;
  const cached = bufferCache.get(key);
  if (cached) return cached;

  const blob = await getOrGenerateCore(exercises, token);
  const buf = await blobToBuffer(blob);
  bufferCache.set(key, buf);
  return buf;
}

function scheduleBuffer(buf: AudioBuffer, when: number, playbackRate: number = 1.0, gain: number = 1.0) {
  const c = getCtx();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = playbackRate;

  const g = c.createGain();
  g.gain.value = gain;

  // Tiny fade in/out to prevent clicks
  const fade = 0.01;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(gain, when + fade);

  const dur = buf.duration / playbackRate;
  const end = when + Math.max(0.02, dur - fade);
  g.gain.setValueAtTime(gain, end);
  g.gain.exponentialRampToValueAtTime(0.0001, end + fade);

  src.connect(g);
  g.connect(c.destination);

  src.start(when);

  activeSources.push(src);
  activeGainNodes.push(g);
}

// Schedules rep counting as a single timed sequence (no overlap, stable timing)
export async function scheduleRepCount(exercises: Exercise[], totalReps: number, repDurationSec: number) {
  await ensureAudioUnlocked();
  stopScheduledAudio();

  const c = getCtx();
  const start = c.currentTime + 0.05;

  // Count reps remaining: N, N-1, ... 1
  for (let i = 0; i < totalReps; i++) {
    const repsRemaining = totalReps - i;
    const token = `n:${repsRemaining}`;
    const buf = await getBuffer(exercises, token);

    // Fit within rep duration (cap so it doesn't sound insane)
    const target = Math.max(0.45, repDurationSec * 0.92);
    const desired = buf.duration / (target * 0.90);
    const rate = Math.min(1.6, Math.max(0.95, desired));

    const when = start + (i * repDurationSec);
    scheduleBuffer(buf, when, rate, 1.0);
  }
}

export async function scheduleCountdown(exercises: Exercise[], seconds: number, phase: 'prep' | 'cool', seed: number) {
  await ensureAudioUnlocked();
  stopScheduledAudio();

  const c = getCtx();
  const start = c.currentTime + 0.05;

  const pickGo = () => `go_${((seed % 5) + 1)}`;
  const pickMot = (n: number) => `mot_${(((seed + n) % 10) + 1)}`;

  for (let t = seconds; t >= 1; t--) {
    const when = start + (seconds - t);

    // last seconds are always numbers/Go
    const critical = t <= 3;

    if (phase === 'prep' && t === 1) {
      const buf = await getBuffer(exercises, pickGo());
      const rate = Math.min(1.4, Math.max(0.95, buf.duration / (0.7 * 0.9)));
      scheduleBuffer(buf, when, rate, 1.0);
      continue;
    }

    // For long countdowns, alternate number/motivation on non-critical seconds
    if (!critical && seconds >= 6) {
      const sayNumber = (t % 2 === 0);
      const token = sayNumber ? `n:${t}` : pickMot(t);
      const buf = await getBuffer(exercises, token);
      const target = 0.95;
      const rate = Math.min(1.35, Math.max(0.95, buf.duration / (target * 0.9)));
      scheduleBuffer(buf, when, rate, 1.0);
      continue;
    }

    // default: number
    const buf = await getBuffer(exercises, `n:${t}`);
    const rate = Math.min(1.35, Math.max(0.95, buf.duration / (0.95 * 0.9)));
    scheduleBuffer(buf, when, rate, 1.0);
  }
}
