import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { ZoneScene } from './scenes/ZoneScene';
import { UIScene } from './scenes/UIScene';
import { TimelineScene } from './scenes/TimelineScene';

/**
 * Entry point — configures and launches the Phaser 3 game instance.
 *
 * Scene registration order matters for Phaser's scene manager:
 *  1. BootScene    — immediate boot, transitions to PreloadScene
 *  2. PreloadScene — loads assets + ContentLoader; transitions to MainMenuScene
 *  3. MainMenuScene — title screen; starts ZoneScene + launches UIScene
 *  4. ZoneScene    — main gameplay scene
 *  5. UIScene      — persistent overlay (dialogue, deck, end screen); always on top
 *
 * UIScene is launched (not started) from MainMenuScene so it renders above
 * ZoneScene in the scene stack. All scenes are registered here so they can
 * be referenced by key string from any scene.
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

  // Arcade physics for player movement (no gravity needed for top-down)
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },

  // All scenes registered here. Start with BootScene; others activated by scene manager.
  // TimelineScene is registered last so it renders above all other scenes (highest depth).
  scene: [BootScene, PreloadScene, MainMenuScene, ZoneScene, UIScene, TimelineScene],
};

// Instantiate game — stored so the browser doesn't GC it
const game = new Phaser.Game(config);

// Expose the game instance for QA / debug tooling (Playwright introspection).
// Kept in prod builds intentionally: read-only inspection, no gameplay impact.
(window as any).__game = game;
