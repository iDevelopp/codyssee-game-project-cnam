import Phaser from 'phaser';

/**
 * BootScene — first scene in the Phaser lifecycle.
 *
 * Keeps boot minimal: just shows a brief background and immediately
 * transitions to PreloadScene where assets and content are loaded.
 * Separating Boot from Preload lets us show a progress bar in Preload
 * without a blank frame race condition.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    // Immediately hand off to PreloadScene — all heavy loading happens there.
    this.scene.start('PreloadScene');
  }
}
