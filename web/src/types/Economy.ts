/**
 * Economy — tunable numbers for XP, costs and resources (content/economy.json).
 *
 * Kept in content (not code) so game balance can be adjusted without touching
 * the engine (ADR-002). Every field has a default in ContentLoader, so a
 * partial or missing economy.json never breaks the game.
 */
export interface EconomyData {
  xp: {
    /** XP earned when an NPC question is answered right on the first try. */
    correctFirstTry: number;
    /** XP earned when the right answer comes after at least one wrong card. */
    correctAfterRetry: number;
    /** Bonus XP when the last quest NPC of a zone is helped (door opens). */
    zoneCleared: number;
  };
  shop: {
    /** XP cost of a hint: greys out part of the wrong cards. */
    hintCost: number;
    /** Share of the wrong cards a hint removes (0..1). */
    hintEliminateRatio: number;
    /** XP cost of revealing the right card. */
    answerCost: number;
  };
}

export const ECONOMY_DEFAULT: EconomyData = {
  xp: {
    correctFirstTry: 50,
    correctAfterRetry: 25,
    zoneCleared: 100,
  },
  shop: {
    hintCost: 20,
    hintEliminateRatio: 0.5,
    answerCost: 60,
  },
};
