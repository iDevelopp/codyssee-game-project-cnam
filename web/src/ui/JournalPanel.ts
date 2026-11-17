import Phaser from 'phaser';
import { InputLock } from '@/systems/InputLock';

/** One asked question, as listed in the journal. Built by ZoneScene. */
export interface JournalEntry {
  npcName: string;
  zoneName: string;
  question: string;
  resolved: boolean;
  /** Display name of the right card — only when resolved. */
  answerName?: string;
}

export interface JournalLabels {
  title: string;
  empty: string;
  hint: string;
  /** Prefix before the answer, e.g. "Réponse :". */
  resolved: string;
  /** Shown instead of the answer while unresolved. */
  pending: string;
}

/**
 * JournalPanel — full-screen list of every question already asked (J key).
 *
 * Lets the player re-read a question at any time, see which ones are still
 * open, and review the right answers. Read-only.
 *
 * Locks input while open; closes on J or ESC (own key listener, so it works
 * even though ZoneScene ignores those keys while the lock is held) and calls
 * `onClose` so ZoneScene can re-arm its J toggle.
 */
export class JournalPanel extends Phaser.GameObjects.Container {
  private readonly labels: JournalLabels;
  private readonly onClose: () => void;
  private readonly titleText: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.GameObject[] = [];
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  private static readonly TOP = 120;
  private static readonly BOTTOM = 670;
  private static readonly LEFT = 80;
  private static readonly WIDTH = 1120;

  constructor(scene: Phaser.Scene, labels: JournalLabels, onClose: () => void) {
    super(scene, 0, 0);
    this.labels = labels;
    this.onClose = onClose;

    const bg = scene.add.rectangle(0, 0, 1280, 720, 0x05050f, 0.94).setOrigin(0);
    this.titleText = scene.add.text(640, 60, '', {
      fontFamily: 'monospace',
      fontSize: '26px',
      color: '#e0e0ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const hint = scene.add.text(640, 700, labels.hint, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#666699',
    }).setOrigin(0.5, 1);

    this.add([bg, this.titleText, hint]);
    // Modal: above the zone banner (200-201) and the HUD bar (250)
    this.setDepth(300);
    this.setVisible(false);
    scene.add.existing(this);
  }

  /** Show the journal with the given entries (first asked first). */
  open(entries: JournalEntry[]): void {
    this._clearRows();
    this.titleText.setText(`${this.labels.title}  (${entries.filter((e) => e.resolved).length}/${entries.length})`);

    if (entries.length === 0) {
      this._addRow(this.scene.add.text(640, 300, this.labels.empty, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#9999bb',
      }).setOrigin(0.5));
    }

    // Two text lines per entry; shrink the font if the list would overflow.
    const available = JournalPanel.BOTTOM - JournalPanel.TOP;
    const rowH = Math.min(52, available / Math.max(entries.length, 1));
    const big = Math.max(11, Math.min(15, Math.floor(rowH * 0.3)));
    const small = Math.max(10, big - 2);

    entries.forEach((entry, i) => {
      const y = JournalPanel.TOP + i * rowH;
      const mark = entry.resolved ? '✔' : '…';
      const head = this.scene.add.text(JournalPanel.LEFT, y,
        `${mark} ${entry.npcName}  —  « ${entry.question} »`, {
          fontFamily: 'monospace',
          fontSize: `${big}px`,
          color: entry.resolved ? '#e0e0e0' : '#ffd166',
          wordWrap: { width: JournalPanel.WIDTH },
        });
      const detail = this.scene.add.text(JournalPanel.LEFT + 24, y + big + 4,
        `${entry.zoneName}  ·  ${entry.resolved ? `${this.labels.resolved} ${entry.answerName ?? ''}` : this.labels.pending}`, {
          fontFamily: 'monospace',
          fontSize: `${small}px`,
          color: entry.resolved ? '#66ff66' : '#9999bb',
          fontStyle: 'italic',
        });
      this._addRow(head);
      this._addRow(detail);
    });

    this.setVisible(true);
    InputLock.lock();

    // Close on J / ESC. Registered on the next tick so the J press that
    // opened the journal is not seen as the closing press.
    this.scene.time.delayedCall(0, () => {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key.toLowerCase() === 'j') this.close();
      };
      window.addEventListener('keydown', this.keyHandler);
    });
  }

  close(): void {
    if (!this.visible) return;
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    this._clearRows();
    this.setVisible(false);
    InputLock.unlock();
    this.onClose();
  }

  isOpen(): boolean {
    return this.visible;
  }

  private _addRow(obj: Phaser.GameObjects.GameObject): void {
    this.rows.push(obj);
    this.add(obj);
  }

  private _clearRows(): void {
    for (const r of this.rows) this.remove(r, true);
    this.rows = [];
  }
}
