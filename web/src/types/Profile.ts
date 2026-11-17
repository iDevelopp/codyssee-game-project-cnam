/** Grammatical agreement chosen by the player (French inclusive forms). */
export type Pronoun = 'il' | 'elle' | 'iel';

/** Player character, created before the first game (feat/character-creation). */
export interface PlayerProfile {
  /** Display name, 1–16 characters. */
  name: string;
  /** Drives "·e" agreement in every player-facing string. */
  pronoun: Pronoun;
  /** Id of the outfit style (content/cosmetics.json). */
  styleId: string;
}

/** One outfit style from content/cosmetics.json. */
export interface CosmeticStyle {
  id: string;
  name: string;
  /** CSS hex tint ("#66e0ff") or null for the original sprite colours. */
  tint: string | null;
  /** Price; 0 = free (offered at character creation). */
  price: number;
  /** What the price is paid in. Default "xp". */
  currency?: 'xp' | 'energy';
}
