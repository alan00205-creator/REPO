// 穿牆大挑戰 — survival: walls sweep across the stage. Slip through a hole, hop the low
// ones, or get shoved off the far edge.

import { steer } from '../ai.js';
import { clamp } from '../util.js';
import { LK } from './parts.js';

const HALF = 9; // stage half-size
const START_Z = -HALF - 2.5;
const END_Z = HALF + 3;
const WALL_H = 2.6;
const LOW_H = 0.55;
const WALL = { top: { t: 'plain', c: '#ffffff' }, side: { t: 'dots', c: '#7d6cf2', c2: '#9f92ff', s: 1.6 }, front: { t: 'dots', c: '#7d6cf2', c2: '#9f92ff', s: 1.6 } };
const LOW = { top: { t: 'plain', c: '#ffd84d' }, side: { t: 'hstripe', c: '#ff5fa2', c2: '#ffffff', s: 0.5 }, front: { t: 'hstripe', c: '#ff5fa2', c2: '#ffffff', s: 0.5 } };

export default {
  id: 'walls',
  name: '穿牆大挑戰',
  en: 'WALL DASH',
  type: 'survival',
  desc: '一道道牆從對面推過來！找到牆上的洞鑽過去，矮牆就跳過去，被推下台就淘汰。',
  tip: '牆還遠的時候就先移到洞的前面。',
  sky: 'day',
  build({ kit: k, sim, rng }) {
    k.box(0, -0.6, 0, HALF * 2, 1.2, HALF * 2, { look: { top: { t: 'grid', c: '#bff3dc', c2: '#a6e9cb', s: 3 }, side: { t: 'hstripe', c: '#5cc9a7', c2: '#ffffff', s: 0.8 } } });
    // gates the walls come out of / disappear into
    k.deco(null, (b) => {
      for (const z of [START_Z - 0.5, END_Z + 0.5]) {
        b.boxAt(-HALF - 0.8, 2, z, 0.8, 4, 0.8, LK.post);
        b.boxAt(HALF + 0.8, 2, z, 0.8, 4, 0.8, LK.post);
        b.boxAt(0, 4.3, z, HALF * 2 + 2.4, 0.7, 0.8, { t: 'hstripe', c: '#ffd84d', c2: '#ffffff', s: 1 });
      }
    });

    // a pool of walls, each with its own hole layout
    const walls = [];
    const make = (kind) => {
      const body = k.body(0, 0, -60, { ground: false });
      const holes = [];
      if (kind === 'low') {
        k.addBox(body, 0, LOW_H / 2, 0, HALF * 2, LOW_H, 0.5, { look: LOW });
      } else {
        const n = rng() < 0.7 ? 1 : 2;
        const w = 2.5;
        let cuts = [];
        for (let i = 0; i < n; i++) {
          let c;
          for (let tries = 0; tries < 20; tries++) {
            c = rng.range(-HALF + w / 2 + 0.4, HALF - w / 2 - 0.4);
            if (cuts.every((o) => Math.abs(o - c) > w + 1.5)) break;
          }
          cuts.push(c);
        }
        cuts.sort((a, b) => a - b);
        let x = -HALF;
        for (const c of cuts) {
          const x0 = c - w / 2;
          if (x0 - x > 0.05) k.addBox(body, (x + x0) / 2, WALL_H / 2, 0, x0 - x, WALL_H, 1, { look: WALL });
          holes.push(c);
          x = c + w / 2;
        }
        if (HALF - x > 0.05) k.addBox(body, (x + HALF) / 2, WALL_H / 2, 0, HALF - x, WALL_H, 1, { look: WALL });
      }
      body.enabled = false;
      body.hidden = true;
      const w = { body, kind, holes, live: false, z: -60, mirror: 1 };
      walls.push(w);
      return w;
    };
    for (let i = 0; i < 9; i++) make('gap');
    for (let i = 0; i < 3; i++) make('low');

    let speed = 3.4;
    let timer = 1.0;
    let lastKind = '';
    const launch = () => {
      const pool = walls.filter((w) => !w.live && (lastKind !== 'low' || w.kind !== 'low'));
      const lows = pool.filter((w) => w.kind === 'low');
      const w = lows.length && rng() < 0.3 ? rng.pick(lows) : rng.pick(pool.filter((x) => x.kind !== 'low')) || rng.pick(pool);
      if (!w) return;
      lastKind = w.kind;
      w.live = true;
      w.z = START_Z;
      w.mirror = rng() < 0.5 ? 1 : -1;
      w.body.quat.set(0, w.mirror < 0 ? 1 : 0, 0, w.mirror < 0 ? 0 : 1); // flip holes left/right
      w.body.enabled = true;
      w.body.hidden = false;
      w.body.pos.set(0, 0, w.z);
      w.body.prevPos.copy(w.body.pos);
      w.body.prevQuat.copy(w.body.quat);
      sim.emit('whoosh', null);
    };

    const L = {
      killY: -6,
      duration: 70,
      walls,
      speedNow: () => speed,
      checkpoints: [{ test: () => false, spawn: () => ({ x: 0, y: 0.1, z: 4, yaw: Math.PI }) }],
      spawns(n) {
        const out = [];
        const cols = Math.ceil(Math.sqrt(n));
        for (let i = 0; i < n; i++) {
          const c = i % cols, r = Math.floor(i / cols);
          out.push({ x: -6 + (c / Math.max(1, cols - 1)) * 12 + rng.range(-0.3, 0.3), y: 0.05, z: 0 + r * 1.6, yaw: Math.PI });
        }
        return out;
      },
      safeSpawn: () => ({ x: rng.range(-4, 4), y: 0.1, z: rng.range(-2, 3), yaw: Math.PI }),
      camYaw: () => 0,
      camPitch: 0.62,
      camDist: 12.5,
      flyover: [
        [0, 20, 22, 0, 0, 0],
        [16, 9, 4, 0, 1, 0],
        [-14, 8, -10, 0, 1, 0],
      ],
      update(t, dt) {
        const playing = sim.phase === 'play';
        if (playing) {
          const ramp = clamp(sim.t / 60, 0, 1);
          speed = 3.8 + 3.8 * ramp;
          timer -= dt;
          if (timer <= 0) { launch(); timer = (2.9 - 1.6 * ramp) * rng.range(0.85, 1.15); }
        }
        for (const w of walls) {
          if (!w.live) continue;
          if (playing || sim.phase === 'over') w.z += speed * dt;
          w.body.pos.z = w.z;
          w.body.vel.set(0, 0, playing ? speed : 0);
          if (w.z > END_Z) { w.live = false; w.body.enabled = false; w.body.hidden = true; w.body.pos.z = -60; }
        }
      },
      brain: (s, bean, skill) => new WallBrain(s, bean, skill, L),
    };
    return L;
  },
};

class WallBrain {
  constructor(sim, bean, skill, L) {
    this.sim = sim;
    this.b = bean;
    this.skill = skill;
    this.L = L;
    this.rng = sim.rng;
    this.home = [this.rng.range(-5, 5), this.rng.range(-1, 4)];
    this.homeT = this.rng.range(2, 5);
    this.err = 0;
    this.react = 0.2 + (1 - skill) * 1.0;
    this.seen = new Map();
  }
  onRespawn() {}
  think(dt) {
    const b = this.b, L = this.L, rng = this.rng;
    if (b.frozen) { b.mx = b.mz = 0; return; }
    this.homeT -= dt;
    if (this.homeT <= 0) { this.homeT = rng.range(2, 5); this.home = [rng.range(-5, 5), rng.range(-1.5, 4)]; }
    // the nearest wall still coming at us
    let wall = null, gap = 1e9;
    for (const w of L.walls) {
      if (!w.live) continue;
      const d = b.pos.z - (w.z + (w.kind === 'low' ? 0.25 : 0.5));
      if (d > -0.3 && d < gap) { gap = d; wall = w; }
    }
    let tx = this.home[0], tz = this.home[1], thr = 0.6;
    // stay off the back edge
    if (b.pos.z > 4.5) tz = Math.min(tz, 1);
    if (wall) {
      const v = L.speedNow();
      // each bean needs a moment to notice a new wall
      const seen = this.seen.get(wall) || 0;
      this.seen.set(wall, seen + dt);
      if (seen > this.react) {
        if (wall.kind === 'low') {
          const tc = (gap - 0.42) / v;
          const pass = 1.34 / v;
          const lead = 0.07 + Math.max(0, (0.53 - pass) / 2) + this.err;
          if (b.grounded && b.state === 'normal' && tc > lead - 0.04 && tc < lead + 0.04) {
            b.jumpPressed = true;
            this.err = rng.range(-1, 1) * (0.03 + (1 - this.skill) * 0.12);
          }
        } else if (gap < 9) {
          // line up with the nearest hole
          let best = null, bd = 1e9;
          for (const h of wall.holes) {
            const hx = h * wall.mirror;
            const d = Math.abs(hx - b.pos.x) + rng() * 0.01;
            if (d < bd) { bd = d; best = hx; }
          }
          if (best !== null) { tx = best + (this.skill < 0.4 ? rng.range(-0.6, 0.6) : 0); tz = Math.min(b.pos.z, 3); thr = 1; }
        }
      }
    }
    steer(b, tx, tz, thr, 0.3);
  }
}
