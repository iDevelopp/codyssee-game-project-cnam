import Phaser from 'phaser';
import { DialogueBox } from '@/ui/DialogueBox';
import { DeckPanel } from '@/ui/DeckPanel';
import { EndScreen } from '@/ui/EndScreen';
import { NarrativeOverlay } from '@/ui/NarrativeOverlay';
import { ZoneBanner } from '@/ui/ZoneBanner';
import { GameEvents } from '@/systems/GameEvents';
import type { CardData } from '@/types/CardData';
import { ContentLoader } from '@/systems/ContentLoader';

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

    this._bindEvents();
  }

  // ---------------------------------------------------------------------------
  // Event wiring — listens on the global game event bus
  // ---------------------------------------------------------------------------

  private _bindEvents(): void {
    const ev = this.game.events;
    const cl = ContentLoader.getInstance();

    // ---- Dialogue ----

    // Open dialogue box with given payload
    ev.on(GameEvents.DIALOGUE_OPEN, (data: { speakerName: string; line: string; portrait?: string; hint?: string }) => {
      this.dialogueBox.show(data.speakerName, data.line, data.portrait, data.hint ?? cl.getString('dialogue.continue'));
    });

    // Close dialogue box (used by locked-door single-line messages after E press)
    ev.on(GameEvents.DIALOGUE_CLOSE, () => {
      if (this.dialogueBox.isOpen()) {
        this.dialogueBox.hide();
      }
    });

    // ---- Deck ----

    // Open deck panel — payload: { cards, npcId }
    ev.on(GameEvents.DECK_OPEN, (data: { cards: CardData[]; npcId: string }) => {
      this.deckPanel.open(
        data.cards,
        cl.getString('deck.title'),
        (card: CardData) => {
          // Close panel first, then emit pick event so ZoneScene processes it
          this.deckPanel.close();
          this.game.events.emit(GameEvents.DECK_CARD_PICKED, { cardId: card.id, npcId: data.npcId });
        },
      );
    });

    // ---- End screen ----

    ev.on(GameEvents.END_SCREEN_SHOW, (data: { message: string }) => {
      this.endScreen.show(data.message);
    });

    // END_REPLAY / END_MENU are emitted by EndScreen buttons directly to game.events
    // and handled by ZoneScene / the scene manager — UIScene itself doesn't need to re-route.

    // When the zone restarts or we go to menu, stop UIScene cleanly
    ev.on(GameEvents.END_REPLAY, () => {
      this.endScreen.hide();
    });

    ev.on(GameEvents.END_MENU, () => {
      this.endScreen.hide();
      // UIScene shuts down when ZoneScene stops; no extra cleanup needed
    });

    // ---- Narration (TASK-026) ----

    // INTRO_SHOW: new game only — show fullscreen intro slides before zone_01.
    // Payload: { onComplete: () => void } — MainMenuScene passes the callback
    // that launches ZoneScene once the intro is dismissed.
    ev.on(GameEvents.INTRO_SHOW, (payload: { onComplete: () => void }) => {
      const narrative = cl.getNarrative();
      const hint = cl.getString('narrative.hint');
      this.narrativeOverlay.show(narrative.intro, hint, payload.onComplete);
    });

    // ZONE_BANNER_SHOW: non-blocking banner on each zone entry (TASK-026).
    // Payload: { zoneId: string } — ZoneScene emits this in create().
    ev.on(GameEvents.ZONE_BANNER_SHOW, (payload: { zoneId: string }) => {
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
