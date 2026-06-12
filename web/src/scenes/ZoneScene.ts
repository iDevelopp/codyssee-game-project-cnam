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
 * ZoneScene — the main gameplay scene.
 *
 * Responsibilities:
 *  - Render the tilemap background (or coloured placeholder if no Tiled JSON).
 *  - Spawn Player, NPCs, and Doors from zone content data.
 *  - Wire up all systems: InteractionSystem, DeckSystem, ProgressionSystem, SaveSystem.
 *  - Handle keyboard input: ZQSD + arrows for movement, E for interaction.
 *  - React to game events: card picked, NPC resolved, all-helped, end-replay, end-menu.
 *  - Expose getAllCards() so NPC can pass all cards to DeckPanel.
 *
 * UIScene runs in parallel (launched by MainMenuScene) and handles all overlays.
 * Cross-scene communication is via this.game.events (global event bus).
 *
 * Zone loaded: first zone from content/zones/index.json (ADR-002, data-driven).
 * Multi-zone navigation will pass the target id via scene data (future task).
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

  /** Zone data loaded from ContentLoader. */
  private zoneData!: ZoneData;

  constructor() {
    super({ key: 'ZoneScene' });
  }

  // ---------------------------------------------------------------------------
  // Scene lifecycle
  // ---------------------------------------------------------------------------

  create(): void {
    const cl = ContentLoader.getInstance();
    const save = SaveSystem.getInstance();

    // ---- Load save first so restore state is available ----
    save.load();

    // ---- Zone data ----
    // Load the first zone from the index (data-driven, ADR-002).
    // ZoneScene always starts at the first zone; multi-zone navigation will
    // pass the target zone id via scene data when implemented (TASK-future).
    const firstZone = cl.getZones()[0];
    if (!firstZone) {
      throw new Error('ZoneScene: no zones found. Add at least one id to content/zones/index.json.');
    }
    this.zoneData = firstZone;
    const { width, height } = this.scale;

    // ---- Background ----
    // Placeholder: tiled background using the tile atlas image directly.
    // A real Tiled JSON tilemap loader can be wired here by agent-infra/contenu.
    this.cameras.main.setBackgroundColor('#1a2a1a');
    this._drawPlaceholderMap(width, height);

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

    // Deck: initialise from save or from ContentLoader default
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
    const helpedIds = new Set(save.getHelpedNpcIds());

    // Count quest NPCs (those with a question) for ProgressionSystem
    let questNPCCount = 0;
    for (const npcId of questNPCIds) {
      const npcData = cl.getNpc(npcId);
      if (npcData?.question) questNPCCount++;
    }

    this.progression = new ProgressionSystem(this.game.events, questNPCCount);

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
    // We read the ZoneScene-local edge detector ONLY after InteractionSystem has updated its
    // own wasEDown, so both detectors stay in sync on the same physical key object.
    const eDown = this.eKey.isDown;
    const eJustPressed = eDown && !this.wasEDown;
    this.wasEDown = eDown;

    // Guard: skip if InteractionSystem already consumed this press (prevents double-fire).
    // Also skip if input is not locked — when unlocked, InteractionSystem handles everything.
    if (eJustPressed && InputLock.isLocked() && !interactionFired) {
      // Emit DIALOGUE_ADVANCE for any listeners (e.g. UIScene door-message dismiss).
      this.game.events.emit(GameEvents.DIALOGUE_ADVANCE);

      // Advance the NPC that is currently mid-dialogue.
      // Use isBusy() — independent of InputLock — so we correctly identify the
      // active NPC even though InputLock is set (it was set by this very NPC's
      // _beginDialogue() call moments ago). Using !canInteract() would be wrong
      // here because !canInteract() returns true for ALL idle NPCs once locked.
      for (const npc of this.npcs) {
        if (npc.isBusy()) {
          // Bypass InteractionSystem (locked); drive the NPC's state machine directly.
          npc.interact();
          break; // only one NPC can be active at a time
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
      // Record in save
      save.recordNpcHelped(payload.npcId);
    });

    // All NPCs helped → record door as unlocked in save
    ev.on(GameEvents.ALL_NPCS_HELPED, () => {
      for (const doorData of this.zoneData.doors) {
        save.recordDoorUnlocked(doorData.id);
      }
    });

    // Rejouer: restart the zone (keep save — Rejouer does NOT reset progress)
    ev.on(GameEvents.END_REPLAY, () => {
      // Remove all event listeners we added to avoid leaks on restart
      this._unbindEvents();
      this.scene.restart();
    });

    // Menu principal: stop zone, stop UI overlay, go to main menu
    ev.on(GameEvents.END_MENU, () => {
      this._unbindEvents();
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
    });
  }

  /** Remove zone-specific event listeners before restart/stop to prevent leaks. */
  private _unbindEvents(): void {
    const ev = this.game.events;
    ev.removeAllListeners('npc-reward-card');
    ev.removeAllListeners(GameEvents.END_REPLAY);
    ev.removeAllListeners(GameEvents.END_MENU);
    // Note: ALL_NPCS_HELPED, NPC_RESOLVED etc. are re-wired on create()
    // Removing them here prevents stale handlers from ProgressionSystem
    ev.removeAllListeners(GameEvents.ALL_NPCS_HELPED);
    ev.removeAllListeners(GameEvents.NPC_RESOLVED);
    ev.removeAllListeners(GameEvents.DECK_CARD_PICKED);
  }

  // ---------------------------------------------------------------------------
  // Private — visual helpers
  // ---------------------------------------------------------------------------

  /**
   * Draw a simple tiled placeholder background using the tile atlas image.
   * In J1, no Tiled JSON tilemap is loaded — this gives a visual floor.
   * Agent-infra can replace this with a proper TilemapJSONFile loader.
   */
  private _drawPlaceholderMap(width: number, height: number): void {
    // Fill a 2× oversized area with tiled texture pattern
    const mapW = width * 2;
    const mapH = height * 2;
    const tileSize = 32;

    for (let ty = 0; ty < mapH / tileSize; ty++) {
      for (let tx = 0; tx < mapW / tileSize; tx++) {
        // Checkerboard using two shades of green for a grass-like feel
        const shade = (tx + ty) % 2 === 0 ? 0x2d5a1b : 0x264d17;
        this.add.rectangle(tx * tileSize + tileSize / 2, ty * tileSize + tileSize / 2, tileSize, tileSize, shade);
      }
    }
  }
}
