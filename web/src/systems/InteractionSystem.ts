import type { Interactable } from '@/entities/Interactable';
import { InputLock } from '@/systems/InputLock';

/**
 * InteractionSystem — detects and triggers interactions on E key press.
 *
 * Unity reference: PlayerInteraction.cs.
 * Radius: 1.5 world-units (boucle-reference.md §Interaction).
 *
 * World-unit to pixel conversion:
 *  The Unity prototype uses a world where 1 unit = 1 Unity pixel = ~1 game unit.
 *  In Phaser we work in pixels directly. The player sprite is rendered at scale ×5
 *  with a 32px cell, so the "sprite unit" is 32px × 5 = 160px.
 *  However, the Unity interaction radius 1.5 refers to 1.5 × tile size (32px = 1 unit),
 *  NOT sprite-scale units. At pixel level, 1 unit = 32 base px, so:
 *    radius_px = 1.5 * 32 * 5 = 240 px
 *  This is documented here so future calibration changes are explicit.
 *
 * The 5× scale factor is included because NPCs and objects are also scaled ×5
 * and their positions are stored in base-pixel space (zone_01.json uses raw pixels).
 * After testing, 240px is used as the interaction radius.
 */
export class InteractionSystem {
  /**
   * Interaction radius in world pixels.
   *  1.5 units × 32 px/unit (tile size) × 5 (scale) = 240 px.
   *  This matches the Unity prototype's 1.5-unit overlap circle at ×5 scale.
   */
  static readonly RADIUS_PX = 240;

  private interactables: Set<Interactable> = new Set();
  private eKey: Phaser.Input.Keyboard.Key;

  /** Whether E was pressed last frame — used for single-press detection. */
  private wasEDown = false;

  /**
   * @param scene - The scene that owns this system (provides keyboard access)
   */
  constructor(scene: Phaser.Scene) {
    // E key — addKey is idempotent for the same scene lifecycle
    this.eKey = scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /** Register an interactable so it can be targeted. */
  register(obj: Interactable): void {
    this.interactables.add(obj);
  }

  /** Unregister an interactable (e.g. when it's destroyed). */
  unregister(obj: Interactable): void {
    this.interactables.delete(obj);
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  /**
   * Must be called every frame from ZoneScene.update().
   *
   * Checks for a single E press (rising edge, not held) and, if the input is
   * not locked by a UI overlay, finds the nearest canInteract() target within
   * RADIUS_PX and calls its interact() method.
   *
   * Returns true if an interaction was triggered this frame. ZoneScene uses
   * this to prevent the same E press from also being consumed by the
   * dialogue-advance branch (single-press = single action guarantee).
   *
   * @param playerX - Player's current world X position
   * @param playerY - Player's current world Y position
   * @returns Whether an interaction was triggered this frame
   */
  update(playerX: number, playerY: number): boolean {
    const eDown = this.eKey.isDown;
    const eJustPressed = eDown && !this.wasEDown;
    this.wasEDown = eDown;

    if (!eJustPressed) return false;

    // Input frozen by UI overlay — ignore E while any overlay is open
    if (InputLock.isLocked()) return false;

    const target = this._findNearest(playerX, playerY);
    if (target) {
      target.interact();
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Returns the nearest Interactable within RADIUS_PX where canInteract() is true.
   * Returns null if none found.
   */
  private _findNearest(px: number, py: number): Interactable | null {
    let nearest: Interactable | null = null;
    let nearestDist = InteractionSystem.RADIUS_PX;

    for (const obj of this.interactables) {
      if (!obj.canInteract()) continue;
      const dx = obj.x - px;
      const dy = obj.y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= nearestDist) {
        nearest = obj;
        nearestDist = dist;
      }
    }

    return nearest;
  }
}
