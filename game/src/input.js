// input.js: keyboard and mouse. Held keys give a steering vector; one-shot
// presses (confirm, pause, enter car, punch, reload, mute) are queued as bit
// flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. The mouse aims the camera and fires the pistol.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_MUTE = 32;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const RELOAD = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseDownEdge = false;
  let dragDX = 0;
  let dragging = false;
  let lastX = 0;

  window.addEventListener('keydown', (event) => {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) ||
        RIGHT.has(event.code) || RUN.has(event.code) || BRAKE.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (RELOAD.has(event.code)) actions |= ACTION_RELOAD;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of all.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
    dragging = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseDownEdge = true;
    dragging = true;
    lastX = event.clientX;
    mouseX = event.clientX;
    mouseY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (dragging) {
      dragDX += event.clientX - lastX;
      lastX = event.clientX;
    }
  });
  canvas.addEventListener('pointerup', () => {
    mouseDown = false;
    dragging = false;
  });

  function has(keys) {
    for (const code of keys) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1 back, 1 forward, 0 neither (W/S or arrows). */
    throttle() {
      return (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0);
    },
    /** -1 left, 1 right, 0 neither (A/D or arrows). */
    steer() {
      return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    },
    run() {
      return has(RUN);
    },
    handbrake() {
      return has(BRAKE);
    },
    /** True only on the frame the mouse button went down. */
    fireEdge() {
      const edge = mouseDownEdge;
      mouseDownEdge = false;
      return edge;
    },
    firing() {
      return mouseDown;
    },
    /** Horizontal drag since last call, in pixels (orbits the camera). */
    takeDrag() {
      const dx = dragDX;
      dragDX = 0;
      return dx;
    },
    mouse() {
      return { x: mouseX, y: mouseY };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
