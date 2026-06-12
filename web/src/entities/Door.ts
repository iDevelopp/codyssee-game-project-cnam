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

    // "EXIT" label above the door
    scene.add.text(doorData.position.x, doorData.position.y - 64 * 5 / 2 - 10, '🚪 SORTIE', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#cccccc',
    }).setOrigin(0.5, 1);

    // Subscribe to all-helped event to unlock and turn green
    scene.game.events.on(GameEvents.ALL_NPCS_HELPED, () => {
      this._unlock();
    });

    // Listen for DIALOGUE_ADVANCE to close the locked-door single-line message
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
   * - Open → show exit message then EndScreen.
   *
   * Unity reference: Door.OnInteract() — if locked → lockedMessage dialogue; if open → EndScreen.
   */
  interact(): void {
    const cl = ContentLoader.getInstance();

    if (!this.isOpen) {
      // Show locked message — a single-line dialogue with no speaker name
      this.showingLockedMsg = true;
      this.gameScene.game.events.emit(GameEvents.DIALOGUE_OPEN, {
        speakerName: '',
        line: cl.getString(this.doorData.lockedMessageKey),
      });
      // Next E press (via DIALOGUE_ADVANCE listener) will close this
      // We temporarily intercept E in a special way: we listen for DIALOGUE_ADVANCE
      // which UIScene would normally forward from ZoneScene's E key handler.
      // However, our Door canInteract() returns false while locked msg shows (InputLock),
      // so InteractionSystem won't re-fire interact(). The close happens via
      // the DIALOGUE_ADVANCE event emitted by the E-key handler in ZoneScene.
    } else {
      // Show exit message then end screen
      const exitMsg = cl.getString(this.doorData.exitMessageKey);
      this.gameScene.game.events.emit(GameEvents.DIALOGUE_OPEN, {
        speakerName: '',
        line: exitMsg,
      });

      // After a brief delay, swap to end screen
      // (player sees the exit message, then end screen appears on next E)
      this.gameScene.time.delayedCall(200, () => {
        this.gameScene.game.events.emit(GameEvents.DIALOGUE_CLOSE);
        this.gameScene.game.events.emit(GameEvents.END_SCREEN_SHOW, {
          message: ContentLoader.getInstance().getString('end.congrats'),
        });
      });
    }
  }

  /** Open the door: turn green. Called when ALL_NPCS_HELPED fires. */
  private _unlock(): void {
    this.isOpen = true;
    // Open colour: (0.4, 1.0, 0.4) × 255 → #66ff66
    this.setFillStyle(0x66ff66);
  }

  /** Restore open state from save (TASK-012). */
  restoreOpen(): void {
    this._unlock();
  }
}
