/**
 * A single entry in the historical timeline (frise chronologique).
 *
 * The timeline reveals entries as the player helps NPCs and collects cards.
 * Target scope per ADR-004: ~15-20 languages, 4-6 thematic eras.
 * Authored in /content/timeline.json — agent-contenu owns this file.
 */
export interface TimelineEntry {
  /**
   * Historical year (or approximate year) this entry occurred.
   * Displayed on the timeline axis. Can be negative for ancient history.
   */
  year: number;

  /**
   * Human-readable language/technology name for the timeline label.
   * French string, e.g. "Python", "JavaScript".
   */
  language: string;

  /**
   * CardData.id linked to this timeline entry.
   * When the card is added to the player's deck the entry becomes revealed.
   */
  cardId: string;

  /**
   * Short description of this language's historical significance.
   * Shown in the timeline tooltip or detail panel. French string.
   */
  blurb: string;

  /**
   * CardData.id (or NpcData.id) whose resolution triggers this entry's reveal.
   * Typically equals cardId but can differ for multi-stage unlocks.
   */
  unlockedBy: string;

  /**
   * Optional list of cardIds this language inherited from / was influenced by.
   * When both this entry and a listed source entry are revealed, an arrow is
   * drawn between them on the timeline frieze (TASK-023).
   *
   * Authored in /content/timeline.json — agent-contenu owns this field.
   * Empty array or absent means no influence links for this entry.
   */
  influences?: string[];
}
