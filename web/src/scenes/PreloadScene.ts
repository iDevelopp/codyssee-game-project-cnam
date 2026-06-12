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

    // Tile atlas for the zone tilemap
    this.load.image('tiles', `${base}assets/tiles/neo_zero_tiles_and_buildings_01.png`);

    // NPC portraits (placeholder assets from agent-art §4)
    this.load.image('portrait_zelda', `${base}assets/sprites/portraits/zelda_portrait.png`);
    this.load.image('portrait_link', `${base}assets/sprites/portraits/link.png`);
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

    // Queue audio files from the manifest into a second Phaser load pass.
    // We do this here (after ContentLoader resolves) because audio paths come
    // from content/audio.json which is fetched at runtime, not known at preload() time.
    // Graceful: AudioManager.queuePreload() is a no-op if audio.json is missing.
    await this._loadAudioAssets();

    this.scene.start('MainMenuScene');
  }

  /**
   * Second load pass: queue audio files from the manifest and await completion.
   *
   * Phaser's loader can be restarted after its initial run by calling
   * this.load.start() again. We wrap the 'complete' event in a Promise so
   * we can await it cleanly.
   *
   * If no audio files are queued (missing manifest), resolves immediately.
   */
  private _loadAudioAssets(): Promise<void> {
    return new Promise((resolve) => {
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
        console.warn('PreloadScene: one or more audio files failed to load (non-fatal).');
        // We don't resolve here — the 'complete' event still fires after errors.
        // Each individual error is logged by Phaser's loader.
      });

      // Start the load pass.
      this.load.start();
    });
  }
}
