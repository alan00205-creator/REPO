// Local progress + settings. Every storage access is guarded: private mode or blocked
// storage simply means progress isn't kept between visits.

import { DEFAULT_LOOK } from './cosmetics.js';

const KEY = 'beanrush.v1';

export const DEFAULTS = {
  name: '',
  coins: 0,
  crowns: 0,
  shows: 0,
  finals: 0,
  bestRound: 0,
  qualifies: 0,
  owned: [],
  look: { ...DEFAULT_LOOK },
  settings: { music: 0.6, sfx: 0.85, quality: 'auto', sens: 1, invertY: false, fps: false, vibrate: true },
  tutorial: false,
  played: {},
};

export function loadSave() {
  let data = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = JSON.parse(raw);
  } catch (_) {
    data = null;
  }
  const s = JSON.parse(JSON.stringify(DEFAULTS));
  if (data && typeof data === 'object') {
    Object.assign(s, data);
    s.look = { ...DEFAULTS.look, ...(data.look || {}) };
    s.settings = { ...DEFAULTS.settings, ...(data.settings || {}) };
    if (!Array.isArray(s.owned)) s.owned = [];
  }
  return s;
}

export function writeSave(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch (_) {
    return false;
  }
}
