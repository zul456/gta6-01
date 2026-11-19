// world.js: the game state and the one step that advances it. No drawing and
// no browser in it beyond the meshes the modules own: the player, the cars,
// the people, the police and the missions, all stepped in a fixed order so
// the simulation is the same at any frame rate.

import { CAR, PLAYER, POLICE, STEP } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { createTraffic, createParked, stepTraffic, driveCar, resolveCarPair, nearestCar } from './vehicles.js';
import { makePlayerMesh, stepPlayerOnFoot } from './player.js';
import { createPeds, stepPeds } from './pedestrians.js';
import { createPolice, stepPolice } from './police.js';
import { createMissions, stepMissions, currentObjective, currentTarget } from './missions.js';
import { ACTION_ENTER, ACTION_RELOAD } from './input.js';

export function createWorld(seed, scene) {
  const rng = makeRng(seed);
  const city = buildCity(rng);
  scene.add(city.group);

  const G = {
    seed,
    rng,
    time: 0,
    city,
    sceneRef: scene,
    events: [],
    cameraYaw: 0.6,
    cameraFixed: false,
    cameraLookAt: { x: 0, y: 1.6, z: 0 },
    tracer: null,
    shotFired: false,
    busted: false,
    wasted: false,
    best: 0,
    missionKills: 0,
  };

  const playerMesh = makePlayerMesh();
  scene.add(playerMesh);
  G.player = {
    x: 100,
    z: 0,
    angle: 0,
    health: PLAYER.health,
    cash: 120,
    ammo: PLAYER.pistolAmmo,
    onFoot: true,
    car: null,
    mesh: playerMesh,
    moving: false,
  };
  playerMesh.position.set(100, 0, 0);

  G.traffic = createTraffic(rng, city, scene);
  G.parked = createParked(rng, city, scene);
  G.peds = createPeds(rng, city, scene);
  createPolice(G, scene);
  G.rivals = [];
  createMissions(G, scene);

  G.addHeat = (amount) => {
    G.heat = Math.min(POLICE.maxStars * 100, G.heat + amount);
    G.stars = Math.min(POLICE.maxStars, Math.floor(G.heat / 100));
  };

  G.missionTarget = currentTarget(G);
  G.objective = currentObjective(G);
  return G;
}

function enterCar(G) {
  const p = G.player;
  const car = nearestCar(p.x, p.z, [...G.parked, ...G.traffic], PLAYER.enterRange);
  if (!car) return false;
  if (car.kind === 'traffic') {
    // Pull the driver out: the car leaves the traffic flow and becomes yours.
    const index = G.traffic.indexOf(car);
    if (index !== -1) G.traffic.splice(index, 1);
  }
  car.stolen = true;
  p.car = car;
  p.onFoot = false;
  p.mesh.visible = false;
  car.speed = 0;
  G.addHeat(60);
  G.events.push({ type: 'toast', text: 'Car stolen — the PD noticed' });
  return true;
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.speed = 0;
  car.kind = 'parked';
  // Step out to the car's left side.
  const sideX = Math.cos(car.angle);
  const sideZ = -Math.sin(car.angle);
  p.x = car.x + sideX * 2.4;
  p.z = car.z + sideZ * 2.4;
  p.angle = car.angle;
  p.onFoot = true;
  p.car = null;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
}

export function respawn(G) {
  const p = G.player;
  const hospital = G.city.landmarks.hospital;
  if (p.car) {
    p.car.speed = 0;
    p.car = null;
  }
  p.x = hospital.x + 14;
  p.z = hospital.z + 14;
  p.angle = 0;
  p.health = PLAYER.health;
  p.ammo = PLAYER.pistolAmmo;
  p.onFoot = true;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  p.cash = Math.floor(p.cash * (1 - POLICE.bustFine));
  G.heat = 0;
  G.stars = 0;
  G.bustHold = 0;
  G.busted = false;
  G.wasted = false;
}

export function stepWorld(G, input, actions, dt) {
  G.time += dt;
  G.shotFired = false;
  const p = G.player;
  const events = [];

  if (actions & ACTION_ENTER) {
    if (p.onFoot) enterCar(G);
    else exitCar(G);
  }
  if (actions & ACTION_RELOAD && p.onFoot) {
    p.ammo = PLAYER.pistolAmmo;
  }

  if (p.onFoot) {
    const foot = stepPlayerOnFoot(G, input, actions, dt, G.city);
    if (foot.punched) {
      G.addHeat(35);
      events.push({ type: 'punch' });
    }
    if (foot.shot) {
      G.shotFired = true;
      G.addHeat(25);
      events.push({ type: 'shot' });
    }
  } else if (p.car) {
    driveCar(p.car, input.throttle(), input.steer(), dt, G.city, input.handbrake());
    // The player rides the car: keep the player's position and facing glued
    // to it, or the camera, minimap, police chase and mission distance would
    // all keep pointing at the spot where the player got in.
    p.x = p.car.x;
    p.z = p.car.z;
    p.angle = p.car.angle;
    for (const car of G.traffic) resolveCarPair(p.car, car);
    for (const car of G.policeCars) resolveCarPair(p.car, car);
  }

  stepTraffic(G.traffic, dt, G.city, p.car);
  stepPeds(G, dt);
  stepPolice(G, dt, G.city);
  stepMissions(G, dt);

  // Mission events flow out to the HUD and the sound.
  for (const event of G.events) events.push(event);
  G.events.length = 0;

  if (G.busted) {
    events.push({ type: 'busted' });
    respawn(G);
  } else if (p.health <= 0) {
    p.health = 0;
    events.push({ type: 'wasted' });
    G.wasted = true;
    respawn(G);
    G.wasted = false;
  }

  G.missionTarget = currentTarget(G);
  G.objective = currentObjective(G);
  return events;
}
