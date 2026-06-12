import Phaser from 'phaser';
import { GameEvents } from '@/systems/GameEvents';

/**
 * ProgressionSystem — tracks NPC resolution and emits the all-helped event.
 *
 * Unity reference: GameManager.cs — HandleNPCResolved(), NPCsHelped counter,
 * OnAllNPCsHelped event.
 *
 * Design: listens to NPC_RESOLVED events on the global game bus and counts
 * toward questNPCCount. When all quest NPCs (those with a question) are helped,
 * emits ALL_NPCS_HELPED exactly once.
 *
 * questNPCCount is passed at zone initialisation (from ContentLoader data).
 * Resolved NPC ids are tracked so a save can restore state without re-counting.
 */
export class ProgressionSystem {
  /** Total number of quest NPCs in the current zone. */
  private readonly questNPCCount: number;

  /** Set of resolved NPC ids (prevents double-counting on repeated events). */
  private readonly resolvedIds: Set<string> = new Set();

  /** True once ALL_NPCS_HELPED has been emitted — prevents re-emission. */
  private allHelpedEmitted = false;

  private readonly gameEvents: Phaser.Events.EventEmitter;

  /**
   * @param gameEvents    - The Phaser game-level event emitter (scene.game.events)
   * @param questNPCCount - Number of NPCs with a question in this zone
   */
  constructor(gameEvents: Phaser.Events.EventEmitter, questNPCCount: number) {
    this.gameEvents = gameEvents;
    this.questNPCCount = questNPCCount;

    // Listen for NPC resolution events
    gameEvents.on(GameEvents.NPC_RESOLVED, (npcId: string) => {
      this._onNpcResolved(npcId);
    });
  }

  // ---------------------------------------------------------------------------
  // Save/restore
  // ---------------------------------------------------------------------------

  /**
   * Restore already-resolved NPCs from save data.
   * Does NOT emit ALL_NPCS_HELPED even if count is met — caller (ZoneScene)
   * checks and may emit separately if all were already done before this session.
   *
   * @param resolvedNpcIds - Array of npcIds already resolved in a previous session
   */
  restoreResolved(resolvedNpcIds: string[]): void {
    for (const id of resolvedNpcIds) {
      this.resolvedIds.add(id);
    }

    // If save restores a complete state, emit the event so Door turns green
    if (this.resolvedIds.size >= this.questNPCCount && !this.allHelpedEmitted) {
      this.allHelpedEmitted = true;
      // Use setTimeout to ensure Door is created before the event fires
      setTimeout(() => {
        this.gameEvents.emit(GameEvents.ALL_NPCS_HELPED);
      }, 0);
    }
  }

  /**
   * Returns the set of resolved NPC ids — used by SaveSystem for serialisation.
   */
  getResolvedIds(): string[] {
    return Array.from(this.resolvedIds);
  }

  /** Whether all quest NPCs have been helped. */
  isComplete(): boolean {
    return this.allHelpedEmitted;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Handle a single NPC resolution.
   * Increments count (guarded against duplicates) and checks completion.
   *
   * Unity reference: GameManager.HandleNPCResolved() — NPCsHelped++; check >= questNPCCount.
   */
  private _onNpcResolved(npcId: string): void {
    if (this.resolvedIds.has(npcId)) return; // guard: duplicate event
    this.resolvedIds.add(npcId);

    if (this.resolvedIds.size >= this.questNPCCount && !this.allHelpedEmitted) {
      this.allHelpedEmitted = true;
      this.gameEvents.emit(GameEvents.ALL_NPCS_HELPED);
    }
  }
}
