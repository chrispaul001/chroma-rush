import { createGame, hashSeed, updateGame } from './src/core.mjs';
import { createRenderer } from './src/render.mjs';
import { attachControls } from './src/controls.mjs';

const canvas = document.querySelector('#game');
const utcDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const seed = hashSeed(`chroma-rush:${utcDay}`);
const bestKey = 'chroma-rush-best-v2';
let best = 0;
try { best = Number(localStorage.getItem(bestKey)) || 0; } catch { /* storage may be disabled */ }
const game = createGame(seed, { best });
const renderer = createRenderer(canvas, utcDay.replaceAll('-', '.'));
let audio = null, last = performance.now(), previousScreen = game.screen;
const announce = document.querySelector('#announce');

function tone(frequency, duration, type = 'sine', volume = .06, when = 0) {
  if (game.muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const start = audio.currentTime + when;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + duration + .02);
  } catch { /* audio is optional */ }
}
function sound(event) {
  if (event === 'start' || event === 'resume') { tone(440, .13, 'triangle', .045); tone(660, .18, 'triangle', .04, .07); }
  else if (event === 'rotate') tone(220, .055, 'triangle', .022);
  else if (event === 'pause') tone(180, .12, 'sine', .035);
  else if (event === 'mute') { if (!game.muted) tone(780, .08, 'sine', .03); }
}
attachControls(canvas, game, renderer, (event) => { sound(event); announce.textContent = event === 'rotate' ? 'Prism rotated.' : event === 'pause' ? 'Game paused.' : event === 'resume' ? 'Game resumed.' : event === 'start' ? 'Game started.' : event === 'menu' ? 'Returned to the main menu.' : ''; });

function frame(now) {
  const dt = Math.min((now - last) / 1000, .05); last = now;
  const oldScore = game.score, oldShields = game.shields, oldLevel = game.level, oldBanner = game.banner;
  updateGame(game, dt);
  if (game.score > oldScore) {
    try { localStorage.setItem(bestKey, String(game.best)); } catch { /* storage may be disabled */ }
    if (game.banner.startsWith('PERFECT')) { tone(660, .14, 'triangle', .06); tone(990, .2, 'sine', .045, .08); }
    else { tone(480, .13, 'triangle', .05); tone(720, .16, 'sine', .035, .07); }
  }
  if (game.screen === 'tutorial' && oldBanner !== game.banner && (game.banner.startsWith('PERFECT') || game.banner.startsWith('MATCH'))) {
    tone(game.banner.startsWith('PERFECT') ? 760 : 480, .16, 'triangle', .045);
  }
  if (game.shields < oldShields) { tone(125, .32, 'sawtooth', .07); tone(90, .28, 'triangle', .06, .08); }
  if (game.screen === 'tutorial' && oldBanner !== game.banner && game.banner === 'TURN TOWARD THE PULSE') tone(135, .22, 'sawtooth', .04);
  if (game.level > oldLevel && game.screen === 'playing') { tone(520, .16, 'triangle', .05); tone(780, .2, 'triangle', .05, .09); }
  if (game.screen !== previousScreen) {
    announce.textContent = game.screen === 'gameover' ? `Run ended. Score ${game.score}. Press space to restart.`
      : game.screen === 'playing' ? 'Run started. Match each incoming pulse to the prism facet facing its lane.'
      : game.screen === 'paused' ? 'Game paused.'
      : game.screen === 'tutorial' ? previousScreen === 'paused' ? 'Game resumed.' : 'Tutorial started. Rotate the prism to match the pulse.'
      : 'Title screen.';
    previousScreen = game.screen;
  }
  renderer.draw(game, now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

