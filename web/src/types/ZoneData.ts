/**
 * Describes a door (transition point) within a zone.
 *
 * Doors are always interactable but locked until `OnAllNPCsHelped` fires.
 * Colour: grey (0.3,0.3,0.3) locked → green (0.4,1.0,0.4) open.
 * See gdd/01-boucle-reference.md §Porte.
 */
export interface DoorData {
  /** Unique identifier within the zone, e.g. "door_exit". */
  id: string;

  /** World-space position in the tilemap (pixels). */
  position: { x: number; y: number };

  /**
   * Message shown when the player presses E on a locked door.
   * Key into strings.fr.json, resolved at runtime.
   */
  lockedMessageKey: string;

  /**
   * Message shown when the door opens and the player interacts.
   * Key into strings.fr.json.
   */
  exitMessageKey: string;

  /**
   * Optional id of the zone to load on exit. If absent the engine
   * shows the end screen (single-zone builds, J0).
   */
  leadsToZoneId?: string;
}

/**
 * Represents a playable zone (room/area) in Codyssey.
 *
 * A zone groups a tilemap, spawn point, NPCs, and doors. The unlock
 * condition is evaluated by ProgressionSystem; for J0 it is always
 * "all quest NPCs helped".
 *
 * Authored in /content/zones/zone_XX.json — one file per zone.
 */
export interface ZoneData {
  /** Unique identifier, e.g. "zone_01". Used as the Phaser scene key suffix. */
  id: string;

  /** Human-readable zone name shown in the UI. French string. */
  displayName: string;

  /**
   * Path to the Tiled JSON tilemap, relative to BASE_URL/assets/tiles/.
   * Loaded by Phaser's TilemapJSONFile loader.
   */
  tilemap: string;

  /** World-space pixel coordinates where the player spawns on zone load. */
  spawn: { x: number; y: number };

  /**
   * List of NpcData.id values present in this zone.
   * The engine resolves these against npcs.json via ContentLoader.
   */
  npcs: string[];

  /** Door definitions for this zone. */
  doors: DoorData[];

  /**
   * Condition string that unlocks the zone's doors.
   * Interpreted by ProgressionSystem. Supported values for J0:
   * - "all_quest_npcs_helped" — all NPCs with a question resolved.
   * Agent-contenu can extend this vocabulary when adding new zones.
   */
  unlockCondition: string;

  /**
   * ZoneData.id of the zone that follows, if any.
   * Undefined for the last zone (shows end screen).
   */
  nextZoneId?: string;

  /**
   * Thematic era label for this zone, e.g. "1990s", "2000s".
   * Used by the timeline (frise) to group zones visually.
   */
  themeEra: string;
}
