import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';
import { InputLock } from '@/systems/InputLock';
import { GameEvents } from '@/systems/GameEvents';

/**
 * EndScreen — full-screen end-of-zone overlay shown in UIScene.
 *
 * Displays a congratulations message and three buttons:
 * - Rejouer: emit END_REPLAY (ZoneScene restarts the zone, keeping save)
 * - Menu principal: emit END_MENU (navigate to MainMenuScene)
 * - Quitter: same as Menu on web — Application.Quit has no web equivalent (ADR-004)
 *
 * Background colour matches Unity EndScreenUI: (0.07,0.07,0.12,0.97) ≈ #121220 at 97% opacity.
 * Sets InputLock to prevent any game interaction while showing.
 */
export class EndScreen extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly messageText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    // Full-screen overlay: (0.07, 0.07, 0.12, 0.97) → #121220
    this.bg = scene.add.rectangle(0, 0, 1280, 720, 0x121220, 0.97).setOrigin(0);

    this.messageText = scene.add.text(640, 240, '', {
      fontFamily: 'monospace',
      fontSize: '28px',
      color: '#e0e0ff',
      align: 'center',
      wordWrap: { width: 800 },
    }).setOrigin(0.5);

    this.add([this.bg, this.messageText]);
    this.setDepth(300);
    this.setVisible(false);

    scene.add.existing(this);
  }

  /**
   * Display the end screen with the given message and standard buttons.
   *
   * @param message - Congratulations text (from strings.fr.json "end.congrats")
   */
  show(message: string): void {
    this.messageText.setText(message);

    // Remove existing buttons before re-creating (idempotent show)
    this._clearButtons();

    const cl = ContentLoader.getInstance();
    const buttonY = 430;
    const spacing = 220;

    this._makeButton(640 - spacing, buttonY, cl.getString('end.replay'), 0x2244aa, () => {
      this.hide();
      this.scene.game.events.emit(GameEvents.END_REPLAY);
    });

    this._makeButton(640, buttonY, cl.getString('end.menu'), 0x224422, () => {
      this.hide();
      this.scene.game.events.emit(GameEvents.END_MENU);
    });

    // Quitter → same as menu on web (ADR-004: no Application.Quit on browser)
    this._makeButton(640 + spacing, buttonY, cl.getString('end.quit'), 0x442222, () => {
      this.hide();
      this.scene.game.events.emit(GameEvents.END_MENU);
    });

    this.setVisible(true);
    InputLock.lock();
  }

  /** Hide the end screen and release input lock. */
  hide(): void {
    this._clearButtons();
    this.setVisible(false);
    InputLock.unlock();
  }

  /** Whether the end screen is currently visible. */
  isOpen(): boolean {
    return this.visible;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Creates a styled button and adds it as a child of this container.
   */
  private _makeButton(x: number, y: number, label: string, color: number, onClick: () => void): void {
    const bg = this.scene.add.rectangle(x, y, 180, 50, color)
      .setInteractive({ useHandCursor: true });

    const text = this.scene.add.text(x, y, label, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#e0e0ff',
    }).setOrigin(0.5).setDepth(1);

    bg.on('pointerover', () => bg.setFillStyle(color + 0x222222));
    bg.on('pointerout', () => bg.setFillStyle(color));
    bg.on('pointerdown', onClick);

    this.add([bg, text]);
  }

  /** Remove and destroy all dynamically created button children. */
  private _clearButtons(): void {
    // Keep only bg and messageText (first two) — destroy the rest
    const toRemove = this.list.slice(2);
    toRemove.forEach((child) => {
      this.remove(child, true);
    });
  }
}
