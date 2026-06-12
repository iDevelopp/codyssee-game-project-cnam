/**
 * InputLock — global singleton that tracks whether game input is frozen.
 *
 * Why a singleton instead of a Phaser registry value: scenes access this
 * from different contexts (ZoneScene for movement, UIScene for overlay state).
 * A module-level singleton is simpler and avoids Phaser scene key coupling.
 *
 * Rule: any UI overlay that opens must call lock(); must call unlock() when closed.
 * Movement (MovementSystem) and interaction (InteractionSystem) read isLocked().
 *
 * Unity reference: `DialogueBox.IsOpen || DeckUI.IsOpen || EndScreenUI.IsOpen`
 * (boucle-reference.md §Déplacement).
 */
export class InputLock {
  private static _locked = false;

  /** Freeze game input. Call when any UI overlay opens. */
  static lock(): void {
    InputLock._locked = true;
  }

  /** Unfreeze game input. Call when all UI overlays are closed. */
  static unlock(): void {
    InputLock._locked = false;
  }

  /** Returns true if any UI overlay currently holds the lock. */
  static isLocked(): boolean {
    return InputLock._locked;
  }
}
