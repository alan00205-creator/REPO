// 蜂巢崩落 — final: three floors of hexagon tiles that fall shortly after being touched.
// Last bean standing wins the crown.

import { contactCylRaw } from '../physics.js';
import { steer } from '../ai.js';
import { TAU, clamp } from '../util.js';

const S = 1.32; // hex circumradius (pointy-top)
const SQ3 = Math.sqrt(3);
const TILE_R = S * 0.93; // collision radius (between in- and circumradius)
const HH = 0.28; // half thickness
const LAYERS = [0, -7.5, -15];
const RINGS = 8;
const FUSE = 0.8; // seconds from touch to drop

export const HEX = { S, LAYERS, RINGS, HH };

export default {
  id: 'hex',
  name: '蜂巢崩落',
  en: 'HEX FALL',
  type: 'final',
  desc: '地板一被踩到就會掉落，總共三層。最後一個還站著的豆豆就是冠軍！',
  tip: '別停下來，但也別亂跑——跳躍可以少踩幾塊地板。',
  sky: 'dusk',
  build({ kit: k, sim, rng }) {
    const tiles = [];
    const index = new Map(); // "layer,q,r" -> tile
    LAYERS.forEach((ly, li) => {
      for (let q = -RINGS; q <= RINGS; q++) {
        for (let r = Math.max(-RINGS, -q - RINGS); r <= Math.min(RINGS, -q + RINGS); r++) {
          const x = S * SQ3 * (q + r / 2);
          const z = S * 1.5 * r;
          const t = { li, q, r, x, z, y: ly - HH, top: ly, state: 0, t: 0, vy: 0, i: tiles.length };
          tiles.push(t);
          index.set(li + ',' + q + ',' + r, t);
        }
      }
    });

    const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
    function nearest(x, z) {
      const fq = (SQ3 / 3 * x - z / 3) / S;
      const fr = (2 / 3 * z) / S;
      const fs = -fq - fr;
      let q = Math.round(fq), r = Math.round(fr), s = Math.round(fs);
      const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs);
      if (dq > dr && dq > ds) q = -r - s;
      else if (dr > ds) r = -q - s;
      return [q, r];
    }
    const solid = (t) => t && t.state < 2;

    const body = k.body(0, 0, 0, { kinematic: false });
    body.onContact = (bean, c, s) => {
      const t = tiles[c.sub];
      if (s.phase !== 'play' && s.phase !== 'over') return; // nothing crumbles before GO
      // only the tile under the bean's centre counts as stepped on
      if (t && t.state === 0 && c.n.y > 0.5 && Math.hypot(bean.pos.x - t.x, bean.pos.z - t.z) < S * 0.95) {
        t.state = 1;
        t.t = 0;
        s.emit('tile', bean, t);
      }
    };
    k.addCustom(body, {
      collide(cx, cy, cz, r, cs, n) {
        for (let li = 0; li < LAYERS.length; li++) {
          const ly = LAYERS[li];
          if (cy - r > ly + 0.05 || cy + r < ly - HH * 2 - 0.05) continue;
          const [q0, r0] = nearest(cx, cz);
          for (let k2 = -1; k2 < 6; k2++) {
            const q = k2 < 0 ? q0 : q0 + NB[k2][0];
            const rr = k2 < 0 ? r0 : r0 + NB[k2][1];
            const t = index.get(li + ',' + q + ',' + rr);
            if (!solid(t)) continue;
            const c = cs[n];
            if (contactCylRaw(t.x, t.y, t.z, TILE_R, HH, cx, cy, cz, r, c)) {
              c.shape = this;
              c.body = body;
              c.sub = t.i;
              n++;
              if (n >= cs.length) cs.push(new c.constructor());
            }
          }
        }
        return n;
      },
      rayDown(x, y, z, maxDist) {
        const [q, r] = nearest(x, z);
        for (let li = 0; li < LAYERS.length; li++) {
          if (LAYERS[li] > y + 1e-4 || LAYERS[li] < y - maxDist) continue;
          const t = index.get(li + ',' + q + ',' + r);
          if (solid(t) && Math.hypot(x - t.x, z - t.z) < TILE_R) return LAYERS[li];
        }
        return -Infinity;
      },
    });

    const L = {
      killY: LAYERS[LAYERS.length - 1] - 6,
      tiles,
      index,
      nearest,
      layers: LAYERS,
      checkpoints: [{ test: () => false, spawn: () => ({ x: 0, y: 0.1, z: 0, yaw: 0 }) }],
      spawns(n) {
        const out = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const rr = n > 8 && i % 2 ? 3.2 : 6.2;
          out.push({ x: Math.cos(a) * rr, y: 0.05, z: Math.sin(a) * rr, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) });
        }
        return out;
      },
      camYaw: () => null,
      camPitch: 0.5,
      camDist: 10.5,
      flyover: [
        [0, 18, 24, 0, -6, 0],
        [20, 4, 4, 0, -8, 0],
        [6, -10, 18, 0, -15, 0],
        [-12, 10, 14, 0, 0, 0],
      ],
      // an intact tile on the highest floor that still has one
      safeSpawn(rng) {
        for (let li = 0; li < LAYERS.length; li++) {
          const ok = tiles.filter((t) => t.li === li && t.state === 0);
          if (ok.length) { const t = rng.pick(ok); return { x: t.x, y: LAYERS[li] + 0.05, z: t.z, yaw: 0 }; }
        }
        return { x: 0, y: 0.1, z: 0, yaw: 0 };
      },
      tileAt(li, x, z) {
        const [q, r] = nearest(x, z);
        return index.get(li + ',' + q + ',' + r) || null;
      },
      layerOf(y) {
        let best = 0;
        for (let i = 0; i < LAYERS.length; i++) if (y > LAYERS[i] - 3.5) { best = i; break; } else best = i;
        return best;
      },
      update(t, dt) {
        for (const tl of tiles) {
          if (tl.state === 1) {
            tl.t += dt;
            if (tl.t >= FUSE) { tl.state = 2; tl.t = 0; tl.vy = 0; }
          } else if (tl.state === 2) {
            tl.t += dt;
            tl.vy -= 28 * dt;
            tl.y += tl.vy * dt;
            if (tl.t > 1.6) tl.state = 3;
          }
        }
      },
      brain: (sim, bean, skill) => new HexBrain(sim, bean, skill, L),
    };
    k.scene((g) => g.hexTiles && g.hexTiles(L, S, HH));
    return L;
  },
};

class HexBrain {
  constructor(sim, bean, skill, L) {
    this.sim = sim;
    this.b = bean;
    this.skill = skill;
    this.L = L;
    this.rng = sim.rng;
    this.goal = null;
    this.hopT = this.rng.range(0.5, 2);
    this.pace = 0.7 + this.rng.range(0, 0.18);
    this.think_t = 0;
  }
  onRespawn() {}
  score(tl, li) {
    // intact neighbours make a tile a safer destination
    const L = this.L;
    let s = 0;
    for (const [dq, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]]) {
      const n = L.index.get(li + ',' + (tl.q + dq) + ',' + (tl.r + dr));
      if (n && n.state === 0) s++;
    }
    return s;
  }
  // Is the straight walk from the bean to (x, z) on layer li over intact tiles?
  clear(li, x, z) {
    const b = this.b, L = this.L;
    const dx = x - b.pos.x, dz = z - b.pos.z;
    const d = Math.hypot(dx, dz);
    const here = L.tileAt(li, b.pos.x, b.pos.z);
    for (let s = 0.55; s < d; s += 0.55) {
      const t = L.tileAt(li, b.pos.x + (dx / d) * s, b.pos.z + (dz / d) * s);
      if (!t || (t.state !== 0 && t !== here)) return false;
    }
    return true;
  }
  pick() {
    const b = this.b, L = this.L, rng = this.rng;
    const li = L.layerOf(b.pos.y);
    let best = null, bs = -1e9;
    for (let n = 0; n < 30; n++) {
      const a = rng() * TAU;
      const d = rng.range(1.8, n < 20 ? 4.6 : 7);
      const tl = L.tileAt(li, b.pos.x + Math.cos(a) * d, b.pos.z + Math.sin(a) * d);
      if (!tl || tl.state !== 0) continue;
      const path = this.clear(li, tl.x, tl.z);
      const centre = -Math.hypot(tl.x, tl.z) * 0.06;
      // keep running the way we're going: reversing on a crumbling tile is fatal
      const gx = tl.x - b.pos.x, gz = tl.z - b.pos.z, gl = Math.hypot(gx, gz) || 1;
      const sp = Math.hypot(b.vel.x, b.vel.z);
      const align = sp > 1 ? (gx * b.vel.x + gz * b.vel.z) / (gl * sp) : 0;
      const s = this.score(tl, li) * (0.4 + this.skill) + centre + rng() * (1.6 - this.skill) + (path ? 4 : 0) + align * 2 - (gl > 4.8 ? 1 : 0);
      if (s > bs) { bs = s; best = tl; this.goalClear = path; }
    }
    this.goal = best;
  }
  think(dt) {
    const b = this.b, L = this.L;
    if (b.frozen) { b.mx = b.mz = 0; return; }
    if (b.state !== 'normal') return;
    const li = L.layerOf(b.pos.y);
    this.repick = (this.repick || 0) - dt;
    let again = !this.goal || this.goal.state !== 0 || this.goal.li !== li || Math.hypot(this.goal.x - b.pos.x, this.goal.z - b.pos.z) < 1.0;
    if (!again && this.repick <= 0) { this.repick = 0.3; again = !this.clear(li, this.goal.x, this.goal.z); }
    if (again) this.pick();
    if (this.goal) steer(b, this.goal.x, this.goal.z, this.pace, 0.2);
    else { b.mx *= 0.9; b.mz *= 0.9; }
    if (!b.grounded) return;
    const here = L.tileAt(li, b.pos.x, b.pos.z);
    const spd = Math.hypot(b.vel.x, b.vel.z);
    if (spd > 2.5) {
      const ux = b.vel.x / spd, uz = b.vel.z / spd;
      // floor right ahead is gone or about to go: jump it if the landing spot is solid
      const t = L.tileAt(li, b.pos.x + ux * 1.0, b.pos.z + uz * 1.0);
      if (!t || (t !== here && t.state >= 1)) {
        const land = L.tileAt(li, b.pos.x + b.vel.x * 0.62, b.pos.z + b.vel.z * 0.62);
        if (land && land.state === 0) { b.jumpPressed = true; return; }
        this.pick();
        this.repick = 0.4;
        return;
      }
      // hop now and then while running: one landing touches fewer tiles than a walk
      this.hopT -= dt;
      if (this.hopT <= 0 && spd > 3.4) {
        const land = L.tileAt(li, b.pos.x + b.vel.x * 0.62, b.pos.z + b.vel.z * 0.62);
        if (land && land.state === 0 && land !== here) {
          b.jumpPressed = true;
          this.hopT = this.rng.range(0.4, 1.6) * (1.5 - this.skill * 0.7);
        }
      }
    }
  }
}

export { clamp };
