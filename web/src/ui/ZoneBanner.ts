import Phaser from 'phaser';

/**
 * ZoneBanner — non-blocking fade-in/fade-out text banner for zone entry.
 *
 * Displays zoneIntros[zoneId] lines from narrative.json as a brief
 * semi-transparent overlay at the top of the screen.
 *
 * Non-blocking: the player can move immediately; InputLock is NOT set.
 * The banner fades in, holds for a fixed duration, then fades out.
 * If a new banner is triggered while one is showing, it replaces it.
 *
 * Lines are shown one after another with a brief delay between them,
 * then the whole group fades out together after the last line.
 */
export class ZoneBanner {
  private readonly scene: Phaser.Scene;
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const { width } = scene.scale;

    // Semi-opaque strip across the top third
    this.bg = scene.add
      .rectangle(width / 2, 0, width, 180, 0x000814, 0.75)
      .setOrigin(0.5, 0)
      .setDepth(200)
      .setAlpha(0);

    scene.add.existing(this.bg);
  }

  /**
   * Show a sequence of lines as the zone-entry banner.
   * Non-blocking — does not set InputLock.
   *
   * @param lines  - Text lines from narrative.json zoneIntros[zoneId].
   *                 Pass [] to skip (banner does nothing).
   */
  show(lines: string[]): void {
    if (lines.length === 0) return;

    // Cancel any running banner before starting a new one
    this._cancel();

    const { width } = this.scene.scale;
    const lineHeight = 30;
    const startY = 28;

    // Create text objects for each line, stacked vertically
    for (let i = 0; i < lines.length; i++) {
      const t = this.scene.add.text(width / 2, startY + i * lineHeight, lines[i], {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#c0c0e8',
        align: 'center',
        wordWrap: { width: width * 0.8 },
      }).setOrigin(0.5, 0).setDepth(201).setAlpha(0);
      this.texts.push(t);
    }

    // Fade the background strip in
    const bgFadeIn = this.scene.tweens.add({
      targets: this.bg,
      alpha: 0.75,
      duration: 300,
      ease: 'Linear',
    });
    this.tweens.push(bgFadeIn);

    // Stagger-fade each line in
    for (let i = 0; i < this.texts.length; i++) {
      const textIn = this.scene.tweens.add({
        targets: this.texts[i],
        alpha: 1,
        duration: 300,
        ease: 'Linear',
        delay: i * 180,
      });
      this.tweens.push(textIn);
    }

    // After all lines shown + a hold period, fade everything out
    const holdMs = 1400 + lines.length * 600;
    const totalDelay = (lines.length - 1) * 180 + 300 + holdMs;

    const fadeOut = this.scene.tweens.add({
      targets: [this.bg, ...this.texts],
      alpha: 0,
      duration: 500,
      ease: 'Linear',
      delay: totalDelay,
      onComplete: () => {
        this._destroyTexts();
      },
    });
    this.tweens.push(fadeOut);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /** Cancel any in-progress banner and clean up its objects. */
  private _cancel(): void {
    for (const tween of this.tweens) {
      tween.stop();
    }
    this.tweens = [];
    this._destroyTexts();
    this.bg.setAlpha(0);
  }

  /** Destroy all dynamically created text objects. */
  private _destroyTexts(): void {
    for (const t of this.texts) {
      t.destroy();
    }
    this.texts.length = 0;
  }
}
