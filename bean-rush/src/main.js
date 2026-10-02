// Boot: build the view, input, audio and game, then run the frame loop.

import { View } from './view.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { loadSave } from './save.js';
import { Game } from './game.js';

function fatal(msg) {
  const l = document.getElementById('loading');
  if (l) {
    l.classList.remove('done');
    l.innerHTML = `<div class="bean-ico"></div><div class="t" style="max-width:86vw;text-align:center;line-height:1.6">${msg}</div>`;
  }
}

function boot() {
  const save = loadSave();
  const app = document.getElementById('app');
  let view;
  try {
    view = new View(app, save.settings);
  } catch (e) {
    console.error(e);
    fatal('這個瀏覽器沒辦法顯示 3D 畫面（需要 WebGL）。<br>請改用最新版的 Chrome、Safari、Edge 或 Firefox。');
    return;
  }
  const input = new Input(app);
  const sound = new Sound();
  sound.setVolumes(save.settings.music, save.settings.sfx);
  const game = new Game(view, input, sound, save);
  window.__game = game; // handy for debugging from the console

  const onResize = () => view.resize();
  addEventListener('resize', onResize);
  if (window.visualViewport) visualViewport.addEventListener('resize', onResize);
  addEventListener('orientationchange', () => setTimeout(onResize, 250));
  const unlock = () => sound.unlock();
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);
  // block pinch-zoom / double-tap zoom on iOS
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  view.renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    fatal('畫面暫時中斷了，請重新整理頁面。');
  });

  game.enterLobby();

  let last = performance.now();
  let first = true;
  const loop = (now) => {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    if (dt <= 0) dt = 1 / 60;
    game.update(dt);
    if (first) {
      first = false;
      setTimeout(() => document.getElementById('loading').classList.add('done'), 150);
    }
  };
  requestAnimationFrame(loop);
}

// Give web fonts a moment (they're optional), then start.
const start = () => { try { boot(); } catch (e) { console.error(e); fatal('啟動時發生錯誤：' + (e && e.message ? e.message : e)); } };
if (document.fonts && document.fonts.ready) {
  let started = false;
  const go = () => { if (!started) { started = true; start(); } };
  document.fonts.ready.then(go);
  setTimeout(go, 1200);
} else start();
