import Phaser from 'phaser';
import { COLORS, FONTS } from '@/ui/theme';

/**
 * EditorTextInput — minimal in-canvas single-line text field (J6, zone tab).
 *
 * Phaser has no native text widget; this draws a panel rect + text, and
 * captures raw keydown while focused (caret rendered as a blinking bar).
 * The scene must gate its own keyboard shortcuts while a field is focused
 * (isFocused()) so typing "b" in a name does not switch to the brush.
 *
 * Handled keys while focused: printable characters, Backspace, Enter/Escape
 * (blur). Everything else is ignored. No clipboard support (v1).
 *
 * Screen-space: parent must add it to a scrollFactor-0 camera setup (the
 * editor panel's uiCam).
 */
export interface TextInputHandle {
  getValue(): string;
  setValue(v: string): void;
  setFocused(on: boolean): void;
  isFocused(): boolean;
  /** Show/hide the field (panel tab switching). Also disables its input. */
  setVisible(on: boolean): void;
  destroy(): void;
}

export function createEditorTextInput(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  initial: string,
  opts: {
    maxLength: number;
    onChange?: (value: string) => void;
    onFocusChange?: (focused: boolean) => void;
    placeholder?: string;
  },
): TextInputHandle {
  let value = initial;
  let focused = false;

  const bg = scene.add.rectangle(x, y, w, h, COLORS.bg, 1).setStrokeStyle(1, focused ? COLORS.amber : COLORS.line, 1);
  bg.setOrigin(0, 0.5).setDepth(10002).setScrollFactor(0);
  bg.setInteractive({ useHandCursor: true });

  const text = scene.add.text(x + 8, y, value, {
    fontFamily: FONTS.body, fontSize: '13px', color: COLORS.inkCss,
  }).setOrigin(0, 0.5).setDepth(10003).setScrollFactor(0);

  const caret = scene.add.rectangle(x + 8, y, 1, h - 12, COLORS.green, 1)
    .setOrigin(0, 0.5).setDepth(10003).setScrollFactor(0).setVisible(false);

  // Caret blink
  const blink = scene.time.addEvent({ delay: 500, loop: true, callback: () => {
    if (focused) caret.setVisible(!caret.visible);
  } });

  const setVisibility = (on: boolean) => {
    bg.setVisible(on);
    text.setVisible(on);
    caret.setVisible(on && focused);
    if (bg.input) bg.input.enabled = on;
    if (!on) blur();
  };

  const blur = () => {
    focused = false;
    caret.setVisible(false);
    bg.setStrokeStyle(1, COLORS.line, 1);
    opts.onFocusChange?.(false);
  };

  const focus = () => {
    focused = true;
    caret.setVisible(true);
    bg.setStrokeStyle(1, COLORS.amber, 1);
    opts.onFocusChange?.(true);
  };

  bg.on('pointerdown', () => focus());

  // Click-outside blur: any pointerdown outside this field's rect blurs it.
  // Also makes the sibling field (zone tab has two) lose focus implicitly —
  // each field blurs itself, so only one field can be focused at a time.
  const onScenePointerDown = (pointer: Phaser.Input.Pointer) => {
    if (!focused) return;
    const inside = pointer.x >= x && pointer.x <= x + w && Math.abs(pointer.y - y) <= h / 2;
    if (!inside) blur();
  };
  scene.input.on('pointerdown', onScenePointerDown);

  // Capture keydown at the scene level while focused. stopImmediatePropagation
  // is not enough for other scenes — but EditorScene gates its own shortcuts
  // via isFocused(); global keys in other scenes aren't running here.
  const onKeydown = (event: KeyboardEvent) => {
    if (!focused) return;

    if (event.key === 'Enter' || event.key === 'Escape') {
      blur();
      event.preventDefault();
      return;
    }
    if (event.key === 'Backspace') {
      value = value.slice(0, -1);
      text.setText(value);
      opts.onChange?.(value);
      event.preventDefault();
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (value.length < opts.maxLength) {
        value += event.key;
        text.setText(value);
        opts.onChange?.(value);
      }
      event.preventDefault();
    }
  };
  scene.input.keyboard!.on('keydown', onKeydown);

  const updateCaretX = () => {
    caret.setPosition(x + 8 + text.width, y);
  };
  // Wrap text.setText to keep the caret glued to the end — small helper closure
  const origSet = text.setText.bind(text);
  text.setText = (v: string) => {
    origSet(v);
    updateCaretX();
    return text;
  };
  updateCaretX();

  return {
    getValue: () => value,
    setValue: (v: string) => {
      value = v;
      text.setText(v);
    },
    setFocused: (on: boolean) => (on ? focus() : blur()),
    isFocused: () => focused,
    setVisible: (on: boolean) => setVisibility(on),
    destroy: () => {
      blink.remove();
      scene.input.keyboard!.off('keydown', onKeydown);
      scene.input.off('pointerdown', onScenePointerDown);
      bg.destroy();
      text.destroy();
      caret.destroy();
    },
  };
}
