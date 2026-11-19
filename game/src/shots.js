// shots.js: the four screenshot scenes. Each one resets the simulation to
// a clean, seeded state, then plays the real rules forward — the player car
// driving, the police chasing, the rivals closing in — so the frame is what
// a short game really looks like, and the same seed always gives the same
// frame. The camera is fixed for the shot, never eased, and it is placed
// AFTER the world has been stepped, from the player's final position, so the
// player is always in frame. Heat is set with margin (150 for one star, 450
// for four) because a star sits exactly on a 100-heat boundary and any decay
// below it drops the star.

import { STEP } from './config.js';
import { makeRng } from './random.js';
import { setMission } from './missions.js';

const SIM_SECONDS = 5;

function fakeInput(throttle, steer) {
  return {
    throttle: () => throttle,
    steer: () => steer,
    run: () => false,
    handbrake: () => false,
    fireEdge: () => false,
    firing: () => false,
    takeDrag: () => 0,
    takeActions: () => 0,
  };
}

function resetStaged(G, seed) {
  const rng = makeRng(seed);
  G.time = 0;
  G.heat = 0;
  G.stars = 0;
  G.bustHold = 0;
  G.busted = false;
  G.wasted = false;
  G.shotFired = false;
  G.tracer = null;
  const p = G.player;
  p.health = 100;
  p.cash = 1250;
  p.ammo = 12;
  p.onFoot = true;
  p.car = null;
  p.mesh.visible = true;
  // Traffic and pedestrians back to seeded spots.
  for (const car of G.traffic) {
    const point = G.city.randomRoadPoint(rng);
    car.axis = point.axis;
    car.road = point.axis === 'x' ? point.z : point.x;
    car.along = point.axis === 'x' ? point.x : point.z;
    car.dir = rng.chance(0.5) ? 1 : -1;
    car.speed = 10;
    car.angle = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.x = car.axis === 'x' ? car.along : car.road;
    car.z = car.axis === 'x' ? car.road : car.along;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
  }
  for (const ped of G.peds) {
    const point = G.city.randomGroundPoint(rng);
    ped.x = point.x;
    ped.z = point.z;
    ped.health = 100;
    ped.state = 'walk';
    ped.mesh.visible = true;
    ped.mesh.position.set(ped.x, 0, ped.z);
  }
  // Police and rivals cleared; the staging re-adds what the shot needs.
  for (const car of [...G.policeCars]) {
    G.sceneRef.remove(car.mesh);
  }
  G.policeCars.length = 0;
  for (const cop of [...G.cops]) {
    G.sceneRef.remove(cop.mesh);
  }
  G.cops.length = 0;
  for (const rival of [...G.rivals]) {
    G.sceneRef.remove(rival.mesh);
  }
  G.rivals.length = 0;
  for (const stash of G.stashes) {
    stash.found = false;
    stash.mesh.visible = true;
  }
  G.missionKills = 0;
  G.sideJob = null;
}

function putPlayerInCar(G, car, x, z, angle) {
  const p = G.player;
  car.x = x;
  car.z = z;
  car.angle = angle;
  car.speed = 0;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = angle;
  p.car = car;
  p.onFoot = false;
  p.mesh.visible = false;
  p.x = x;
  p.z = z;
  p.angle = angle;
}

function stepFor(G, seconds, input, stepWorld) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepWorld(G, input, 0, STEP);
}

// A chase camera: behind the player, above it, looking ahead past it.
function cameraBehind(G, dist, height, ahead) {
  const p = G.player;
  const fx = Math.sin(p.angle);
  const fz = Math.cos(p.angle);
  G.cameraFixed = true;
  G.shotCamera = {
    x: p.x - fx * dist,
    y: height,
    z: p.z - fz * dist,
    lookX: p.x + fx * ahead,
    lookY: 1.6,
    lookZ: p.z + fz * ahead,
    yaw: p.angle,
  };
  G.cameraYaw = p.angle;
}

/**
 * Stage the named scene and return the screen to draw. The world keeps
 * simulating from here in the screenshot's two painted frames, so the
 * camera, the HUD and the minimap all read the staged state.
 */
export function stageShot(name, G, stepWorld) {
  resetStaged(G, 20261120);
  const p = G.player;
  if (name === 'chase') {
    // Four stars, three patrol cars on the tail, escape to the Pier boat.
    // The player drives south on road x=30, a real road, so the chase
    // actually moves instead of grinding into a building.
    setMission(G, 5, 1);
    G.addHeat(450);
    const car = G.parked[0];
    putPlayerInCar(G, car, 30, -60, 0);
    stepFor(G, 1.5, fakeInput(1, 0), stepWorld);
    // Line the patrol cars up behind the player, mid-chase.
    for (let i = 0; i < Math.min(3, G.policeCars.length); i += 1) {
      const pc = G.policeCars[i];
      pc.x = p.car.x - Math.sin(p.car.angle) * (9 + i * 6) + (i - 1) * 3;
      pc.z = p.car.z - Math.cos(p.car.angle) * (9 + i * 6);
      pc.angle = p.car.angle;
      pc.speed = 26;
      pc.mesh.position.set(pc.x, 0, pc.z);
      pc.mesh.rotation.y = pc.angle;
    }
    stepFor(G, 1.2, fakeInput(1, 0), stepWorld);
    cameraBehind(G, 24, 8, 22);
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // The beach ambush: Rook on foot by the pier, four Harbor Kings closing
    // in from the sand ahead of him, pistol ready.
    setMission(G, 4, 1);
    p.x = 60;
    p.z = 212;
    p.angle = 0;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.angle;
    stepFor(G, 1.2, fakeInput(0, 0), stepWorld);
    cameraBehind(G, 11, 5, 14);
    return { screen: 'play' };
  }
  if (name === 'city') {
    // A wide view down the beach avenue: the city, the traffic, the sea.
    setMission(G, 0, 0);
    G.addHeat(150);
    p.x = 0;
    p.z = 150;
    p.angle = Math.PI;
    p.mesh.position.set(p.x, 0, p.z);
    stepFor(G, SIM_SECONDS, fakeInput(0, 0), stepWorld);
    G.cameraFixed = true;
    G.shotCamera = { x: -40, y: 55, z: 60, lookX: 20, lookY: 2, lookZ: 210, yaw: Math.PI * 0.85 };
    G.cameraYaw = Math.PI * 0.85;
    return { screen: 'play' };
  }
  // Cover: sunset drive east on the beach avenue (road z=150), city on the
  // left, beach and ocean on the right, one star, first fare waiting.
  setMission(G, 0, 0);
  G.addHeat(150);
  const car = G.parked[4];
  putPlayerInCar(G, car, -110, 150, Math.PI / 2);
  stepFor(G, 2, fakeInput(1, 0), stepWorld);
  cameraBehind(G, 13, 5.5, 16);
  return { screen: 'play' };
}
