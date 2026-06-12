import Phaser from 'phaser';
import type { CardData } from '@/types/CardData';
import { InputLock } from '@/systems/InputLock';

/**
 * DeckPanel — full-screen card selection overlay displayed in UIScene.
 *
 * Shows ALL available cards as clickable buttons (name bold, description,
 * usage in italic grey). Matches Unity DeckUI.Open() behaviour:
 * the player picks one card from the entire card base (not just their deck).
 *
 * Sets InputLock while open. Calls onCardPicked callback with the selected
 * CardData, then hides automatically.
 *
 * Unity reference: DeckUI.cs → DeckUI.Open(cartes, onPicked, titre).
 */
export class DeckPanel extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly titleText: Phaser.GameObjects.Text;
  private cardButtons: Phaser.GameObjects.Container[] = [];
  private onCardPicked: ((card: CardData) => void) | null = null;

  // Card button dimensions
  private static readonly CARD_W = 200;
  private static readonly CARD_H = 120;
  private static readonly CARD_GAP = 20;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    // Full-screen dim overlay
    this.bg = scene.add.rectangle(0, 0, 1280, 720, 0x000000, 0.88).setOrigin(0);

    this.titleText = scene.add.text(640, 80, '', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#e0e0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add([this.bg, this.titleText]);
    this.setDepth(200);
    this.setVisible(false);

    scene.add.existing(this);
  }

  /**
   * Show the deck panel with a specific card list.
   *
   * @param cards - Full card array to display as buttons
   * @param title - Panel title string (from strings.fr.json)
   * @param onPicked - Callback invoked with the chosen CardData
   */
  open(cards: CardData[], title: string, onPicked: (card: CardData) => void): void {
    this.onCardPicked = onPicked;
    this.titleText.setText(title);

    // Clear previous buttons
    this._clearButtons();

    // Layout cards horizontally centered, wrapping if needed
    const totalW = cards.length * (DeckPanel.CARD_W + DeckPanel.CARD_GAP) - DeckPanel.CARD_GAP;
    // Center the row; if it overflows 1200px wide we still render (scroll not needed for J1 with 4 cards)
    const startX = Math.max(40, (1280 - totalW) / 2);
    const cardY = 360;

    cards.forEach((card, i) => {
      const cx = startX + i * (DeckPanel.CARD_W + DeckPanel.CARD_GAP);
      const btn = this._makeCardButton(cx, cardY, card);
      this.cardButtons.push(btn);
      this.add(btn);
    });

    this.setVisible(true);
    InputLock.lock();
  }

  /** Hide the panel and release input lock. */
  close(): void {
    this._clearButtons();
    this.setVisible(false);
    InputLock.unlock();
  }

  /** Whether the panel is currently visible. */
  isOpen(): boolean {
    return this.visible;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Builds a clickable card button container.
   *
   * Visual layout matches Unity DeckUI: name bold at top, description
   * in body, usage in italic grey at bottom.
   */
  private _makeCardButton(x: number, y: number, card: CardData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const W = DeckPanel.CARD_W;
    const H = DeckPanel.CARD_H;

    const bg = this.scene.add.rectangle(0, 0, W, H, 0x222244)
      .setInteractive({ useHandCursor: true });

    const nameTxt = this.scene.add.text(0, -H / 2 + 12, card.displayName, {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    const descTxt = this.scene.add.text(0, -H / 2 + 34, card.description, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#cccccc',
      wordWrap: { width: W - 16 },
      align: 'center',
    }).setOrigin(0.5, 0);

    const usageTxt = this.scene.add.text(0, H / 2 - 12, card.usage, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#8888aa',
      fontStyle: 'italic',
    }).setOrigin(0.5, 1);

    bg.on('pointerover', () => bg.setFillStyle(0x3333aa));
    bg.on('pointerout', () => bg.setFillStyle(0x222244));
    bg.on('pointerdown', () => {
      if (this.onCardPicked) {
        this.onCardPicked(card);
      }
    });

    container.add([bg, nameTxt, descTxt, usageTxt]);
    return container;
  }

  /** Destroy and remove all card button children. */
  private _clearButtons(): void {
    this.cardButtons.forEach((b) => {
      this.remove(b, true);
    });
    this.cardButtons = [];
  }
}
