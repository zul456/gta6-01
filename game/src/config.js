// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720, groundY: 664 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  width: 72,
  height: 24,
  speed: 560,
  invulnerable: 1.5,
};

export const LIVES = 3;

export const BLOCK = {
  minWidth: 40,
  maxWidth: 110,
  height: 36,
  speed: 240,
  speedPerLevel: 30,
  speedJitter: 90,
  interval: 0.55,
  intervalScale: 0.88,
  minInterval: 0.14,
  dodgePoints: 1,
};

export const COIN = {
  size: 24,
  speed: 190,
  speedPerLevel: 14,
  interval: 1.4,
  intervalJitter: 0.8,
  points: 10,
};

/** Seconds of play per level, and the last level: speeds and spawn rates stop growing there. */
export const LEVEL = { seconds: 12, max: 12 };

/** How many falling things can exist at once; the pool is allocated once, at boot. */
export const POOL_SIZE = 64;

export const PALETTE = {
  backdrop: '#11141b',
  sky: '#1b1f2a',
  ground: '#2a3040',
  player: '#4fc3f7',
  block: '#e5534b',
  coin: '#f2c94c',
  panel: '#252b38',
  text: '#eef1f5',
  muted: '#8b93a3',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'block-dodger.best';
