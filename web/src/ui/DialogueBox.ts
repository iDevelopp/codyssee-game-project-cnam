import Phaser from 'phaser';
import { InputLock } from '@/systems/InputLock';

/**
 * DialogueBox — scrolling-text overlay displayed in UIScene.
 *
 * Shows one line at a time: speaker name at top, dialogue line in body,
 * optional portrait on the left side. Sets InputLock while open so movement
 * and E-interaction are frozen (Unity: DialogueBox.IsOpen).
 *
 * Lifecycle: show() → visible; hide() → invisible and InputLock released.
 * Caller (UIScene) controls when to hide based on GameEvents.
 */
export class DialogueBox extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly speakerText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly portraitImage: Phaser.GameObjects.Image;
  private readonly hintText: Phaser.GameObjects.Text;

  // Dimensions (logical 1280×720)
  private static readonly W = 900;
  private static readonly H = 200;
  private static readonly PAD = 24;

  constructor(scene: Phaser.Scene) {
    const x = (1280 - DialogueBox.W) / 2;
    const y = 720 - DialogueBox.H - 20;
    super(scene, x, y);

    const W = DialogueBox.W;
    const H = DialogueBox.H;
    const PAD = DialogueBox.PAD;

    // Semi-transparent dark background
    this.bg = scene.add.rectangle(0, 0, W, H, 0x0d0d1a, 0.93).setOrigin(0);
    // Thin accent border
    scene.add.rectangle(0, 0, W, 3, 0x8888cc).setOrigin(0); // top border — added later as child

    this.speakerText = scene.add.text(PAD, PAD, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#aaaaff',
      fontStyle: 'bold',
    });

    this.bodyText = scene.add.text(PAD, PAD + 34, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#e0e0e0',
      wordWrap: { width: W - PAD * 2 - 80 },
    });

    // Portrait — rendered left of body if a portrait key is provided
    this.portraitImage = scene.add.image(W - PAD - 50, H / 2, '').setVisible(false);
    this.portraitImage.setDisplaySize(80, 80);

    // Hint text at bottom right: "Appuie sur E pour continuer…"
    this.hintText = scene.add.text(W - PAD, H - PAD, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#666699',
    }).setOrigin(1, 1);

    // Assemble container children
    this.add([this.bg, this.speakerText, this.bodyText, this.portraitImage, this.hintText]);

    // Border line on top
    const border = scene.add.rectangle(0, 0, W, 3, 0x8888cc).setOrigin(0);
    this.add(border);

    this.setDepth(100);
    this.setVisible(false);

    scene.add.existing(this);
  }

  /**
   * Display the dialogue box with new content.
   *
   * @param speakerName - Name shown in the header (e.g. NPC name)
   * @param line - The dialogue line to display
   * @param portraitKey - Phaser texture key for the portrait; undefined = no portrait
   * @param hint - Footer hint text (e.g. "Appuie sur E pour continuer…")
   */
  show(speakerName: string, line: string, portraitKey?: string, hint?: string): void {
    this.speakerText.setText(speakerName);
    this.bodyText.setText(line);

    if (portraitKey) {
      this.portraitImage.setTexture(portraitKey).setVisible(true);
    } else {
      this.portraitImage.setVisible(false);
    }

    this.hintText.setText(hint ?? '');

    this.setVisible(true);
    InputLock.lock();
  }

  /** Hide the dialogue box and release the input lock. */
  hide(): void {
    this.setVisible(false);
    InputLock.unlock();
  }

  /** Whether the dialogue box is currently visible. */
  isOpen(): boolean {
    return this.visible;
  }
}
