// police.js: the wanted system. Heat rises with every crime and cools when
// the player stays out of sight; stars set how many patrol cars and foot cops
// hunt the player. Patrol cars chase and ram; foot cops run the player down
// and hold them — held too long, and it is a bust. Busted or wasted, Rook
// wakes at the Hospital minus a fifth of his cash.

import { POLICE } from './config.js';
import { makeCarMesh, driveCar, resolveCarPair } from './vehicles.js';
import { makePedMesh } from './pedestrians.js';

const THREE = window.THREE;

function starsFromHeat(heat) {
  return Math.min(POLICE.maxStars, Math.floor(heat / POLICE.heatPerStar));
}

export function createPolice(G, scene) {
  G.policeCars = [];
  G.cops = [];
  G.heat = 0;
  G.stars = 0;
  G.bustHold = 0;
  G.sceneRef = scene;
}

function spawnPoliceCar(G) {
  const p = G.player;
  // Appear on a road a little way from the player, so the chase arrives.
  const angle = Math.random() * Math.PI * 2;
  const x = Math.max(-220, Math.min(220, p.x + Math.cos(angle) * 70));
  const z = Math.max(-220, Math.min(220, p.z + Math.sin(angle) * 70));
  const mesh = makeCarMesh(0x1a2a44, true);
  G.sceneRef.add(mesh);
  const car = { kind: 'police', x, z, angle: 0, speed: 0, color: 0x1a2a44, mesh };
  car.mesh.position.set(x, 0, z);
  G.policeCars.push(car);
  return car;
}

function spawnCop(G) {
  const p = G.player;
  const angle = Math.random() * Math.PI * 2;
  const x = Math.max(-230, Math.min(230, p.x + Math.cos(angle) * 26));
  const z = Math.max(-230, Math.min(230, p.z + Math.sin(angle) * 26));
  const mesh = makePedMesh(0x1a2a44);
  // A cop wears the dark blue uniform: the torso is already navy from the
  // shirt colour; add a cap so they read as police at a glance.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.5), new THREE.MeshLambertMaterial({ color: 0x0e1a30 }));
  cap.position.y = 1.78;
  mesh.add(cap);
  G.sceneRef.add(mesh);
  const cop = { kind: 'cop', x, z, angle: 0, speed: POLICE.copSpeed, health: 100, mesh, punchT: 0 };
  mesh.position.set(x, 0, z);
  G.cops.push(cop);
  return cop;
}

function removeCar(G, car) {
  G.sceneRef.remove(car.mesh);
  const index = G.policeCars.indexOf(car);
  if (index !== -1) G.policeCars.splice(index, 1);
}

function removeCop(G, cop) {
  G.sceneRef.remove(cop.mesh);
  const index = G.cops.indexOf(cop);
  if (index !== -1) G.cops.splice(index, 1);
}

export function stepPolice(G, dt, city) {
  const p = G.player;
  // Heat cools; faster when no police can see the player.
  const seen = G.policeCars.length > 0 || G.cops.length > 0;
  G.heat = Math.max(0, G.heat - (seen ? POLICE.decayPerSecond : POLICE.hiddenDecayPerSecond) * dt);
  G.stars = starsFromHeat(G.heat);
  // Match the hunt to the stars: one patrol car and one foot cop per star.
  while (G.policeCars.length < G.stars) spawnPoliceCar(G);
  while (G.policeCars.length > G.stars) removeCar(G, G.policeCars[G.policeCars.length - 1]);
  while (G.cops.length < G.stars && p.onFoot) spawnCop(G);
  while (G.cops.length > G.stars) removeCop(G, G.cops[G.cops.length - 1]);

  // Patrol cars: steer at the player and ram.
  for (const car of G.policeCars) {
    const dx = p.x - car.x;
    const dz = p.z - car.z;
    const dist = Math.hypot(dx, dz) || 1;
    const want = Math.atan2(dx, dz);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2));
    const throttle = dist > 6 ? 1 : 0.4;
    driveCar(car, throttle, steer, dt, city, false);
    // Ramming the player's car shoves it and rattles the driver.
    if (p.car) {
      const cdx = p.car.x - car.x;
      const cdz = p.car.z - car.z;
      if (cdx * cdx + cdz * cdz < 16) {
        resolveCarPair(car, p.car);
        p.car.speed *= 0.92;
      }
    }
  }

  // Foot cops: run the player down on foot, punch, and hold for a bust.
  let holding = false;
  for (const cop of [...G.cops]) {
    if (cop.health <= 0) {
      removeCop(G, cop);
      continue;
    }
    const dx = p.x - cop.x;
    const dz = p.z - cop.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (!p.onFoot) {
      // On foot only: a cop cannot catch a car, so they give up the chase.
      cop.mesh.position.set(cop.x, 0, cop.z);
      continue;
    }
    cop.angle = Math.atan2(dx, dz);
    if (dist > 1.4) {
      cop.x += (dx / dist) * cop.speed * dt;
      cop.z += (dz / dist) * cop.speed * dt;
    } else {
      holding = true;
      cop.punchT -= dt;
      if (cop.punchT <= 0) {
        cop.punchT = 0.9;
        p.health -= POLICE.punchDamage;
        G.events.push({ type: 'hurt' });
      }
    }
    const body = { x: cop.x, z: cop.z, radius: 0.6 };
    city.resolveCircle(body);
    cop.x = body.x;
    cop.z = body.z;
    const swing = Math.sin(G.time * 12 + cop.x) * 0.6;
    cop.mesh.userData.legL.rotation.x = swing;
    cop.mesh.userData.legR.rotation.x = -swing;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.angle;
  }
  if (holding && p.onFoot) {
    G.bustHold += dt;
    if (G.bustHold >= POLICE.bustHoldSeconds) G.busted = true;
  } else {
    G.bustHold = Math.max(0, G.bustHold - dt * 2);
  }
}
