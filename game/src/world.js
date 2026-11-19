// The game's rules and state, with no drawing and no browser in it: the player's paddle, the
// pool of falling blocks and coins, spawning, collisions, score, lives and level. step() advances
// one fixed step and returns what happened as bit flags, so the caller can react without the
// world knowing about screens or sound. Nothing here allocates after createWorld returns.
import { BLOCK, COIN, FIELD, LEVEL, LIVES, PLAYER, POOL_SIZE } from './config.js';

export const KIND_BLOCK = 0;
export const KIND_COIN = 1;

export const EVENT_HIT = 1;
export const EVENT_COIN = 2;
export const EVENT_OVER = 4;

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function createWorld(random) {
  const player = { x: 0, y: FIELD.groundY - PLAYER.height, width: PLAYER.width, height: PLAYER.height, invulnerable: 0 };
  const items = [];
  for (let index = 0; index < POOL_SIZE; index += 1) {
    items.push({ active: false, kind: KIND_BLOCK, x: 0, y: 0, width: 0, height: 0, speed: 0 });
  }
  const state = { player, items, score: 0, lives: LIVES, level: 1, elapsed: 0, blockTimer: 0, coinTimer: 0 };

  function reset() {
    player.x = (FIELD.width - player.width) / 2;
    player.invulnerable = 0;
    for (const item of items) item.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.blockTimer = BLOCK.interval;
    state.coinTimer = COIN.interval;
  }

  function freeItem() {
    for (let index = 0; index < items.length; index += 1) if (!items[index].active) return items[index];
    return null;
  }

  function spawnBlock() {
    const item = freeItem();
    if (item === null) return;
    item.active = true;
    item.kind = KIND_BLOCK;
    item.width = BLOCK.minWidth + random() * (BLOCK.maxWidth - BLOCK.minWidth);
    item.height = BLOCK.height;
    item.x = random() * (FIELD.width - item.width);
    item.y = -item.height;
    item.speed = BLOCK.speed + BLOCK.speedPerLevel * (state.level - 1) + random() * BLOCK.speedJitter;
  }

  function spawnCoin() {
    const item = freeItem();
    if (item === null) return;
    item.active = true;
    item.kind = KIND_COIN;
    item.width = COIN.size;
    item.height = COIN.size;
    item.x = random() * (FIELD.width - item.width);
    item.y = -item.height;
    item.speed = COIN.speed + COIN.speedPerLevel * (state.level - 1);
  }

  function blockInterval() {
    return Math.max(BLOCK.minInterval, BLOCK.interval * BLOCK.intervalScale ** (state.level - 1));
  }

  /**
   * One fixed step. `direction` is -1, 0 or 1 (left, still, right). With `harmless` set (the title
   * screen's backdrop) things fall but nothing touches the player and nothing scores.
   */
  function step(dt, direction, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));

    player.x = Math.min(FIELD.width - player.width, Math.max(0, player.x + direction * PLAYER.speed * dt));
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

    state.blockTimer -= dt;
    if (state.blockTimer <= 0) {
      spawnBlock();
      state.blockTimer += blockInterval();
    }
    state.coinTimer -= dt;
    if (state.coinTimer <= 0) {
      spawnCoin();
      state.coinTimer += COIN.interval + random() * COIN.intervalJitter;
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!item.active) continue;
      item.y += item.speed * dt;
      if (item.y > FIELD.groundY) {
        item.active = false;
        if (item.kind === KIND_BLOCK && !harmless) state.score += BLOCK.dodgePoints;
        continue;
      }
      if (harmless || !overlaps(item, player)) continue;
      if (item.kind === KIND_COIN) {
        item.active = false;
        state.score += COIN.points;
        events |= EVENT_COIN;
      } else if (player.invulnerable === 0) {
        item.active = false;
        state.lives -= 1;
        player.invulnerable = PLAYER.invulnerable;
        events |= EVENT_HIT;
        if (state.lives === 0) {
          events |= EVENT_OVER;
          break;
        }
      }
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
