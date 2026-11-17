export const FACETS = [
  { name: 'SOL', color: '#ffd166', symbol: '◆' },
  { name: 'MINT', color: '#4de0bf', symbol: '●' },
  { name: 'IRIS', color: '#a88bff', symbol: '▲' },
  { name: 'CORAL', color: '#ff718b', symbol: '■' },
];

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const difficultyAt = (seconds) => {
  const minutes = Math.max(0, seconds) / 60;
  return {
    level: 1 + Math.floor(minutes / 0.75),
    interval: clamp(1.42 - minutes * 0.19, 0.66, 1.42),
    travel: clamp(3.25 - minutes * 0.30, 1.72, 3.25),
  };
};

export function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hashSeed = (text) => {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return hash >>> 0;
};

export function createGame(seed = 1, { best = 0 } = {}) {
  return {
    seed: seed >>> 0,
    random: createRandom(seed),
    screen: 'title',
    resumeScreen: 'playing',
    time: 0,
    elapsed: 0,
    rotation: 0,
    rotationTarget: 0,
    visualRotation: 0,
    visualRotationVelocity: 0,
    lastRotateAt: -10,
    score: 0,
    best,
    combo: 0,
    bestCombo: 0,
    shields: 3,
    level: 1,
    spawnIn: 0,
    tutorialHits: 0,
    tutorialMisses: 0,
    pulses: [],
    effects: [],
    pulseId: 0,
    muted: false,
    shake: 0,
    banner: '',
    bannerTime: 0,
  };
}

export function faceAtLane(lane, rotation) {
  return (lane - rotation + 4) % 4;
}

export function startGame(game) {
  if (game.screen === 'gameover') return startRun(game);
  if (game.screen !== 'title') return;
  const fresh = createGame(game.seed, { best: game.best });
  fresh.muted = game.muted;
  Object.assign(game, fresh);
  game.screen = 'tutorial';
  game.spawnIn = 0.62;
  game.banner = 'FOLLOW THE PULSE';
  game.bannerTime = 1.3;
}

export function startRun(game) {
  if (!['title', 'tutorial', 'playing', 'paused', 'gameover'].includes(game.screen)) return;
  const fresh = createGame(game.seed, { best: game.best });
  fresh.muted = game.muted;
  Object.assign(game, fresh);
  game.screen = 'playing';
  game.spawnIn = 0.62;
  game.banner = 'RUN STARTED';
  game.bannerTime = 1.1;
}

export function returnToMenu(game) {
  const fresh = createGame(game.seed, { best: game.best });
  fresh.muted = game.muted;
  Object.assign(game, fresh);
}

export function restartGame(game) {
  const fresh = createGame(game.seed, { best: game.best });
  Object.assign(game, fresh);
  startGame(game);
}

export function rotate(game, direction) {
  if (!['tutorial', 'playing'].includes(game.screen)) return false;
  const step = Math.sign(direction);
  if (!step) return false;
  game.rotation = (game.rotation + step + 4) % 4;
  game.rotationTarget += step;
  game.lastRotateAt = game.time;
  return true;
}

export function setPaused(game, paused = true) {
  if (paused && ['tutorial', 'playing'].includes(game.screen)) {
    game.resumeScreen = game.screen;
    game.screen = 'paused';
  } else if (!paused && game.screen === 'paused') {
    game.screen = game.resumeScreen;
  }
}

export function toggleMute(game) { game.muted = !game.muted; }

function addPulse(game, lane, face, travel, tutorial = false) {
  game.pulses.push({
    id: ++game.pulseId, lane, face, progress: 0, age: 0, travel,
    tutorial, perfect: 0.14, collision: 1,
  });
}

function spawnTutorialPulse(game) {
  const lane = [3, 1][game.tutorialHits % 2];
  const direction = [1, -1][game.tutorialHits % 2];
  const desiredRotation = (game.rotation + direction + 4) % 4;
  const face = faceAtLane(lane, desiredRotation);
  addPulse(game, lane, face, 3.2, true);
}

function spawnPulse(game) {
  const lane = Math.floor(game.random() * 4);
  const face = Math.floor(game.random() * 4);
  const { travel } = difficultyAt(game.elapsed);
  addPulse(game, lane, face, travel);
}

function burst(game, pulse, success) {
  const count = success ? 18 : 12;
  for (let i = 0; i < count; i++) {
    const angle = game.random() * Math.PI * 2;
    const speed = 40 + game.random() * 175;
    game.effects.push({ x: 0, y: 0, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 0.45 + game.random() * 0.5, maxLife: 0.95, color: FACETS[pulse.face].color, size: 2 + game.random() * 4 });
  }
}

function resolvePulse(game, pulse) {
  const correct = faceAtLane(pulse.lane, game.rotation) === pulse.face;
  burst(game, pulse, correct);
  if (correct) {
    const perfect = game.time - game.lastRotateAt <= pulse.perfect;
    if (game.screen === 'tutorial') {
      game.banner = perfect ? 'PERFECT  ·  CLEAN TURN' : 'MATCH  ·  WELL DONE';
      game.bannerTime = 0.82;
      game.shake = perfect ? 0.10 : 0.035;
      game.tutorialHits++;
      if (game.tutorialHits >= 2) {
        game.screen = 'playing';
        game.elapsed = 0;
        game.spawnIn = 0.6;
        game.score = 0;
        game.combo = 0;
        game.banner = 'RUN STARTED';
        game.bannerTime = 1.2;
      } else {
        game.spawnIn = 0.6;
      }
    } else {
      game.combo++;
      game.bestCombo = Math.max(game.bestCombo, game.combo);
      const multiplier = Math.min(8, 1 + Math.floor(game.combo / 4));
      const points = (perfect ? 150 : 100) * multiplier;
      game.score += points;
      game.best = Math.max(game.best, game.score);
      game.banner = perfect ? `PERFECT  +${points}` : `MATCH  +${points}`;
      game.bannerTime = 0.82;
      game.shake = perfect ? 0.10 : 0.035;
    }
  } else if (game.screen === 'tutorial') {
    game.tutorialMisses++;
    game.banner = 'TURN TOWARD THE PULSE';
    game.bannerTime = 1;
    game.spawnIn = 0.75;
  } else {
    game.shields--;
    game.combo = 0;
    game.shake = 0.22;
    game.banner = game.shields ? `SHIELD HIT  ·  ${game.shields} LEFT` : 'PRISM SHATTERED';
    game.bannerTime = 1.15;
    if (game.shields <= 0) game.screen = 'gameover';
  }
}

export function updateGame(game, dt) {
  if (!Number.isFinite(dt) || dt <= 0 || game.screen === 'paused' || ['title', 'gameover'].includes(game.screen)) return;
  const step = Math.min(dt, 0.05);
  const motionStep = Math.min(dt, 0.1);
  game.time += step;
  game.elapsed += game.screen === 'playing' ? step : 0;
  // Follow the unwrapped turn target with a critically damped spring. Reversals
  // during an animation stay continuous, and rapid input is never discarded.
  const omega = 36;
  const offset = game.visualRotation - game.rotationTarget;
  const decay = Math.exp(-omega * motionStep);
  const helper = (game.visualRotationVelocity + omega * offset) * motionStep;
  const nextOffset = (offset + helper) * decay;
  game.visualRotationVelocity = (game.visualRotationVelocity - omega * helper) * decay;
  game.visualRotation = game.rotationTarget + nextOffset;
  if (Math.abs(nextOffset) < 0.0005 && Math.abs(game.visualRotationVelocity) < 0.01) {
    game.visualRotation = game.rotationTarget;
    game.visualRotationVelocity = 0;
  }
  game.shake = Math.max(0, game.shake - step);
  game.bannerTime = Math.max(0, game.bannerTime - step);
  game.effects = game.effects.filter((p) => p.life > 0);
  for (const p of game.effects) {
    p.x += p.vx * step; p.y += p.vy * step; p.life -= step; p.vx *= 0.97; p.vy *= 0.97;
  }
  for (const pulse of game.pulses) {
    pulse.age += step;
    pulse.progress += step / pulse.travel;
  }
  const resolved = game.pulses.filter((p) => p.progress >= 1);
  game.pulses = game.pulses.filter((p) => p.progress < 1);
  for (const pulse of resolved) resolvePulse(game, pulse);
  if (game.screen === 'gameover') return;
  game.spawnIn -= step;
  if (game.spawnIn <= 0) {
    if (game.screen === 'tutorial') {
      if (game.pulses.length === 0) spawnTutorialPulse(game);
      game.spawnIn = 4.3;
    } else {
      spawnPulse(game);
      const { interval, level } = difficultyAt(game.elapsed);
      game.level = level;
      game.spawnIn += interval;
    }
  }
}

