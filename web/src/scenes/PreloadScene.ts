import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';
import { AudioManager } from '@/systems/AudioManager';

/**
 * PreloadScene — loads all assets and game content before gameplay starts.
 *
 * Why do both here: Phaser's loader is async-event-driven (queue+start+complete),
 * while ContentLoader uses fetch(). By awaiting ContentLoader first then starting
 * Phaser's load queue, we guarantee MainMenuScene has all data and all assets
 * before any gameplay scene is created. No fetch during gameplay = no jank.
 *
 * Two-phase load pattern (phase 2 art overhaul):
 *  Phase 1 (preload()): static assets whose keys are known ahead of time
 *    (player, tiles, props atlas, gate). Phaser's loader starts automatically
 *    after preload() returns.
 *  Phase 2 (create() → _loadContentThenMenu()): ContentLoader.load() fetches
 *    npcs.json — only then do we know the NPC ids, so `npc_<id>` spritesheets
 *    and `portrait_<id>` images are queued in a SECOND Phaser load pass
 *    (this.load.start() can be called again after the first pass completes).
 *    Audio (content/audio.json) is queued in the same second pass since it is
 *    also content-driven. No NPC id is ever hardcoded here (ADR-002).
 *
 * Asset paths use import.meta.env.BASE_URL prefix so Vite resolves them
 * correctly in both dev (/) and production (/codyssee/) builds (ADR-004).
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  /** Show a simple loading bar before assets are queued. */
  preload(): void {
    const { width, height } = this.scale;
    const base = import.meta.env.BASE_URL;

    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Progress bar visuals
    const barBg = this.add.rectangle(width / 2, height / 2 + 40, 400, 20, 0x333355);
    const bar = this.add.rectangle(width / 2 - 200, height / 2 + 40, 0, 18, 0x8888ff);
    bar.setOrigin(0, 0.5);

    // Loading label: intentionally hardcoded here because ContentLoader has not
    // resolved yet — this text is the bootstrap indicator shown while content
    // is being fetched. It cannot come from strings.fr.json at this point.
    this.add.text(width / 2, height / 2, 'Chargement…', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#e0e0ff',
    }).setOrigin(0.5);

    // Keep the rectangle reference alive via closure — update on progress events
    this.load.on('progress', (value: number) => {
      bar.setSize(400 * value, 18);
    });

    // Suppress unused var warning — barBg is visual only, kept for display
    void barBg;

    // -----------------------------------------------------------------------
    // Spritesheets — pixel-art (nearest) enforced globally by pixelArt:true
    // -----------------------------------------------------------------------

    // Player: 96×96 px, 3 cols × 3 rows of 32×32 frames (02-assets.md §1)
    this.load.spritesheet('player', `${base}assets/sprites/player.png`, {
      frameWidth: 32,
      frameHeight: 32,
    });

    // Tile atlas for the zone tilemap (10×10 grid of 32×32 tiles, 02-assets.md §2)
    this.load.image('tiles', `${base}assets/tiles/neo_zero_tiles_and_buildings_01.png`);

    // Props atlas — ZoneScene registers a custom texture frame per prop rect
    // from zone.map.props at runtime (02-assets.md §3 / phase2 spec §Zone map schema).
    this.load.image('props_atlas', `${base}assets/sprites/neo_zero_props_and_items_01.png`);

    // Door replacement: 128×96 spritesheet, two 64×96 frames (0 = locked, 1 = open).
    this.load.spritesheet('gate', `${base}assets/sprites/gate.png`, {
      frameWidth: 64,
      frameHeight: 96,
    });

    // NPC `npc_<id>` sheets and `portrait_<id>` images are content-driven (ids come
    // from npcs.json) and are queued in the second load pass — see _queueNpcAssets().
  }

  /**
   * After Phaser's loader finishes, await ContentLoader then go to MainMenu.
   * create() runs synchronously but we immediately launch an async IIFE so we
   * can await without blocking the Phaser event loop.
   */
  create(): void {
    void this._loadContentThenMenu();
  }

  private async _loadContentThenMenu(): Promise<void> {
    try {
      await ContentLoader.getInstance().load();
    } catch (err) {
      // Surface content loading errors visibly in dev; in prod a blank screen is
      // acceptable since this means a broken deploy.
      console.error('PreloadScene: ContentLoader failed', err);
      this.add.text(this.scale.width / 2, this.scale.height / 2 + 80,
        `Erreur de chargement: ${String(err)}`, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ff4444',
          wordWrap: { width: 900 },
        }
      ).setOrigin(0.5);
      return;
    }

    // Queue NPC assets (content-driven ids) and audio files (content-driven
    // manifest) into a second Phaser load pass. Both depend on JSON that only
    // resolved just above, so they could not be queued in preload().
    // Graceful: AudioManager.queuePreload() is a no-op if audio.json is missing.
    await this._loadSecondPhaseAssets();

    this.scene.start('MainMenuScene');
  }

  /**
   * Second load pass: queue `npc_<id>`/`portrait_<id>` assets (ids from
   * npcs.json) and audio files (from audio.json), then await completion.
   *
   * Phaser's loader can be restarted after its initial run by calling
   * this.load.start() again. We wrap the 'complete' event in a Promise so
   * we can await it cleanly.
   *
   * If nothing is queued, resolves immediately.
   */
  private _loadSecondPhaseAssets(): Promise<void> {
    return new Promise((resolve) => {
      this._queueNpcAssets();

      // Queue all audio from the manifest into Phaser's loader.
      AudioManager.getInstance().queuePreload(this);

      // If nothing was queued, the loader won't fire 'complete' — resolve now.
      if (!this.load.isLoading() && this.load.totalToLoad === 0) {
        resolve();
        return;
      }

      // Listen for loader completion — fires once all queued files are done.
      this.load.once('complete', () => {
        resolve();
      });

      // Guard: if loader errors out on all files, still resolve so the game continues.
      this.load.once('loaderror', () => {
        console.warn('PreloadScene: one or more assets failed to load (non-fatal).');
        // We don't resolve here — the 'complete' event still fires after errors.
        // Each individual error is logged by Phaser's loader.
      });

      // Start the load pass.
      this.load.start();
    });
  }

  /**
   * Queue `npc_<id>` spritesheets and `portrait_<id>` images for every NPC
   * declared in npcs.json. Must run after ContentLoader.load() resolves.
   *
   * Zero hardcoded NPC ids (ADR-002) — the id list comes entirely from content.
   */
  private _queueNpcAssets(): void {
    const base = import.meta.env.BASE_URL;
    const npcs = ContentLoader.getInstance().getNpcs();

    for (const npc of npcs) {
      // Sheet layout matches player.png: 96×96, 3×3 frames of 32×32
      // (rows: down/up/left, cols: step/idle/step) — 02-assets.md §1 / phase2 spec §1.
      this.load.spritesheet(`npc_${npc.id}`, `${base}assets/sprites/npcs/${npc.id}.png`, {
        frameWidth: 32,
        frameHeight: 32,
      });
      this.load.image(`portrait_${npc.id}`, `${base}assets/sprites/portraits/${npc.id}.png`);
    }
  }
}
