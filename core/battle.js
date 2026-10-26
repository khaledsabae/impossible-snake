// Deterministic 4-Snake Color Battle Arena engine ("Pick your color").
//
// Four color-coded snakes (RED, VIOLET, GOLD, CYAN) spawn symmetrically in the
// four corners of an 18x18 arena facing clockwise. Every tick, all living snakes
// step simultaneously. Eliminated snakes shatter into bonus loot apples on the
// board, and a closing perimeter ring tightens in the late game so every match
// finishes decisively with a single last-snake-standing champion.

import { mulberry32 } from './rng.js';
import { UP, RIGHT, DOWN, LEFT } from './game.js';

export { UP, RIGHT, DOWN, LEFT };

export const COLORS = [
  { id: 0, key: 'red',    name: 'RED',    bodyA: '#ff3b5c', bodyB: '#c9184a', head: '#ffccd5', accent: '#ff4d6d' },
  { id: 1, key: 'violet', name: 'VIOLET', bodyA: '#b517ff', bodyB: '#7209b7', head: '#f3d5ff', accent: '#c77dff' },
  { id: 2, key: 'gold',   name: 'GOLD',   bodyA: '#ffbe0b', bodyB: '#e85d04', head: '#fff3b0', accent: '#ffd166' },
  { id: 3, key: 'cyan',   name: 'CYAN',   bodyA: '#00f5d4', bodyB: '#00bbf9', head: '#cbf3f0', accent: '#00f5d4' },
];

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const OPP = [2, 3, 0, 1];

export class BattleGame {
  constructor(seed = 1, opts = {}) {
    this.seed = seed >>> 0;
    this.rand = mulberry32(this.seed);
    this.w = opts.width || 18;
    this.h = opts.height || 18;
    this.n = this.w * this.h;
    this.targetApples = opts.targetApples || 5;
    this.shrinkStartTick = opts.shrinkStartTick ?? 75;
    this.shrinkEvery = opts.shrinkEvery ?? 32;
    this.maxShrinkRing = opts.maxShrinkRing ?? 4;
    this.maxTicks = opts.maxTicks ?? 320;
    this.tick = 0;
    this.shrinkRing = 0;

    // Symmetrical 4-corner spawns facing clockwise around the arena.
    // Corner rotation by (seed % 4) removes any micro-bias from array index order
    // while keeping every color's starting position and geometry 100% fair.
    const W = this.w, H = this.h;
    const c = (x, y) => y * W + x;
    const corners = [
      { cells: [c(3, 3), c(2, 3), c(1, 3)], dir: RIGHT },
      { cells: [c(W - 4, 3), c(W - 4, 2), c(W - 4, 1)], dir: DOWN },
      { cells: [c(W - 4, H - 4), c(W - 3, H - 4), c(W - 2, H - 4)], dir: LEFT },
      { cells: [c(3, H - 4), c(3, H - 3), c(3, H - 2)], dir: UP },
    ];
    const rot = this.seed & 3;

    this.obstacles = new Set();
    // Four symmetrical interior pillars (2x1 / 1x1 accents) at (6,6), (11,6), (11,11), (6,11)
    for (const [ox, oy] of [[6, 6], [W - 7, 6], [W - 7, H - 7], [6, H - 7]]) {
      this.obstacles.add(c(ox, oy));
    }

    this.snakes = COLORS.map((col, idx) => {
      const sp = corners[(idx + rot) & 3];
      return {
        id: idx,
        color: col.key,
        name: col.name,
        cells: sp.cells.slice(),
        dir: sp.dir,
        alive: true,
        growPending: 0,
        applesEaten: 0,
        kills: 0,
        eliminatedAtTick: null,
        eliminatedBy: null,
        deathCause: null,
      };
    });

    this.apples = []; // [{ cell, golden }]
    this.applesSpawned = 0;
    this.eliminations = []; // [{ tick, id, name, cause, killerId, cell }]
    this.winner = null;
    this.winAtTick = null;

    this.refillApples();
  }

  cellXY(cell) {
    return [cell % this.w, (cell / this.w) | 0];
  }

  stepCell(cell, dir) {
    const x = (cell % this.w) + DX[dir];
    const y = ((cell / this.w) | 0) + DY[dir];
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return y * this.w + x;
  }

  occupiedSet() {
    const occ = new Set(this.obstacles);
    for (const s of this.snakes) {
      if (!s.alive) continue;
      for (const cell of s.cells) occ.add(cell);
    }
    for (const a of this.apples) occ.add(a.cell);
    return occ;
  }

  refillApples() {
    const occ = this.occupiedSet();
    const r = this.shrinkRing;
    const free = [];
    for (let i = 0; i < this.n; i++) {
      if (occ.has(i)) continue;
      if (r > 0) {
        const x = i % this.w, y = (i / this.w) | 0;
        if (x < r || x >= this.w - r || y < r || y >= this.h - r) continue;
      }
      free.push(i);
    }
    while (this.apples.length < this.targetApples && free.length > 0) {
      const idx = (this.rand() * free.length) | 0;
      const cell = free[idx];
      free[idx] = free[free.length - 1];
      free.pop();
      this.applesSpawned++;
      const golden = (this.applesSpawned % 5) === 0;
      this.apples.push({ cell, golden });
    }
  }

  applyArenaShrink() {
    const wantRing = this.tick >= this.shrinkStartTick
      ? Math.min(this.maxShrinkRing, 1 + Math.floor((this.tick - this.shrinkStartTick) / this.shrinkEvery))
      : 0;
    if (wantRing <= 0) return;
    this.shrinkRing = Math.max(this.shrinkRing, wantRing);
    const snakeCells = new Set();
    for (const s of this.snakes) {
      if (s.alive) for (const c of s.cells) snakeCells.add(c);
    }
    for (let r = 0; r < this.shrinkRing; r++) {
      for (let x = r; x < this.w - r; x++) {
        for (const y of [r, this.h - 1 - r]) {
          const c = y * this.w + x;
          if (!snakeCells.has(c)) this.obstacles.add(c);
        }
      }
      for (let y = r + 1; y < this.h - 1 - r; y++) {
        for (const x of [r, this.w - 1 - r]) {
          const c = y * this.w + x;
          if (!snakeCells.has(c)) this.obstacles.add(c);
        }
      }
    }
    this.apples = this.apples.filter((a) => !this.obstacles.has(a.cell));
  }

  aliveSnakes() {
    return this.snakes.filter((s) => s.alive);
  }

  /**
   * Advance one simultaneous tick.
   * @param {number[]} dirs Array of 4 directions [d0, d1, d2, d3]
   */
  step(dirs) {
    if (this.winner !== null) return { tick: this.tick, eliminations: [], ate: [], winner: this.winner };
    this.tick++;

    const aliveBefore = this.aliveSnakes();
    const prevCells = new Map();
    const nextHead = new Map();

    for (const s of aliveBefore) {
      prevCells.set(s.id, s.cells.slice());
      let d = dirs[s.id] !== undefined ? Number(dirs[s.id]) : s.dir;
      if (s.cells.length > 1 && d === OPP[s.dir]) d = s.dir;
      s.dir = d;
      nextHead.set(s.id, this.stepCell(s.cells[0], d));
    }

    // Determine which snakes will eat an apple at their nextHead
    const appleAt = new Map();
    for (let i = 0; i < this.apples.length; i++) appleAt.set(this.apples[i].cell, this.apples[i]);

    const willGrow = new Set();
    for (const s of aliveBefore) {
      const nh = nextHead.get(s.id);
      if (s.growPending > 0 || appleAt.has(nh)) willGrow.add(s.id);
    }

    // Build body occupancy after tail retraction (before heads land)
    const bodyOwner = new Map(); // cell -> snakeId
    for (const s of aliveBefore) {
      const limit = willGrow.has(s.id) ? s.cells.length : s.cells.length - 1;
      for (let k = 0; k < limit; k++) {
        bodyOwner.set(s.cells[k], s.id);
      }
    }

    const doomed = new Map(); // snakeId -> { cause, killerId, cell }

    // 1. Wall, obstacle, body, and head-swap collisions
    for (const s of aliveBefore) {
      const nh = nextHead.get(s.id);
      if (nh < 0) {
        doomed.set(s.id, { cause: 'wall', killerId: null, cell: s.cells[0] });
        continue;
      }
      if (this.obstacles.has(nh)) {
        doomed.set(s.id, { cause: 'obstacle', killerId: null, cell: nh });
        continue;
      }
      if (bodyOwner.has(nh)) {
        const owner = bodyOwner.get(nh);
        doomed.set(s.id, {
          cause: owner === s.id ? 'self' : 'rival',
          killerId: owner === s.id ? null : owner,
          cell: nh,
        });
        continue;
      }
      // Head-on swap check: s moves into rival's old head while rival moves into s's old head
      for (const r of aliveBefore) {
        if (r.id === s.id) continue;
        if (nh === r.cells[0] && nextHead.get(r.id) === s.cells[0]) {
          // Longer snake wins the head-on clash; tie broken deterministically
          const sScore = s.cells.length * 1000 + s.applesEaten * 10 + ((s.id + this.seed + this.tick) & 3);
          const rScore = r.cells.length * 1000 + r.applesEaten * 10 + ((r.id + this.seed + this.tick) & 3);
          if (sScore < rScore) {
            doomed.set(s.id, { cause: 'clash', killerId: r.id, cell: nh });
          }
        }
      }
    }

    // 2. Same-cell head-to-head collisions among remaining non-doomed snakes
    const cellContenders = new Map();
    for (const s of aliveBefore) {
      if (doomed.has(s.id)) continue;
      const nh = nextHead.get(s.id);
      if (!cellContenders.has(nh)) cellContenders.set(nh, []);
      cellContenders.get(nh).push(s);
    }
    for (const [nh, list] of cellContenders.entries()) {
      if (list.length <= 1) continue;
      list.sort((a, b) => {
        const sa = a.cells.length * 1000 + a.applesEaten * 10 + ((a.id + this.seed + this.tick) & 3);
        const sb = b.cells.length * 1000 + b.applesEaten * 10 + ((b.id + this.seed + this.tick) & 3);
        return sb - sa;
      });
      const survivor = list[0];
      for (let k = 1; k < list.length; k++) {
        doomed.set(list[k].id, { cause: 'clash', killerId: survivor.id, cell: nh });
      }
    }

    // 3. Last-survivor safeguard: never allow all remaining snakes to die on the same tick.
    if (doomed.size >= aliveBefore.length && aliveBefore.length > 0) {
      const ranked = aliveBefore.slice().sort((a, b) => {
        const sa = a.cells.length * 1000 + a.applesEaten * 10 + ((a.id + this.seed) & 3);
        const sb = b.cells.length * 1000 + b.applesEaten * 10 + ((b.id + this.seed) & 3);
        return sb - sa;
      });
      const saved = ranked[0];
      doomed.delete(saved.id);
      // Keep saved snake in place if its target cell was out of bounds
      if (nextHead.get(saved.id) < 0) nextHead.set(saved.id, saved.cells[0]);
    }

    const tickElims = [];
    const tickAte = [];

    // Process eliminations and drop loot apples from eliminated bodies
    for (const [id, info] of doomed.entries()) {
      const s = this.snakes[id];
      s.alive = false;
      s.eliminatedAtTick = this.tick;
      s.eliminatedBy = info.killerId;
      s.deathCause = info.cause;
      if (info.killerId !== null && this.snakes[info.killerId]) {
        this.snakes[info.killerId].kills++;
      }
      const ev = {
        tick: this.tick,
        id: s.id,
        color: s.color,
        name: s.name,
        cause: info.cause,
        killerId: info.killerId,
        killerName: info.killerId !== null ? this.snakes[info.killerId].name : null,
        cell: info.cell,
        droppedCells: s.cells.slice(),
      };
      this.eliminations.push(ev);
      tickElims.push(ev);
    }

    // Advance surviving snakes
    for (const s of aliveBefore) {
      if (!s.alive) continue;
      const nh = nextHead.get(s.id);
      if (nh !== s.cells[0]) {
        s.cells.unshift(nh);
        const eaten = appleAt.get(nh);
        if (eaten) {
          s.applesEaten++;
          this.apples = this.apples.filter((a) => a.cell !== nh);
          if (eaten.golden) s.growPending += 2; // +1 now + 2 pending = +3
          tickAte.push({ id: s.id, cell: nh, golden: !!eaten.golden, len: s.cells.length });
        } else if (s.growPending > 0) {
          s.growPending--;
        } else {
          s.cells.pop();
        }
      }
    }

    // Spawn loot apples from eliminated snakes' bodies (every 3rd segment that is free)
    if (tickElims.length > 0) {
      const occ = this.occupiedSet();
      for (const el of tickElims) {
        for (let k = 1; k < el.droppedCells.length; k += 3) {
          const c = el.droppedCells[k];
          if (!occ.has(c) && this.apples.length < this.targetApples + 4) {
            this.apples.push({ cell: c, golden: k === 1 });
            occ.add(c);
          }
        }
      }
    }

    this.applyArenaShrink();
    this.refillApples();

    // Check victory condition (1 snake left, or maxTicks reached)
    const remaining = this.aliveSnakes();
    if (remaining.length === 1) {
      this.winner = remaining[0].id;
      this.winAtTick = this.tick;
    } else if (this.tick >= this.maxTicks && remaining.length > 1) {
      // Sudden-death tiebreak by length + applesEaten, eliminating runner-ups cleanly
      remaining.sort((a, b) => {
        const sa = a.cells.length * 1000 + a.applesEaten * 10 + ((a.id + this.seed) & 3);
        const sb = b.cells.length * 1000 + b.applesEaten * 10 + ((b.id + this.seed) & 3);
        return sb - sa;
      });
      const champ = remaining[0];
      for (let k = 1; k < remaining.length; k++) {
        const loser = remaining[k];
        loser.alive = false;
        loser.eliminatedAtTick = this.tick;
        loser.eliminatedBy = champ.id;
        loser.deathCause = 'ring';
        const ev = {
          tick: this.tick,
          id: loser.id,
          color: loser.color,
          name: loser.name,
          cause: 'ring',
          killerId: champ.id,
          killerName: champ.name,
          cell: loser.cells[0],
          droppedCells: loser.cells.slice(),
        };
        this.eliminations.push(ev);
        tickElims.push(ev);
      }
      this.winner = champ.id;
      this.winAtTick = this.tick;
    }

    return {
      tick: this.tick,
      eliminations: tickElims,
      ate: tickAte,
      winner: this.winner,
    };
  }
}
