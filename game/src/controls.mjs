import { rotate, setPaused, startGame, startRun, returnToMenu, restartGame, toggleMute } from './core.mjs';

export function attachControls(canvas, game, renderer, emit) {
  function act(action) { emit(action); }
  function togglePause() {
    if (game.screen === 'paused') { setPaused(game, false); act('resume'); }
    else if (['tutorial', 'playing'].includes(game.screen)) { setPaused(game, true); act('pause'); }
  }
  function menu() { returnToMenu(game); act('menu'); }
  function keydown(event) {
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', ' ', 'enter'].includes(key)) event.preventDefault();
    if (key === 'a' || key === 'arrowleft') { if (rotate(game, -1)) act('rotate'); }
    else if (key === 'd' || key === 'arrowright') { if (rotate(game, 1)) act('rotate'); }
    else if (key === 'm') { toggleMute(game); act('mute'); }
    else if (key === 'q' && game.screen !== 'title') menu();
    else if (key === 'p' || key === 'escape') togglePause();
    else if (key === 'r' && ['paused', 'playing', 'tutorial', 'gameover'].includes(game.screen)) {
      if (game.screen === 'tutorial' || (game.screen === 'paused' && game.resumeScreen === 'tutorial')) restartGame(game);
      else startRun(game);
      act('start');
    } else if ((key === ' ' || key === 'enter') && game.screen === 'title') { startGame(game); act('start'); }
    else if (key === 'j' && game.screen === 'title') { startRun(game); act('start'); }
    else if ((key === ' ' || key === 'enter') && game.screen === 'paused') { setPaused(game, false); act('resume'); }
    else if ((key === ' ' || key === 'enter') && game.screen === 'gameover') { startRun(game); act('start'); }
  }
  function pointerdown(event) {
    const p = renderer.point(event.clientX, event.clientY);
    if (p.y < 95) {
      if (game.screen === 'title' && p.x >= 1440) { toggleMute(game); act('mute'); return; }
      if (game.screen !== 'title' && p.x >= 1440) { menu(); return; }
      if (game.screen !== 'title' && p.x >= 1340) { togglePause(); return; }
      if (p.x >= 1240 && p.x < 1340) { toggleMute(game); act('mute'); return; }
    }
    if (game.screen === 'title') {
      if (p.x >= 181 && p.x <= 473 && p.y >= 660 && p.y <= 706) { startRun(game); act('start'); }
      else { startGame(game); act('start'); }
      return;
    }
    if (game.screen === 'paused') {
      if (p.x >= 646 && p.x <= 954 && p.y >= 515 && p.y <= 569) { setPaused(game, false); act('resume'); }
      else if (p.x >= 700 && p.x <= 900 && p.y >= 582 && p.y <= 625) menu();
      return;
    }
    if (game.screen === 'gameover') {
      if (p.x >= 620 && p.x <= 810 && p.y >= 589 && p.y <= 637) { startRun(game); act('start'); }
      else if (p.x >= 830 && p.x <= 980 && p.y >= 589 && p.y <= 637) menu();
      return;
    }
    if (p.x < 480 || p.x > 1120 || p.y < 150 || p.y > 790) return;
    if (p.x < 800) { if (rotate(game, -1)) act('rotate'); }
    else if (rotate(game, 1)) act('rotate');
  }
  function pointermove(event) {
    const p = renderer.point(event.clientX, event.clientY);
    const topButton = p.y < 95 && (game.screen === 'title' ? p.x >= 1440 : p.x >= 1240);
    const titleAction = game.screen === 'title';
    const overlayAction = game.screen === 'paused' || game.screen === 'gameover';
    const arenaAction = ['tutorial', 'playing'].includes(game.screen) && p.x >= 480 && p.x <= 1120 && p.y >= 150 && p.y <= 790;
    canvas.style.cursor = topButton || titleAction || overlayAction || arenaAction ? 'pointer' : 'default';
  }
  window.addEventListener('keydown', keydown);
  canvas.addEventListener('pointerdown', pointerdown);
  canvas.addEventListener('pointermove', pointermove);
  return () => { window.removeEventListener('keydown', keydown); canvas.removeEventListener('pointerdown', pointerdown); canvas.removeEventListener('pointermove', pointermove); };
}
