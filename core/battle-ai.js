// Tactical lookahead controller for the 4-Snake Color Battle Arena.
//
// Combines flood-fill survival space estimation, apple value pursuit,
// head-to-head dominance/evasion, and late-game center control.
// Symmetrically parameterized across all 4 snakes so RED, VIOLET, GOLD, and CYAN
// have balanced ~25% win rates over any large seed sample.

import { mulberry32 } from './rng.js';

const OPP = [2, 3, 0, 1];

export class BattleAI {
  constructor(game, seed = game.seed) {
    this.g = game;
    this.rand = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  }

  /**
   * Returns an array of 4 directions [d0, d1, d2, d3] for the current tick.
   */
  nextDirs() {
    const g = this.g;
    const W = g.w, H = g.h;

    // Build set of solid cells for this tick (obstacles + non-retracting snake bodies)
    const appleSet = new Set(g.apples.map((a) => a.cell));
    const blocked = new Uint8Array(g.n);
    for (const obs of g.obstacles) blocked[obs] = 1;
    for (const s of g.snakes) {
      if (!s.alive) continue;
      const limit = s.growPending > 0 ? s.cells.length : Math.max(1, s.cells.length - 1);
      for (let k = 0; k < limit; k++) blocked[s.cells[k]] = 1;
    }

    // Also mark cells that will be swallowed by the next shrink ring if imminent
    const nextShrinkTick = g.shrinkStartTick + g.shrinkRing * g.shrinkEvery;
    const shrinkImminent = g.shrinkRing < g.maxShrinkRing && g.tick >= nextShrinkTick - 4;
    const dangerRing = g.shrinkRing;

    const floodSpace = (startCell, maxVisit = 48) => {
      const seen = new Uint8Array(g.n);
      const q = [startCell];
      seen[startCell] = 1;
      let head = 0, count = 0;
      while (head < q.length && count < maxVisit) {
        const cur = q[head++];
        count++;
        for (let d = 0; d < 4; d++) {
          const nxt = g.stepCell(cur, d);
          if (nxt >= 0 && !blocked[nxt] && !seen[nxt]) {
            seen[nxt] = 1;
            q.push(nxt);
          }
        }
      }
      return count;
    };

    const out = [0, 0, 0, 0];
    for (const s of g.snakes) {
      if (!s.alive) {
        out[s.id] = s.dir;
        continue;
      }

      const head = s.cells[0];
      let bestDir = s.dir;
      let bestScore = -1e9;

      // Evaluate all 4 directions in a deterministic rotated order per tick+id
      for (let k = 0; k < 4; k++) {
        const d = (k + s.id + g.tick) & 3;
        if (s.cells.length > 1 && d === OPP[s.dir]) continue;

        const nc = g.stepCell(head, d);
        if (nc < 0 || blocked[nc]) continue;

        const nx = nc % W, ny = (nc / W) | 0;
        let score = 0;

        // 1. Flood-fill reachable open space (survival priority)
        const space = floodSpace(nc, 48);
        if (space < s.cells.length) {
          score -= (s.cells.length - space) * 28;
        } else {
          score += space * 1.45;
        }

        // 2. Rival head proximity: evade longer/equal heads, pressure shorter heads
        for (const r of g.snakes) {
          if (!r.alive || r.id === s.id) continue;
          const rx = r.cells[0] % W, ry = (r.cells[0] / W) | 0;
          const dist = Math.abs(nx - rx) + Math.abs(ny - ry);
          if (dist === 1) {
            // Rival can step onto `nc` on this exact tick
            if (s.cells.length > r.cells.length) {
              score += 22; // Dominate head-to-head clash!
            } else if (s.cells.length === r.cells.length) {
              score -= 55;
            } else {
              score -= 95;
            }
          } else if (dist === 2) {
            if (s.cells.length > r.cells.length + 1) {
              score += 8; // Hunt shorter rivals
            } else if (s.cells.length < r.cells.length) {
              score -= 14;
            }
          }
        }

        // 3. Apple pursuit (golden apples are high-value targets)
        let bestAppleScore = -40;
        for (const a of g.apples) {
          const ax = a.cell % W, ay = (a.cell / W) | 0;
          const md = Math.abs(nx - ax) + Math.abs(ny - ay);
          const val = (a.golden ? 38 : 22) - md * 2.4;
          if (val > bestAppleScore) bestAppleScore = val;
        }
        if (appleSet.has(nc)) bestAppleScore += 18;
        score += bestAppleScore;

        // 4. Center control & perimeter shrink avoidance
        const cx = (W - 1) / 2, cy = (H - 1) / 2;
        const centerDist = Math.abs(nx - cx) + Math.abs(ny - cy);
        score -= centerDist * (g.tick > 45 ? 1.15 : 0.45);

        if (shrinkImminent) {
          if (nx <= dangerRing || nx >= W - 1 - dangerRing || ny <= dangerRing || ny >= H - 1 - dangerRing) {
            score -= 120;
          }
        }

        // 5. Slight momentum preference + tiny deterministic jitter
        if (d === s.dir) score += 1.2;
        score += (this.rand() - 0.5) * 2.5;

        if (score > bestScore) {
          bestScore = score;
          bestDir = d;
        }
      }

      out[s.id] = bestDir;
    }

    return out;
  }
}
