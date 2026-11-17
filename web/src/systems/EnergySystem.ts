import type Phaser from 'phaser';
import { GameEvents } from '@/systems/GameEvents';
import { SaveSystem } from '@/systems/SaveSystem';
import { ContentLoader } from '@/systems/ContentLoader';

/** Payload of GameEvents.ENERGY_CHANGED. */
export interface EnergyChange {
  energy: number;
  max: number;
  /** Signed change (0 for a refresh). */
  delta: number;
}

/**
 * EnergySystem — the coffee-fuelled stamina gauge (feat/energy-coffee).
 *
 * Value lives in SaveSystem (float, clamped to [0, max]); this class applies
 * the rules and broadcasts GameEvents.ENERGY_CHANGED for the HUD. Balance
 * numbers come from content/economy.json → energy.
 */
export class EnergySystem {
  constructor(private readonly events: Phaser.Events.EventEmitter) {}

  private get max(): number {
    return ContentLoader.getInstance().getEconomy().energy.max;
  }

  /** Current energy (a new game starts at economy.energy.start). */
  get(): number {
    const saved = SaveSystem.getInstance().getEnergy();
    return saved ?? ContentLoader.getInstance().getEconomy().energy.start;
  }

  isExhausted(): boolean {
    return this.get() <= 0;
  }

  /** Restore energy (coffee). */
  gain(amount: number): void {
    if (amount > 0) this._apply(amount);
  }

  /** Consume energy (walking, questions, wrong answers). Clamped at 0. */
  drain(amount: number): void {
    if (amount > 0) this._apply(-amount);
  }

  /** Re-broadcast the current value (HUD creation / zone entry). */
  refresh(): void {
    const payload: EnergyChange = { energy: this.get(), max: this.max, delta: 0 };
    this.events.emit(GameEvents.ENERGY_CHANGED, payload);
  }

  private _apply(delta: number): void {
    const before = this.get();
    const after = Math.min(this.max, Math.max(0, before + delta));
    if (after === before) return;
    SaveSystem.getInstance().setEnergy(Math.round(after * 100) / 100);
    const payload: EnergyChange = { energy: after, max: this.max, delta: after - before };
    this.events.emit(GameEvents.ENERGY_CHANGED, payload);
  }
}
