// Small DOM helpers for screens, stamps, toasts and dialogs.

import { colorOf } from './cosmetics.js';

export const $ = (id) => document.getElementById(id);

const SCREENS = ['title', 'match', 'intro', 'results', 'elim', 'victory', 'showEnd', 'pause', 'confirm', 'practice', 'custom', 'settings', 'help'];

export function screen(id, on = true) {
  const el = $(id);
  if (!el) return;
  if (on) {
    el.hidden = false;
    // restart entrance animations
    el.querySelectorAll('.pop,.slideup').forEach((n) => { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; });
  } else el.hidden = true;
}

export function only(...ids) {
  for (const s of SCREENS) if (!ids.includes(s) && !['pause', 'confirm', 'settings', 'help'].includes(s)) $(s).hidden = true;
  for (const id of ids) screen(id, true);
}

export function anyDialogOpen() {
  return ['pause', 'confirm', 'settings', 'help', 'practice'].some((s) => !$(s).hidden);
}

let bigTimer = 0;
export function big(text, cls = '', sub = '', dur = 1600) {
  const el = $('big');
  clearTimeout(bigTimer);
  el.innerHTML = '';
  if (!text) return;
  const t = document.createElement('div');
  t.className = 't ' + cls;
  t.textContent = text;
  el.appendChild(t);
  if (sub) {
    const s = document.createElement('div');
    s.className = 'sub';
    s.textContent = sub;
    el.appendChild(s);
  }
  if (dur > 0) bigTimer = setTimeout(() => { el.innerHTML = ''; }, dur);
}

export function toast(text, dur = 2200) {
  const box = $('toasts');
  const d = document.createElement('div');
  d.textContent = text;
  box.appendChild(d);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { d.style.opacity = '0'; d.style.transform = 'translateY(-10px)'; }, dur);
  setTimeout(() => d.remove(), dur + 450);
}

export function feed(text, dur = 2600) {
  const box = $('feed');
  const d = document.createElement('div');
  d.textContent = text;
  box.appendChild(d);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { d.style.opacity = '0'; }, dur);
  setTimeout(() => d.remove(), dur + 450);
}

export function ask(title, text, yes = '確定', no = '取消') {
  return new Promise((res) => {
    $('cTitle').textContent = title;
    $('cText').textContent = text;
    $('cYes').textContent = yes;
    $('cNo').textContent = no;
    screen('confirm');
    const done = (v) => {
      $('confirm').hidden = true;
      $('cYes').onclick = $('cNo').onclick = null;
      res(v);
    };
    $('cYes').onclick = () => done(true);
    $('cNo').onclick = () => done(false);
  });
}

export function miniBean(look, cls = '') {
  const d = document.createElement('span');
  d.className = 'mini ' + cls;
  d.style.background = colorOf(look && look.color);
  return d;
}

export function setText(id, v) {
  const el = typeof id === 'string' ? $(id) : id;
  const s = String(v);
  if (el && el.textContent !== s) el.textContent = s;
}

const htmlCache = new Map();
export function setHTML(id, v) {
  if (htmlCache.get(id) === v) return;
  htmlCache.set(id, v);
  const el = $(id);
  if (el) el.innerHTML = v;
}

export const COIN_SVG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffd23f" stroke="#2b2d5c" stroke-width="2"/><ellipse cx="12" cy="12" rx="3.2" ry="5" fill="#ffb000" stroke="#2b2d5c" stroke-width="1.6"/></svg>';
export const CROWN_SVG = '<svg viewBox="0 0 24 24"><path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z" fill="#ffd23f" stroke="#2b2d5c" stroke-width="2" stroke-linejoin="round"/></svg>';
