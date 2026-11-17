import type Phaser from 'phaser';
import { GameEvents } from '@/systems/GameEvents';
import { SaveSystem } from '@/systems/SaveSystem';

/** Payload of GameEvents.XP_CHANGED. */
export interface XpChange {
  /** New XP total. */
  xp: number;
  /** Signed change applied (0 for a plain refresh). */
  delta: number;
  /** Machine-readable cause, e.g. 'npc-correct', 'zone-cleared', 'refresh'. */
  reason: string;
}

/**
 * XpSystem — single entry point for every XP change.
 *
 * The total lives in SaveSystem (so it survives reloads); this class adds the
 * rules around it (never negative, spend only if affordable) and broadcasts
 * GameEvents.XP_CHANGED so the HUD — and later the shops — stay in sync
 * without polling.
 *
 * Stateless apart from the event bus reference: create one per scene that
 * needs it, they all share the same persisted total.
 */
export class XpSystem {
  constructor(private readonly events: Phaser.Events.EventEmitter) {}

  /** Current XP total. */
  get(): number {
    return SaveSystem.getInstance().getXp();
  }

  /**
   * Add XP (positive amounts only).
   *
   * @param amount - XP to add; ignored if ≤ 0
   * @param reason - Cause, forwarded in the event payload
   */
  gain(amount: number, reason: string): void {
    if (amount <= 0) return;
    this._apply(amount, reason);
  }

  /**
   * Remove XP as a penalty. The total is clamped at 0, so the player can
   * never go into debt.
   *
   * @param amount - XP to remove; ignored if ≤ 0
   * @param reason - Cause, forwarded in the event payload
   * @returns XP actually removed (may be less than `amount` near 0)
   */
  lose(amount: number, reason: string): number {
    if (amount <= 0) return 0;
    const removed = Math.min(amount, this.get());
    if (removed > 0) this._apply(-removed, reason);
    return removed;
  }

  /**
   * Pay for something (hint, skin…). Fails without side effect when the
   * player cannot afford it.
   *
   * @returns true if the XP was deducted
   */
  spend(amount: number, reason: string): boolean {
    if (amount < 0 || this.get() < amount) return false;
    if (amount > 0) this._apply(-amount, reason);
    return true;
  }

  /** Re-broadcast the current total (e.g. when the HUD is (re)created). */
  refresh(): void {
    const payload: XpChange = { xp: this.get(), delta: 0, reason: 'refresh' };
    this.events.emit(GameEvents.XP_CHANGED, payload);
  }

  private _apply(delta: number, reason: string): void {
    const save = SaveSystem.getInstance();
    save.setXp(save.getXp() + delta);
    const payload: XpChange = { xp: save.getXp(), delta, reason };
    this.events.emit(GameEvents.XP_CHANGED, payload);
  }
}
