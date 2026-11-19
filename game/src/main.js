// main.js: boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between five screens: title, play, paused, busted, wasted.
//
// ?seed=N fixes the city's seed. ?shot=cover|chase|mission|city (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_RELOAD, ACTION_MUTE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { setMission } from './missions.js';

const MAX_FRAME = 0.25;

// Edge-triggered actions (enter car, punch, reload, pause, mute) fire once
// per frame: the fixed-step loop runs several steps per frame, and passing
// the same edge mask to every step would enter and exit the car once per
// step instead of once per press. (The pistol is safe already: the mouse
// edge is consumed by input.fireEdge() on its first call.)
const EDGE_ACTIONS = ACTION_ENTER | ACTION_PUNCH | ACTION_RELOAD | ACTION_PAUSE | ACTION_MUTE;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);
const G = createWorld(seed, renderer.scene);
G.best = hud.loadBest();
// A debug handle for playtests: the world state, readable from the console.
window.__velmara = G;

function applySave(save) {
  if (!save) return;
  G.player.cash = typeof save.cash === 'number' ? save.cash : G.player.cash;
  if (typeof save.missionIndex === 'number' && save.missionIndex > 0 && save.missionIndex < 6) {
    setMission(G, save.missionIndex, 0);
  }
  if (Array.isArray(save.stashes)) {
    save.stashes.forEach((found, i) => {
      if (found && G.stashes[i]) {
        G.stashes[i].found = true;
        G.stashes[i].mesh.visible = false;
      }
    });
  }
  if (typeof save.best === 'number') G.best = Math.max(G.best, save.best);
}

function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'shot') audio.shot();
    else if (event.type === 'punch') audio.punch();
    else if (event.type === 'cash') {
      audio.cash();
      hud.showToast(event.text);
    } else if (event.type === 'mission-complete') {
      audio.fanfare();
      hud.showToast(`${event.title} complete — +$${event.reward}`);
      hud.save(G);
    } else if (event.type === 'toast') hud.showToast(event.text);
    else if (event.type === 'busted') audio.busted();
    else if (event.type === 'hurt') audio.punch();
  }
}

function runShot(name) {
  const staged = stageShot(name, G, stepWorld);
  let painted = 0;
  function paint() {
    renderer.draw(G, staged.screen);
    hud.draw(G, staged.screen, G.objective);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  applySave(hud.load());
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing. Mara Voss has work for you.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
    if (actions & ACTION_CONFIRM && screen !== SCREEN_PLAY) {
      if (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED) startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    // Camera orbit with the mouse drag.
    const drag = input.takeDrag();
    if (drag !== 0 && screen === SCREEN_PLAY) {
      G.cameraYaw += drag * 0.004;
    }
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += frameDt;
    last = now;
    if (screen === SCREEN_PLAY || screen === SCREEN_TITLE) {
      let stepActions = actions;
      while (accumulator >= STEP) {
        const events = stepWorld(G, input, screen === SCREEN_PLAY ? stepActions : 0, STEP);
        stepActions = actions & ~EDGE_ACTIONS;
        if (screen === SCREEN_PLAY) {
          handleEvents(events);
          for (const event of events) {
            if (event.type === 'busted') {
              screen = SCREEN_BUSTED;
              announce('Busted.');
            } else if (event.type === 'wasted') {
              screen = SCREEN_WASTED;
              announce('Wasted.');
            }
          }
        }
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY && screen !== SCREEN_TITLE) break;
      }
    } else {
      accumulator = 0;
    }
    // Sound follows the car and the heat.
    if (screen === SCREEN_PLAY) {
      if (G.player.car) audio.engine(Math.abs(G.player.car.speed) / 34);
      else audio.engineOff();
      if (G.stars > 0) audio.siren(true, G.time);
      else audio.sirenOff();
    } else {
      audio.engineOff();
      audio.sirenOff();
    }
    saveTimer += 1 / 60;
    if (saveTimer > 15) {
      saveTimer = 0;
      if (screen === SCREEN_PLAY) {
        G.best = Math.max(G.best, G.player.cash);
        hud.saveBest(G.best);
        hud.save(G);
      }
    }
    renderer.draw(G, screen, frameDt);
    hud.draw(G, screen, G.objective);
    if (!window.__gameReady) window.__gameReady = true;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Velmara. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
