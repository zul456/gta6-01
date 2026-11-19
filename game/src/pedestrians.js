// pedestrians.js: the people of Velmara. They stroll the sidewalks, cross at
// corners, and run when they hear a gunshot or see a punch. A scared
// pedestrian phones the police, which is how a quiet street gets loud.

import { PED, WORLD } from './config.js';
import { liveRng } from './random.js';

const THREE = window.THREE;

const SHIRTS = [0xd95f4b, 0x4b8ad9, 0x53b06a, 0xd9a441, 0x8a5fc0, 0xcccccc, 0x3a3f46];

export function makePedMesh(shirtColor) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.72, 0.34), shirt);
  torso.position.y = 1.0;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.58;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.66, 0.26), pants);
  legL.position.set(-0.15, 0.33, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.15;
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
}

export function createPeds(rng, city, scene) {
  const peds = [];
  for (let i = 0; i < PED.count; i += 1) {
    const point = city.randomGroundPoint(rng);
    const mesh = makePedMesh(rng.pick(SHIRTS));
    scene.add(mesh);
    const ped = {
      kind: 'ped',
      x: point.x,
      z: point.z,
      angle: rng.range(0, Math.PI * 2),
      speed: PED.walkSpeed * rng.range(0.8, 1.2),
      health: 100,
      state: 'walk',
      fleeT: 0,
      targetX: point.x,
      targetZ: point.z,
      mesh,
    };
    mesh.position.set(ped.x, 0, ped.z);
    mesh.rotation.y = ped.angle;
    peds.push(ped);
  }
  return peds;
}

function pickStrollTarget(ped, rng) {
  // Walk to a nearby point on the same block, then pick another.
  ped.targetX = Math.max(-WORLD.half + 12, Math.min(WORLD.half - 12, ped.x + rng.range(-40, 40)));
  ped.targetZ = Math.max(-WORLD.half + 12, Math.min(WORLD.half - 12, ped.z + rng.range(-40, 40)));
}

export function stepPeds(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.health <= 0) {
      ped.mesh.visible = false;
      continue;
    }
    // Flee from gunfire and from the player's fists.
    const dx = ped.x - p.x;
    const dz = ped.z - p.z;
    const d2 = dx * dx + dz * dz;
    if ((G.shotFired || d2 < 9) && ped.state !== 'flee') {
      ped.state = 'flee';
      ped.fleeT = 3;
      if (G.heat !== undefined && d2 < 400) G.addHeat(12);
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const d = Math.sqrt(d2 || 1);
      const tx = ped.x + (dx / d) * 10;
      const tz = ped.z + (dz / d) * 10;
      moveToward(ped, tx, tz, PED.fleeSpeed, dt);
      if (ped.fleeT <= 0) ped.state = 'walk';
    } else {
      const tdx = ped.targetX - ped.x;
      const tdz = ped.targetZ - ped.z;
      if (tdx * tdx + tdz * tdz < 1) pickStrollTarget(ped, liveRng);
      else moveToward(ped, ped.targetX, ped.targetZ, ped.speed, dt);
    }
    const swing = Math.sin(G.time * 9 + ped.x) * 0.5;
    ped.mesh.userData.legL.rotation.x = swing;
    ped.mesh.userData.legR.rotation.x = -swing;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.angle;
  }
}

function moveToward(ped, tx, tz, speed, dt) {
  const dx = tx - ped.x;
  const dz = tz - ped.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.01) return;
  const step = Math.min(d, speed * dt);
  ped.x += (dx / d) * step;
  ped.z += (dz / d) * step;
  ped.angle = Math.atan2(dx / d, dz / d);
}
