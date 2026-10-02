// 地板消消樂 — final: a 9×9 floor where tiles blink and vanish in random waves that come
// faster and faster. Last bean standing wins.

import { steer } from '../ai.js';
import { TAU, clamp } from '../util.js';

const N = 9;
const SIZE = 2.5;
const PITCH = 2.64;
const H = 0.7;
const WARN = 1.4;
const pos = (i) => -((N - 1) / 2) * PITCH + i * PITCH;
const PALETTE = ['#ff9ad5', '#ffd84d', '#8fe3ff', '#a8f0b8', '#c9b3ff'];

export default {
  id: 'floor',
  name: '地板消消樂',
  en: 'FLOOR FADE',
  type: 'final',
  desc: '地板會一波一波閃爍、然後消失，越來越快！站在不閃的地板上，撐到最後就是冠軍。',
  tip: '開始閃的地板就快消失了，趕快換到旁邊。',
  sky: 'dusk',
  build({ kit: k, sim, rng }) {
    const tiles = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const t = { r, c, x: pos(c), z: pos(r), top: 0, state: 0, t: 0, vy: 0, flash: 0, gone: false, color: PALETTE[(r * 3 + c * 2) % PALETTE.length] };
        const body = k.body(t.x, -H / 2, t.z, {});
        k.addBox(body, 0, 0, 0, SIZE, H, SIZE, { look: false });
        t.body = body;
        tiles.push(t);
      }
    }
    k.scene((g) => g.gridTiles(tiles, SIZE, H));
    const at = (r, c) => (r >= 0 && c >= 0 && r < N && c < N ? tiles[r * N + c] : null);
    const tileAt = (x, z) => at(Math.round((z - pos(0)) / PITCH), Math.round((x - pos(0)) / PITCH));

    let timer = 4;
    let wave = 0;
    const L = {
      killY: -6,
      tiles,
      tileAt,
      at,
      checkpoints: [{ test: () => false, spawn: () => ({ x: 0, y: 0.1, z: 0, yaw: 0 }) }],
      spawns(n) {
        const out = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU, rr = n > 8 && i % 2 ? 3 : 6.5;
          out.push({ x: Math.cos(a) * rr, y: 0.05, z: Math.sin(a) * rr, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) });
        }
        return out;
      },
      safeSpawn(r2) {
        const ok = tiles.filter((t) => t.state === 0);
        const t = ok.length ? r2.pick(ok) : tiles[40];
        return { x: t.x, y: 0.1, z: t.z, yaw: 0 };
      },
      camYaw: () => null,
      camPitch: 0.62,
      camDist: 12,
      flyover: [
        [0, 22, 20, 0, 0, 0],
        [17, 8, 6, 0, 0, 0],
        [-12, 9, -14, 0, 0, 0],
      ],
      update(t, dt) {
        if (sim.phase === 'play') {
          timer -= dt;
          if (timer <= 0) {
            wave++;
            const pt = sim.t;
            const ok = tiles.filter((x) => x.state === 0);
            // late on, tiles go one at a time so the crowd thins out bean by bean;
            // the last tile only goes after about a minute
            const keep = pt < 62 ? 1 : 0;
            const n = ok.length <= 12 ? Math.min(1, ok.length - keep) : Math.min(ok.length - 12, 4 + Math.floor(wave * 0.45));
            rng.shuffle(ok);
            for (let i = 0; i < n; i++) { ok[i].state = 1; ok[i].t = 0; }
            if (n > 0) sim.emit('crack', null);
            timer = clamp(3.2 - pt * 0.03, 1.4, 3.2);
          }
        }
        for (const tl of tiles) {
          const b = tl.body;
          if (tl.state === 1) {
            tl.t += dt;
            tl.flash = Math.min(1, tl.t / WARN) * 0.9;
            if (tl.t > WARN) { tl.state = 2; tl.t = 0; tl.vy = 0; tl.flash = 0.3; sim.emit('tileFall', null, tl); }
          } else if (tl.state === 2) {
            tl.vy -= 26 * dt;
            b.pos.y += tl.vy * dt;
            b.vel.set(0, tl.vy, 0);
            b.shapes[0].enabled = b.pos.y > -H / 2 - 1;
            if (b.pos.y < -12) { tl.state = 3; tl.gone = true; b.enabled = false; }
          }
          tl.top = b.pos.y + H / 2;
        }
      },
      brain: (s, bean, skill) => new FloorBrain(s, bean, skill, L),
    };
    return L;
  },
};

class FloorBrain {
  constructor(sim, bean, skill, L) {
    this.sim = sim;
    this.b = bean;
    this.skill = skill;
    this.L = L;
    this.rng = sim.rng;
    this.goal = null;
    this.react = 0.1 + (1 - skill) * 0.45;
    this.alarm = 0;
  }
  onRespawn() {}
  score(t) {
    const L = this.L;
    let s = 0;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = L.at(t.r + dr, t.c + dc);
      if (n && n.state === 0) s++;
    }
    return s;
  }
  pick() {
    const b = this.b, L = this.L, rng = this.rng;
    let best = null, bs = -1e9;
    for (const t of L.tiles) {
      if (t.state !== 0) continue;
      const d = Math.hypot(t.x - b.pos.x, t.z - b.pos.z);
      if (d > 9) continue;
      const s = this.score(t) * (0.5 + this.skill * 0.5) - d * 0.35 - Math.hypot(t.x, t.z) * 0.05 + rng() * (1.2 - this.skill * 0.6);
      if (s > bs) { bs = s; best = t; }
    }
    this.goal = best;
  }
  think(dt) {
    const b = this.b, L = this.L;
    if (b.frozen) { b.mx = b.mz = 0; return; }
    const here = L.tileAt(b.pos.x, b.pos.z);
    // notice a blinking tile (ours or the goal) after a short reaction time
    const threatened = (here && here.state !== 0) || (this.goal && this.goal.state !== 0);
    if (threatened) this.alarm += dt; else this.alarm = 0;
    if (!this.goal || this.goal.state >= 2 || this.alarm > this.react) { this.pick(); this.alarm = 0; }
    if (!this.goal) { b.mx *= 0.9; b.mz *= 0.9; return; }
    const d = steer(b, this.goal.x, this.goal.z, 1, 0.5);
    // a hole between us and the goal: hop it
    if (b.grounded && b.state === 'normal' && d > 1) {
      const ux = (this.goal.x - b.pos.x) / d, uz = (this.goal.z - b.pos.z) / d;
      const ahead = L.tileAt(b.pos.x + ux * 1.1, b.pos.z + uz * 1.1);
      if (!ahead || ahead.state >= 2) b.jumpPressed = true;
    }
  }
}
