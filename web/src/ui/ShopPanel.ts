import Phaser from 'phaser';
import { InputLock } from '@/systems/InputLock';
import { GameEvents } from '@/systems/GameEvents';
import type { CosmeticStyle } from '@/types/Profile';

export interface ShopLabels {
  title: string;
  hint: string;
  equip: string;
  equipped: string;
  /** "Acheter {price} {unit}" */
  buy: string;
  xpUnit: string;
  energyUnit: string;
  /** "★ {xp} XP · ⚡ {energy}" */
  balance: string;
}

/** What the panel needs to draw one item. */
export interface ShopItem {
  style: CosmeticStyle;
  owned: boolean;
  equipped: boolean;
}

/**
 * ShopPanel — outfit shop (B key, feat/skins-shop).
 *
 * Lists every style: owned ones can be equipped, premium ones bought with
 * XP or energy (per item). Hovering an item previews it on the character.
 * Purely visual: UIScene decides what a click does and calls refresh().
 * Closes on B / ESC (own listener) and calls onClose.
 */
export class ShopPanel extends Phaser.GameObjects.Container {
  private readonly labels: ShopLabels;
  private readonly onClose: () => void;
  private readonly preview: Phaser.GameObjects.Sprite;
  private readonly balanceText: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.GameObject[] = [];
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private onAction: ((style: CosmeticStyle) => void) | null = null;
  private equippedTint: string | null = null;

  constructor(scene: Phaser.Scene, labels: ShopLabels, onClose: () => void) {
    super(scene, 0, 0);
    this.labels = labels;
    this.onClose = onClose;

    const bg = scene.add.rectangle(0, 0, 1280, 720, 0x07070f, 0.96).setOrigin(0);
    const title = scene.add.text(640, 50, labels.title, {
      fontFamily: 'monospace', fontSize: '28px', color: '#e0e0ff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.balanceText = scene.add.text(640, 112, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffd166',
    }).setOrigin(0.5);
    const frame = scene.add.rectangle(1030, 380, 300, 380).setStrokeStyle(2, 0x444477);
    this.preview = scene.add.sprite(1030, 380, 'player', 1).setScale(8);
    const hint = scene.add.text(640, 700, labels.hint, {
      fontFamily: 'monospace', fontSize: '13px', color: '#666699',
    }).setOrigin(0.5, 1);

    this.add([bg, title, this.balanceText, frame, this.preview, hint]);
    this.setDepth(300);
    this.setVisible(false);
    scene.add.existing(this);
  }

  /**
   * Open (or redraw) the shop.
   * @param items    - Every style with its owned/equipped state
   * @param balance  - Player XP and energy
   * @param onAction - Click on an item's button: buy or equip
   */
  open(items: ShopItem[], balance: { xp: number; energy: number }, onAction: (style: CosmeticStyle) => void): void {
    this.onAction = onAction;
    this.refresh(items, balance);
    if (this.visible) return;
    this.setVisible(true);
    InputLock.lock();
    this.scene.time.delayedCall(0, () => {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'b') this.close();
      };
      window.addEventListener('keydown', this.keyHandler);
    });
  }

  /** Redraw items and balance (after a purchase or equip). */
  refresh(items: ShopItem[], balance: { xp: number; energy: number }): void {
    for (const r of this.rows) this.remove(r, true);
    this.rows = [];

    this.balanceText.setText(this.labels.balance
      .replace('{xp}', String(balance.xp))
      .replace('{energy}', String(Math.round(balance.energy))));

    const equipped = items.find((i) => i.equipped);
    this.equippedTint = equipped?.style.tint ?? null;
    this._tintPreview(this.equippedTint);

    items.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 80 + col * 390;
      const y = 140 + row * 128;
      const { style } = item;

      const card = this.scene.add.rectangle(x, y, 370, 112, item.equipped ? 0x1c2238 : 0x14142a)
        .setOrigin(0).setStrokeStyle(item.equipped ? 3 : 1, item.equipped ? 0xffd166 : 0x333355)
        .setInteractive();
      card.on('pointerover', () => this._tintPreview(style.tint));
      card.on('pointerout', () => this._tintPreview(this.equippedTint));

      const swatch = this.scene.add.rectangle(x + 36, y + 56, 40, 40,
        style.tint ? Phaser.Display.Color.HexStringToColor(style.tint).color : 0xffffff);
      const name = this.scene.add.text(x + 72, y + 18, style.name, {
        fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
      });

      const unit = style.currency === 'energy' ? this.labels.energyUnit : this.labels.xpUnit;
      const label = item.equipped
        ? this.labels.equipped
        : item.owned ? this.labels.equip
        : this.labels.buy.replace('{price}', String(style.price)).replace('{unit}', unit);
      const btnColor = item.equipped ? 0x2a2a3a : item.owned ? 0x335533 : 0x4444aa;
      const btn = this.scene.add.rectangle(x + 72, y + 64, 270, 34, btnColor).setOrigin(0, 0);
      const btnText = this.scene.add.text(x + 72 + 135, y + 81, label, {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffffff',
      }).setOrigin(0.5);
      if (!item.equipped) {
        btn.setInteractive({ useHandCursor: true });
        btn.on('pointerover', () => { btn.setAlpha(0.8); this._tintPreview(style.tint); });
        btn.on('pointerout', () => btn.setAlpha(1));
        btn.on('pointerdown', () => this.onAction?.(style));
      }

      for (const o of [card, swatch, name, btn, btnText]) {
        this.rows.push(o);
        this.add(o);
      }
    });
  }

  /** Brief red flash on the balance line (purchase refused). */
  flashDenied(): void {
    this.balanceText.setColor('#ff6666');
    this.scene.time.delayedCall(300, () => this.balanceText.setColor('#ffd166'));
  }

  close(): void {
    if (!this.visible) return;
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    this.setVisible(false);
    InputLock.unlock();
    this.scene.game.events.emit(GameEvents.UI_CLICK);
    this.onClose();
  }

  isOpen(): boolean {
    return this.visible;
  }

  private _tintPreview(tint: string | null): void {
    if (tint) this.preview.setTint(Phaser.Display.Color.HexStringToColor(tint).color);
    else this.preview.clearTint();
  }
}
