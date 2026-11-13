// Seeded random numbers. The same seed always gives the same problems,
// which is what makes the daily challenge identical for every player.

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed = (Math.random() * 2 ** 32) >>> 0) {
  const next = mulberry32(typeof seed === 'string' ? hashStr(seed) : seed);
  const rng = {
    seed,
    next,
    int(a, b) { return a + Math.floor(next() * (b - a + 1)); },
    float(a, b) { return a + next() * (b - a); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    sample(arr, n) { return rng.shuffle(arr).slice(0, n); },
  };
  return rng;
}
