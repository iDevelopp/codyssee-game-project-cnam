/**
 * ProgressSnapshot — payload of GameEvents.PROGRESS_CHANGED.
 *
 * Everything the HUD needs to tell the player where they are in the game,
 * computed by ZoneScene from content + save (the HUD stays dumb).
 */
export interface ProgressSnapshot {
  /** 1-based position of the current zone in zones/index.json. */
  zoneIndex: number;
  /** Number of zones in the game. */
  zoneCount: number;
  /** Display name of the current zone (zone JSON `displayName`). */
  zoneName: string;
  /** Era label of the current zone (zone JSON `themeEra`, e.g. "1990s"). */
  themeEra: string;
  /** Quest NPCs helped in the current zone. */
  zoneHelped: number;
  /** Quest NPCs in the current zone. */
  zoneTotal: number;
  /** Quest NPCs helped across the whole game. */
  globalHelped: number;
  /** Quest NPCs across the whole game. */
  globalTotal: number;
}
