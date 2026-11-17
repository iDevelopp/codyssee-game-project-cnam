import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';
import { AudioManager } from '@/systems/AudioManager';
import { SaveSystem } from '@/systems/SaveSystem';
import { COLORS, FONTS } from '@/ui/theme';
import { createPixelButton, createScanlineOverlay } from '@/ui/uiKit';

/**
 * MainMenuScene — title screen with Jouer/Continuer and Quitter buttons,
 * styled after the codysse.fr landing hero (CRT/arcade identity).
 *
 * Button labels come from strings.fr.json so they never appear hardcoded
 * in engine code (ADR-002). "Quitter" maps to MainMenuScene itself on web
 * because Application.Quit has no web equivalent (ADR-004). The primary
 * action button reads "Jouer" for a fresh save and "Continuer" when a
 * saved zone exists — same underlying new-game/resume logic either way.
 */
export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const cl = ContentLoader.getInstance();

    // Defensive reset (BUG-08): the scene singleton is reused when returning
    // to the menu (END_MENU / Quitter). Restore camera visibility and input,
    // which are disabled below while the intro overlay is shown.
    this.cameras.main.setVisible(true);
    this.input.enabled = true;

    // ---- Audio init ----
    // SaveSystem must be loaded before AudioManager.init() so saved volume/mute
    // are available. PreloadScene does not call save.load() — that happens in
    // ZoneScene — so we do a lightweight load here just for audio prefs.
    // If already loaded (e.g. Rejouer path), this is idempotent (reuses cache).
    SaveSystem.getInstance().load();

    // Initialize AudioManager: creates sound objects and binds GameEvents.
    // Must happen after PreloadScene has loaded audio files into the cache.
    AudioManager.getInstance().init(this);

    // Request the menu theme. Because this runs in create() (not a user gesture),
    // the browser AudioContext may be suspended. AudioManager will defer the
    // actual play() until 'unlocked' fires on the first pointer/key event.
    AudioManager.getInstance().playMusic('music.menu');

    this.cameras.main.setBackgroundColor(COLORS.bgCss);

    // Subtle CRT scanlines over the whole hero — matches the landing/game identity.
    createScanlineOverlay(this, width, height).setDepth(0);

    // Title — from strings.fr.json so it is never hardcoded in engine.
    // Phosphor-green glow via setShadow mirrors the landing hero's
    // `text-shadow: 0 0 18px / 0 0 60px rgba(green)` treatment.
    this.add.text(width / 2, height * 0.28, cl.getString('menu.title'), {
      fontFamily: FONTS.pixel,
      fontSize: '48px',
      color: COLORS.greenCss,
      align: 'center',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.greenCss, 18, true, true);

    // Tagline from strings — amber secondary accent.
    this.add.text(width / 2, height * 0.42, cl.getString('menu.tagline'), {
      fontFamily: FONTS.body,
      fontSize: '18px',
      color: COLORS.amberCss,
      align: 'center',
      wordWrap: { width: width * 0.7 },
    }).setOrigin(0.5);

    // Jouer/Continuer button — new game or resume depending on save state.
    // currentZoneId in SaveSystem is the resume point written by ZoneScene.create()
    // on each zone entry. null = first launch ever = NEW GAME.
    const save = SaveSystem.getInstance();
    const currentZoneId = save.getCurrentZoneId();
    const isNewGame = currentZoneId === null;
    const playLabel = isNewGame ? cl.getString('menu.play') : cl.getString('menu.continue');

    createPixelButton(this, width / 2, height * 0.50, 280, 56, playLabel, () => {
      const startData = currentZoneId ? { zoneId: currentZoneId } : undefined;

      // Ensure UIScene and TimelineScene are running before emitting events.
      // Both are launched once here and persist across zone transitions.
      if (!this.scene.isActive('UIScene')) {
        this.scene.launch('UIScene');
      }
      if (!this.scene.isActive('TimelineScene')) {
        this.scene.launch('TimelineScene');
      }

      if (isNewGame) {
        // NEW GAME: show the intro narrative overlay before starting zone_01.
        // UIScene must already be running (launched above) to receive INTRO_SHOW.
        // We defer ZoneScene.start() to the callback so the zone loads AFTER
        // the intro is dismissed (not alongside it).
        // Small delay ensures UIScene.create() has completed before we emit.
        this.time.delayedCall(100, () => {
          // BUG-08: hide the menu and disable its buttons while the intro
          // overlay is up. Otherwise the title/buttons bleed through the
          // overlay AND clicks meant to advance the intro can re-trigger
          // the menu buttons underneath. scene.start('ZoneScene') in the
          // callback shuts this scene down; create() re-enables on return.
          this.cameras.main.setVisible(false);
          this.input.enabled = false;
          this.game.events.emit('intro-show', {
            onComplete: () => {
              this.scene.start('ZoneScene', startData);
            },
          });
        });
      } else {
        // RESUME: skip intro, jump straight to the saved zone.
        this.scene.start('ZoneScene', startData);
      }
    }, 16);

    // Créer un niveau — level editor entry (J6). Resumes the auto-saved draft
    // when one exists (EditorScene falls back to a fresh zone_01 clone otherwise).
    createPixelButton(this, width / 2, height * 0.62, 280, 44, cl.getString('menu.create'), () => {
      this.scene.start('EditorScene');
    }, 12);

    // Quitter button — on web the closest thing to quitting is leaving the
    // game page: go back to the landing at / (ADR-004; no Application.Quit).
    createPixelButton(this, width / 2, height * 0.74, 280, 44, cl.getString('menu.quit'), () => {
      window.location.href = '/';
    }, 12);
  }
}
