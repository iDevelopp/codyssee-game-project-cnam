import type { ZoneData } from '@/types/ZoneData';
import type { NpcData } from '@/types/NpcData';

/**
 * LevelValidator — structural + reachability checks for an authored zone (J6/P5).
 *
 * Two severity levels:
 *  - error   — the zone would be broken or unplayable; blocks TEST/EXPORT.
 *  - warning — suspicious but playable; never blocks.
 *
 * Checks:
 *  Structure: map presence + layer dimensions, spawn inside map, door ids
 *  unique + inside map, door target zone ids known, NPC ids known (npcs.json),
 *  per-zone NPC positions inside map.
 *
 * Reachability: BFS flood-fill from the spawn cell over the passable grid.
 * A cell is impassable when the walls layer has a tile there OR a solid prop's
 * display rect covers it. Spawn must be on a passable cell; each NPC and door
 * must have its own cell — or a 4-neighbour cell — reachable from the spawn
 * (entities are interacted with by proximity, so standing on the exact cell
 * is not required).
 *
 * Pure data in / data out: no Phaser dependency, trivially unit-testable.
 */

/** Severity of a validation issue. */
export type IssueLevel = 'error' | 'warning';

/** One validation finding — `key` indexes strings.fr.json, `params` fill it. */
export interface ValidationIssue {
  level: IssueLevel;
  key: string;
  params?: Record<string, string>;
}

/** Result of validating one zone. */
export interface ValidationResult {
  issues: ValidationIssue[];
  /** Convenience: true when no `error`-level issue exists (TEST/EXPORT blocked). */
  blocked: boolean;
}

export class LevelValidator {
  /**
   * Validate a zone end-to-end.
   *
   * @param zone  - Zone under test (typically the editor draft)
   * @param npcs  - Full NPC roster from npcs.json (id → data lookup)
   * @param zoneIds - All known zone ids (for door `leadsToZoneId` checks)
   */
  static validate(zone: ZoneData, npcs: NpcData[], zoneIds: string[]): ValidationResult {
    const issues: ValidationIssue[] = [];
    const err = (key: string, params?: Record<string, string>) =>
      issues.push({ level: 'error', key, params });
    const warn = (key: string, params?: Record<string, string>) =>
      issues.push({ level: 'warning', key, params });

    const map = zone.map;
    if (!map) {
      // Editor cannot even open a mapless zone; defensive for imported levels.
      err('issue.map.missing');
      return LevelValidator._result(issues);
    }

    // ---- Layer dimensions ----
    for (const layer of ['ground', 'walls', 'decor'] as const) {
      const data = map[layer];
      if (data.length !== map.height || data.some((row) => row.length !== map.width)) {
        err('issue.map.dims', { layer, h: String(map.height), w: String(map.width) });
      }
    }

    const cell = map.tileSize * map.tileScale;
    const toCell = (wx: number, wy: number) => ({
      tx: Math.floor(wx / cell),
      ty: Math.floor(wy / cell),
    });
    const inBounds = (tx: number, ty: number) =>
      tx >= 0 && ty >= 0 && tx < map.width && ty < map.height;

    // ---- Passability grid (walls + solid props) ----
    const blocked: boolean[][] = Array.from({ length: map.height }, (_, ty) =>
      Array.from({ length: map.width }, (_, tx) => map.walls[ty]?.[tx] !== -1 && map.walls[ty]?.[tx] !== undefined),
    );

    for (const prop of map.props) {
      if (!prop.solid) continue;
      const [, , rw, rh] = prop.rect;
      // Origin is centre; display size = rect size × tileScale (same as MapBuilder).
      const halfW = (rw * map.tileScale) / 2;
      const halfH = (rh * map.tileScale) / 2;
      const c0 = toCell(prop.x - halfW, prop.y - halfH);
      const c1 = toCell(prop.x + halfW, prop.y + halfH);
      for (let ty = Math.max(0, c0.ty); ty <= Math.min(map.height - 1, c1.ty); ty++) {
        for (let tx = Math.max(0, c0.tx); tx <= Math.min(map.width - 1, c1.tx); tx++) {
          blocked[ty][tx] = true;
        }
      }
    }

    // ---- Spawn ----
    const spawnCell = toCell(zone.spawn.x, zone.spawn.y);
    if (!inBounds(spawnCell.tx, spawnCell.ty)) {
      err('issue.spawn.out');
    } else if (blocked[spawnCell.ty][spawnCell.tx]) {
      err('issue.spawn.blocked');
    }

    // ---- Doors ----
    const seenDoorIds = new Set<string>();
    for (const door of zone.doors) {
      if (seenDoorIds.has(door.id)) {
        err('issue.door.dupe', { id: door.id });
      }
      seenDoorIds.add(door.id);

      if (door.leadsToZoneId && !zoneIds.includes(door.leadsToZoneId)) {
        err('issue.door.unknownZone', { zone: door.leadsToZoneId });
      }

      const c = toCell(door.position.x, door.position.y);
      if (!inBounds(c.tx, c.ty)) {
        err('issue.door.out', { id: door.id });
      } else if (blocked[c.ty][c.tx]) {
        // A door inside a wall cannot be reached nor interacted with.
        err('issue.door.blocked', { id: door.id });
      }
    }

    // ---- NPCs ----
    const npcById = new Map(npcs.map((n) => [n.id, n]));
    for (const id of zone.npcs) {
      if (!npcById.has(id)) {
        err('issue.npc.unknown', { id });
      }
      const pos = zone.npcPositions?.[id] ?? npcById.get(id)?.position;
      if (!pos) continue;
      const c = toCell(pos.x, pos.y);
      if (!inBounds(c.tx, c.ty)) {
        err('issue.npc.out', { id });
      }
    }

    // ---- Reachability (BFS from spawn over passable cells) ----
    let reachable: boolean[][] | null = null;
    if (inBounds(spawnCell.tx, spawnCell.ty) && !blocked[spawnCell.ty][spawnCell.tx]) {
      reachable = LevelValidator._flood(blocked, spawnCell.tx, spawnCell.ty);
    }

    const isReachableNear = (wx: number, wy: number): boolean => {
      if (!reachable) return false;
      const c = toCell(wx, wy);
      // Own cell or any 4-neighbour — interaction happens by proximity.
      const candidates = [
        [c.tx, c.ty],
        [c.tx - 1, c.ty], [c.tx + 1, c.ty], [c.tx, c.ty - 1], [c.tx, c.ty + 1],
      ];
      return candidates.some(([tx, ty]) =>
        inBounds(tx, ty) && reachable![ty][tx] && !blocked[ty][tx],
      );
    };

    if (zone.doors.length === 0) {
      warn('issue.noDoors');
    }
    for (const door of zone.doors) {
      if (reachable && !isReachableNear(door.position.x, door.position.y)) {
        warn('issue.door.unreachable', { id: door.id });
      }
    }

    if (zone.npcs.length === 0) {
      warn('issue.noNpcs');
    }
    for (const id of zone.npcs) {
      const pos = zone.npcPositions?.[id] ?? npcById.get(id)?.position;
      if (!pos || !reachable) continue;
      if (!isReachableNear(pos.x, pos.y)) {
        err('issue.npc.unreachable', { id });
      }
    }

    return LevelValidator._result(issues);
  }

  /** Build the result object (blocked computed from issue levels). */
  private static _result(issues: ValidationIssue[]): ValidationResult {
    return {
      issues,
      blocked: issues.some((i) => i.level === 'error'),
    };
  }

  /** BFS flood-fill over passable cells; returns the reached-cell grid. */
  private static _flood(blocked: boolean[][], sx: number, sy: number): boolean[][] {
    const h = blocked.length;
    const w = blocked[0].length;
    const reached: boolean[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => false));
    const queue: [number, number][] = [[sx, sy]];
    reached[sy][sx] = true;

    while (queue.length > 0) {
      const [tx, ty] = queue.shift()!;
      for (const [nx, ny] of [[tx - 1, ty], [tx + 1, ty], [tx, ty - 1], [tx, ty + 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (reached[ny][nx] || blocked[ny][nx]) continue;
        reached[ny][nx] = true;
        queue.push([nx, ny]);
      }
    }
    return reached;
  }
}
