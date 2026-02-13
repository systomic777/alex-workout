import { Exercise } from '../types';

const DB_NAME = 'voicecoach_guidance_db';
const STORE = 'audio';
const DB_VER = 1;

type StoredAudio = {
  key: string;
  mime: string;
  data: Blob;
  createdAt: number;
};


let ACTIVE_AUDIO: HTMLAudioElement | null = null;
function stopActiveAudio() {
  if (!ACTIVE_AUDIO) return;
  const a = ACTIVE_AUDIO;
  try {
    const startVol = a.volume ?? 1;
    const steps = 6;
    let i = 0;
    const iv = setInterval(() => {
      i++;
      try {
        a.volume = Math.max(0, startVol * (1 - i / steps));
      } catch {}
      if (i >= steps) {
        clearInterval(iv);
        try { a.pause(); } catch {}
        try { a.currentTime = 0; } catch {}
        try { a.volume = startVol; } catch {}
      }
    }, 20);
  } catch {
    try { a.pause(); } catch {}
    try { a.currentTime = 0; } catch {}
  }
}
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function dbPut(value: StoredAudio) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(value);
  });
  db.close();
}


async function dbKeys(): Promise<string[]> {
  const db = await openDb();
  const keys = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = () => resolve((req.result as any[]).map(String));
    req.onerror = () => reject(req.error);
  });
  db.close();
  return keys;
}

async function dbGet(key: string): Promise<StoredAudio | null> {
  const db = await openDb();
  const result = await new Promise<StoredAudio | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as StoredAudio) || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return result;
}

async function sha256(input: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function guidanceKey(exercises: Exercise[], extra: any, kind: string, id: string) {
  const payload = JSON.stringify({ v: 3, kind, id, exercises, extra });
  return `guidance:${kind}:${id}:${await sha256(payload)}`;
}

export type GuidanceKind = 'core' | 'exercise_announce' | 'motivation';

const MOTIVATION = [
  "You’re not here to be average. Keep moving.",
  "Breathe. Reset. Next set is yours.",
  "Strong work. Stay sharp and controlled.",
  "This is where you level up. Hold your form.",
  "Good. Now do it again—clean and confident.",
  "You’ve got more in you. Let’s go."
];

function pickMotivation(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return MOTIVATION[h % MOTIVATION.length];
}

function normalizeForSpeech(raw: string) {
  let s = (raw ?? '').toString();
  // Remove weird punctuation that causes spelling/garbling
  s = s.replace(/[\[\]{}()<>|*_~`^]/g, ' ');
  s = s.replace(/[-_]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  // Common fitness abbreviations (extend as needed)
  s = s.replace(/\bDB\b/gi, 'dumbbell');
  s = s.replace(/\bKB\b/gi, 'kettlebell');
  s = s.replace(/\bRDL\b/gi, 'Romanian deadlift');
  s = s.replace(/\bAMRAP\b/gi, 'as many reps as possible');

  return s;
}

// Exercise announce should NOT inject extra words (no 3-2-1-go, no "get ready").
export function buildExerciseAnnounceScript(ex: Exercise) {
  return normalizeForSpeech(ex.name);
}

// Motivation should NOT delay the start of the exercise. We'll play it during REST (cool) time.
export function buildMotivationScript(ex: Exercise) {
  return pickMotivation(ex.id + ex.name);
}

export function buildCoreScript(token: string) {
  if (token === 'prep_motivation') return "Lock in. You’ve got this.";
  if (token === 'prep_motivation_2') return "Breathe in. Focus. You’re ready.";
  if (token === 'cool_motivation') return "Recover strong. Next set, even better.";
  if (token === 'get_ready') return 'Get ready!';
  // Rotating short motivation lines (used to replace multiple seconds when time allows)
  if (token === 'mot_1') return "Breathe. Reset. You’re in control.";
  if (token === 'mot_2') return "Strong work. Keep going.";
  if (token === 'mot_3') return "You’ve got more. Stay with it.";
  if (token === 'mot_4') return "Discipline now. Results later.";
  if (token === 'mot_5') return "Good. Smooth and steady.";
  if (token === 'mot_6') return "Lock in. Next set is yours.";
  if (token === 'mot_7') return "Stay sharp. Stay clean.";
  if (token === 'mot_8') return "You’re building momentum.";
  if (token === 'mot_9') return "Control the pace. Own the rep.";
  if (token === 'mot_10') return "You’re doing the work. Respect.";
  // Start variants
  if (token === 'go_1') return 'Go!';
  if (token === 'go_2') return 'Start!';
  if (token === 'go_3') return 'Begin!';
  if (token === 'go_4') return 'Now!';
  if (token === 'go_5') return 'Take off!';
  // Back-compat
  if (token === 'go') return 'Go!';
  if (token === 'rest') return 'Rest.';
  if (token === 'workout_complete') return 'Workout complete. Great job.';
  if (token.startsWith('n:')) return token.slice(2);
  return token;
}

export async function ttsFromServer(text: string): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  const ct = res.headers.get('content-type') || '';

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`TTS failed (${res.status}): ${msg.slice(0, 400)}`);
  }

  if (!ct.toLowerCase().includes('audio')) {
    const msg = await res.text().catch(() => '');
    throw new Error(`TTS returned non-audio (${ct}): ${msg.slice(0, 400)}`);
  }

  return await res.blob();
}


export async function saveGuidance(key: string, blob: Blob) {
  await dbPut({ key, mime: blob.type || 'audio/mpeg', data: blob, createdAt: Date.now() });
}

export async function getGuidance(key: string) {
  const item = await dbGet(key);
  return item?.data || null;
}

export async function playBlob(blob: Blob): Promise<void> {
  stopActiveAudio();
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  ACTIVE_AUDIO = a;
  ACTIVE_AUDIO = a;
  a.preload = 'auto';
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    a.addEventListener('ended', done, { once: true });
    a.addEventListener('error', done, { once: true });
    a.play().catch(done);
  });
  if (ACTIVE_AUDIO === a) ACTIVE_AUDIO = null;
  if (ACTIVE_AUDIO === a) ACTIVE_AUDIO = null;
  URL.revokeObjectURL(url);
}

export async function playBlobFit(blob: Blob, targetSeconds: number, opts?: { maxRate?: number; minRate?: number; safety?: number }): Promise<void> {
  stopActiveAudio();
  const maxRate = opts?.maxRate ?? 1.35; // don't sound chipmunk
  const minRate = opts?.minRate ?? 1.0;
  const safety = opts?.safety ?? 0.85;   // finish before next boundary

  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  ACTIVE_AUDIO = a;
  a.preload = 'auto';

  // Wait for metadata so we know duration
  const duration = await new Promise<number>((resolve) => {
    const done = () => resolve(Number.isFinite(a.duration) ? a.duration : 0);
    a.addEventListener('loadedmetadata', done, { once: true });
    a.addEventListener('error', () => resolve(0), { once: true });
    // Safari sometimes never fires; fallback
    setTimeout(() => resolve(Number.isFinite(a.duration) ? a.duration : 0), 600);
  });

  if (duration > 0 && targetSeconds > 0) {
    const desired = (duration / (targetSeconds * safety));
    const rate = Math.min(maxRate, Math.max(minRate, desired));
    a.playbackRate = rate;
  }

  await new Promise<void>((resolve) => {
    const done = () => resolve();
    a.addEventListener('ended', done, { once: true });
    a.addEventListener('error', done, { once: true });
    a.play().catch(done);
  });

  if (ACTIVE_AUDIO === a) ACTIVE_AUDIO = null;
  if (ACTIVE_AUDIO === a) ACTIVE_AUDIO = null;
  URL.revokeObjectURL(url);
}

export async function getOrGenerateCore(exercises: Exercise[], token: string) {
  const key = await guidanceKey(exercises, { token }, 'core', token);
  const existing = await getGuidance(key);
  if (existing) return existing;
  const text = buildCoreScript(token);
  const blob = await ttsFromServer(text);
  await saveGuidance(key, blob);
  return blob;
}

export async function getOrGenerateExerciseAnnounce(exercises: Exercise[], ex: Exercise) {
  const key = await guidanceKey(exercises, {}, 'exercise_announce', ex.id);
  const existing = await getGuidance(key);
  if (existing) return existing;
  const script = buildExerciseAnnounceScript(ex);
  const blob = await ttsFromServer(script);
  await saveGuidance(key, blob);
  return blob;
}

export async function getOrGenerateMotivation(exercises: Exercise[], ex: Exercise) {
  const key = await guidanceKey(exercises, {}, 'motivation', ex.id);
  const existing = await getGuidance(key);
  if (existing) return existing;
  const script = buildMotivationScript(ex);
  const blob = await ttsFromServer(script);
  await saveGuidance(key, blob);
  return blob;
}


export async function getCacheStatus(exercises: Exercise[]) {
  const existing = new Set(await dbKeys());

  const expected: string[] = [];

  // Core tokens
  const coreTokens: string[] = [];
  for (let n = 1; n <= 180; n++) coreTokens.push(`n:${n}`);
  coreTokens.push('get_ready', 'rest', 'workout_complete', 'prep_motivation', 'prep_motivation_2', 'cool_motivation');
  coreTokens.push('go_1', 'go_2', 'go_3', 'go_4', 'go_5');
  for (let i = 1; i <= 10; i++) coreTokens.push(`mot_${i}`);

  for (const t of coreTokens) {
    expected.push(await guidanceKey(exercises, { token: t }, 'core', t));
  }

  // Per-exercise announce + (sprinkled) per-exercise motivation
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    expected.push(await guidanceKey(exercises, {}, 'exercise_announce', ex.id));
    // We only generate motivation for ~every 4th exercise (matches Settings → Generate).
    if (i % 4 === 0) {
      expected.push(await guidanceKey(exercises, {}, 'motivation', ex.id));
    }
  }

  let cached = 0;
  for (const k of expected) if (existing.has(k)) cached++;
  const total = expected.length;
  return { cached, total, missing: Math.max(0, total - cached) };
}
