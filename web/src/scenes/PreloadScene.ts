import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';

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

    this.scene.start('MainMenuScene');
  }
}
