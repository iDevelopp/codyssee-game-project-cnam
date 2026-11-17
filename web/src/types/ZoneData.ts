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

  /** Optional strings key for the label above the door (default "door.exitLabel"). */
  labelKey?: string;

  /** Open from the start, never locked (e.g. the cafeteria door). */
  alwaysOpen?: boolean;
}

/** Special `leadsToZoneId`: back to the last story zone the player was in. */
export const RETURN_ZONE_ID = '@return';

/**
 * Zone visual theme (phase 2 art overhaul).
 *
 * Replaces the engine-hardcoded ERA_BACKGROUND/ERA_TILE_SHADES dicts — colours
 * are now authored per zone in content/zones/zone_0X.json. All fields optional
 * so ZoneScene can fall back to a default theme when a zone predates this schema.
 * Hex strings are accepted with or without a leading '#'.
 */
export interface ZoneTheme {
  /** Camera/page background colour, e.g. "0b1420" or "#0b1420". */
  background: string;
  /** Optional full-screen ambient tint colour drawn above the tilemap. */
  ambient?: string;
  /** Alpha for the ambient tint rectangle, in [0, 1]. Defaults applied by the engine if absent. */
  ambientAlpha?: number;
  /** Accent colour for this zone's era (used for placeholder shading / future UI hooks). */
  accent?: string;
}

/**
 * A single decorative/collidable prop placed in a zone map.
 *
 * `rect` is a pixel rect [x, y, w, h] into
 * `sprites/neo_zero_props_and_items_01.png` — the engine registers a custom
 * texture frame for it. `x`/`y` are the prop's world-space placement (map
 * pixel space, before tileScale is applied by the engine... actually already
 * in world/display space, matching NPC/door position conventions).
 */
export interface ZoneProp {
  /** Source pixel rect [x, y, width, height] within the props spritesheet. */
  rect: [number, number, number, number];
  /** World-space X position to place the prop at. */
  x: number;
  /** World-space Y position to place the prop at. */
  y: number;
  /** When true, the engine gives this prop a static arcade body (blocks the player). */
  solid?: boolean;
}

/**
 * Zone tilemap data (phase 2 art overhaul).
 *
 * `ground`/`walls`/`decor` are raw 2D tile-index arrays (Phaser `make.tilemap({ data })`
 * format, -1 = empty) referencing `tiles/neo_zero_tiles_and_buildings_01.png`
 * (10×10 grid of 32×32 tiles, index = row*10+col). See
 * docs/specs/2026-07-07-phase2-art-gameplay-design.md for the full contract.
 */
export interface ZoneMap {
  /** Source tile size in pixels (before scaling). */
  tileSize: number;
  /** Display scale factor applied to every tile layer. */
  tileScale: number;
  /** Map width in tiles. */
  width: number;
  /** Map height in tiles. */
  height: number;
  /** Floor tile indices, renders below everything, never collides. */
  ground: number[][];
  /** Wall/obstacle tile indices (-1 = empty), collide with the player. */
  walls: number[][];
  /** Decorative tile indices (-1 = empty), renders above ground, below entities, never collides. */
  decor: number[][];
  /** Prop placements (stalls, lamps, trees, ...). */
  props: ZoneProp[];
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
/**
 * A world object that is neither an NPC nor a door (feat/energy-coffee).
 * `type` selects the entity class; unknown types are ignored with a warning.
 */
export interface PropData {
  id: string;
  /** "coffee" = coffee machine (restores energy). */
  type: string;
  position: { x: number; y: number };
}

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

  /**
   * Optional per-zone NPC position overrides (level editor, J6).
   * npcs.json stores one global position per NPC; fan/editor zones place
   * those same NPCs at their own coordinates. When an id is present here,
   * ZoneScene spawns that NPC at the override position instead of the
   * npcs.json one. Official zones never use this field.
   */
  npcPositions?: Record<string, { x: number; y: number }>;

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

  /**
   * Optional visual theme (phase 2). Absent on zones authored before this
   * schema landed — ZoneScene falls back to a default theme in that case.
   */
  theme?: ZoneTheme;

  /**
   * Optional music track for this zone — a manifest key from
   * content/audio.json (e.g. "music.zone_01"). When absent, whatever track is
   * already playing keeps playing (no hard stop on zone entry).
   */
  music?: string;

  /**
   * Card ids this zone contributes to the answer pool. The pool shown when
   * answering an NPC is CUMULATIVE: the union of cardPool over all zones up
   * to and including the current one — old languages first, recent ones only
   * near the end of the game. A zone's expected answers must appear in its
   * own pool or an earlier zone's. When any zone in range omits this field,
   * the engine falls back to the full catalog (pre-pool saves/content).
   */
  cardPool?: string[];

  /**
   * Optional tilemap data (phase 2). Absent on zones authored before this
   * schema landed — ZoneScene falls back to the placeholder checkerboard
   * floor in that case (content and engine work lands in parallel).
   */
  map?: ZoneMap;

  /**
   * Hub zone (e.g. the cafeteria): reachable from every strate but not part
   * of the story — no strate number, no progress, no clear bonus.
   * Listed under "hubs" in zones/index.json.
   */
  hub?: boolean;

  /** Optional world props (coffee machines…). */
  props?: PropData[];
}
