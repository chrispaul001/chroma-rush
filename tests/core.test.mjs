import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, difficultyAt, faceAtLane, restartGame, returnToMenu, rotate, setPaused, startGame, startRun, updateGame, FACETS } from '../game/src/core.mjs';

test('rotating the prism changes the face presented to an incoming lane', () => {
  assert.equal(FACETS[faceAtLane(0, 0)].name, 'SOL');
  const game = createGame(); startGame(game);
  assert.equal(rotate(game, 1), true);
  assert.equal(faceAtLane(0, game.rotation), 3);
  assert.equal(rotate(game, -1), true);
  assert.equal(game.rotation, 0);
});

test('turn animation eases to its target and stays continuous through rapid reversals', () => {
  const game = createGame(); startGame(game);
  rotate(game, 1);
  assert.equal(game.rotation, 1, 'matching state changes immediately');
  assert.equal(game.visualRotation, 0, 'visual rotation starts from its current position');
  updateGame(game, 1 / 60);
  assert.ok(game.visualRotation > 0 && game.visualRotation < 1, 'visible turn eases between positions');

  rotate(game, 1); rotate(game, -1); rotate(game, 1);
  const before = game.visualRotation;
  updateGame(game, 1 / 60);
  assert.ok(game.visualRotation > before, 'spring continues smoothly toward the accumulated target');
  assert.equal(game.rotationTarget, 2, 'rapid turns remain represented in the target');

  for (let i = 0; i < 60; i++) updateGame(game, 1 / 60);
  assert.ok(Math.abs(game.visualRotation - game.rotationTarget) < 0.001, 'animation settles exactly on target');
});

test('a correctly aligned pulse scores and builds a multiplier combo', () => {
  const game = createGame(5); game.screen = 'playing'; game.spawnIn = 50;
  game.pulses.push({ id: 1, lane: 0, face: faceAtLane(0, game.rotation), progress: 0.999, age: 3, travel: 1, tutorial: false, perfect: 0.14 });
  updateGame(game, 0.02);
  assert.equal(game.score, 100);
  assert.equal(game.combo, 1);
  assert.equal(game.shields, 3);
  for (let i = 0; i < 4; i++) {
    game.pulses.push({ id: i + 2, lane: 0, face: faceAtLane(0, game.rotation), progress: 0.999, age: 3, travel: 1, tutorial: false, perfect: 0.14 });
    updateGame(game, 0.02);
  }
  assert.equal(game.combo, 5);
  assert.equal(game.bestCombo, 5);
  assert.equal(game.score, 700);
});

test('a wrong facet consumes one shield and breaks the combo', () => {
  const game = createGame(); game.screen = 'playing'; game.spawnIn = 50; game.combo = 7; game.bestCombo = 7;
  game.pulses.push({ id: 1, lane: 0, face: (faceAtLane(0, game.rotation) + 1) % 4, progress: 0.999, age: 3, travel: 1, tutorial: false, perfect: 0.14 });
  updateGame(game, 0.02);
  assert.equal(game.shields, 2);
  assert.equal(game.combo, 0);
  assert.equal(game.bestCombo, 7, 'peak combo survives a shield hit');
  for (let i = 0; i < 2; i++) {
    game.pulses.push({ id: i + 2, lane: 0, face: (faceAtLane(0, game.rotation) + 1) % 4, progress: 0.999, age: 3, travel: 1, tutorial: false, perfect: 0.14 });
    updateGame(game, 0.02);
  }
  assert.equal(game.shields, 0);
  assert.equal(game.screen, 'gameover');
  assert.equal(game.bestCombo, 7, 'peak combo remains available on results');
});

test('tutorial starts in play and two correct practice hits enter the run', () => {
  const game = createGame(12); startGame(game);
  assert.equal(game.screen, 'tutorial');
  const until = (predicate) => {
    for (let i = 0; i < 1000 && !predicate(); i++) updateGame(game, 0.05);
    assert.ok(predicate(), 'expected tutorial to reach the next state');
  };
  until(() => game.pulses.some((pulse) => pulse.tutorial));
  const first = game.pulses.find((pulse) => pulse.tutorial);
  rotate(game, 1);
  until(() => game.tutorialHits === 1);
  assert.equal(game.tutorialHits, 1);
  until(() => game.pulses.some((pulse) => pulse.tutorial));
  const second = game.pulses.find((p) => p.tutorial);
  assert.ok(second);
  rotate(game, -1);
  until(() => game.screen === 'playing');
  assert.equal(game.screen, 'playing');
});

test('pause and resume preserve the current game screen', () => {
  const game = createGame(); startGame(game);
  setPaused(game); assert.equal(game.screen, 'paused');
  setPaused(game, false); assert.equal(game.screen, 'tutorial');
});

test('restart restores a fresh run without losing the supplied best score', () => {
  const game = createGame(22, { best: 900 }); startGame(game);
  game.screen = 'gameover'; game.score = 640; game.shields = 0; game.combo = 7;
  restartGame(game);
  assert.equal(game.screen, 'tutorial');
  assert.equal(game.score, 0);
  assert.equal(game.shields, 3);
  assert.equal(game.combo, 0);
  assert.equal(game.best, 900);
});

test('direct run skips training and main menu preserves best and mute settings', () => {
  const game = createGame(31, { best: 700 });
  game.muted = true;
  startRun(game);
  assert.equal(game.screen, 'playing');
  assert.equal(game.score, 0);
  assert.equal(game.combo, 0);
  assert.equal(game.shields, 3);
  assert.equal(game.pulses.length, 0);
  assert.equal(game.elapsed, 0);
  game.score = 120;
  returnToMenu(game);
  assert.equal(game.screen, 'title');
  assert.equal(game.score, 0);
  assert.equal(game.best, 700);
  assert.equal(game.muted, true);
  assert.equal(game.pulses.length, 0);
  startRun(game);
  assert.equal(game.screen, 'playing', 'players can start another direct run from the menu');
});

test('the same daily seed produces the same pulse pattern', () => {
  const a = createGame(0x92bc12), b = createGame(0x92bc12);
  a.screen = 'playing'; b.screen = 'playing';
  for (let i = 0; i < 250; i++) { updateGame(a, .05); updateGame(b, .05); }
  const pattern = (game) => game.pulses.map(({ lane, face, progress }) => [lane, face, Number(progress.toFixed(6))]);
  assert.deepEqual(pattern(a), pattern(b));
});

test('difficulty scales steadily without crossing readability floors', () => {
  const early = difficultyAt(0), late = difficultyAt(6000);
  assert.equal(early.interval, 1.42);
  assert.ok(late.interval >= 0.66);
  assert.ok(late.travel >= 1.72);
  assert.ok(late.level > early.level);
  assert.ok(difficultyAt(3600).interval < early.interval);
});

