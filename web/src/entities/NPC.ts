import Phaser from 'phaser';
import type { Interactable } from '@/entities/Interactable';
import type { NpcData } from '@/types/NpcData';
import type { CardData } from '@/types/CardData';
import { GameEvents } from '@/systems/GameEvents';
import { InputLock } from '@/systems/InputLock';
import { createInteractHighlight } from '@/ui/uiKit';
import type { EventScope } from '@/systems/EventScope';

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
 * - Rendered as a `npc_<id>` Sprite (phase 2 art overhaul) — same 3×3 32×32
 *   frame layout as player.png (rows: down/up/left, cols: step/idle/step).
 *   Only the idle frames (1/4/7) are used; NPCs never walk.
 * - All text comes from npcContent (npcs.json) — never hardcoded.
 * - Cross-scene communication via game.events (GameEvents constants).
 * - Note: property is named `npcContent` (not `data`) to avoid clashing with
 *   Phaser.GameObjects.Sprite's inherited `data: DataManager` property.
 * - After a wrong answer: state = ShowingResponse, next E reopens deck (awaitingRetry).
 *
 * Unity reference: NPC.cs state machine + NPC.OnCardPicked().
 */
export class NPC extends Phaser.GameObjects.Sprite implements Interactable {
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

  /**
   * Wrong cards picked for this NPC's question. Deliberately NOT reset by
   * cancel(): leaving with ESC and coming back must not count as a first try.
   * Drives the XP reward (first try vs after retry).
   */
  private wrongAttempts = 0;

  private readonly gameScene: Phaser.Scene;

  /** Proximity outline + [E] prompt, driven by InteractionSystem. */
  private highlight: ReturnType<typeof createInteractHighlight>;

  /**
   * @param scene      - Parent scene that owns this NPC (ZoneScene)
   * @param npcContent - NPC content data loaded from npcs.json
   * @param scope      - Zone-lifetime listener scope (cleared on zone exit)
   */
  constructor(scene: Phaser.Scene, npcContent: NpcData, scope: EventScope) {
    // `npc_<id>` sheet: 96×96, 3×3 frames of 32×32 (same layout as player.png).
    // Frame 1 = idle-down — the default resting pose.
    super(scene, npcContent.position.x, npcContent.position.y, `npc_${npcContent.id}`, 1);
    this.setScale(5);

    this.gameScene = scene;
    this.npcContent = npcContent;

    scene.add.existing(this);

    // Top-down y-sort (BUG-09): depth = feet Y (centre + half display height).
    // The player uses the same rule, so it renders in front of this NPC when
    // standing south of it instead of disappearing behind it.
    this.setDepth(npcContent.position.y + this.displayHeight / 2);

    // Subtle idle bob (±2px, ~1.6s, yoyo) — keeps NPCs feeling alive while idle.
    // Tiny enough to not meaningfully perturb interaction-radius math or y-sort.
    scene.tweens.add({
      targets: this,
      y: npcContent.position.y - 2,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Name label floated above the sprite — same depth as the NPC so it stays
    // attached to it in the y-sorted world.
    scene.add.text(npcContent.position.x, npcContent.position.y - this.displayHeight / 2 - 10, npcContent.name, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffaa',
    }).setOrigin(0.5, 1).setDepth(npcContent.position.y + this.displayHeight / 2);

    // Proximity feedback — offset above the name label so they don't overlap.
    this.highlight = createInteractHighlight(scene, this, -34);

    // Listen for deck picks on the global bus — filter to our npcId
    scope.on(
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

  /** Proximity feedback (Interactable) — outline + [E] prompt on/off. */
  setHighlighted(on: boolean): void {
    this.highlight.set(on);
  }

  /**
   * Returns true when the NPC is actively mid-dialogue (not Idle).
   *
   * Unlike canInteract(), this is independent of InputLock — it reflects only
   * the NPC's own state machine. Used by ZoneScene's dialogue-advance loop to
   * identify which NPC is currently active without being confused by the lock
   * that the just-opened dialogue itself set.
   */
  isBusy(): boolean {
    return this.npcState !== 'Idle';
  }

  /**
   * Abort the conversation in progress (ESC). Resets the state machine to Idle
   * without touching `resolved`, so the player can come back later and start
   * the dialogue again from the first line.
   *
   * The caller (ZoneScene) is responsible for asking UIScene to hide the
   * dialogue box / deck panel via GameEvents.DIALOGUE_CANCEL.
   *
   * @returns true if a conversation was actually aborted
   */
  cancel(): boolean {
    if (this.npcState === 'Idle') return false;
    this.npcState = 'Idle';
    this.awaitingRetry = false;
    this.lineIndex = 0;
    this.activeLines = [];
    return true;
  }

  /**
   * Step back one line (← / Backspace during a conversation).
   *  - Reading lines: show the previous line.
   *  - Choosing a card: close the deck and show the question line again;
   *    the next E reopens the deck as usual.
   *
   * @returns true if something was shown again
   */
  back(): boolean {
    if (this.npcState === 'ShowingLines' && this.lineIndex > 0) {
      this.lineIndex--;
      this._showCurrentLine();
      return true;
    }
    if (this.npcState === 'AwaitingAnswer' && this.activeLines.length > 0) {
      this.gameScene.game.events.emit(GameEvents.DECK_CLOSE);
      this.npcState = 'ShowingLines';
      this.lineIndex = this.activeLines.length - 1;
      this._showCurrentLine();
      return true;
    }
    return false;
  }

  /**
   * The question as a short sentence: `question.prompt` when authored,
   * otherwise the last dialogue line (which ends with the question).
   */
  static questionPrompt(npc: NpcData): string {
    return npc.question?.prompt ?? npc.dialogueLines[npc.dialogueLines.length - 1] ?? '';
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

    // Face the player so the conversation reads naturally.
    this._facePlayer();

    // Notify AudioManager to play the interaction SFX (TASK-016).
    this.gameScene.game.events.emit(GameEvents.PLAYER_INTERACT);

    this._showCurrentLine();
  }

  /**
   * Turn to face the player when dialogue starts, picking the idle frame
   * for the dominant axis of the direction from this NPC to the player
   * (down=1, up=4, right=7, left=7+flipX — same frame layout as player.png,
   * whose side frames face right).
   *
   * Reads the player's position via a narrow structural cast on the parent
   * scene (ZoneScene.getPlayerPosition()) rather than importing ZoneScene
   * directly, avoiding a circular import (mirrors _openDeck()'s getAllCards()
   * pattern below).
   */
  private _facePlayer(): void {
    const zoneScene = this.gameScene as Phaser.Scene & {
      getPlayerPosition?(): { x: number; y: number };
    };
    const playerPos = zoneScene.getPlayerPosition?.();
    if (!playerPos) return;

    const dx = playerPos.x - this.x;
    const dy = playerPos.y - this.y;

    if (Math.abs(dy) >= Math.abs(dx)) {
      this.setFlipX(false);
      this.setFrame(dy >= 0 ? 1 : 4); // player below → face down; above → face up
    } else if (dx > 0) {
      this.setFlipX(false);
      this.setFrame(7); // player to the right → side frame faces right natively
    } else {
      this.setFlipX(true);
      this.setFrame(7); // player to the left → mirror the right-facing frame
    }
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
      npcId: this.npcContent.id,
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

    this.gameScene.game.events.emit(GameEvents.QUESTION_ASKED, this.npcContent.id);
    this.gameScene.game.events.emit(GameEvents.DECK_OPEN, {
      cards,
      npcId: this.npcContent.id,
      question: NPC.questionPrompt(this.npcContent),
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
        npcId: this.npcContent.id,
      });

      // Notify ProgressionSystem and DeckSystem
      this.gameScene.game.events.emit(GameEvents.NPC_RESOLVED, this.npcContent.id);
      this.gameScene.game.events.emit('npc-reward-card', {
        npcId: this.npcContent.id,
        cardId: this.npcContent.question.expectedCardId,
        wrongAttempts: this.wrongAttempts,
      });
    } else {
      // Wrong answer — show hint, mark for retry
      this.awaitingRetry = true;
      this.wrongAttempts++;
      this.npcState = 'ShowingResponse';

      // Notify AudioManager to play wrong-answer SFX (TASK-016).
      this.gameScene.game.events.emit(GameEvents.ANSWER_WRONG, { npcId: this.npcContent.id });

      this.gameScene.game.events.emit(GameEvents.DIALOGUE_OPEN, {
        speakerName: this.npcContent.name,
        line: this.npcContent.question.hintLine,
        portrait: this.npcContent.portrait,
        npcId: this.npcContent.id,
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
