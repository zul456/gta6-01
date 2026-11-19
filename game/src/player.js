// player.js: Kai "Rook" Mercer on foot — walk and run, punch, pistol, and
// getting in and out of cars. Movement is relative to the camera, so W always
// walks away from the camera and S walks toward it.

import { PLAYER } from './config.js';
import { ACTION_PUNCH } from './input.js';

const THREE = window.THREE;

export function makePlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x2e86c1 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), shirt);
  torso.position.y = 1.05;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.66;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  cap.position.y = 1.86;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.7, 0.28), pants);
  legL.position.set(-0.17, 0.35, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.24), shirt);
  armL.position.set(-0.44, 1.05, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.44;
  group.add(armR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  group.userData.armL = armL;
  group.userData.armR = armR;
  return group;
}

/**
 * One fixed step on foot. Returns events the caller turns into sound and
 * wanted heat: punched someone, fired the pistol, picked up a stash.
 */
export function stepPlayerOnFoot(G, input, actions, dt, city) {
  const p = G.player;
  const events = { punched: null, shot: false };
  // Camera-relative movement: forward is away from the camera.
  const camAngle = G.cameraYaw;
  const fwdX = Math.sin(camAngle);
  const fwdZ = Math.cos(camAngle);
  const rightX = Math.cos(camAngle);
  const rightZ = -Math.sin(camAngle);
  const mx = fwdX * input.throttle() + rightX * input.steer();
  const mz = fwdZ * input.throttle() + rightZ * input.steer();
  const len = Math.hypot(mx, mz);
  const speed = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (len > 0.01) {
    p.x += (mx / len) * speed * dt;
    p.z += (mz / len) * speed * dt;
    p.angle = Math.atan2(mx / len, mz / len);
    p.moving = true;
  } else {
    p.moving = false;
  }
  p.x = Math.max(-238, Math.min(238, p.x));
  p.z = Math.max(-238, Math.min(238, p.z));
  const body = { x: p.x, z: p.z, radius: PLAYER.radius };
  city.resolveCircle(body);
  p.x = body.x;
  p.z = body.z;
  // Walk swing for the legs and arms.
  const swing = p.moving ? Math.sin(G.time * (input.run() ? 14 : 9)) * 0.55 : 0;
  p.mesh.userData.legL.rotation.x = swing;
  p.mesh.userData.legR.rotation.x = -swing;
  p.mesh.userData.armL.rotation.x = -swing * 0.7;
  p.mesh.userData.armR.rotation.x = swing * 0.7;
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.angle;
  // Punch: the nearest person in front, inside range and arc.
  if (actions & ACTION_PUNCH) {
    const target = nearestPersonInFront(G, p, PLAYER.punchRange, PLAYER.punchArc);
    if (target) {
      target.health -= PLAYER.punchDamage;
      events.punched = target;
    }
  }
  // Pistol: a hitscan shot toward the camera aim point.
  if (input.fireEdge()) {
    if (p.ammo > 0) {
      p.ammo -= 1;
      events.shot = true;
      firePistol(G);
    }
  }
  return events;
}

function nearestPersonInFront(G, p, range, arc) {
  let best = null;
  let bestD = range * range;
  const fx = Math.sin(p.angle);
  const fz = Math.cos(p.angle);
  const everyone = [...G.peds, ...G.cops, ...G.rivals];
  for (const person of everyone) {
    if (person.health <= 0) continue;
    const dx = person.x - p.x;
    const dz = person.z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > bestD) continue;
    const dot = (dx * fx + dz * fz) / Math.sqrt(d2 || 1);
    if (dot < Math.cos(arc)) continue;
    bestD = d2;
    best = person;
  }
  return best;
}

function firePistol(G) {
  const p = G.player;
  // Aim from the camera through the screen centre: shoot what the player
  // looks at, out to the pistol's range.
  const fx = Math.sin(G.cameraYaw);
  const fz = Math.cos(G.cameraYaw);
  let best = null;
  let bestD = PLAYER.pistolRange;
  const everyone = [...G.rivals, ...G.cops, ...G.peds];
  for (const person of everyone) {
    if (person.health <= 0) continue;
    const dx = person.x - p.x;
    const dz = person.z - p.z;
    const along = dx * fx + dz * fz;
    if (along < 1 || along > bestD) continue;
    const side = Math.abs(dx * fz - dz * fx);
    if (side > 2.2) continue;
    bestD = along;
    best = person;
  }
  if (best) {
    best.health -= PLAYER.pistolDamage;
    G.tracer = { from: { x: p.x, z: p.z }, to: { x: best.x, z: best.z }, ttl: 0.12 };
    if (best.health <= 0 && best.kind === 'rival') G.missionKills = (G.missionKills || 0) + 1;
  } else {
    G.tracer = { from: { x: p.x, z: p.z }, to: { x: p.x + fx * 30, z: p.z + fz * 30 }, ttl: 0.12 };
  }
}
