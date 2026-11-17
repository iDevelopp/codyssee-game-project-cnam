import Phaser from 'phaser';
import { Player } from '@/entities/Player';
import { NPC } from '@/entities/NPC';
import { Door } from '@/entities/Door';
import { ContentLoader } from '@/systems/ContentLoader';
import { InteractionSystem } from '@/systems/InteractionSystem';
import { MapBuilder } from '@/systems/MapBuilder';
import { DeckSystem } from '@/systems/DeckSystem';
import { ProgressionSystem } from '@/systems/ProgressionSystem';
import { SaveSystem } from '@/systems/SaveSystem';
import { InputLock } from '@/systems/InputLock';
import { GameEvents } from '@/systems/GameEvents';
import { AudioManager } from '@/systems/AudioManager';
import { XpSystem } from '@/systems/XpSystem';
import { EventScope } from '@/systems/EventScope';
import type { CardData } from '@/types/CardData';
import type { ZoneData, ZoneTheme } from '@/types/ZoneData';
import type { ProgressSnapshot } from '@/types/Progress';

/**
 * Default zone theme, used when a zone JSON predates the `theme` schema
 * (phase 2 art overhaul). Matches the deep-space codysse.fr identity
 * (src/ui/theme.ts) so untouched zones still look coherent.
 *
 * Replaces the old ERA_BACKGROUND/ERA_TILE_SHADES engine-hardcoded dicts —
 * colours are now authored per zone in content/zones/zone_0X.json.
 */
const DEFAULT_THEME: ZoneTheme = {
  background: '#0b1420',
  ambient: '#102030',
  ambientAlpha: 0.22,
  accent: '#3dfc8e',
};

/**
 * Normalise a theme hex string to always include the leading '#' — authors
 * may write either "0b1420" or "#0b1420" (see ZoneTheme doc comment).
 */
function _normalizeHex(hex: string): string {
  return hex.startsWith('#') ? hex : `#${hex}`;
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
 *   Every listener this zone adds to the global bus (its own, and those of its
 *   NPCs, Doors and ProgressionSystem) goes through `this.scope` (EventScope).
 *   On zone exit / restart the scope removes exactly those listeners — never
 *   the ones owned by long-lived systems such as AudioManager or UIScene.
 */
export class ZoneScene extends Phaser.Scene {
  // ---- Entities ----
  private player!: Player;
  private npcs: NPC[] = [];
  private doors: Door[] = [];

  /** Walls tilemap layer (collidable), when the active zone has `map` data. */
  private wallsLayer?: Phaser.Tilemaps.TilemapLayer;

  // ---- Systems ----
  private interaction!: InteractionSystem;
  private deck!: DeckSystem;
  private progression!: ProgressionSystem;
  private xp!: XpSystem;

  /** Global-bus listeners owned by this zone run (cleared on exit). */
  private scope!: EventScope;

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

  /** T key — timeline frieze toggle (single-press guard). */
  private tKey!: Phaser.Input.Keyboard.Key;

  /** Whether T was down last frame (single-press guard). */
  private wasTDown = false;

  /** ESC — leaves the active conversation; otherwise exits to the main menu. */
  private escKey!: Phaser.Input.Keyboard.Key;

  /** Whether Escape was down last frame (single-press guard). */
  private wasEscDown = false;

  /** Whether the timeline frieze is currently open (to avoid double-toggle). */
  private timelineOpen = false;

  /**
   * Scene key to return to on Escape, when set via scene.start data.
   * Undefined = standard main-menu exit. Set by EditorScene test plays (J6).
   */
  private returnTo?: string;

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
    this.wallsLayer = undefined;

    // Fresh listener scope for this zone run; cleared on SHUTDOWN, which
    // Phaser emits on scene.start() of another zone, a restart, or stop().
    this.scope = new EventScope(this.game.events);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scope.clear());
    this.transitioning = false;
    this.wasEDown = false;
    this.wasMDown = false;
    this.wasTDown = false;
    this.wasEscDown = false;
    this.timelineOpen = false;
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
    // returnTo (optional) — scene key to return to on Escape. Used by the
    // level editor's test-play loop: Escape brings the user back to the
    // editor instead of the main menu (J6).
    const sceneData = this.scene.settings.data as { zoneId?: string; returnTo?: string } | undefined;
    const requestedId = sceneData?.zoneId;
    this.returnTo = sceneData?.returnTo;

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

    // ---- Zone music ----
    // init() is idempotent — needed here for the direct-to-zone path (page
    // reload resume) where MainMenuScene.create() may not have run yet.
    AudioManager.getInstance().init(this);
    if (this.zoneData.music) {
      AudioManager.getInstance().playMusic(this.zoneData.music);
    }

    // Reset transition guard each time the scene starts
    this.transitioning = false;

    // ---- Theme (phase 2) ----
    // Falls back to DEFAULT_THEME when the zone JSON predates the `theme` schema.
    this._applyTheme(this.zoneData.theme ?? DEFAULT_THEME);

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

    // T key — timeline frieze toggle (TASK-023)
    this.tKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);

    // Escape — leave the current conversation (no more "tunnel" dialogues),
    // or exit to the main menu when nothing is open (progress is saved continuously)
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    // ---- Player ----
    const spawn = this.zoneData.spawn;
    this.player = new Player(this, spawn.x, spawn.y);

    // ---- Map (tilemap layers + props if `map` data present, else placeholder floor) ----
    // Built after the player exists so solid props/walls can collide with it immediately.
    // Rendering itself lives in MapBuilder (shared with the level editor — J6).
    let worldWidth: number;
    let worldHeight: number;
    if (this.zoneData.map) {
      const built = MapBuilder.build(this, this.zoneData, this.player);
      this.wallsLayer = built.wallsLayer;
      worldWidth = built.worldWidth;
      worldHeight = built.worldHeight;
    } else {
      const { width, height } = this.scale;
      this._drawPlaceholderMap(width, height, this.zoneData.themeEra);
      worldWidth = width * 2;
      worldHeight = height * 2;
    }

    // ---- Camera ----
    // Follow player with lerp ≈ 0.15 (matches Unity CameraFollow smoothTime=0.15)
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    // ---- Systems ----
    this.interaction = new InteractionSystem(this);
    this.xp = new XpSystem(this.game.events);

    // Deck: initialise from save or from ContentLoader default.
    // Deck is GLOBAL across zones — cards earned in zone_01 carry over to zone_02.
    this.deck = new DeckSystem();
    const savedDeckIds = save.getDeckCardIds();
    if (savedDeckIds.length > 0) {
      this.deck.restoreFromIds(savedDeckIds, cl.getCards());
    } else {
      // Fresh game: seed the initial deck and immediately persist it so
      // TimelineScene.getDeckCardIds() sees the 4 starter cards on first open.
      // (onCardAdded is not fired by init() — it only fires on add() — so we
      // must write manually here. Zone transitions always hit the if-branch above
      // because at least the initial cards were saved here, so earned cards are safe.)
      this.deck.init(cl.getInitialDeckCards());
      save.saveDeck(this.deck.listIds());
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

    this.progression = new ProgressionSystem(this.game.events, questNPCCount, zoneQuestNpcIdSet, this.scope);

    for (const npcId of questNPCIds) {
      let npcData = cl.getNpc(npcId);
      if (!npcData) {
        console.warn(`ZoneScene: NPC "${npcId}" not found in npcs.json`);
        continue;
      }

      // Per-zone position override (editor/fan zones, J6): clone the npc data
      // so the shared npcs.json object is never mutated.
      const override = this.zoneData.npcPositions?.[npcId];
      if (override) {
        npcData = { ...npcData, position: { ...override } };
      }

      const npc = new NPC(this, npcData, this.scope);
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
      const door = new Door(this, doorData, this.scope);
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
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);

    // ---- Player ↔ walls collision (only when the zone has tilemap data) ----
    if (this.wallsLayer) {
      this.physics.add.collider(this.player, this.wallsLayer);
    }

    // Make sure InputLock starts clean (in case UIScene leaked a lock from prev run)
    InputLock.unlock();

    // ---- Fade in on zone entry ----
    // Provides the visual counterpart to the fade-out on exit.
    this.cameras.main.fadeIn(300, 0, 0, 0);

    // ---- Zone-entry banner (TASK-026) ----
    // Non-blocking: does not set InputLock. Shows zoneIntros[zoneId] from
    // narrative.json as a fade banner in UIScene. Emitted after the scene is
    // fully set up so UIScene can safely render it above the zone.
    this.game.events.emit('zone-banner-show', { zoneId: this.zoneData.id });

    // ---- HUD initial state (XP total + progress bars) ----
    this.xp.refresh();
    this._emitProgress();
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

    // T key: toggle timeline frieze (single-press — rising edge only).
    // Mirror the M-key guard pattern: rising-edge detection prevents
    // repeated toggling while the key is held.
    const tDown = this.tKey.isDown;
    const tJustPressed = tDown && !this.wasTDown;
    this.wasTDown = tDown;
    if (tJustPressed && !this.timelineOpen) {
      // Only open if no other overlay holds the lock (e.g. dialogue, deck)
      if (!InputLock.isLocked()) {
        this.timelineOpen = true;
        this.game.events.emit(GameEvents.TIMELINE_OPEN, this.deck);
      }
    }

    // Escape (rising edge only). The timeline frieze handles its own ESC.
    //  - A conversation is open (lock held): abort it — no more "tunnel".
    //  - Nothing open: exit to the main menu.
    // Other locked overlays (end screen, intro) are left alone: the cancel
    // routine is a no-op when no NPC/door conversation is active.
    const escDown = this.escKey.isDown;
    const escJustPressed = escDown && !this.wasEscDown;
    this.wasEscDown = escDown;
    if (escJustPressed && !this.timelineOpen) {
      if (InputLock.isLocked()) {
        this._cancelActiveConversation();
      } else {
        this._exitToMenu();
        return;
      }
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
   * Returns the cards available as answers in this zone.
   *
   * Progressive pool: the union of `cardPool` over all zones up to and
   * including the current one (zone index order = progression order), so the
   * player starts with a handful of languages and unlocks more toward the
   * final zone instead of seeing all 19 cards from the start.
   *
   * Falls back to the full catalog when any zone in range predates the
   * `cardPool` schema — the game must never become unanswerable.
   *
   * @returns Cards NPC passes to DeckPanel when asking a question
   */
  getAllCards(): CardData[] {
    const cl = ContentLoader.getInstance();
    const all = cl.getCards();

    const zones = cl.getZones();
    const idx = zones.findIndex((z) => z.id === this.zoneData.id);
    const unlocked = idx >= 0 ? zones.slice(0, idx + 1) : zones;
    if (unlocked.some((z) => !z.cardPool)) return all;

    const ids = new Set(unlocked.flatMap((z) => z.cardPool!));
    return all.filter((c) => ids.has(c.id));
  }

  /**
   * Returns the player's current world position.
   * NPC calls this to compute which idle frame to face when dialogue starts.
   *
   * @returns Player's {x, y} in world space
   */
  getPlayerPosition(): { x: number; y: number } {
    return { x: this.player.x, y: this.player.y };
  }

  // ---------------------------------------------------------------------------
  // Private — progress (HUD)
  // ---------------------------------------------------------------------------

  /**
   * Compute where the player stands (zone n/N, NPCs helped here and overall)
   * and broadcast it for the HUD. Only quest NPCs (with a question) count.
   */
  private _emitProgress(): void {
    const cl = ContentLoader.getInstance();
    const helped = new Set(SaveSystem.getInstance().getHelpedNpcIds());
    const zones = cl.getZones();

    const isQuest = (npcId: string): boolean => !!cl.getNpc(npcId)?.question;

    let globalTotal = 0;
    let globalHelped = 0;
    for (const zone of zones) {
      for (const npcId of zone.npcs) {
        if (!isQuest(npcId)) continue;
        globalTotal++;
        if (helped.has(npcId)) globalHelped++;
      }
    }

    const zoneQuest = this.zoneData.npcs.filter(isQuest);
    const snapshot: ProgressSnapshot = {
      zoneIndex: zones.findIndex((z) => z.id === this.zoneData.id) + 1,
      zoneCount: zones.length,
      zoneName: this.zoneData.displayName,
      themeEra: this.zoneData.themeEra,
      zoneHelped: zoneQuest.filter((id) => helped.has(id)).length,
      zoneTotal: zoneQuest.length,
      globalHelped,
      globalTotal,
    };
    this.game.events.emit(GameEvents.PROGRESS_CHANGED, snapshot);
  }

  // ---------------------------------------------------------------------------
  // Private — conversation abort (ESC)
  // ---------------------------------------------------------------------------

  /**
   * Abort whichever NPC conversation or door message is in progress and ask
   * UIScene to hide the dialogue box / deck panel. No-op when nothing is
   * active, so ESC never closes unrelated overlays (intro, end screen).
   */
  private _cancelActiveConversation(): void {
    let cancelled = false;
    for (const npc of this.npcs) {
      if (npc.cancel()) cancelled = true;
    }
    for (const door of this.doors) {
      if (door.cancel()) cancelled = true;
    }
    if (cancelled) {
      this.game.events.emit(GameEvents.DIALOGUE_CANCEL);
    }
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
  /**
   * Exit the zone back to the main menu (Escape key).
   *
   * Progress needs no explicit save here — deck, helped NPCs and current zone
   * are persisted as they change. Stops the parallel overlay scenes
   * (UIScene/TimelineScene) so the menu owns the screen; MainMenuScene
   * relaunches them on the next play. Reuses the door-transition fade +
   * `transitioning` guard so Escape can't double-fire or race a door exit.
   */
  private _exitToMenu(): void {
    if (this.transitioning) return;
    this.transitioning = true;

    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this._unbindEvents();
      this.scene.stop('UIScene');
      this.scene.stop('TimelineScene');
      // Editor test play: return to the editor, not the menu (J6).
      if (this.returnTo === 'EditorScene') {
        this.scene.start('EditorScene');
      } else {
        this.scene.start('MainMenuScene');
      }
    });
  }

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
    const ev = this.game.events; // for emit() only — subscribe via this.scope
    const save = SaveSystem.getInstance();
    const cl = ContentLoader.getInstance();

    // NPC reward: add the answered card to player deck + XP
    this.scope.on('npc-reward-card', (payload: { npcId: string; cardId: string; wrongAttempts?: number }) => {
      const card = cl.getCard(payload.cardId);
      if (card) {
        this.deck.add(card);
      }
      const economy = cl.getEconomy();
      const firstTry = (payload.wrongAttempts ?? 0) === 0;
      this.xp.gain(
        firstTry ? economy.xp.correctFirstTry : economy.xp.correctAfterRetry,
        firstTry ? 'npc-correct-first-try' : 'npc-correct',
      );
      save.recordNpcHelped(payload.npcId);
      this._emitProgress();
    });

    // All NPCs helped → record door as unlocked in save.
    // Zone-clear bonus only the first time the door opens: on a reload the
    // door is already in the save (ProgressionSystem re-emits this event from
    // restoreResolved), so no XP is granted twice.
    this.scope.on(GameEvents.ALL_NPCS_HELPED, () => {
      let firstClear = false;
      for (const doorData of this.zoneData.doors) {
        if (!save.isDoorUnlocked(doorData.id)) firstClear = true;
        save.recordDoorUnlocked(doorData.id);
      }
      if (firstClear) {
        this.xp.gain(cl.getEconomy().xp.zoneCleared, 'zone-cleared');
      }
    });

    // Door exit triggered: transition to next zone (or end screen if final zone)
    this.scope.on(GameEvents.ZONE_TRANSITION, (payload: { nextZoneId: string | undefined }) => {
      this._triggerZoneTransition(payload.nextZoneId);
    });

    // Rejouer: restart the CURRENT zone (keep save — progress is preserved).
    // Multi-zone semantics: Rejouer reloads the zone the player is in right now,
    // not zone_01. The player keeps their deck and all helped-NPC records.
    // If the door was already unlocked in save, it will show as open immediately.
    this.scope.on(GameEvents.END_REPLAY, () => {
      this._unbindEvents();
      // Restart with same zoneId so we stay on the current zone
      this.scene.start('ZoneScene', { zoneId: this.zoneData.id });
    });

    // Menu principal: stop zone, stop UI overlay, go to main menu
    this.scope.on(GameEvents.END_MENU, () => {
      this._unbindEvents();
      this.scene.stop('UIScene');
      this.scene.stop('TimelineScene');
      this.scene.start('MainMenuScene');
    });

    // GAME_COMPLETE (final zone clear): show EndScreen via UIScene
    this.scope.on(GameEvents.GAME_COMPLETE, (payload: { message: string }) => {
      ev.emit(GameEvents.END_SCREEN_SHOW, payload);
    });

    // Close button on a UI overlay (deck panel) → same path as ESC
    this.scope.on(GameEvents.DIALOGUE_CANCEL_REQUEST, () => {
      this._cancelActiveConversation();
    });

    // TIMELINE_CLOSE: the frieze was closed by T/ESC inside TimelineScene.
    // Release the open flag so T can reopen it.
    this.scope.on(GameEvents.TIMELINE_CLOSE, () => {
      this.timelineOpen = false;
      // Same race for ESC: the press that closed the frieze must not also
      // be read here as a fresh "abort conversation" press.
      this.wasEscDown = true;
      // Race guard: the T keydown that closed the frieze can land between our
      // update and TimelineScene's update. Without this, the NEXT frame would
      // see that same press as a fresh rising edge here and instantly reopen
      // the frieze. Marking T as already-down requires a release + new press.
      this.wasTDown = true;
    });
  }

  /**
   * Remove every global-bus listener owned by this zone run (its own and those
   * of its NPCs, Doors and ProgressionSystem). Also runs automatically on
   * SHUTDOWN; calling it early is safe (EventScope.clear is idempotent).
   */
  private _unbindEvents(): void {
    this.scope.clear();
  }

  // ---------------------------------------------------------------------------
  // Private — visual helpers
  // ---------------------------------------------------------------------------

  /**
   * Apply the zone's visual theme: camera background colour and an optional
   * full-screen ambient tint rectangle.
   *
   * Replaces the old ERA_BACKGROUND/ERA_TILE_SHADES engine-hardcoded dicts —
   * `theme` is authored per zone in content/zones/zone_0X.json, with
   * DEFAULT_THEME as the fallback for zones that predate this schema.
   *
   * @param theme - Zone theme (or DEFAULT_THEME fallback)
   */
  private _applyTheme(theme: ZoneTheme): void {
    this.cameras.main.setBackgroundColor(_normalizeHex(theme.background));

    if (theme.ambient) {
      const { width, height } = this.scale;
      const ambientColour = Phaser.Display.Color.HexStringToColor(_normalizeHex(theme.ambient)).color;
      const ambientRect = this.add.rectangle(width / 2, height / 2, width, height, ambientColour, theme.ambientAlpha ?? 0.2);
      // Screen-fixed (not world-space) — an atmospheric overlay that follows the camera.
      // Depth above tiles/props/entities (all negative-to-mid depths), below UI (separate scene).
      ambientRect.setScrollFactor(0);
      ambientRect.setDepth(9000);
    }
  }

  /**
   * Draw a tiled placeholder background using era-hashed colours.
   *
   * Fallback ONLY for zones that predate the `map` schema (phase 2). Once
   * every zone JSON has `map` data this path becomes dead code but is kept
   * so content and engine work can land independently without breaking
   * older zone files.
   *
   * @param width   - Scene display width
   * @param height  - Scene display height
   * @param seed    - String used to derive deterministic checkerboard shades (zone's themeEra)
   */
  private _drawPlaceholderMap(width: number, height: number, seed: string): void {
    const mapW = width * 2;
    const mapH = height * 2;
    const tileSize = 32;

    let h = 0;
    for (let i = 0; i < seed.length; i++) {
      h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }
    const shade0 = 0x101010 + (Math.abs(h) % 0x1a1a1a);
    const shade1 = 0x0a0a0a + (Math.abs(h >> 4) % 0x141414);

    for (let ty = 0; ty < mapH / tileSize; ty++) {
      for (let tx = 0; tx < mapW / tileSize; tx++) {
        const shade = (tx + ty) % 2 === 0 ? shade0 : shade1;
        this.add.rectangle(tx * tileSize + tileSize / 2, ty * tileSize + tileSize / 2, tileSize, tileSize, shade);
      }
    }
  }
}
