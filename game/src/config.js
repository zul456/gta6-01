// Velmara — a sun-soaked coastal open-world crime game.
// config.js: every tunable number in one place, so the city, the cars, the
// police and the missions all agree on the same world.

export const STEP = 1 / 60;
export const SAVE_KEY = 'velmara-save-v1';
export const BEST_KEY = 'velmara-best-v1';

// The city is a square grid of roads. Roads run both ways at these coordinates;
// the blocks between them hold the buildings. The beach and the ocean sit on
// the south edge (positive z), the hills on the north edge.
export const WORLD = {
  half: 240,
  roadSpacing: 60,
  roadCount: 8,
  roadWidth: 12,
  sidewalk: 4,
  beachZ: 210,
  oceanZ: 252,
};

// Road centre lines, from -210 to +210 in steps of 60.
export const ROADS = [];
for (let i = 0; i < WORLD.roadCount; i += 1) ROADS.push(-210 + i * WORLD.roadSpacing);

export const DISTRICTS = [
  { name: 'Harbor', x: -210, z: 150 },
  { name: 'Old Town', x: -90, z: 90 },
  { name: 'Downtown', x: 30, z: 30 },
  { name: 'Marina', x: 150, z: -30 },
  { name: 'North Hills', x: 90, z: -180 },
  { name: 'Beachfront', x: -30, z: 195 },
];

export function districtAt(x, z) {
  if (z >= WORLD.beachZ) return 'Beachfront';
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dx = d.x - x;
    const dz = d.z - z;
    const dd = dx * dx + dz * dz;
    if (dd < bestD) {
      bestD = dd;
      best = d;
    }
  }
  return best.name;
}

// Palette: golden-hour sun, warm stucco, glass towers, sea green.
export const PALETTE = {
  skyTop: 0x2e4a7a,
  skyMid: 0xe8836b,
  skyLow: 0xffc37a,
  sun: 0xffd9a0,
  fog: 0xf2a56b,
  road: 0x2b2f36,
  roadLine: 0xd8c98a,
  sidewalk: 0x9a8f7a,
  sand: 0xe8cf9a,
  sea: 0x1e6f7a,
  seaDeep: 0x14586b,
  building: [0xe8dcc8, 0xd9c9a8, 0xc9b18a, 0xb8a88e, 0x8fa3b8, 0x7a8ba0, 0xa89a80, 0xd8b48a],
  glass: [0x6b8cae, 0x7fa3c4, 0x5a7d9e],
  car: [0xc0392b, 0x2e86c1, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x1a1a1a, 0xd35400, 0x16a085],
  police: 0x1a2a44,
  taxi: 0xf5c518,
};

export const PLAYER = {
  walkSpeed: 4.2,
  runSpeed: 7.5,
  radius: 0.7,
  health: 100,
  punchDamage: 25,
  punchRange: 2.2,
  punchArc: 1.1,
  pistolDamage: 34,
  pistolRange: 55,
  pistolAmmo: 12,
  enterRange: 4.0,
};

export const CAR = {
  accel: 16,
  brake: 26,
  reverseAccel: 10,
  maxSpeed: 34,
  maxReverse: 12,
  steer: 1.9,
  grip: 6.0,
  handbrake: 30,
  radius: 1.6,
  trafficSpeed: 11,
  trafficCount: 14,
  parkedCount: 5,
};

export const PED = {
  count: 24,
  walkSpeed: 1.6,
  fleeSpeed: 4.5,
  radius: 0.6,
};

export const POLICE = {
  maxStars: 5,
  heatPerStar: 100,
  decayPerSecond: 2.2,
  hiddenDecayPerSecond: 7,
  carSpeed: 30,
  copSpeed: 6.4,
  punchDamage: 8,
  bustHoldSeconds: 2.0,
  bustFine: 0.2,
};

export const MISSIONS = [
  {
    id: 'fare',
    title: 'First Fare',
    brief: 'Mara Voss needs a driver. Pick up the fare at the Marina and take them to the Pier.',
    reward: 300,
  },
  {
    id: 'package',
    title: 'Hot Package',
    brief: 'A package is waiting at the Harbor warehouse. Carry it on foot to the Beach Bar. No car, no attention.',
    reward: 400,
  },
  {
    id: 'getaway',
    title: 'Getaway',
    brief: 'The heat is on. Steal a car and lose a 2-star wanted level, then reach the Safehouse.',
    reward: 600,
  },
  {
    id: 'coupe',
    title: 'Gold Coupe',
    brief: 'A gold coupe is parked by the Bank. Take it and deliver it to the Garage in Old Town.',
    reward: 800,
  },
  {
    id: 'ambush',
    title: 'Beach Ambush',
    brief: 'The Harbor Kings are waiting on the sand. Deal with all four of them.',
    reward: 1000,
  },
  {
    id: 'bank',
    title: 'Bank Hold',
    brief: 'Hold the Bank for twenty seconds, then lose a 4-star wanted level and reach the Pier boat.',
    reward: 2000,
  },
];

export const SIDE_TAXI_REWARD = 150;
export const SIDE_PACKAGE_REWARD = 120;
export const STASH_REWARD = 500;
export const STASH_COUNT = 10;
