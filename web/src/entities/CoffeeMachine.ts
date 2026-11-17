import Phaser from 'phaser';
import type { Interactable } from '@/entities/Interactable';
import type { PropData } from '@/types/ZoneData';
import { ContentLoader } from '@/systems/ContentLoader';
import { GameEvents } from '@/systems/GameEvents';
import { InputLock } from '@/systems/InputLock';
import type { EnergySystem } from '@/systems/EnergySystem';

/**
 * CoffeeMachine — restores energy on E (feat/energy-coffee).
 *
 * Placed from zone JSON `props` entries with `"type": "coffee"`.
 * Non-blocking: drinking shows a toast, never a dialogue, so the player
 * keeps moving. Each machine has a cooldown (economy.energy.coffeeCooldownSec)
 * to stop coffee from being an infinite, free refill.
 *
 * Visual placeholder: brown box + ☕, like the other rectangle placeholders.
 */
export class CoffeeMachine extends Phaser.GameObjects.Rectangle implements Interactable {
  private readonly gameScene: Phaser.Scene;
  private readonly energy: EnergySystem;
  private readonly label: Phaser.GameObjects.Text;
  /** Scene time (ms) before which the machine refuses to serve. */
  private readyAt = 0;

  constructor(scene: Phaser.Scene, prop: PropData, energy: EnergySystem) {
    super(scene, prop.position.x, prop.position.y, 72, 96, 0x6b4226);
    this.gameScene = scene;
    this.energy = energy;
    this.setStrokeStyle(3, 0x3b2414);
    this.setDepth(prop.position.y + 48);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    scene.add.text(prop.position.x, prop.position.y - 6, '☕', { fontSize: '40px' })
      .setOrigin(0.5)
      .setDepth(prop.position.y + 49);

    this.label = scene.add.text(prop.position.x, prop.position.y - 58, ContentLoader.getInstance().getString('coffee.label'), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffd8a8',
    }).setOrigin(0.5, 1).setDepth(prop.position.y + 49);
  }

  canInteract(): boolean {
    return !InputLock.isLocked();
  }

  interact(): void {
    const cl = ContentLoader.getInstance();
    const { energy } = cl.getEconomy();
    const now = this.gameScene.time.now;

    if (now < this.readyAt) {
      const wait = Math.ceil((this.readyAt - now) / 1000);
      this.gameScene.game.events.emit(GameEvents.ACTION_DENIED);
      this.gameScene.game.events.emit(GameEvents.TOAST, {
        text: cl.getString('coffee.cooldown').replace('{s}', String(wait)),
        color: '#ffd8a8',
      });
      return;
    }

    if (this.energy.get() >= energy.max) {
      this.gameScene.game.events.emit(GameEvents.TOAST, { text: cl.getString('coffee.full'), color: '#ffd8a8' });
      return;
    }

    this.readyAt = now + energy.coffeeCooldownSec * 1000;
    this.energy.gain(energy.coffeeGain);
    this.gameScene.game.events.emit(GameEvents.COFFEE_DRUNK);
    this.gameScene.game.events.emit(GameEvents.TOAST, {
      text: cl.getString('coffee.drunk').replace('{n}', String(energy.coffeeGain)),
      color: '#66ff66',
    });

    // Visual: machine dims while it reheats
    this.setAlpha(0.55);
    this.label.setAlpha(0.55);
    this.gameScene.time.delayedCall(energy.coffeeCooldownSec * 1000, () => {
      if (!this.active) return;
      this.setAlpha(1);
      this.label.setAlpha(1);
    });
  }
}
