/**
 * Defines the question an NPC poses to the player.
 *
 * An NPC with a question blocks door progression until resolved.
 * If `question` is null the NPC has ambient dialogue only and does
 * not count toward the quest NPC counter (GameManager logic).
 */
export interface NpcQuestion {
  /** CardData.id the player must select to resolve the question. */
  expectedCardId: string;

  /** Line shown after the player gives the correct card. French string. */
  thanksLine: string;

  /**
   * Hint shown after a wrong pick. The deck reopens on the next E press
   * (unlimited retries per gdd/01-boucle-reference.md).
   * French string.
   */
  hintLine: string;
}

/**
 * Represents a non-player character in a zone.
 *
 * The NPC state machine (Idle → ShowingLines → AwaitingAnswer →
 * ShowingResponse → Idle) is implemented in the engine; this data
 * describes the content only.
 *
 * Authored in /content/npcs.json.
 */
export interface NpcData {
  /** Unique identifier, e.g. "npc_alice". Lowercase, no spaces. */
  id: string;

  /** Name displayed in the dialogue box header. French string. */
  name: string;

  /**
   * Optional path to the portrait asset, relative to BASE_URL/assets/.
   * If absent the dialogue box renders without a portrait.
   */
  portrait?: string;

  /**
   * World-space spawn position for this NPC in the zone tilemap.
   * Coordinates are in pixels relative to the tilemap origin.
   */
  position: { x: number; y: number };

  /**
   * Dialogue lines played on first interaction.
   * Last line is the question prompt (per boucle-reference.md §Dialogue).
   * French strings.
   */
  dialogueLines: string[];

  /**
   * Lines played on subsequent interactions after the question is resolved.
   * If empty the engine falls back to dialogueLines (sans question).
   * French strings.
   */
  resolvedLines: string[];

  /**
   * The question this NPC poses. Null for ambient-dialogue-only NPCs
   * that do not count toward door unlock.
   */
  question: NpcQuestion | null;

  /**
   * Optional CardData.id granted to the player as a reward for resolving
   * a separate condition (e.g. exploration). Not the question answer itself —
   * the answer card is added via DeckSystem on resolution.
   */
  rewardCardId?: string;
}
