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
 *   xp: number,                     // experience points, never negative (feat/xp-progress)
 *   seenQuestionNpcIds: string[],   // NPCs whose question was asked, in order (feat/question-history)
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

import type { PlayerProfile } from '@/types/Profile';

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
  /** Experience points (≥ 0). Default 0. Added in feat/xp-progress. */
  xp: number;
  /** NPC ids whose question has been asked, in first-asked order. Default []. */
  seenQuestionNpcIds: string[];
  /** Current energy, or null before the first zone (= economy.energy.start). */
  energy: number | null;
  /** Last story (non-hub) zone entered — where the cafeteria "Retour" door leads. */
  lastStoryZoneId: string | null;
  /** Player character (name, pronoun, style) — null until created. */
  profile: PlayerProfile | null;
  /** Premium style ids bought in the shop (free styles are always owned). */
  ownedStyleIds: string[];
}

const SAVE_KEY = 'codyssee.save.v1';

export class SaveSystem {
  private static instance: SaveSystem | null = null;

  /** In-memory cache of the current save data. */
  private data: SaveDataV1 = SaveSystem._empty();

  /**
   * When true, all writes are in-memory only (level-editor test sessions).
   * save() is a no-op, so testing a draft zone never pollutes the real save.
   * Leaving sandbox mode calls load() to re-sync memory with disk, discarding
   * any in-memory-only changes accumulated during the test.
   */
  private sandbox = false;

  private constructor() {}

  /** Singleton accessor — one save system per game session. */
  static getInstance(): SaveSystem {
    if (!SaveSystem.instance) {
      SaveSystem.instance = new SaveSystem();
    }
    return SaveSystem.instance;
  }

  /**
   * Enter/leave sandbox mode (level-editor test sessions).
   *
   * Enter: writes become in-memory only. Call load() right after to reset the
   *        in-memory copy to the on-disk state.
   * Leave: reloads from localStorage, discarding in-memory-only changes.
   *
   * @param on - true to enter sandbox, false to leave
   */
  setSandbox(on: boolean): void {
    this.sandbox = on;
    if (!on) {
      this.load();
    }
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
    if (this.sandbox) return; // editor test session — never persist
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

  // ---------------------------------------------------------------------------
  // XP (feat/xp-progress) — use XpSystem rather than calling these directly,
  // so the HUD is notified of every change.
  // ---------------------------------------------------------------------------

  /** Returns the persisted XP total. */
  getXp(): number {
    return this.data.xp;
  }

  /**
   * Overwrite the XP total and persist. Clamped to an integer ≥ 0.
   *
   * @param xp - New XP total
   */
  setXp(xp: number): void {
    this.data.xp = Math.max(0, Math.round(xp));
    this.save();
  }

  // ---------------------------------------------------------------------------
  // Question history (feat/question-history)
  // ---------------------------------------------------------------------------

  /** NPC ids whose question was asked, in the order they were first asked. */
  getSeenQuestionNpcIds(): string[] {
    return [...this.data.seenQuestionNpcIds];
  }

  /** Record that an NPC's question was asked (idempotent) and persist. */
  recordQuestionSeen(npcId: string): void {
    if (!this.data.seenQuestionNpcIds.includes(npcId)) {
      this.data.seenQuestionNpcIds.push(npcId);
      this.save();
    }
  }

  // ---------------------------------------------------------------------------
  // Energy (feat/energy-coffee) — use EnergySystem, which notifies the HUD.
  // ---------------------------------------------------------------------------

  /** Persisted energy, or null if never set (new game). */
  getEnergy(): number | null {
    return this.data.energy;
  }

  /** Persist the energy value. */
  setEnergy(energy: number): void {
    this.data.energy = energy;
    this.save();
  }

  /** Last story zone entered (cafeteria return target). */
  getLastStoryZoneId(): string | null {
    return this.data.lastStoryZoneId;
  }

  setLastStoryZoneId(zoneId: string): void {
    this.data.lastStoryZoneId = zoneId;
    this.save();
  }

  // ---------------------------------------------------------------------------
  // Player profile (feat/character-creation)
  // ---------------------------------------------------------------------------

  getProfile(): PlayerProfile | null {
    return this.data.profile ? { ...this.data.profile } : null;
  }

  setProfile(profile: PlayerProfile): void {
    this.data.profile = { ...profile };
    this.save();
  }

  /** Premium styles bought in the shop. */
  getOwnedStyleIds(): string[] {
    return [...this.data.ownedStyleIds];
  }

  recordStyleOwned(styleId: string): void {
    if (!this.data.ownedStyleIds.includes(styleId)) {
      this.data.ownedStyleIds.push(styleId);
      this.save();
    }
  }

  /** Change the equipped style (no-op without a profile). */
  setStyle(styleId: string): void {
    if (!this.data.profile) return;
    this.data.profile.styleId = styleId;
    this.save();
  }

  private static _isValidProfile(p: unknown): p is PlayerProfile {
    if (typeof p !== 'object' || p === null) return false;
    const o = p as Record<string, unknown>;
    return typeof o['name'] === 'string' && o['name'].length > 0
      && (o['pronoun'] === 'il' || o['pronoun'] === 'elle' || o['pronoun'] === 'iel')
      && typeof o['styleId'] === 'string';
  }

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
      xp: 0,
      seenQuestionNpcIds: [],
      energy: null,
      lastStoryZoneId: null,
      profile: null,
      ownedStyleIds: [],
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
    if (typeof obj['xp'] !== 'number' || !Number.isFinite(obj['xp']) || (obj['xp'] as number) < 0) {
      (obj as Record<string, unknown>)['xp'] = 0;
    }
    if (!Array.isArray(obj['seenQuestionNpcIds'])) {
      // Old saves: every helped NPC has necessarily been asked its question
      (obj as Record<string, unknown>)['seenQuestionNpcIds'] = [...(obj['helpedNpcIds'] as string[])];
    }
    if (typeof obj['energy'] !== 'number' || !Number.isFinite(obj['energy'])) {
      (obj as Record<string, unknown>)['energy'] = null;
    }
    if (obj['currentZoneId'] === undefined) {
      (obj as Record<string, unknown>)['currentZoneId'] = null;
    }
    if (!Array.isArray(obj['ownedStyleIds'])) {
      (obj as Record<string, unknown>)['ownedStyleIds'] = [];
    }
    if (!SaveSystem._isValidProfile(obj['profile'])) {
      (obj as Record<string, unknown>)['profile'] = null;
    }
    if (typeof obj['lastStoryZoneId'] !== 'string') {
      (obj as Record<string, unknown>)['lastStoryZoneId'] = obj['currentZoneId'] ?? null;
    }
    return true;
  }
}
