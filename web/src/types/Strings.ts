/**
 * Flat key→string map for all player-facing UI text.
 *
 * Loaded from /content/strings.fr.json at runtime by ContentLoader.
 * All strings are French in V1. The Strings type is intentionally a
 * simple record so new keys can be added in content without touching code.
 *
 * Usage: `contentLoader.getString('menu.play')` → "Jouer"
 *
 * Key naming convention (enforced by agent-contenu):
 *   <context>.<token>  e.g. "menu.play", "door.locked", "end.replay"
 */
export type Strings = Record<string, string>;
