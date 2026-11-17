import Phaser from 'phaser';
import { InputLock } from '@/systems/InputLock';
import { COLORS, FONTS } from '@/ui/theme';
import { buildPanelPieces } from '@/ui/uiKit';

/** Portrait display size (source art is 160×160, shown at ~96px per design spec). */
const PORTRAIT_SIZE = 96;

/**
 * DialogueBox — scrolling-text overlay displayed in UIScene.
 *
 * Shows one line at a time: speaker name at top, dialogue line in body,
 * optional NPC portrait on the left (texture key `portrait_<npcId>`, shown
 * only if that texture is loaded — engine/content agents own which NPCs
 * ship a portrait, so this degrades gracefully to text-only).
 * Sets InputLock while open so movement and E-interaction are frozen.
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

  /** Left edge x for text when no portrait is shown. */
  private readonly textXNoPortrait: number;
  /** Left edge x for text when a portrait is shown. */
  private readonly textXWithPortrait: number;
  /** Wrap width when no portrait is shown. */
  private readonly wrapWidthNoPortrait: number;
  /** Wrap width when a portrait is shown (narrower — portrait takes the left column). */
  private readonly wrapWidthWithPortrait: number;

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

    // Panel background: theme panel colour + hairline border + corner notch.
    const { bg, notch } = buildPanelPieces(scene, W, H);
    this.bg = bg;

    this.textXNoPortrait = PAD;
    this.textXWithPortrait = PAD + PORTRAIT_SIZE + PAD;
    this.wrapWidthNoPortrait = W - PAD * 2;
    this.wrapWidthWithPortrait = W - PAD * 2 - PORTRAIT_SIZE - PAD;

    this.speakerText = scene.add.text(PAD, PAD, '', {
      fontFamily: FONTS.pixel,
      fontSize: '12px',
      color: COLORS.greenCss,
    });

    this.bodyText = scene.add.text(PAD, PAD + 30, '', {
      fontFamily: FONTS.body,
      fontSize: '16px',
      color: COLORS.inkCss,
      lineSpacing: 4,
      wordWrap: { width: this.wrapWidthNoPortrait },
    });

    // Portrait — rendered left of the text block when a `portrait_<npcId>`
    // texture is loaded for the current speaker.
    this.portraitImage = scene.add
      .image(PAD + PORTRAIT_SIZE / 2, H / 2, '')
      .setVisible(false);
    this.portraitImage.setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE);

    // Hint text at bottom right: "Appuie sur E pour continuer…"
    this.hintText = scene.add.text(W - PAD, H - PAD, '', {
      fontFamily: FONTS.body,
      fontSize: '11px',
      color: COLORS.inkDimCss,
    }).setOrigin(1, 1);

    // Assemble container children — notch drawn last so it sits on top of bg.
    this.add([this.bg, notch, this.portraitImage, this.speakerText, this.bodyText, this.hintText]);

    this.setDepth(100);
    this.setVisible(false);

    scene.add.existing(this);
  }

  /**
   * Display the dialogue box with new content.
   *
   * @param speakerName - Name shown in the header (e.g. NPC name)
   * @param line - The dialogue line to display
   * @param hint - Footer hint text (e.g. "Appuie sur E pour continuer…")
   * @param npcId - NPC content id; used to resolve the `portrait_<npcId>`
   *   texture key. Optional — dialogue without a matching portrait texture
   *   renders text-only (unchanged layout).
   */
  show(speakerName: string, line: string, hint?: string, npcId?: string): void {
    this.speakerText.setText(speakerName);
    this.bodyText.setText(line);
    this.hintText.setText(hint ?? '');

    const portraitKey = npcId ? `portrait_${npcId}` : undefined;
    const showPortrait = !!portraitKey && this.scene.textures.exists(portraitKey);

    if (showPortrait) {
      // setDisplaySize must run AFTER setTexture: it stores a scale factor
      // relative to the current frame, and setTexture swaps the frame size
      // (the constructor call ran against the 32px placeholder → ×3 blow-up).
      this.portraitImage.setTexture(portraitKey!).setDisplaySize(PORTRAIT_SIZE, PORTRAIT_SIZE).setVisible(true);
      this.speakerText.setPosition(this.textXWithPortrait, this.speakerText.y);
      this.bodyText.setPosition(this.textXWithPortrait, this.bodyText.y);
      this.bodyText.setWordWrapWidth(this.wrapWidthWithPortrait);
    } else {
      this.portraitImage.setVisible(false);
      this.speakerText.setPosition(this.textXNoPortrait, this.speakerText.y);
      this.bodyText.setPosition(this.textXNoPortrait, this.bodyText.y);
      this.bodyText.setWordWrapWidth(this.wrapWidthNoPortrait);
    }

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
