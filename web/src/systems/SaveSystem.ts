/**
 * SaveSystem — persists player progression in localStorage.
 *
 * Key: `codyssee.save.v1` — versioned so future schema changes can migrate.
 *
 * Schema (v1):
 * {
 *   version: 1,
 *   deckCardIds: string[],          // Card ids in player deck
 *   helpedNpcIds: string[],         // NPC ids whose question was resolved (global — persists across zones)
 *   unlockedDoorIds: string[],      // Door ids that were unlocked
 *   unlockedZoneIds: string[],      // Zone ids that have been reached/unlocked (added TASK-020)
 *   currentZoneId: string | null,   // Last zone reached — resume point on reload (added TASK-020)
 *   masterVolume: number,           // [0..1] master volume (added TASK-016)
 *   muted: boolean,                 // global mute flag (added TASK-016)
 *   // timeline: [] — placeholder, not populated in J1
 * }
 *
 * Rejouer behaviour (TASK-020 update):
 *   "Rejouer" on the end screen restarts the CURRENT zone (not zone_01).
 *   The player keeps their deck, resolved NPCs persist globally, and the
 *   door is shown open if it was previously unlocked.
 *   Deck and helpedNpcIds are GLOBAL across zones — a card earned in zone_01
 *   stays in the deck when zone_02 loads.
 *   For a true new game, call SaveSystem.reset() (exposed via settings menu).
 *
 * Survive page reload: yes — localStorage persists across sessions.
 *
 * This is a new feature vs Unity (Unity prototype had no save — web addition).
 *
 * Audio fields (TASK-016):
 *   masterVolume and muted are persisted in the same save so the player's
 *   audio preferences survive page reloads. A dedicated Settings UI (J3+)
 *   can expose sliders; for J2 only the M-key mute toggle is wired.
 *
 * Zone fields (TASK-020):
 *   unlockedZoneIds tracks which zones have been reached.
 *   currentZoneId is the last zone the player entered — used to resume on reload.
 *   Both fields are backfilled to defaults in old saves (migration-safe).
 */

/** Shape of the v1 save file. */
interface SaveDataV1 {
  version: 1;
  deckCardIds: string[];
  helpedNpcIds: string[];
  unlockedDoorIds: string[];
  /** Zone ids that have been unlocked/reached. Default []. Added in TASK-020. */
  unlockedZoneIds: string[];
  /** Last zone id the player entered — resume point. Null = never started. Added in TASK-020. */
  currentZoneId: string | null;
  /** Master volume in [0, 1]. Default 1.0 (full volume). Added in TASK-016. */
  masterVolume: number;
  /** Global mute flag. Default false. Added in TASK-016. */
  muted: boolean;
}

const SAVE_KEY = 'codyssee.save.v1';

export class SaveSystem {
  private static instance: SaveSystem | null = null;

  /** In-memory cache of the current save data. */
  private data: SaveDataV1 = SaveSystem._empty();

  private constructor() {}

  /** Singleton accessor — one save system per game session. */
  static getInstance(): SaveSystem {
    if (!SaveSystem.instance) {
      SaveSystem.instance = new SaveSystem();
    }
    return SaveSystem.instance;
  }

  // ---------------------------------------------------------------------------
  // Load / Save
  // ---------------------------------------------------------------------------

  /**
   * Load save data from localStorage. Safe to call even if no save exists
   * (returns empty defaults). Validates the version field for future-proofing.
   */
  load(): SaveDataV1 {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      this.data = SaveSystem._empty();
      return this.data;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!SaveSystem._isValidV1(parsed)) {
        // Unknown or corrupt save — start fresh
        console.warn('SaveSystem: incompatible or corrupt save, resetting.');
        this.data = SaveSystem._empty();
      } else {
        this.data = parsed;
      }
    } catch {
      console.warn('SaveSystem: JSON parse error, resetting save.');
      this.data = SaveSystem._empty();
    }

    return this.data;
  }

  /**
   * Persist current in-memory data to localStorage.
   * Called after every state change (card add, NPC resolved, door unlocked).
   */
  save(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      // Storage quota exceeded or private mode — log and continue
      console.warn('SaveSystem: could not write to localStorage:', e);
    }
  }

  /** Wipe the save file. Used for a true "new game" reset (not Rejouer). */
  reset(): void {
    this.data = SaveSystem._empty();
    localStorage.removeItem(SAVE_KEY);
  }

  // ---------------------------------------------------------------------------
  // Deck
  // ---------------------------------------------------------------------------

  /** Returns the saved deck card ids. */
  getDeckCardIds(): string[] {
    return [...this.data.deckCardIds];
  }

  /**
   * Update the saved deck card ids and persist immediately.
   *
   * @param ids - Current deck card ids from DeckSystem.listIds()
   */
  saveDeck(ids: string[]): void {
    this.data.deckCardIds = [...ids];
    this.save();
  }

  // ---------------------------------------------------------------------------
  // NPC progression
  // ---------------------------------------------------------------------------

  /** Returns ids of all NPCs whose question was previously resolved. */
  getHelpedNpcIds(): string[] {
    return [...this.data.helpedNpcIds];
  }

  /**
   * Record that an NPC has been helped and persist.
   *
   * @param npcId - NpcData.id of the resolved NPC
   */
  recordNpcHelped(npcId: string): void {
    if (!this.data.helpedNpcIds.includes(npcId)) {
      this.data.helpedNpcIds.push(npcId);
      this.save();
    }
  }

  // ---------------------------------------------------------------------------
  // Doors
  // ---------------------------------------------------------------------------

  /** Returns true if the given door was previously unlocked. */
  isDoorUnlocked(doorId: string): boolean {
    return this.data.unlockedDoorIds.includes(doorId);
  }

  /**
   * Record that a door was unlocked (all NPCs helped) and persist.
   *
   * @param doorId - DoorData.id of the unlocked door
   */
  recordDoorUnlocked(doorId: string): void {
    if (!this.data.unlockedDoorIds.includes(doorId)) {
      this.data.unlockedDoorIds.push(doorId);
      this.save();
    }
  }

  // ---------------------------------------------------------------------------
  // Audio preferences (TASK-016)
  // ---------------------------------------------------------------------------

  /**
   * Returns the persisted master volume (default 1.0 if not set).
   */
  getMasterVolume(): number {
    return this.data.masterVolume;
  }

  /**
   * Persist a new master volume value.
   *
   * @param volume - Clamped to [0, 1] by caller (AudioManager).
   */
  saveMasterVolume(volume: number): void {
    this.data.masterVolume = volume;
    this.save();
  }

  /** Returns the persisted mute flag (default false). */
  getMuted(): boolean {
    return this.data.muted;
  }

  /**
   * Toggle the muted flag and persist.
   *
   * @returns The new muted state after toggling.
   */
  toggleMuted(): boolean {
    this.data.muted = !this.data.muted;
    this.save();
    return this.data.muted;
  }

  // ---------------------------------------------------------------------------
  // Zone progression (TASK-020)
  // ---------------------------------------------------------------------------

  /**
   * Returns ids of all zones that have been unlocked/reached.
   */
  getUnlockedZoneIds(): string[] {
    return [...this.data.unlockedZoneIds];
  }

  /**
   * Record that a zone has been reached and persist.
   * Idempotent — safe to call multiple times for the same zone.
   *
   * @param zoneId - ZoneData.id of the reached zone
   */
  recordZoneUnlocked(zoneId: string): void {
    if (!this.data.unlockedZoneIds.includes(zoneId)) {
      this.data.unlockedZoneIds.push(zoneId);
    }
    // Always update currentZoneId when a zone is reached
    this.data.currentZoneId = zoneId;
    this.save();
  }

  /**
   * Returns the last zone id the player entered, or null if never started.
   * Used by MainMenuScene to resume at the correct zone on reload.
   */
  getCurrentZoneId(): string | null {
    return this.data.currentZoneId;
  }

  /**
   * Explicitly set the current zone (used when starting from MainMenu to resume).
   *
   * @param zoneId - Zone to mark as current
   */
  setCurrentZoneId(zoneId: string): void {
    this.data.currentZoneId = zoneId;
    this.save();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Returns a fresh empty v1 save. */
  private static _empty(): SaveDataV1 {
    return {
      version: 1,
      deckCardIds: [],
      helpedNpcIds: [],
      unlockedDoorIds: [],
      unlockedZoneIds: [],
      currentZoneId: null,
      masterVolume: 1.0,
      muted: false,
    };
  }

  /** Type guard: validates that a parsed JSON value is a well-formed v1 save. */
  private static _isValidV1(v: unknown): v is SaveDataV1 {
    if (typeof v !== 'object' || v === null) return false;
    const obj = v as Record<string, unknown>;
    if (
      obj['version'] !== 1 ||
      !Array.isArray(obj['deckCardIds']) ||
      !Array.isArray(obj['helpedNpcIds']) ||
      !Array.isArray(obj['unlockedDoorIds'])
    ) {
      return false;
    }
    // Audio fields were added in TASK-016 — backfill if an older save is found.
    if (typeof obj['masterVolume'] !== 'number') {
      (obj as Record<string, unknown>)['masterVolume'] = 1.0;
    }
    if (typeof obj['muted'] !== 'boolean') {
      (obj as Record<string, unknown>)['muted'] = false;
    }
    // Zone fields were added in TASK-020 — backfill for saves created before this task.
    if (!Array.isArray(obj['unlockedZoneIds'])) {
      (obj as Record<string, unknown>)['unlockedZoneIds'] = [];
    }
    if (obj['currentZoneId'] === undefined) {
      (obj as Record<string, unknown>)['currentZoneId'] = null;
    }
    return true;
  }
}
