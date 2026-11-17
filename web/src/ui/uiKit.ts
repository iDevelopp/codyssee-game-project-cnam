import Phaser from 'phaser';
import { COLORS, FONTS } from '@/ui/theme';
import { GameEvents } from '@/systems/GameEvents';

/**
 * uiKit — small shared builders for the codysse.fr in-game identity
 * (CRT/arcade: deep-space panels, hairline borders, pixel-shadow buttons).
 *
 * Mirrors src/landing/landing.css so the game UI reads as the same product
 * as the marketing site. Kept intentionally tiny — these are visual-only
 * helpers, no state, no event wiring; callers own behaviour.
 */

/** Panel corner notch size (mirrors landing `.card::before`, 10x10 css px). */
export const NOTCH_SIZE = 9;

/** Pixel-shadow offset (idle) — mirrors landing `.btn-play` box-shadow depth. */
const SHADOW_OFFSET = 4;

/** Pixel-shadow offset (hover) — landing shrinks the shadow + shifts content toward it. */
const SHADOW_OFFSET_HOVER = 2;

/**
 * Builds the two pieces of a themed panel background: a filled rect with a
 * 1px hairline border, and a small green corner notch (top-left). Both are
 * positioned relative to (0, 0) — callers place them via a parent Container
 * or by offsetting x/y directly.
 *
 * Mirrors the landing `.card` treatment (bg-raised + line border + notch).
 */
export function buildPanelPieces(
  scene: Phaser.Scene,
  w: number,
  h: number,
  alpha = 1,
): { bg: Phaser.GameObjects.Rectangle; notch: Phaser.GameObjects.Rectangle } {
  const bg = scene.add.rectangle(0, 0, w, h, COLORS.panel, alpha).setOrigin(0);
  bg.setStrokeStyle(1, COLORS.line, 1);

  const notch = scene.add.rectangle(0, 0, NOTCH_SIZE, NOTCH_SIZE, COLORS.green).setOrigin(0);

  return { bg, notch };
}

/** Handle returned by {@link createPixelButton} for label updates / cleanup. */
export interface PixelButton {
  /** Root container — position/depth this to place the button. */
  container: Phaser.GameObjects.Container;
  /** The interactive hit rectangle, exposed in case a caller needs extra listeners. */
  hitArea: Phaser.GameObjects.Rectangle;
  /** Replace the visible label text. */
  setLabel: (label: string) => void;
  /** Destroy all display objects owned by this button. */
  destroy: () => void;
}

/**
 * Builds a landing-style "pixel shadow" button: a filled rect with an offset
 * dark shadow rect behind it. Hover = amber fill + shadow shrink (the front
 * layer shifts toward the shadow, exactly like `.btn-play:hover` in
 * src/landing/landing.css).
 *
 * @param scene    - Owning scene.
 * @param x,y      - Center position (container is placed here).
 * @param w,h      - Button size in game px.
 * @param label    - Initial label (French copy — never hardcode, pass from strings.fr.json).
 * @param onClick  - Pointerdown handler.
 * @param fontSize - Pixel-font size in px. Press Start 2P renders large — keep
 *                   this in the 10-16px range so French labels stay readable.
 */
export function createPixelButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  fontSize = 12,
): PixelButton {
  const container = scene.add.container(x, y);

  const shadow = scene.add.rectangle(SHADOW_OFFSET, SHADOW_OFFSET, w, h, COLORS.shadowGreen).setOrigin(0.5);

  // Front layer (bg + label) is a sub-container so hover can shift both as one unit.
  const front = scene.add.container(0, 0);
  const bg = scene.add.rectangle(0, 0, w, h, COLORS.green).setOrigin(0.5);
  const text = scene.add.text(0, 0, label, {
    fontFamily: FONTS.pixel,
    fontSize: `${fontSize}px`,
    color: COLORS.bgCss,
    align: 'center',
  }).setOrigin(0.5);
  front.add([bg, text]);

  container.add([shadow, front]);

  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => {
    bg.setFillStyle(COLORS.amber);
    shadow.setFillStyle(COLORS.shadowAmber);
    front.setPosition(SHADOW_OFFSET - SHADOW_OFFSET_HOVER, SHADOW_OFFSET - SHADOW_OFFSET_HOVER);
  });
  bg.on('pointerout', () => {
    bg.setFillStyle(COLORS.green);
    shadow.setFillStyle(COLORS.shadowGreen);
    front.setPosition(0, 0);
  });
  bg.on('pointerdown', () => {
    // Every pixel button clicks (AudioManager plays sfx.uiClick) — feat/sfx-feedback
    scene.game.events.emit(GameEvents.UI_CLICK);
    onClick();
  });

  return {
    container,
    hitArea: bg,
    setLabel: (l: string) => text.setText(l),
    destroy: () => container.destroy(),
  };
}

/**
 * Draws a subtle full-screen CRT scanline overlay: 1px dark horizontal
 * lines every 3px at low alpha. Mirrors the landing `.crt` treatment.
 * Built once as static Graphics (cheap) — never redrawn per frame.
 * Caller is responsible for depth/scroll-factor/non-interactivity.
 */
export function createScanlineOverlay(
  scene: Phaser.Scene,
  width: number,
  height: number,
  alpha = 0.06,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0x000000, alpha);
  for (let y = 0; y < height; y += 3) {
    g.fillRect(0, y, width, 1);
  }
  return g;
}

/**
 * Proximity highlight for interactables (NPCs, doors): a white outer glow
 * on the sprite (postFX — WebGL only, silently absent on canvas) plus a
 * bouncing "[E]" prompt floating above it, so the player understands E will
 * act on this object.
 *
 * Returns a controller with set(on) — idempotent — and destroy(). The prompt
 * text object lives in the sprite's scene and is destroyed with the scene on
 * zone change; destroy() exists for explicit early cleanup.
 */
export function createInteractHighlight(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  promptOffsetY = -12, // above the sprite's top edge; pass more when a label already sits there
): { set(on: boolean): void; destroy(): void } {
  let active = false;
  let prompt: Phaser.GameObjects.Text | null = null;
  let glow: Phaser.FX.Glow | null = null;

  return {
    set(on: boolean): void {
      if (on === active) return;
      active = on;

      if (on) {
        // Soft white outer glow reads as a pixel outline at low strength.
        glow = sprite.postFX?.addGlow(0xffffff, 3, 0) ?? null;
        if (!prompt) {
          prompt = scene.add
            .text(sprite.x, sprite.y - sprite.displayHeight / 2 + promptOffsetY, '[E]', {
              fontFamily: 'monospace',
              fontSize: '15px',
              fontStyle: 'bold',
              color: '#0b1420',
              backgroundColor: '#e8f6ee',
              padding: { x: 5, y: 2 },
            })
            .setOrigin(0.5, 1)
            .setDepth(8500); // above entities/props, below the ambient tint FX
          scene.tweens.add({
            targets: prompt,
            y: prompt.y - 6,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
        prompt.setVisible(true);
      } else {
        if (glow) {
          sprite.postFX?.remove(glow);
          glow = null;
        }
        prompt?.setVisible(false);
      }
    },
    destroy(): void {
      prompt?.destroy();
      prompt = null;
    },
  };
}
