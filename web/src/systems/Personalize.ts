import { SaveSystem } from '@/systems/SaveSystem';

/**
 * Personalize — adapts player-facing text to the player's profile.
 *
 *  - "{player}" → the player's name (left untouched before creation)
 *  - French inclusive endings "·e", "·se", "·ne"… → agreed with the chosen
 *    pronoun: il → "épuisé", elle → "épuisée", iel → "épuisé·e" (unchanged)
 *
 * Content authors keep writing inclusive forms; the engine agrees them.
 *
 * Limitation: only endings that are simply appended to the masculine form
 * work ("épuisé·e", "plein·e", "prêt·es"). Forms that change the stem
 * ("voyageur·euse", "acteur·rice") cannot be agreed — use a neutral wording.
 */
export function personalize(text: string): string {
  const profile = SaveSystem.getInstance().getProfile();
  if (!profile) return text;
  let out = text.split('{player}').join(profile.name);
  if (profile.pronoun === 'il') out = out.replace(/·[a-zà-ÿ]+/g, '');
  else if (profile.pronoun === 'elle') out = out.replace(/·([a-zà-ÿ]+)/g, '$1');
  return out;
}
