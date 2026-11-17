import Phaser from 'phaser';
import { ContentLoader } from '@/systems/ContentLoader';
import { MapBuilder, type MapBuildResult } from '@/systems/MapBuilder';
import { SaveSystem } from '@/systems/SaveSystem';
import { AudioManager } from '@/systems/AudioManager';
import { createEditorPanel, PANEL_W, type EditorPanelHandle, type EditorLayer, type EditorTool, type EditorTab, type EntityMode } from '@/ui/editor/EditorPanel';
import { LevelValidator, type ValidationIssue } from '@/systems/LevelValidator';
import { COLORS } from '@/ui/theme';
import type { ZoneData } from '@/types/ZoneData';

/**
 * EditorScene — the in-game level editor (J6, mode B).
 *
 * Opens on a deep clone of an existing zone (menu "Créer un niveau") or
 * resumes the auto-saved draft from localStorage. Edits are applied directly
 * to the draft ZoneData object; the map is rendered by MapBuilder — the exact
 * same code the game plays with, so what you author is what you play.
 *
 * Interaction model (v1):
 *  - Left click / drag  → apply tool at the tile under the cursor (brush,
 *    eraser, or pipette). Paint applies to the selected layer only.
 *  - Right-button drag  → pan the camera.
 *  - Mouse wheel        → zoom.
 *  - [B]/[X]/[P]        → brush / eraser / pipette. [G] toggles the grid.
 *    [Échap] persists the draft and returns to the main menu.
 *  - TESTER             → persists the draft, registers it in ContentLoader
 *    under the stable id `zone_draft`, and plays it in ZoneScene with the
 *    real engine. SaveSystem is put in sandbox mode for the duration so
 *    testing never writes to the player's actual save.
 *
 * Draft persistence: localStorage key `codysse.editor.draft.v1`. The draft
 * keeps the sentinel id `zone_draft` while being edited; the export step
 * (later phase) assigns a unique `zone_fan_*` id.
 *
 * Editing scope (v1 — P2): tiles on the three layers. NPC/door/prop/spawn
 * placement, metadata editing, validation and export land in the next
 * phases; NPC/door markers are already drawn as read-only visuals.
 */
export class EditorScene extends Phaser.Scene {
  /** The zone being edited (draft). */
  private draft!: ZoneData;

  /** Map layers + world dimensions built from the draft. */
  private built!: MapBuildResult;

  /** Control panel UI. */
  private panel!: EditorPanelHandle;

  /** Screen-space camera rendering the control panel (zoom 1, no scroll). */
  private uiCam!: Phaser.Cameras.Scene2D.Camera;

  /** Display objects belonging to the control panel (camera split bookkeeping). */
  private panelObjects: Phaser.GameObjects.GameObject[] = [];

  /** Currently open validation-issues overlay (null = none). */
  private issuesOverlay: { objs: Phaser.GameObjects.GameObject[] } | null = null;

  /** Grid overlay graphics, rebuilt on toggle. */
  private gridG!: Phaser.GameObjects.Graphics;

  /** Read-only entity markers (spawn circle, door/npc sprites). */
  private markers: Phaser.GameObjects.GameObject[] = [];

  /** Active painting layer. */
  private layer: EditorLayer = 'ground';

  /** Active tool (tiles tab). */
  private tool: EditorTool = 'brush';

  /** Active panel tab. */
  private tab: EditorTab = 'tiles';

  /** Entity mode (entities tab). */
  private entityMode: EntityMode = 'erase';

  /** NPC id selected for placement (entities tab). */
  private selectedNpcId: string | null = null;

  /** Door target zone selected for placement (null = no target = final door). */
  private doorTarget: string | null = null;

  /** Prop source rect picked from the atlas ([x, y, w, h] in atlas px). */
  private propRect: [number, number, number, number] | null = null;

  /** Whether newly placed props are solid. */
  private propSolid = true;

  /** Selected tile index from the palette (-1 = none). */
  private tile = 0;

  /** Grid overlay visible. */
  private gridOn = true;

  /** Left-button paint stroke in progress. */
  private painting = false;

  /** Right-button camera pan in progress. */
  private panning = false;

  /** Pan gesture start state (pointer + camera scroll). */
  private panStart = { x: 0, y: 0, scrollX: 0, scrollY: 0 };

  constructor() {
    super({ key: 'EditorScene' });
  }

  // ---------------------------------------------------------------------------
  // Scene lifecycle
  // ---------------------------------------------------------------------------

  create(): void {
    const cl = ContentLoader.getInstance();
    const save = SaveSystem.getInstance();

    // If we just came back from a test play, discard the sandbox save state.
    save.setSandbox(false);

    // Editor ambience: menu theme. playMusic is idempotent for the same key.
    AudioManager.getInstance().init(this);
    AudioManager.getInstance().playMusic('music.menu');

    // ---- Draft loading ----
    // Scene data carries baseZoneId when the user explicitly starts a new
    // draft from the menu ("Créer un niveau"). Without it, resume the
    // auto-saved draft, or fall back to a fresh clone of the first zone.
    const sceneData = this.scene.settings.data as { baseZoneId?: string } | undefined;
    const baseZoneId = sceneData?.baseZoneId;

    let resumed = false;
    if (!baseZoneId) {
      const stored = this._loadStoredDraft();
      if (stored) {
        this.draft = stored;
        resumed = true;
      }
    }
    if (!this.draft) {
      const base = (baseZoneId ? cl.getZone(baseZoneId) : undefined) ?? cl.getZones()[0];
      if (!base) {
        throw new Error('EditorScene: no zone found to base the draft on.');
      }
      this.draft = EditorScene._cloneZone(base);
      this.draft.id = EditorScene.DRAFT_ID;
    }

    this._persistDraft();

    // ---- World ----
    if (!this.draft.map) {
      throw new Error(`EditorScene: zone "${this.draft.id}" has no map data — the editor requires it.`);
    }
    this.built = MapBuilder.build(this, this.draft);

    // ---- Theme ----
    this.cameras.main.setBackgroundColor(this.draft.theme?.background ?? COLORS.bgCss);

    // ---- Camera: fit the whole map, centered ----
    const cam = this.cameras.main;
    const worldW = this.built.worldWidth;
    const worldH = this.built.worldHeight;
    cam.setBounds(0, 0, worldW, worldH);
    const fitZoom = Math.min((this.scale.width - this.panelWidth()) / worldW, this.scale.height / worldH);
    cam.setZoom(Math.max(0.1, Math.min(fitZoom, 1)));
    cam.centerOn(worldW / 2, worldH / 2);

    // ---- Grid overlay ----
    this.gridG = this.add.graphics().setDepth(5000);
    this._redrawGrid();

    // ---- Read-only entity markers ----
    this._drawEntityMarkers();

    // ---- Cameras ----
    // Two-camera setup (same pattern as the UIScene overlay):
    //  - main camera renders the WORLD (zoom/scroll for panning/zooming)
    //  - uiCam renders the control panel in screen space (zoom 1, no scroll)
    // Camera zoom applies to every object it renders regardless of
    // scrollFactor, so panel objects are ignored by main and world objects
    // are ignored by uiCam. Input hit-testing then resolves panel clicks in
    // exact screen pixels.
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'editor-ui');
    const worldObjects = [...this.children.list];

    // ---- Control panel ----
    const npcs = cl.getNpcs().map((n) => ({ id: n.id, name: n.name }));
    const doorTargets = [
      ...cl.getZoneIds().map((id) => ({
        zoneId: id as string | null,
        label: id.replace('zone_', 'Z'),
      })),
      { zoneId: null, label: 'AUCUNE' },
    ];

    // Music choices from the audio manifest: every `music.*` key, plus the
    // null entry = "no track" (zone keeps whatever is playing).
    const audio = cl.getAudioManifest();
    const musicChoices: { key: string | null; label: string }[] = Object.keys(audio ?? {})
      .filter((k) => k.startsWith('music.'))
      .map((k) => ({ key: k, label: k.replace('music.', '').toUpperCase() }));
    musicChoices.push({ key: null, label: cl.getString('editor.entities.targetNone') });

    this.panel = createEditorPanel(this, {
      strings: {
        title: cl.getString('editor.title'),
        layers: cl.getString('editor.layers'),
        layerGround: cl.getString('editor.layer.ground'),
        layerWalls: cl.getString('editor.layer.walls'),
        layerDecor: cl.getString('editor.layer.decor'),
        tools: cl.getString('editor.tools'),
        toolBrush: cl.getString('editor.tool.brush'),
        toolEraser: cl.getString('editor.tool.eraser'),
        toolPicker: cl.getString('editor.tool.picker'),
        toolGrid: cl.getString('editor.grid'),
        tiles: cl.getString('editor.tiles'),
        tabTiles: cl.getString('editor.tab.tiles'),
        tabEntities: cl.getString('editor.tab.entities'),
        tabZone: cl.getString('editor.tab.zone'),
        npcsSection: cl.getString('editor.entities.npcs'),
        doorsSection: cl.getString('editor.entities.doors'),
        propsSection: cl.getString('editor.entities.props'),
        spawn: cl.getString('editor.entities.spawn'),
        erase: cl.getString('editor.entities.erase'),
        solid: cl.getString('editor.entities.solid'),
        targetNone: cl.getString('editor.entities.targetNone'),
        zoneName: cl.getString('editor.zone.name'),
        zoneBg: cl.getString('editor.zone.bg'),
        zoneMusic: cl.getString('editor.zone.music'),
        test: cl.getString('editor.test'),
        quit: cl.getString('editor.quit'),
        hints: cl.getString('editor.hints'),
      },
      npcs,
      doorTargets,
      musicChoices,
      initialName: this.draft.displayName ?? '',
      initialBg: this.draft.theme?.background ?? '',
    }, {
      onSelectLayer: (l) => this._setLayer(l),
      onSelectTool: (t) => this._setTool(t),
      onToggleGrid: () => this._toggleGrid(),
      onTab: (t) => this._setTab(t),
      onEntityMode: (m) => this._setEntityMode(m),
      onSelectNpc: (id) => this._selectNpc(id),
      onSelectDoorTarget: (z) => this._selectDoorTarget(z),
      onToggleSolid: () => this._toggleSolid(),
      onPropRectPicked: (r) => this._setPropRect(r),
      onNameChange: (v) => this._setZoneName(v),
      onBgChange: (v) => this._setZoneBg(v),
      onMusicSelect: (m) => this._setZoneMusic(m),
      onTest: () => this._testPlay(),
      onQuit: () => this._quit(),
      onSelectTile: (idx) => this._selectTile(idx),
    });
    this.panel.setLayer(this.layer);
    this.panel.setTool(this.tool);
    this.panel.setGridVisible(this.gridOn);
    this.panel.setSelectedTile(this.tile);
    this.panel.setMusic(this.draft.music ?? null);
    this.panel.setStatus(cl.getString(resumed ? 'editor.resume' : 'editor.newDraft'));

    // Split rendering: panel objects (created after the world snapshot) belong
    // to uiCam only; world objects render on main only.
    this.panelObjects = this.children.list.filter((o) => !worldObjects.includes(o));
    this.cameras.main.ignore(this.panelObjects);
    this.uiCam.ignore(worldObjects);

    // ---- Input ----
    this._bindPointerInput();
    this._bindKeyboard();

    this.cameras.main.fadeIn(250, 0, 0, 0);
  }

  // ---------------------------------------------------------------------------
  // Draft helpers
  // ---------------------------------------------------------------------------

  /** Sentinel id under which the draft is registered/tested/exported. */
  static readonly DRAFT_ID = 'zone_draft';

  /** localStorage key holding the auto-saved draft. */
  static readonly DRAFT_KEY = 'codysse.editor.draft.v1';

  /** Deep clone of a zone via JSON — the draft owns its own arrays. */
  private static _cloneZone(zone: ZoneData): ZoneData {
    return JSON.parse(JSON.stringify(zone)) as ZoneData;
  }

  /** Persist the draft to localStorage. */
  private _persistDraft(): void {
    try {
      localStorage.setItem(EditorScene.DRAFT_KEY, JSON.stringify(this.draft));
    } catch (e) {
      console.warn('EditorScene: could not persist draft:', e);
    }
  }

  /** Load the stored draft, or null when absent/malformed. */
  private _loadStoredDraft(): ZoneData | null {
    try {
      const raw = localStorage.getItem(EditorScene.DRAFT_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ZoneData;
      if (
        typeof parsed !== 'object' || parsed === null ||
        typeof parsed.id !== 'string' ||
        !parsed.map || !Array.isArray(parsed.map.ground) ||
        typeof parsed.spawn !== 'object' || parsed.spawn === null
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  /** Panel width (canvas px) — shared geometry constant from the panel. */
  private panelWidth(): number {
    return PANEL_W;
  }

  private _bindPointerInput(): void {
    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        // Right button → camera pan
        this.panning = true;
        this.panStart = {
          x: pointer.x,
          y: pointer.y,
          scrollX: this.cameras.main.scrollX,
          scrollY: this.cameras.main.scrollY,
        };
        return;
      }
      if (pointer.leftButtonDown() && !this.panel.isOverUI(pointer.x, pointer.y)) {
        this.painting = true;
        this._applyClick(pointer);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.panning) {
        const cam = this.cameras.main;
        cam.scrollX = this.panStart.scrollX - (pointer.x - this.panStart.x) / cam.zoom;
        cam.scrollY = this.panStart.scrollY - (pointer.y - this.panStart.y) / cam.zoom;
        return;
      }
      if (this.painting && pointer.leftButtonDown()) {
        this._applyClick(pointer);
      }
    });

    this.input.on('pointerup', () => {
      this.painting = false;
      this.panning = false;
      this._entityStrokeSeen = false;
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      const factor = dy > 0 ? 0.85 : 1.18;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, 0.1, 1.2));
    });
  }

  private _bindKeyboard(): void {
    const kb = this.input.keyboard!;
    // While a zone-tab text field is focused, keystrokes belong to the field —
    // don't switch tools/quit while the user types a name or a hex colour.
    const gated = (fn: () => void) => () => {
      if (!this.panel.isEditingText()) fn();
    };
    kb.on('keydown-B', gated(() => this._setTool('brush')));
    kb.on('keydown-X', gated(() => this._setTool('eraser')));
    kb.on('keydown-P', gated(() => this._setTool('picker')));
    kb.on('keydown-G', gated(() => this._toggleGrid()));
    kb.on('keydown-ESC', gated(() => {
      if (this.issuesOverlay) {
        this._closeIssues();
        return;
      }
      this._quit();
    }));
  }

  // ---------------------------------------------------------------------------
  // Editing
  // ---------------------------------------------------------------------------

  private _setLayer(layer: EditorLayer): void {
    this.layer = layer;
    this.panel.setLayer(layer);
  }

  private _setTool(tool: EditorTool): void {
    this.tool = tool;
    this.panel.setTool(tool);
  }

  private _toggleGrid(): void {
    this.gridOn = !this.gridOn;
    this.gridG.setVisible(this.gridOn);
    this.panel.setGridVisible(this.gridOn);
  }

  private _selectTile(tileIndex: number): void {
    this.tile = tileIndex;
    this.panel.setSelectedTile(tileIndex);
    // Picking a tile switches back to the brush — the natural flow after
    // choosing a new tile is to paint with it.
    this._setTool('brush');
  }

  /** Convert canvas pointer position to tile coordinates within the map. */
  private _tileAt(pointer: Phaser.Input.Pointer): { tx: number; ty: number } | null {
    const map = this.draft.map!;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cell = map.tileSize * map.tileScale;
    const tx = Math.floor(world.x / cell);
    const ty = Math.floor(world.y / cell);
    if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
    return { tx, ty };
  }

  /** Apply the active tile tool at the tile under the pointer (tiles tab). */
  private _applyToolAt(pointer: Phaser.Input.Pointer): void {
    const pos = this._tileAt(pointer);
    if (!pos) return;
    const map = this.draft.map!;

    if (this.tool === 'picker') {
      const idx = map[this.layer][pos.ty][pos.tx];
      if (idx >= 0) this._selectTile(idx);
      return;
    }

    const value = this.tool === 'eraser' ? -1 : this.tile;
    const current = map[this.layer][pos.ty][pos.tx];
    if (current === value) return; // idempotent per tile in the stroke
    map[this.layer][pos.ty][pos.tx] = value;

    const layerObj = this._layerObject(this.layer);
    if (value < 0) {
      layerObj.removeTileAt(pos.tx, pos.ty);
    } else {
      layerObj.putTileAt(value, pos.tx, pos.ty);
    }
    this._setStatusTouched();
  }

  /**
   * Apply the active action at the pointer position.
   * Tiles tab → tile tools (brush/eraser/pipette, stroke-dragged).
   * Entities tab → single-click placement/erase (no stroke dragging).
   */
  private _applyClick(pointer: Phaser.Input.Pointer): void {
    if (this.tab === 'tiles') {
      this._applyToolAt(pointer);
      return;
    }

    // Entities tab: placement is a single click per position — ignore held drags.
    if (this.painting && this._entityStrokeSeen) return;
    this._entityStrokeSeen = true;
    this._applyEntityAt(pointer);
  }

  /** True while a stroke is held — entities only apply once per press. */
  private _entityStrokeSeen = false;

  /** Apply the active entity mode at the pointer's world position. */
  private _applyEntityAt(pointer: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const cl = ContentLoader.getInstance();

    switch (this.entityMode) {
      case 'spawn': {
        this.draft.spawn = { x: Math.round(world.x), y: Math.round(world.y) };
        break;
      }

      case 'npc': {
        if (!this.selectedNpcId) break;
        const positions = (this.draft.npcPositions ??= {});
        positions[this.selectedNpcId] = { x: Math.round(world.x), y: Math.round(world.y) };
        if (!this.draft.npcs.includes(this.selectedNpcId)) {
          this.draft.npcs.push(this.selectedNpcId);
        }
        break;
      }

      case 'door': {
        // Unique door id per zone: door_1, door_2, ...
        let n = 1;
        while (this.draft.doors.some((d) => d.id === `door_${n}`)) n++;
        this.draft.doors.push({
          id: `door_${n}`,
          position: { x: Math.round(world.x), y: Math.round(world.y) },
          lockedMessageKey: 'door.locked',
          exitMessageKey: 'door.exit',
          ...(this.doorTarget ? { leadsToZoneId: this.doorTarget } : {}),
        });
        break;
      }

      case 'prop': {
        if (!this.propRect) break;
        this.draft.map!.props.push({
          rect: [...this.propRect] as [number, number, number, number],
          x: Math.round(world.x),
          y: Math.round(world.y),
          ...(this.propSolid ? { solid: true } : {}),
        });
        break;
      }

      case 'erase': {
        // Nearest entity (npc / door / prop) within a pick radius.
        const RADIUS = 90;
        let best: { kind: 'npc' | 'door' | 'prop'; index: number; dist: number } | null = null;
        const consider = (kind: 'npc' | 'door' | 'prop', index: number, x: number, y: number) => {
          const d = Phaser.Math.Distance.Between(world.x, world.y, x, y);
          if (d <= RADIUS && (!best || d < best.dist)) best = { kind, index, dist: d };
        };

        this.draft.npcs.forEach((id, i) => {
          const pos = this.draft.npcPositions?.[id] ?? cl.getNpc(id)?.position;
          if (pos) consider('npc', i, pos.x, pos.y);
        });
        this.draft.doors.forEach((d, i) => consider('door', i, d.position.x, d.position.y));
        this.draft.map!.props.forEach((p, i) => consider('prop', i, p.x, p.y));

        if (!best) return;
        const hit = best as { kind: 'npc' | 'door' | 'prop'; index: number };
        if (hit.kind === 'npc') {
          const [id] = this.draft.npcs.splice(hit.index, 1);
          delete this.draft.npcPositions?.[id];
        } else if (hit.kind === 'door') {
          this.draft.doors.splice(hit.index, 1);
        } else {
          this.draft.map!.props.splice(hit.index, 1);
        }
        break;
      }
    }

    this._persistDraft();
    this._setStatusTouched();
    this._rebuildWorld();
  }

  /**
   * Full world-side rebuild after any entity edit: destroy every world
   * display object (tilemap layers, props, grid, markers — everything except
   * the panel) and re-run MapBuilder + marker drawing from the draft.
   *
   * 40×23 rebuilds in well under a frame of work; correctness beats
   * incremental diffing at this scale.
   */
  private _rebuildWorld(): void {
    const panelSet = new Set(this.panelObjects);

    for (const m of this.markers) m.destroy();
    this.markers = [];
    this.gridG.destroy();

    for (const child of [...this.children.list]) {
      if (!panelSet.has(child)) child.destroy();
    }

    this.built = MapBuilder.build(this, this.draft);
    this.gridG = this.add.graphics().setDepth(5000);
    this.gridG.setVisible(this.gridOn);
    this._redrawGrid();
    this._drawEntityMarkers();

    // New world objects must not be rendered by the screen-space UI camera.
    this.uiCam.ignore(this.children.list.filter((o) => !panelSet.has(o)));
  }

  private _setTab(tab: EditorTab): void {
    this.tab = tab;
    this.panel.setTab(tab);
  }

  private _setEntityMode(mode: EntityMode): void {
    this.entityMode = mode;
    this.panel.setEntityMode(mode);
  }

  private _selectNpc(npcId: string): void {
    this.selectedNpcId = npcId;
    this._setEntityMode('npc');
    this.panel.setSelectedNpc(npcId);
  }

  private _selectDoorTarget(zoneId: string | null): void {
    this.doorTarget = zoneId;
    this._setEntityMode('door');
    this.panel.setDoorTarget(zoneId);
  }

  private _toggleSolid(): void {
    this.propSolid = !this.propSolid;
    this.panel.setSolid(this.propSolid);
  }

  private _setPropRect(rect: [number, number, number, number] | null): void {
    this.propRect = rect;
    this.panel.setPropRect(rect);
    if (rect) this._setEntityMode('prop');
  }

  /** Zone tab — display name (persisted per keystroke; the panel owns the field). */
  private _setZoneName(value: string): void {
    this.draft.displayName = value;
    this._persistDraft();
    this._setStatusTouched();
  }

  /** Zone tab — camera background colour, normalised to a leading '#'. */
  private _setZoneBg(value: string): void {
    const hex = value.replace(/^#*/, '#');
    this.draft.theme = { ...(this.draft.theme ?? {}), background: hex };
    this.cameras.main.setBackgroundColor(hex);
    this._persistDraft();
    this._setStatusTouched();
  }

  /** Zone tab — music track (null = no track: whatever is playing keeps playing). */
  private _setZoneMusic(music: string | null): void {
    if (music) {
      this.draft.music = music;
      AudioManager.getInstance().playMusic(music);
    } else {
      delete this.draft.music;
      AudioManager.getInstance().playMusic('music.menu');
    }
    this.panel.setMusic(music);
    this._persistDraft();
    this._setStatusTouched();
  }

  /** Resolve the active layer name to its built TilemapLayer. */
  private _layerObject(layer: EditorLayer): Phaser.Tilemaps.TilemapLayer {
    switch (layer) {
      case 'ground': return this.built.groundLayer;
      case 'walls': return this.built.wallsLayer;
      case 'decor': return this.built.decorLayer;
    }
  }

  /** Show the "draft modified" status line (shared string key). */
  private _setStatusTouched(): void {
    this.panel.setStatus(ContentLoader.getInstance().getString('editor.dirty'));
  }

  // ---------------------------------------------------------------------------
  // Visuals
  // ---------------------------------------------------------------------------

  /** Redraw the grid overlay across the full map. */
  private _redrawGrid(): void {
    const map = this.draft.map!;
    const cell = map.tileSize * map.tileScale;
    const g = this.gridG;
    g.clear();
    g.lineStyle(1, COLORS.line, 0.7);
    for (let tx = 0; tx <= map.width; tx++) {
      g.lineBetween(tx * cell, 0, tx * cell, map.height * cell);
    }
    for (let ty = 0; ty <= map.height; ty++) {
      g.lineBetween(0, ty * cell, map.width * cell, ty * cell);
    }
    g.lineStyle(2, COLORS.cyan, 0.9);
    g.strokeRect(0, 0, map.width * cell, map.height * cell);
  }

  /**
   * Draw read-only markers for spawn, doors and NPCs so the author sees
   * what the zone already contains. Placement/deletion of these entities
   * is an upcoming phase; for now they mirror the draft data.
   *
   * NPC positions come from npcs.json for now (per-zone positions land in
   * the entity-editing phase).
   */
  private _drawEntityMarkers(): void {
    const cl = ContentLoader.getInstance();

    // Spawn — green circle + label
    const s = this.draft.spawn;
    const ring = this.add.circle(s.x, s.y, 24, COLORS.green, 0.15).setStrokeStyle(2, COLORS.green, 0.9);
    ring.setDepth(6000);
    const spawnLabel = this.add.text(s.x, s.y - 34, 'SPAWN', {
      fontFamily: 'monospace', fontSize: '13px', color: '#3dfc8e',
    }).setOrigin(0.5).setDepth(6000);
    this.markers.push(ring, spawnLabel);

    // Doors — gate sprite (locked frame) + door id
    for (const door of this.draft.doors) {
      const img = this.add.sprite(door.position.x, door.position.y, 'gate', 0).setScale(2.5);
      img.setDepth(door.position.y + img.displayHeight / 2);
      const label = this.add.text(door.position.x, door.position.y - img.displayHeight / 2 - 10, door.id, {
        fontFamily: 'monospace', fontSize: '13px', color: '#ffaaaa',
      }).setOrigin(0.5, 1).setDepth(door.position.y + img.displayHeight / 2);
      this.markers.push(img, label);
    }

    // NPCs — idle frame sprite + name. Per-zone overrides (draft.npcPositions)
    // take precedence over the npcs.json global position (level editor, J6).
    for (const npcId of this.draft.npcs) {
      const npcData = cl.getNpc(npcId);
      if (!npcData) continue;
      const pos = this.draft.npcPositions?.[npcId] ?? npcData.position;
      const sprite = this.add.sprite(pos.x, pos.y, `npc_${npcId}`, 1).setScale(5);
      sprite.setDepth(pos.y + sprite.displayHeight / 2);
      const label = this.add.text(pos.x, pos.y - sprite.displayHeight / 2 - 10, npcData.name, {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffffaa',
      }).setOrigin(0.5, 1).setDepth(pos.y + sprite.displayHeight / 2);
      this.markers.push(sprite, label);
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Play the draft in the real engine (ZoneScene).
   *
   * Runs the level validator first — error-level issues block the test
   * and open the issues overlay instead. Otherwise: persists the draft
   * (so returning to the editor restores it), registers the draft zone
   * into ContentLoader under `zone_draft`, enters sandbox mode so nothing
   * writes to the real save, then starts ZoneScene with
   * returnTo=EditorScene so Escape brings the user back here.
   */
  private _testPlay(): void {
    const cl = ContentLoader.getInstance();

    const result = this._validate();
    if (result.blocked) {
      this._showIssues(result.issues, true);
      return;
    }

    this._persistDraft();
    cl.registerRuntimeZone(this.draft);
    SaveSystem.getInstance().setSandbox(true);
    SaveSystem.getInstance().load(); // reset in-memory save to the on-disk state

    if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');
    if (!this.scene.isActive('TimelineScene')) this.scene.launch('TimelineScene');
    this.scene.start('ZoneScene', { zoneId: EditorScene.DRAFT_ID, returnTo: 'EditorScene' });
  }

  /** Validate the draft against the full engine content. */
  private _validate() {
    const cl = ContentLoader.getInstance();
    return LevelValidator.validate(this.draft, cl.getNpcs(), cl.getZoneIds());
  }

  /**
   * Issues overlay — screen-space panel listing validation findings.
   *
   * Rendered by the uiCam like the panel (ignored by the main camera);
   * only one overlay exists at a time (previous one destroyed first).
   * When `blocked` is set, Escape closes the overlay instead of quitting.
   */
  private _showIssues(issues: ValidationIssue[], blocked: boolean): void {
    const cl = ContentLoader.getInstance();
    this._closeIssues();

    const { width, height } = this.scale;
    const objs: Phaser.GameObjects.GameObject[] = [];

    const dim = this.add.rectangle(width / 2, height / 2, width - PANEL_W, height, COLORS.bg, 0.72);
    dim.setDepth(20000).setScrollFactor(0).setInteractive({ useHandCursor: false }); // swallow world clicks
    objs.push(dim);

    const panelW = 560;
    const lineH = 24;
    const shown = issues.slice(0, 14);
    const panelH = 96 + shown.length * lineH;
    const px = (width - PANEL_W) / 2;
    const py = height / 2;

    const bgRect = this.add.rectangle(px, py, panelW, panelH, COLORS.panel, 1).setStrokeStyle(1, blocked ? COLORS.red : COLORS.line, 1);
    bgRect.setDepth(20001).setScrollFactor(0);
    objs.push(bgRect);

    const title = this.add.text(px, py - panelH / 2 + 18, cl.getString('editor.issues.title'), {
      fontFamily: 'monospace', fontSize: '15px', color: blocked ? '#ff6a6a' : COLORS.amberCss,
    }).setOrigin(0.5).setDepth(20002).setScrollFactor(0);
    objs.push(title);

    shown.forEach((issue, i) => {
      const raw = cl.getString(issue.key);
      const text = raw.replace(/\{(\w+)\}/g, (_, name) => issue.params?.[name] ?? `{${name}}`);
      const line = this.add.text(px - panelW / 2 + 24, py - panelH / 2 + 48 + i * lineH, text, {
        fontFamily: 'monospace', fontSize: '12px',
        color: issue.level === 'error' ? '#ff8a8a' : COLORS.amberCss,
      }).setOrigin(0, 0).setDepth(20002).setScrollFactor(0);
      objs.push(line);
    });

    if (blocked) {
      const note = this.add.text(px, py + panelH / 2 - 46, cl.getString('editor.issues.blocked'), {
        fontFamily: 'monospace', fontSize: '12px', color: '#ff6a6a',
      }).setOrigin(0.5).setDepth(20002).setScrollFactor(0);
      objs.push(note);
    }

    const closeY = py + panelH / 2 + 24;
    const closeBtn = this.add.rectangle(px, closeY, panelW / 2, 30, COLORS.line, 1).setStrokeStyle(1, COLORS.line, 1);
    closeBtn.setDepth(20002).setScrollFactor(0).setInteractive({ useHandCursor: true });
    const closeLabel = this.add.text(px, closeY, cl.getString('editor.issues.close'), {
      fontFamily: 'monospace', fontSize: '12px', color: COLORS.inkCss,
    }).setOrigin(0.5).setDepth(20003).setScrollFactor(0);
    closeBtn.on('pointerdown', () => this._closeIssues());
    objs.push(closeBtn, closeLabel);

    // Screen-space: main camera must not render the overlay (uiCam does).
    this.cameras.main.ignore(objs);
    this.issuesOverlay = { objs };
  }

  /** Destroy the issues overlay when open. */
  private _closeIssues(): void {
    if (!this.issuesOverlay) return;
    for (const o of this.issuesOverlay.objs) o.destroy();
    this.issuesOverlay = null;
  }

  /** Persist the draft and return to the main menu. */
  private _quit(): void {
    this._persistDraft();
    this.scene.start('MainMenuScene');
  }
}
