import Phaser from 'phaser';
import { COLORS, FONTS } from '@/ui/theme';
import { NOTCH_SIZE } from '@/ui/uiKit';
import { createEditorTextInput } from '@/ui/editor/EditorTextInput';

/**
 * EditorPanel — the level editor's fixed right-side control panel (J6).
 *
 * Two tabs:
 *  - TUILES: layer selector (ground/walls/decor), tile tools (brush/eraser/
 *    pipette/grid) and the 20×20 tile palette.
 *  - ENTITÉS: NPC picker (all npcs.json entries), door target picker
 *    (existing zones or none), props source-rect picker (drag a rect over
 *    the props atlas) with a solid toggle, plus the entity erase and
 *    spawn-move mode buttons.
 *
 * Purely view + input: it never touches zone data. It raises callbacks
 * supplied by EditorScene, which owns the draft and applies edits.
 *
 * Rendered by a dedicated screen-space camera (zoom 1, no scroll) created
 * by EditorScene — see the camera split in EditorScene.create() for why.
 */

/** Which tile layer the brush paints on — mirrors ZoneMap field names. */
export type EditorLayer = 'ground' | 'walls' | 'decor';

/** Tile tools (TUILES tab). */
export type EditorTool = 'brush' | 'eraser' | 'picker';

/** Which panel tab is active. */
export type EditorTab = 'tiles' | 'entities' | 'zone';

/**
 * Entity placement/erase mode (ENTITÉS tab).
 *  erase  — click near an entity to remove it
 *  npc    — click to place/move the selected NPC
 *  door   — click to place a door leading to the selected target
 *  prop   — click to place the picked prop rect
 *  spawn  — click to move the zone spawn
 */
export type EntityMode = 'erase' | 'npc' | 'door' | 'prop' | 'spawn';

/** Callbacks the panel raises; EditorScene owns all behaviour. */
export interface EditorPanelCallbacks {
  onSelectLayer(layer: EditorLayer): void;
  onSelectTool(tool: EditorTool): void;
  onToggleGrid(): void;
  onTab(tab: EditorTab): void;
  onEntityMode(mode: EntityMode): void;
  onSelectNpc(npcId: string): void;
  onSelectDoorTarget(zoneId: string | null): void;
  onToggleSolid(): void;
  onPropRectPicked(rect: [number, number, number, number] | null): void;
  onNameChange(value: string): void;
  onBgChange(value: string): void;
  onMusicSelect(music: string | null): void;
  onExport(): void;
  onTest(): void;
  onQuit(): void;
  onSelectTile(tileIndex: number): void;
}

/** Handle returned to the scene for state updates + hit-testing. */
export interface EditorPanelHandle {
  /** True when the given canvas-space pointer is over the panel. */
  isOverUI(px: number, py: number): boolean;
  /** Highlight the selected tile in the palette (-1 = none). */
  setSelectedTile(tileIndex: number): void;
  /** Highlight the active layer button. */
  setLayer(layer: EditorLayer): void;
  /** Highlight the active tile tool button. */
  setTool(tool: EditorTool): void;
  /** Show the grid button as active/inactive. */
  setGridVisible(on: boolean): void;
  /** Switch the visible tab. */
  setTab(tab: EditorTab): void;
  /** Highlight the active entity mode button. */
  setEntityMode(mode: EntityMode): void;
  /** Highlight the selected NPC picker entry. */
  setSelectedNpc(npcId: string): void;
  /** Highlight the selected door target ('none' for the no-target entry). */
  setDoorTarget(zoneId: string | null): void;
  /** Reflect the solid toggle state. */
  setSolid(on: boolean): void;
  /** Highlight the selected music entry. */
  setMusic(music: string | null): void;
  /** True while a text field is focused — the scene must gate its hotkeys. */
  isEditingText(): boolean;
  /** Show the currently picked prop rect, e.g. "34×21 @ (18,36)" or '—'. */
  setPropRect(rect: [number, number, number, number] | null): void;
  /** Update the status line under the title (dirty/resumed/etc.). */
  setStatus(text: string): void;
  /** Destroy all display objects owned by the panel. */
  destroy(): void;
}

/** Panel geometry — the scene's hit-test math depends on these. */
export const PANEL_W = 360;
const PALETTE_CELL = 16; // native tile px — crisp at pixelArt scaling
const ATLAS_COLS = 20; // 320×320 tile atlas / 16px cells (square)

interface PanelButton {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  baseColor: number;
}

/** NPC list entry metadata passed by the scene (from npcs.json). */
export interface NpcEntry {
  id: string;
  name: string;
}

export function createEditorPanel(
  scene: Phaser.Scene,
  input: {
    strings: {
      title: string;
      layers: string;
      layerGround: string;
      layerWalls: string;
      layerDecor: string;
      tools: string;
      toolBrush: string;
      toolEraser: string;
      toolPicker: string;
      toolGrid: string;
      tiles: string;
      tabTiles: string;
      tabEntities: string;
      tabZone: string;
      npcsSection: string;
      doorsSection: string;
      propsSection: string;
      spawn: string;
      erase: string;
      solid: string;
      targetNone: string;
      zoneName: string;
      zoneBg: string;
      zoneMusic: string;
      export: string;
      test: string;
      quit: string;
      hints: string;
    };
    npcs: NpcEntry[];
    doorTargets: { zoneId: string | null; label: string }[];
    musicChoices: { key: string | null; label: string }[];
    initialName: string;
    initialBg: string;
  },
  callbacks: EditorPanelCallbacks,
): EditorPanelHandle {
  const { height } = scene.scale;
  const x0 = scene.scale.width - PANEL_W;

  // ---- Background ----
  const bg = scene.add.rectangle(x0, 0, PANEL_W, height, COLORS.panel, 1).setOrigin(0, 0);
  bg.setStrokeStyle(1, COLORS.line, 1);
  bg.setInteractive({ useHandCursor: false }); // swallow clicks meant for the panel
  bg.setDepth(10000);
  bg.setScrollFactor(0);

  const notch = scene.add.rectangle(x0, 0, NOTCH_SIZE, NOTCH_SIZE, COLORS.green).setOrigin(0, 0);
  notch.setDepth(10001);
  notch.setScrollFactor(0);

  // ---- Title + status + hints ----
  scene.add.text(x0 + PANEL_W / 2, 22, input.strings.title, {
    fontFamily: FONTS.pixel, fontSize: '14px', color: COLORS.greenCss,
  }).setOrigin(0.5).setDepth(10001).setScrollFactor(0);

  const status = scene.add.text(x0 + PANEL_W / 2, 48, '', {
    fontFamily: FONTS.body, fontSize: '12px', color: COLORS.amberCss,
  }).setOrigin(0.5).setDepth(10001).setScrollFactor(0);

  scene.add.text(x0 + PANEL_W / 2, 70, input.strings.hints, {
    fontFamily: FONTS.body, fontSize: '10px', color: COLORS.inkDimCss,
    wordWrap: { width: PANEL_W - 24 }, align: 'center',
  }).setOrigin(0.5, 0).setDepth(10001).setScrollFactor(0);

  // ---- Small panel-local button factory ----
  const buttons = new Map<string, PanelButton>();

  const makeButton = (
    key: string, cx: number, cy: number, w: number, h: number, label: string,
    onClick: () => void, fontSize = 10,
  ): PanelButton => {
    const rect = scene.add.rectangle(cx, cy, w, h, COLORS.line, 1);
    rect.setStrokeStyle(1, COLORS.line, 1);
    rect.setInteractive({ useHandCursor: true });
    rect.setDepth(10002).setScrollFactor(0);

    const text = scene.add.text(cx, cy, label, {
      fontFamily: FONTS.pixel, fontSize: `${fontSize}px`, color: COLORS.inkCss,
    }).setOrigin(0.5);
    text.setDepth(10003).setScrollFactor(0);

    rect.on('pointerover', () => {
      if (!rect.getData('active')) rect.setFillStyle(COLORS.shadowGreen, 1);
    });
    rect.on('pointerout', () => {
      if (!rect.getData('active')) rect.setFillStyle(COLORS.line, 1);
    });
    rect.on('pointerdown', () => onClick());

    const btn: PanelButton = { rect, label: text, baseColor: COLORS.line };
    buttons.set(key, btn);
    return btn;
  };

  /** Active-state fill colour per button family. */
  const activeColorOf = (key: string): number => {
    if (key.startsWith('layer.')) return COLORS.green;
    if (key.startsWith('tool.')) return COLORS.amber;
    return COLORS.cyan;
  };

  const markActive = (key: string, active: boolean, activeText: string = COLORS.bgCss) => {
    const btn = buttons.get(key);
    if (!btn) return;
    btn.rect.setData('active', active);
    btn.rect.setFillStyle(active ? activeColorOf(key) : btn.baseColor, 1);
    btn.label.setColor(active ? activeText : COLORS.inkCss);
  };

  // ---- Section labels, tracked per tab so they can toggle visibility ----
  const tilesGroup: string[] = [];
  const entitiesGroup: string[] = [];
  const tilesLabels: Phaser.GameObjects.Text[] = [];
  const entitiesLabels: Phaser.GameObjects.Text[] = [];
  const zoneLabels: Phaser.GameObjects.Text[] = [];

  const sectionLabel = (group: 'tiles' | 'entities' | 'zone', y: number, text: string) => {
    const t = scene.add.text(x0 + 18, y, text, {
      fontFamily: FONTS.pixel, fontSize: '9px', color: COLORS.inkDimCss,
    }).setOrigin(0, 0).setDepth(10001).setScrollFactor(0);
    (group === 'tiles' ? tilesLabels : group === 'entities' ? entitiesLabels : zoneLabels).push(t);
  };

  // ---- Tab buttons ----
  const tabW = 102;
  const tabKeys: { key: string; tab: EditorTab; label: string }[] = [
    { key: 'tab.tiles', tab: 'tiles', label: input.strings.tabTiles },
    { key: 'tab.entities', tab: 'entities', label: input.strings.tabEntities },
    { key: 'tab.zone', tab: 'zone', label: input.strings.tabZone },
  ];
  tabKeys.forEach((t, i) => {
    makeButton(t.key, x0 + 20 + i * (tabW + 5) + tabW / 2, 100, tabW, 28, t.label, () => callbacks.onTab(t.tab));
  });

  // ===========================================================================
  // TUILES tab
  // ===========================================================================

  // ---- Layer buttons ----
  sectionLabel('tiles', 124, input.strings.layers);
  tilesGroup.push('layer.ground', 'layer.walls', 'layer.decor');
  const btnW = 100;
  const layerY = 148;
  makeButton('layer.ground', x0 + 18 + btnW / 2, layerY, btnW, 28, input.strings.layerGround, () => callbacks.onSelectLayer('ground'));
  makeButton('layer.walls', x0 + 130 + btnW / 2, layerY, btnW, 28, input.strings.layerWalls, () => callbacks.onSelectLayer('walls'));
  makeButton('layer.decor', x0 + 242 + btnW / 2, layerY, btnW, 28, input.strings.layerDecor, () => callbacks.onSelectLayer('decor'));

  // ---- Tool buttons (brush / eraser / pipette / grid) ----
  sectionLabel('tiles', 184, input.strings.tools);
  tilesGroup.push('tool.brush', 'tool.eraser', 'tool.picker', 'grid');
  const toolW = 78;
  const toolY = 208;
  makeButton('tool.brush', x0 + 18 + toolW / 2, toolY, toolW, 28, input.strings.toolBrush, () => callbacks.onSelectTool('brush'), 8);
  makeButton('tool.eraser', x0 + 98 + toolW / 2, toolY, toolW, 28, input.strings.toolEraser, () => callbacks.onSelectTool('eraser'), 8);
  makeButton('tool.picker', x0 + 178 + toolW / 2, toolY, toolW, 28, input.strings.toolPicker, () => callbacks.onSelectTool('picker'), 8);
  makeButton('grid', x0 + 258 + toolW / 2, toolY, toolW, 28, input.strings.toolGrid, () => callbacks.onToggleGrid(), 8);

  // ---- Tile palette ----
  sectionLabel('tiles', 246, input.strings.tiles);
  const palX = x0 + 20;
  const palY = 262;
  const PAL_BOTTOM = palY + ATLAS_COLS * PALETTE_CELL; // 582

  const selectedBox = scene.add.rectangle(0, 0, PALETTE_CELL, PALETTE_CELL)
    .setStrokeStyle(2, COLORS.amber, 1).setVisible(false);
  selectedBox.setDepth(10003).setScrollFactor(0);

  const atlas = scene.textures.get('tiles');
  for (let row = 0; row < ATLAS_COLS; row++) {
    for (let col = 0; col < ATLAS_COLS; col++) {
      const idx = row * ATLAS_COLS + col;
      // 'tiles' is a plain image texture — register one frame per tile cell
      // (same pattern as MapBuilder.spawnProp for the props atlas) so palette
      // entries can be addressed by index.
      const frameName = `editor_tile_${idx}`;
      if (!atlas.has(frameName)) {
        atlas.add(frameName, 0, col * PALETTE_CELL, row * PALETTE_CELL, PALETTE_CELL, PALETTE_CELL);
      }
      const img = scene.add.image(palX + col * PALETTE_CELL + PALETTE_CELL / 2, palY + row * PALETTE_CELL + PALETTE_CELL / 2, 'tiles', frameName);
      img.setDepth(10002).setScrollFactor(0);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => callbacks.onSelectTile(idx));
      img.on('pointerover', () => img.setAlpha(0.75));
      img.on('pointerout', () => img.setAlpha(1));
    }
  }

  // ===========================================================================
  // ENTITÉS tab
  // ===========================================================================
  const entityObjects: Phaser.GameObjects.GameObject[] = []; // non-button objects

  // ---- NPC picker ----
  sectionLabel('entities', 124, input.strings.npcsSection);
  const npcW = 104;
  const npcCols = 3;
  input.npcs.forEach((npc, i) => {
    const col = i % npcCols;
    const row = Math.floor(i / npcCols);
    entitiesGroup.push(`npc.${npc.id}`);
    makeButton(`npc.${npc.id}`, x0 + 18 + col * (npcW + 6) + npcW / 2, 148 + row * 32, npcW, 26, npc.name, () => callbacks.onSelectNpc(npc.id), 8);
  });
  // 15 npcs → 5 rows → ends at 148 + 4*32 + 13 = 289

  // ---- Door target picker ----
  sectionLabel('entities', 298, input.strings.doorsSection);
  const tgtW = 104;
  input.doorTargets.forEach((t, i) => {
    const col = i % npcCols;
    const row = Math.floor(i / npcCols);
    const key = `target.${t.zoneId ?? 'none'}`;
    entitiesGroup.push(key);
    makeButton(key, x0 + 18 + col * (tgtW + 6) + tgtW / 2, 322 + row * 32, tgtW, 26, t.label, () => callbacks.onSelectDoorTarget(t.zoneId), 8);
  });
  // 6 targets → 2 rows → ends at 322 + 32 + 13 = 367

  // ---- Prop rect picker ----
  sectionLabel('entities', 380, input.strings.propsSection);

  // Props atlas displayed at native size (160×160) — drag a rect over it.
  // Frame '__BASE' is explicit: Texture.get(undefined) falls back to
  // firstFrame, which MapBuilder has already repointed at a prop frame.
  const propAtlasX = x0 + 20;
  const propAtlasY = 396;
  const propImg = scene.add.image(propAtlasX + 80, propAtlasY + 80, 'props_atlas', '__BASE');
  propImg.setDepth(10002).setScrollFactor(0);
  propImg.setInteractive(); // default cursor
  entityObjects.push(propImg);

  // Drag-rect selection overlay
  const dragRect = scene.add.rectangle(0, 0, 0, 0).setStrokeStyle(1, COLORS.amber, 1).setVisible(false);
  dragRect.setDepth(10003).setScrollFactor(0);
  entityObjects.push(dragRect);

  let dragStart: { x: number; y: number } | null = null;
  const localFromPointer = (p: Phaser.Input.Pointer) => {
    // pointer.x/y are canvas coords; the atlas is drawn in screen space.
    return { x: p.x - propAtlasX, y: p.y - propAtlasY };
  };

  propImg.on('pointerdown', (p: Phaser.Input.Pointer) => {
    dragStart = localFromPointer(p);
  });
  propImg.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (!dragStart || !p.leftButtonDown()) return;
    const cur = localFromPointer(p);
    const x = Math.min(dragStart.x, cur.x);
    const y = Math.min(dragStart.y, cur.y);
    const w = Math.abs(cur.x - dragStart.x);
    const h = Math.abs(cur.y - dragStart.y);
    const cx = propAtlasX + Math.max(0, Math.min(160, x + w / 2));
    const cy = propAtlasY + Math.max(0, Math.min(160, y + h / 2));
    dragRect.setPosition(cx, cy);
    dragRect.setSize(Math.min(160, w), Math.min(160, h));
    dragRect.setVisible(true);
  });
  propImg.on('pointerup', (p: Phaser.Input.Pointer) => {
    if (!dragStart) return;
    const cur = localFromPointer(p);
    const rx = Math.max(0, Math.min(160, Math.floor(Math.min(dragStart.x, cur.x))));
    const ry = Math.max(0, Math.min(160, Math.floor(Math.min(dragStart.y, cur.y))));
    const rw = Math.max(0, Math.min(160 - rx, Math.ceil(Math.abs(cur.x - dragStart.x))));
    const rh = Math.max(0, Math.min(160 - ry, Math.ceil(Math.abs(cur.y - dragStart.y))));
    dragStart = null;
    dragRect.setVisible(false);
    if (rw >= 4 && rh >= 4) {
      callbacks.onPropRectPicked([rx, ry, rw, rh]);
    }
  });

  // Rect info + solid toggle (right of the atlas)
  const rectInfo = scene.add.text(x0 + 20, PAL_BOTTOM + 4, '—', {
    fontFamily: FONTS.body, fontSize: '10px', color: COLORS.inkDimCss,
  }).setOrigin(0, 0).setDepth(10001).setScrollFactor(0);
  entityObjects.push(rectInfo);

  makeButton('solid', x0 + 270 + 36, 460, 72, 26, input.strings.solid, () => callbacks.onToggleSolid(), 8);
  entitiesGroup.push('solid');

  // ---- Entity modes: erase + spawn ----
  const modeY = 588;
  makeButton('mode.erase', x0 + 18 + 156 / 2, modeY, 156, 26, input.strings.erase, () => callbacks.onEntityMode('erase'), 8);
  makeButton('mode.spawn', x0 + 186 + 156 / 2, modeY, 156, 26, input.strings.spawn, () => callbacks.onEntityMode('spawn'), 8);
  entitiesGroup.push('mode.erase', 'mode.spawn');

  // ===========================================================================
  // ZONE tab
  // ===========================================================================
  const zoneGroup: string[] = [];

  // ---- Zone name ----
  sectionLabel('zone', 124, input.strings.zoneName);
  const nameField = createEditorTextInput(scene, x0 + 18, 150, PANEL_W - 36, 28, input.initialName, {
    maxLength: 40,
    onChange: (v) => callbacks.onNameChange(v),
  });

  // ---- Background colour ----
  sectionLabel('zone', 178, input.strings.zoneBg);
  const bgField = createEditorTextInput(scene, x0 + 18, 204, PANEL_W - 36, 28, input.initialBg, {
    maxLength: 7,
    onChange: (v) => callbacks.onBgChange(v),
  });

  // ---- Music picker ----
  sectionLabel('zone', 232, input.strings.zoneMusic);
  const musW = 156;
  input.musicChoices.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const key = `music.${m.key ?? 'none'}`;
    zoneGroup.push(key);
    makeButton(key, x0 + 18 + col * (musW + 6) + musW / 2, 256 + row * 32, musW, 26, m.label, () => callbacks.onMusicSelect(m.key), 8);
  });

  // ---- Action buttons ----
  const testBtn = makeButton('test', x0 + PANEL_W / 2, 624, PANEL_W - 36, 30, input.strings.test, () => callbacks.onTest(), 12);
  testBtn.rect.setFillStyle(COLORS.green, 1);
  testBtn.label.setColor(COLORS.bgCss);
  testBtn.rect.setData('active', true);
  testBtn.rect.on('pointerover', () => testBtn.rect.setFillStyle(COLORS.amber, 1));
  testBtn.rect.on('pointerout', () => testBtn.rect.setFillStyle(COLORS.green, 1));

  makeButton('export', x0 + PANEL_W / 2, 664, PANEL_W - 36, 26, input.strings.export, () => callbacks.onExport(), 10);
  makeButton('quit', x0 + PANEL_W / 2, 700, PANEL_W - 36, 22, input.strings.quit, () => callbacks.onQuit(), 9);

  // ---- Tab visibility ----
  let selectedTileIdx = -1;
  let propRectShown: [number, number, number, number] | null = null;

  const setGroupVisible = (group: string[], visible: boolean) => {
    for (const key of group) {
      const btn = buttons.get(key);
      if (btn) {
        btn.rect.setVisible(visible);
        btn.rect.input!.enabled = visible;
        btn.label.setVisible(visible);
      }
    }
  };
  const setEntityObjectsVisible = (visible: boolean) => {
    for (const o of entityObjects) {
      (o as Phaser.GameObjects.Shape).setVisible(visible);
      const interactive = o as Phaser.GameObjects.Image;
      if (interactive.input) interactive.input.enabled = visible;
    }
  };
  const setZoneObjectsVisible = (visible: boolean) => {
    nameField.setVisible(visible);
    bgField.setVisible(visible);
  };

  // ---- Handle ----
  const handle: EditorPanelHandle = {
    isOverUI(px: number, py: number): boolean {
      return px >= x0 && px <= x0 + PANEL_W && py >= 0 && py <= height;
    },

    setSelectedTile(tileIndex: number): void {
      selectedTileIdx = tileIndex;
      if (tileIndex < 0) {
        selectedBox.setVisible(false);
        return;
      }
      const col = tileIndex % ATLAS_COLS;
      const row = Math.floor(tileIndex / ATLAS_COLS);
      selectedBox.setPosition(palX + col * PALETTE_CELL + PALETTE_CELL / 2, palY + row * PALETTE_CELL + PALETTE_CELL / 2);
      selectedBox.setVisible(true);
    },

    setLayer(layer: EditorLayer): void {
      for (const l of ['ground', 'walls', 'decor'] as const) {
        markActive(`layer.${l}`, l === layer);
      }
    },

    setTool(tool: EditorTool): void {
      for (const t of ['brush', 'eraser', 'picker'] as const) {
        markActive(`tool.${t}`, t === tool);
      }
    },

    setGridVisible(on: boolean): void {
      markActive('grid', on);
    },

    setTab(tab: EditorTab): void {
      for (const t of tabKeys) {
        markActive(t.key, t.tab === tab);
      }
      const isTiles = tab === 'tiles';
      const isEntities = tab === 'entities';
      const isZone = tab === 'zone';
      // Toggle everything created for each tab: buttons, section labels,
      // entity/zone objects and the palette.
      setGroupVisible(tilesGroup, isTiles);
      setGroupVisible(entitiesGroup, isEntities);
      setGroupVisible(zoneGroup, isZone);
      for (const t of [...tilesLabels, ...entitiesLabels, ...zoneLabels]) t.setVisible(false);
      (isTiles ? tilesLabels : isEntities ? entitiesLabels : zoneLabels).forEach((t) => t.setVisible(true));
      setEntityObjectsVisible(isEntities);
      setZoneObjectsVisible(isZone);
      for (const img of atlasFrames) img.setVisible(isTiles);
      selectedBox.setVisible(isTiles && selectedTileIdx >= 0);
    },

    setEntityMode(mode: EntityMode): void {
      markActive('mode.erase', mode === 'erase');
      markActive('mode.spawn', mode === 'spawn');
      // Picker-driven modes (npc/door/prop) highlight their picker entry
      // instead of a mode button.
      if (mode === 'npc' || mode === 'door' || mode === 'prop') {
        markActive('mode.erase', false);
        markActive('mode.spawn', false);
      }
    },

    setSelectedNpc(npcId: string): void {
      for (const key of buttons.keys()) {
        if (key.startsWith('npc.')) {
          markActive(key, key === `npc.${npcId}`);
        }
      }
    },

    setDoorTarget(zoneId: string | null): void {
      for (const key of buttons.keys()) {
        if (key.startsWith('target.')) {
          markActive(key, key === `target.${zoneId ?? 'none'}`);
        }
      }
    },

    setSolid(on: boolean): void {
      markActive('solid', on);
    },

    setMusic(music: string | null): void {
      for (const key of buttons.keys()) {
        if (key.startsWith('music.')) {
          markActive(key, key === `music.${music ?? 'none'}`);
        }
      }
    },

    isEditingText(): boolean {
      return nameField.isFocused() || bgField.isFocused();
    },

    setPropRect(rect: [number, number, number, number] | null): void {
      propRectShown = rect;
      rectInfo.setText(rect ? `${rect[2]}×${rect[3]} @ (${rect[0]},${rect[1]})` : '—');
    },

    setStatus(text: string): void {
      status.setText(text);
    },

    destroy(): void {
      bg.destroy();
      notch.destroy();
      selectedBox.destroy();
      dragRect.destroy();
      propImg.destroy();
      rectInfo.destroy();
      nameField.destroy();
      bgField.destroy();
      for (const t of [...tilesLabels, ...entitiesLabels, ...zoneLabels]) t.destroy();
      for (const img of atlasFrames) img.destroy();
      for (const btn of buttons.values()) {
        btn.rect.destroy();
        btn.label.destroy();
      }
      buttons.clear();
    },
  };

  // Palette images, collected for tab toggling / destroy.
  const atlasFrames: Phaser.GameObjects.Image[] = scene.children.list.filter(
    (o): o is Phaser.GameObjects.Image => o instanceof Phaser.GameObjects.Image && o.texture.key === 'tiles',
  );

  // Initial tab state: TUILES visible, ENTITÉS hidden.
  handle.setTab('tiles');
  handle.setPropRect(propRectShown);

  return handle;
}
