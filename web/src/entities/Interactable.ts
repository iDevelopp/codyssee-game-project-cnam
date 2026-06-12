/**
 * Interactable — interface for game objects the player can interact with via E.
 *
 * Mirrors Unity's IInteractable interface from PlayerInteraction.cs.
 * Implementors: NPC (TASK-009), Door (TASK-011).
 *
 * Interaction flow:
 *  1. Player presses E.
 *  2. InteractionSystem finds the nearest Interactable within radius 1.5 world-units.
 *  3. If canInteract() === true, calls interact().
 *  4. InputLock is managed by the UI (DialogueBox/DeckPanel), not by interact().
 *
 * See boucle-reference.md §Interaction, systems/InteractionSystem.ts.
 */
export interface Interactable {
  /**
   * Trigger the interaction. Called once per E press when this object is
   * the nearest valid target and canInteract() returns true.
   */
  interact(): void;

  /**
   * Returns whether this object can currently be interacted with.
   *
   * NPCs return false while mid-dialogue or awaiting a deck answer.
   * Doors always return true (locked door message shown inside interact()).
   *
   * Unity reference: IInteractable.CanInteract().
   */
  canInteract(): boolean;

  /**
   * World-space X position used for distance calculation.
   * Typically the Phaser sprite's x property.
   */
  readonly x: number;

  /**
   * World-space Y position used for distance calculation.
   */
  readonly y: number;
}
