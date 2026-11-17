import Phaser from 'phaser';
import { DialogueBox } from '@/ui/DialogueBox';
import { DeckPanel } from '@/ui/DeckPanel';
import { EndScreen } from '@/ui/EndScreen';
import { NarrativeOverlay } from '@/ui/NarrativeOverlay';
import { ZoneBanner } from '@/ui/ZoneBanner';
import { Hud } from '@/ui/Hud';
import { JournalPanel, type JournalEntry } from '@/ui/JournalPanel';
import { SaveSystem } from '@/systems/SaveSystem';
import type { XpChange } from '@/systems/XpSystem';
import type { ProgressSnapshot } from '@/types/Progress';
import { GameEvents } from '@/systems/GameEvents';
import type { CardData } from '@/types/CardData';
import { ContentLoader } from '@/systems/ContentLoader';
import { createScanlineOverlay } from '@/ui/uiKit';
import { EventScope } from '@/systems/EventScope';

/** Scanline overlay depth — above every other UIScene display object. */
const SCANLINE_DEPTH = 10000;

/**
 * UIScene — persistent overlay scene running on top of ZoneScene.
 *
 * Hosts the three singleton-style UI overlays from Unity:
 *  - DialogueBox (equivalent of Unity's DialogueBox singleton auto-spawned in Canvas)
 *  - DeckPanel   (equivalent of DeckUI singleton)
 *  - EndScreen   (equivalent of EndScreenUI singleton)
 *
 * Communication with ZoneScene (and other game scenes) happens via
 * `this.game.events` (the global Phaser event emitter) using GameEvents constants.
 * This avoids tight scene-to-scene coupling.
 *
 * UIScene is launched by MainMenuScene via `scene.launch('UIScene')` alongside
 * ZoneScene so it renders above it (scenes later in the list render on top).
 */
export class UIScene extends Phaser.Scene {
  private dialogueBox!: DialogueBox;
  private deckPanel!: DeckPanel;
  private endScreen!: EndScreen;
  /** Fullscreen intro overlay — shown once on new game before zone_01 (TASK-026). */
  private narrativeOverlay!: NarrativeOverlay;
  /** Non-blocking zone-entry banner (TASK-026). */
  private zoneBanner!: ZoneBanner;
  /** Top bar: XP counter + zone / game progress (feat/xp-progress). */
  private hud!: Hud;
  /** Global-bus listeners of this UIScene run — removed on SHUTDOWN. */
  private scope!: EventScope;
  /** Question journal (J). */
  private journalPanel!: JournalPanel;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    // UI components — all invisible by default
    this.dialogueBox = new DialogueBox(this);
    this.deckPanel = new DeckPanel(this);
    this.endScreen = new EndScreen(this);
    // Narration components (TASK-026)
    this.narrativeOverlay = new NarrativeOverlay(this);
    this.zoneBanner = new ZoneBanner(this);

    // Subtle CRT scanlines on top of every UI layer — purely decorative,
    // non-interactive (Graphics has no input unless setInteractive is called).
    const { width, height } = this.scale;
    createScanlineOverlay(this, width, height).setDepth(SCANLINE_DEPTH);

    // Persistent controls hint, bottom-left — the game had no way to discover
    // the Escape-to-menu exit (or T/M) without reading the code.
    this.add
      .text(12, height - 10, ContentLoader.getInstance().getString('hud.controls'), {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#9fb8a8',
      })
      .setOrigin(0, 1)
      .setAlpha(0.75)
      .setDepth(SCANLINE_DEPTH - 1);
    const cl = ContentLoader.getInstance();
    this.hud = new Hud(this, {
      xp: cl.getString('hud.xp'),
      strata: cl.getString('strata.label'),
      zoneProgress: cl.getString('hud.zoneProgress'),
      globalProgress: cl.getString('hud.globalProgress'),
    });
    // Show the saved total right away; ZoneScene refreshes it on zone entry.
    this.hud.setXp(SaveSystem.getInstance().getXp(), 0);
    // Hidden during the intro overlay — revealed on the first zone progress event.
    this.hud.setVisible(false);

    this.journalPanel = new JournalPanel(this, {
      title: cl.getString('journal.title'),
      empty: cl.getString('journal.empty'),
      hint: cl.getString('journal.hint'),
      resolved: cl.getString('journal.resolved'),
      pending: cl.getString('journal.pending'),
    }, () => this.game.events.emit(GameEvents.JOURNAL_CLOSE));

    // UIScene is stopped on "Menu principal" and launched again on "Jouer":
    // without this, every round trip stacked one more copy of each handler.
    this.scope = new EventScope(this.game.events);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scope.clear());
    this._bindEvents();
  }

  // ---------------------------------------------------------------------------
  // Event wiring — listens on the global game event bus
  // ---------------------------------------------------------------------------

  private _bindEvents(): void {
    const cl = ContentLoader.getInstance();

    // ---- Dialogue ----

    // Open dialogue box with given payload
    this.scope.on(GameEvents.DIALOGUE_OPEN, (data: { speakerName: string; line: string; portrait?: string; hint?: string; npcId?: string }) => {
      this.dialogueBox.show(data.speakerName, data.line, data.hint ?? cl.getString('dialogue.continue'), data.npcId);
    });

    // Close dialogue box (used by locked-door single-line messages after E press)
    this.scope.on(GameEvents.DIALOGUE_CLOSE, () => {
      if (this.dialogueBox.isOpen()) {
        this.dialogueBox.hide();
      }
    });

    // ESC / close button: the conversation was aborted — hide whichever
    // conversation overlay is open (dialogue line or card selection).
    this.scope.on(GameEvents.DIALOGUE_CANCEL, () => {
      if (this.dialogueBox.isOpen()) this.dialogueBox.hide();
      if (this.deckPanel.isOpen()) this.deckPanel.close();
    });

    // ---- Deck ----

    // Open deck panel — payload: { cards, npcId }
    this.scope.on(GameEvents.DECK_OPEN, (data: { cards: CardData[]; npcId: string; question?: string }) => {
      this.deckPanel.open(
        data.cards,
        cl.getString('deck.title'),
        (card: CardData) => {
          // Close panel first, then emit pick event so ZoneScene processes it
          this.deckPanel.close();
          this.game.events.emit(GameEvents.DECK_CARD_PICKED, { cardId: card.id, npcId: data.npcId });
        },
        cl.getString('deck.close'),
        () => this.game.events.emit(GameEvents.DIALOGUE_CANCEL_REQUEST),
      );
      this.deckPanel.setSubtitle(
        data.question ? `« ${data.question} »   ${cl.getString('deck.backHint')}` : '',
      );
    });

    // ← / Backspace from the card selection: back to the question line
    this.scope.on(GameEvents.DECK_CLOSE, () => {
      if (this.deckPanel.isOpen()) this.deckPanel.close();
    });

    // ---- Journal (feat/question-history) ----
    this.scope.on(GameEvents.JOURNAL_OPEN, (entries: JournalEntry[]) => {
      this.journalPanel.open(entries);
    });

    // ---- End screen ----

    this.scope.on(GameEvents.END_SCREEN_SHOW, (data: { message: string }) => {
      this.endScreen.show(data.message);
    });

    // END_REPLAY / END_MENU are emitted by EndScreen buttons directly to game.events
    // and handled by ZoneScene / the scene manager — UIScene itself doesn't need to re-route.

    // When the zone restarts or we go to menu, stop UIScene cleanly
    this.scope.on(GameEvents.END_REPLAY, () => {
      this.endScreen.hide();
    });

    this.scope.on(GameEvents.END_MENU, () => {
      this.endScreen.hide();
      // UIScene shuts down when ZoneScene stops; no extra cleanup needed
    });

    // ---- HUD (feat/xp-progress) ----

    this.scope.on(GameEvents.XP_CHANGED, (change: XpChange) => {
      this.hud.setXp(change.xp, change.delta);
    });

    this.scope.on(GameEvents.PROGRESS_CHANGED, (snapshot: ProgressSnapshot) => {
      this.hud.setVisible(true);
      this.hud.setProgress(snapshot);
    });

    // ---- Narration (TASK-026) ----

    // INTRO_SHOW: new game only — show fullscreen intro slides before zone_01.
    // Payload: { onComplete: () => void } — MainMenuScene passes the callback
    // that launches ZoneScene once the intro is dismissed.
    this.scope.on(GameEvents.INTRO_SHOW, (payload: { onComplete: () => void }) => {
      const narrative = cl.getNarrative();
      const hint = cl.getString('narrative.hint');
      this.narrativeOverlay.show(narrative.intro, hint, payload.onComplete);
    });

    // ZONE_BANNER_SHOW: non-blocking banner on each zone entry (TASK-026).
    // Payload: { zoneId: string } — ZoneScene emits this in create().
    this.scope.on(GameEvents.ZONE_BANNER_SHOW, (payload: { zoneId: string }) => {
      const narrative = cl.getNarrative();
      const lines = narrative.zoneIntros[payload.zoneId] ?? [];
      this.zoneBanner.show(lines);
    });
  }

  /**
   * Expose DialogueBox hide so ZoneScene's E-key handler can close
   * dialogue after showing hint/thanks lines.
   */
  advanceDialogue(): void {
    this.game.events.emit(GameEvents.DIALOGUE_ADVANCE);
  }
}
