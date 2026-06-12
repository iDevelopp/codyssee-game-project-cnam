import type { CardData } from '@/types/CardData';

/**
 * DeckSystem — manages the player's card collection.
 *
 * Mirrors Unity's Deck.cs: add(), has(), list(). Emits callbacks on card added.
 *
 * Deck initialisation follows GameManager.Start() logic:
 *   initial deck = all cards MINUS NPC expectedAnswer cards.
 *   Each correct NPC answer adds that card to the deck (reward).
 *   Cards cannot be added twice (idempotent Add).
 *
 * Unity reference: Deck.cs — Add(), HasCard(), GetAll(), OnCardAdded event.
 */
export class DeckSystem {
  /** Internal card storage keyed by card id for O(1) lookup. */
  private cards: Map<string, CardData> = new Map();

  /** Callbacks registered via onCardAdded() — called after each successful add. */
  private addListeners: Array<(card: CardData) => void> = [];

  // ---------------------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------------------

  /**
   * Initialise the deck with a specific card list.
   * Replaces any existing cards — call once at zone start.
   *
   * @param initialCards - Cards to seed the deck with
   *   (from ContentLoader.getInitialDeckCards())
   */
  init(initialCards: CardData[]): void {
    this.cards.clear();
    for (const card of initialCards) {
      this.cards.set(card.id, card);
    }
  }

  // ---------------------------------------------------------------------------
  // Card management
  // ---------------------------------------------------------------------------

  /**
   * Add a card to the deck. Idempotent — duplicate ids are ignored.
   * Calls all registered onCardAdded listeners.
   *
   * Unity reference: Deck.Add() — adds if absent, emits OnCardAdded.
   *
   * @param card - Card to add
   */
  add(card: CardData): void {
    if (this.cards.has(card.id)) return; // already in deck
    this.cards.set(card.id, card);
    for (const cb of this.addListeners) {
      cb(card);
    }
  }

  /**
   * Returns true if the deck contains a card with the given id.
   *
   * @param cardId - CardData.id to check
   */
  has(cardId: string): boolean {
    return this.cards.has(cardId);
  }

  /**
   * Returns all cards in the deck as an array.
   * Order is insertion order (Map preserves this).
   */
  list(): CardData[] {
    return Array.from(this.cards.values());
  }

  /**
   * Returns the card ids as an array — used by SaveSystem for serialisation.
   */
  listIds(): string[] {
    return Array.from(this.cards.keys());
  }

  /**
   * Restore deck from a list of card ids and the full card catalog.
   * Called by SaveSystem on zone load.
   *
   * @param savedIds - Array of card ids from the save file
   * @param allCards - Full card catalog (from ContentLoader.getCards())
   */
  restoreFromIds(savedIds: string[], allCards: CardData[]): void {
    this.cards.clear();
    const catalog = new Map(allCards.map((c) => [c.id, c]));
    for (const id of savedIds) {
      const card = catalog.get(id);
      if (card) this.cards.set(id, card);
    }
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  /**
   * Register a listener to be called whenever a card is successfully added.
   *
   * @param cb - Callback receiving the newly added card
   */
  onCardAdded(cb: (card: CardData) => void): void {
    this.addListeners.push(cb);
  }
}
