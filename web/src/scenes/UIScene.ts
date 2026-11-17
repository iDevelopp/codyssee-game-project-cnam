import Phaser from 'phaser';
import { DialogueBox } from '@/ui/DialogueBox';
import { DeckPanel } from '@/ui/DeckPanel';
import { EndScreen } from '@/ui/EndScreen';
import { NarrativeOverlay } from '@/ui/NarrativeOverlay';
import { ZoneBanner } from '@/ui/ZoneBanner';
import { Hud } from '@/ui/Hud';
import { Toast } from '@/ui/Toast';
import { CharacterCreator } from '@/ui/CharacterCreator';
import { personalize } from '@/systems/Personalize';
import { SpeechSystem } from '@/systems/SpeechSystem';
import { EnergySystem, type EnergyChange } from '@/systems/EnergySystem';
import { ShopPanel, type ShopItem } from '@/ui/ShopPanel';
import type { CosmeticStyle } from '@/types/Profile';
import { JournalPanel, type JournalEntry } from '@/ui/JournalPanel';
import { SaveSystem } from '@/systems/SaveSystem';
import { XpSystem, type XpChange } from '@/systems/XpSystem';
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
  /** Outfit shop (B). */
  private shopPanel!: ShopPanel;
  /** Energy wallet (some styles are paid in energy). */
  private energy!: EnergySystem;
  /** Character creation screen (first game only). */
  private creator!: CharacterCreator;
  /** Short non-blocking messages under the HUD. */
  private toast!: Toast;
  /** XP wallet for the hint shop. */
  private xp!: XpSystem;
  /**
   * Hint-shop purchases per NPC for this session, so closing and reopening
   * the deck does not make the player pay twice for the same question.
   */
  private purchases: Map<string, { eliminated: string[]; answer: boolean }> = new Map();

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

    this.xp = new XpSystem(this.game.events);
    this.purchases = new Map();
    this.toast = new Toast(this);
    this.energy = new EnergySystem(this.game.events);
    this.shopPanel = new ShopPanel(this, {
      title: cl.getString('skins.title'),
      hint: cl.getString('skins.hint'),
      equip: cl.getString('skins.equip'),
      equipped: cl.getString('skins.equipped'),
      buy: cl.getString('skins.buy'),
      xpUnit: cl.getString('hud.xp'),
      energyUnit: '⚡',
      balance: cl.getString('skins.balance'),
    }, () => this.game.events.emit(GameEvents.SKIN_SHOP_CLOSE));
    this.creator = new CharacterCreator(this, {
      title: cl.getString('creator.title'),
      nameLabel: cl.getString('creator.nameLabel'),
      namePlaceholder: cl.getString('creator.namePlaceholder'),
      nameError: cl.getString('creator.nameError'),
      pronounLabel: cl.getString('creator.pronounLabel'),
      styleLabel: cl.getString('creator.styleLabel'),
      confirm: cl.getString('creator.confirm'),
    });

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
      // NPC lines come straight from npcs.json: personalize them here
      // ({player}, "·e" agreement) — getString() already does it for UI strings.
      const line = personalize(data.line);
      this.dialogueBox.show(
        personalize(data.speakerName),
        line,
        data.hint ?? cl.getString('dialogue.continue'),
        data.npcId,
      );
      // Read the line aloud when text-to-speech is on (V)
      SpeechSystem.getInstance().speak(line);
    });

    // Close dialogue box (used by locked-door single-line messages after E press)
    this.scope.on(GameEvents.DIALOGUE_CLOSE, () => {
      if (this.dialogueBox.isOpen()) {
        this.dialogueBox.hide();
      }
      SpeechSystem.getInstance().stop();
    });

    // ESC / close button: the conversation was aborted — hide whichever
    // conversation overlay is open (dialogue line or card selection).
    this.scope.on(GameEvents.DIALOGUE_CANCEL, () => {
      SpeechSystem.getInstance().stop();
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
      this._setupShop(data.npcId, data.cards);
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

    // ---- Text-to-speech toggle (feat/tts-dialogues) ----
    this.scope.on(GameEvents.TTS_TOGGLE, () => {
      if (!SpeechSystem.isSupported()) {
        this.toast.show(cl.getString('tts.unsupported'), '#ff6666');
        return;
      }
      const on = SpeechSystem.getInstance().toggle();
      this.toast.show(cl.getString(on ? 'tts.on' : 'tts.off'), on ? '#66ff66' : '#c0c0e8');
      if (on) SpeechSystem.getInstance().speak(cl.getString('tts.on'));
    });

    // ---- Skins shop (feat/skins-shop) ----
    this.scope.on(GameEvents.SKIN_SHOP_OPEN, () => this._openShop());

    // ---- Character creation ----
    this.scope.on(GameEvents.CHARACTER_CREATE, (payload: { onComplete: () => void }) => {
      const free = cl.getStyles().filter((st) => st.price === 0);
      this.creator.open(free, (profile) => {
        SaveSystem.getInstance().setProfile(profile);
        payload.onComplete();
      });
    });

    // ---- HUD (feat/xp-progress) ----

    this.scope.on(GameEvents.XP_CHANGED, (change: XpChange) => {
      this.hud.setXp(change.xp, change.delta);
      this._refreshBalance();
    });

    this.scope.on(GameEvents.ENERGY_CHANGED, (change: EnergyChange) => {
      this.hud.setEnergy(change.energy, change.max, cl.getEconomy().energy.lowThreshold);
    });

    this.scope.on(GameEvents.TOAST, (msg: { text: string; color?: string }) => {
      this.toast.show(msg.text, msg.color);
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
      this.narrativeOverlay.show(narrative.intro.map(personalize), hint, payload.onComplete);
    });

    // ZONE_BANNER_SHOW: non-blocking banner on each zone entry (TASK-026).
    // Payload: { zoneId: string } — ZoneScene emits this in create().
    this.scope.on(GameEvents.ZONE_BANNER_SHOW, (payload: { zoneId: string }) => {
      const narrative = cl.getNarrative();
      const lines = (narrative.zoneIntros[payload.zoneId] ?? []).map(personalize);
      this.zoneBanner.show(lines);
    });
  }

  // ---------------------------------------------------------------------------
  // Hint shop (feat/hint-shop)
  // ---------------------------------------------------------------------------

  /**
   * Wire the deck panel's shop for the NPC being answered and re-apply what
   * was already bought for that question.
   */
  private _setupShop(npcId: string, cards: CardData[]): void {
    const cl = ContentLoader.getInstance();
    const expected = cl.getNpc(npcId)?.question?.expectedCardId;
    if (!expected) {
      this.deckPanel.configureShop(null);
      return;
    }
    const { shop } = cl.getEconomy();
    const bought = this.purchases.get(npcId) ?? { eliminated: [], answer: false };
    this.purchases.set(npcId, bought);

    this.deckPanel.configureShop({
      hintLabel: cl.getString('shop.hint').replace('{cost}', String(shop.hintCost)),
      answerLabel: cl.getString('shop.answer').replace('{cost}', String(shop.answerCost)),
      hintBought: bought.eliminated.length > 0,
      answerBought: bought.answer,
      onHint: () => {
        if (bought.eliminated.length > 0 || bought.answer) return; // already useless / bought
        if (!this.xp.spend(shop.hintCost, 'shop-hint')) {
          this._denied('hint');
          return;
        }
        // Grey out a random share of the wrong cards
        const wrong = Phaser.Utils.Array.Shuffle(cards.filter((c) => c.id !== expected).map((c) => c.id));
        bought.eliminated = wrong.slice(0, Math.floor(wrong.length * shop.hintEliminateRatio));
        this.deckPanel.eliminate(bought.eliminated);
        this.deckPanel.setShopBought(true, bought.answer);
      },
      onAnswer: () => {
        if (bought.answer) return; // already bought
        if (!this.xp.spend(shop.answerCost, 'shop-answer')) {
          this._denied('answer');
          return;
        }
        bought.answer = true;
        this.deckPanel.revealAnswer(expected);
        this.deckPanel.setShopBought(true, true);
      },
    });

    this._refreshBalance();
    if (bought.eliminated.length > 0) this.deckPanel.eliminate(bought.eliminated);
    if (bought.answer) this.deckPanel.revealAnswer(expected);
  }

  // ---------------------------------------------------------------------------
  // Skins shop (feat/skins-shop)
  // ---------------------------------------------------------------------------

  private _shopItems(): ShopItem[] {
    const save = SaveSystem.getInstance();
    const owned = new Set(save.getOwnedStyleIds());
    const current = save.getProfile()?.styleId;
    return ContentLoader.getInstance().getStyles().map((style) => ({
      style,
      owned: style.price === 0 || owned.has(style.id),
      equipped: style.id === current,
    }));
  }

  private _shopBalance(): { xp: number; energy: number } {
    return { xp: this.xp.get(), energy: this.energy.get() };
  }

  private _openShop(): void {
    this.shopPanel.open(this._shopItems(), this._shopBalance(), (style) => this._shopAction(style));
  }

  /** Buy (if not owned) then equip the clicked style. */
  private _shopAction(style: CosmeticStyle): void {
    const save = SaveSystem.getInstance();
    const cl = ContentLoader.getInstance();
    const owned = style.price === 0 || save.getOwnedStyleIds().includes(style.id);

    if (!owned) {
      const paid = style.currency === 'energy'
        ? this._payEnergy(style.price)
        : this.xp.spend(style.price, 'skin-purchase');
      if (!paid) {
        this.shopPanel.flashDenied();
        this.game.events.emit(GameEvents.ACTION_DENIED);
        this.toast.show(cl.getString(style.currency === 'energy' ? 'skins.noEnergy' : 'skins.noXp'), '#ff6666');
        return;
      }
      save.recordStyleOwned(style.id);
      this.toast.show(cl.getString('skins.bought').replace('{name}', style.name), '#66ff66');
    }

    save.setStyle(style.id);
    this.game.events.emit(GameEvents.UI_CLICK);
    this.game.events.emit(GameEvents.STYLE_CHANGED, style.id);
    this.shopPanel.refresh(this._shopItems(), this._shopBalance());
  }

  /** Pay with energy; refused if the gauge is too low. */
  private _payEnergy(amount: number): boolean {
    if (this.energy.get() < amount) return false;
    this.energy.drain(amount);
    return true;
  }

  /** Update the XP balance shown in the deck's shop corner. */
  private _refreshBalance(): void {
    const cl = ContentLoader.getInstance();
    this.deckPanel.setBalance(cl.getString('shop.balance').replace('{xp}', String(this.xp.get())));
  }

  /** Purchase refused (not enough XP): red flash, "denied" cue, HUD notice. */
  private _denied(which: 'hint' | 'answer'): void {
    this.deckPanel.flashDenied(which);
    this.game.events.emit(GameEvents.ACTION_DENIED);
  }

  /**
   * Expose DialogueBox hide so ZoneScene's E-key handler can close
   * dialogue after showing hint/thanks lines.
   */
  advanceDialogue(): void {
    this.game.events.emit(GameEvents.DIALOGUE_ADVANCE);
  }
}
