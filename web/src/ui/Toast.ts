import Phaser from 'phaser';

/**
 * Toast — short non-blocking message under the HUD (GameEvents.TOAST).
 * A new toast replaces the current one. Never touches InputLock.
 */
export class Toast {
  private readonly scene: Phaser.Scene;
  private readonly text: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.text = scene.add.text(640, 62, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffffff',
      backgroundColor: '#0a0a18dd',
      padding: { x: 12, y: 6 },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(260).setAlpha(0);
  }

  show(message: string, color = '#ffffff'): void {
    this.tween?.stop();
    this.text.setText(message).setColor(color).setAlpha(1);
    this.tween = this.scene.tweens.add({
      targets: this.text,
      alpha: 0,
      delay: 2200,
      duration: 500,
    });
  }
}
