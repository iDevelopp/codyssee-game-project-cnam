import Phaser from 'phaser';
import type { ZoneData, ZoneProp } from '@/types/ZoneData';

/**
 * Result of a MapBuilder.build() call.
 */
export interface MapBuildResult {
  /** World pixel width (map.width × tileSize × tileScale) — use for camera/physics bounds. */
  worldWidth: number;
  /** World pixel height (map.height × tileSize × tileScale). */
  worldHeight: number;
  /** Ground layer (never collides, renders below everything). */
  groundLayer: Phaser.Tilemaps.TilemapLayer;
  /** The collidable walls layer. */
  wallsLayer: Phaser.Tilemaps.TilemapLayer;
  /** Decor layer (renders above ground, below entities). */
  decorLayer: Phaser.Tilemaps.TilemapLayer;
}

/**
 * MapBuilder — shared zone-map renderer.
 *
 * Builds a zone's tilemap layers (ground/walls/decor) and props from
 * `zone.map`. Extracted from ZoneScene (level editor, phase J6) so the
 * editor and the game render the exact same map data with the exact same
 * code — no visual drift between what is authored and what is played.
 *
 * Layer render order (back to front): ground < walls < decor < entities
 * (entities y-sort via depth = feet Y, always a much larger positive value).
 *
 * When the zone predates the `map` schema (map field absent), the caller is
 * responsible for drawing its own fallback (ZoneScene keeps the placeholder
 * checkerboard; the editor requires map data and never edits a mapless zone).
 */
export class MapBuilder {
  /**
   * Build all map layers and props for a zone.
   *
   * @param scene         - Scene that owns the created GameObjects
   * @param zone          - Zone data (must contain `map`)
   * @param collideTarget - Optional sprite that collides with walls and solid
   *                        props (the player, in gameplay). The editor passes
   *                        no target: nothing moves in edit mode.
   * @returns World dimensions for camera/physics bounds, plus the walls layer
   *          so gameplay can hold a reference if needed.
   */
  static build(
    scene: Phaser.Scene,
    zone: ZoneData,
    collideTarget?: Phaser.GameObjects.Sprite,
  ): MapBuildResult {
    const map = zone.map!;
    if (!map) {
      // Defensive: never called without map data (see class doc). Fail loudly
      // rather than silently rendering an empty map.
      throw new Error(`MapBuilder: zone "${zone.id}" has no map data.`);
    }

    const makeLayer = (data: number[][], depth: number, collides: boolean): Phaser.Tilemaps.TilemapLayer => {
      const tilemap = scene.make.tilemap({ data, tileWidth: map.tileSize, tileHeight: map.tileSize });
      const tileset = tilemap.addTilesetImage('tiles', 'tiles', map.tileSize, map.tileSize)!;
      const layer = tilemap.createLayer(0, tileset, 0, 0)!;
      layer.setScale(map.tileScale).setDepth(depth);
      if (collides) {
        layer.setCollisionByExclusion([-1]);
      }
      return layer;
    };

    // ground renders below everything, never collides.
    const groundLayer = makeLayer(map.ground, -30, false);
    // walls collide with the player; returned so gameplay can hold a reference.
    const wallsLayer = makeLayer(map.walls, -20, true);
    // decor renders above ground, below entities, never collides.
    const decorLayer = makeLayer(map.decor, -10, false);

    for (const prop of map.props) {
      // Props share the tileset's native pixel density → same display scale.
      MapBuilder.spawnProp(scene, prop, map.tileScale, collideTarget);
    }

    return {
      worldWidth: map.width * map.tileSize * map.tileScale,
      worldHeight: map.height * map.tileSize * map.tileScale,
      groundLayer,
      wallsLayer,
      decorLayer,
    };
  }

  /**
   * Spawn one prop from `zone.map.props`: registers a custom texture frame
   * for its source rect in the props atlas, places it at ×tileScale display
   * scale, y-sorts it like an entity (depth = feet Y), and gives it a static
   * physics body + collider against `collideTarget` when `solid` is true.
   *
   * @param prop          - Prop placement data (source rect + world position + solid flag)
   * @param scale         - Display scale (map.tileScale — props share the tileset pixel density)
   * @param collideTarget - Optional sprite that should collide with this prop
   */
  static spawnProp(
    scene: Phaser.Scene,
    prop: ZoneProp,
    scale: number,
    collideTarget?: Phaser.GameObjects.Sprite,
  ): Phaser.GameObjects.Image {
    const [rx, ry, rw, rh] = prop.rect;
    const frameName = `prop_${rx}_${ry}_${rw}_${rh}`;

    const propsTexture = scene.textures.get('props_atlas');
    if (!propsTexture.has(frameName)) {
      propsTexture.add(frameName, 0, rx, ry, rw, rh);
    }

    const img = scene.add.image(prop.x, prop.y, 'props_atlas', frameName);
    img.setScale(scale);
    // y-sort like entities: depth = feet Y (origin is centre, so bottom edge = y + half display height).
    img.setDepth(prop.y + img.displayHeight / 2);

    if (prop.solid) {
      scene.physics.add.existing(img, true);
      if (collideTarget) {
        scene.physics.add.collider(collideTarget, img);
      }
    }

    return img;
  }
}
