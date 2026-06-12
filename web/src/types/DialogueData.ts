/**
 * A single entry in a scripted dialogue sequence.
 *
 * Currently NPC dialogues are stored inline in NpcData.dialogueLines as
 * simple string arrays. DialogueData exists for future extension: cutscenes,
 * branching choices, or voiced lines keyed by id.
 *
 * Agent-contenu can populate /content/dialogues/ when branching is needed.
 */
export interface DialogueLine {
  /** The spoken text. French string. */
  text: string;

  /**
   * Optional speaker identifier matching an NpcData.id or "player".
   * If absent, the dialogue box shows no speaker name.
   */
  speakerId?: string;

  /**
   * Optional portrait override for this line.
   * Useful when a single NPC has multiple expressions.
   */
  portrait?: string;
}

/**
 * A named dialogue sequence for a cutscene or scripted event.
 *
 * Not used in J0 (NPCs use inline dialogueLines). Defined here so the
 * ContentLoader can be extended to support it without interface changes.
 */
export interface DialogueData {
  /** Unique identifier for this sequence, e.g. "intro_cutscene". */
  id: string;

  /** Ordered list of lines to display. */
  lines: DialogueLine[];
}
