// vehicles.js: cars. One mesh builder (body, cabin, wheels, lights), arcade
// driving physics for the player, a road-following AI for traffic, and the
// parked cars waiting to be stolen — including the gold coupe by the Bank.

import { CAR, PALETTE, ROADS } from './config.js';
import { liveRng } from './random.js';

const THREE = window.THREE;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhongMaterial({ color, shininess: 60 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 3.9), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabinMat = new THREE.MeshPhongMaterial({ color: 0x1c2733, shininess: 120 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.0), cabinMat);
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  for (const [wx, wz] of [[-0.95, 1.25], [0.95, 1.25], [-0.95, -1.25], [0.95, -1.25]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xccaa33 });
  for (const wx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.1), lightMat);
    light.position.set(wx, 0.62, 1.98);
    group.add(light);
  }
  if (isPolice) {
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }));
    red.position.set(-0.42, 1.5, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000aa }));
    blue.position.set(0.42, 1.5, -0.2);
    group.add(blue);
  }
  return group;
}

function placeMesh(car) {
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
}

/**
 * Arcade driving: throttle accelerates, brake stops then reverses, steering
 * bites harder the faster the car goes, the handbrake loosens the turn.
 * Buildings push the car out and kill some speed on impact.
 */
export function driveCar(car, throttle, steerInput, dt, city, handbrake) {
  if (throttle > 0) car.speed += CAR.accel * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 8 * dt;
    if (Math.abs(car.speed) < 0.3) car.speed = 0;
  }
  if (handbrake) car.speed -= Math.sign(car.speed) * CAR.handbrake * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
  const authority = Math.min(1, Math.abs(car.speed) / 9);
  const turnRate = CAR.steer * authority * (handbrake ? 1.7 : 1);
  car.angle += steerInput * turnRate * dt * (car.speed < 0 ? -1 : 1);
  car.x = clamp(car.x + Math.sin(car.angle) * car.speed * dt, -238, 238);
  car.z = clamp(car.z + Math.cos(car.angle) * car.speed * dt, -238, 238);
  const body = { x: car.x, z: car.z, radius: CAR.radius };
  if (city.resolveCircle(body)) {
    car.x = body.x;
    car.z = body.z;
    car.speed *= -0.25;
  }
  placeMesh(car);
}

export function createTraffic(rng, city, scene) {
  const cars = [];
  for (let i = 0; i < CAR.trafficCount; i += 1) {
    const point = city.randomRoadPoint(rng);
    const color = rng.pick(PALETTE.car);
    const mesh = makeCarMesh(color, false);
    scene.add(mesh);
    const dir = rng.chance(0.5) ? 1 : -1;
    const car = {
      kind: 'traffic',
      x: point.x,
      z: point.z,
      angle: 0,
      speed: rng.range(8, CAR.trafficSpeed),
      color,
      mesh,
      axis: point.axis,
      road: point.axis === 'x' ? point.z : point.x,
      along: point.axis === 'x' ? point.x : point.z,
      dir,
    };
    car.angle = car.axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    placeMesh(car);
    cars.push(car);
  }
  return cars;
}

function trafficTurn(car, rng) {
  // At an intersection, sometimes turn onto the crossing road.
  const cross = ROADS.find((r) => Math.abs(car.along - r) < 2.5);
  if (cross === undefined) return;
  if (!rng.chance(0.3)) return;
  const oldRoad = car.road;
  car.axis = car.axis === 'x' ? 'z' : 'x';
  car.road = cross;
  car.along = oldRoad;
  car.dir = rng.chance(0.5) ? 1 : -1;
  car.angle = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
}

export function stepTraffic(cars, dt, city, playerCar) {
  for (const car of cars) {
    // Ease off when the car ahead on the same lane is close.
    let target = CAR.trafficSpeed;
    for (const other of cars) {
      if (other === car || other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
      const gap = (other.along - car.along) * car.dir;
      if (gap > 0 && gap < 10) target = Math.min(target, other.speed);
    }
    if (playerCar) {
      const dx = playerCar.x - car.x;
      const dz = playerCar.z - car.z;
      if (dx * dx + dz * dz < 100) target = Math.min(target, 4);
    }
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    car.along += car.dir * car.speed * dt;
    if (car.along > 235) {
      car.along = 235;
      car.dir = -1;
      car.angle = car.axis === 'x' ? -Math.PI / 2 : Math.PI;
    } else if (car.along < -235) {
      car.along = -235;
      car.dir = 1;
      car.angle = car.axis === 'x' ? Math.PI / 2 : 0;
    }
    trafficTurn(car, liveRng);
    car.x = car.axis === 'x' ? car.along : car.road;
    car.z = car.axis === 'x' ? car.road : car.along;
    placeMesh(car);
  }
}

export function createParked(rng, city, scene) {
  const cars = [];
  // Parked on roads, facing along them, so stealing one and driving off
  // never means nosing straight into a building.
  const spots = [
    { x: -90, z: 36, angle: 0 },
    { x: 96, z: -30, angle: Math.PI / 2 },
    { x: -30, z: -144, angle: Math.PI },
    { x: 144, z: 90, angle: -Math.PI / 2 },
    { x: 30, z: 156, angle: 0 },
  ];
  for (let i = 0; i < CAR.parkedCount; i += 1) {
    const spot = spots[i % spots.length];
    const color = rng.pick(PALETTE.car);
    const mesh = makeCarMesh(color, false);
    scene.add(mesh);
    const car = { kind: 'parked', x: spot.x, z: spot.z, angle: spot.angle, speed: 0, color, mesh, stolen: false };
    placeMesh(car);
    cars.push(car);
  }
  // The gold coupe by the Bank: the prize of the fourth mission.
  const gold = makeCarMesh(0xd4af37, false);
  scene.add(gold);
  const coupe = { kind: 'coupe', x: 30, z: 60, angle: 0, speed: 0, color: 0xd4af37, mesh: gold, stolen: false };
  placeMesh(coupe);
  cars.push(coupe);
  return cars;
}

/** Push two cars apart when their circles overlap; the faster one shoves. */
export function resolveCarPair(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d2 = dx * dx + dz * dz;
  const min = CAR.radius * 2;
  if (d2 >= min * min || d2 < 0.0001) return;
  const d = Math.sqrt(d2);
  const push = (min - d) / 2;
  const nx = dx / d;
  const nz = dz / d;
  a.x -= nx * push;
  a.z -= nz * push;
  b.x += nx * push;
  b.z += nz * push;
  const swap = a.speed;
  a.speed = b.speed * 0.5;
  b.speed = swap * 0.5;
  placeMesh(a);
  placeMesh(b);
}

export function nearestCar(x, z, cars, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of cars) {
    const dx = car.x - x;
    const dz = car.z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD) {
      bestD = d2;
      best = car;
    }
  }
  return best;
}
