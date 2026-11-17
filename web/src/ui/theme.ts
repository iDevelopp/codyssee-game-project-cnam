/**
 * Codysse UI theme tokens — single source of truth for in-game UI colors and
 * fonts, mirroring the landing page identity (src/landing/landing.css).
 *
 * Two encodings because Phaser wants numbers for fills and CSS strings for
 * text styles — keep them in sync when editing.
 */
export const COLORS = {
  /** Deep-space page background. */
  bg: 0x070b14,
  bgCss: '#070b14',
  /** Raised panel background. */
  panel: 0x0c1322,
  panelCss: '#0c1322',
  /** Hairline borders / separators. */
  line: 0x1c2a3a,
  lineCss: '#1c2a3a',
  /** Primary phosphor green — titles, confirmations, open states. */
  green: 0x3dfc8e,
  greenCss: '#3dfc8e',
  /** Amber — secondary accent, hovers, warnings. */
  amber: 0xffc857,
  amberCss: '#ffc857',
  /** Cyan — informational accents, links, timeline. */
  cyan: 0x5fd7f5,
  cyanCss: '#5fd7f5',
  /** Body text. */
  ink: 0xdce8dc,
  inkCss: '#dce8dc',
  /** Dimmed text. */
  inkDim: 0x7c8a91,
  inkDimCss: '#7c8a91',
  /** Locked / error red. */
  red: 0xc8102e,
  redCss: '#c8102e',
  /** Pixel-button shadow (idle) — mirrors landing `.btn-play` box-shadow colour. */
  shadowGreen: 0x14532d,
  /** Pixel-button shadow (hover) — mirrors landing `.btn-play:hover` box-shadow colour. */
  shadowAmber: 0x7c4a03,
} as const;

export const FONTS = {
  /** Pixel display font — titles, buttons, headings. Loaded in BootScene. */
  pixel: '"Press Start 2P", monospace',
  /** Body font — dialogue, descriptions. */
  body: '"IBM Plex Mono", monospace',
} as const;
