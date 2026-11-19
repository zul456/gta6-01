// hud.js: the HUD — a DOM overlay on top of the 3D canvas. Cash, health,
// wanted stars, ammo, speed, district, the current objective and toasts, plus
// a live minimap drawn on a small canvas: roads, the player arrow, traffic,
// police, the mission beacon and stash crates. Title, pause, busted and
// wasted screens are panels over the game. Progress saves to localStorage.

import { BEST_KEY, PLAYER, SAVE_KEY, districtAt } from './config.js';

function el(tag, cls, parent) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (parent) parent.appendChild(node);
  return node;
}

export function createHud() {
  const root = el('div', 'hud', document.body);
  const topLeft = el('div', 'hud-top-left', root);
  const cash = el('div', 'hud-cash', topLeft);
  const objective = el('div', 'hud-objective', topLeft);
  const district = el('div', 'hud-district', topLeft);
  const topRight = el('div', 'hud-top-right', root);
  const stars = el('div', 'hud-stars', topRight);
  const health = el('div', 'hud-health', topRight);
  const healthBar = el('div', 'hud-health-bar', health);
  const healthFill = el('div', 'hud-health-fill', healthBar);
  const ammo = el('div', 'hud-ammo', topRight);
  const bottomLeft = el('div', 'hud-bottom-left', root);
  const speed = el('div', 'hud-speed', bottomLeft);
  const hint = el('div', 'hud-hint', bottomLeft);
  const minimap = document.createElement('canvas');
  minimap.className = 'hud-minimap';
  minimap.width = 190;
  minimap.height = 190;
  root.appendChild(minimap);
  const toasts = el('div', 'hud-toasts', root);
  const panel = el('div', 'hud-panel', root);
  const panelTitle = el('h1', '', panel);
  const panelLines = el('div', 'hud-panel-lines', panel);
  const panelPrompt = el('div', 'hud-panel-prompt', panel);

  let toastTimer = 0;

  function showToast(text) {
    toasts.textContent = text;
    toasts.classList.add('show');
    toastTimer = 3.2;
  }

  function drawMinimap(G) {
    const ctx = minimap.getContext('2d');
    const S = 190;
    const scale = S / 480;
    const toX = (x) => (x + 240) * scale;
    const toZ = (z) => (z + 240) * scale;
    ctx.fillStyle = '#10141c';
    ctx.fillRect(0, 0, S, S);
    // Beach and sea.
    ctx.fillStyle = '#e8cf9a';
    ctx.fillRect(0, toZ(210), S, S - toZ(210));
    ctx.fillStyle = '#1e6f7a';
    ctx.fillRect(0, toZ(252), S, S - toZ(252));
    // Roads.
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 5;
    for (let c = -210; c <= 210; c += 60) {
      ctx.beginPath();
      ctx.moveTo(toX(c), 0);
      ctx.lineTo(toX(c), S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toZ(c));
      ctx.lineTo(S, toZ(c));
      ctx.stroke();
    }
    // Stash crates.
    ctx.fillStyle = '#2ecc71';
    for (const stash of G.stashes) {
      if (!stash.found) ctx.fillRect(toX(stash.x) - 2, toZ(stash.z) - 2, 4, 4);
    }
    // Traffic.
    ctx.fillStyle = '#d8d8d8';
    for (const car of G.traffic) ctx.fillRect(toX(car.x) - 2, toZ(car.z) - 2, 4, 4);
    // Police.
    ctx.fillStyle = '#ff4444';
    for (const car of G.policeCars) {
      ctx.beginPath();
      ctx.arc(toX(car.x), toZ(car.z), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Mission beacon.
    const target = G.missionTarget;
    if (target) {
      ctx.fillStyle = '#ff4fa3';
      ctx.beginPath();
      ctx.arc(toX(target.x), toZ(target.z), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff4fa3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(toX(target.x), toZ(target.z), 8 + Math.sin(G.time * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // The player: a white arrow that turns with them.
    const p = G.player;
    ctx.save();
    ctx.translate(toX(p.x), toZ(p.z));
    ctx.rotate(Math.atan2(Math.sin(p.angle), Math.cos(p.angle)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North edge: the view frame.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  }

  function draw(G, screen, objectiveText) {
    const p = G.player;
    cash.textContent = `$${Math.floor(p.cash).toLocaleString('en-US')}`;
    objective.textContent = objectiveText;
    district.textContent = districtAt(p.x, p.z);
    stars.textContent = '★'.repeat(G.stars) + '☆'.repeat(5 - G.stars);
    stars.classList.toggle('hot', G.stars > 0);
    healthFill.style.width = `${Math.max(0, p.health)}%`;
    healthFill.classList.toggle('low', p.health < 30);
    ammo.textContent = p.onFoot ? `Ammo ${p.ammo} / ${PLAYER.pistolAmmo}` : '';
    speed.textContent = p.car ? `${Math.round(Math.abs(p.car.speed) * 3.6)} km/h` : (p.moving ? 'On foot' : '');
    hint.textContent = p.onFoot ? 'WASD move · Shift run · E enter car · F punch · Click shoot · R reload' : 'WASD drive · Space handbrake · E exit car · P pause';
    drawMinimap(G);
    if (toastTimer > 0) {
      toastTimer -= 1 / 60;
      if (toastTimer <= 0) toasts.classList.remove('show');
    }
    if (screen === 'title') {
      panel.classList.add('show');
      panelTitle.textContent = 'VELMARA';
      panelLines.innerHTML = 'A sun-soaked coastal city. Drive, steal, run jobs for Mara Voss —<br>and stay ahead of the Velmara PD.<br><br>WASD move / drive · E enter car · F punch · Click shoot · P pause';
      panelPrompt.textContent = 'Press Enter to start';
    } else if (screen === 'paused') {
      panel.classList.add('show');
      panelTitle.textContent = 'PAUSED';
      panelLines.innerHTML = 'The city waits for you.';
      panelPrompt.textContent = 'Press P to resume';
    } else if (screen === 'busted') {
      panel.classList.add('show');
      panelTitle.textContent = 'BUSTED';
      panelLines.innerHTML = 'The Velmara PD caught up with you.<br>You wake at St. Anselm Hospital, a fifth of your cash lighter.';
      panelPrompt.textContent = 'Press Enter to get back out there';
    } else if (screen === 'wasted') {
      panel.classList.add('show');
      panelTitle.textContent = 'WASTED';
      panelLines.innerHTML = 'Velmara is unforgiving.<br>You wake at St. Anselm Hospital, a fifth of your cash lighter.';
      panelPrompt.textContent = 'Press Enter to get back out there';
    } else {
      panel.classList.remove('show');
    }
  }

  function save(G) {
    try {
      const data = {
        cash: G.player.cash,
        missionIndex: G.missionIndex,
        stashes: G.stashes.map((s) => s.found),
        best: G.best,
      };
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage can be off: the game still plays, it just does not save.
    }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function loadBest() {
    try {
      return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch {
      // Storage can be off.
    }
  }

  return { draw, showToast, save, load, loadBest, saveBest };
}
