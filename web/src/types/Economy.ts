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
}

export const ECONOMY_DEFAULT: EconomyData = {
  xp: {
    correctFirstTry: 50,
    correctAfterRetry: 25,
    zoneCleared: 100,
  },
};
