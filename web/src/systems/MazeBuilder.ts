import Phaser from 'phaser';
import type { MazeData } from '@/types/ZoneData';

/** A generated maze: which walls stand around each cell. */
export interface MazeLayout {
  cols: number;
  rows: number;
  /** east[r][c]: wall between (c, r) and (c + 1, r). */
  east: boolean[][];
  /** south[r][c]: wall between (c, r) and (c, r + 1). */
  south: boolean[][];
}

/** Deterministic 32-bit PRNG (mulberry32) seeded from a string. */
function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * MazeBuilder — "perfect" maze (exactly one path between any two cells) with
 * an iterative recursive-backtracker, seeded so a given zone always has the
 * same layout (feat/mazes).
 */
export class MazeBuilder {
  static generate(cols: number, rows: number, seed: string): MazeLayout {
    const rand = seededRandom(seed);
    const east = Array.from({ length: rows }, () => Array<boolean>(cols).fill(true));
    const south = Array.from({ length: rows }, () => Array<boolean>(cols).fill(true));
    const seen = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));

    const stack: Array<[number, number]> = [[0, 0]];
    seen[0][0] = true;
    while (stack.length > 0) {
      const [c, r] = stack[stack.length - 1];
      const next: Array<[number, number]> = [];
      if (c > 0 && !seen[r][c - 1]) next.push([c - 1, r]);
      if (c < cols - 1 && !seen[r][c + 1]) next.push([c + 1, r]);
      if (r > 0 && !seen[r - 1][c]) next.push([c, r - 1]);
      if (r < rows - 1 && !seen[r + 1][c]) next.push([c, r + 1]);
      if (next.length === 0) {
        stack.pop();
        continue;
      }
      const [nc, nr] = next[Math.floor(rand() * next.length)];
      // Knock down the wall between (c, r) and (nc, nr)
      if (nc === c + 1) east[r][c] = false;
      else if (nc === c - 1) east[r][nc] = false;
      else if (nr === r + 1) south[r][c] = false;
      else south[nr][c] = false;
      seen[nr][nc] = true;
      stack.push([nc, nr]);
    }
    return { cols, rows, east, south };
  }

  /**
   * Draw the maze walls as static physics bodies and return them, so the
   * scene can add a collider with the player.
   *
   * @param origin - World position of the maze's top-left corner
   */
  static build(
    scene: Phaser.Scene,
    data: MazeData,
    origin: { x: number; y: number },
  ): Phaser.Physics.Arcade.StaticGroup {
    const layout = MazeBuilder.generate(data.cols, data.rows, data.seed);
    const walls = scene.physics.add.staticGroup();
    const cell = data.cell;
    const t = data.wall;
    const color = 0x3b2a78; // violet walls, distinct from the floor

    const add = (x: number, y: number, w: number, h: number): void => {
      const rect = scene.add.rectangle(x + w / 2, y + h / 2, w, h, color).setStrokeStyle(2, 0x6a4fd0);
      rect.setDepth(y + h);
      walls.add(rect);
    };

    const W = layout.cols * cell;
    const H = layout.rows * cell;
    // Outer border
    add(origin.x - t / 2, origin.y - t / 2, W + t, t);
    add(origin.x - t / 2, origin.y + H - t / 2, W + t, t);
    add(origin.x - t / 2, origin.y - t / 2, t, H + t);
    add(origin.x + W - t / 2, origin.y - t / 2, t, H + t);

    // Inner walls
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const x = origin.x + c * cell;
        const y = origin.y + r * cell;
        if (c < layout.cols - 1 && layout.east[r][c]) add(x + cell - t / 2, y - t / 2, t, cell + t);
        if (r < layout.rows - 1 && layout.south[r][c]) add(x - t / 2, y + cell - t / 2, cell + t, t);
      }
    }
    walls.refresh();
    return walls;
  }
}
