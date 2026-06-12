import Phaser from 'phaser';

/**
 * BootScene — minimal placeholder scene that confirms Phaser boots correctly.
 *
 * Renders a solid background and centred text.
 * No game logic, no assets. Will be replaced by PreloadScene + MainMenuScene
 * once assets and content are in place (agent-art / agent-moteur).
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Deep indigo background — placeholder, not final art
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Centred boot text — French game strings per conventions
    this.add
      .text(width / 2, height / 2, 'Codyssey — démarrage…', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#e0e0ff',
      })
      .setOrigin(0.5);

    // Small version watermark bottom-right
    this.add
      .text(width - 8, height - 8, 'v0.1.0 — scaffold', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#555577',
      })
      .setOrigin(1, 1);
  }
}
