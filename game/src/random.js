// random.js: a small seeded generator, so the same seed always builds the
// same city and the same screenshot scenes. The city is built from the seed;
// live gameplay randomness (traffic turns, pedestrian choices) draws from a
// second stream so a screenshot stays repeatable.

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}

// A second, unseeded stream for live play (traffic turns, flee directions),
// so the city stays deterministic while the moment-to-moment game varies.
export const liveRng = makeRng((Date.now() ^ 0x9e3779b9) >>> 0);
