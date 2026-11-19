// missions.js: the story Mara Voss hands Rook — six jobs, then repeatable
// side work — plus the ten stash crates hidden around Velmara. A mission is
// a list of steps; each step names a place (or a deed) and the step is done
// when the player does it. A pink beacon marks the current target in the
// world and on the minimap.

import { MISSIONS, SIDE_PACKAGE_REWARD, SIDE_TAXI_REWARD, STASH_COUNT, STASH_REWARD } from './config.js';
import { makePedMesh } from './pedestrians.js';

const THREE = window.THREE;

function stepFor(G, mission, index) {
  const L = G.city.landmarks;
  switch (mission.id) {
    case 'fare':
      return index === 0
        ? { type: 'goto', x: L.marina.x, z: L.marina.z, radius: 6, text: 'Pick up the fare at the Marina' }
        : { type: 'drive', x: L.pier.x, z: L.pier.z, radius: 8, text: 'Drive the fare to the Pier' };
    case 'package':
      return index === 0
        ? { type: 'pickup', x: L.warehouse.x, z: L.warehouse.z, radius: 5, text: 'Pick up the package at the Harbor warehouse' }
        : { type: 'deliver', x: L.beachBar.x, z: L.beachBar.z, radius: 5, text: 'Carry the package to the Beach Bar' };
    case 'getaway':
      return index === 0
        ? { type: 'steal', kind: 'parked', text: 'Steal a car — any parked car will do' }
        : { type: 'escape', x: L.safehouse.x, z: L.safehouse.z, radius: 8, text: 'Lose the heat, then reach the Safehouse' };
    case 'coupe':
      return index === 0
        ? { type: 'steal', kind: 'coupe', text: 'Steal the gold coupe by the Bank' }
        : { type: 'drive', x: L.garage.x, z: L.garage.z, radius: 8, text: 'Deliver the coupe to the Garage' };
    case 'ambush':
      return index === 0
        ? { type: 'goto', x: 60, z: 222, radius: 8, text: 'Meet the Harbor Kings on the beach' }
        : { type: 'fight', count: 4, text: 'Deal with the Harbor Kings — 4 left' };
    case 'bank':
      return index === 0
        ? { type: 'hold', x: L.bank.x, z: L.bank.z, radius: 10, seconds: 20, text: 'Hold the Bank — 20s' }
        : { type: 'escape', x: L.pier.x, z: L.pier.z, radius: 8, text: 'Lose the 4-star heat, then reach the Pier boat' };
    default:
      return null;
  }
}

function stepsCount(mission) {
  return mission.id === 'fare' || mission.id === 'package' || mission.id === 'getaway' ||
    mission.id === 'coupe' || mission.id === 'ambush' || mission.id === 'bank' ? 2 : 0;
}

export function createMissions(G, scene) {
  G.missionIndex = 0;
  G.missionStep = 0;
  G.missionState = 'active';
  G.missionHoldT = 0;
  G.missionKills = 0;
  G.rivals = [];
  G.sideJob = null;
  // The beacon: a pink beam the player can see across the city.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 90, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xff4fa3, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.y = 45;
  scene.add(beacon);
  G.beacon = beacon;
  // Stash crates: small glowing boxes at seeded spots.
  G.stashes = [];
  const stashMat = new THREE.MeshLambertMaterial({ color: 0x2ecc71, emissive: 0x1a7a3a });
  for (let i = 0; i < STASH_COUNT; i += 1) {
    const point = G.city.randomGroundPoint(G.rng);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), stashMat);
    mesh.position.set(point.x, 0.55, point.z);
    scene.add(mesh);
    G.stashes.push({ x: point.x, z: point.z, found: false, mesh });
  }
  startMissionStep(G);
}

function currentStep(G) {
  if (G.missionIndex >= MISSIONS.length) return null;
  return stepFor(G, MISSIONS[G.missionIndex], G.missionStep);
}

export function currentObjective(G) {
  const step = currentStep(G);
  if (step) return step.text;
  if (G.sideJob) return G.sideJob.text;
  return 'Velmara is yours — free roam';
}

export function currentTarget(G) {
  const step = currentStep(G);
  if (step && step.x !== undefined) return { x: step.x, z: step.z };
  if (G.sideJob && G.sideJob.x !== undefined) return { x: G.sideJob.x, z: G.sideJob.z };
  return null;
}

export function setMission(G, index, step) {
  G.missionIndex = index;
  G.missionStep = step;
  G.missionHoldT = 0;
  G.missionKills = 0;
  G.sideJob = null;
  const mission = MISSIONS[index];
  if (!mission) {
    G.beacon.visible = false;
    return;
  }
  if (mission.id === 'ambush' && step === 1) spawnRivals(G);
  const current = stepFor(G, mission, step);
  if (current && current.x !== undefined) {
    G.beacon.visible = true;
    G.beacon.position.set(current.x, 45, current.z);
  } else {
    G.beacon.visible = false;
  }
}

function startMissionStep(G) {
  const mission = MISSIONS[G.missionIndex];
  if (!mission) {
    G.beacon.visible = false;
    startSideJob(G);
    return;
  }
  G.missionHoldT = 0;
  G.missionKills = 0;
  if (mission.id === 'getaway' && G.missionStep === 0) {
    G.addHeat(200);
    G.events.push({ type: 'toast', text: 'The heat is on — 2 stars' });
  }
  if (mission.id === 'ambush' && G.missionStep === 1) spawnRivals(G);
  if (mission.id === 'bank' && G.missionStep === 1) {
    G.addHeat(400);
    G.events.push({ type: 'toast', text: '4 stars — lose them and reach the boat' });
  }
  const step = currentStep(G);
  if (step) {
    G.events.push({ type: 'toast', text: `${mission.title}: ${step.text}` });
    G.beacon.visible = step.x !== undefined;
    if (step.x !== undefined) G.beacon.position.set(step.x, 45, step.z);
  } else {
    G.beacon.visible = false;
  }
}

function spawnRivals(G) {
  const scene = G.sceneRef;
  for (let i = 0; i < 4; i += 1) {
    const mesh = makePedMesh(0xc0392b);
    scene.add(mesh);
    const rival = {
      kind: 'rival',
      x: 42 + i * 13,
      z: 224 + (i % 2) * 7,
      angle: 0,
      speed: 5.2,
      health: 100,
      mesh,
      punchT: 0,
    };
    mesh.position.set(rival.x, 0, rival.z);
    G.rivals.push(rival);
  }
}

function completeMission(G) {
  const mission = MISSIONS[G.missionIndex];
  G.player.cash += mission.reward;
  G.events.push({ type: 'mission-complete', reward: mission.reward, title: mission.title });
  G.missionIndex += 1;
  G.missionStep = 0;
  G.missionState = G.missionIndex >= MISSIONS.length ? 'done' : 'active';
  startMissionStep(G);
}

function startSideJob(G) {
  // Repeatable work once the story is done: taxi fares and package runs.
  const L = G.city.landmarks;
  const spots = [L.marina, L.hospital, L.bank, L.garage, L.beachBar, L.pier, L.warehouse, L.policeHQ];
  const from = spots[Math.floor(Math.random() * spots.length)];
  const to = spots[Math.floor(Math.random() * spots.length)];
  if (Math.random() < 0.5) {
    G.sideJob = { type: 'taxi', x: from.x, z: from.z, toX: to.x, toZ: to.z, stage: 0, reward: SIDE_TAXI_REWARD, text: `Taxi: pick up a fare at ${from === L.marina ? 'the Marina' : 'the city'}` };
  } else {
    G.sideJob = { type: 'package', x: from.x, z: from.z, toX: to.x, toZ: to.z, stage: 0, reward: SIDE_PACKAGE_REWARD, text: 'Package run: pick it up, then deliver it' };
  }
  G.beacon.visible = true;
  G.beacon.position.set(G.sideJob.x, 45, G.sideJob.z);
}

export function stepMissions(G, dt) {
  const p = G.player;
  // Stash crates: walk or drive close and the cash is yours.
  for (const stash of G.stashes) {
    if (stash.found) continue;
    const dx = p.x - stash.x;
    const dz = p.z - stash.z;
    if (dx * dx + dz * dz < 9) {
      stash.found = true;
      stash.mesh.visible = false;
      p.cash += STASH_REWARD;
      G.events.push({ type: 'cash', amount: STASH_REWARD, text: `Stash found: +$${STASH_REWARD}` });
    }
  }
  // Rivals chase the player and punch when close.
  for (const rival of [...G.rivals]) {
    if (rival.health <= 0) {
      G.sceneRef.remove(rival.mesh);
      G.rivals.splice(G.rivals.indexOf(rival), 1);
      continue;
    }
    const dx = p.x - rival.x;
    const dz = p.z - rival.z;
    const dist = Math.hypot(dx, dz) || 1;
    rival.angle = Math.atan2(dx, dz);
    if (dist > 1.6) {
      rival.x += (dx / dist) * rival.speed * dt;
      rival.z += (dz / dist) * rival.speed * dt;
    } else {
      rival.punchT -= dt;
      if (rival.punchT <= 0) {
        rival.punchT = 1.0;
        p.health -= 10;
        G.events.push({ type: 'hurt' });
      }
    }
    const swing = Math.sin(G.time * 11 + rival.x) * 0.55;
    rival.mesh.userData.legL.rotation.x = swing;
    rival.mesh.userData.legR.rotation.x = -swing;
    rival.mesh.position.set(rival.x, 0, rival.z);
    rival.mesh.rotation.y = rival.angle;
  }

  const step = currentStep(G);
  if (!step) {
    stepSideJob(G, dt);
    return;
  }
  const distTo = (x, z) => Math.hypot(p.x - x, p.z - z);
  switch (step.type) {
    case 'goto':
    case 'pickup':
    case 'deliver': {
      if (distTo(step.x, step.z) <= step.radius) advance(G);
      break;
    }
    case 'drive': {
      if (p.car && distTo(step.x, step.z) <= step.radius) advance(G);
      break;
    }
    case 'steal': {
      if (p.car && (step.kind === 'parked' ? p.car.kind === 'parked' || p.car.kind === 'traffic' : p.car.kind === 'coupe')) advance(G);
      break;
    }
    case 'escape': {
      if (distTo(step.x, step.z) <= step.radius && G.stars === 0) advance(G);
      break;
    }
    case 'fight': {
      const left = step.count - G.missionKills;
      step.text = `Deal with the Harbor Kings — ${Math.max(0, left)} left`;
      if (G.missionKills >= step.count) advance(G);
      break;
    }
    case 'hold': {
      if (distTo(step.x, step.z) <= step.radius) {
        G.missionHoldT += dt;
        step.text = `Hold the Bank — ${Math.max(0, Math.ceil(step.seconds - G.missionHoldT))}s`;
        if (G.missionHoldT >= step.seconds) advance(G);
      } else {
        G.missionHoldT = Math.max(0, G.missionHoldT - dt);
      }
      break;
    }
    default:
      break;
  }
}

function advance(G) {
  const mission = MISSIONS[G.missionIndex];
  G.missionStep += 1;
  if (G.missionStep >= stepsCount(mission)) completeMission(G);
  else startMissionStep(G);
}

function stepSideJob(G, dt) {
  const p = G.player;
  const job = G.sideJob;
  if (!job) return;
  const target = job.stage === 0 ? { x: job.x, z: job.z } : { x: job.toX, z: job.toZ };
  const dist = Math.hypot(p.x - target.x, p.z - target.z);
  const needCar = job.type === 'taxi' && job.stage === 1;
  if (dist <= 6 && (!needCar || p.car)) {
    if (job.stage === 0) {
      job.stage = 1;
      job.text = job.type === 'taxi' ? 'Drive the fare to the destination' : 'Carry the package to its destination';
      G.beacon.position.set(job.toX, 45, job.toZ);
      G.events.push({ type: 'toast', text: job.text });
    } else {
      p.cash += job.reward;
      G.events.push({ type: 'cash', amount: job.reward, text: `Side job done: +$${job.reward}` });
      G.sideJob = null;
      startSideJob(G);
    }
  }
}
