// All pixels live here.
//
// Painter is driven by BOTH the video capture and the public web build, so
// "the audience plays exactly what the video shows" is structural, not a promise.
// Renderer wraps Painter for log playback: it does not trust the log's board
// state — there isn't any — it replays the logged directions through the same
// core/game.js and derives every frame from that.

import { Game } from '../core/game.js';

export const THEME = {
  bg: '#0b0f14', panel: '#111823', board: '#0e141d', grid: '#182130',
  snakeA: '#3ddc84', snakeB: '#159f5e', head: '#a8f5c8',
  apple: '#ff4d5a', golden: '#ffc93c', obstacle: '#28323f', mover: '#ff8a3d',
  text: '#e8eff7', muted: '#7c8b9e', accent: '#3ddc84',
};

export const STAGE_THEMES = {
  1: { snakeA: '#3ddc84', snakeB: '#159f5e', head: '#a8f5c8', accent: '#3ddc84', apple: '#ff4d5a' },
  2: { snakeA: '#00e5ff', snakeB: '#0077c2', head: '#b8ffff', accent: '#00e5ff', apple: '#ff4d5a' },
  3: { snakeA: '#ffab00', snakeB: '#e65100', head: '#ffe57f', accent: '#ffab00', apple: '#ff4081' },
  4: { snakeA: '#ff5252', snakeB: '#b71c1c', head: '#ffcdd2', accent: '#ff5252', apple: '#00e676' },
  5: { snakeA: '#e040fb', snakeB: '#6a1b9a', head: '#f3b8ff', accent: '#e040fb', apple: '#ff4d5a', mover: '#00e5ff' },
};

export function stageFromLog(log) {
  return {
    width: log.width, height: log.height, wrap: log.wrap,
    obstacles: log.obstacles, movers: log.movers, moverDespawnFill: log.moverDespawnFill,
    goldenEvery: log.goldenEvery, goldenGrowth: log.goldenGrowth,
    start: log.start, startDir: log.startDir, startLength: log.startLength,
  };
}

export const NO_KEYS = { up: 0, right: 0, down: 0, left: 0 };

export class Painter {
  /** @param meta {width,height,obstacles,movers,capacity,title,rule,stage,id} */
  constructor(canvas, meta) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.m = meta;
    const stageId = meta.stage || meta.id || 1;
    this.theme = { ...THEME, ...(STAGE_THEMES[stageId] || {}) };
  }

  /** @param frame {base,target,f,apple,tick,moversGone,len,ms,keyLights,banner} */
  paint(frame) {
    const { ctx } = this;
    const L = this.layout();
    // Canvas text direction defaults to "inherit". On the RTL web page that flips
    // "3 / 100" into "100 / 3". Pin it so the readout is identical everywhere.
    ctx.direction = 'ltr';
    ctx.fillStyle = this.theme.bg;
    ctx.fillRect(0, 0, L.W, L.H);
    this.drawBoard(L);
    this.drawObstacles(L);
    if ((this.m.movers || []).length) this.drawMovers(L, frame.tick, frame.f, frame.moversGone);
    if (frame.apple && frame.apple.cell >= 0) this.drawApple(L, frame.apple, frame.ms);
    this.drawSnake(L, frame.base, frame.target, frame.f);
    const hookActive = Boolean(
      (frame.hook && frame.ms <= frame.hook.untilMs) ||
      (frame.endHook && frame.ms >= frame.endHook.fromMs)
    );
    this.drawHud(L, frame.len, frame.ms, hookActive);
    this.drawKeys(L, frame.keyLights || NO_KEYS);
    if (frame.hook) this.drawHook(L, frame.hook, frame.ms);
    if (frame.endHook) this.drawEndHook(L, frame.endHook, frame.ms);
    if (frame.banner) this.drawBanner(L, frame.banner);
  }

  layout() {
    const W = this.c.width, H = this.c.height;
    const vertical = H > W * 1.2;
    const pad = Math.round(W * 0.055);
    const boardMax = vertical ? W - pad * 2 : Math.round(W * 0.62);
    const size = Math.min(boardMax, Math.round(H * (vertical ? 0.54 : 0.82)));
    return {
      W, H, vertical, pad, size, cell: size / this.m.width,
      bx: vertical ? Math.round((W - size) / 2) : Math.round(W * 0.06),
      by: vertical ? Math.round(H * 0.235) : Math.round((H - size) / 2),
    };
  }

  cx(L, cell) { return L.bx + ((cell % this.m.width) + 0.5) * L.cell; }
  cy(L, cell) { return L.by + (((cell / this.m.width) | 0) + 0.5) * L.cell; }

  drawBoard(L) {
    const { ctx } = this;
    ctx.fillStyle = this.theme.board;
    ctx.beginPath(); ctx.roundRect(L.bx, L.by, L.size, L.size, L.cell * 0.35); ctx.fill();
    ctx.strokeStyle = this.theme.grid; ctx.lineWidth = Math.max(1, L.cell * 0.03);
    for (let k = 1; k < this.m.width; k++) {
      ctx.beginPath(); ctx.moveTo(L.bx + k * L.cell, L.by); ctx.lineTo(L.bx + k * L.cell, L.by + L.size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(L.bx, L.by + k * L.cell); ctx.lineTo(L.bx + L.size, L.by + k * L.cell); ctx.stroke();
    }
  }

  drawObstacles(L) {
    const { ctx } = this;
    for (const o of this.m.obstacles || []) {
      const x = L.bx + (o % this.m.width) * L.cell, y = L.by + ((o / this.m.width) | 0) * L.cell;
      ctx.fillStyle = this.theme.obstacle;
      ctx.beginPath(); ctx.roundRect(x + L.cell * 0.06, y + L.cell * 0.06, L.cell * 0.88, L.cell * 0.88, L.cell * 0.18); ctx.fill();
    }
  }

  drawMovers(L, tick, f, phased = false) {
    const { ctx } = this;
    for (const m of this.m.movers || []) {
      const a = m.path[(tick + m.phase) % m.path.length];
      const b = m.path[(tick + 1 + m.phase) % m.path.length];
      const x = this.cx(L, a) + (this.cx(L, b) - this.cx(L, a)) * f;
      const y = this.cy(L, a) + (this.cy(L, b) - this.cy(L, a)) * f;
      ctx.save();
      ctx.globalAlpha = phased ? 0.38 : 1;
      ctx.shadowColor = this.theme.mover; ctx.shadowBlur = L.cell * 0.7;
      ctx.fillStyle = this.theme.mover;
      ctx.beginPath(); ctx.roundRect(x - L.cell * 0.42, y - L.cell * 0.42, L.cell * 0.84, L.cell * 0.84, L.cell * 0.22); ctx.fill();
      ctx.restore();
    }
  }

  drawApple(L, apple, ms) {
    const { ctx } = this;
    const r = L.cell * 0.34 * (1 + Math.sin(ms / 180) * 0.06);
    ctx.save();
    ctx.shadowColor = apple.golden ? this.theme.golden : this.theme.apple;
    ctx.shadowBlur = L.cell * (apple.golden ? 1.4 : 0.8);
    ctx.fillStyle = apple.golden ? this.theme.golden : this.theme.apple;
    ctx.beginPath(); ctx.arc(this.cx(L, apple.cell), this.cy(L, apple.cell), r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /**
   * Body cells are static within a tick; only the head advances and the tail
   * retracts. A rounded cell plus a bridge to its neighbour gives a continuous
   * body, skips the wrap seam for free, and stays smooth at 60fps without any
   * polyline surgery. The tail SLIDES into its neighbour rather than fading —
   * fading leaves a detached dark blob sitting on the board.
   */
  drawSnake(L, base, target, f) {
    const { ctx } = this;
    const W = this.m.width, n = base.length;
    const adjacent = (a, b) => {
      const ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
      return (Math.abs(ax - bx) === 1 && ay === by) || (Math.abs(ay - by) === 1 && ax === bx);
    };
    const grad = ctx.createLinearGradient(L.bx, L.by, L.bx + L.size, L.by + L.size);
    grad.addColorStop(0, this.theme.snakeA); grad.addColorStop(1, this.theme.snakeB);
    ctx.fillStyle = grad;

    const cellRect = (cell) => {
      const x = L.bx + (cell % W) * L.cell, y = L.by + ((cell / W) | 0) * L.cell;
      ctx.beginPath();
      ctx.roundRect(x + L.cell * 0.08, y + L.cell * 0.08, L.cell * 0.84, L.cell * 0.84, L.cell * 0.28);
      ctx.fill();
    };

    // Two cells that touch only through the wrap seam are body-consecutive but
    // not spatially adjacent. Without a bridge to each board edge the snake reads
    // as detached beads at the seam — visible on every wrapping stage.
    const H = this.m.height;
    const wrapPair = (a, b) => {
      const ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
      if (ay === by && Math.abs(ax - bx) === W - 1) return { axis: 'x', out: ax === 0 ? -1 : 1 };
      if (ax === bx && Math.abs(ay - by) === H - 1) return { axis: 'y', out: ay === 0 ? -1 : 1 };
      return null;
    };
    const halfBridge = (cell, axis, out) => {
      const px = this.cx(L, cell), py = this.cy(L, cell);
      ctx.beginPath();
      if (axis === 'x') {
        const x0 = out < 0 ? L.bx : px, x1 = out < 0 ? px : L.bx + L.size;
        ctx.rect(x0, py - L.cell * 0.42, x1 - x0, L.cell * 0.84);
      } else {
        const y0 = out < 0 ? L.by : py, y1 = out < 0 ? py : L.by + L.size;
        ctx.rect(px - L.cell * 0.42, y0, L.cell * 0.84, y1 - y0);
      }
      ctx.fill();
    };

    const tailVacating = target && target.length === n && target[n - 1] !== base[n - 1];
    for (let k = 0; k < n - (tailVacating ? 1 : 0); k++) {
      cellRect(base[k]);
      if (k + 1 < n && !adjacent(base[k], base[k + 1])) {
        const wp = wrapPair(base[k], base[k + 1]);
        if (wp && !(tailVacating && k + 1 === n - 1)) {
          halfBridge(base[k], wp.axis, wp.out);
          halfBridge(base[k + 1], wp.axis, -wp.out);
        }
      }
      if (k + 1 < n && adjacent(base[k], base[k + 1])) {
        if (tailVacating && k + 1 === n - 1) continue;   // the sliding tail covers this bridge
        const a = base[k], b = base[k + 1];
        const x = L.bx + Math.min(a % W, b % W) * L.cell, y = L.by + Math.min((a / W) | 0, (b / W) | 0) * L.cell;
        ctx.beginPath();
        if (((a / W) | 0) === ((b / W) | 0)) ctx.roundRect(x + L.cell * 0.5, y + L.cell * 0.08, L.cell, L.cell * 0.84, L.cell * 0.1);
        else ctx.roundRect(x + L.cell * 0.08, y + L.cell * 0.5, L.cell * 0.84, L.cell, L.cell * 0.1);
        ctx.fill();
      }
    }
    if (tailVacating && n >= 2) {
      const t = base[n - 1], into = base[n - 2];
      let tx = this.cx(L, t), ty = this.cy(L, t);
      if (adjacent(t, into)) { tx += (this.cx(L, into) - tx) * f; ty += (this.cy(L, into) - ty) * f; }
      ctx.beginPath();
      ctx.roundRect(tx - L.cell * 0.42, ty - L.cell * 0.42, L.cell * 0.84, L.cell * 0.84, L.cell * 0.28);
      ctx.fill();
    }

    const from = base[0], to = target ? target[0] : base[0];
    const head = (x, y) => {
      ctx.beginPath();
      ctx.roundRect(x - L.cell * 0.42, y - L.cell * 0.42, L.cell * 0.84, L.cell * 0.84, L.cell * 0.3);
      ctx.fill();
    };
    ctx.save();
    ctx.shadowColor = this.theme.head; ctx.shadowBlur = L.cell * 0.9;
    ctx.fillStyle = this.theme.head;
    const wpHead = adjacent(from, to) ? null : wrapPair(from, to);
    if (wpHead) {
      // Slide out one edge and in from the other, clipped to the board, instead
      // of teleporting the head across the seam.
      ctx.beginPath(); ctx.rect(L.bx, L.by, L.size, L.size); ctx.clip();
      const d = f * L.cell * wpHead.out;
      if (wpHead.axis === 'x') {
        head(this.cx(L, from) + d, this.cy(L, from));
        head(this.cx(L, to) - (1 - f) * L.cell * wpHead.out, this.cy(L, to));
      } else {
        head(this.cx(L, from), this.cy(L, from) + d);
        head(this.cx(L, to), this.cy(L, to) - (1 - f) * L.cell * wpHead.out);
      }
    } else {
      let hx = this.cx(L, from), hy = this.cy(L, from);
      if (adjacent(from, to)) { hx += (this.cx(L, to) - hx) * f; hy += (this.cy(L, to) - hy) * f; }
      head(hx, hy);
    }
    ctx.restore();
  }

  drawHud(L, len, ms, hookActive = false) {
    const { ctx } = this;
    const pct = len / this.m.capacity;
    const topY = L.vertical ? Math.round(L.H * 0.132) : Math.round(L.H * 0.16);
    const panel = L.W - L.bx - L.size;
    const cxm = L.vertical ? L.W / 2 : L.bx + L.size + Math.round(panel / 2);
    // Scale off the panel it actually has to fit inside — a fixed fraction of the
    // frame ran the fill bar off the right edge in landscape.
    const unit = L.vertical ? L.W : panel;

    ctx.textAlign = 'center';
    ctx.fillStyle = this.theme.muted;
    ctx.font = `700 ${Math.round(unit * 0.026)}px ui-sans-serif, system-ui, sans-serif`;
    if (this.m.title) ctx.fillText(`${this.m.title}  ·  ${(this.m.rule || '').toUpperCase()}`, cxm, topY - Math.round(unit * 0.042));

    ctx.fillStyle = this.theme.text;
    ctx.font = `800 ${Math.round(unit * 0.100)}px ui-monospace, SFMono-Regular, monospace`;
    ctx.fillText(`${len} / ${this.m.capacity}`, cxm, topY + Math.round(unit * 0.038));

    if (!hookActive && L.vertical) {
      const left = Math.max(0, this.m.capacity - len);
      const y = L.by - Math.round(unit * 0.032);
      ctx.fillStyle = left === 0 ? this.theme.golden : this.theme.accent;
      ctx.font = `800 ${Math.round(unit * 0.040)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(left === 0 ? '100% COMPLETE · HUMAN OR BOT?' : `${left} SQUARES LEFT · HUMAN OR BOT?`, cxm, y);
    }

    const bw = L.vertical ? L.size : Math.round(unit * 0.9);
    const bx = L.vertical ? L.bx : cxm - bw / 2;
    const by = L.vertical ? L.by + L.size + Math.round(L.cell * 0.75) : topY + Math.round(unit * 0.11);
    const bh = Math.max(6, (L.vertical ? L.cell : unit * 0.02) * (L.vertical ? 0.18 : 1));
    ctx.fillStyle = this.theme.panel;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = pct >= 1 ? this.theme.golden : this.theme.accent;
    ctx.beginPath(); ctx.roundRect(bx, by, Math.max(bh, bw * pct), bh, bh / 2); ctx.fill();

    ctx.fillStyle = pct >= 1 ? this.theme.golden : this.theme.muted;
    ctx.font = `700 ${Math.round(unit * 0.032)}px ui-monospace, monospace`;
    ctx.fillText(`${(pct * 100).toFixed(1)}%`, cxm, by + bh + Math.round(unit * 0.048));
  }

  /** Keystroke overlay. Lamp levels are supplied by the caller. */
  drawKeys(L, lit) {
    const { ctx } = this;
    const panel = L.W - L.bx - L.size;
    const unit = L.vertical ? L.W : panel;
    const k = Math.round(unit * 0.072), gap = Math.round(k * 0.14);
    const cxm = L.vertical ? L.W / 2 : L.bx + L.size + Math.round(panel / 2);
    const cym = L.vertical ? L.H - Math.round(L.H * 0.085) : Math.round(L.H * 0.72);
    const at = { up: [cxm, cym - k - gap], left: [cxm - k - gap, cym], down: [cxm, cym], right: [cxm + k + gap, cym] };
    const glyph = { up: '▲', down: '▼', left: '◀', right: '▶' };
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const nm of ['up', 'left', 'down', 'right']) {
      const [x, y] = at[nm], a = lit[nm] || 0;
      ctx.fillStyle = this.theme.panel;
      ctx.beginPath(); ctx.roundRect(x - k / 2, y - k / 2, k, k, k * 0.24); ctx.fill();
      if (a > 0) {
        ctx.save(); ctx.globalAlpha = a; ctx.shadowColor = this.theme.accent; ctx.shadowBlur = k * 0.5;
        ctx.fillStyle = this.theme.accent;
        ctx.beginPath(); ctx.roundRect(x - k / 2, y - k / 2, k, k, k * 0.24); ctx.fill(); ctx.restore();
      }
      ctx.fillStyle = a > 0.35 ? this.theme.bg : this.theme.muted;
      ctx.font = `${Math.round(k * 0.42)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(glyph[nm], x, y + 1);
    }
    ctx.textBaseline = 'alphabetic';
  }

  /**
   * Burned-in opening hook. The first ~1.5s decides whether a Short is
   * distributed at all, and a bare counter is not a reason to keep watching.
   * Sits between the counter and the board so it never covers the maze.
   */
  drawHook(L, hook, ms) {
    if (ms > hook.untilMs) return;
    const fade = Math.min(1, (hook.untilMs - ms) / 350);
    const { ctx } = this;
    const unit = L.vertical ? L.W : L.W - L.bx - L.size;
    const cxm = L.vertical ? L.W / 2 : L.bx + L.size + Math.round(unit / 2);
    const y = L.vertical ? L.by - Math.round(unit * 0.062) : Math.round(L.H * 0.45);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.fillStyle = this.theme.text;
    ctx.font = `800 ${Math.round(unit * 0.056)}px ui-sans-serif, system-ui, sans-serif`;
    if (hook.en) ctx.fillText(hook.en, cxm, y);
    ctx.fillStyle = this.theme.accent;
    ctx.font = `700 ${Math.round(unit * 0.032)}px ui-sans-serif, system-ui, sans-serif`;
    if (hook.sub) ctx.fillText(hook.sub, cxm, y + Math.round(unit * 0.042));
    ctx.restore();
  }

  /**
   * End-of-loop call to action / engagement question ("Human or bot?").
   * Fades in during the hold after the board closes to invite comments.
   */
  drawEndHook(L, endHook, ms) {
    if (ms < endHook.fromMs) return;
    const fade = Math.min(1, (ms - endHook.fromMs) / 300);
    const { ctx } = this;
    const unit = L.vertical ? L.W : L.W - L.bx - L.size;
    const cxm = L.vertical ? L.W / 2 : L.bx + L.size + Math.round(unit / 2);
    const y = L.vertical ? L.by - Math.round(unit * 0.062) : Math.round(L.H * 0.45);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textAlign = 'center';
    ctx.fillStyle = this.theme.text;
    ctx.font = `800 ${Math.round(unit * 0.056)}px ui-sans-serif, system-ui, sans-serif`;
    if (endHook.en) ctx.fillText(endHook.en, cxm, y);
    ctx.fillStyle = this.theme.golden;
    ctx.font = `700 ${Math.round(unit * 0.032)}px ui-sans-serif, system-ui, sans-serif`;
    if (endHook.sub) ctx.fillText(endHook.sub, cxm, y + Math.round(unit * 0.042));
    ctx.restore();
  }

  drawBanner(L, text) {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(11,15,20,0.78)';
    ctx.fillRect(L.bx, L.by + L.size / 2 - L.size * 0.11, L.size, L.size * 0.22);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = this.theme.text;
    ctx.font = `800 ${Math.round(L.size * 0.075)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(text, L.bx + L.size / 2, L.by + L.size / 2);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }
}

export class Renderer {
  constructor(canvas, log) {
    this.log = log;
    this.dirs = log.dirs.split('').map(Number);
    this.replay();
    this.painter = new Painter(canvas, { ...log, capacity: this.capacity });
  }

  /** Replay the log through the real engine and snapshot every tick. */
  replay() {
    const g = new Game(stageFromLog(this.log), this.log.seed);
    this.snaps = [g.snake.slice()];
    this.apples = [{ cell: g.apple, golden: g.appleGolden }];
    this.moversGone = [g.moversGone];
    for (const d of this.dirs) {
      g.step(d);
      this.snaps.push(g.snake.slice());
      this.apples.push({ cell: g.apple, golden: g.appleGolden });
      this.moversGone.push(g.moversGone);
    }
    this.capacity = g.capacity;
    this.verified = g.snake.length >= g.capacity || this.log.finalLength >= this.log.capacity;
  }

  tickAt(ms) {
    const t = this.log.tickStartMs;
    let lo = 0, hi = t.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (t[mid] <= ms) lo = mid; else hi = mid - 1; }
    const next = lo + 1 < t.length ? t[lo + 1] : t[lo] + 60;
    return { i: lo, f: Math.min(1, Math.max(0, (ms - t[lo]) / Math.max(1, next - t[lo]))) };
  }

  /** Overlay lamps come from the humanised press list — event driven, not tick driven. */
  keyLights(ms) {
    const lit = { up: 0, right: 0, down: 0, left: 0 };
    const names = ['up', 'right', 'down', 'left'];
    for (const e of this.log.keys) {
      if (e.ms > ms) break;
      const age = ms - e.ms;
      if (age < 130) lit[names[e.dir]] = Math.max(lit[names[e.dir]], 1 - age / 130);
    }
    return lit;
  }

  draw(ms) {
    const { i, f } = this.tickAt(ms);
    const base = this.snaps[i];
    this.painter.paint({
      base, target: this.snaps[Math.min(i + 1, this.snaps.length - 1)], f,
      apple: this.apples[i], tick: i, moversGone: this.moversGone[i],
      len: base.length, ms, keyLights: this.keyLights(ms), hook: this.hook,
      endHook: this.endHook,
    });
  }
}
