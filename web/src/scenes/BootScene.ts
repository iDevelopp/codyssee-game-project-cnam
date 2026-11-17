import Phaser from 'phaser';
import { FONTS } from '@/ui/theme';

/** Max time to wait for web fonts before giving up and using the monospace fallback. */
const FONT_LOAD_TIMEOUT_MS = 2000;

/**
 * BootScene — first scene in the Phaser lifecycle.
 *
 * Keeps boot minimal: awaits the two theme web fonts (Press Start 2P /
 * IBM Plex Mono, loaded via the Google Fonts link in play/index.html) so
 * every later scene's `FONTS.pixel` / `FONTS.body` text renders in the
 * intended typeface on first paint instead of flashing system-font then
 * swapping. Then hands off to PreloadScene where assets/content load.
 *
 * Never blocks the game: if fonts are slow or offline, a timeout guard
 * lets boot proceed anyway — FONTS.* strings already declare `monospace`
 * as the CSS fallback, so gameplay is never stuck on a font.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    void this._awaitFontsThenPreload();
  }

  /**
   * Race `document.fonts.load()` for both theme fonts against a timeout.
   * Resolves either way — this never rejects the scene transition.
   */
  private async _awaitFontsThenPreload(): Promise<void> {
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load(`16px ${FONTS.pixel}`),
          document.fonts.load(`16px ${FONTS.body}`),
        ]),
        new Promise((resolve) => setTimeout(resolve, FONT_LOAD_TIMEOUT_MS)),
      ]);
    } catch (err) {
      // document.fonts can throw/reject in some browsers (e.g. unsupported
      // font-face descriptors) — non-fatal, the CSS fallback still applies.
      console.warn('BootScene: font load failed, using monospace fallback', err);
    }

    this.scene.start('PreloadScene');
  }
}
