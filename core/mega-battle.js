// Deterministic 8-Snake Mega Battle Royale engine (V6 Championship).
//
// Eight high-contrast contenders spawn symmetrically around a 22x22 arena.
// Shared multi-apple pool (golden +3 every 5th apple), shrinking perimeter
// monoliths tightening inward, elimination loot drops, and last-snake-standing
// sudden-death resolution.

import { mulberry32 } from './rng.js';
import { UP, RIGHT, DOWN, LEFT } from './game.js';

export { UP, RIGHT, DOWN, LEFT };

export const MEGA_COLORS = [
  { id: 0, key: 'red',     name: 'RED',     bodyA: '#ff3b5c', bodyB: '#c9184a', head: '#ffccd5', accent: '#ff4d6d' },
  { id: 1, key: 'violet',  name: 'VIOLET',  bodyA: '#b517ff', bodyB: '#7209b7', head: '#f3d5ff', accent: '#c77dff' },
  { id: 2, key: 'gold',    name: 'GOLD',    bodyA: '#ffbe0b', bodyB: '#e85d04', head: '#fff3b0', accent: '#ffd166' },
  { id: 3, key: 'cyan',    name: 'CYAN',    bodyA: '#00f5d4', bodyB: '#00bbf9', head: '#cbf3f0', accent: '#00f5d4' },
  { id: 4, key: 'emerald', name: 'EMERALD', bodyA: '#10b981', bodyB: '#047857', head: '#d1fae5', accent: '#34d399' },
  { id: 5, key: 'orange',  name: 'ORANGE',  bodyA: '#ff6b1a', bodyB: '#c2410c', head: '#fed7aa', accent: '#fb923c' },
  { id: 6, key: 'pink',    name: 'PINK',    bodyA: '#ff4ecd', bodyB: '#be185d', head: '#fbcfe8', accent: '#f472b6' },
  { id: 7, key: 'silver',  name: 'SILVER',  bodyA: '#e2e8f0', bodyB: '#64748b', head: '#ffffff', accent: '#cbd5e1' },
];

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const OPP = [2, 3, 0, 1];

export class MegaBattleGame {
  constructor(seed = 1, opts = {}) {
    this.seed = seed >>> 0;
    this.rand = mulberry32(this.seed);
    this.w = opts.width || 22;
    this.h = opts.height || 22;
    this.n = this.w * this.h;
    this.targetApples = opts.targetApples || 8;
    this.shrinkStartTick = opts.shrinkStartTick ?? 45;
    this.shrinkEvery = opts.shrinkEvery ?? 16;
    this.maxShrinkRing = opts.maxShrinkRing ?? 7;
    this.maxTicks = opts.maxTicks ?? 260;
    this.tick = 0;
    this.shrinkRing = 0;

    const W = this.w, H = this.h;
    const c = (x, y) => y * W + x;
    const rot90 = ([x, y], d) => [W - 1 - y, x, (d + 1) & 3];
    const basePairs = [
      { pts: [[3, 3], [2, 3], [1, 3]], dir: RIGHT },
      { pts: [[10, 3], [10, 2], [10, 1]], dir: DOWN },
    ];
    const spawns = [];
    for (let q = 0; q < 4; q++) {
      for (const b of basePairs) {
        let pts = b.pts.map((p) => p.slice());
        let dir = b.dir;
        for (let r = 0; r < q; r++) {
          let nextDir = dir;
          pts = pts.map((p) => {
            const [nx, ny, nd] = rot90(p, dir);
            nextDir = nd;
            return [nx, ny];
          });
          dir = nextDir;
        }
        spawns.push({ cells: pts.map(([px, py]) => c(px, py)), dir });
      }
    }
    const rot = this.seed & 7;

    this.obstacles = new Set();
    for (const [ox, oy] of [[7, 7], [W - 8, 7], [W - 8, H - 8], [7, H - 8]]) {
      this.obstacles.add(c(ox, oy));
    }

    this.snakes = MEGA_COLORS.map((col, idx) => {
      const sp = spawns[(idx + rot) & 7];
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

    this.apples = [];
    this.applesSpawned = 0;
    this.eliminations = [];
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

  step(dirs) {
    if (this.winner !== null) return { tick: this.tick, eliminations: [], ate: [], winner: this.winner };
    this.tick++;

    const aliveBefore = this.aliveSnakes();
    const nextHead = new Map();

    for (const s of aliveBefore) {
      let d = dirs[s.id] !== undefined ? Number(dirs[s.id]) : s.dir;
      if (s.cells.length > 1 && d === OPP[s.dir]) d = s.dir;
      s.dir = d;
      nextHead.set(s.id, this.stepCell(s.cells[0], d));
    }

    const appleAt = new Map();
    for (let i = 0; i < this.apples.length; i++) appleAt.set(this.apples[i].cell, this.apples[i]);

    const willGrow = new Set();
    for (const s of aliveBefore) {
      const nh = nextHead.get(s.id);
      if (s.growPending > 0 || appleAt.has(nh)) willGrow.add(s.id);
    }

    const bodyOwner = new Map();
    for (const s of aliveBefore) {
      const limit = willGrow.has(s.id) ? s.cells.length : s.cells.length - 1;
      for (let k = 0; k < limit; k++) bodyOwner.set(s.cells[k], s.id);
    }

    const doomed = new Map();
    const snakeScore = (s) => s.cells.length * 1000 + s.applesEaten * 10 + ((s.id + this.seed + this.tick) & 7);

    for (const s of aliveBefore) {
      const nh = nextHead.get(s.id);
      if (nh < 0) {
        doomed.set(s.id, { cause: 'WALL', killerId: null, cell: s.cells[0] });
        continue;
      }
      if (this.obstacles.has(nh)) {
        const x = nh % this.w, y = (nh / this.w) | 0;
        const ring = Math.min(x, y, this.w - 1 - x, this.h - 1 - y);
        doomed.set(s.id, { cause: ring < this.shrinkRing ? 'SHRINK' : 'WALL', killerId: null, cell: nh });
        continue;
      }
      if (bodyOwner.has(nh)) {
        const owner = bodyOwner.get(nh);
        doomed.set(s.id, {
          cause: owner === s.id ? 'SELF' : 'RIVAL',
          killerId: owner === s.id ? null : owner,
          cell: nh,
        });
        continue;
      }
      for (const r of aliveBefore) {
        if (r.id === s.id) continue;
        if (nh === r.cells[0] && nextHead.get(r.id) === s.cells[0] && snakeScore(s) < snakeScore(r)) {
          doomed.set(s.id, { cause: 'CLASH', killerId: r.id, cell: nh });
        }
      }
    }

    const cellContenders = new Map();
    for (const s of aliveBefore) {
      if (doomed.has(s.id)) continue;
      const nh = nextHead.get(s.id);
      if (!cellContenders.has(nh)) cellContenders.set(nh, []);
      cellContenders.get(nh).push(s);
    }
    for (const [nh, list] of cellContenders.entries()) {
      if (list.length <= 1) continue;
      list.sort((a, b) => snakeScore(b) - snakeScore(a));
      const survivor = list[0];
      for (let k = 1; k < list.length; k++) {
        doomed.set(list[k].id, { cause: 'CLASH', killerId: survivor.id, cell: nh });
      }
    }

    if (doomed.size >= aliveBefore.length && aliveBefore.length > 0) {
      const ranked = aliveBefore.slice().sort((a, b) => snakeScore(b) - snakeScore(a));
      const saved = ranked[0];
      doomed.delete(saved.id);
      if (nextHead.get(saved.id) < 0) nextHead.set(saved.id, saved.cells[0]);
    }

    const tickElims = [];
    const tickAte = [];
    let leftAfter = aliveBefore.length - doomed.size;

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
        remainingCount: leftAfter,
        cell: info.cell,
        droppedCells: s.cells.slice(),
      };
      this.eliminations.push(ev);
      tickElims.push(ev);
    }

    for (const s of aliveBefore) {
      if (!s.alive) continue;
      const nh = nextHead.get(s.id);
      if (nh !== s.cells[0]) {
        s.cells.unshift(nh);
        const eaten = appleAt.get(nh);
        if (eaten) {
          s.applesEaten++;
          this.apples = this.apples.filter((a) => a.cell !== nh);
          if (eaten.golden) s.growPending += 2;
          tickAte.push({ id: s.id, cell: nh, golden: !!eaten.golden, len: s.cells.length });
        } else if (s.growPending > 0) {
          s.growPending--;
        } else {
          s.cells.pop();
        }
      }
    }

    if (tickElims.length > 0) {
      const occ = this.occupiedSet();
      for (const el of tickElims) {
        for (let k = 1; k < el.droppedCells.length; k += 3) {
          const c = el.droppedCells[k];
          if (!occ.has(c) && this.apples.length < this.targetApples + 6) {
            this.apples.push({ cell: c, golden: k === 1 });
            occ.add(c);
          }
        }
      }
    }

    this.applyArenaShrink();
    this.refillApples();

    const remaining = this.aliveSnakes();
    if (remaining.length === 1) {
      this.winner = remaining[0].id;
      this.winAtTick = this.tick;
    } else if (this.tick >= this.maxTicks && remaining.length > 1) {
      remaining.sort((a, b) => snakeScore(b) - snakeScore(a));
      const champ = remaining[0];
      for (let k = 1; k < remaining.length; k++) {
        const loser = remaining[k];
        loser.alive = false;
        loser.eliminatedAtTick = this.tick;
        loser.eliminatedBy = champ.id;
        loser.deathCause = 'SHRINK';
        const ev = {
          tick: this.tick,
          id: loser.id,
          color: loser.color,
          name: loser.name,
          cause: 'SHRINK',
          killerId: champ.id,
          killerName: champ.name,
          remainingCount: 1,
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
