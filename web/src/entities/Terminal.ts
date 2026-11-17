import Phaser from 'phaser';
import type { Interactable } from '@/entities/Interactable';
import type { PropData } from '@/types/ZoneData';
import { ContentLoader } from '@/systems/ContentLoader';
import { GameEvents } from '@/systems/GameEvents';
import { InputLock } from '@/systems/InputLock';
import { createInteractHighlight } from '@/ui/uiKit';

/**
 * Terminal — where restored languages are applied (feat/terminal-loop).
 *
 * Loop: help an NPC → its language is restored → that language's line
 * unlocks in the zone terminal → complete every line → the exit opens.
 * Placed from zone JSON `props` with `"type": "terminal"`. E opens the
 * console panel (UIScene); the screen glows green once compiled.
 */
export class Terminal extends Phaser.GameObjects.Rectangle implements Interactable {
  private readonly gameScene: Phaser.Scene;
  private readonly zoneId: string;
  private readonly screen: Phaser.GameObjects.Rectangle;

  /** Proximity outline + [E] prompt, driven by InteractionSystem. */
  private readonly highlight: ReturnType<typeof createInteractHighlight>;

  constructor(scene: Phaser.Scene, prop: PropData, zoneId: string) {
    super(scene, prop.position.x, prop.position.y, 110, 90, 0x2b2f3a);
    this.gameScene = scene;
    this.zoneId = zoneId;
    this.setStrokeStyle(3, 0x11141a);
    this.setDepth(prop.position.y + 45);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    this.screen = scene.add.rectangle(prop.position.x, prop.position.y - 6, 86, 56, 0x0a1a0a)
      .setStrokeStyle(2, 0x2f6f2f)
      .setDepth(prop.position.y + 46);
    scene.add.text(prop.position.x, prop.position.y - 6, '>_', {
      fontFamily: 'monospace', fontSize: '22px', color: '#5dff7a',
    }).setOrigin(0.5).setDepth(prop.position.y + 47);
    scene.add.text(prop.position.x, prop.position.y - 52, ContentLoader.getInstance().getString('terminal.label'), {
      fontFamily: 'monospace', fontSize: '14px', color: '#9dffb0',
    }).setOrigin(0.5, 1).setDepth(prop.position.y + 47);

    this.highlight = createInteractHighlight(scene, this, -30, () => this.promptLabel());
  }

  promptLabel(): string {
    return ContentLoader.getInstance().getString('prompt.terminal');
  }

  /** Proximity feedback (Interactable) — outline + "[E] …" prompt on/off. */
  setHighlighted(on: boolean): void {
    this.highlight.set(on);
  }

  canInteract(): boolean {
    return !InputLock.isLocked();
  }

  interact(): void {
    this.gameScene.game.events.emit(GameEvents.PLAYER_INTERACT);
    this.gameScene.game.events.emit(GameEvents.TERMINAL_OPEN, { zoneId: this.zoneId });
  }

  /** Show the compiled state (bright green screen). */
  setCompiled(compiled: boolean): void {
    this.screen.setFillStyle(compiled ? 0x1d6b2a : 0x0a1a0a);
  }
}
