import Phaser from 'phaser';
import { InputLock } from '@/systems/InputLock';
import type { TerminalTask } from '@/types/Terminal';

/** One line as the panel draws it. Built by UIScene. */
export interface TerminalLine {
  cardId: string;
  /** Language display name (e.g. "JavaScript"). */
  language: string;
  task: TerminalTask;
  state: 'locked' | 'open' | 'solved';
  /** Choice order to display (indices into task.choices), stable per opening. */
  order: number[];
}

export interface TerminalLabels {
  title: string;
  /** "{n}/{total} lignes compilées" */
  progress: string;
  compiled: string;
  /** "🔒 Restaure d'abord {language}…" */
  locked: string;
  hint: string;
}

/**
 * TerminalPanel — green-on-black console listing the zone's lines to complete.
 *
 * Each line shows its goal and code with a blank; open lines offer clickable
 * fillers, solved lines show the completed code, locked lines say which
 * language to restore first. UIScene validates choices and calls refresh().
 * Closes on ESC (own listener) and calls onClose.
 */
export class TerminalPanel extends Phaser.GameObjects.Container {
  private readonly labels: TerminalLabels;
  private readonly onClose: () => void;
  private readonly progressText: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.GameObject[] = [];
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private onChoose: ((cardId: string, choiceIndex: number) => void) | null = null;

  constructor(scene: Phaser.Scene, labels: TerminalLabels, onClose: () => void) {
    super(scene, 0, 0);
    this.labels = labels;
    this.onClose = onClose;

    const bg = scene.add.rectangle(0, 0, 1280, 720, 0x020a03, 0.97).setOrigin(0);
    const frame = scene.add.rectangle(60, 40, 1160, 640).setOrigin(0).setStrokeStyle(2, 0x2f6f2f);
    const title = scene.add.text(90, 60, labels.title, {
      fontFamily: 'monospace', fontSize: '22px', color: '#5dff7a', fontStyle: 'bold',
    });
    this.progressText = scene.add.text(1190, 64, '', {
      fontFamily: 'monospace', fontSize: '16px', color: '#9dffb0',
    }).setOrigin(1, 0);
    const hint = scene.add.text(640, 668, labels.hint, {
      fontFamily: 'monospace', fontSize: '13px', color: '#3f8f4f',
    }).setOrigin(0.5, 1);

    this.add([bg, frame, title, this.progressText, hint]);
    this.setDepth(300);
    this.setVisible(false);
    scene.add.existing(this);
  }

  open(lines: TerminalLine[], onChoose: (cardId: string, choiceIndex: number) => void): void {
    this.onChoose = onChoose;
    this.refresh(lines);
    if (this.visible) return;
    this.setVisible(true);
    InputLock.lock();
    this.scene.time.delayedCall(0, () => {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') this.close();
      };
      window.addEventListener('keydown', this.keyHandler);
    });
  }

  refresh(lines: TerminalLine[]): void {
    for (const r of this.rows) this.remove(r, true);
    this.rows = [];

    const solved = lines.filter((l) => l.state === 'solved').length;
    this.progressText.setText(solved === lines.length && lines.length > 0
      ? this.labels.compiled
      : this.labels.progress.replace('{n}', String(solved)).replace('{total}', String(lines.length)));

    const rowH = Math.min(180, 560 / Math.max(lines.length, 1));
    lines.forEach((line, i) => {
      const y = 110 + i * rowH;
      const head = this.scene.add.text(90, y, `${line.state === 'solved' ? '✔' : line.state === 'locked' ? '🔒' : '▶'} [${line.language}] ${line.task.goal}`, {
        fontFamily: 'monospace', fontSize: '15px',
        color: line.state === 'locked' ? '#3f6f4f' : '#c8ffd0',
      });
      this._push(head);

      const [before, after] = line.task.code.split('____');
      const filled = line.state === 'solved' ? line.task.choices[line.task.answer] : '____';
      const code = this.scene.add.text(120, y + 30, `> ${before}${filled}${after}`, {
        fontFamily: 'monospace', fontSize: '17px',
        color: line.state === 'solved' ? '#5dff7a' : line.state === 'locked' ? '#2f5f3f' : '#ffffff',
        backgroundColor: '#051208',
        padding: { x: 8, y: 4 },
      });
      this._push(code);

      if (line.state === 'locked') {
        const lock = this.scene.add.text(120, y + 72, this.labels.locked.replace('{language}', line.language), {
          fontFamily: 'monospace', fontSize: '13px', color: '#3f8f4f', fontStyle: 'italic',
        });
        this._push(lock);
      } else if (line.state === 'open') {
        line.order.forEach((choiceIndex, k) => {
          const x = 120 + k * 230;
          const btn = this.scene.add.rectangle(x, y + 70, 210, 36, 0x0f3a18).setOrigin(0)
            .setStrokeStyle(1, 0x3f8f4f).setInteractive({ useHandCursor: true });
          const label = this.scene.add.text(x + 105, y + 88, line.task.choices[choiceIndex], {
            fontFamily: 'monospace', fontSize: '15px', color: '#c8ffd0',
          }).setOrigin(0.5);
          btn.on('pointerover', () => btn.setFillStyle(0x1d6b2a));
          btn.on('pointerout', () => btn.setFillStyle(0x0f3a18));
          btn.on('pointerdown', () => this.onChoose?.(line.cardId, choiceIndex));
          this._push(btn);
          this._push(label);
        });
      }
    });
  }

  /** Red flash on the progress line (wrong filler). */
  flashWrong(): void {
    this.progressText.setColor('#ff6666');
    this.scene.time.delayedCall(300, () => this.progressText.setColor('#9dffb0'));
  }

  close(): void {
    if (!this.visible) return;
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = null;
    this.setVisible(false);
    InputLock.unlock();
    this.onClose();
  }

  isOpen(): boolean {
    return this.visible;
  }

  private _push(o: Phaser.GameObjects.GameObject): void {
    this.rows.push(o);
    this.add(o);
  }
}
