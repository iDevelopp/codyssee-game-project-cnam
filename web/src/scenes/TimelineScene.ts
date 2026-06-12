import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';
import { DeckSystem } from '@/systems/DeckSystem';
import { InputLock } from '@/systems/InputLock';
import { GameEvents } from '@/systems/GameEvents';
import { SaveSystem } from '@/systems/SaveSystem';
import type { TimelineEntry } from '@/types/TimelineEntry';

// ---------------------------------------------------------------------------
// Layout constants — all in logical pixels (1280×720)
// ---------------------------------------------------------------------------

/** Y position of the timeline axis line. */
const AXIS_Y = 420;

/** Left margin before the first entry. */
const AXIS_LEFT = 80;

/** Right margin after the last entry. */
const AXIS_RIGHT = 80;

/** Total drawable width for the axis. */
const AXIS_WIDTH = 1280 - AXIS_LEFT - AXIS_RIGHT;

/** Radius of each entry node circle. */
const NODE_RADIUS = 18;

/** Y offset for entry label text above/below node (alternating to avoid overlap). */
const LABEL_OFFSET_ABOVE = 90;
const LABEL_OFFSET_BELOW = 60;

/** Decade tick mark height. */
const DECADE_TICK_H = 14;

/** Depth of the frieze overlay — must be above ZoneScene (0) + UIScene (300). */
const DEPTH_BASE = 400;

/** Color for a revealed node. */
const COLOR_REVEALED = 0x44ccff;

/** Color for a locked ("???") node. */
const COLOR_LOCKED = 0x445566;

/** Color for the axis line. */
const COLOR_AXIS = 0x88aacc;

/** Color for influence arrows between revealed nodes. */
const COLOR_INFLUENCE = 0xffcc44;

/** Background overlay alpha. */
const BG_ALPHA = 0.93;

/**
 * TimelineScene — full-screen overlay showing the chronological frieze of
 * programming languages. Rendered above ZoneScene and UIScene.
 *
 * Design:
 * - Horizontal time axis from min(year) to max(year), decade markers.
 * - Each entry is a node positioned by year on the axis.
 * - Revealed entries (cardId ∈ deckCardIds) show displayName + year + blurb
 *   (blurb on hover/select via detail panel).
 * - Locked entries show "???" and timeline.locked tooltip.
 * - Influence arrows drawn between revealed endpoints only.
 * - Counter "X / N révélés" in the header.
 *
 * Toggle: opened via TIMELINE_OPEN event or T key; closed via ESC / T / event.
 * InputLock is held while open.
 *
 * Live reveal: DeckSystem.onCardAdded pulse animation when frieze is open.
 * If closed when a card is added, state is correct on next open (reads deck).
 *
 * Empty state: if timeline.json has no entries, shows timeline.empty gracefully.
 */
export class TimelineScene extends Phaser.Scene {
  // ---- Internal state ----

  /** Whether the frieze is currently visible. */
  private isOpen = false;

  /** All timeline entries from ContentLoader, sorted by year. */
  private entries: TimelineEntry[] = [];

  /** Set of cardIds currently in the player deck (revealed entries). */
  private deckIds: Set<string> = new Set();


  // ---- Phaser display objects ----

  /** Solid dark background rectangle. */
  private bg!: Phaser.GameObjects.Rectangle;

  /** Graphics layer for axis, ticks, nodes, and influence arrows. */
  private gfx!: Phaser.GameObjects.Graphics;

  /** "X / N révélés" counter label. */
  private counterText!: Phaser.GameObjects.Text;

  /** Title text. */
  private titleText!: Phaser.GameObjects.Text;

  /** Close hint text. */
  private hintText!: Phaser.GameObjects.Text;

  /** Node circles (interactive, one per entry). */
  private nodeZones: Phaser.GameObjects.Ellipse[] = [];

  /** Entry labels (displayName + year) per node. */
  private nodeLabelTexts: Phaser.GameObjects.Text[] = [];

  /** Detail panel container shown on hover/select. */
  private detailPanel!: Phaser.GameObjects.Container;
  private detailBg!: Phaser.GameObjects.Rectangle;
  private detailText!: Phaser.GameObjects.Text;

  /** T and ESC keys for close detection. */
  private tKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;

  /** Single-press guard for T key. */
  private wasTDown = false;

  constructor() {
    super({ key: 'TimelineScene' });
  }

  // ---------------------------------------------------------------------------
  // Scene lifecycle
  // ---------------------------------------------------------------------------

  create(): void {
    const cl = ContentLoader.getInstance();

    // ---- Load and sort entries ----
    const raw = cl.getTimeline();
    this.entries = [...raw].sort((a, b) => a.year - b.year);

    // ---- Background overlay ----
    this.bg = this.add.rectangle(0, 0, 1280, 720, 0x08080f, BG_ALPHA).setOrigin(0).setDepth(DEPTH_BASE);

    // ---- Graphics layer for axis, ticks, nodes, arrows ----
    this.gfx = this.add.graphics().setDepth(DEPTH_BASE + 1);

    // ---- Title ----
    this.titleText = this.add.text(640, 28, cl.getString('timeline.title'), {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#cce8ff',
    }).setOrigin(0.5, 0).setDepth(DEPTH_BASE + 2);

    // ---- Counter ----
    this.counterText = this.add.text(1240, 30, '', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#aaccee',
    }).setOrigin(1, 0).setDepth(DEPTH_BASE + 2);

    // ---- Close hint ----
    this.hintText = this.add.text(640, 690, cl.getString('timeline.hint'), {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#667788',
    }).setOrigin(0.5, 1).setDepth(DEPTH_BASE + 2);

    // ---- Detail panel (hidden by default) ----
    this.detailBg = this.add.rectangle(640, 620, 800, 90, 0x111122, 0.95)
      .setDepth(DEPTH_BASE + 3);
    this.detailText = this.add.text(640, 620, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ddeeff',
      wordWrap: { width: 770 },
      align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH_BASE + 4);
    this.detailPanel = this.add.container(0, 0, [this.detailBg, this.detailText])
      .setDepth(DEPTH_BASE + 3);
    this.detailPanel.setVisible(false);

    // ---- Keyboard ----
    this.tKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    // ---- Event wiring ----
    // Payload is DeckSystem | null. When opened from ZoneScene (T key) the
    // DeckSystem is passed so live-reveal is wired. When opened from EndScreen
    // the scene may not have an active DeckSystem reference — null is accepted
    // and live-reveal is skipped (safe: EndScreen is shown after play ends).
    this.game.events.on(GameEvents.TIMELINE_OPEN, (deck: DeckSystem | null) => {
      this._open(deck);
    });

    // Start hidden
    this._setVisible(false);
  }

  update(): void {
    if (!this.isOpen) return;

    // T key: rising-edge single-press close
    const tDown = this.tKey.isDown;
    const tJustPressed = tDown && !this.wasTDown;
    this.wasTDown = tDown;

    if (tJustPressed || Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this._close();
    }
  }

  // ---------------------------------------------------------------------------
  // Open / Close
  // ---------------------------------------------------------------------------

  /**
   * Open the timeline frieze. Reads current deck state and registers a
   * live-reveal listener when a DeckSystem is provided.
   *
   * @param deck - Active DeckSystem instance (from ZoneScene), or null when
   *   opened from EndScreen (no live-reveal needed — game session ended).
   */
  private _open(deck: DeckSystem | null): void {
    if (this.isOpen) return;

    this._refreshDeckIds();
    this._rebuild();
    this._setVisible(true);
    this.isOpen = true;
    InputLock.lock();

    // Live reveal: when a card is added while the frieze is open, pulse it.
    // Skip when deck is null (EndScreen path — no further cards can be earned).
    if (deck) {
      deck.onCardAdded((card) => {
        if (!this.isOpen) return;
        this.deckIds.add(card.id);
        this._rebuild();
        this._pulseEntry(card.id);
      });
    }
  }

  /**
   * Close the timeline frieze and release InputLock.
   * Emits TIMELINE_CLOSE so ZoneScene knows input is freed.
   */
  private _close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this._setVisible(false);
    this.detailPanel.setVisible(false);
    InputLock.unlock();
    this.game.events.emit(GameEvents.TIMELINE_CLOSE);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  /**
   * Refresh deckIds from SaveSystem (used on open to get current state).
   * SaveSystem.getDeckCardIds() returns the authoritative persisted set.
   */
  private _refreshDeckIds(): void {
    const save = SaveSystem.getInstance();
    this.deckIds = new Set(save.getDeckCardIds());
  }

  /**
   * Rebuild the entire frieze display from scratch.
   * Called on open and after each live-reveal.
   */
  private _rebuild(): void {
    const cl = ContentLoader.getInstance();

    // Clean up previous node interactive zones
    for (const zone of this.nodeZones) {
      zone.destroy();
    }
    this.nodeZones = [];
    for (const t of this.nodeLabelTexts) {
      t.destroy();
    }
    this.nodeLabelTexts = [];

    this.gfx.clear();
    this.detailPanel.setVisible(false);

    const entries = this.entries;
    const total = entries.length;
    const revealed = entries.filter((e) => this.deckIds.has(e.cardId)).length;

    // Counter
    this.counterText.setText(`${revealed} / ${total} révélés`);

    if (total === 0) {
      // Empty state — no entries in timeline.json
      const emptyMsg = cl.getString('timeline.empty');
      this.gfx.fillStyle(0x667788, 1);
      const cx = 1280 / 2;
      const cy = 360;
      // Draw a simple placeholder indicator
      this.gfx.fillRect(cx - 300, cy - 20, 600, 40);
      // Text is handled via a temporary text object that gets cleaned in rebuild
      // We reuse counterText area for the empty message
      this.counterText.setText(emptyMsg);
      return;
    }

    // ---- Compute year range ----
    const minYear = entries[0].year;
    const maxYear = entries[entries.length - 1].year;
    const yearSpan = Math.max(maxYear - minYear, 1); // guard div/0

    /**
     * Maps a year to an X pixel coordinate on the axis.
     * Uses a linear mapping from [minYear, maxYear] → [AXIS_LEFT, 1280-AXIS_RIGHT].
     */
    const yearToX = (year: number): number =>
      AXIS_LEFT + ((year - minYear) / yearSpan) * AXIS_WIDTH;

    // ---- Draw axis line ----
    this.gfx.lineStyle(2, COLOR_AXIS, 0.8);
    this.gfx.beginPath();
    this.gfx.moveTo(AXIS_LEFT, AXIS_Y);
    this.gfx.lineTo(1280 - AXIS_RIGHT, AXIS_Y);
    this.gfx.strokePath();

    // ---- Draw decade markers ----
    const firstDecade = Math.ceil(minYear / 10) * 10;
    const lastDecade = Math.floor(maxYear / 10) * 10;
    this.gfx.lineStyle(1, COLOR_AXIS, 0.5);
    for (let decade = firstDecade; decade <= lastDecade; decade += 10) {
      const x = yearToX(decade);
      this.gfx.beginPath();
      this.gfx.moveTo(x, AXIS_Y - DECADE_TICK_H);
      this.gfx.lineTo(x, AXIS_Y + DECADE_TICK_H);
      this.gfx.strokePath();

      // Decade label
      const decLabel = this.add.text(x, AXIS_Y + DECADE_TICK_H + 6, String(decade), {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#556677',
      }).setOrigin(0.5, 0).setDepth(DEPTH_BASE + 2);
      this.nodeLabelTexts.push(decLabel);
    }

    // ---- Compute node positions (X by year, Y alternating above/below axis) ----
    // Precompute to use for influence arrows
    const nodePositions: Map<string, { x: number; y: number }> = new Map();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const x = yearToX(e.year);
      // Alternate: even-indexed entries go above axis, odd below
      const y = i % 2 === 0 ? AXIS_Y - LABEL_OFFSET_ABOVE : AXIS_Y + LABEL_OFFSET_BELOW;
      nodePositions.set(e.cardId, { x, y });
    }

    // ---- Draw influence arrows (only between revealed pairs) ----
    this.gfx.lineStyle(1, COLOR_INFLUENCE, 0.65);
    for (const entry of entries) {
      if (!this.deckIds.has(entry.cardId)) continue;
      if (!entry.influences || entry.influences.length === 0) continue;

      const toPos = nodePositions.get(entry.cardId);
      if (!toPos) continue;

      for (const sourceId of entry.influences) {
        if (!this.deckIds.has(sourceId)) continue; // source not revealed
        const fromPos = nodePositions.get(sourceId);
        if (!fromPos) continue;

        this._drawArrow(fromPos.x, fromPos.y, toPos.x, toPos.y);
      }
    }

    // ---- Draw nodes and labels ----
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const pos = nodePositions.get(entry.cardId)!;
      const isRevealed = this.deckIds.has(entry.cardId);

      // Node circle (interactive invisible zone)
      const nodeColor = isRevealed ? COLOR_REVEALED : COLOR_LOCKED;
      this.gfx.fillStyle(nodeColor, 1);
      this.gfx.fillCircle(pos.x, pos.y, NODE_RADIUS);

      // Connector line from node to axis
      this.gfx.lineStyle(1, COLOR_AXIS, 0.4);
      this.gfx.beginPath();
      this.gfx.moveTo(pos.x, AXIS_Y);
      this.gfx.lineTo(pos.x, pos.y > AXIS_Y ? pos.y - NODE_RADIUS : pos.y + NODE_RADIUS);
      this.gfx.strokePath();

      // Interactive ellipse for hover/click (transparent, just captures pointer)
      const hitZone = this.add.ellipse(pos.x, pos.y, NODE_RADIUS * 2.5, NODE_RADIUS * 2.5, 0xffffff, 0)
        .setInteractive({ useHandCursor: true })
        .setDepth(DEPTH_BASE + 2);

      const entryCapture = entry;
      hitZone.on('pointerover', () => this._showDetail(entryCapture, isRevealed, cl));
      hitZone.on('pointerout', () => { this.detailPanel.setVisible(false); });
      hitZone.on('pointerdown', () => this._showDetail(entryCapture, isRevealed, cl));
      this.nodeZones.push(hitZone);

      // Label text above/below node
      const labelText = isRevealed
        ? `${entry.language}\n${entry.year}`
        : `???\n${entry.year}`;

      const labelY = pos.y > AXIS_Y
        ? pos.y + NODE_RADIUS + 8  // below: label underneath node
        : pos.y - NODE_RADIUS - 8; // above: label above node
      const labelOriginY = pos.y > AXIS_Y ? 0 : 1;

      const lbl = this.add.text(pos.x, labelY, labelText, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: isRevealed ? '#aaeeff' : '#445566',
        align: 'center',
      }).setOrigin(0.5, labelOriginY).setDepth(DEPTH_BASE + 2);
      this.nodeLabelTexts.push(lbl);
    }
  }

  /**
   * Show the detail panel for a given entry (on hover/click).
   *
   * @param entry - The hovered timeline entry
   * @param isRevealed - Whether this entry is currently revealed
   * @param cl - ContentLoader for getString
   */
  private _showDetail(entry: TimelineEntry, isRevealed: boolean, cl: ContentLoader): void {
    const text = isRevealed
      ? `${entry.language} (${entry.year})\n${entry.blurb}`
      : cl.getString('timeline.locked');

    this.detailText.setText(text);
    this.detailPanel.setVisible(true);
  }

  /**
   * Draw an arrowhead from (x1, y1) to (x2, y2) with a small arrowhead at the target.
   *
   * @param x1 - Source X
   * @param y1 - Source Y
   * @param x2 - Target X
   * @param y2 - Target Y
   */
  private _drawArrow(x1: number, y1: number, x2: number, y2: number): void {
    // Line
    this.gfx.beginPath();
    this.gfx.moveTo(x1, y1);
    this.gfx.lineTo(x2, y2);
    this.gfx.strokePath();

    // Arrowhead — small triangle at target
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 10;
    const spread = 0.4; // radians

    const ax1 = x2 - headLen * Math.cos(angle - spread);
    const ay1 = y2 - headLen * Math.sin(angle - spread);
    const ax2 = x2 - headLen * Math.cos(angle + spread);
    const ay2 = y2 - headLen * Math.sin(angle + spread);

    this.gfx.fillStyle(COLOR_INFLUENCE, 0.75);
    this.gfx.beginPath();
    this.gfx.moveTo(x2, y2);
    this.gfx.lineTo(ax1, ay1);
    this.gfx.lineTo(ax2, ay2);
    this.gfx.closePath();
    this.gfx.fillPath();
  }

  /**
   * Play a brief scale-pulse animation on the node of the newly revealed entry.
   * Called by the DeckSystem.onCardAdded listener when the frieze is open.
   *
   * @param cardId - The card just added to the deck
   */
  private _pulseEntry(cardId: string): void {
    // Find the node hit zone matching this cardId by index
    const idx = this.entries.findIndex((e) => e.cardId === cardId);
    if (idx < 0 || idx >= this.nodeZones.length) return;

    const node = this.nodeZones[idx];
    // Scale pulse: 1 → 1.6 → 1
    this.tweens.add({
      targets: node,
      scaleX: 1.6,
      scaleY: 1.6,
      duration: 180,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  // ---------------------------------------------------------------------------
  // Visibility helper
  // ---------------------------------------------------------------------------

  /**
   * Show or hide all root-level display objects belonging to this scene.
   *
   * @param visible - Target visibility state
   */
  private _setVisible(visible: boolean): void {
    this.bg.setVisible(visible);
    this.gfx.setVisible(visible);
    this.titleText.setVisible(visible);
    this.counterText.setVisible(visible);
    this.hintText.setVisible(visible);
    this.detailPanel.setVisible(false); // always hide detail on toggle
  }
}
