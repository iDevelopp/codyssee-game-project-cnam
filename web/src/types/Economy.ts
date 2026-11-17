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
  energy: {
    /** Gauge maximum. */
    max: number;
    /** Energy of a brand-new game. */
    start: number;
    /** Energy lost per second while the player walks. */
    drainPerSecondMoving: number;
    /** Energy spent each time an NPC's question is put to the player. */
    questionCost: number;
    /** Extra energy lost on a wrong card. */
    wrongAnswerCost: number;
    /** Energy restored by one coffee. */
    coffeeGain: number;
    /** Seconds before the same machine serves another coffee. */
    coffeeCooldownSec: number;
    /** Below this, the HUD gauge turns red and a warning toast shows once. */
    lowThreshold: number;
    /** XP lost each penalty tick while energy is at 0. */
    exhaustedXpPenalty: number;
    /** Seconds between two XP penalties at 0 energy. */
    exhaustedPenaltyIntervalSec: number;
    /** Walking speed multiplier at 0 energy. */
    exhaustedSpeedFactor: number;
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
  energy: {
    max: 100,
    start: 100,
    drainPerSecondMoving: 0.5,
    questionCost: 4,
    wrongAnswerCost: 8,
    coffeeGain: 40,
    coffeeCooldownSec: 45,
    lowThreshold: 25,
    exhaustedXpPenalty: 5,
    exhaustedPenaltyIntervalSec: 8,
    exhaustedSpeedFactor: 0.5,
  },
  shop: {
    hintCost: 20,
    hintEliminateRatio: 0.5,
    answerCost: 60,
  },
};
