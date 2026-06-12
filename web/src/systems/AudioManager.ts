import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';
import { SaveSystem } from '@/systems/SaveSystem';
import { GameEvents } from '@/systems/GameEvents';
import type { AudioManifest } from '@/systems/ContentLoader';

/**
 * AudioManager — data-driven, event-wired audio system for Codyssey Web.
 *
 * Design goals (TASK-016):
 * - No hardcoded filenames: all sound keys and paths come from content/audio.json
 *   via ContentLoader.getAudioManifest(). The engine is fully decoupled from asset names.
 * - Graceful: if audio.json is missing, or a specific file fails to load, the
 *   manager logs once and continues — audio must never crash the game.
 * - Autoplay policy: ambient music starts only after the first user interaction
 *   (pointerdown or keydown). Phaser's sound.unlock() handles the AudioContext
 *   resume; we track whether the context is already unlocked to avoid duplicate starts.
 * - Volume + mute: persisted in SaveSystem (codyssee.save.v1). Restored on boot.
 * - Mute toggle: M key. A settings UI can expose a slider later (J3+).
 *
 * Lifecycle:
 *  1. PreloadScene calls AudioManager.getInstance().queuePreload(scene)
 *     → queues all audio files from the manifest into Phaser's loader.
 *  2. After PreloadScene finishes, AudioManager.getInstance().init(scene)
 *     → binds GameEvents and restores saved volume/mute.
 *  3. Any scene can call AudioManager.getInstance().startAmbient()
 *     → starts the looping ambient track. Safe to call before unlock; it will
 *     auto-start once the browser unlocks audio.
 *
 * Singleton: one instance per game session (matches SaveSystem pattern).
 */
export class AudioManager {
  private static instance: AudioManager | null = null;

  /** Phaser sound objects keyed by manifest key (e.g. 'sfx.interact'). */
  private sounds: Map<string, Phaser.Sound.BaseSound> = new Map();

  /** The ambient music track — kept separate for loop/volume control. */
  private ambientTrack: Phaser.Sound.BaseSound | null = null;

  /** Key of the ambient music entry in the manifest. */
  private static readonly AMBIENT_KEY = 'music.ambient';

  /**
   * Whether startAmbient() has been requested but the browser hasn't unlocked
   * audio yet. On unlock, the ambient track will auto-start.
   */
  private ambientPending = false;

  /** True once the Phaser scene reference is available for sound operations. */
  private initialized = false;

  /** Phaser scene reference — stored so we can manipulate the sound manager. */
  private scene: Phaser.Scene | null = null;

  /** Whether we have already logged a "no manifest" warning (log-once guard). */
  private noManifestWarned = false;

  private constructor() {}

  /** Singleton accessor. */
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  // ---------------------------------------------------------------------------
  // Phase 1 — Preload (called from PreloadScene.preload())
  // ---------------------------------------------------------------------------

  /**
   * Queues all audio files from content/audio.json into Phaser's loader.
   *
   * Must be called during PreloadScene.preload() — before the Phaser loader
   * starts, so all files are part of the same loading batch.
   *
   * Uses .ogg/.mp3 array format for automatic browser fallback:
   * Phaser tries the first format; if unsupported, falls back to the next.
   * This ensures Firefox (prefers OGG) and Safari/Edge (prefer MP3) both work.
   *
   * Graceful: if the manifest is null (audio.json missing) we log once and skip.
   *
   * @param scene - The PreloadScene instance (provides access to this.load)
   */
  queuePreload(scene: Phaser.Scene): void {
    const manifest = this._getManifest();
    if (!manifest) return; // warning already logged by _getManifest()

    const base = import.meta.env.BASE_URL;

    for (const [key, entry] of Object.entries(manifest)) {
      if (!Array.isArray(entry.files) || entry.files.length === 0) {
        console.warn(`AudioManager: manifest entry "${key}" has no files — skipping.`);
        continue;
      }

      // Build absolute URLs: manifest paths are relative to the web root
      // (e.g. "assets/audio/ambient.ogg") so we prepend BASE_URL.
      const urls = entry.files.map((f) => `${base}${f}`);

      try {
        // Phaser accepts an array of urls and picks the first it can decode.
        // This is the canonical OGG→MP3 fallback pattern for Phaser 3.
        scene.load.audio(key, urls);
      } catch (e) {
        // load.audio() is synchronous (just queues); catching defensively.
        console.warn(`AudioManager: failed to queue "${key}":`, e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 2 — Init (called from the first gameplay scene's create())
  // ---------------------------------------------------------------------------

  /**
   * Initializes the audio system: creates Phaser sound objects, restores saved
   * audio preferences, and wires up GameEvents → SFX.
   *
   * Safe to call even if queuePreload() was skipped (graceful no-op for missing sounds).
   * Should be called once after PreloadScene completes — e.g. from MainMenuScene.create().
   *
   * @param scene - Any active Phaser scene (for sound manager access)
   */
  init(scene: Phaser.Scene): void {
    if (this.initialized) return;
    this.initialized = true;
    this.scene = scene;

    const manifest = this._getManifest();
    if (!manifest) return;

    const save = SaveSystem.getInstance();

    // Create Phaser sound objects for every manifest key that was successfully loaded.
    for (const [key, entry] of Object.entries(manifest)) {
      if (!scene.sound.get(key) && !scene.cache.audio.exists(key)) {
        // Sound file failed to load (network error, missing file) — skip gracefully.
        console.warn(`AudioManager: audio "${key}" not in cache — skipping.`);
        continue;
      }

      const soundObj = scene.sound.add(key, {
        loop: entry.loop,
        volume: entry.volume,
      });

      this.sounds.set(key, soundObj);

      if (key === AudioManager.AMBIENT_KEY) {
        this.ambientTrack = soundObj;
      }
    }

    // Restore saved volume and mute state.
    this._applyVolume(save.getMasterVolume());
    if (save.getMuted()) {
      this._applyMute(true);
    }

    // Wire GameEvents to SFX.
    this._bindEvents(scene);

    // Handle browser autoplay policy: Phaser emits 'unlocked' on the sound manager
    // once the AudioContext is resumed after a user gesture.
    scene.sound.once('unlocked', () => {
      if (this.ambientPending) {
        this.ambientPending = false;
        this._playAmbient();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Ambient music
  // ---------------------------------------------------------------------------

  /**
   * Request ambient music to start looping.
   *
   * If the browser AudioContext is already unlocked (user has interacted), the
   * music starts immediately. Otherwise, we set ambientPending=true so the
   * 'unlocked' event handler in init() will start it once audio is allowed.
   *
   * Safe to call multiple times — does nothing if already playing.
   */
  startAmbient(): void {
    if (!this.ambientTrack) return;

    const track = this.ambientTrack as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;
    if (track.isPlaying) return; // already going

    // Check if the AudioContext is ready (state === 'running').
    // On Web Audio, context.state is 'suspended' before first user gesture.
    const soundManager = this.scene?.sound as Phaser.Sound.WebAudioSoundManager | undefined;
    const contextReady = !soundManager?.context || soundManager.context.state === 'running';

    if (contextReady) {
      this._playAmbient();
    } else {
      // Defer until Phaser's 'unlocked' event fires.
      this.ambientPending = true;
    }
  }

  /**
   * Stop the ambient track (e.g. when returning to main menu with no music).
   * Safe to call when not playing.
   */
  stopAmbient(): void {
    this.ambientPending = false;
    if (this.ambientTrack) {
      this.ambientTrack.stop();
    }
  }

  // ---------------------------------------------------------------------------
  // Volume & mute
  // ---------------------------------------------------------------------------

  /**
   * Set master volume and persist it.
   *
   * @param volume - Value in [0, 1]. Clamped automatically.
   */
  setMasterVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._applyVolume(clamped);
    SaveSystem.getInstance().saveMasterVolume(clamped);
  }

  /**
   * Toggle global mute on/off and persist the new state.
   *
   * @returns The new muted state.
   */
  toggleMute(): boolean {
    const save = SaveSystem.getInstance();
    const nowMuted = save.toggleMuted();
    this._applyMute(nowMuted);
    return nowMuted;
  }

  /** Returns true if audio is currently muted. */
  isMuted(): boolean {
    return SaveSystem.getInstance().getMuted();
  }

  // ---------------------------------------------------------------------------
  // SFX playback
  // ---------------------------------------------------------------------------

  /**
   * Play a sound by its manifest key (e.g. 'sfx.interact').
   *
   * Graceful: logs a warning and returns silently if the key is not found
   * (avoids crashes when audio files are missing in development).
   *
   * Dev/test hook: every call to play() appends the key to window.__audioCalls
   * (initialised as an empty array on first use). This lets Playwright/headless
   * tests assert event→sound wiring even when the AudioContext is suspended and
   * no actual audio plays. The array is bounded to the last 200 entries to avoid
   * memory growth in long sessions. This block is compiled away in production
   * builds by Vite's dead-code elimination when import.meta.env.DEV is false.
   *
   * @param key - The manifest key from content/audio.json
   */
  play(key: string): void {
    // Dev-only audit log — lets Playwright assert event→sound wiring headless.
    if (import.meta.env.DEV) {
      const w = window as unknown as { __audioCalls?: string[] };
      if (!w.__audioCalls) w.__audioCalls = [];
      w.__audioCalls.push(key);
      // Keep the log bounded so it doesn't grow unboundedly in long sessions.
      if (w.__audioCalls.length > 200) w.__audioCalls.shift();
    }

    if (this.isMuted()) return;

    const sound = this.sounds.get(key);
    if (!sound) {
      // Only warn in dev — in prod a missing SFX is not catastrophic.
      if (import.meta.env.DEV) {
        console.warn(`AudioManager.play(): key "${key}" not found.`);
      }
      return;
    }

    // For looping sounds (ambient), play() would restart — use start/stop instead.
    // SFX are non-looping so play() is correct (plays once from the beginning).
    try {
      sound.play();
    } catch (e) {
      console.warn(`AudioManager: could not play "${key}":`, e);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Retrieve the audio manifest from ContentLoader.
   * Returns null and logs once if the manifest is unavailable.
   */
  private _getManifest(): AudioManifest | null {
    try {
      const manifest = ContentLoader.getInstance().getAudioManifest();
      if (!manifest && !this.noManifestWarned) {
        this.noManifestWarned = true;
        console.warn('AudioManager: content/audio.json not found or failed to load. Audio disabled.');
      }
      return manifest;
    } catch {
      // ContentLoader not loaded yet (should not happen in normal flow).
      if (!this.noManifestWarned) {
        this.noManifestWarned = true;
        console.warn('AudioManager: ContentLoader not ready. Audio disabled.');
      }
      return null;
    }
  }

  /**
   * Wire GameEvents to SFX callbacks.
   * Called once during init(). All listeners are on game.events (global bus)
   * so they survive scene transitions (UIScene, MainMenuScene).
   *
   * Event→sound mapping:
   *  PLAYER_INTERACT → sfx.interact  (E press that starts NPC/door dialogue)
   *  NPC_RESOLVED    → sfx.correct   (correct card selected)
   *  ANSWER_WRONG    → sfx.wrong     (wrong card selected)
   *  DOOR_OPEN       → sfx.door      (door unlocks when all NPCs helped)
   *
   * @param scene - Scene whose game.events bus we listen on
   */
  private _bindEvents(scene: Phaser.Scene): void {
    const ev = scene.game.events;

    // E key triggers interaction → play interaction blip
    ev.on(GameEvents.PLAYER_INTERACT, () => {
      this.play('sfx.interact');
    });

    // Correct card picked → positive confirmation sound
    ev.on(GameEvents.NPC_RESOLVED, () => {
      this.play('sfx.correct');
    });

    // Wrong card picked → error/buzz sound
    ev.on(GameEvents.ANSWER_WRONG, () => {
      this.play('sfx.wrong');
    });

    // Door unlocks (all NPCs helped) → door-open sound
    ev.on(GameEvents.DOOR_OPEN, () => {
      this.play('sfx.door');
    });
  }

  /**
   * Apply a master volume multiplier to all sound objects.
   * Scales each sound relative to its authored volume from the manifest,
   * so relative volumes between SFX and music are preserved.
   *
   * @param masterVolume - [0, 1]
   */
  private _applyVolume(masterVolume: number): void {
    const manifest = this._getManifest();
    if (!manifest) return;

    for (const [key, sound] of this.sounds) {
      const authored = manifest[key]?.volume ?? 1;
      // Cast to typed sound: BaseSound has no volume property in the abstract type,
      // but both WebAudioSound and HTML5AudioSound do.
      (sound as unknown as { volume: number }).volume = authored * masterVolume;
    }
  }

  /**
   * Apply or clear the global mute.
   *
   * We mute all individual sounds rather than using scene.sound.mute so
   * we don't interfere with Phaser internals or other scenes' sound managers.
   *
   * @param muted - True to silence all sounds, false to restore volume.
   */
  private _applyMute(muted: boolean): void {
    const manifest = this._getManifest();
    const masterVolume = SaveSystem.getInstance().getMasterVolume();

    for (const [key, sound] of this.sounds) {
      const authored = manifest?.[key]?.volume ?? 1;
      (sound as unknown as { volume: number }).volume = muted ? 0 : authored * masterVolume;
    }
  }

  /**
   * Actually start the ambient loop. Called once the AudioContext is ready.
   * Respects mute state: if muted, the track plays at volume 0 so it can
   * seamlessly resume when unmuted (no gap/restart needed).
   */
  private _playAmbient(): void {
    if (!this.ambientTrack) return;

    try {
      this.ambientTrack.play();
    } catch (e) {
      console.warn('AudioManager: could not start ambient music:', e);
    }
  }
}
