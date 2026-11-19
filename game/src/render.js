// render.js: the three.js scene — golden-hour sun, gradient sky dome, fog,
// the ocean's swell, and the third-person camera that eases behind the
// player on foot and behind the car while driving. Drawing only: the world's
// state in, pixels out.

import { PALETTE, WORLD } from './config.js';

const THREE = window.THREE;

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

function makeSkyDome() {
  const geo = new THREE.SphereGeometry(900, 24, 14);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      low: { value: new THREE.Color(PALETTE.skyLow) },
    },
    vertexShader: 'varying vec3 vPos; void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vPos;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(low, mid, smoothstep(-0.05, 0.25, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 180, 700);
  scene.add(makeSkyDome());

  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.35);
  sun.position.set(-160, 140, 260);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a4a5a, 0.75);
  scene.add(hemi);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);
  const camState = { yaw: 0.6, pitch: 0.42, dist: 16, x: 0, y: 10, z: 0 };

  // The pistol tracer: a short-lived bright line.
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8 });
  const tracerGeo = new THREE.BufferGeometry();
  tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  scene.add(tracer);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function updateCamera(G, dt) {
    const p = G.player;
    if (G.cameraFixed) {
      // Screenshot mode: the shot staged the camera; hold it exactly there.
      const shot = G.shotCamera || { x: camState.x, y: camState.y, z: camState.z, lookX: 0, lookY: 1.6, lookZ: 0, yaw: camState.yaw };
      camera.position.set(shot.x, shot.y, shot.z);
      camera.lookAt(shot.lookX, shot.lookY, shot.lookZ);
      G.cameraYaw = shot.yaw;
      return;
    }
    const targetYaw = p.onFoot ? p.angle : (p.car ? p.car.angle : p.angle);
    // Ease the camera yaw toward the player's heading, shortest way around.
    let diff = targetYaw - camState.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    camState.yaw += diff * Math.min(1, dt * 3.2);
    const wantDist = p.car ? 19 : 13;
    camState.dist += (wantDist - camState.dist) * Math.min(1, dt * 2);
    const cx = p.x - Math.sin(camState.yaw) * camState.dist;
    const cz = p.z - Math.cos(camState.yaw) * camState.dist;
    const cy = p.car ? 8.5 : 7;
    camState.x += (cx - camState.x) * Math.min(1, dt * 5);
    camState.y += (cy - camState.y) * Math.min(1, dt * 5);
    camState.z += (cz - camState.z) * Math.min(1, dt * 5);
    camera.position.set(camState.x, camState.y, camState.z);
    camera.lookAt(p.x, 1.6, p.z);
    G.cameraYaw = camState.yaw;
  }

  function animateOcean(G, ocean) {
    if (!ocean) return;
    const pos = ocean.geometry.attributes.position;
    const t = G.time;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.08 + t * 1.1) * 0.5 + Math.cos(y * 0.12 + t * 0.8) * 0.4);
    }
    pos.needsUpdate = true;
    ocean.geometry.computeVertexNormals();
  }

  function draw(G, screen, dt) {
    // The camera eases on the real frame time, not a fixed 1/60 s, or on a
    // slow machine it would lag a full car-length behind the player.
    updateCamera(G, dt || 1 / 60);
    animateOcean(G, G.city.ocean);
    if (G.tracer && G.tracer.ttl > 0) {
      const attr = tracerGeo.attributes.position;
      attr.setXYZ(0, G.tracer.from.x, 1.2, G.tracer.from.z);
      attr.setXYZ(1, G.tracer.to.x, 1.2, G.tracer.to.z);
      attr.needsUpdate = true;
      tracer.visible = true;
      G.tracer.ttl -= 1 / 60;
    } else {
      tracer.visible = false;
    }
    renderer.render(scene, camera);
  }

  return { scene, camera, draw, setCamera(yaw, pitch, dist, x, y, z) {
    camState.yaw = yaw;
    camState.pitch = pitch;
    camState.dist = dist;
    camState.x = x;
    camState.y = y;
    camState.z = z;
  } };
}
