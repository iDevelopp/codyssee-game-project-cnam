import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';

/**
 * Entry point — configures and launches the Phaser 3 game instance.
 *
 * Pixel-art config: pixelArt + render.antialias = false ensures nearest-neighbour
 * scaling everywhere; critical for the sprite style inherited from the Unity prototype.
 *
 * Scale config: FIT + CENTER_BOTH gives a responsive canvas that keeps the fixed
 * logical resolution (1280×720) and letterboxes on wider screens.
 *
 * Assets loaded via Phaser's loader use paths relative to import.meta.env.BASE_URL,
 * which Vite resolves to '/codyssee/' in production (ADR-004) and '/' in dev.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  // Logical resolution — desktop-first, 16:9
  width: 1280,
  height: 720,

  parent: 'game-container',

  // Pixel-art rendering — nearest-neighbour, no antialiasing
  pixelArt: true,
  render: {
    antialias: false,
    antialiasGL: false,
  },

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },

  backgroundColor: '#000000',

  scene: [BootScene],
};

// Instantiate game — stored so the browser doesn't GC it
new Phaser.Game(config);
