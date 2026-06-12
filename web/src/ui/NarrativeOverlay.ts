import Phaser from 'phaser';
import { InputLock } from '@/systems/InputLock';

/**
 * NarrativeOverlay — fullscreen modal that displays a sequence of text slides.
 *
 * Used for the intro sequence (new game only) before zone_01.
 * Each slide is advanced by clicking or pressing any key.
 * The final slide calls the `onComplete` callback when dismissed.
 *
 * Layout: semi-opaque dark background + centered text panel.
 * Advance hint string is passed in via `show()` so no FR string is hardcoded here.
 *
 * This component runs in the scene it is attached to (UIScene or IntroScene).
 * It uses InputLock to block game input while showing (avoids player movement
 * during the intro sequence).
 */
export class NarrativeOverlay extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly slideText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly counterText: Phaser.GameObjects.Text;

  /** Lines to cycle through. */
  private slides: string[] = [];
  /** Index of the currently displayed slide. */
  private currentIndex = 0;
  /** Called when the last slide is dismissed. */
  private onComplete: (() => void) | null = null;
  /** Hint string (e.g. "Clic ou touche pour continuer"). */
  private hintString = '';

  /** Pointer-down listener reference — stored so we can remove it cleanly. */
  private _pointerHandler: (() => void) | null = null;
  /** Keyboard-down listener reference — stored for cleanup. */
  private _keyHandler: ((evt: KeyboardEvent) => void) | null = null;

  constructor(scene: Phaser.Scene) {
    // Position at 0,0 — sized explicitly below
    super(scene, 0, 0);

    const { width, height } = scene.scale;

    // Full-screen semi-opaque background — matches EndScreen dark style (#0a0a14, 0.95)
    this.bg = scene.add.rectangle(width / 2, height / 2, width, height, 0x0a0a14, 0.95).setOrigin(0.5);

    // Main slide text — centered, large, readable
    this.slideText = scene.add.text(width / 2, height * 0.42, '', {
      fontFamily: 'monospace',
      fontSize: '26px',
      color: '#e0e0ff',
      align: 'center',
      wordWrap: { width: width * 0.7 },
    }).setOrigin(0.5);

    // Slide counter (e.g. "2 / 4") — bottom-right corner for orientation
    this.counterText = scene.add.text(width * 0.88, height * 0.88, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#555577',
    }).setOrigin(0.5);

    // Advance hint at the bottom — pulsed alpha for affordance
    this.hintText = scene.add.text(width / 2, height * 0.72, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#7777aa',
    }).setOrigin(0.5);

    this.add([this.bg, this.slideText, this.counterText, this.hintText]);
    this.setDepth(500); // above EndScreen (300), UIScene, everything
    this.setVisible(false);

    scene.add.existing(this);
  }

  /**
   * Show the overlay with the given slides.
   *
   * @param slides     - Array of text strings, one per slide.
   * @param hint       - "Press any key / click to continue" string from strings.fr.json.
   * @param onComplete - Callback fired when the last slide is dismissed.
   */
  show(slides: string[], hint: string, onComplete: () => void): void {
    if (slides.length === 0) {
      // Nothing to show — fire callback immediately
      onComplete();
      return;
    }

    this.slides = slides;
    this.currentIndex = 0;
    this.hintString = hint;
    this.onComplete = onComplete;

    this._renderSlide();
    this.setVisible(true);
    InputLock.lock();

    // Bind advance handlers
    this._pointerHandler = () => this._advance();
    this._keyHandler = () => this._advance();

    this.scene.input.on('pointerdown', this._pointerHandler);
    // Use native DOM keydown so we intercept all keys without conflicting with Phaser keyboard
    window.addEventListener('keydown', this._keyHandler);
  }

  /** Hide the overlay and clean up listeners. */
  hide(): void {
    this.setVisible(false);
    this._cleanup();
    InputLock.unlock();
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /** Advance to the next slide or fire onComplete on the last one. */
  private _advance(): void {
    this.currentIndex++;
    if (this.currentIndex >= this.slides.length) {
      // All slides shown — fire completion
      const cb = this.onComplete;
      this.hide();
      if (cb) cb();
    } else {
      this._renderSlide();
    }
  }

  /** Update slide text and counter for currentIndex. */
  private _renderSlide(): void {
    this.slideText.setText(this.slides[this.currentIndex]);
    this.counterText.setText(`${this.currentIndex + 1} / ${this.slides.length}`);
    this.hintText.setText(this.hintString);
  }

  /** Remove pointer and key listeners. */
  private _cleanup(): void {
    if (this._pointerHandler) {
      this.scene.input.off('pointerdown', this._pointerHandler);
      this._pointerHandler = null;
    }
    if (this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }
}
