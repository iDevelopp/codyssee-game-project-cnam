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
 *
 * Zone-scoped counting (BUG-03):
 *   The global save stores helped NPC ids across all zones. To avoid counting
 *   zone_01 NPCs toward zone_02's questNPCCount, this system only counts ids
 *   that belong to the CURRENT zone's quest NPC set. The set is passed at
 *   construction time and used as a whitelist in both restoreResolved() and
 *   the runtime NPC_RESOLVED handler.
 */
export class ProgressionSystem {
  /** Total number of quest NPCs in the current zone. */
  private readonly questNPCCount: number;

  /**
   * The ids of all quest NPCs that belong to the CURRENT zone.
   * Acts as a whitelist: only ids in this set are counted toward completion.
   * Prevents cross-zone contamination when the global save contains ids from
   * previously visited zones.
   */
  private readonly zoneQuestNpcIds: Set<string>;

  /** Set of resolved NPC ids FOR THE CURRENT ZONE (prevents double-counting). */
  private readonly resolvedIds: Set<string> = new Set();

  /** True once ALL_NPCS_HELPED has been emitted — prevents re-emission. */
  private allHelpedEmitted = false;

  private readonly gameEvents: Phaser.Events.EventEmitter;

  /**
   * @param gameEvents       - The Phaser game-level event emitter (scene.game.events)
   * @param questNPCCount    - Number of NPCs with a question in this zone
   * @param zoneQuestNpcIds  - Set of NPC ids that belong to this zone's quest NPCs.
   *                           Only ids present in this set are counted toward completion.
   */
  constructor(
    gameEvents: Phaser.Events.EventEmitter,
    questNPCCount: number,
    zoneQuestNpcIds: Set<string>,
  ) {
    this.gameEvents = gameEvents;
    this.questNPCCount = questNPCCount;
    this.zoneQuestNpcIds = zoneQuestNpcIds;

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
   * Only ids that belong to the current zone's quest NPC set are counted.
   * This prevents cross-zone save data (e.g. zone_01 helped ids) from
   * triggering ALL_NPCS_HELPED for a different zone whose questNPCCount
   * happens to equal the number of helped ids from prior zones (BUG-03).
   *
   * @param resolvedNpcIds - Array of npcIds already resolved in a previous session
   *                         (global — may include ids from other zones)
   */
  restoreResolved(resolvedNpcIds: string[]): void {
    for (const id of resolvedNpcIds) {
      // Only count ids that belong to this zone's quest NPCs.
      if (this.zoneQuestNpcIds.has(id)) {
        this.resolvedIds.add(id);
      }
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
   * Only counts the resolution if the npcId belongs to the current zone's
   * quest NPC set — prevents NPCs from other zones (e.g. carried over via
   * a re-emitted event) from advancing this zone's counter (BUG-03).
   *
   * Unity reference: GameManager.HandleNPCResolved() — NPCsHelped++; check >= questNPCCount.
   */
  private _onNpcResolved(npcId: string): void {
    // Guard: only count NPCs that belong to this zone.
    if (!this.zoneQuestNpcIds.has(npcId)) return;
    if (this.resolvedIds.has(npcId)) return; // guard: duplicate event
    this.resolvedIds.add(npcId);

    if (this.resolvedIds.size >= this.questNPCCount && !this.allHelpedEmitted) {
      this.allHelpedEmitted = true;
      this.gameEvents.emit(GameEvents.ALL_NPCS_HELPED);
    }
  }
}
