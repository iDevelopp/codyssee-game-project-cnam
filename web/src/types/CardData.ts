/**
 * Represents a programming language card in Codyssey.
 *
 * Cards are the core collectible/answer unit. The player's deck starts with
 * all cards *except* those expected as NPC answers. Answering correctly adds
 * the card to the deck (see ADR-002, gdd/01-boucle-reference.md).
 *
 * Authored in /content/cards.json — never hardcode card data in engine code.
 */
export interface CardData {
  /** Unique lowercase English identifier, e.g. "python", "javascript". */
  id: string;

  /** Display name shown in the deck UI, e.g. "Python". */
  displayName: string;

  /**
   * Short description of the language, shown in the card body.
   * French string — lives in content, not in engine code.
   */
  description: string;

  /**
   * Typical use cases, shown in italic grey under the description.
   * French string — lives in content, not in engine code.
   */
  usage: string;

  /**
   * Optional path to the card icon asset, relative to BASE_URL/assets/.
   * If absent, the deck UI renders a placeholder glyph.
   */
  icon?: string;

  /**
   * Historical era this card belongs to (e.g. "1990s", "2000s").
   * Feeds the timeline (frise) — used by the TimelineEntry model.
   * Optional for J0 seed; agent-contenu will fill it when extending.
   */
  era?: string;
}
