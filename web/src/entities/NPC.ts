import Phaser from 'phaser';
import type { Interactable } from '@/entities/Interactable';
import type { NpcData } from '@/types/NpcData';
import type { CardData } from '@/types/CardData';
import { GameEvents } from '@/systems/GameEvents';
import { InputLock } from '@/systems/InputLock';

/**
 * NPC state machine values.
 *
 * Unity reference: NPC.cs state enum.
 *  Idle → ShowingLines → AwaitingAnswer → ShowingResponse → Idle
 */
type NpcState =
  | 'Idle'
  | 'ShowingLines'    // Displaying dialogue lines one by one
  | 'AwaitingAnswer'  // Deck is open, waiting for card selection
  | 'ShowingResponse';// Displaying thanks or hint line

/**
 * NPC entity — non-player character with dialogue and optional question.
 *
 * Implements Interactable so InteractionSystem can trigger it on E.
 *
 * Design decisions:
 * - Rendered as a coloured Rectangle placeholder (agent-art replaces later).
 * - All text comes from npcContent (npcs.json) — never hardcoded.
 * - Cross-scene communication via game.events (GameEvents constants).
 * - Note: property is named `npcContent` (not `data`) to avoid clashing with
 *   Phaser.GameObjects.Rectangle's inherited `data: DataManager` property.
 * - After a wrong answer: state = ShowingResponse, next E reopens deck (awaitingRetry).
 *
 * Unity reference: NPC.cs state machine + NPC.OnCardPicked().
 */
export class NPC extends Phaser.GameObjects.Rectangle implements Interactable {
  /** NPC content data from npcs.json. Named npcContent to avoid Phaser's `data` property clash. */
  readonly npcContent: NpcData;

  private npcState: NpcState = 'Idle';

  /** Current index into the active dialogue lines array. */
  private lineIndex = 0;

  /** Which line array is currently being shown (dialogueLines or resolvedLines). */
  private activeLines: string[] = [];

  /** True once the question has been answered correctly. */
  private resolved = false;

  /**
   * True after a wrong answer — next E (ShowingResponse → interact) should
   * reopen the deck instead of ending the dialogue.
   * Unity: hintLine shown → ShowingResponse → E → back to AwaitingAnswer.
   */
  private awaitingRetry = false;

  private readonly gameScene: Phaser.Scene;

  /**
   * @param scene      - Parent scene that owns this NPC (ZoneScene)
   * @param npcContent - NPC content data loaded from npcs.json
   */
  constructor(scene: Phaser.Scene, npcContent: NpcData) {
    // Visual placeholder: 32×48 game-px. Phaser Rectangle origin = centre.
    // setScale(5) below makes it 160×240 display pixels.
    super(scene, npcContent.position.x, npcContent.position.y, 32, 48, 0xffcc00);
    this.setScale(5);

    this.gameScene = scene;
    this.npcContent = npcContent;

    // Rectangle extends GameObject — add to scene display list
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);

    // Name label floated above the sprite
    scene.add.text(npcContent.position.x, npcContent.position.y - 48 * 5 / 2 - 10, npcContent.name, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffaa',
    }).setOrigin(0.5, 1);

    // Listen for deck picks on the global bus — filter to our npcId
    scene.game.events.on(
      GameEvents.DECK_CARD_PICKED,
      (payload: { cardId: string; npcId: string }) => {
        if (payload.npcId === this.npcContent.id) {
          this._onCardPicked(payload.cardId);
        }
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Interactable interface
  // ---------------------------------------------------------------------------

  /**
   * Called by InteractionSystem on E press when this NPC is the nearest target.
   *
   * Routes through the state machine:
   *  - Idle → start dialogue
   *  - ShowingLines → advance to next line
   *  - ShowingResponse → close dialogue (or reopen deck if awaitingRetry)
   */
  interact(): void {
    switch (this.npcState) {
      case 'Idle':
        this._beginDialogue();
        break;

      case 'ShowingLines':
        this._advance();
        break;

      case 'ShowingResponse':
        if (this.awaitingRetry) {
          // Wrong answer — close hint and reopen deck
          this._closeDialogueDisplay();
          this._openDeck();
        } else {
          // Thanks line acknowledged — return to idle
          this._endDialogue();
        }
        break;

      case 'AwaitingAnswer':
        // Deck is open — E handled by DeckPanel, not interact()
        break;
    }
  }

  /**
   * Returns false when the NPC is busy (mid-dialogue or awaiting deck answer).
   *
   * Unity: NPC.CanInteract() = false when state != Idle.
   * We also check InputLock to prevent interaction while any UI overlay is open.
   */
  canInteract(): boolean {
    return this.npcState === 'Idle' && !InputLock.isLocked();
  }

  /** Current resolved state (read by ProgressionSystem and SaveSystem). */
  isResolved(): boolean {
    return this.resolved;
  }

  // ---------------------------------------------------------------------------
  // Save/restore (TASK-012)
  // ---------------------------------------------------------------------------

  /**
   * Restore NPC to resolved state from a saved game.
   * Does NOT emit progression events — save restore is idempotent.
   */
  restoreResolved(): void {
    this.resolved = true;
    this.npcState = 'Idle'; // stays idle, shows resolvedLines on next interact
  }

  // ---------------------------------------------------------------------------
  // Private — state machine
  // ---------------------------------------------------------------------------

  /** Start a dialogue sequence: choose correct lines array, show first line. */
  private _beginDialogue(): void {
    if (this.resolved) {
      // Resolved NPC: prefer resolvedLines, fall back to dialogueLines
      this.activeLines = this.npcContent.resolvedLines.length > 0
        ? this.npcContent.resolvedLines
        : this.npcContent.dialogueLines;
    } else {
      this.activeLines = this.npcContent.dialogueLines;
    }

    this.lineIndex = 0;
    this.npcState = 'ShowingLines';
    this._showCurrentLine();
  }

  /** Advance to the next line or trigger end-of-dialogue action. */
  private _advance(): void {
    this.lineIndex++;

    if (this.lineIndex < this.activeLines.length) {
      this._showCurrentLine();
    } else {
      // Past the last line
      if (!this.resolved && this.npcContent.question) {
        // Unresolved with question: close text and open deck
        this._closeDialogueDisplay();
        this._openDeck();
      } else {
        // No question, or resolved → close normally
        this._endDialogue();
      }
    }
  }

  /** Emit event to UIScene to display the current active line. */
  private _showCurrentLine(): void {
    this.gameScene.game.events.emit(GameEvents.DIALOGUE_OPEN, {
      speakerName: this.npcContent.name,
      line: this.activeLines[this.lineIndex],
      portrait: this.npcContent.portrait,
    });
  }

  /**
   * Emit event to open the DeckPanel with all available cards.
   * Unity: DeckUI.Open(allCards, onPicked, title) — passes the full card base.
   */
  private _openDeck(): void {
    this.npcState = 'AwaitingAnswer';

    // ZoneScene exposes getAllCards() for the full card catalog
    const zoneScene = this.gameScene as Phaser.Scene & { getAllCards(): CardData[] };
    const cards = zoneScene.getAllCards ? zoneScene.getAllCards() : [];

    this.gameScene.game.events.emit(GameEvents.DECK_OPEN, {
      cards,
      npcId: this.npcContent.id,
    });
  }

  /**
   * Handle the card the player picked from DeckPanel.
   * Fires when DECK_CARD_PICKED arrives for this NPC's id.
   *
   * Unity reference: NPC.OnCardPicked().
   */
  private _onCardPicked(cardId: string): void {
    if (!this.npcContent.question) return;

    if (cardId === this.npcContent.question.expectedCardId) {
      // Correct answer
      this.resolved = true;
      this.awaitingRetry = false;
      this.npcState = 'ShowingResponse';

      this.gameScene.game.events.emit(GameEvents.DIALOGUE_OPEN, {
        speakerName: this.npcContent.name,
        line: this.npcContent.question.thanksLine,
        portrait: this.npcContent.portrait,
      });

      // Notify ProgressionSystem and DeckSystem
      this.gameScene.game.events.emit(GameEvents.NPC_RESOLVED, this.npcContent.id);
      this.gameScene.game.events.emit('npc-reward-card', {
        npcId: this.npcContent.id,
        cardId: this.npcContent.question.expectedCardId,
      });
    } else {
      // Wrong answer — show hint, mark for retry
      this.awaitingRetry = true;
      this.npcState = 'ShowingResponse';

      this.gameScene.game.events.emit(GameEvents.DIALOGUE_OPEN, {
        speakerName: this.npcContent.name,
        line: this.npcContent.question.hintLine,
        portrait: this.npcContent.portrait,
      });
    }
  }

  /** Close dialogue display and fully reset to Idle. */
  private _endDialogue(): void {
    this._closeDialogueDisplay();
    this.npcState = 'Idle';
    this.awaitingRetry = false;
    this.lineIndex = 0;
    this.activeLines = [];
  }

  /** Emit the close event to UIScene without changing NPC state. */
  private _closeDialogueDisplay(): void {
    this.gameScene.game.events.emit(GameEvents.DIALOGUE_CLOSE);
  }
}
