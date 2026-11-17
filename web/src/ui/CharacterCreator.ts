import Phaser from 'phaser';
import { InputLock } from '@/systems/InputLock';
import { GameEvents } from '@/systems/GameEvents';
import type { CosmeticStyle, PlayerProfile, Pronoun } from '@/types/Profile';

export interface CreatorLabels {
  title: string;
  nameLabel: string;
  namePlaceholder: string;
  nameError: string;
  pronounLabel: string;
  styleLabel: string;
  confirm: string;
}

/** Allowed name characters: letters (accents too), digits, space, ' and -. */
const NAME_PATTERN = /^[\p{L}\p{N}' -]{1,16}$/u;

/**
 * CharacterCreator — shown once, before the first game (feat/character-creation).
 *
 * Name is typed in a real HTML <input> laid over the canvas (screen readers,
 * accents, IME and mobile keyboards just work); pronoun and outfit style are
 * Phaser buttons with a live sprite preview. Enter or the button confirms.
 *
 * While open, Phaser's global key capture is disabled so letters such as T
 * (captured by the timeline for its toggle) can be typed in the field.
 */
export class CharacterCreator extends Phaser.GameObjects.Container {
  private readonly labels: CreatorLabels;
  private nameInput: HTMLInputElement | null = null;
  private readonly preview: Phaser.GameObjects.Sprite;
  private readonly errorText: Phaser.GameObjects.Text;
  private pronounButtons: Array<{ value: Pronoun; bg: Phaser.GameObjects.Rectangle }> = [];
  private styleButtons: Array<{ style: CosmeticStyle; bg: Phaser.GameObjects.Rectangle }> = [];
  /** Objects created per opening (buttons, labels) — destroyed on rebuild. */
  private dynamicObjs: Phaser.GameObjects.GameObject[] = [];
  private pronoun: Pronoun = 'iel';
  private style: CosmeticStyle | null = null;
  private onDone: ((p: PlayerProfile) => void) | null = null;
  private readonly relayout = (): void => this._placeInput();

  constructor(scene: Phaser.Scene, labels: CreatorLabels) {
    super(scene, 0, 0);
    this.labels = labels;

    const bg = scene.add.rectangle(0, 0, 1280, 720, 0x0b0b18, 1).setOrigin(0);
    const title = scene.add.text(640, 70, labels.title, {
      fontFamily: 'monospace', fontSize: '28px', color: '#e0e0ff', fontStyle: 'bold',
    }).setOrigin(0.5);
    const nameLabel = this._label(360, 170, labels.nameLabel);
    const pronounLabel = this._label(360, 300, labels.pronounLabel);
    const styleLabel = this._label(360, 410, labels.styleLabel);

    this.errorText = scene.add.text(360, 250, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ff7777',
    });

    // Live preview of the character (idle-down frame), right side
    this.preview = scene.add.sprite(980, 330, 'player', 1).setScale(6);
    const frame = scene.add.rectangle(980, 330, 260, 300).setStrokeStyle(2, 0x444477);

    const confirm = scene.add.rectangle(640, 620, 320, 56, 0x4444aa).setInteractive({ useHandCursor: true });
    const confirmText = scene.add.text(640, 620, labels.confirm, {
      fontFamily: 'monospace', fontSize: '22px', color: '#ffffff',
    }).setOrigin(0.5);
    confirm.on('pointerover', () => confirm.setFillStyle(0x5555cc));
    confirm.on('pointerout', () => confirm.setFillStyle(0x4444aa));
    confirm.on('pointerdown', () => this._submit());

    this.add([bg, title, nameLabel, pronounLabel, styleLabel, this.errorText, frame, this.preview, confirm, confirmText]);
    this.setDepth(500);
    this.setVisible(false);
    scene.add.existing(this);
  }

  /**
   * Open the creator.
   * @param styles - Free styles to offer (price 0)
   * @param onDone - Called with the validated profile
   */
  open(styles: CosmeticStyle[], onDone: (p: PlayerProfile) => void): void {
    this.onDone = onDone;
    this.errorText.setText('');
    for (const o of this.dynamicObjs) o.destroy();
    this.dynamicObjs = [];
    this._buildPronouns();
    this._buildStyles(styles);
    this.setVisible(true);
    InputLock.lock();
    this.scene.input.keyboard?.disableGlobalCapture();

    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 16;
    input.placeholder = this.labels.namePlaceholder;
    input.setAttribute('aria-label', this.labels.nameLabel);
    input.autocomplete = 'off';
    input.spellcheck = false;
    Object.assign(input.style, {
      position: 'fixed', zIndex: '10', boxSizing: 'border-box',
      background: '#15152a', color: '#ffffff', border: '2px solid #6666aa',
      borderRadius: '4px', fontFamily: 'monospace', padding: '0 10px', outline: 'none',
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._submit();
    });
    document.body.appendChild(input);
    this.nameInput = input;
    this._placeInput();
    window.addEventListener('resize', this.relayout);
    input.focus();
  }

  close(): void {
    window.removeEventListener('resize', this.relayout);
    this.nameInput?.remove();
    this.nameInput = null;
    this.setVisible(false);
    this.scene.input.keyboard?.enableGlobalCapture();
    InputLock.unlock();
  }

  // ---------------------------------------------------------------------------

  private _label(x: number, y: number, text: string): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, text, { fontFamily: 'monospace', fontSize: '16px', color: '#aaaadd' });
  }

  /** Keep the HTML input over its spot on the (scaled, letterboxed) canvas. */
  private _placeInput(): void {
    if (!this.nameInput) return;
    const rect = this.scene.game.canvas.getBoundingClientRect();
    const k = rect.width / 1280;
    Object.assign(this.nameInput.style, {
      left: `${rect.left + 360 * k}px`,
      top: `${rect.top + 200 * k}px`,
      width: `${400 * k}px`,
      height: `${42 * k}px`,
      fontSize: `${20 * k}px`,
    });
  }

  private _buildPronouns(): void {
    this.pronounButtons = [];
    const values: Pronoun[] = ['il', 'elle', 'iel'];
    values.forEach((value, i) => {
      const x = 360 + i * 130;
      const bg = this.scene.add.rectangle(x, 330, 110, 44, 0x22223a).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const t = this.scene.add.text(x + 55, 352, value, { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' })
        .setOrigin(0.5);
      bg.on('pointerdown', () => {
        this.scene.game.events.emit(GameEvents.UI_CLICK);
        this.pronoun = value;
        this._refreshSelection();
      });
      this.add([bg, t]);
      this.dynamicObjs.push(bg, t);
      this.pronounButtons.push({ value, bg });
    });
    this._refreshSelection();
  }

  private _buildStyles(styles: CosmeticStyle[]): void {
    this.styleButtons = [];
    this.style = styles[0] ?? null;
    styles.forEach((style, i) => {
      const x = 360 + (i % 4) * 130;
      const y = 440 + Math.floor(i / 4) * 60;
      const bg = this.scene.add.rectangle(x, y, 110, 44, 0x22223a).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      const swatch = this.scene.add.rectangle(x + 16, y + 22, 16, 16, style.tint ? Phaser.Display.Color.HexStringToColor(style.tint).color : 0xffffff);
      const t = this.scene.add.text(x + 32, y + 22, style.name, { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff' })
        .setOrigin(0, 0.5);
      bg.on('pointerdown', () => {
        this.scene.game.events.emit(GameEvents.UI_CLICK);
        this.style = style;
        this._refreshSelection();
      });
      this.add([bg, swatch, t]);
      this.dynamicObjs.push(bg, swatch, t);
      this.styleButtons.push({ style, bg });
    });
    this._refreshSelection();
  }

  private _refreshSelection(): void {
    for (const b of this.pronounButtons) {
      b.bg.setStrokeStyle(b.value === this.pronoun ? 3 : 1, b.value === this.pronoun ? 0xffd166 : 0x444466);
    }
    for (const b of this.styleButtons) {
      const on = b.style.id === this.style?.id;
      b.bg.setStrokeStyle(on ? 3 : 1, on ? 0xffd166 : 0x444466);
    }
    if (this.style?.tint) this.preview.setTint(Phaser.Display.Color.HexStringToColor(this.style.tint).color);
    else this.preview.clearTint();
  }

  private _submit(): void {
    const name = (this.nameInput?.value ?? '').trim().replace(/\s+/g, ' ');
    if (!NAME_PATTERN.test(name)) {
      this.errorText.setText(this.labels.nameError);
      this.scene.game.events.emit(GameEvents.ACTION_DENIED);
      this.nameInput?.focus();
      return;
    }
    this.scene.game.events.emit(GameEvents.UI_CLICK);
    const profile: PlayerProfile = { name, pronoun: this.pronoun, styleId: this.style?.id ?? 'classic' };
    const done = this.onDone;
    this.close();
    done?.(profile);
  }
}
