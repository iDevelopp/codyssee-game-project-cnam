import Phaser from 'phaser';
import type { Interactable } from '@/entities/Interactable';
import type { DoorData } from '@/types/ZoneData';
import { ContentLoader } from '@/systems/ContentLoader';
import { GameEvents } from '@/systems/GameEvents';
import { InputLock } from '@/systems/InputLock';

/**
 * Door entity — interactable zone exit point.
 *
 * Starts grey (locked) and turns green when all quest NPCs are helped.
 * Always canInteract() = true; locked state is communicated inside interact()
 * via a dialogue message rather than blocking interaction.
 *
 * On open door interaction:
 *   - If doorData.leadsToZoneId is set: emits ZONE_TRANSITION with nextZoneId.
 *     ZoneScene handles the fade-out/fade-in and calls scene.start() (TASK-020).
 *   - If no leadsToZoneId: emits ZONE_TRANSITION with nextZoneId=undefined,
 *     which ZoneScene interprets as "final zone" and shows EndScreen.
 *
 * Colours (Unity Door.cs):
 *  - Locked: (0.3, 0.3, 0.3) → #4d4d4d
 *  - Open:   (0.4, 1.0, 0.4) → #66ff66
 *
 * Unity reference: Door.cs — IInteractable, CanInteract always true,
 * Open() subscribes to OnAllNPCsHelped, E→locked message or EndScreen.
 */
export class Door extends Phaser.GameObjects.Rectangle implements Interactable {
  private isOpen = false;

  /** True after a locked-door message is shown — next E closes the dialogue. */
  private showingLockedMsg = false;

  private readonly doorData: DoorData;
  private readonly gameScene: Phaser.Scene;

  /**
   * @param scene    - Parent scene (ZoneScene)
   * @param doorData - Door configuration from zone JSON
   */
  constructor(scene: Phaser.Scene, doorData: DoorData) {
    // Door visual: 32×64 px at ×5 scale = 160×320 px
    // Locked colour: (0.3, 0.3, 0.3) × 255 ≈ 0x4d4d4d
    super(scene, doorData.position.x, doorData.position.y, 32, 64, 0x4d4d4d);
    this.setScale(5);

    this.doorData = doorData;
    this.gameScene = scene;

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // Exit label above the door — text from strings.fr.json so it is never hardcoded
    const cl = ContentLoader.getInstance();
    scene.add.text(
      doorData.position.x,
      doorData.position.y - 64 * 5 / 2 - 10,
      cl.getString('door.exitLabel'),
      {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#cccccc',
      }
    ).setOrigin(0.5, 1);

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

  /** Open the door: turn green. Called when ALL_NPCS_HELPED fires. */
  private _unlock(): void {
    this.isOpen = true;
    // Open colour: (0.4, 1.0, 0.4) × 255 → #66ff66
    this.setFillStyle(0x66ff66);

    // Notify AudioManager to play door SFX (TASK-016).
    this.gameScene.game.events.emit(GameEvents.DOOR_OPEN, { doorId: this.doorData.id });
  }

  /** Restore open state from save (TASK-012). */
  restoreOpen(): void {
    this._unlock();
  }
}
