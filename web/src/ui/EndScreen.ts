import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';
import { InputLock } from '@/systems/InputLock';
import { GameEvents } from '@/systems/GameEvents';
import { personalize } from '@/systems/Personalize';
import type { NarrativeData } from '@/systems/ContentLoader';
import { COLORS, FONTS } from '@/ui/theme';
import { createPixelButton, type PixelButton } from '@/ui/uiKit';

/**
 * EndScreen — full-screen end-of-zone overlay shown in UIScene.
 *
 * Displays a congratulations message and three buttons:
 * - Rejouer: emit END_REPLAY (ZoneScene restarts the zone, keeping save)
 * - Menu principal: emit END_MENU (navigate to MainMenuScene)
 * - Quitter: same as Menu on web — Application.Quit has no web equivalent (ADR-004)
 *
 * Background: theme deep-space bg at high opacity, matching the landing/CRT identity.
 * Sets InputLock to prevent any game interaction while showing.
 */
export class EndScreen extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly messageText: Phaser.GameObjects.Text;
  /** PixelButton handles created per-show(), destroyed in _clearButtons(). */
  private buttons: PixelButton[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    // Full-screen overlay: theme deep-space background, near-opaque.
    this.bg = scene.add.rectangle(0, 0, 1280, 720, COLORS.bg, 0.97).setOrigin(0);

    // Main congrats message — placed in upper zone, outro slides go below it
    this.messageText = scene.add.text(640, 160, '', {
      fontFamily: FONTS.pixel,
      fontSize: '20px',
      color: COLORS.greenCss,
      align: 'center',
      wordWrap: { width: 800 },
      lineSpacing: 10,
    }).setOrigin(0.5);

    this.add([this.bg, this.messageText]);
    this.setDepth(300);
    this.setVisible(false);

    scene.add.existing(this);
  }

  /**
   * Display the end screen with the given message, outro narration, and buttons.
   *
   * Layout (top → bottom):
   *  1. messageText — congratulations string from strings.fr.json "end.congrats"
   *  2. outro lines — from narrative.json outro[] (TASK-026), shown between message and buttons
   *  3. Action buttons row (Rejouer / Menu / Quitter)
   *  4. "Voir la frise" button (second row)
   *
   * @param message - Congratulations text (from strings.fr.json "end.congrats")
   */
  show(message: string): void {
    this.messageText.setText(message);

    // Remove existing dynamic children (outro texts + buttons) before re-creating
    this._clearButtons();

    const cl = ContentLoader.getInstance();
    const narrative: NarrativeData = cl.getNarrative();

    // ---- Outro narration (TASK-026) ----
    // Shown between the congrats message and the action buttons.
    // Each line is a separate text object for clean layout.
    const outroStartY = 220;
    const outroLineHeight = 32;
    for (let i = 0; i < narrative.outro.length; i++) {
      const outroText = this.scene.add.text(640, outroStartY + i * outroLineHeight, personalize(narrative.outro[i]), {
        fontFamily: FONTS.body,
        fontSize: '16px',
        color: COLORS.inkDimCss,
        align: 'center',
        wordWrap: { width: 860 },
      }).setOrigin(0.5);
      this.add(outroText);
    }

    // ---- Action buttons ----
    // Positioned below the outro block. If outro is empty, buttons sit at a
    // reasonable fixed Y so the layout still works (TASK-026 graceful degradation).
    const buttonY = outroStartY + Math.max(narrative.outro.length, 1) * outroLineHeight + 56;
    const spacing = 220;

    this._makeButton(640 - spacing, buttonY, cl.getString('end.replay'), () => {
      this.hide();
      this.scene.game.events.emit(GameEvents.END_REPLAY);
    });

    this._makeButton(640, buttonY, cl.getString('end.menu'), () => {
      this.hide();
      this.scene.game.events.emit(GameEvents.END_MENU);
    });

    // Quitter → same as menu on web (ADR-004: no Application.Quit on browser)
    this._makeButton(640 + spacing, buttonY, cl.getString('end.quit'), () => {
      this.hide();
      this.scene.game.events.emit(GameEvents.END_MENU);
    });

    // "Voir la frise" — second row, centered. Opens TimelineScene overlay without
    // hiding the EndScreen. Deck is null: game session ended, no live-reveal needed.
    this._makeButton(640, buttonY + 80, cl.getString('timeline.button'), () => {
      this.scene.game.events.emit(GameEvents.TIMELINE_OPEN, null);
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
   * Creates a themed pixel-shadow button (see {@link createPixelButton}) and
   * adds it as a child of this container. Tracked in `this.buttons` so
   * `_clearButtons` can destroy it cleanly (its shadow/front sub-objects
   * aren't direct children of `this`, so `this.list` alone can't find them).
   */
  private _makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const button = createPixelButton(this.scene, x, y, 200, 56, label, onClick, 11);
    this.buttons.push(button);
    this.add(button.container);
  }

  /** Remove and destroy all dynamically created button/outro children. */
  private _clearButtons(): void {
    this.buttons.forEach((b) => b.destroy());
    this.buttons = [];

    // Keep only bg and messageText (first two) — destroy remaining outro texts.
    const toRemove = this.list.slice(2);
    toRemove.forEach((child) => {
      this.remove(child, true);
    });
  }
}
