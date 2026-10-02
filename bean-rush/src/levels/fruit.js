// 水果配對 — memory survival: remember which tile shows the fruit on the big screen
// before the other tiles drop into the goo.

import { steer } from '../ai.js';
import { clamp } from '../util.js';

export const FRUITS = ['西瓜', '香蕉', '鳳梨', '芒果', '葡萄', '草莓'];

const N = 4; // grid N x N
const SIZE = 4.6;
const GAP = 0.35;
const PITCH = SIZE + GAP;
const SPAN = N * SIZE + (N - 1) * GAP;

// cycle timing (seconds): show fruits, hide + show target, drop, hold, rise
const CYCLES = [
  { show: 5.5, hide: 3.6, keep: 4 },
  { show: 5.0, hide: 3.4, keep: 3 },
  { show: 4.4, hide: 3.2, keep: 3 },
  { show: 3.8, hide: 3.0, keep: 2 },
  { show: 3.2, hide: 3.0, keep: 2 },
  { show: 2.6, hide: 2.8, keep: 1 },
  { show: 2.2, hide: 2.6, keep: 1 },
];

export default {
  id: 'fruit',
  name: '水果配對',
  en: 'FRUIT MATCH',
  type: 'survival',
  desc: '記住每塊地板上的水果！大螢幕出現哪種水果，就站到那塊地板上，其他地板會掉下去。',
  tip: '水果蓋起來之前，先記住離你最近的幾塊。',
  sky: 'day',
  build({ kit: k, sim, rng }) {
    const tiles = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = -SPAN / 2 + SIZE / 2 + c * PITCH;
        const z = -SPAN / 2 + SIZE / 2 + r * PITCH;
        const body = k.body(x, -0.5, z, { kinematic: true });
        k.addBox(body, 0, 0, 0, SIZE, 1, SIZE, { look: false });
        tiles.push({ body, x, z, fruit: 0, face: -1, home: -0.5, y: -0.5, vy: 0, mesh: null, i: tiles.length });
      }
    }
    // a rim of bumpers is deliberately absent: crowding at the edge is part of the game

    const st = {
      cycle: -1,
      stage: 'wait', // wait | show | hide | drop | hold | rise | end
      t: 0,
      target: -1,
      countdown: 0,
      shown: false,
    };

    function assignFruits(keep) {
      const target = rng.int(0, FRUITS.length - 1);
      const idx = rng.shuffle([...tiles.keys()]);
      const others = FRUITS.map((_, i) => i).filter((i) => i !== target);
      idx.forEach((ti, n) => {
        tiles[ti].fruit = n < keep ? target : rng.pick(others);
      });
      st.target = target;
    }

    function setFaces(mode) {
      for (const tl of tiles) tl.face = mode === 'fruit' ? tl.fruit : mode === 'match' ? (tl.fruit === st.target ? tl.fruit : -2) : -1;
    }

    const L = {
      killY: -6,
      duration: 0,
      tiles,
      st,
      fruits: FRUITS,
      checkpoints: [{ test: () => false, spawn: () => ({ x: 0, y: 0.1, z: 0, yaw: Math.PI }) }],
      spawns(n) {
        const out = [];
        for (let i = 0; i < n; i++) {
          const tl = tiles[i % tiles.length];
          const j = Math.floor(i / tiles.length);
          out.push({ x: tl.x + (j ? 1.1 : -0.6) + rng.range(-0.3, 0.3), y: 0.05, z: tl.z + (j ? 0.9 : -0.4), yaw: Math.PI });
        }
        return out;
      },
      camYaw: () => 0,
      camPitch: 0.62,
      camDist: 12,
      flyover: [
        [0, 24, 22, 0, 0, 0],
        [16, 12, 6, 0, 0, 0],
        [-12, 9, 14, 0, 0, 0],
      ],
      done: () => st.stage === 'end',
      hud() {
        if (st.stage === 'hide') return { fruit: st.target, left: st.countdown };
        if (st.stage === 'drop' || st.stage === 'hold') return { fruit: st.target, left: 0 };
        if (st.stage === 'show') return { memo: true, left: st.countdown };
        return null;
      },
      update(t, dt) {
        const playing = sim.phase === 'play' || sim.phase === 'over';
        if (!playing) {
          if (!st.shown) {
            // decorative fruits during the intro
            assignFruits(16);
            for (const tl of tiles) tl.fruit = rng.int(0, FRUITS.length - 1);
            setFaces('fruit');
            st.shown = true;
          }
        } else if (sim.phase === 'play') {
          st.t += dt;
          const cyc = CYCLES[Math.max(0, Math.min(st.cycle, CYCLES.length - 1))];
          switch (st.stage) {
            case 'wait':
              if (st.t > 0.6) next();
              break;
            case 'show':
              st.countdown = cyc.show - st.t;
              if (st.t >= cyc.show) { st.stage = 'hide'; st.t = 0; setFaces('blank'); sim.emit('fruitHide', null, st.target); }
              break;
            case 'hide':
              st.countdown = cyc.hide - st.t;
              if (st.t >= cyc.hide) {
                st.stage = 'drop'; st.t = 0;
                setFaces('match');
                for (const tl of tiles) if (tl.fruit !== st.target) { tl.vy = 0; tl.dropping = true; }
                sim.emit('fruitDrop', null, st.target);
              }
              break;
            case 'drop':
              if (st.t > 2.6) { st.stage = 'rise'; st.t = 0; }
              break;
            case 'rise':
              if (st.t > 1.4) {
                for (const tl of tiles) { tl.dropping = false; tl.y = tl.home; tl.vy = 0; }
                if (st.cycle >= CYCLES.length - 1) { st.stage = 'end'; }
                else next();
              }
              break;
          }
        }
        // tile motion
        for (const tl of tiles) {
          const b = tl.body;
          if (st.stage === 'drop' && tl.dropping) {
            tl.vy -= 34 * dt;
            tl.y = Math.max(tl.home - 9, tl.y + tl.vy * dt);
          } else if (st.stage === 'rise' && tl.dropping) {
            tl.vy = 0;
            const f = clamp(st.t / 1.2, 0, 1);
            const target = tl.home;
            tl.y = tl.y + (target - tl.y) * Math.min(1, f * f * 0.6 + 0.04);
            if (f >= 1) tl.y = target;
          }
          const vy = (tl.y - b.pos.y) / dt;
          b.pos.y = tl.y;
          b.vel.set(0, Math.max(vy, -12), 0);
          // dropped tiles stop colliding so falling beans aren't caught by them
          b.shapes[0].enabled = !(tl.dropping && tl.y < tl.home - 1.2);
        }
      },
      brain: (sim, bean, skill) => new FruitBrain(sim, bean, skill, L),
    };

    function next() {
      st.cycle++;
      const cyc = CYCLES[Math.min(st.cycle, CYCLES.length - 1)];
      assignFruits(cyc.keep);
      setFaces('fruit');
      st.stage = 'show';
      st.t = 0;
      sim.emit('fruitShow', null, st.cycle);
    }

    k.scene((g) => g.fruitTiles && g.fruitTiles(L, SIZE, SPAN));
    return L;
  },
};

class FruitBrain {
  constructor(sim, bean, skill, L) {
    this.sim = sim;
    this.b = bean;
    this.skill = skill;
    this.L = L;
    this.rng = sim.rng;
    this.mem = new Map();
    this.cycleSeen = -1;
    this.goal = null;
    this.delay = 0;
    this.wander = null;
    this.wanderT = 0;
  }
  onRespawn() {}
  think(dt) {
    const b = this.b, L = this.L, st = L.st, rng = this.rng;
    if (b.frozen) { b.mx = b.mz = 0; return; }
    if (st.stage === 'show') {
      if (this.cycleSeen !== st.cycle) {
        this.cycleSeen = st.cycle;
        this.mem.clear();
        this.goal = null;
        // shorter reveals → fewer tiles remembered
        const cyc = Math.max(0, st.cycle);
        const p = clamp(0.3 + this.skill * 0.62 - cyc * 0.035, 0.12, 0.95);
        for (const tl of L.tiles) {
          // nearby tiles are easier to remember
          const d = Math.hypot(tl.x - b.pos.x, tl.z - b.pos.z);
          if (rng() < p + (d < 6 ? 0.15 : 0)) this.mem.set(tl.i, rng() < 0.05 + (1 - this.skill) * 0.08 ? rng.int(0, 5) : tl.fruit);
        }
      }
      // mill about
      this.wanderT -= dt;
      if (!this.wander || this.wanderT <= 0) {
        const tl = rng.pick(L.tiles);
        this.wander = [tl.x + rng.range(-1.2, 1.2), tl.z + rng.range(-1.2, 1.2)];
        this.wanderT = rng.range(1.2, 3);
      }
      steer(b, this.wander[0], this.wander[1], 0.45, 0.6);
      return;
    }
    if (st.stage === 'hide' || st.stage === 'drop') {
      if (!this.goal) {
        this.delay = rng.range(0.15, 0.6) + (1 - this.skill) * 0.7;
        const known = L.tiles.filter((tl) => this.mem.get(tl.i) === st.target);
        let pool = known.length ? known : L.tiles.filter((tl) => !this.mem.has(tl.i));
        if (!pool.length) pool = L.tiles;
        pool = pool.slice().sort((a, c) => Math.hypot(a.x - b.pos.x, a.z - b.pos.z) - Math.hypot(c.x - b.pos.x, c.z - b.pos.z));
        const tl = pool[rng() < 0.75 ? 0 : rng.int(0, pool.length - 1)];
        this.goal = [tl.x + rng.range(-1.1, 1.1), tl.z + rng.range(-1.1, 1.1), tl];
      }
      if (this.delay > 0) { this.delay -= dt; b.mx *= 0.9; b.mz *= 0.9; return; }
      // late correction: once the tile reveals during the drop, run to a survivor if close
      if (st.stage === 'drop' && this.goal[2].fruit !== st.target) {
        const ok = L.tiles.filter((tl) => tl.fruit === st.target).sort((a, c) => Math.hypot(a.x - b.pos.x, a.z - b.pos.z) - Math.hypot(c.x - b.pos.x, c.z - b.pos.z))[0];
        if (ok) this.goal = [ok.x, ok.z, ok];
      }
      const d = steer(b, this.goal[0], this.goal[1], 1, 0.35);
      if (d > 2.2 && b.grounded && st.stage === 'hide' && st.countdown < 0.8 && rng() < 0.1) b.divePressed = true;
      return;
    }
    // hold / rise / wait
    this.goal = null;
    b.mx *= 0.85;
    b.mz *= 0.85;
  }
}
