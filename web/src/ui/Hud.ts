import Phaser from 'phaser';
import type { ProgressSnapshot } from '@/types/Progress';

/** Labels shown by the HUD (from strings.fr.json — never hardcoded). */
export interface HudLabels {
  /** Unit after the XP number, e.g. "XP". */
  xp: string;
  /** Word for a zone in the story, e.g. "Strate". */
  strata: string;
  /** Label before the zone NPC counter, e.g. "PNJ aidés". */
  zoneProgress: string;
  /** Label of the whole-game bar, e.g. "Progression". */
  globalProgress: string;
}

/**
 * Hud — permanent top bar during gameplay (UIScene).
 *
 *  ┌──────────────────────────────────────────────────────────────────────┐
 *  │ ★ 150 XP      Zone 2 — Les fondations · PNJ aidés 1/3 ▮▮▯   Progression ▮▮▮▯▯ 27% │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 * Purely visual: fed by UIScene from GameEvents.XP_CHANGED and
 * GameEvents.PROGRESS_CHANGED. Never sets InputLock (non-blocking).
 * XP changes pop a floating "+50 XP" / "-10 XP" under the counter.
 */
export class Hud {
  static readonly HEIGHT = 40;

  private readonly scene: Phaser.Scene;
  private readonly labels: HudLabels;
  private readonly container: Phaser.GameObjects.Container;
  private readonly xpText: Phaser.GameObjects.Text;
  private readonly zoneText: Phaser.GameObjects.Text;
  private readonly energyIcon: Phaser.GameObjects.Text;
  private readonly energyBarFill: Phaser.GameObjects.Rectangle;
  private static readonly ENERGY_BAR_W = 64;
  private readonly zoneBarBg: Phaser.GameObjects.Rectangle;
  private readonly zoneBarFill: Phaser.GameObjects.Rectangle;
  private readonly globalText: Phaser.GameObjects.Text;
  private readonly globalBarFill: Phaser.GameObjects.Rectangle;

  private static readonly ZONE_BAR_W = 90;
  private static readonly GLOBAL_BAR_W = 160;
  private static readonly BAR_H = 10;

  /** Displayed XP value — tweened towards the real total for a count-up effect. */
  private shownXp = 0;
  private xpTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, labels: HudLabels) {
    this.scene = scene;
    this.labels = labels;
    const { width } = scene.scale;
    const H = Hud.HEIGHT;
    const midY = H / 2;

    const bg = scene.add.rectangle(0, 0, width, H, 0x0a0a18, 0.85).setOrigin(0);
    const border = scene.add.rectangle(0, H - 2, width, 2, 0x8888cc, 0.6).setOrigin(0);

    this.xpText = scene.add.text(20, midY, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffd166',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // Energy gauge (feat/energy-coffee): ⚡ + bar, after the XP counter
    this.energyIcon = scene.add.text(140, midY, '⚡', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffd166',
    }).setOrigin(0, 0.5);
    const energyBarBg = scene.add.rectangle(162, midY, Hud.ENERGY_BAR_W, Hud.BAR_H, 0x2a2a44).setOrigin(0, 0.5);
    this.energyBarFill = scene.add.rectangle(162, midY, Hud.ENERGY_BAR_W, Hud.BAR_H, 0xffd166).setOrigin(0, 0.5);

    // Zone label starts after the XP + energy block; its mini bar is placed
    // right after the text in setProgress() (zone names vary in length).
    this.zoneText = scene.add.text(244, midY, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#c0c0e8',
    }).setOrigin(0, 0.5);

    this.zoneBarBg = scene.add.rectangle(0, midY, Hud.ZONE_BAR_W, Hud.BAR_H, 0x2a2a44).setOrigin(0, 0.5);
    this.zoneBarFill = scene.add.rectangle(0, midY, 0, Hud.BAR_H, 0x66ff66).setOrigin(0, 0.5);

    const globalBarX = width - 20 - Hud.GLOBAL_BAR_W;
    this.globalText = scene.add.text(globalBarX - 10, midY, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#c0c0e8',
    }).setOrigin(1, 0.5);
    const globalBarBg = scene.add.rectangle(globalBarX, midY, Hud.GLOBAL_BAR_W, Hud.BAR_H, 0x2a2a44).setOrigin(0, 0.5);
    this.globalBarFill = scene.add.rectangle(globalBarX, midY, 0, Hud.BAR_H, 0x8888ff).setOrigin(0, 0.5);

    this.container = scene.add.container(0, 0, [
      bg, border, this.xpText, this.energyIcon, energyBarBg, this.energyBarFill, this.zoneText,
      this.zoneBarBg, this.zoneBarFill, this.globalText, globalBarBg, this.globalBarFill,
    ]);
    // Above the zone banner (200) so the bar never disappears. The dialogue
    // box sits at the bottom of the screen, so the two never overlap.
    this.container.setDepth(250);

    this._renderXp(0);
  }

  /**
   * Update the XP counter. A positive/negative delta pops a floating label
   * and counts the number up/down; delta 0 just sets the value.
   */
  setXp(xp: number, delta: number): void {
    this.xpTween?.stop();
    if (delta === 0) {
      this.shownXp = xp;
      this._renderXp(xp);
      return;
    }

    const counter = { v: this.shownXp };
    this.xpTween = this.scene.tweens.add({
      targets: counter,
      v: xp,
      duration: 600,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.shownXp = Math.round(counter.v);
        this._renderXp(this.shownXp);
      },
    });

    this._popDelta(delta);
  }

  /** Redraw zone label and both progress bars. */
  setProgress(p: ProgressSnapshot): void {
    // Same vocabulary as the narration: "Strate 2/5 · Les fondations (1950s)"
    const shortName = p.zoneName.replace(/^Zone\s+\d+\s*[—-]\s*/, '');
    this.zoneText.setText(
      `${this.labels.strata} ${p.zoneIndex}/${p.zoneCount} · ${shortName}  ·  ${this.labels.zoneProgress} ${p.zoneHelped}/${p.zoneTotal}`,
    );
    const barX = this.zoneText.x + this.zoneText.width + 12;
    this.zoneBarBg.setX(barX);
    this.zoneBarFill.setX(barX);

    const zoneRatio = p.zoneTotal > 0 ? p.zoneHelped / p.zoneTotal : 1;
    const globalRatio = p.globalTotal > 0 ? p.globalHelped / p.globalTotal : 0;

    this.scene.tweens.add({ targets: this.zoneBarFill, width: Hud.ZONE_BAR_W * zoneRatio, duration: 400 });
    this.scene.tweens.add({ targets: this.globalBarFill, width: Hud.GLOBAL_BAR_W * globalRatio, duration: 400 });

    this.globalText.setText(`${this.labels.globalProgress} ${Math.round(globalRatio * 100)}%`);
  }

  /**
   * Update the energy gauge. Turns orange under `low`, red and blinking at 0.
   */
  setEnergy(energy: number, max: number, low: number): void {
    const ratio = max > 0 ? Math.max(0, Math.min(1, energy / max)) : 0;
    this.energyBarFill.width = Hud.ENERGY_BAR_W * ratio;
    const color = energy <= 0 ? 0xff4444 : energy <= low ? 0xffaa44 : 0xffd166;
    this.energyBarFill.setFillStyle(color);
    this.energyIcon.setColor(energy <= 0 ? '#ff4444' : '#ffd166');
    this.energyIcon.setAlpha(1);
    this.scene.tweens.killTweensOf(this.energyIcon);
    if (energy <= 0) {
      this.scene.tweens.add({ targets: this.energyIcon, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
    }
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  private _renderXp(value: number): void {
    this.xpText.setText(`★ ${value} ${this.labels.xp}`);
  }

  /** Floating "+N XP" (green) or "-N XP" (red) rising from the counter. */
  private _popDelta(delta: number): void {
    const sign = delta > 0 ? '+' : '−';
    const pop = this.scene.add.text(this.xpText.x + this.xpText.width + 12, Hud.HEIGHT / 2, `${sign}${Math.abs(delta)} ${this.labels.xp}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: delta > 0 ? '#66ff66' : '#ff6666',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(260);

    this.scene.tweens.add({
      targets: pop,
      y: pop.y + 40,
      alpha: 0,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => pop.destroy(),
    });
  }
}
