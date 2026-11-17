import type Phaser from 'phaser';

type Handler = (...args: any[]) => void;

/**
 * EventScope — tracks listeners added to a shared emitter so they can be
 * removed together, and ONLY them.
 *
 * Why: the global bus (`game.events`) outlives scenes. Calling
 * `removeAllListeners(event)` on scene exit also removed listeners owned by
 * long-lived systems (e.g. AudioManager's NPC_RESOLVED → "correct" sound,
 * which went silent after the first zone change), while scenes that never
 * cleaned up (UIScene, TimelineScene) accumulated duplicate handlers on every
 * menu → play round trip.
 *
 * Usage:
 *   const scope = new EventScope(this.game.events);
 *   scope.on(GameEvents.XP_CHANGED, (c) => …);
 *   this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scope.clear());
 */
export class EventScope {
  private readonly entries: Array<[string, Handler]> = [];

  constructor(private readonly emitter: Phaser.Events.EventEmitter) {}

  /** Subscribe `fn` to `event` and remember it for clear(). */
  on(event: string, fn: Handler): void {
    this.emitter.on(event, fn);
    this.entries.push([event, fn]);
  }

  /** Remove every listener registered through this scope. Idempotent. */
  clear(): void {
    for (const [event, fn] of this.entries) {
      this.emitter.off(event, fn);
    }
    this.entries.length = 0;
  }
}
