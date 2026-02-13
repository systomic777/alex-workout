/*
  Free “advanced” voice strategy:
  - Prefer cloud TTS from StreamElements (no key) which sounds more natural than many browser voices.
  - Cache audio in-memory to avoid re-fetching the same phrases.
  - Fall back to browser SpeechSynthesis if offline / rate-limited.

  Notes:
  - This still depends on a third-party free endpoint. If it ever changes, browser TTS fallback keeps the app working.
  - Call warmup() from a user gesture to unlock audio on iOS.
*/

type CloudVoice = 'Matthew' | 'Brian' | 'Salli' | 'Emma';

export class VoiceAssistant {
  private synth: SpeechSynthesis;
  private nativeVoice: SpeechSynthesisVoice | null = null;
  private isIOS: boolean;
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  private audioCtx: AudioContext | null = null;
  private audioCache = new Map<string, HTMLAudioElement>();

  // Pick a default that tends to sound “coach-like”
  private cloudVoice: CloudVoice = 'Matthew';
  private preferCloud = true;

  // Diagnostics (helps debug when iOS blocks cloud audio)
  private lastEngine: 'cloud' | 'native' | 'none' = 'none';
  private lastCloudError: string | null = null;

  // Optional: force a specific native voice name (persisted by UI)
  private preferredNativeVoiceName: string | null = null;

  constructor() {
    this.synth = window.speechSynthesis;
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    // Load persisted preferences (best-effort)
    try {
      const raw = localStorage.getItem('voicecoach_tts_prefs');
      if (raw) {
        const prefs = JSON.parse(raw);
        if (typeof prefs?.preferCloud === 'boolean') this.preferCloud = prefs.preferCloud;
        if (typeof prefs?.cloudVoice === 'string') this.cloudVoice = prefs.cloudVoice;
        if (typeof prefs?.nativeVoiceName === 'string') this.preferredNativeVoiceName = prefs.nativeVoiceName;
      }
    } catch {
      // ignore
    }

    // iOS reality: cloud audio is often blocked or unreliable; default to best native voice.
    if (this.isIOS) this.preferCloud = false;

    this.initNativeVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = this.initNativeVoice.bind(this);
    }
  }

  setVoice(options: { preferCloud?: boolean; cloudVoice?: CloudVoice; nativeVoiceName?: string | null } = {}) {
    if (typeof options.preferCloud === 'boolean') this.preferCloud = options.preferCloud;
    if (options.cloudVoice) this.cloudVoice = options.cloudVoice;
    if (options.nativeVoiceName !== undefined) this.preferredNativeVoiceName = options.nativeVoiceName;

    // Re-select native voice if needed
    this.initNativeVoice();

    // Persist
    try {
      localStorage.setItem('voicecoach_tts_prefs', JSON.stringify({
        preferCloud: this.preferCloud,
        cloudVoice: this.cloudVoice,
        nativeVoiceName: this.preferredNativeVoiceName,
      }));
    } catch {
      // ignore
    }
  }

  getVoice() {
    return {
      preferCloud: this.preferCloud,
      cloudVoice: this.cloudVoice,
      nativeVoiceName: this.nativeVoice?.name ?? null,
      lastEngine: this.lastEngine,
      lastCloudError: this.lastCloudError,
      isIOS: this.isIOS,
    };
  }

  listNativeVoices() {
    const voices = this.synth.getVoices();
    return voices
      .filter(v => (v.lang || '').toLowerCase().startsWith('en'))
      .map(v => ({ name: v.name, lang: v.lang }));
  }

  private initNativeVoice() {
    const voices = this.synth.getVoices();
    if (voices.length === 0) return;

    // If user picked a voice explicitly, honor it
    if (this.preferredNativeVoiceName) {
      const exact = voices.find(v => v.name === this.preferredNativeVoiceName);
      if (exact) {
        this.nativeVoice = exact;
        return;
      }
    }

    // iOS: prefer high-quality Siri voices (often labelled "Siri" / "Eddy" etc depending on iOS)
    // Otherwise: pick the best English voice available.
    const english = voices.filter(v => (v.lang || '').toLowerCase().startsWith('en'));

    this.nativeVoice =
      english.find((v) => /siri/i.test(v.name)) ||
      english.find((v) => /premium|enhanced/i.test(v.name)) ||
      english.find((v) => /Samantha/i.test(v.name)) ||
      english.find((v) => /Google US English/i.test(v.name)) ||
      english.find((v) => /Google UK English/i.test(v.name)) ||
      english.find((v) => (v.lang || '').toLowerCase().startsWith('en-us')) ||
      english[0] ||
      voices[0];
  }

  /**
   * Unlocks audio on mobile browsers. Should be called during a user interaction.
   */
  async warmup() {
    // IMPORTANT: to "unlock" audio on iOS/Safari, a real `audio.play()` MUST happen
    // synchronously off a user gesture. So: do the play FIRST (no awaits before it).

    // SpeechSynthesis warmup
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      this.synth.speak(u);
    } catch {
      // ignore
    }

    // Cloud-audio unlock (best-effort, gesture-safe)
    try {
      const warmText = '.';
      const a = new Audio();
      a.src = this.buildStreamElementsUrl(warmText);
      a.preload = 'auto';
      a.crossOrigin = 'anonymous';
      a.volume = 0;
      // Fire and forget; do not await before play.
      const p = a.play();
      if (p && typeof (p as any).then === 'function') {
        p.then(() => {
          setTimeout(() => {
            try {
              a.pause();
              a.currentTime = 0;
            } catch {
              // ignore
            }
          }, 120);
        }).catch(() => {
          // ignore
        });
      }

      // Also keep a cached version around for later
      this.audioCache.set(this.cacheKey(warmText), a);
    } catch {
      // ignore
    }

    // WebAudio warmup
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      try {
        if (!this.audioCtx) this.audioCtx = new AudioContextClass();
        if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
      } catch {
        // ignore
      }
    }
  }

  cancel() {
    this.synth.cancel();
    this.activeUtterance = null;

    // Stop any cached audio currently playing
    for (const a of this.audioCache.values()) {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }

  /**
   * Speaks text. If force=true, cancels any ongoing speech/audio.
   */
  async speak(text: string, force: boolean = false): Promise<void> {
    const cleaned = (text ?? '').toString().trim();
    if (!cleaned) return;

    if (force) {
      this.cancel();
      // Small delay allows the browser to clear the speech queue before the next command
      await new Promise((r) => setTimeout(r, 10));
    }

    if (this.preferCloud) {
      const ok = await this.tryCloudSpeak(cleaned);
      if (ok) {
        this.lastEngine = 'cloud';
        return;
      }
    }

    // Fallback
    this.lastEngine = 'native';
    await this.nativeSpeak(cleaned);
  }

  private async nativeSpeak(text: string): Promise<void> {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);

      if (!this.nativeVoice) this.initNativeVoice();
      if (this.nativeVoice) utterance.voice = this.nativeVoice;

      // A little more “coach-y” cadence
      utterance.rate = this.isIOS ? 0.95 : 1.05;
      utterance.pitch = 1.02;
      utterance.volume = 1.0;

      utterance.onend = () => {
        this.activeUtterance = null;
        resolve();
      };
      utterance.onerror = () => {
        this.activeUtterance = null;
        resolve();
      };

      this.activeUtterance = utterance;
      this.synth.speak(utterance);
    });
  }

  private cacheKey(text: string) {
    return `${this.cloudVoice}::${text}`;
  }

  private async preload(text: string) {
    const key = this.cacheKey(text);
    if (this.audioCache.has(key)) return;

    const url = this.buildStreamElementsUrl(text);
    const audio = new Audio();
    audio.src = url;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    this.audioCache.set(key, audio);

    // best-effort load
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      audio.addEventListener('canplaythrough', done, { once: true });
      audio.addEventListener('error', done, { once: true });
      // Safari sometimes never fires; resolve anyway
      setTimeout(done, 800);
      audio.load();
    });
  }

  private buildStreamElementsUrl(text: string) {
    // StreamElements Kappa TTS: no API key.
    // Example: https://api.streamelements.com/kappa/v2/speech?voice=Matthew&text=Hello
    const base = 'https://api.streamelements.com/kappa/v2/speech';
    const params = new URLSearchParams({
      voice: this.cloudVoice,
      text,
    });
    return `${base}?${params.toString()}`;
  }

  private async tryCloudSpeak(text: string): Promise<boolean> {
    try {
      this.lastCloudError = null;

      // Avoid very long strings (keeps latency low + avoids endpoint limits)
      const safe = text.length > 220 ? `${text.slice(0, 217)}...` : text;

      await this.preload(safe);
      const key = this.cacheKey(safe);
      const audio = this.audioCache.get(key);
      if (!audio) {
        this.lastCloudError = 'cache_miss';
        return false;
      }

      // If another clip is playing, stop it
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {
        // ignore
      }

      await audio.play();

      await new Promise<void>((resolve) => {
        const done = () => resolve();
        audio.addEventListener('ended', done, { once: true });
        audio.addEventListener('error', () => {
          this.lastCloudError = 'audio_error';
          resolve();
        }, { once: true });
      });

      // If we got here without setting an error, assume success.
      return this.lastCloudError === null;
    } catch (e: any) {
      this.lastCloudError = (e && (e.message || String(e))) || 'play_failed';
      return false;
    }
  }
}

export const tts = new VoiceAssistant();
