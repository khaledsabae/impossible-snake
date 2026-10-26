// Deterministic PRNG. Same seed => same run, bit for bit.
// This is what makes the solvability gate, the render and the public web build
// all reproduce the exact same game. Never use Math.random() anywhere in core/.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer in [0, n)
export function randInt(rng, n) {
  return Math.floor(rng() * n) % n;
}
