import type { CardData } from '@/types/CardData';
import type { NpcData } from '@/types/NpcData';
import type { ZoneData } from '@/types/ZoneData';
import type { TimelineEntry } from '@/types/TimelineEntry';
import type { Strings } from '@/types/Strings';

// ---------------------------------------------------------------------------
// Internal raw shapes — exactly what the JSON files contain.
// The engine uses the typed accessors below, never the raw arrays directly.
// ---------------------------------------------------------------------------

/**
 * Shape of a single entry in audio.json.
 * Keys match what agent-art defined in content/audio.json (TASK-015).
 */
export interface AudioEntry {
  /** Ordered list of file paths (.ogg first, .mp3 fallback) for browser compatibility. */
  files: string[];
  /** Whether this sound loops (true for ambient music, false for SFX). */
  loop: boolean;
  /** Default volume in [0, 1] as authored by agent-art. */
  volume: number;
}

/** The full audio manifest from content/audio.json — keyed by sound id. */
export type AudioManifest = Record<string, AudioEntry>;

interface ContentStore {
  cards: CardData[];
  npcs: NpcData[];
  zones: Map<string, ZoneData>;
  /** Ordered zone id list from zones/index.json — used to preserve authoring order. */
  zoneOrder: string[];
  timeline: TimelineEntry[];
  strings: Strings;
  /** Audio manifest from content/audio.json — null if file is missing (graceful). */
  audio: AudioManifest | null;
}

// ---------------------------------------------------------------------------
// Validation helpers (dev-only guard — stripped by tree-shaking in prod
// because they are only called inside the `if (import.meta.env.DEV)` blocks).
// ---------------------------------------------------------------------------

/**
 * Asserts that `value` is a non-empty string. Throws a descriptive error
 * so authoring mistakes surface immediately during development.
 */
function assertString(value: unknown, path: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`ContentLoader: expected non-empty string at ${path}, got ${JSON.stringify(value)}`);
  }
}

/**
 * Asserts that `value` is an array (not necessarily non-empty).
 */
function assertArray(value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    throw new Error(`ContentLoader: expected array at ${path}, got ${JSON.stringify(value)}`);
  }
}

/**
 * Validates a single CardData object at the given source path.
 * Called in dev mode only; no-ops in production.
 */
function validateCard(card: unknown, index: number): void {
  const path = `cards[${index}]`;
  if (typeof card !== 'object' || card === null) {
    throw new Error(`ContentLoader: ${path} is not an object`);
  }
  const c = card as Record<string, unknown>;
  assertString(c['id'], `${path}.id`);
  assertString(c['displayName'], `${path}.displayName`);
  assertString(c['description'], `${path}.description`);
  assertString(c['usage'], `${path}.usage`);
}

/**
 * Validates a single NpcData object and checks that its expectedCardId
 * references a card that actually exists in the loaded card list.
 */
function validateNpc(npc: unknown, index: number, cardIds: Set<string>): void {
  const path = `npcs[${index}]`;
  if (typeof npc !== 'object' || npc === null) {
    throw new Error(`ContentLoader: ${path} is not an object`);
  }
  const n = npc as Record<string, unknown>;
  assertString(n['id'], `${path}.id`);
  assertString(n['name'], `${path}.name`);
  assertArray(n['dialogueLines'], `${path}.dialogueLines`);
  assertArray(n['resolvedLines'], `${path}.resolvedLines`);

  if (n['question'] !== null && n['question'] !== undefined) {
    const q = n['question'] as Record<string, unknown>;
    assertString(q['expectedCardId'], `${path}.question.expectedCardId`);
    assertString(q['thanksLine'], `${path}.question.thanksLine`);
    assertString(q['hintLine'], `${path}.question.hintLine`);

    // Cross-reference: the expected card must exist in cards.json
    if (!cardIds.has(q['expectedCardId'] as string)) {
      throw new Error(
        `ContentLoader: ${path}.question.expectedCardId "${q['expectedCardId']}" ` +
        `not found in cards.json — check spelling or add the card.`
      );
    }
  }
}

/**
 * Validates a ZoneData object and checks that its NPC references exist.
 */
function validateZone(zone: unknown, npcIds: Set<string>): void {
  if (typeof zone !== 'object' || zone === null) {
    throw new Error(`ContentLoader: zone file is not an object`);
  }
  const z = zone as Record<string, unknown>;
  assertString(z['id'], 'zone.id');
  assertString(z['displayName'], 'zone.displayName');
  assertString(z['tilemap'], 'zone.tilemap');
  assertArray(z['npcs'], 'zone.npcs');
  assertArray(z['doors'], 'zone.doors');
  assertString(z['unlockCondition'], 'zone.unlockCondition');
  assertString(z['themeEra'], 'zone.themeEra');

  // Cross-reference: each NPC id in the zone must be defined in npcs.json
  for (const npcId of z['npcs'] as string[]) {
    if (!npcIds.has(npcId)) {
      throw new Error(
        `ContentLoader: zone "${z['id']}" references npc "${npcId}" ` +
        `not found in npcs.json — add the NPC or fix the id.`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// ContentLoader
// ---------------------------------------------------------------------------

/**
 * ContentLoader — singleton that fetches and exposes all game content.
 *
 * Design rationale: fetch over Vite static JSON import.
 * Vite JSON imports are inlined into the JS bundle at build time, which
 * defeats the data-driven architecture (adding a card would require a
 * rebuild). fetch() loads the files at runtime from the /content directory
 * served as static assets, so content can be updated without touching the
 * engine bundle. This matches ADR-002.
 *
 * Usage:
 *   await ContentLoader.getInstance().load();
 *   const card = ContentLoader.getInstance().getCard('python');
 *
 * BASE_URL: all fetch paths are constructed from `import.meta.env.BASE_URL`
 * (resolves to '/codyssee/' in production, '/' in dev — ADR-004).
 */
export class ContentLoader {
  private static instance: ContentLoader | null = null;

  private store: ContentStore | null = null;
  private loadPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Returns the singleton instance. Creates it on first call.
   */
  static getInstance(): ContentLoader {
    if (!ContentLoader.instance) {
      ContentLoader.instance = new ContentLoader();
    }
    return ContentLoader.instance;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Loads all content files from /content. Idempotent: calling twice returns
   * the same promise without re-fetching.
   *
   * Must be awaited before any accessor is called (typically in PreloadScene).
   *
   * @throws Error if any file is missing, malformed, or internally inconsistent
   *   (invalid cross-references). In production the error propagates to Phaser's
   *   error handler; in dev it includes an actionable message.
   */
  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this._loadAll();
    return this.loadPromise;
  }

  /**
   * Returns all cards. Throws if ContentLoader has not been loaded yet.
   */
  getCards(): CardData[] {
    return this._require().cards;
  }

  /**
   * Returns a single card by id, or undefined if not found.
   */
  getCard(id: string): CardData | undefined {
    return this._require().cards.find((c) => c.id === id);
  }

  /**
   * Returns all NPCs. Throws if ContentLoader has not been loaded yet.
   */
  getNpcs(): NpcData[] {
    return this._require().npcs;
  }

  /**
   * Returns a single NPC by id, or undefined if not found.
   */
  getNpc(id: string): NpcData | undefined {
    return this._require().npcs.find((n) => n.id === id);
  }

  /**
   * Returns the zone data for the given zone id, or undefined if not found.
   */
  getZone(id: string): ZoneData | undefined {
    return this._require().zones.get(id);
  }

  /**
   * Returns all loaded zones in authoring order (as listed in zones/index.json).
   */
  getZones(): ZoneData[] {
    const store = this._require();
    // Preserve the order from index.json rather than Map insertion order
    return store.zoneOrder
      .map((id) => store.zones.get(id))
      .filter((z): z is ZoneData => z !== undefined);
  }

  /**
   * Returns the ordered list of zone ids from zones/index.json.
   * Useful for multi-zone navigation and authoring tooling.
   */
  getZoneIds(): string[] {
    return [...this._require().zoneOrder];
  }

  /**
   * Returns all timeline entries in authoring order.
   */
  getTimeline(): TimelineEntry[] {
    return this._require().timeline;
  }

  /**
   * Returns a UI string by dot-separated key (e.g. "menu.play").
   * Returns the key itself if not found — visible in the UI as a sentinel
   * that triggers content author attention without crashing.
   */
  getString(key: string): string {
    const s = this._require().strings[key];
    if (s === undefined) {
      // Log a warning but return the key so the UI stays functional
      console.warn(`ContentLoader: missing string key "${key}" in strings.fr.json`);
      return key;
    }
    return s;
  }

  /**
   * Returns the audio manifest from content/audio.json, or null if the file
   * was missing at load time (graceful — audio is non-blocking).
   *
   * AudioManager calls this to discover sound keys and file paths without
   * hardcoding any filename in engine code (ADR-002).
   */
  getAudioManifest(): AudioManifest | null {
    return this._require().audio;
  }

  /**
   * Returns the ids of all cards that are NOT expected answers for any NPC.
   *
   * This is the initial player deck (complement set), matching the Unity
   * GameManager.Start logic: deck = all cards minus expectedAnswer cards.
   * See gdd/01-boucle-reference.md §Deck & cartes.
   */
  getInitialDeckCards(): CardData[] {
    const store = this._require();
    const answerIds = new Set<string>();
    for (const npc of store.npcs) {
      if (npc.question) {
        answerIds.add(npc.question.expectedCardId);
      }
    }
    return store.cards.filter((c) => !answerIds.has(c.id));
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Asserts content is loaded and returns the store.
   * Throws a clear error if called before `load()` resolves.
   */
  private _require(): ContentStore {
    if (!this.store) {
      throw new Error(
        'ContentLoader: data not loaded yet. Await ContentLoader.getInstance().load() first.'
      );
    }
    return this.store;
  }

  /**
   * Fetches and validates all content files. Called once by load().
   */
  private async _loadAll(): Promise<void> {
    const base = import.meta.env.BASE_URL;

    // Fetch all root-level JSON files in parallel for performance.
    // audio.json is optional — AudioManager degrades gracefully if missing.
    const [cardsRaw, npcsRaw, timelineRaw, stringsRaw, audioRaw] = await Promise.all([
      this._fetchJson(`${base}content/cards.json`),
      this._fetchJson(`${base}content/npcs.json`),
      // timeline.json is optional in J0 — returns empty array if missing
      this._fetchJsonOptional(`${base}content/timeline.json`, []),
      this._fetchJson(`${base}content/strings.fr.json`),
      // audio.json is optional — returns null if missing so AudioManager can skip gracefully
      this._fetchJsonOptional(`${base}content/audio.json`, null),
    ]);

    // --- Parse cards ---
    if (!Array.isArray(cardsRaw)) {
      throw new Error('ContentLoader: cards.json must be a JSON array');
    }
    const cards = cardsRaw as CardData[];
    if (import.meta.env.DEV) {
      cards.forEach((c, i) => validateCard(c, i));
    }

    // --- Parse NPCs ---
    if (!Array.isArray(npcsRaw)) {
      throw new Error('ContentLoader: npcs.json must be a JSON array');
    }
    const npcs = npcsRaw as NpcData[];
    if (import.meta.env.DEV) {
      const cardIds = new Set(cards.map((c) => c.id));
      npcs.forEach((n, i) => validateNpc(n, i, cardIds));
    }

    // --- Parse timeline (optional) ---
    const timeline = (Array.isArray(timelineRaw) ? timelineRaw : []) as TimelineEntry[];

    // --- Parse strings ---
    if (typeof stringsRaw !== 'object' || Array.isArray(stringsRaw) || stringsRaw === null) {
      throw new Error('ContentLoader: strings.fr.json must be a JSON object (key→string map)');
    }
    const strings = stringsRaw as Strings;

    // --- Load zones ---
    // Zone list is driven by content/zones/index.json (ADR-002, data-driven).
    // Fetching index first, then each zone in parallel for performance.
    // Falls back to an empty list if index is missing (graceful degradation).
    const zones = new Map<string, ZoneData>();
    const npcIds = new Set(npcs.map((n) => n.id));

    const zoneIndexRaw = await this._fetchJsonOptional(`${base}content/zones/index.json`, null);

    // Validate index shape: must be { zones: string[], version: number }
    let zoneIds: string[] = [];
    if (zoneIndexRaw !== null) {
      if (
        typeof zoneIndexRaw !== 'object' ||
        Array.isArray(zoneIndexRaw) ||
        !Array.isArray((zoneIndexRaw as Record<string, unknown>)['zones'])
      ) {
        throw new Error(
          'ContentLoader: content/zones/index.json must be { "zones": string[], "version": number }'
        );
      }
      zoneIds = (zoneIndexRaw as { zones: string[] }).zones;

      if (import.meta.env.DEV) {
        // Each id must be a non-empty string — catch authoring typos early
        zoneIds.forEach((id, i) => assertString(id, `zones/index.json zones[${i}]`));
      }
    }

    // Fetch all zone files in parallel (order preserved by Promise.all index)
    const zoneRaws = await Promise.all(
      zoneIds.map((id) => this._fetchJsonOptional(`${base}content/zones/${id}.json`, null))
    );

    for (let i = 0; i < zoneIds.length; i++) {
      const zoneRaw = zoneRaws[i];
      if (zoneRaw === null) {
        // A listed zone file is missing — always throw (not a graceful case)
        throw new Error(
          `ContentLoader: zones/index.json lists "${zoneIds[i]}" but content/zones/${zoneIds[i]}.json was not found.`
        );
      }
      if (import.meta.env.DEV) {
        validateZone(zoneRaw, npcIds);
      }
      const zone = zoneRaw as ZoneData;
      zones.set(zone.id, zone);
    }

    // Parse audio manifest — optional, null if missing or malformed.
    // We accept any object shape here; AudioManager validates entries at runtime.
    const audio: AudioManifest | null =
      audioRaw !== null && typeof audioRaw === 'object' && !Array.isArray(audioRaw)
        ? (audioRaw as AudioManifest)
        : null;

    this.store = { cards, npcs, zones, zoneOrder: zoneIds, timeline, strings, audio };
  }

  /**
   * Fetches a JSON file and throws a clear error if it is missing or invalid.
   */
  private async _fetchJson(url: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (e) {
      throw new Error(`ContentLoader: network error fetching "${url}": ${String(e)}`);
    }
    if (!response.ok) {
      throw new Error(
        `ContentLoader: "${url}" returned HTTP ${response.status}. ` +
        `Check that the file exists in /web/content/.`
      );
    }
    try {
      return (await response.json()) as unknown;
    } catch {
      throw new Error(`ContentLoader: "${url}" is not valid JSON.`);
    }
  }

  /**
   * Like _fetchJson but returns `fallback` when the file is missing (404)
   * instead of throwing. Used for optional content files (timeline, future zone index).
   */
  private async _fetchJsonOptional(url: string, fallback: unknown): Promise<unknown> {
    try {
      const response = await fetch(url);
      if (!response.ok) return fallback;
      return (await response.json()) as unknown;
    } catch {
      return fallback;
    }
  }
}
