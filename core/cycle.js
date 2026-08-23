// Hamiltonian cycle construction + verification.
// The cycle IS the safety guarantee: a snake that never leaves it fills the
// board 100% by definition. Everything the solver does is a bounded deviation
// from it, so "can this stage be finished?" reduces to "does a cycle exist?".

const DELTA = [[0, -1], [1, 0], [0, 1], [-1, 0]];

export function neighborsOf(cell, w, h, wrap, blocked) {
  const x = cell % w, y = (cell / w) | 0;
  const out = [];
  for (let d = 0; d < 4; d++) {
    let nx = x + DELTA[d][0], ny = y + DELTA[d][1];
    if (wrap) { nx = (nx + w) % w; ny = (ny + h) % h; }
    else if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const nc = ny * w + nx;
    if (blocked && blocked.has(nc)) continue;
    out.push(nc);
  }
  return out;
}

/**
 * Boustrophedon cycle on an open grid. Requires an even height.
 * Column 0 is the return leg; rows 1..w-1 zig-zag.
 */
export function baseCycle(w, h) {
  if (h % 2 !== 0) throw new Error(`baseCycle needs an even height, got ${h}`);
  const path = [];
  const at = (x, y) => y * w + x;
  path.push(at(0, 0));
  for (let y = 0; y < h; y++) {
    if (y % 2 === 0) for (let x = 1; x < w; x++) path.push(at(x, y));
    else for (let x = w - 1; x >= 1; x--) path.push(at(x, y));
  }
  path.push(at(0, h - 1));
  for (let y = h - 2; y >= 1; y--) path.push(at(0, y));
  return path;
}

/** Throws if `path` is not a genuine Hamiltonian cycle over the free cells. */
export function assertCycle(path, w, h, wrap, blocked) {
  const free = w * h - (blocked ? blocked.size : 0);
  if (path.length !== free) throw new Error(`cycle covers ${path.length} cells, expected ${free}`);
  const seen = new Set(path);
  if (seen.size !== path.length) throw new Error('cycle repeats a cell');
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    if (!neighborsOf(a, w, h, wrap, blocked).includes(b)) {
      throw new Error(`cycle break at index ${i}: ${a} -> ${b} are not adjacent`);
    }
  }
  return true;
}

/**
 * Backtracking search for a Hamiltonian cycle on a grid with holes.
 * Warnsdorff ordering (fewest onward moves first) plus a connectivity prune —
 * on 14x14 with a handful of obstacles this settles in milliseconds or reports
 * failure, which is exactly what the stage-4 gate needs.
 * Returns the cycle array, or null if none was found within `budget` nodes.
 */
export function findCycle(w, h, blocked = new Set(), wrap = false, budget = 4_000_000) {
  const n = w * h;
  const free = [];
  for (let i = 0; i < n; i++) if (!blocked.has(i)) free.push(i);
  if (free.length < 4) return null;
  if (free.length % 2 !== 0) return null; // grid graph is bipartite: odd cell count => no cycle

  const adj = new Map();
  for (const c of free) adj.set(c, neighborsOf(c, w, h, wrap, blocked));
  for (const c of free) if (adj.get(c).length < 2) return null; // dead-end cell

  const start = free[0];
  const visited = new Set([start]);
  const path = [start];
  let nodes = 0;

  // Every unvisited cell must still be reachable from `from`, else prune.
  const connected = (from) => {
    const stack = [from];
    const seen = new Set([from]);
    while (stack.length) {
      for (const nb of adj.get(stack.pop())) {
        if (visited.has(nb) || seen.has(nb)) continue;
        seen.add(nb); stack.push(nb);
      }
    }
    let need = 0;
    for (const c of free) if (!visited.has(c)) need++;
    return seen.size - (visited.has(from) ? 1 : 0) >= need;
  };

  const dfs = (cur) => {
    if (++nodes > budget) return false;
    if (path.length === free.length) return adj.get(cur).includes(start);
    const cands = adj.get(cur).filter((c) => !visited.has(c));
    if (cands.length === 0) return false;
    if (!connected(cur)) return false;
    cands.sort((a, b) =>
      adj.get(a).filter((c) => !visited.has(c)).length -
      adj.get(b).filter((c) => !visited.has(c)).length);
    for (const nx of cands) {
      visited.add(nx); path.push(nx);
      if (dfs(nx)) return true;
      visited.delete(nx); path.pop();
    }
    return false;
  };

  return dfs(start) ? path : null;
}

/** cell -> its position in the cycle. */
export function cycleOrder(path, n) {
  const order = new Int32Array(n).fill(-1);
  for (let i = 0; i < path.length; i++) order[path[i]] = i;
  return order;
}

/**
 * RANDOM Hamiltonian cycle on an even x even grid.
 *
 * Why this exists: baseCycle() is a boustrophedon, and a snake riding it lays its
 * body out as a perfect serpentine. At 90% fill the screen shows the algorithm —
 * it reads as a machine instantly. This builds a maze-like cycle instead, so the
 * filled board looks like something a person folded.
 *
 * Construction: pair up cells into 2x2 blocks, take a random spanning tree over
 * the block grid, and trace the contour of that tree. The result is a genuine
 * Hamiltonian cycle (assertCycle proves it), so the completion guarantee is
 * unchanged — only the shape is.
 *
 * @param blockedBlocks Set of super-cell indices (bj*bw+bi) to leave out entirely.
 */
export function randomCycle(w, h, rng, blockedBlocks = new Set(), windiness = 0.35) {
  if (w % 2 || h % 2) throw new Error(`randomCycle needs even dimensions, got ${w}x${h}`);
  const bw = w / 2, bh = h / 2;
  const blocks = [];
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const b = j * bw + i;
    if (!blockedBlocks.has(b)) blocks.push(b);
  }
  if (blocks.length < 2) return null;

  // --- random spanning tree over the block grid (randomised DFS) ---
  const inTree = new Set([blocks[0]]);
  const treeEdges = [];
  const frontier = [blocks[0]];
  const blockNbrs = (b) => {
    const i = b % bw, j = (b / bw) | 0, out = [];
    if (i > 0) out.push(b - 1);
    if (i < bw - 1) out.push(b + 1);
    if (j > 0) out.push(b - bw);
    if (j < bh - 1) out.push(b + bw);
    return out.filter((n) => !blockedBlocks.has(n));
  };
  while (frontier.length) {
    // Pure DFS carves long straight corridors, which is exactly the machine look
    // we are trying to kill. Jumping back to a random frontier cell some of the
    // time breaks those runs up and makes the finished board read as folded by hand.
    const pick = rng() < windiness ? Math.floor(rng() * frontier.length) % frontier.length : frontier.length - 1;
    const cur = frontier[pick];
    const cands = blockNbrs(cur).filter((n) => !inTree.has(n));
    if (!cands.length) { frontier.splice(pick, 1); continue; }
    const nxt = cands[Math.floor(rng() * cands.length) % cands.length];
    inTree.add(nxt); treeEdges.push([cur, nxt]); frontier.push(nxt);
  }
  if (inTree.size !== blocks.length) return null; // block grid is disconnected

  // --- start from one 4-cycle per block, then merge across each tree edge ---
  const at = (x, y) => y * w + x;
  const key = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const edges = new Map();
  const add = (a, b) => edges.set(key(a, b), [a, b]);
  const del = (a, b) => edges.delete(key(a, b));

  for (const b of blocks) {
    const i = b % bw, j = (b / bw) | 0, x = i * 2, y = j * 2;
    add(at(x, y), at(x + 1, y));
    add(at(x + 1, y), at(x + 1, y + 1));
    add(at(x + 1, y + 1), at(x, y + 1));
    add(at(x, y + 1), at(x, y));
  }
  for (const [a, b] of treeEdges) {
    const ai = a % bw, aj = (a / bw) | 0, bi = b % bw, bj = (b / bw) | 0;
    const [li, lj, ri, rj] = ai <= bi && aj <= bj ? [ai, aj, bi, bj] : [bi, bj, ai, aj];
    const lx = li * 2, ly = lj * 2, rx = ri * 2, ry = rj * 2;
    if (lj === rj) {                       // horizontal neighbours: swap the facing vertical edges
      del(at(lx + 1, ly), at(lx + 1, ly + 1));
      del(at(rx, ry), at(rx, ry + 1));
      add(at(lx + 1, ly), at(rx, ry));
      add(at(lx + 1, ly + 1), at(rx, ry + 1));
    } else {                               // vertical neighbours: swap the facing horizontal edges
      del(at(lx, ly + 1), at(lx + 1, ly + 1));
      del(at(rx, ry), at(rx + 1, ry));
      add(at(lx, ly + 1), at(rx, ry));
      add(at(lx + 1, ly + 1), at(rx + 1, ry));
    }
  }

  // --- walk the edge set into an ordered cycle ---
  const adj = new Map();
  for (const [a, b] of edges.values()) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b); adj.get(b).push(a);
  }
  for (const [c, list] of adj) if (list.length !== 2) return null; // not a disjoint-cycle cover

  const start = blocks[0] % bw * 2 + ((blocks[0] / bw) | 0) * 2 * w;
  const path = [start];
  let prev = -1, cur = start;
  for (;;) {
    const [x, y] = adj.get(cur);
    const nxt = x === prev ? y : x;
    if (nxt === start) break;
    path.push(nxt); prev = cur; cur = nxt;
    if (path.length > w * h) return null;
  }
  return path.length === adj.size ? path : null; // a short walk means several loops, not one cycle
}
