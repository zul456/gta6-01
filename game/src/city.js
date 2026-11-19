// city.js: builds Velmara — a procedural grid city on a golden-hour coast.
// The ground is a single canvas texture (roads, dashes, sidewalks, sand), so
// the whole street plan costs one draw call; buildings wear canvas facades
// with lit windows; palms, lamps and landmarks are simple low-poly meshes.
// Everything is placed from the seed, so the same seed builds the same city.

import { PALETTE, ROADS, WORLD } from './config.js';

const THREE = window.THREE;

function makeFacadeTexture(base, lit) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  // Slight vertical shade so towers read as one volume.
  const shade = ctx.createLinearGradient(0, 0, 0, 256);
  shade.addColorStop(0, 'rgba(255,255,255,0.10)');
  shade.addColorStop(1, 'rgba(0,0,0,0.16)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const x = 10 + col * 19;
      const y = 12 + row * 20;
      ctx.fillStyle = lit && ((row * 6 + col) % 5 === 0) ? '#ffd98a' : '#20242c';
      ctx.fillRect(x, y, 12, 13);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGroundTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const toPx = (v) => ((v + WORLD.half) / (WORLD.half * 2)) * size;
  // Base: dry grass and concrete.
  ctx.fillStyle = '#8a7f5e';
  ctx.fillRect(0, 0, size, size);
  // Blocks: pale concrete pads.
  ctx.fillStyle = '#a89a7c';
  for (let ix = 0; ix < ROADS.length - 1; ix += 1) {
    for (let iz = 0; iz < ROADS.length - 1; iz += 1) {
      const x0 = toPx(ROADS[ix] + 10);
      const z0 = toPx(ROADS[iz] + 10);
      const w = toPx(ROADS[ix + 1] - 10) - x0;
      const h = toPx(ROADS[iz + 1] - 10) - z0;
      ctx.fillRect(x0, z0, w, h);
    }
  }
  // Roads: dark asphalt strips.
  ctx.fillStyle = '#2b2f36';
  for (const road of ROADS) {
    const c = toPx(road);
    const half = (WORLD.roadWidth / (WORLD.half * 2)) * size / 2;
    ctx.fillRect(0, c - half, size, half * 2);
    ctx.fillRect(c - half, 0, half * 2, size);
  }
  // Centre dashes.
  ctx.fillStyle = '#d8c98a';
  for (const road of ROADS) {
    const c = toPx(road);
    for (let v = -WORLD.half + 8; v < WORLD.half - 8; v += 24) {
      ctx.fillRect(toPx(v), c - 1.5, 12, 3);
      ctx.fillRect(c - 1.5, toPx(v), 3, 12);
    }
  }
  // Beach sand along the south edge.
  ctx.fillStyle = '#e8cf9a';
  ctx.fillRect(0, toPx(WORLD.beachZ), size, size - toPx(WORLD.beachZ));
  // Wet sand line where the waves meet the beach.
  ctx.fillStyle = '#d9b878';
  ctx.fillRect(0, toPx(WORLD.beachZ), size, 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  mesh.position.set(x, y, z);
  return mesh;
}

export function buildCity(rng) {
  const group = new THREE.Group();
  const buildings = [];
  const facadeMats = [];
  const baseColors = ['#e8dcc8', '#d9c9a8', '#c9b18a', '#b8a88e', '#8fa3b8', '#7a8ba0'];
  for (const base of baseColors) {
    facadeMats.push(new THREE.MeshLambertMaterial({ map: makeFacadeTexture(base, true) }));
  }
  const glassMats = [];
  for (const base of ['#6b8cae', '#7fa3c4', '#5a7d9e']) {
    glassMats.push(new THREE.MeshLambertMaterial({ map: makeFacadeTexture(base, false) }));
  }

  // Ground: one textured plane for the whole city.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.half * 2, WORLD.half * 2),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  // Ocean: a separate plane past the beach, waved by the renderer.
  const oceanGeo = new THREE.PlaneGeometry(WORLD.half * 2, 140, 48, 10);
  const ocean = new THREE.Mesh(
    oceanGeo,
    new THREE.MeshPhongMaterial({ color: PALETTE.sea, shininess: 90, specular: 0x88bbcc, transparent: true, opacity: 0.94 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, WORLD.oceanZ + 58);
  group.add(ocean);

  // Buildings, one or two per block, skipping the beach strip and the parks.
  const parkBlocks = new Set(['2,5', '5,2', '4,4']);
  for (let ix = 0; ix < ROADS.length - 1; ix += 1) {
    for (let iz = 0; iz < ROADS.length - 1; iz += 1) {
      const z0 = ROADS[iz];
      if (z0 >= WORLD.beachZ - 60) continue;
      if (parkBlocks.has(`${ix},${iz}`)) {
        // A park: palms and a lawn, no building.
        for (let p = 0; p < 5; p += 1) {
          const px = ROADS[ix] + 16 + rng.range(0, 28);
          const pz = ROADS[iz] + 16 + rng.range(0, 28);
          group.add(makePalm(px, pz, rng));
        }
        continue;
      }
      const bx0 = ROADS[ix] + 10;
      const bz0 = ROADS[iz] + 10;
      const bw = 40;
      const bd = 40;
      const tall = rng.chance(0.22);
      const h = tall ? rng.range(34, 58) : rng.range(9, 26);
      const w = rng.range(18, 30);
      const d = rng.range(18, 30);
      const cx = bx0 + bw / 2 + rng.range(-4, 4);
      const cz = bz0 + bd / 2 + rng.range(-4, 4);
      const mat = tall ? rng.pick(glassMats) : rng.pick(facadeMats);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(cx, h / 2, cz);
      group.add(mesh);
      buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      if (rng.chance(0.4)) {
        // A smaller neighbour in the same block.
        const w2 = rng.range(10, 16);
        const d2 = rng.range(10, 16);
        const h2 = rng.range(6, 14);
        const cx2 = bx0 + rng.range(8, 32);
        const cz2 = bz0 + rng.range(8, 32);
        if (Math.abs(cx2 - cx) > (w + w2) / 2 + 2 || Math.abs(cz2 - cz) > (d + d2) / 2 + 2) {
          const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), rng.pick(facadeMats));
          mesh2.position.set(cx2, h2 / 2, cz2);
          group.add(mesh2);
          buildings.push({ minX: cx2 - w2 / 2, maxX: cx2 + w2 / 2, minZ: cz2 - d2 / 2, maxZ: cz2 + d2 / 2 });
        }
      }
    }
  }

  // Landmarks: fixed, named, and wired to the missions.
  const landmarks = {
    hospital: { x: -180, z: -180 },
    policeHQ: { x: 180, z: -180 },
    bank: { x: 60, z: 60 },
    garage: { x: -60, z: 60 },
    safehouse: { x: -120, z: 120 },
    beachBar: { x: -60, z: 216 },
    pier: { x: 60, z: 240 },
    marina: { x: 120, z: -60 },
    warehouse: { x: -180, z: 120 },
  };
  const hospital = box(26, 16, 20, 0xf2f0ea, landmarks.hospital.x, 8, landmarks.hospital.z);
  group.add(hospital);
  const cross = box(8, 8, 1, 0xd43a2f, landmarks.hospital.x, 12, landmarks.hospital.z - 10.2);
  group.add(cross);
  buildings.push({ minX: -193, maxX: -167, minZ: -190, maxZ: -170 });
  const hq = box(24, 22, 18, 0x33507a, landmarks.policeHQ.x, 11, landmarks.policeHQ.z);
  group.add(hq);
  buildings.push({ minX: 168, maxX: 192, minZ: -189, maxZ: -171 });
  const bank = box(22, 14, 18, 0xd8cfae, landmarks.bank.x, 7, landmarks.bank.z);
  group.add(bank);
  for (let c = 0; c < 4; c += 1) {
    group.add(box(1.4, 10, 1.4, 0xf2ead0, landmarks.bank.x - 8 + c * 5.4, 5, landmarks.bank.z - 9.6));
  }
  buildings.push({ minX: 49, maxX: 71, minZ: 51, maxZ: 69 });
  const garage = box(20, 8, 16, 0x8a6f4d, landmarks.garage.x, 4, landmarks.garage.z);
  group.add(garage);
  buildings.push({ minX: -70, maxX: -50, minZ: 52, maxZ: 68 });
  const safehouse = box(16, 9, 14, 0x7a9a6a, landmarks.safehouse.x, 4.5, landmarks.safehouse.z);
  group.add(safehouse);
  buildings.push({ minX: -128, maxX: -112, minZ: 113, maxZ: 127 });
  const bar = box(14, 6, 10, 0xe88a4a, landmarks.beachBar.x, 3, landmarks.beachBar.z);
  group.add(bar);
  buildings.push({ minX: -67, maxX: -53, minZ: 211, maxZ: 221 });

  // The pier: planks out over the water, with posts.
  for (let s = 0; s < 12; s += 1) {
    const plank = box(8, 0.5, 4, 0x9a7a52, landmarks.pier.x, 0.6, 222 + s * 4.4);
    group.add(plank);
  }

  // Palms along the beach and the marina.
  for (let i = 0; i < 26; i += 1) {
    const px = -210 + i * 17 + rng.range(-4, 4);
    group.add(makePalm(px, WORLD.beachZ + 6 + rng.range(0, 8), rng));
  }
  for (let i = 0; i < 8; i += 1) {
    group.add(makePalm(120 + i * 12, -60 + rng.range(-4, 4), rng));
  }

  // Street lamps along every second road.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampHeadMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xcc9933 });
  for (let i = 0; i < ROADS.length; i += 2) {
    for (let j = -3; j <= 3; j += 2) {
      const x = ROADS[i] + 7;
      const z = j * 60;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 6, 6), lampMat);
      pole.position.set(x, 3, z);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampHeadMat);
      head.position.set(x, 6.1, z);
      group.add(head);
    }
  }

  function makePalm(x, z, r) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 6.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6a44 }),
    );
    trunk.position.y = 3.25;
    trunk.rotation.z = r.range(-0.08, 0.08);
    palm.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x3f8a4a }),
    );
    crown.scale.set(1, 0.45, 1);
    crown.position.y = 6.8;
    palm.add(crown);
    palm.position.set(x, 0, z);
    return palm;
  }

  function onRoad(x, z) {
    for (const road of ROADS) {
      if (Math.abs(x - road) <= WORLD.roadWidth / 2 + 1) return true;
      if (Math.abs(z - road) <= WORLD.roadWidth / 2 + 1) return true;
    }
    return false;
  }

  function resolveCircle(body) {
    // Push a circle (x, z, radius) out of every building AABB it overlaps.
    for (const b of buildings) {
      const nx = Math.max(b.minX, Math.min(body.x, b.maxX));
      const nz = Math.max(b.minZ, Math.min(body.z, b.maxZ));
      const dx = body.x - nx;
      const dz = body.z - nz;
      const d2 = dx * dx + dz * dz;
      const r = body.radius;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          body.x = nx + (dx / d) * r;
          body.z = nz + (dz / d) * r;
        } else {
          body.x = b.maxX + r;
        }
        return true;
      }
    }
    return false;
  }

  function randomRoadPoint(r) {
    const road = r.pick(ROADS);
    const along = r.range(-200, 200);
    if (r.chance(0.5)) return { x: road, z: along, axis: 'z' };
    return { x: along, z: road, axis: 'x' };
  }

  function randomGroundPoint(r) {
    for (let tries = 0; tries < 20; tries += 1) {
      const x = r.range(-200, 200);
      const z = r.range(-200, 200);
      let inside = false;
      for (const b of buildings) {
        if (x > b.minX - 2 && x < b.maxX + 2 && z > b.minZ - 2 && z < b.maxZ + 2) {
          inside = true;
          break;
        }
      }
      if (!inside) return { x, z };
    }
    return { x: 0, z: 0 };
  }

  return { group, buildings, landmarks, ocean, onRoad, resolveCircle, randomRoadPoint, randomGroundPoint };
}
