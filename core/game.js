// Pure, deterministic Snake engine. No rendering, no timing, no I/O.
// Shared verbatim by: the solvability gate, the video simulator, and the public
// web build — so what the audience plays is literally what the video shows.

import { mulberry32, randInt } from './rng.js';

export const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
export const DIR_NAMES = ['up', 'right', 'down', 'left'];
const DELTA = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const OPPOSITE = [DOWN, LEFT, UP, RIGHT];

export class Game {
  /**
   * @param {object} stage  ruleset from core/stages.js
   * @param {number} seed
   */
  constructor(stage, seed) {
    this.stage = stage;
    this.w = stage.width;
    this.h = stage.height;
    this.n = this.w * this.h;
    this.wrap = !!stage.wrap;
    this.goldenEvery = stage.goldenEvery | 0;      // 0 = disabled
    this.goldenGrowth = stage.goldenGrowth || 1;
    this.rng = mulberry32(seed);
    this.seed = seed;

    this.obstacles = new Set(stage.obstacles || []);
    this.movers = (stage.movers || []).map((m) => ({ path: m.path.slice(), phase: m.phase | 0 }));
    this.useMoverPockets = Boolean(stage.useMoverPockets || (stage.moverPockets && stage.moverPockets.length));
    this.moverPockets = new Set(stage.moverPockets || []);
    if (this.useMoverPockets) {
      for (const m of this.movers) for (const c of m.path) this.moverPockets.add(c);
    }

    // Movers withdraw once the board is this full — announced rule, and the
    // reason 100% stays reachable: a permanently-present mover would own a cell
    // the snake could never occupy, making a full board impossible by definition.
    this.moverDespawnFill = stage.moverDespawnFill ?? 0.85;
    this.moversGone = this.movers.length === 0;
    this.capacity = this.n - this.obstacles.size;

    const start = stage.start !== undefined ? stage.start : this.idx(1, 0);
    this.snake = [start];
    this.body = new Set([start]);
    this.dir = stage.startDir !== undefined ? stage.startDir : RIGHT;
    this.growPending = Math.max(0, (stage.startLength || 3) - 1);

    this.tick = 0;
    this.applesEaten = 0;
    this.fullAtTick = null;   // the tick the board first hit 100%
    this.endOnFull = stage.endOnFull || 'orbit';
    this.alive = true;
    this.deathCause = null;
    this.apple = -1;
    this.appleGolden = false;
    this.spawnApple();
  }

  idx(x, y) { return y * this.w + x; }
  xOf(i) { return i % this.w; }
  yOf(i) { return (i / this.w) | 0; }
  get head() { return this.snake[0]; }
  get tail() { return this.snake[this.snake.length - 1]; }
  get length() { return this.snake.length; }

  /** Cells currently blocked by moving obstacles at the current tick. */
  moverCells(atTick = this.tick) {
    const out = [];
    if (this.moversGone) return out;
    for (const m of this.movers) out.push(m.path[(atTick + m.phase) % m.path.length]);
    return out;
  }

  /** Neighbour cell in direction d, or -1 if off-board (and not wrapping). */
  neighbor(cell, d) {
    let x = this.xOf(cell) + DELTA[d][0];
    let y = this.yOf(cell) + DELTA[d][1];
    if (this.wrap) {
      x = (x + this.w) % this.w;
      y = (y + this.h) % this.h;
    } else if (x < 0 || y < 0 || x >= this.w || y >= this.h) {
      return -1;
    }
    return this.idx(x, y);
  }

  /**
   * Would moving into `cell` on the next tick kill the snake?
   * Single source of truth — the solver calls this so it can never disagree
   * with what step() actually enforces.
   */
  wouldDie(cell) {
    if (cell < 0) return 'wall';
    if (this.obstacles.has(cell)) return 'obstacle';
    if (!this.moversGone) {
      for (const m of this.movers) {
        const now = m.path[(this.tick + m.phase) % m.path.length];
        const next = m.path[(this.tick + 1 + m.phase) % m.path.length];
        if (now === cell || next === cell) return 'mover';
      }
    }
    if (this.body.has(cell)) {
      // The tail vacates this tick unless the snake is growing into it.
      const grows = this.growPending > 0 || cell === this.apple;
      if (!grows && cell === this.tail && this.snake.length > 1) return null;
      return 'self';
    }
    return null;
  }

  /** All legal-to-consider neighbours as [dir, cell]. Does not filter by death. */
  *neighbors(cell) {
    for (let d = 0; d < 4; d++) {
      const nc = this.neighbor(cell, d);
      if (nc >= 0) yield [d, nc];
    }
  }

  isGoldenNext() {
    return this.goldenEvery > 0 && (this.applesEaten + 1) % this.goldenEvery === 0;
  }

  spawnApple() {
    const blocked = new Set(this.body);
    for (const o of this.obstacles) blocked.add(o);
    if (this.useMoverPockets && !this.moversGone) {
      for (const c of this.moverPockets) blocked.add(c);
    } else {
      for (const c of this.moverCells()) blocked.add(c);
    }
    const free = [];
    for (let i = 0; i < this.n; i++) if (!blocked.has(i)) free.push(i);
    if (free.length === 0 && this.useMoverPockets && !this.moversGone) {
      const fallbackBlocked = new Set(this.body);
      for (const o of this.obstacles) fallbackBlocked.add(o);
      for (const c of this.moverCells()) fallbackBlocked.add(c);
      for (let i = 0; i < this.n; i++) if (!fallbackBlocked.has(i)) free.push(i);
    }
    if (free.length === 0) { this.apple = -1; this.appleGolden = false; return; }

    let golden = this.isGoldenNext();
    // Arithmetic gate: never let a golden apple overshoot the exact capacity.
    if (golden && this.snake.length + this.growPending + this.goldenGrowth > this.capacity) golden = false;

    this.apple = free[randInt(this.rng, free.length)];
    this.appleGolden = golden;
  }

  /**
   * Advance one tick in direction `d`. Returns an event record for the run log.
   */
  step(d) {
    if (!this.alive) return null;
    if (this.snake.length > 1 && d === OPPOSITE[this.dir]) d = this.dir; // reversal ignored, as in a real game
    const target = this.neighbor(this.head, d);
    const cause = this.wouldDie(target);

    this.tick++;
    this.dir = d;

    if (cause) {
      this.alive = false;
      this.deathCause = cause;
      return { tick: this.tick, dir: d, died: true, cause, length: this.snake.length };
    }

    const ate = target === this.apple;
    const golden = ate && this.appleGolden;

    this.snake.unshift(target);
    this.body.add(target);

    if (ate) {
      this.applesEaten++;
      const growth = golden ? this.goldenGrowth : 1;
      this.growPending += growth - 1; // the unshift above already granted +1
      this.spawnApple();
    } else if (this.growPending > 0) {
      this.growPending--;
    } else {
      const gone = this.snake.pop();
      this.body.delete(gone);
    }

    if (!this.moversGone && this.snake.length >= this.capacity * this.moverDespawnFill) {
      this.moversGone = true;
    }
    if (this.fullAtTick === null && this.snake.length >= this.capacity) {
      this.fullAtTick = this.tick;
      if (this.endOnFull === 'win') { this.alive = false; this.deathCause = 'complete'; }
    }
    return { tick: this.tick, dir: d, died: false, ate, golden, length: this.snake.length, full: this.fullAtTick !== null };
  }

  isFull() { return this.snake.length >= this.capacity; }
  fillRatio() { return this.snake.length / this.capacity; }
}
