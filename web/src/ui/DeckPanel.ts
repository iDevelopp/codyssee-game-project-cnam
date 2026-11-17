import Phaser from 'phaser';
import type { CardData } from '@/types/CardData';
import { InputLock } from '@/systems/InputLock';
import { COLORS, FONTS } from '@/ui/theme';
import { buildPanelPieces } from '@/ui/uiKit';
import { GameEvents } from '@/systems/GameEvents';

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
  /** The NPC's question, under the title — the deck no longer hides it. */
  private readonly subtitleText: Phaser.GameObjects.Text;
  private readonly closeBg: Phaser.GameObjects.Rectangle;
  private readonly closeText: Phaser.GameObjects.Text;
  private cardButtons: Phaser.GameObjects.Container[] = [];
  private onCardPicked: ((card: CardData) => void) | null = null;
  private onClose: (() => void) | null = null;

  // Card button dimensions
  private static readonly CARD_W = 200;
  private static readonly CARD_H = 120;
  private static readonly CARD_GAP = 20;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);

    // Full-screen dim overlay
    this.bg = scene.add.rectangle(0, 0, 1280, 720, COLORS.bg, 0.92).setOrigin(0);

    this.titleText = scene.add.text(640, 80, '', {
      fontFamily: FONTS.pixel,
      fontSize: '16px',
      color: COLORS.amberCss,
      align: 'center',
    }).setOrigin(0.5);

    // Close button (top-right) — mouse equivalent of ESC
    this.closeBg = scene.add.rectangle(1240, 40, 180, 36, 0x333355)
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.closeText = scene.add.text(1240 - 90, 40, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#e0e0ff',
    }).setOrigin(0.5);
    this.closeBg.on('pointerover', () => this.closeBg.setFillStyle(0x4a4a7a));
    this.closeBg.on('pointerout', () => this.closeBg.setFillStyle(0x333355));
    this.closeBg.on('pointerdown', () => {
      scene.game.events.emit(GameEvents.UI_CLICK);
      if (this.onClose) this.onClose();
    });

    this.subtitleText = scene.add.text(640, 116, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffd166',
      align: 'center',
      wordWrap: { width: 1000 },
    }).setOrigin(0.5);

    this.add([this.bg, this.titleText, this.subtitleText, this.closeBg, this.closeText]);
    // Modal: above the zone banner (200-201) and the HUD bar (250)
    this.setDepth(300);
    this.setVisible(false);

    scene.add.existing(this);
  }

  /**
   * Show the deck panel with a specific card list.
   *
   * @param cards - Full card array to display as buttons
   * @param title - Panel title string (from strings.fr.json)
   * @param onPicked - Callback invoked with the chosen CardData
   * @param closeLabel - Label of the close button (from strings.fr.json)
   * @param onClose - Callback invoked when the close button is clicked
   */
  open(
    cards: CardData[],
    title: string,
    onPicked: (card: CardData) => void,
    closeLabel = '',
    onClose: (() => void) | null = null,
  ): void {
    this.onCardPicked = onPicked;
    this.onClose = onClose;
    this.titleText.setText(title);
    this.closeText.setText(closeLabel);
    this.closeBg.setVisible(onClose !== null);
    this.closeText.setVisible(onClose !== null);

    // Clear previous buttons
    this._clearButtons();

    // ---- Responsive grid layout (BUG-06) ----
    // The full card base can reach 19+ cards: a single row overflows 1280px.
    // Pick the column count that maximises card scale while keeping the whole
    // grid inside the panel area (below the title, above the bottom margin).
    const count = cards.length;
    const AREA_W = 1200;                    // 40px side margins
    const AREA_TOP = 145;                   // below the title (y=80) and question (y=116)
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

  /**
   * Show the NPC's question (and a hint line) under the title.
   * Call right after open(); an empty string hides it.
   */
  setSubtitle(text: string): void {
    this.subtitleText.setText(text);
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

    // Panel piece origin is top-left — offset into the container's centred space.
    const { bg, notch } = buildPanelPieces(this.scene, W, H);
    bg.setPosition(-W / 2, -H / 2).setInteractive({ useHandCursor: true });
    notch.setPosition(-W / 2, -H / 2);

    const nameTxt = this.scene.add.text(0, -H / 2 + 12, card.displayName, {
      fontFamily: FONTS.pixel,
      fontSize: '10px',
      color: COLORS.amberCss,
      align: 'center',
      wordWrap: { width: W - 16 },
    }).setOrigin(0.5, 0);

    const descTxt = this.scene.add.text(0, -H / 2 + 38, card.description, {
      fontFamily: FONTS.body,
      fontSize: '11px',
      color: COLORS.inkCss,
      wordWrap: { width: W - 16 },
      align: 'center',
    }).setOrigin(0.5, 0);

    // wordWrap keeps long usage strings inside the card instead of bleeding
    // over the neighbouring grid cells (anchored bottom, grows upward).
    const usageTxt = this.scene.add.text(0, H / 2 - 8, card.usage, {
      fontFamily: FONTS.body,
      fontSize: '10px',
      color: COLORS.inkDimCss,
      fontStyle: 'italic',
      wordWrap: { width: W - 16 },
      align: 'center',
    }).setOrigin(0.5, 1);

    bg.on('pointerover', () => {
      bg.setFillStyle(COLORS.panel);
      bg.setStrokeStyle(1, COLORS.green, 1);
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(COLORS.panel);
      bg.setStrokeStyle(1, COLORS.line, 1);
    });
    bg.on('pointerdown', () => {
      if (this.onCardPicked) {
        this.onCardPicked(card);
      }
    });

    container.add([bg, notch, nameTxt, descTxt, usageTxt]);
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
