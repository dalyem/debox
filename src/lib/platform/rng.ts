/**
 * Deterministic, seedable random number generator.
 *
 * The platform never shuffles with `Math.random()` directly. Instead every
 * shuffle/deal is driven by a numeric seed that is stored alongside the game
 * state. That makes every game reproducible and auditable: given the move log
 * and the seed, the exact same deck order can be replayed server-side.
 *
 * Seeds are minted inside Convex *mutations* (where non-determinism is allowed)
 * using `createSeed()`, then handed to `makeRng()` which is fully deterministic.
 */

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

/** mulberry32 — tiny, fast, well-distributed 32-bit PRNG. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(maxExclusive: number) {
      if (maxExclusive <= 0) return 0;
      return Math.floor(next() * maxExclusive);
    },
  };
}

/**
 * Mint a fresh non-deterministic seed. Safe to call inside Convex mutations and
 * the browser; falls back gracefully when Web Crypto is unavailable.
 */
export function createSeed(): number {
  try {
    const g = globalThis as { crypto?: Crypto };
    if (g.crypto?.getRandomValues) {
      const buf = new Uint32Array(1);
      g.crypto.getRandomValues(buf);
      return buf[0]! >>> 0;
    }
  } catch {
    // ignore — fall through to Math.random
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Fisher–Yates shuffle returning a new array; pure given the rng. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}
