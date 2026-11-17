import { SaveSystem } from '@/systems/SaveSystem';

/**
 * SpeechSystem — reads dialogue lines aloud with the browser's built-in
 * Web Speech API (feat/tts-dialogues). No network service, no API key.
 *
 * Off by default (V toggles, persisted in the save). Silent when the game is
 * muted (M) or when the browser has no speech synthesis. Prefers a French
 * voice; falls back to the browser default with lang fr-FR.
 */
export class SpeechSystem {
  private static instance: SpeechSystem | null = null;
  private voice: SpeechSynthesisVoice | null = null;

  static getInstance(): SpeechSystem {
    if (!SpeechSystem.instance) SpeechSystem.instance = new SpeechSystem();
    return SpeechSystem.instance;
  }

  private constructor() {
    if (!SpeechSystem.isSupported()) return;
    const pick = (): void => {
      const voices = window.speechSynthesis.getVoices();
      this.voice = voices.find((v) => v.lang === 'fr-FR')
        ?? voices.find((v) => v.lang.startsWith('fr'))
        ?? null;
    };
    pick();
    // Voices load asynchronously in Chrome
    window.speechSynthesis.addEventListener?.('voiceschanged', pick);
  }

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  isEnabled(): boolean {
    return SaveSystem.getInstance().getTtsEnabled();
  }

  /** Toggle reading and persist. Returns the new state. */
  toggle(): boolean {
    const on = SaveSystem.getInstance().toggleTts();
    if (!on) this.stop();
    return on;
  }

  /**
   * Read a line, interrupting the previous one.
   * @param text - Player-facing text (already personalized)
   */
  speak(text: string): void {
    if (!SpeechSystem.isSupported() || !this.isEnabled() || SaveSystem.getInstance().getMuted()) return;
    const clean = SpeechSystem.clean(text);
    if (!clean) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'fr-FR';
    if (this.voice) u.voice = this.voice;
    u.rate = 1.05;
    u.volume = SaveSystem.getInstance().getMasterVolume();
    window.speechSynthesis.speak(u);
  }

  /** Stop any reading in progress. */
  stop(): void {
    if (SpeechSystem.isSupported()) window.speechSynthesis.cancel();
  }

  /**
   * Remove what should not be read: key hints like "[E]", emojis and
   * pictograms, inclusive middle dots ("épuisé·e" → "épuisé e" reads badly,
   * so the dot and the ending are read as the base word), extra spaces.
   */
  static clean(text: string): string {
    return text
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/[\p{Extended_Pictographic}☀-➿]/gu, ' ')
      .replace(/·[a-zà-ÿ]+/g, '')
      .replace(/[«»]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
