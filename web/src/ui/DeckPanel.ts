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

    // ---- Responsive grid layout (BUG-06) ----
    // The full card base can reach 19+ cards: a single row overflows 1280px.
    // Pick the column count that maximises card scale while keeping the whole
    // grid inside the panel area (below the title, above the bottom margin).
    const count = cards.length;
    const AREA_W = 1200;                    // 40px side margins
    const AREA_TOP = 130;                   // below the title at y=80
    const AREA_BOTTOM = 690;                // bottom margin
    const AREA_H = AREA_BOTTOM - AREA_TOP;
    const W = DeckPanel.CARD_W;
    const H = DeckPanel.CARD_H;
    const G = DeckPanel.CARD_GAP;

    // Try every column count; keep the one yielding the largest card scale.
    // Strict improvement test keeps the fewest columns on ties (more compact).
    let best = { cols: Math.max(count, 1), scale: 0 };
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      const gridW = cols * W + (cols - 1) * G;
      const gridH = rows * H + (rows - 1) * G;
      const scale = Math.min(1, AREA_W / gridW, AREA_H / gridH);
      if (scale > best.scale + 1e-6) {
        best = { cols, scale };
      }
    }

    const { cols, scale } = best;
    const rows = Math.ceil(count / cols) || 1;
    const cellW = (W + G) * scale;
    const cellH = (H + G) * scale;
    const gridH = rows * cellH - G * scale;
    // Vertically centre the grid inside the panel area
    const top = AREA_TOP + (AREA_H - gridH) / 2;

    cards.forEach((card, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      // Last row may be partial — centre each row independently
      const colsInRow = Math.min(cols, count - row * cols);
      const rowW = colsInRow * cellW - G * scale;
      const startX = (1280 - rowW) / 2 + (W * scale) / 2;

      const cx = startX + col * cellW;
      const cy = top + row * cellH + (H * scale) / 2;
      const btn = this._makeCardButton(cx, cy, card);
      btn.setScale(scale);
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

    // wordWrap keeps long usage strings inside the card instead of bleeding
    // over the neighbouring grid cells (anchored bottom, grows upward).
    const usageTxt = this.scene.add.text(0, H / 2 - 8, card.usage, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#8888aa',
      fontStyle: 'italic',
      wordWrap: { width: W - 16 },
      align: 'center',
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
