/**
 * GameEvents — shared event name constants for cross-scene communication.
 *
 * Phaser scenes communicate via `this.game.events` (the global event emitter).
 * Using string constants prevents typo-bugs and provides a single authoritative
 * list of events that cross scene boundaries.
 *
 * Scope: only events that cross scene boundaries belong here.
 * Events internal to a single scene stay local.
 */
export const GameEvents = {
  /** Emitted by ProgressionSystem when all quest NPCs have been resolved. */
  ALL_NPCS_HELPED: 'all-npcs-helped',

  /** Emitted by NPC when its question is answered correctly. Payload: npcId string. */
  NPC_RESOLVED: 'npc-resolved',

  /**
   * Emitted when ZoneScene wants UIScene to open the dialogue box.
   * Payload: { speakerName, line, portrait? }
   */
  DIALOGUE_OPEN: 'dialogue-open',

  /**
   * Emitted when UIScene should advance/close the dialogue box.
   * ZoneScene listens and drives the NPC state machine forward.
   */
  DIALOGUE_ADVANCE: 'dialogue-advance',

  /**
   * Emitted to close the dialogue box without advancing.
   * Used for single-line messages (locked door).
   */
  DIALOGUE_CLOSE: 'dialogue-close',

  /**
   * Emitted when ZoneScene wants UIScene to open the deck panel.
   * Payload: { cards: CardData[], npcId: string }
   */
  DECK_OPEN: 'deck-open',

  /**
   * Emitted by DeckPanel when a card is selected.
   * Payload: cardId string
   */
  DECK_CARD_PICKED: 'deck-card-picked',

  /**
   * Emitted when ZoneScene wants UIScene to show the end screen.
   * Payload: { message: string }
   */
  END_SCREEN_SHOW: 'end-screen-show',

  /**
   * Emitted when Rejouer is clicked. ZoneScene handles by restarting itself.
   */
  END_REPLAY: 'end-replay',

  /**
   * Emitted when Menu principal is clicked. Any scene can listen.
   */
  END_MENU: 'end-menu',
} as const;
