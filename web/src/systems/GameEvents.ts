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
   * Emitted by ZoneScene after ESC aborted the active NPC/door conversation.
   * UIScene hides the dialogue box AND the deck panel (whichever is open).
   */
  DIALOGUE_CANCEL: 'dialogue-cancel',

  /**
   * Emitted by UI widgets (e.g. the deck panel "close" button) to ask ZoneScene
   * to abort the active conversation — same path as pressing ESC.
   */
  DIALOGUE_CANCEL_REQUEST: 'dialogue-cancel-request',

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

  // ---------------------------------------------------------------------------
  // Audio events (added for TASK-016)
  // ---------------------------------------------------------------------------

  /**
   * Emitted by NPC._beginDialogue() and Door.interact() the moment the player
   * triggers an E interaction that opens a dialogue.
   * AudioManager plays sfx.interact on this event.
   */
  PLAYER_INTERACT: 'player-interact',

  /**
   * Emitted by NPC._onCardPicked() when the player picks the wrong card.
   * AudioManager plays sfx.wrong on this event.
   * Payload: { npcId: string }
   */
  ANSWER_WRONG: 'answer-wrong',

  /**
   * Emitted by Door._unlock() when ALL_NPCS_HELPED causes the door to open.
   * AudioManager plays sfx.door on this event.
   * Payload: { doorId: string }
   */
  DOOR_OPEN: 'door-open',

  // ---------------------------------------------------------------------------
  // Zone navigation events (added for TASK-020)
  // ---------------------------------------------------------------------------

  /**
   * Emitted by ZoneScene when the player interacts with an open exit door.
   * Payload: { nextZoneId: string } — ZoneScene handles the transition.
   */
  ZONE_TRANSITION: 'zone-transition',

  /**
   * Emitted by ZoneScene when there is no nextZoneId (final zone).
   * ZoneScene shows the EndScreen (game complete).
   */
  GAME_COMPLETE: 'game-complete',

  // ---------------------------------------------------------------------------
  // Timeline frieze events (added for TASK-023)
  // ---------------------------------------------------------------------------

  /**
   * Emitted by ZoneScene (T key) or EndScreen button to open the timeline frieze.
   * TimelineScene listens and makes itself visible.
   */
  TIMELINE_OPEN: 'timeline-open',

  /**
   * Emitted by TimelineScene (T key / ESC) to signal the frieze was closed.
   * ZoneScene listens to release InputLock.
   */
  TIMELINE_CLOSE: 'timeline-close',

  // ---------------------------------------------------------------------------
  // Narration events (added for TASK-026)
  // ---------------------------------------------------------------------------

  /**
   * Emitted by MainMenuScene on new game (no currentZoneId in save).
   * UIScene shows the NarrativeOverlay with narrative.json intro[] before
   * starting ZoneScene. Payload: { onComplete: () => void } — UIScene calls
   * the callback when the last slide is dismissed, then ZoneScene is launched.
   */
  INTRO_SHOW: 'intro-show',

  /**
   * Emitted by ZoneScene on each zone entry.
   * UIScene shows the ZoneBanner with zoneIntros[zoneId] (non-blocking fade).
   * Payload: { zoneId: string }
   */
  ZONE_BANNER_SHOW: 'zone-banner-show',

  // ---------------------------------------------------------------------------
  // Progression & XP (feat/xp-progress)
  // ---------------------------------------------------------------------------

  /**
   * Emitted by XpSystem whenever the XP total changes.
   * Payload: XpChange — { xp: number; delta: number; reason: string }
   */
  XP_CHANGED: 'xp-changed',

  /**
   * Emitted by ZoneScene on zone entry and after each NPC is helped.
   * UIScene's HUD redraws the progress bars. Payload: ProgressSnapshot.
   */
  PROGRESS_CHANGED: 'progress-changed',

  // ---------------------------------------------------------------------------
  // Feedback (feat/sfx-feedback)
  // ---------------------------------------------------------------------------

  /** Emitted by any clickable UI button. AudioManager plays sfx.uiClick. */
  UI_CLICK: 'ui-click',

  /**
   * Emitted when the player tries something that is refused (e.g. buying
   * without enough XP). AudioManager plays sfx.denied.
   */
  ACTION_DENIED: 'action-denied',

  // ---------------------------------------------------------------------------
  // Question history (feat/question-history)
  // ---------------------------------------------------------------------------

  /** Emitted by NPC when its question is put to the player. Payload: npcId. */
  QUESTION_ASKED: 'question-asked',

  /**
   * Emitted by NPC when the player steps back from the card selection to
   * re-read the question. UIScene closes the deck panel (no cancel sound).
   */
  DECK_CLOSE: 'deck-close',

  /** Emitted by ZoneScene (J key). Payload: JournalEntry[]. */
  JOURNAL_OPEN: 'journal-open',

  /** Emitted by the journal panel when it closes (J / ESC). */
  JOURNAL_CLOSE: 'journal-close',

  // ---------------------------------------------------------------------------
  // Energy (feat/energy-coffee)
  // ---------------------------------------------------------------------------

  /** Emitted by EnergySystem. Payload: EnergyChange { energy, max, delta }. */
  ENERGY_CHANGED: 'energy-changed',

  /** Emitted by a coffee machine when the player drinks. AudioManager: sfx.coffee. */
  COFFEE_DRUNK: 'coffee-drunk',

  /**
   * Short non-blocking message for the player (UIScene toast).
   * Payload: { text: string; color?: string }
   */
  TOAST: 'toast',

  // ---------------------------------------------------------------------------
  // Character (feat/character-creation)
  // ---------------------------------------------------------------------------

  /**
   * Emitted by MainMenuScene when no character exists yet. UIScene shows the
   * creator, saves the profile, then calls onComplete.
   * Payload: { onComplete: () => void }
   */
  CHARACTER_CREATE: 'character-create',

  // ---------------------------------------------------------------------------
  // Skins shop (feat/skins-shop)
  // ---------------------------------------------------------------------------

  /** Emitted by ZoneScene (B key). UIScene opens the shop. */
  SKIN_SHOP_OPEN: 'skin-shop-open',

  /** Emitted by the shop panel when it closes (B / ESC). */
  SKIN_SHOP_CLOSE: 'skin-shop-close',

  /** Emitted when the equipped style changes. Payload: styleId. ZoneScene re-tints. */
  STYLE_CHANGED: 'style-changed',

  /** Emitted by ZoneScene (V key): toggle dialogue text-to-speech. */
  TTS_TOGGLE: 'tts-toggle',

  // ---------------------------------------------------------------------------
  // Terminal loop (feat/terminal-loop)
  // ---------------------------------------------------------------------------

  /** Emitted by a Terminal on E. Payload: { zoneId: string }. UIScene opens the panel. */
  TERMINAL_OPEN: 'terminal-open',

  /** Emitted by the terminal panel when it closes (ESC). */
  TERMINAL_CLOSE: 'terminal-close',

  /** Emitted by UIScene when a line is completed. Payload: cardId. AudioManager: sfx.correct. */
  TERMINAL_TASK_SOLVED: 'terminal-task-solved',

  /** Emitted by UIScene when every line of the zone's terminal is done. Payload: zoneId. */
  TERMINAL_SOLVED: 'terminal-solved',

  /**
   * Emitted by ZoneScene when the exit may open: all quest NPCs helped AND
   * (no terminal, or terminal solved). Doors listen to this, not to
   * ALL_NPCS_HELPED, since the terminal can hold the door shut.
   */
  ZONE_UNLOCKED: 'zone-unlocked',
} as const;
