// The rulesets. Stages 1-5 are the classic series stages (100% backward-compatible
// with HEAD b853176). Stages 6-9 are the V3 shaped arenas with pocket-patrol movers.
// Nothing here ships until tools/verify.js confirms a full board by actual effect.

import { baseCycle, findCycle, randomCycle, assertCycle } from './cycle.js';
import { mulberry32 } from './rng.js';
import { RIGHT, LEFT, UP, DOWN } from './game.js';

const common = {
  start: 0,          // (0,0) — the first cell of the base cycle
  startDir: RIGHT,
  startLength: 3,
};

export function blocksToObstacles(w, blockedBlocks = []) {
  const bw = w / 2;
  const out = [];
  for (const b of blockedBlocks) {
    const x = (b % bw) * 2, y = ((b / bw) | 0) * 2;
    out.push(y * w + x, y * w + x + 1, (y + 1) * w + x, (y + 1) * w + x + 1);
  }
  return out;
}

export const ARENAS = {
  classic: {
    key: 'classic', name: 'CLASSIC GRID',
    blocks: { 10: [], 12: [], 14: [] },
  },
  donut: {
    key: 'donut', name: 'DONUT RING',
    blocks: { 10: [12], 12: [14, 15, 20, 21], 14: [17, 23, 24, 25, 31] },
  },
  cross: {
    key: 'cross', name: 'CROSS FORTRESS',
    blocks: { 10: [0, 4, 20, 24], 12: [0, 5, 30, 35], 14: [0, 6, 42, 48] },
  },
  hourglass: {
    key: 'hourglass', name: 'HOURGLASS MAZE',
    blocks: { 10: [10, 14], 12: [12, 17, 18, 23], 14: [14, 20, 21, 22, 26, 27, 28, 34] },
  },
  skull: {
    key: 'skull', name: 'SKULL ARENA',
    blocks: { 10: [6, 8, 20, 24], 12: [7, 10, 24, 29, 30, 35], 14: [15, 19, 31, 35, 41, 42, 48] },
  },
  chambers: {
    key: 'chambers', name: 'TWIN CHAMBERS',
    blocks: { 10: [2, 22], 12: [2, 3, 32, 33], 14: [3, 10, 38, 45] },
  },
  pillars: {
    key: 'pillars', name: 'FOUR PILLARS',
    blocks: { 10: [6, 8, 16, 18], 12: [7, 10, 25, 28], 14: [8, 12, 36, 40] },
  },
};

/**
 * Finds two disjoint bypassable 6-cell cycle pockets (step=7 chords) so that
 * each patrolling mover glides along a 4-cell corridor while the solver can
 * deterministically step around the pocket entry whenever the hazard is inside.
 * Returns [] if the cycle is too small or lacks two pockets.
 */
export function findMoverPockets(cycle, w, h, wrap, obstacles) {
  if (!cycle || cycle.length < 24) return [];
  const N = cycle.length;
  const order = new Int32Array(w * h).fill(-1);
  for (let i = 0; i < N; i++) order[cycle[i]] = i;
  const obs = new Set(obstacles || []);
  const DELTA = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const nbs = (c) => {
    const x = c % w, y = (c / w) | 0, out = [];
    for (const [dx, dy] of DELTA) {
      let nx = x + dx, ny = y + dy;
      if (wrap) { nx = (nx + w) % w; ny = (ny + h) % h; }
      else if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const nc = ny * w + nx;
      if (!obs.has(nc)) out.push(nc);
    }
    return out;
  };
  const cands = [];
  for (let i = 8; i < N - 16; i++) {
    const u = cycle[i];
    for (const v of nbs(u)) {
      const step = (order[v] - i + N) % N;
      if (step === 7 || step === 5) {
        const pocket = [];
        for (let k = 1; k < step; k++) pocket.push(cycle[(i + k) % N]);
        const track = step === 7
          ? [pocket[0], pocket[1], pocket[2], pocket[3], pocket[2], pocket[1]]
          : [pocket[0], pocket[1], pocket[2], pocket[1]];
        cands.push({ entryOrd: i, exitOrd: i + step, step, pocket, track });
      }
    }
  }
  const step7 = cands.filter((c) => c.step === 7);
  const pool = step7.length >= 2 ? step7 : cands;
  if (pool.length < 2) return [];
  const p1 = pool.find((c) => c.entryOrd >= 24) || pool[0];
  if (!p1) return [];
  const p2 = pool.find((c) => c.entryOrd >= p1.exitOrd + Math.floor(N / 3))
    || pool.find((c) => c.entryOrd >= p1.exitOrd + 12)
    || pool.find((c) => c.entryOrd >= p1.exitOrd + 1);
  if (!p2) return [];
  return [p1, p2];
}

export const STAGES = {
  // --- Classic Stages 1-5 (100% identical to HEAD b853176) ---
  1: {
    ...common, id: 1, cycleSeed: 1, key: 'classic', title: 'STAGE 1 · CLASSIC',
    rule: 'No wall wrap — pure grid',
    width: 10, height: 10, wrap: false,
    speed: { baseMs: 115, minMs: 42, rampPerApple: 0.8 },
    guarantee: 'proven',
    solver: { safetyMargin: 3, cutStopFill: 0.85, nearMissBias: 1, hesitateEvery: 12, hesitateTicks: 3 },
  },
  2: {
    ...common, id: 2, cycleSeed: 3, key: 'wrap', title: 'STAGE 2 · INFINITE WRAP',
    rule: 'Exit one side, enter the other',
    width: 12, height: 12, wrap: true,
    speed: { baseMs: 105, minMs: 38, rampPerApple: 0.55 },
    guarantee: 'proven',
    solver: { safetyMargin: 3, cutStopFill: 0.85, nearMissBias: 1, hesitateEvery: 12, hesitateTicks: 3 },
  },
  3: {
    ...common, id: 3, cycleSeed: 5, key: 'golden', title: 'STAGE 3 · GOLDEN APPLE',
    rule: 'Every 5th apple adds +3 length',
    width: 12, height: 12, wrap: true,
    goldenEvery: 5, goldenGrowth: 3,
    speed: { baseMs: 100, minMs: 38, rampPerApple: 0.65 },
    guarantee: 'proven-conditional',
    solver: { safetyMargin: 6, cutStopFill: 0.78, nearMissBias: 1, hesitateEvery: 10, hesitateTicks: 3 },
  },
  4: {
    ...common, id: 4, cycleSeed: 7, key: 'obstacles', title: 'STAGE 4 · DEAD ZONES',
    rule: '4 fixed blocks inside the board',
    width: 14, height: 14, wrap: true,
    goldenEvery: 6, goldenGrowth: 3,
    // Four 2x2 blocks aligned to the 2x2 super-grid, so they delete whole
    // super-cells and randomCycle() still returns a proven cycle over the rest.
    obstacles: [30,31,44,45, 38,39,52,53, 142,143,156,157, 150,151,164,165],
    speed: { baseMs: 95, minMs: 34, rampPerApple: 0.55 },
    blockedBlocks: [8, 12, 36, 40],
    guarantee: 'constructive',
    solver: { safetyMargin: 6, cutStopFill: 0.78, nearMissBias: 1, hesitateEvery: 10, hesitateTicks: 3 },
  },
  5: {
    ...common, id: 5, cycleSeed: 11, key: 'movers', title: 'STAGE 5 · MOVING HAZARDS',
    rule: '2 moving blocks + every rule before',
    width: 14, height: 14, wrap: true,
    goldenEvery: 6, goldenGrowth: 3,
    obstacles: [30,31,44,45, 38,39,52,53, 142,143,156,157, 150,151,164,165],
    movers: [
      { path: [21, 35, 49, 35], phase: 0 },
      { path: [21, 35, 49, 35], phase: 2 },
    ],
    moverDespawnFill: 0.5,
    minCompleteRate: 0.15,
    speed: { baseMs: 90, minMs: 34, rampPerApple: 0.55 },
    blockedBlocks: [8, 12, 36, 40],
    guarantee: 'empirical',
    solver: { safetyMargin: 4, cutStopFill: 0.4, nearMissBias: 1, hesitateEvery: 10, hesitateTicks: 2 },
  },

  // --- Explicit V3 Shaped Arena Stages (6-9) ---
  6: {
    ...common, id: 6, cycleSeed: 3, key: 'donut', arena: 'donut', arenaName: 'DONUT RING',
    title: 'STAGE 6 · DONUT RING',
    rule: 'Wrap walls around the central ring core',
    width: 12, height: 12, wrap: true,
    blockedBlocks: ARENAS.donut.blocks[12],
    obstacles: blocksToObstacles(12, ARENAS.donut.blocks[12]),
    speed: { baseMs: 105, minMs: 38, rampPerApple: 0.55 },
    guarantee: 'constructive',
    solver: { safetyMargin: 3, cutStopFill: 0.85, nearMissBias: 1, hesitateEvery: 12, hesitateTicks: 3 },
  },
  7: {
    ...common, id: 7, cycleSeed: 5, key: 'hourglass', arena: 'hourglass', arenaName: 'HOURGLASS MAZE',
    title: 'STAGE 7 · HOURGLASS MAZE',
    rule: 'Every 5th apple is golden (+3 length)',
    width: 12, height: 12, wrap: true,
    goldenEvery: 5, goldenGrowth: 3,
    blockedBlocks: ARENAS.hourglass.blocks[12],
    obstacles: blocksToObstacles(12, ARENAS.hourglass.blocks[12]),
    speed: { baseMs: 100, minMs: 38, rampPerApple: 0.65 },
    guarantee: 'constructive',
    solver: { safetyMargin: 6, cutStopFill: 0.78, nearMissBias: 1, hesitateEvery: 10, hesitateTicks: 3 },
  },
  8: {
    ...common, id: 8, cycleSeed: 7, key: 'skull', arena: 'skull', arenaName: 'SKULL ARENA',
    title: 'STAGE 8 · SKULL ARENA',
    rule: 'Carved skull dead zones + golden +3',
    width: 14, height: 14, wrap: true,
    goldenEvery: 6, goldenGrowth: 3,
    blockedBlocks: ARENAS.skull.blocks[14],
    obstacles: blocksToObstacles(14, ARENAS.skull.blocks[14]),
    speed: { baseMs: 95, minMs: 34, rampPerApple: 0.55 },
    guarantee: 'constructive',
    solver: { safetyMargin: 6, cutStopFill: 0.78, nearMissBias: 1, hesitateEvery: 10, hesitateTicks: 3 },
  },
  9: {
    ...common, id: 9, cycleSeed: 11, key: 'chambers', arena: 'chambers', arenaName: 'TWIN CHAMBERS',
    title: 'STAGE 9 · TWIN CHAMBERS',
    rule: '2 patrolling hazards + twin chambers',
    width: 14, height: 14, wrap: true,
    goldenEvery: 6, goldenGrowth: 3,
    blockedBlocks: ARENAS.chambers.blocks[14],
    obstacles: blocksToObstacles(14, ARENAS.chambers.blocks[14]),
    useMoverPockets: true,
    movers: [
      { path: [68, 54, 40, 26, 40, 54], phase: 0 },
      { path: [106, 105, 104, 103, 104, 105], phase: 3 },
    ],
    moverPockets: [68, 54, 40, 26, 25, 24, 106, 105, 104, 103, 117, 118],
    moverDespawnFill: 0.72,
    minCompleteRate: 0.95,
    speed: { baseMs: 90, minMs: 34, rampPerApple: 0.55 },
    guarantee: 'empirical',
    solver: { safetyMargin: 6, cutStopFill: 0.60, nearMissBias: 1, hesitateEvery: 10, hesitateTicks: 2 },
  },
};

/**
 * Build (and validate) the Hamiltonian cycle for a stage.
 * Throws if no cycle exists — that is the stage being rejected as unfinishable,
 * which is exactly the failure we want loud and early.
 */
export function buildCycle(stage, cycleSeed = stage.cycleSeed ?? 1) {
  const blocked = new Set(stage.obstacles || []);
  const blockedBlocks = new Set(stage.blockedBlocks || []);
  let cyc = randomCycle(stage.width, stage.height, mulberry32(cycleSeed), blockedBlocks);
  // Fallbacks, in descending order of how organic the result looks.
  if (!cyc) cyc = blocked.size ? findCycle(stage.width, stage.height, blocked, !!stage.wrap) : baseCycle(stage.width, stage.height);
  if (!cyc) throw new Error(`stage ${stage.id}: no Hamiltonian cycle — board is unfinishable`);
  assertCycle(cyc, stage.width, stage.height, !!stage.wrap, blocked);
  return cyc;
}

/**
 * A stage plus its cycle, with the snake started ON the cycle. Every tool goes
 * through here so the gate, the video and the web build cannot drift apart.
 *
 * When called as `buildStage(id, cycleSeed)` on Stages 1-5 without `arenaKey`,
 * this is 100% identical to HEAD (b853176).
 */
export function buildStage(id, cycleSeed, arenaKey) {
  const base = getStage(id);
  const cs = cycleSeed ?? base.cycleSeed ?? 1;
  if (arenaKey === 'open' || arenaKey === 'box') arenaKey = undefined;

  // Classic Stages 1-5 with no explicit arenaKey override: 100% HEAD behavior.
  if (!arenaKey && !base.arena && !base.useMoverPockets) {
    const cycle = buildCycle(base, cs);
    const [a, b] = [cycle[0], cycle[1]];
    const w = base.width, h = base.height;
    const dx = (b % w) - (a % w), dy = ((b / w) | 0) - ((a / w) | 0);
    const wrapX = base.wrap ? ((dx + w) % w === 1 ? 1 : (dx + w) % w === w - 1 ? -1 : dx) : dx;
    const wrapY = base.wrap ? ((dy + h) % h === 1 ? 1 : (dy + h) % h === h - 1 ? -1 : dy) : dy;
    const startDir = wrapX === 1 ? RIGHT : wrapX === -1 ? LEFT : wrapY === 1 ? DOWN : UP;
    return { stage: { ...base, start: cycle[0], startDir }, cycle };
  }

  // Explicit V3 stage (6-9) or explicit arenaKey override:
  const chosenArenaKey = arenaKey || base.arena || 'classic';
  const arenaDef = ARENAS[chosenArenaKey] || ARENAS.classic;
  const blockedBlocks = arenaDef.blocks[base.width] ?? base.blockedBlocks ?? [];
  const obstacles = blocksToObstacles(base.width, blockedBlocks);
  const title = arenaKey
    ? `STAGE ${id} · ${arenaDef.name}`
    : base.title;
  const useMoverPockets = Boolean(base.useMoverPockets || (arenaKey && (base.movers || []).length > 0));
  const stageWithArena = {
    ...base,
    title,
    cycleSeed: cs,
    arena: arenaDef.key,
    arenaName: arenaDef.name,
    blockedBlocks,
    obstacles,
    useMoverPockets,
    moverDespawnFill: useMoverPockets ? (base.moverDespawnFill < 0.7 ? 0.72 : base.moverDespawnFill) : base.moverDespawnFill,
    solver: useMoverPockets
      ? { ...base.solver, safetyMargin: Math.max(base.solver?.safetyMargin ?? 6, 6), cutStopFill: Math.max(base.solver?.cutStopFill ?? 0.6, 0.6) }
      : base.solver,
  };
  const cycle = buildCycle(stageWithArena, cs);
  let movers = stageWithArena.movers || [];
  let moverPockets = stageWithArena.moverPockets || [];
  if (useMoverPockets && movers.length > 0) {
    const pockets = findMoverPockets(cycle, stageWithArena.width, stageWithArena.height, !!stageWithArena.wrap, obstacles);
    if (pockets.length >= 2) {
      const [p1, p2] = pockets;
      movers = [
        { path: p1.track, phase: 0 },
        { path: p2.track, phase: 3 },
      ];
      moverPockets = [...p1.pocket, ...p2.pocket];
    }
  }
  const [a, b] = [cycle[0], cycle[1]];
  const w = stageWithArena.width, h = stageWithArena.height;
  const dx = (b % w) - (a % w), dy = ((b / w) | 0) - ((a / w) | 0);
  const wrapX = stageWithArena.wrap ? ((dx + w) % w === 1 ? 1 : (dx + w) % w === w - 1 ? -1 : dx) : dx;
  const wrapY = stageWithArena.wrap ? ((dy + h) % h === 1 ? 1 : (dy + h) % h === h - 1 ? -1 : dy) : dy;
  const startDir = wrapX === 1 ? RIGHT : wrapX === -1 ? LEFT : wrapY === 1 ? DOWN : UP;
  return {
    stage: { ...stageWithArena, movers, moverPockets, start: cycle[0], startDir },
    cycle,
  };
}

export function getStage(id) {
  const s = STAGES[id];
  if (!s) throw new Error(`unknown stage ${id}`);
  return s;
}
