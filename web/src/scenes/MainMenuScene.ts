import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';
import { AudioManager } from '@/systems/AudioManager';
import { SaveSystem } from '@/systems/SaveSystem';

/**
 * MainMenuScene — title screen with Jouer and Quitter buttons.
 *
 * Button labels come from strings.fr.json so they never appear hardcoded
 * in engine code (ADR-002). "Quitter" maps to MainMenuScene itself on web
 * because Application.Quit has no web equivalent (ADR-004).
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const cl = ContentLoader.getInstance();

    // ---- Audio init ----
    // SaveSystem must be loaded before AudioManager.init() so saved volume/mute
    // are available. PreloadScene does not call save.load() — that happens in
    // ZoneScene — so we do a lightweight load here just for audio prefs.
    // If already loaded (e.g. Rejouer path), this is idempotent (reuses cache).
    SaveSystem.getInstance().load();

    // Initialize AudioManager: creates sound objects and binds GameEvents.
    // Must happen after PreloadScene has loaded audio files into the cache.
    AudioManager.getInstance().init(this);

    // Request ambient music. Because this runs in create() (not a user gesture),
    // the browser AudioContext may be suspended. AudioManager will defer the
    // actual play() until 'unlocked' fires on the first pointer/key event.
    AudioManager.getInstance().startAmbient();

    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Title — from strings.fr.json so it is never hardcoded in engine
    this.add.text(width / 2, height * 0.28, cl.getString('menu.title'), {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#e0e0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Tagline from strings
    this.add.text(width / 2, height * 0.42, cl.getString('menu.tagline'), {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#9999bb',
    }).setOrigin(0.5);

    // Jouer button
    this._makeButton(width / 2, height * 0.58, cl.getString('menu.play'), 0x4444aa, () => {
      // Start the zone and launch the persistent UI overlay in parallel
      this.scene.start('ZoneScene');
      this.scene.launch('UIScene');
    });

    // Quitter button — on web, returns to main menu (ADR-004; no Application.Quit)
    // Shown for parity with Unity but effectively a no-op from this scene.
    this._makeButton(width / 2, height * 0.70, cl.getString('menu.quit'), 0x333355, () => {
      // Reload the page on web as the closest equivalent to quitting
      window.location.reload();
    });
  }

  /**
   * Creates a styled clickable button with hover feedback.
   *
   * @param x - Center X
   * @param y - Center Y
   * @param label - Button text
   * @param color - Fill colour (hex number)
   * @param onClick - Callback invoked on pointer down
   */
  private _makeButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void,
  ): void {
    const bg = this.add.rectangle(x, y, 280, 52, color)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#e0e0ff',
    }).setOrigin(0.5);

    bg.on('pointerover', () => bg.setFillStyle(color + 0x222222));
    bg.on('pointerout', () => bg.setFillStyle(color));
    bg.on('pointerdown', onClick);

    // Keep text above background in render order
    text.setDepth(1);
  }
}
