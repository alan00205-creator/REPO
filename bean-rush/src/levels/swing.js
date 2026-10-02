// 擺錘競技場 — survival on a square stage crossed by giant pendulums swinging along both
// axes, faster and faster. Find the gaps between their paths.

import { Vector3 } from 'three';
import { TAU, clamp } from '../util.js';
import { steer } from '../ai.js';
import { LK } from './parts.js';

const HALF = 10;
const PIVOT_Y = 12.5;
const LEN = 11;
const BALL_R = 1.6;
const AMP = 1.0;
const AX_X = new Vector3(1, 0, 0);
const AX_Z = new Vector3(0, 0, 1);

export default {
  id: 'swing',
  name: '擺錘競技場',
  en: 'SWING ARENA',
  type: 'survival',
  desc: '五顆大擺錘縱橫交錯地掃過擂台，而且越擺越快！站在它們的軌道之間才安全。',
  tip: '擺錘只會沿著一條直線擺，站到兩條軌道中間就好。',
  sky: 'sunset',
  build({ kit: k, sim, rng }) {
    k.box(0, -0.6, 0, HALF * 2, 1.2, HALF * 2, {
      look: { top: { t: 'checker', c: '#ffe0bf', c2: '#ffd1a3', s: 5 }, side: { t: 'hstripe', c: '#ff9a3c', c2: '#ffffff', s: 0.8 } },
    });
    // swing planes: 'x' swings along X (hinged on a line at fixed z), 'z' along Z
    const defs = [
      { axis: 'x', at: -5 }, { axis: 'x', at: 0 }, { axis: 'x', at: 5 },
      { axis: 'z', at: -5 }, { axis: 'z', at: 5 },
    ];
    const pends = defs.map((d, i) => {
      const px = d.axis === 'x' ? 0 : d.at, pz = d.axis === 'x' ? d.at : 0;
      const body = k.body(px, PIVOT_Y, pz, { hazard: 0.95, ground: false });
      k.addSphere(body, 0, -LEN, 0, BALL_R, { look: i % 2 ? LK.ball : { t: 'band', c: '#5fd3ff', c2: '#ffffff', shiny: 1 } });
      k.deco(body, (b) => b.boxAt(0, -(LEN - BALL_R) / 2, 0, 0.2, LEN - BALL_R, 0.2, LK.steel));
      return { ...d, body, phase: (i * 1.3) % TAU, px, pz };
    });
    // overhead frame
    k.deco(null, (b) => {
      for (const z of [-5, 0, 5]) b.boxAt(0, PIVOT_Y + 0.3, z, HALF * 2 + 3, 0.6, 0.6, { t: 'hstripe', c: '#7d6cf2', c2: '#ffffff', s: 1 });
      for (const x of [-5, 5]) b.boxAt(x, PIVOT_Y + 0.9, 0, 0.6, 0.6, HALF * 2 + 3, { t: 'hstripe', c: '#7d6cf2', c2: '#ffffff', s: 1 });
      for (const [x, z] of [[-11.5, -11.5], [11.5, -11.5], [-11.5, 11.5], [11.5, 11.5]]) b.boxAt(x, PIVOT_Y / 2 - 2, z, 0.8, PIVOT_Y + 5, 0.8, LK.post);
    });

    let w = 0;
    const L = {
      killY: -6,
      duration: 60,
      pends,
      // ball offset along its swing axis at phase p
      offAt: (p) => LEN * Math.sin(AMP * Math.sin(p)),
      phaseIn: (pd, s) => pd.phase + w * s,
      checkpoints: [{ test: () => false, spawn: () => ({ x: 2.5, y: 0.1, z: 2.5, yaw: 0 }) }],
      spawns(n) {
        // start in the safe cells between swing paths
        const cells = [];
        for (const x of [-7.5, 0, 7.5]) for (const z of [-7.5, -2.5, 2.5, 7.5]) cells.push([x, z]);
        const out = [];
        for (let i = 0; i < n; i++) {
          const [x, z] = cells[i % cells.length];
          const j = Math.floor(i / cells.length);
          out.push({ x: x + (j % 2 ? 0.9 : -0.9), y: 0.05, z: z + (j > 1 ? 0.6 : -0.6), yaw: rng() * TAU });
        }
        return out;
      },
      safeSpawn: () => ({ x: 0, y: 0.1, z: 2.5, yaw: 0 }),
      camYaw: (p) => (Math.hypot(p.x, p.z) > 1 ? Math.atan2(p.x, p.z) : null),
      camPitch: 0.6,
      camDist: 12,
      flyover: [
        [0, 24, 22, 0, 2, 0],
        [18, 9, 8, 0, 2, 0],
        [-16, 7, -14, 0, 2, 0],
      ],
      update(t, dt) {
        const playing = sim.phase === 'play';
        const ramp = clamp(sim.t / 55, 0, 1);
        w = playing ? TAU / (3.8 - 1.4 * ramp) : TAU / 4.5;
        for (const p of pends) {
          if (playing || sim.phase === 'intro') p.phase += w * dt;
          const a = AMP * Math.sin(p.phase);
          const da = AMP * Math.cos(p.phase) * (playing ? w : 0);
          if (p.axis === 'x') { p.body.quat.setFromAxisAngle(AX_Z, a); p.body.angVel.set(0, 0, da); }
          else { p.body.quat.setFromAxisAngle(AX_X, -a); p.body.angVel.set(-da, 0, 0); }
        }
      },
      brain: (s, bean, skill) => new SwingBrain(s, bean, skill, L),
    };
    return L;
  },
};

class SwingBrain {
  constructor(sim, bean, skill, L) {
    this.sim = sim;
    this.b = bean;
    this.skill = skill;
    this.L = L;
    this.rng = sim.rng;
    this.goal = null;
    this.goalT = 0;
    this.look = 0.35 + skill * 0.4; // how far ahead it predicts the balls
  }
  onRespawn() {}
  think(dt) {
    const b = this.b, L = this.L, rng = this.rng;
    if (b.frozen) { b.mx = b.mz = 0; return; }
    this.goalT -= dt;
    if (!this.goal || this.goalT <= 0) {
      const xs = [-7.5, 0, 7.5], zs = [-7.5, -2.5, 2.5, 7.5];
      this.goal = [rng.pick(xs) + rng.range(-1, 1), rng.pick(zs) + rng.range(-0.6, 0.6)];
      this.goalT = rng.range(3, 7);
    }
    let fx = 0, fz = 0, danger = false;
    for (const p of L.pends) {
      for (let s = 0.05; s <= this.look; s += 0.1) {
        const off = L.offAt(L.phaseIn(p, s));
        const bx = p.axis === 'x' ? p.px + off : p.px;
        const bz = p.axis === 'x' ? p.pz : p.pz + off;
        const d = Math.hypot(b.pos.x - bx, b.pos.z - bz);
        if (d < BALL_R + 1.2) {
          danger = true;
          // step off the swing line, toward the side we're already on
          if (p.axis === 'x') fz += b.pos.z >= p.pz ? 1 : -1;
          else fx += b.pos.x >= p.px ? 1 : -1;
          break;
        }
      }
    }
    if (danger) {
      if (Math.abs(b.pos.x + fx) > HALF - 1.2) fx = -Math.sign(b.pos.x);
      if (Math.abs(b.pos.z + fz) > HALF - 1.2) fz = -Math.sign(b.pos.z);
      steer(b, b.pos.x + fx * 2, b.pos.z + fz * 2, 1, 0.05);
      return;
    }
    steer(b, this.goal[0], this.goal[1], 0.55, 0.4);
  }
}
