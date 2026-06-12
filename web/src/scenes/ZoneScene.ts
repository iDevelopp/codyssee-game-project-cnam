import Phaser from 'phaser';
import { Player } from '@/entities/Player';
import { NPC } from '@/entities/NPC';
import { Door } from '@/entities/Door';
import { ContentLoader } from '@/systems/ContentLoader';
import { InteractionSystem } from '@/systems/InteractionSystem';
import { DeckSystem } from '@/systems/DeckSystem';
import { ProgressionSystem } from '@/systems/ProgressionSystem';
import { SaveSystem } from '@/systems/SaveSystem';
import { InputLock } from '@/systems/InputLock';
import { GameEvents } from '@/systems/GameEvents';
import { AudioManager } from '@/systems/AudioManager';
import type { CardData } from '@/types/CardData';
import type { ZoneData } from '@/types/ZoneData';

/**
 * Per-era background tint palette.
 *
 * Data-driven: map themeEra → camera background hex. If an era is not listed
 * here the hash fallback produces a deterministic colour from the string.
 * Real tilemaps (J5) will replace this with actual Tiled JSON — this is a
 * visual placeholder only.
 */
const ERA_BACKGROUND: Record<string, string> = {
  '1950s': '#1a1a0a', // dark olive — vacuum tubes, early mainframes
  '1960s': '#0a1a1a', // dark teal — Fortran, COBOL era
  '1970s': '#1a0a1a', // dark purple — C, Unix era
  '1980s': '#1a1a0a', // dark amber — PC revolution, Pascal
  '1990s': '#1a2a1a', // dark green — web dawn, Java, Python
  '2000s': '#0a1a2a', // dark blue — broadband, frameworks
  '2010s': '#2a1a0a', // dark orange — mobile, JS explosion
  '2020s': '#0a2a1a', // dark emerald — Rust, WASM, cloud-native
};

/**
 * Per-era checkerboard tint colours (light shade, dark shade) for the
 * placeholder floor tiles. Each era gets a distinct colour pair so zones
 * look visually different before real tilemaps arrive in J5.
 */
const ERA_TILE_SHADES: Record<string, [number, number]> = {
  '1950s': [0x5a4a1b, 0x4a3a14],
  '1960s': [0x1b4a4a, 0x143a3a],
  '1970s': [0x4a1b4a, 0x3a143a],
  '1980s': [0x5a4a1b, 0x4a3a14],
  '1990s': [0x2d5a1b, 0x264d17],
  '2000s': [0x1b2d5a, 0x17264d],
  '2010s': [0x5a2d1b, 0x4d2617],
  '2020s': [0x1b5a2d, 0x174d26],
};

/**
 * Fallback: hash a string into a valid hex colour string for unlisted eras.
 * Produces a dark colour (bits 0–5 of each channel clamped to [0x10, 0x2a]).
 *
 * @param s - Source string (themeEra value)
 * @returns CSS hex colour string like '#1a0f22'
 */
function _hashEraColour(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  const r = 0x10 + (Math.abs(h) % 0x1a);
  const g = 0x10 + (Math.abs(h >> 8) % 0x1a);
  const b = 0x10 + (Math.abs(h >> 16) % 0x1a);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * ZoneScene — the main gameplay scene.
 *
 * Responsibilities:
 *  - Accept a zoneId via `scene.start('ZoneScene', { zoneId })` and load
 *    the corresponding zone from ContentLoader. Falls back to the first
 *    zone in the index if no zoneId is provided (first-launch path).
 *  - Render the tilemap background (or era-tinted placeholder if no Tiled JSON).
 *  - Spawn Player, NPCs, and Doors from zone content data.
 *  - Wire up all systems: InteractionSystem, DeckSystem, ProgressionSystem, SaveSystem.
 *  - Handle keyboard input: ZQSD + arrows for movement, E for interaction.
 *  - React to game events: card picked, NPC resolved, all-helped, end-replay, end-menu.
 *  - Expose getAllCards() so NPC can pass all cards to DeckPanel.
 *  - Handle zone transitions: fade-out on open door → launch next zone or EndScreen.
 *
 * UIScene runs in parallel (launched by MainMenuScene) and handles all overlays.
 * Cross-scene communication is via this.game.events (global event bus).
 *
 * Multi-zone chain:
 *   Zone data drives the chain via `zone.nextZoneId`. When absent, the current
 *   zone is the final one and interacting with the open door shows EndScreen.
 *   No zone ids are hardcoded in this file (ADR-002, TASK-020).
 *
 * Listener leak prevention:
 *   NPCs register a DECK_CARD_PICKED listener in their constructor (on the
 *   global game.events bus). On zone transitions we call _unbindEvents() and
 *   then scene.start() which destroys all GameObjects created by this scene,
 *   but the global bus listeners added by NPC constructors persist. To prevent
 *   accumulation across transitions, ZoneScene explicitly removes the
 *   DECK_CARD_PICKED listeners in _unbindEvents() (which removes ALL listeners
 *   for that event — safe because a new set is added when the next zone loads).
 *   Door also adds ALL_NPCS_HELPED and DIALOGUE_ADVANCE to the global bus;
 *   these are cleaned up the same way in _unbindEvents().
 */
export class ZoneScene extends Phaser.Scene {
  // ---- Entities ----
  private player!: Player;
  private npcs: NPC[] = [];
  private doors: Door[] = [];

  // ---- Systems ----
  private interaction!: InteractionSystem;
  private deck!: DeckSystem;
  private progression!: ProgressionSystem;

  // ---- Input ----
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };
  private eKey!: Phaser.Input.Keyboard.Key;

  /** Flag: E was already processed last frame (single-press guard). */
  private wasEDown = false;

  /** M key — mute toggle (single-press guard). */
  private mKey!: Phaser.Input.Keyboard.Key;

  /** Whether M was down last frame (single-press guard). */
  private wasMDown = false;

  /** Zone data loaded from ContentLoader for the active zone. */
  private zoneData!: ZoneData;

  /**
   * Whether a zone transition is currently in progress.
   * Guards against double-triggering the fade/start sequence.
   */
  private transitioning = false;

  constructor() {
    super({ key: 'ZoneScene' });
  }

  // ---------------------------------------------------------------------------
  // Scene lifecycle
  // ---------------------------------------------------------------------------

  create(): void {
    // ---- Reset ALL per-zone state (BUG-04) ----
    // ZoneScene is a singleton reused by Phaser across scene.start() calls.
    // TypeScript field initializers (e.g. `private npcs: NPC[] = []`) only run
    // once at construction, NOT on each scene restart. Without explicit resets
    // here, arrays accumulate stale references from previous zones ("zombie NPCs").
    // Phaser clears the display list on scene.start(), so old GameObjects are
    // destroyed — but any array/ref still holding them would iterate over dead
    // objects in the InputLock advance loop and cause errors.
    this.npcs = [];
    this.doors = [];
    this.transitioning = false;
    this.wasEDown = false;
    this.wasMDown = false;
    // `player`, `interaction`, `deck`, `progression`, `cursors`, `wasd`,
    // `eKey`, `mKey`, `zoneData` are all reassigned unconditionally below —
    // no explicit reset needed (they are overwritten before first use).

    const cl = ContentLoader.getInstance();
    const save = SaveSystem.getInstance();

    // ---- Load save first so restore state is available ----
    save.load();

    // ---- Zone data ----
    // Accept zoneId from scene.start() data (multi-zone path).
    // Fall back to the first zone in the index on first launch.
    const sceneData = this.scene.settings.data as { zoneId?: string } | undefined;
    const requestedId = sceneData?.zoneId;

    let zone: ZoneData | undefined;
    if (requestedId) {
      zone = cl.getZone(requestedId);
      if (!zone) {
        console.warn(`ZoneScene: zoneId "${requestedId}" not found in content. Falling back to first zone.`);
      }
    }
    if (!zone) {
      zone = cl.getZones()[0];
    }
    if (!zone) {
      throw new Error('ZoneScene: no zones found. Add at least one id to content/zones/index.json.');
    }
    this.zoneData = zone;

    // ---- Record current zone in save (resume point for page reloads) ----
    save.recordZoneUnlocked(this.zoneData.id);

    // Reset transition guard each time the scene starts
    this.transitioning = false;

    const { width, height } = this.scale;

    // ---- Background (themeEra-driven) ----
    const bgColour = ERA_BACKGROUND[this.zoneData.themeEra] ?? _hashEraColour(this.zoneData.themeEra);
    this.cameras.main.setBackgroundColor(bgColour);
    this._drawPlaceholderMap(width, height, this.zoneData.themeEra);

    // ---- Input ----
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // M key — mute toggle for J2 (a settings UI with a volume slider is planned for J3+).
    this.mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);

    // ---- Player ----
    const spawn = this.zoneData.spawn;
    this.player = new Player(this, spawn.x, spawn.y);

    // ---- Camera ----
    // Follow player with lerp ≈ 0.15 (matches Unity CameraFollow smoothTime=0.15)
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setBounds(0, 0, width * 2, height * 2);

    // ---- Systems ----
    this.interaction = new InteractionSystem(this);

    // Deck: initialise from save or from ContentLoader default.
    // Deck is GLOBAL across zones — cards earned in zone_01 carry over to zone_02.
    this.deck = new DeckSystem();
    const savedDeckIds = save.getDeckCardIds();
    if (savedDeckIds.length > 0) {
      this.deck.restoreFromIds(savedDeckIds, cl.getCards());
    } else {
      this.deck.init(cl.getInitialDeckCards());
    }

    // Persist deck changes immediately when a card is added
    this.deck.onCardAdded(() => {
      save.saveDeck(this.deck.listIds());
    });

    // ---- NPCs ----
    const questNPCIds = this.zoneData.npcs;
    // helpedNpcIds is GLOBAL: NPCs helped in previous zones are already in the set.
    // This means a player who helped an NPC in zone_01 won't see them re-open
    // in zone_02 (which is correct — they are different NPCs with different ids).
    const helpedIds = new Set(save.getHelpedNpcIds());

    // Build the set of quest NPC ids that belong to THIS zone only.
    // Passed to ProgressionSystem as a whitelist so it does not count save data
    // from other zones (e.g. zone_01's 3 helped ids counting toward zone_02's
    // questNPCCount of 3, which would incorrectly open the door on entry — BUG-03).
    const zoneQuestNpcIdSet = new Set<string>();
    let questNPCCount = 0;
    for (const npcId of questNPCIds) {
      const npcData = cl.getNpc(npcId);
      if (npcData?.question) {
        questNPCCount++;
        zoneQuestNpcIdSet.add(npcId);
      }
    }

    this.progression = new ProgressionSystem(this.game.events, questNPCCount, zoneQuestNpcIdSet);

    for (const npcId of questNPCIds) {
      const npcData = cl.getNpc(npcId);
      if (!npcData) {
        console.warn(`ZoneScene: NPC "${npcId}" not found in npcs.json`);
        continue;
      }

      const npc = new NPC(this, npcData);
      this.npcs.push(npc);
      this.interaction.register(npc);

      // Restore resolved state from save
      if (helpedIds.has(npcId)) {
        npc.restoreResolved();
      }
    }

    // Restore ProgressionSystem state from save
    const helpedArray = save.getHelpedNpcIds();
    if (helpedArray.length > 0) {
      this.progression.restoreResolved(helpedArray);
    }

    // ---- Doors ----
    for (const doorData of this.zoneData.doors) {
      const door = new Door(this, doorData);
      this.doors.push(door);
      this.interaction.register(door);

      // Restore door open state from save
      if (save.isDoorUnlocked(doorData.id)) {
        door.restoreOpen();
      }
    }

    // ---- Event wiring ----
    this._bindEvents();

    // ---- Physics world bounds ----
    this.physics.world.setBounds(0, 0, width * 2, height * 2);

    // Make sure InputLock starts clean (in case UIScene leaked a lock from prev run)
    InputLock.unlock();

    // ---- Fade in on zone entry ----
    // Provides the visual counterpart to the fade-out on exit.
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  update(): void {
    // Player movement — InputLock checked inside Player.move()
    this.player.move(this.cursors, this.wasd, InputLock.isLocked());

    // M key: toggle mute (single-press — rising edge only)
    const mDown = this.mKey.isDown;
    const mJustPressed = mDown && !this.wasMDown;
    this.wasMDown = mDown;
    if (mJustPressed) {
      AudioManager.getInstance().toggleMute();
    }

    // InteractionSystem handles E for NPCs and doors (unlocked state only).
    // Returns true if it triggered an interaction this frame — used below to
    // prevent the same E press from being consumed twice (single-press guarantee).
    const interactionFired = this.interaction.update(this.player.x, this.player.y);

    // Handle E press when input is locked — advance active dialogue or dismiss door message.
    const eDown = this.eKey.isDown;
    const eJustPressed = eDown && !this.wasEDown;
    this.wasEDown = eDown;

    // Guard: skip if InteractionSystem already consumed this press (prevents double-fire).
    if (eJustPressed && InputLock.isLocked() && !interactionFired) {
      this.game.events.emit(GameEvents.DIALOGUE_ADVANCE);

      // Advance the NPC that is currently mid-dialogue.
      for (const npc of this.npcs) {
        if (npc.isBusy()) {
          npc.interact();
          break;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API (used by NPC to get all cards for DeckPanel)
  // ---------------------------------------------------------------------------

  /**
   * Returns all cards from the content database.
   * NPC calls this when opening DeckPanel — Unity DeckUI shows all cards, not just deck.
   *
   * @returns Full card catalog from ContentLoader
   */
  getAllCards(): CardData[] {
    return ContentLoader.getInstance().getCards();
  }

  // ---------------------------------------------------------------------------
  // Private — zone transition
  // ---------------------------------------------------------------------------

  /**
   * Initiate a transition to the next zone.
   *
   * Behaviour:
   * - If the zone has a nextZoneId: fade out camera → start ZoneScene with
   *   { zoneId: nextZoneId }. UIScene stays running (launched once by
   *   MainMenuScene and never stopped during play — it persists across zones).
   * - If no nextZoneId (final zone): emit GAME_COMPLETE so EndScreen appears.
   *
   * Guards against double-trigger with `this.transitioning`.
   *
   * @param nextZoneId - Zone to transition to, or undefined for final zone
   */
  private _triggerZoneTransition(nextZoneId: string | undefined): void {
    if (this.transitioning) return;
    this.transitioning = true;

    if (nextZoneId) {
      // Non-final zone: fade out then start next zone
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        // Clean up our global bus listeners before handing off to next ZoneScene instance
        this._unbindEvents();
        // scene.start() replaces the running ZoneScene with a new one
        // (Phaser destroys current scene's game objects, then calls create() again).
        // UIScene is not touched — it stays alive across zone changes.
        this.scene.start('ZoneScene', { zoneId: nextZoneId });
      });
    } else {
      // Final zone: no nextZoneId → game complete
      this.game.events.emit(GameEvents.GAME_COMPLETE, {
        message: ContentLoader.getInstance().getString('end.congrats'),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Private — event wiring
  // ---------------------------------------------------------------------------

  private _bindEvents(): void {
    const ev = this.game.events;
    const save = SaveSystem.getInstance();
    const cl = ContentLoader.getInstance();

    // NPC reward: add the answered card to player deck
    ev.on('npc-reward-card', (payload: { npcId: string; cardId: string }) => {
      const card = cl.getCard(payload.cardId);
      if (card) {
        this.deck.add(card);
      }
      save.recordNpcHelped(payload.npcId);
    });

    // All NPCs helped → record door as unlocked in save
    ev.on(GameEvents.ALL_NPCS_HELPED, () => {
      for (const doorData of this.zoneData.doors) {
        save.recordDoorUnlocked(doorData.id);
      }
    });

    // Door exit triggered: transition to next zone (or end screen if final zone)
    ev.on(GameEvents.ZONE_TRANSITION, (payload: { nextZoneId: string | undefined }) => {
      this._triggerZoneTransition(payload.nextZoneId);
    });

    // Rejouer: restart the CURRENT zone (keep save — progress is preserved).
    // Multi-zone semantics: Rejouer reloads the zone the player is in right now,
    // not zone_01. The player keeps their deck and all helped-NPC records.
    // If the door was already unlocked in save, it will show as open immediately.
    ev.on(GameEvents.END_REPLAY, () => {
      this._unbindEvents();
      // Restart with same zoneId so we stay on the current zone
      this.scene.start('ZoneScene', { zoneId: this.zoneData.id });
    });

    // Menu principal: stop zone, stop UI overlay, go to main menu
    ev.on(GameEvents.END_MENU, () => {
      this._unbindEvents();
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    });

    // GAME_COMPLETE (final zone clear): show EndScreen via UIScene
    ev.on(GameEvents.GAME_COMPLETE, (payload: { message: string }) => {
      ev.emit(GameEvents.END_SCREEN_SHOW, payload);
    });
  }

  /**
   * Remove zone-specific event listeners before restart/stop to prevent leaks.
   *
   * Critical: NPC and Door each add listeners to the global game.events bus in
   * their constructors:
   *   - NPC: DECK_CARD_PICKED
   *   - Door: ALL_NPCS_HELPED, DIALOGUE_ADVANCE
   *
   * When scene.start() is called the scene's DisplayList is cleared (GameObjects
   * are destroyed) but game.events global listeners are NOT automatically removed.
   * Without cleanup, each zone transition accumulates handlers for these events,
   * causing duplicate NPC responses, spurious door unlocks, and incorrect
   * all-NPCs counts.
   *
   * We remove ALL listeners for the affected event keys here. This is safe
   * because the next zone's create() immediately re-registers fresh handlers
   * via new NPC/Door constructors.
   */
  private _unbindEvents(): void {
    const ev = this.game.events;

    // ZoneScene-owned listeners
    ev.removeAllListeners('npc-reward-card');
    ev.removeAllListeners(GameEvents.END_REPLAY);
    ev.removeAllListeners(GameEvents.END_MENU);
    ev.removeAllListeners(GameEvents.ZONE_TRANSITION);
    ev.removeAllListeners(GameEvents.GAME_COMPLETE);

    // ALL_NPCS_HELPED: owned by ZoneScene (saves door) + Door (unlocks visual)
    // + ProgressionSystem (emits it but does not re-subscribe). Safe to remove all.
    ev.removeAllListeners(GameEvents.ALL_NPCS_HELPED);

    // NPC_RESOLVED: owned by ProgressionSystem listener inside its constructor.
    // ProgressionSystem is re-created on each zone load, so stale listeners
    // would accumulate — remove them here.
    ev.removeAllListeners(GameEvents.NPC_RESOLVED);

    // DECK_CARD_PICKED: NPC constructor adds one listener per NPC.
    // After zone transition, old NPCs are gone but their listeners remain on
    // the global bus. Remove all — next zone's NPCs re-register in create().
    ev.removeAllListeners(GameEvents.DECK_CARD_PICKED);

    // DIALOGUE_ADVANCE: Door adds one listener per door in its constructor.
    // Same leak pattern as DECK_CARD_PICKED — clean up here.
    ev.removeAllListeners(GameEvents.DIALOGUE_ADVANCE);
  }

  // ---------------------------------------------------------------------------
  // Private — visual helpers
  // ---------------------------------------------------------------------------

  /**
   * Draw a tiled placeholder background using era-specific colours.
   *
   * In J1–J4, no Tiled JSON tilemap is loaded — this gives a visual floor
   * that differs per era so zones feel distinct.
   * Agent-infra/contenu can replace this with a proper TilemapJSONFile loader
   * in J5 without changing anything else.
   *
   * @param width   - Scene display width
   * @param height  - Scene display height
   * @param themeEra - Zone's era string (used to pick the checkerboard colours)
   */
  private _drawPlaceholderMap(width: number, height: number, themeEra: string): void {
    const mapW = width * 2;
    const mapH = height * 2;
    const tileSize = 32;

    // Pick era-specific tile shades; fall back to a hash-derived pair.
    let [shade0, shade1] = ERA_TILE_SHADES[themeEra] ?? [0x2d5a1b, 0x264d17];

    // If era not in the table, derive two shades from the colour hash
    if (!ERA_TILE_SHADES[themeEra]) {
      let h = 0;
      for (let i = 0; i < themeEra.length; i++) {
        h = (Math.imul(31, h) + themeEra.charCodeAt(i)) | 0;
      }
      shade0 = 0x101010 + (Math.abs(h) % 0x1a1a1a);
      shade1 = 0x0a0a0a + (Math.abs(h >> 4) % 0x141414);
    }

    for (let ty = 0; ty < mapH / tileSize; ty++) {
      for (let tx = 0; tx < mapW / tileSize; tx++) {
        const shade = (tx + ty) % 2 === 0 ? shade0 : shade1;
        this.add.rectangle(tx * tileSize + tileSize / 2, ty * tileSize + tileSize / 2, tileSize, tileSize, shade);
      }
    }
  }
}
