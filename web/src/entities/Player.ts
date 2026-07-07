import Phaser from 'phaser';

/**
 * Player — the player-controlled character entity.
 *
 * Wraps a Phaser ArcadeSprite with movement logic, animation state,
 * and scale ×5 pixel-art rendering. Animations are registered once
 * on first creation and reused across scene restarts (Phaser global anim cache).
 *
 * Speed calibration:
 *  Unity move.cs: velocity = direction × 5 in world units.
 *  Phaser equivalent: `SPEED = 5 * TILE_SIZE * SCALE` would be too fast —
 *  instead we empirically set SPEED = 180 px/s (at ×5 scale the sprite is
 *  160px tall, so "5 units" ≈ 1 sprite-height/s feels like the Unity prototype).
 *  This deviates from a naive unit conversion but matches the perceptual feel.
 *  See boucle-reference.md §Déplacement.
 *
 * Walk cycle: [1,0,1,2] per direction group, 8 fps, as specified in 02-assets.md.
 * Right direction = left group frames with flipX=true.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  /** Pixel/s movement speed — calibrated to Unity's speed=5 feel at ×5 scale. */
  static readonly SPEED = 180;

  /** Sprite display scale — pixel-art ×5 (02-assets.md §Animations Phaser). */
  static readonly SCALE = 5;

  /**
   * Last horizontal/vertical facing direction.
   * Preserved so the correct idle frame is shown when the player stops.
   */
  private lastDirection: 'down' | 'up' | 'left' | 'right' = 'down';

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player', 1); // frame 1 = idle-down (middle frame)
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setScale(Player.SCALE);
    // Narrow physics body so the player doesn't clip walls by the full sprite width
    // at scale ×5 the sprite is 160×160 px, we use a 20×20 px hitbox (4px in sprite coords)
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(8, 8);
    body.setCollideWorldBounds(true);

    // Top-down y-sort (BUG-09): depth = feet Y so the player renders in front
    // of NPCs when standing south of them and behind when north. Kept in sync
    // every frame in move().
    this.setDepth(this.y + this.displayHeight / 2);

    // Register animations on first creation; safe to call multiple times
    // (Phaser skips registration if key already exists in global anim manager)
    Player._registerAnims(scene);
  }

  /**
   * Update movement and animation based on cursor/WASD state.
   * Called from ZoneScene.update(). Does nothing if `frozen` is true.
   *
   * @param cursors - Standard Phaser cursor keys (arrow keys)
   * @param wasd - ZQSD key set (Phaser KeyboardPlugin objects)
   * @param frozen - When true, input is ignored (UI open)
   */
  move(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasd: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key },
    frozen: boolean,
  ): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Top-down y-sort (BUG-09): keep depth in sync with the feet position
    // so NPC/player overlap resolves correctly while moving.
    this.setDepth(this.y + this.displayHeight / 2);

    if (frozen) {
      // Freeze in place and show idle frame — don't let physics drift
      body.setVelocity(0, 0);
      this._showIdle();
      return;
    }

    // Resolve direction from any active key (diagonal: last axis wins by reading both)
    let vx = 0;
    let vy = 0;

    if (cursors.left.isDown || wasd.left.isDown) vx = -Player.SPEED;
    if (cursors.right.isDown || wasd.right.isDown) vx = Player.SPEED;
    if (cursors.up.isDown || wasd.up.isDown) vy = -Player.SPEED;
    if (cursors.down.isDown || wasd.down.isDown) vy = Player.SPEED;

    // Normalise diagonal to avoid faster diagonal movement
    if (vx !== 0 && vy !== 0) {
      const norm = 1 / Math.SQRT2;
      vx *= norm;
      vy *= norm;
    }

    body.setVelocity(vx, vy);

    if (vx < 0) {
      this.lastDirection = 'left';
      this.setFlipX(false);
      this.play('walk-left', true);
    } else if (vx > 0) {
      this.lastDirection = 'right';
      // Right = left animation with flipX (02-assets.md §Animations)
      this.setFlipX(true);
      this.play('walk-left', true);
    } else if (vy < 0) {
      this.lastDirection = 'up';
      this.setFlipX(false);
      this.play('walk-up', true);
    } else if (vy > 0) {
      this.lastDirection = 'down';
      this.setFlipX(false);
      this.play('walk-down', true);
    } else {
      // No input — show idle for current facing direction
      this._showIdle();
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Show the idle (middle) frame for the current facing direction without
   * re-playing the walk animation. Uses setFrame directly because idle is a
   * single frame, not a loop — playing a 1-frame anim would reset every update.
   */
  private _showIdle(): void {
    this.stop();
    switch (this.lastDirection) {
      case 'down':
        this.setFlipX(false);
        this.setFrame(1); // idle-down = frame 1
        break;
      case 'up':
        this.setFlipX(false);
        this.setFrame(4); // idle-up = frame 4
        break;
      case 'left':
        this.setFlipX(false);
        this.setFrame(7); // idle-left = frame 7
        break;
      case 'right':
        // idle-right = idle-left frame with flipX
        this.setFlipX(true);
        this.setFrame(7);
        break;
    }
  }

  /**
   * Register all player animations in the global Phaser animation manager.
   * Safe to call multiple times — skipped if already registered.
   *
   * Walk cycle [1,0,1,2] maps to [idle,step-left,idle,step-right] within each
   * direction group: this matches 02-assets.md frame layout and boucle-reference.
   */
  private static _registerAnims(scene: Phaser.Scene): void {
    const am = scene.anims;

    // Helper: build frame array in [idle, left-step, idle, right-step] order
    const frames = (base: number) => [
      { key: 'player', frame: base + 1 }, // idle (middle)
      { key: 'player', frame: base + 0 }, // left step
      { key: 'player', frame: base + 1 }, // idle
      { key: 'player', frame: base + 2 }, // right step
    ];

    const defs: Array<{ key: string; base: number }> = [
      { key: 'walk-down', base: 0 },
      { key: 'walk-up', base: 3 },
      { key: 'walk-left', base: 6 },
      // walk-right reuses walk-left with flipX — no separate anim needed
    ];

    for (const def of defs) {
      if (!am.exists(def.key)) {
        am.create({
          key: def.key,
          frames: frames(def.base),
          frameRate: 8, // 8 fps per boucle-reference.md
          repeat: -1,
        });
      }
    }
  }
}
