/**
 * SaveSystem — persists player progression in localStorage.
 *
 * Key: `codyssee.save.v1` — versioned so future schema changes can migrate.
 *
 * Schema (v1):
 * {
 *   version: 1,
 *   deckCardIds: string[],          // Card ids in player deck
 *   helpedNpcIds: string[],         // NPC ids whose question was resolved
 *   unlockedDoorIds: string[],      // Door ids that were unlocked (for multi-zone future)
 *   // timeline: [] — placeholder, not populated in J1
 * }
 *
 * Rejouer behaviour (TASK-011 requirement):
 *   "Rejouer" reloads the ZoneScene but does NOT clear the save. The player
 *   keeps their deck and resolved NPCs persist — this means the zone loads
 *   with the door already open if it was previously unlocked.
 *   Rationale: matches the "keep your progress, explore again" feel of the
 *   prototype. A separate "Nouvelle partie" reset feature can be added later
 *   (call SaveSystem.reset() from a Settings menu).
 *
 * Survive page reload: yes — localStorage persists across sessions.
 *
 * This is a new feature vs Unity (Unity prototype had no save — web addition).
 */

/** Shape of the v1 save file. */
interface SaveDataV1 {
  version: 1;
  deckCardIds: string[];
  helpedNpcIds: string[];
  unlockedDoorIds: string[];
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
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Returns a fresh empty v1 save. */
  private static _empty(): SaveDataV1 {
    return { version: 1, deckCardIds: [], helpedNpcIds: [], unlockedDoorIds: [] };
  }

  /** Type guard: validates that a parsed JSON value is a well-formed v1 save. */
  private static _isValidV1(v: unknown): v is SaveDataV1 {
    if (typeof v !== 'object' || v === null) return false;
    const obj = v as Record<string, unknown>;
    return (
      obj['version'] === 1 &&
      Array.isArray(obj['deckCardIds']) &&
      Array.isArray(obj['helpedNpcIds']) &&
      Array.isArray(obj['unlockedDoorIds'])
    );
  }
}
