// The five rulesets. Ordered by how strong the 100%-fill guarantee is:
// proven (1-3) -> verified by construction (4) -> verified only empirically (5).
// Nothing here ships until tools/verify.js confirms a full board by actual effect.

import { baseCycle, findCycle, randomCycle, assertCycle } from './cycle.js';
import { mulberry32 } from './rng.js';
import { RIGHT, LEFT, UP, DOWN } from './game.js';

const common = {
  start: 0,          // (0,0) — the first cell of the base cycle
  startDir: RIGHT,
  startLength: 3,
};

export const STAGES = {
  1: {
    ...common, id: 1, cycleSeed: 1, key: 'classic', title: 'كلاسيك',
    rule: 'بلا إضافات — الأساس',
    width: 10, height: 10, wrap: false,
    speed: { baseMs: 115, minMs: 72, rampPerApple: 0.5 },
    guarantee: 'proven',
    solver: { safetyMargin: 3, cutStopFill: 0.5, nearMissBias: 1, hesitateEvery: 12, hesitateTicks: 3 },
  },
  2: {
    ...common, id: 2, cycleSeed: 3, key: 'wrap', title: 'الجدران بتلتف',
    rule: 'يخرج من اليمين يدخل من الشمال — طارة',
    width: 12, height: 12, wrap: true,
    speed: { baseMs: 105, minMs: 64, rampPerApple: 0.35 },
    guarantee: 'proven',
    solver: { safetyMargin: 3, cutStopFill: 0.5, nearMissBias: 1, hesitateEvery: 12, hesitateTicks: 3 },
  },
  3: {
    ...common, id: 3, cycleSeed: 5, key: 'golden', title: 'التفاحة الذهبية',
    rule: 'كل ٥ تفاحات واحدة ذهبية = +٣ طول',
    width: 12, height: 12, wrap: true,
    goldenEvery: 5, goldenGrowth: 3,
    speed: { baseMs: 100, minMs: 58, rampPerApple: 0.45 },
    guarantee: 'proven-conditional',
    solver: { safetyMargin: 3, cutStopFill: 0.5, nearMissBias: 1, hesitateEvery: 10, hesitateTicks: 3 },
  },
  4: {
    ...common, id: 4, cycleSeed: 7, key: 'obstacles', title: 'عوائق ثابتة',
    rule: 'أعمدة ثابتة جوه اللوحة',
    width: 14, height: 14, wrap: true,
    goldenEvery: 6, goldenGrowth: 3,
    // Four 2x2 blocks aligned to the 2x2 super-grid, so they delete whole
    // super-cells and randomCycle() still returns a proven cycle over the rest.
    obstacles: [30,31,44,45, 38,39,52,53, 142,143,156,157, 150,151,164,165],
    speed: { baseMs: 95, minMs: 52, rampPerApple: 0.35 },
    blockedBlocks: [8, 12, 36, 40],
    guarantee: 'constructive',
    solver: { safetyMargin: 3, cutStopFill: 0.45, nearMissBias: 1, hesitateEvery: 10, hesitateTicks: 3 },
  },
  5: {
    ...common, id: 5, cycleSeed: 11, key: 'movers', title: 'عوائق متحركة',
    rule: 'كل قواعد اللي فات + عائقان بيتحركوا',
    width: 14, height: 14, wrap: true,
    goldenEvery: 6, goldenGrowth: 3,
    obstacles: [30,31,44,45, 38,39,52,53, 142,143,156,157, 150,151,164,165],
    // Two movers patrolling open lanes, withdrawing at 85% fill.
    movers: [
      { path: [7, 21, 35, 49, 63, 77, 91, 77, 63, 49, 35, 21], phase: 0 },
      { path: [188, 174, 160, 146, 132, 118, 104, 118, 132, 146, 160, 174], phase: 4 },
    ],
    moverDespawnFill: 0.85,
    speed: { baseMs: 90, minMs: 46, rampPerApple: 0.35 },
    blockedBlocks: [8, 12, 36, 40],
    guarantee: 'empirical',
    solver: { safetyMargin: 4, cutStopFill: 0.4, nearMissBias: 1, hesitateEvery: 10, hesitateTicks: 2 },
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
 */
export function buildStage(id, cycleSeed) {
  const base = getStage(id);
  const cycle = buildCycle(base, cycleSeed ?? base.cycleSeed ?? 1);
  // Start heading ALONG the cycle. A fixed startDir is fatal for a human player:
  // with no input on tick 1 the snake walks straight off the board.
  const [a, b] = [cycle[0], cycle[1]];
  const w = base.width, h = base.height;
  const dx = (b % w) - (a % w), dy = ((b / w) | 0) - ((a / w) | 0);
  const wrapX = base.wrap ? ((dx + w) % w === 1 ? 1 : (dx + w) % w === w - 1 ? -1 : dx) : dx;
  const wrapY = base.wrap ? ((dy + h) % h === 1 ? 1 : (dy + h) % h === h - 1 ? -1 : dy) : dy;
  const startDir = wrapX === 1 ? RIGHT : wrapX === -1 ? LEFT : wrapY === 1 ? DOWN : UP;
  return { stage: { ...base, start: cycle[0], startDir }, cycle };
}

export function getStage(id) {
  const s = STAGES[id];
  if (!s) throw new Error(`unknown stage ${id}`);
  return s;
}
