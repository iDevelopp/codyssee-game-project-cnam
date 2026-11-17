import Phaser from 'phaser';
import type { Interactable } from '@/entities/Interactable';
import type { DoorData } from '@/types/ZoneData';
import { ContentLoader } from '@/systems/ContentLoader';
import { GameEvents } from '@/systems/GameEvents';
import { InputLock } from '@/systems/InputLock';
import { COLORS } from '@/ui/theme';
import { createInteractHighlight } from '@/ui/uiKit';

/**
 * Door entity — interactable zone exit point.
 *
 * Rendered as the `gate` spritesheet (128×96, two 64×96 frames): frame 0 =
 * locked, frame 1 = open. Turns green-glowing when all quest NPCs are
 * helped. Always canInteract() = true; locked state is communicated inside
 * interact() via a dialogue message rather than blocking interaction.
 *
 * On open door interaction:
 *   - If doorData.leadsToZoneId is set: emits ZONE_TRANSITION with nextZoneId.
 *     ZoneScene handles the fade-out/fade-in and calls scene.start() (TASK-020).
 *   - If no leadsToZoneId: emits ZONE_TRANSITION with nextZoneId=undefined,
 *     which ZoneScene interprets as "final zone" and shows EndScreen.
 *
 * Unity reference: Door.cs — IInteractable, CanInteract always true,
 * Open() subscribes to OnAllNPCsHelped, E→locked message or EndScreen.
 */
export class Door extends Phaser.GameObjects.Sprite implements Interactable {
  private isOpen = false;

  /** True after a locked-door message is shown — next E closes the dialogue. */
  private showingLockedMsg = false;

  /** Green glow rectangle behind the gate, pulsed while open. Created lazily on unlock. */
  private glow?: Phaser.GameObjects.Rectangle;

  private readonly doorData: DoorData;
  private readonly gameScene: Phaser.Scene;

  /** Proximity outline + [E] prompt, driven by InteractionSystem. */
  private highlight: ReturnType<typeof createInteractHighlight>;

  /**
   * @param scene    - Parent scene (ZoneScene)
   * @param doorData - Door configuration from zone JSON
   */
  constructor(scene: Phaser.Scene, doorData: DoorData) {
    // `gate` sheet: 64×96 frames. Frame 0 = locked. Display scale ×2.5 → 160×240.
    super(scene, doorData.position.x, doorData.position.y, 'gate', 0);
    this.setScale(2.5);

    this.doorData = doorData;
    this.gameScene = scene;

    scene.add.existing(this);

    // Top-down y-sort, same convention as Player/NPC — keeps the player
    // rendering in front of the gate when standing south of it.
    this.setDepth(doorData.position.y + this.displayHeight / 2);

    // Exit label above the door — text from strings.fr.json so it is never hardcoded
    const cl = ContentLoader.getInstance();
    scene.add.text(
      doorData.position.x,
      doorData.position.y - this.displayHeight / 2 - 10,
      cl.getString('door.exitLabel'),
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#cccccc',
      }
    ).setOrigin(0.5, 1).setDepth(doorData.position.y + this.displayHeight / 2);

    // Proximity feedback — offset above the exit label so they don't overlap.
    this.highlight = createInteractHighlight(scene, this, -34);

    // Subscribe to all-helped event to unlock and turn green.
    // Note: ZoneScene._unbindEvents() removes ALL_NPCS_HELPED listeners on zone
    // change so this handler does not accumulate across transitions.
    scene.game.events.on(GameEvents.ALL_NPCS_HELPED, () => {
      this._unlock();
    });

    // Listen for DIALOGUE_ADVANCE to close the locked-door single-line message.
    // Note: ZoneScene._unbindEvents() removes DIALOGUE_ADVANCE listeners on zone
    // change so this handler does not accumulate across transitions.
    scene.game.events.on(GameEvents.DIALOGUE_ADVANCE, () => {
      if (this.showingLockedMsg) {
        this.showingLockedMsg = false;
        scene.game.events.emit(GameEvents.DIALOGUE_CLOSE);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Interactable interface
  // ---------------------------------------------------------------------------

  /**
   * Always interactable — locked state handled inside interact() via message.
   *
   * Unity reference: Door.CanInteract() always returns true.
   */
  canInteract(): boolean {
    // Not interactable while showing the locked message (E advances the message,
    // not the door) — but we use DIALOGUE_ADVANCE for that, so we return false
    // here while the message is shown to avoid retriggering.
    return !InputLock.isLocked();
  }

  /** Proximity feedback (Interactable) — outline + [E] prompt on/off. */
  setHighlighted(on: boolean): void {
    this.highlight.set(on);
  }

  /**
   * E pressed on door:
   * - Locked → show locked message via DialogueBox (one E to dismiss).
   * - Open → brief exit message then ZONE_TRANSITION.
   *   ZoneScene handles the actual transition: fade + scene.start() for non-final
   *   zones, or GAME_COMPLETE → EndScreen for the final zone.
   *
   * Unity reference: Door.OnInteract() — if locked → lockedMessage dialogue; if open → EndScreen.
   */
  interact(): void {
    const cl = ContentLoader.getInstance();

    if (!this.isOpen) {
      // Show locked message — a single-line dialogue with no speaker name
      this.showingLockedMsg = true;

      // Notify AudioManager that an interaction occurred (TASK-016).
      this.gameScene.game.events.emit(GameEvents.PLAYER_INTERACT);

      this.gameScene.game.events.emit(GameEvents.DIALOGUE_OPEN, {
        speakerName: '',
        line: cl.getString(this.doorData.lockedMessageKey),
      });
    } else {
      // Show brief exit message then trigger zone transition
      const exitMsg = cl.getString(this.doorData.exitMessageKey);
      this.gameScene.game.events.emit(GameEvents.DIALOGUE_OPEN, {
        speakerName: '',
        line: exitMsg,
      });

      // After a brief delay, close dialogue and emit ZONE_TRANSITION.
      // ZoneScene decides what happens next based on nextZoneId presence.
      this.gameScene.time.delayedCall(200, () => {
        this.gameScene.game.events.emit(GameEvents.DIALOGUE_CLOSE);
        this.gameScene.game.events.emit(GameEvents.ZONE_TRANSITION, {
          nextZoneId: this.doorData.leadsToZoneId,
        });
      });
    }
  }

  /** Open the door: switch to the open frame and start a green glow pulse. */
  private _unlock(): void {
    this.isOpen = true;
    this.setFrame(1); // 1 = open

    if (!this.glow) {
      this.glow = this.gameScene.add.rectangle(
        this.x,
        this.y,
        this.displayWidth,
        this.displayHeight,
        COLORS.green,
        0.2,
      );
      this.glow.setDepth(this.depth - 1);
      this.gameScene.tweens.add({
        targets: this.glow,
        alpha: { from: 0.12, to: 0.4 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Notify AudioManager to play door SFX (TASK-016).
    this.gameScene.game.events.emit(GameEvents.DOOR_OPEN, { doorId: this.doorData.id });
  }

  /** Restore open state from save (TASK-012). */
  restoreOpen(): void {
    this._unlock();
  }
}
