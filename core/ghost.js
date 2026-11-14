// Compact deterministic run codec & live ghost runner.
// Shared between the static web bundle build and the browser game so recorded
// runs can be replayed side-by-side in static public bundles.

import { Game } from './game.js';

/**
 * Encodes a sequence of 2-bit directions ('0'..'3' or number array) into a
 * compact URL-safe Base64 token with a 16-bit length header and XOR checksum.
 * @param {string|number[]|Uint8Array} dirsInput
 * @returns {string}
 */
export function encodeGhost(dirsInput) {
  const isStr = typeof dirsInput === 'string';
  const len = dirsInput ? dirsInput.length : 0;
  if (len > 65535) throw new Error(`ghost sequence exceeds 65535 ticks (${len})`);

  const payloadLen = Math.ceil(len / 4);
  const bytes = new Uint8Array(3 + payloadLen);
  bytes[0] = (len >>> 8) & 0xff;
  bytes[1] = len & 0xff;

  let xorAcc = len & 0xff;
  for (let p = 0; p < payloadLen; p++) {
    const i = p * 4;
    const d0 = i < len ? (isStr ? Number(dirsInput[i]) : dirsInput[i]) & 3 : 0;
    const d1 = i + 1 < len ? (isStr ? Number(dirsInput[i + 1]) : dirsInput[i + 1]) & 3 : 0;
    const d2 = i + 2 < len ? (isStr ? Number(dirsInput[i + 2]) : dirsInput[i + 2]) & 3 : 0;
    const d3 = i + 3 < len ? (isStr ? Number(dirsInput[i + 3]) : dirsInput[i + 3]) & 3 : 0;
    const packed = (d0 << 6) | (d1 << 4) | (d2 << 2) | d3;
    bytes[3 + p] = packed;
    xorAcc ^= packed;
  }
  bytes[2] = xorAcc & 0xff;

  let bin = '';
  const chunk = 0x4000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a URL-safe Base64 ghost token back into a Uint8Array of directions 0..3.
 * @param {string} token
 * @returns {Uint8Array}
 */
export function decodeGhost(token) {
  if (typeof token !== 'string' || !token.length) {
    throw new Error('invalid ghost token: empty');
  }
  let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const bin = atob(b64);
  if (bin.length < 3) throw new Error('invalid ghost token: truncated header');

  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  const len = (bytes[0] << 8) | bytes[1];
  const expectedPayload = Math.ceil(len / 4);
  if (bytes.length !== 3 + expectedPayload) {
    throw new Error(`invalid ghost token: length mismatch (${bytes.length} vs ${3 + expectedPayload})`);
  }

  let xorAcc = len & 0xff;
  for (let p = 0; p < expectedPayload; p++) xorAcc ^= bytes[3 + p];
  if ((xorAcc & 0xff) !== bytes[2]) {
    throw new Error('invalid ghost token: checksum mismatch');
  }

  const dirs = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    const packed = bytes[3 + (i >>> 2)];
    const shift = 6 - (i & 3) * 2;
    dirs[i] = (packed >>> shift) & 3;
  }
  return dirs;
}

/**
 * Steps a deterministic Game shadow copy through recorded directions synced
 * cleanly against elapsed wall-clock milliseconds.
 */
export class GhostRunner {
  /**
   * @param {object} stage  ruleset object from core/stages.js
   * @param {number} seed
   * @param {Uint8Array|number[]|string} dirs  decoded direction array or encoded token
   */
  constructor(stage, seed, dirs) {
    this.game = new Game(stage, seed);
    if (dirs instanceof Uint8Array) this.dirs = dirs;
    else if (Array.isArray(dirs)) this.dirs = Uint8Array.from(dirs);
    else this.dirs = decodeGhost(dirs);
    this.prevSnake = this.game.snake.slice();
    this.accMs = 0;
    this.f = 0;
  }

  tickDurationMs() {
    const sp = this.game.stage.speed || { baseMs: 110, minMs: 70, rampPerApple: 0.5 };
    return Math.max(sp.minMs, sp.baseMs - this.game.applesEaten * sp.rampPerApple);
  }

  advance(dtMs) {
    if (this.game.alive && !this.game.isFull() && this.game.tick < this.dirs.length) {
      this.accMs += Math.max(0, dtMs);
      while (this.game.alive && !this.game.isFull() && this.game.tick < this.dirs.length) {
        const tickMs = this.tickDurationMs();
        if (this.accMs < tickMs) break;
        this.accMs -= tickMs;
        this.prevSnake = this.game.snake.slice();
        this.game.step(this.dirs[this.game.tick]);
      }
    }
    this.f = (this.game.isFull() || !this.game.alive || this.game.tick >= this.dirs.length)
      ? 1
      : Math.min(1, this.accMs / this.tickDurationMs());
    return this.frame();
  }

  frame() {
    return {
      base: this.prevSnake,
      target: this.game.snake,
      f: this.f,
      length: this.game.length,
      capacity: this.game.capacity,
      alive: this.game.alive,
      full: this.game.isFull(),
    };
  }
}
