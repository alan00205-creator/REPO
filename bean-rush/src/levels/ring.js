// 跳跳圈 — survival on a round stage: jump the low bar, don't jump into the high bar.
// The final variant (跳跳圈決戰) drops pie slices of the stage over time.

import { Vector3 } from 'three';
import { TAU, clamp } from '../util.js';
import { steer } from '../ai.js';
import { LK, setYaw } from './parts.js';

const RAD = 11;
const HUB = 1.45;
const N_SECT = 12;
const SECT_COLORS = ['#ff9ad5', '#ffd84d', '#8fe3ff', '#a8f0b8', '#c9b3ff', '#ffb37a'];

function makeRing(final) {
  return {
    id: final ? 'ringFinal' : 'ring',
    name: final ? '跳跳圈決戰' : '跳跳圈',
    en: final ? 'JUMP SHOWDOWN' : 'JUMP RING',
    type: final ? 'final' : 'survival',
    desc: final
      ? '兩根旋轉棒越轉越快，腳下的圓盤還會一塊一塊掉下去。撐到最後的就是冠軍！'
      : '低的棒子要跳過，高的棒子別跳進去！撐到時間結束就晉級。',
    tip: '越靠近中間，棒子轉得越慢。',
    sky: final ? 'dusk' : 'day',
    build({ kit: k, sim, rng }) {
      // stage made of pie slices (they only fall in the final)
      const sectors = [];
      for (let i = 0; i < N_SECT; i++) {
        const a0 = (i / N_SECT) * TAU, a1 = ((i + 1) / N_SECT) * TAU;
        const c = SECT_COLORS[i % SECT_COLORS.length];
        const body = k.body(0, -0.7, 0, { kinematic: true });
        k.addSector(body, 0, 0, 0, HUB - 0.05, RAD, 1.4, a0, a1, {
          look: { top: { t: 'dots', c, c2: '#ffffff', s: 2.2 }, side: { t: 'hstripe', c: '#ffffff', c2: c, s: 0.7 } },
        });
        sectors.push({ body, a0, a1, mid: (a0 + a1) / 2, state: 0, t: 0, home: body.pos.clone() });
      }
      // hub pillar
      k.cyl(0, 0.85, 0, HUB, 4.7, { look: { top: { t: 'dots', c: '#ffe14d', c2: '#ffb000', s: 1 }, side: { t: 'vstripe', c: '#7d6cf2', c2: '#ffffff', s: 1.2 } } });
      k.deco(null, (b) => {
        b.sphereAt(0, 3.2, 0, 1.75, { t: 'band', c: '#ff4fa3', c2: '#ffd84d', shiny: 1 }, 1, 0.55, 1);
        b.sphereAt(0, 4.1, 0, 0.55, { t: 'plain', c: '#ffffff', shiny: 1 });
      });

      const mkBar = (y, look, hazard) => {
        const body = k.body(0, 0, 0, { hazard, ground: false });
        k.addCapsule(body, 0, y, 0, RAD + 0.4, 0.36, { look });
        k.deco(body, (b) => {
          b.sphereAt(RAD + 0.4, y, 0, 0.5, { t: 'plain', c: '#ffffff', shiny: 1 });
          b.sphereAt(-RAD - 0.4, y, 0, 0.5, { t: 'plain', c: '#ffffff', shiny: 1 });
          b.cylAt(0, y, 0, HUB + 0.12, 0.9, { side: { t: 'plain', c: '#ffffff' }, top: { t: 'plain', c: '#ffffff' } });
        });
        return { body, angle: 0, w: 0, y };
      };
      const low = mkBar(0.45, LK.bar, 0.85);
      const high = mkBar(2.35, LK.barBlue, 0.75);
      low.angle = rng.range(0, TAU);
      high.angle = low.angle + Math.PI / 2;

      const arrival = (bar, bx, bz, vx, vz) => {
        const phi = Math.atan2(bz, bx);
        const r2 = bx * bx + bz * bz || 1e-6;
        const dphi = (bx * vz - bz * vx) / r2;
        const alpha = -bar.angle;
        let d;
        if (bar.w > 0) d = (((alpha - phi) % Math.PI) + Math.PI) % Math.PI;
        else d = (((phi - alpha) % Math.PI) + Math.PI) % Math.PI;
        const rate = Math.sign(bar.w) * (bar.w + dphi);
        return rate > 0.05 ? d / rate : 99;
      };

      const intactAt = (ang) => {
        const i = Math.floor((((ang % TAU) + TAU) % TAU) / (TAU / N_SECT));
        return sectors[i].state === 0;
      };

      let nextDrop = 18;
      const L = {
        killY: -6,
        duration: final ? 0 : 70,
        sectors,
        low,
        high,
        checkpoints: [{ test: () => false, spawn: () => ({ x: 0, y: 0.1, z: 7, yaw: Math.PI }) }],
        spawns(n) {
          // two half-circles between the low bar's arms, so nobody starts under it
          const out = [];
          const a0 = -low.angle;
          const half = [Math.ceil(n / 2), Math.floor(n / 2)];
          for (let i = 0; i < n; i++) {
            const h = i % 2, k = Math.floor(i / 2), m = Math.max(1, half[h]);
            const a = a0 + h * Math.PI + ((k + 0.5) / m) * Math.PI;
            const r = m > 6 && k % 2 ? 4.2 : 6.6;
            out.push({ x: Math.cos(a) * r, y: 0.05, z: Math.sin(a) * r, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) });
          }
          return out;
        },
        camYaw: (p) => (Math.hypot(p.x, p.z) > 1 ? Math.atan2(p.x, p.z) : null),
        camPitch: 0.5,
        camDist: 10.5,
        flyover: [
          [0, 26, 20, 0, 0, 0],
          [18, 12, 10, 0, 1, 0],
          [10, 6, -16, 0, 1, 0],
          [-14, 7, -6, 0, 1, 0],
        ],
        arrival,
        intactAt,
        safeSpawn(rng) {
          const ok = sectors.filter((s) => s.state === 0);
          const s = ok.length ? rng.pick(ok) : sectors[0];
          return { x: Math.cos(s.mid) * 6, y: 0.1, z: Math.sin(s.mid) * 6, yaw: Math.atan2(-Math.cos(s.mid), -Math.sin(s.mid)) };
        },
        update(t, dt) {
          const pt = sim.phase === 'play' || sim.phase === 'over' ? sim.t : 0;
          const run = sim.phase === 'play'; // bars stop when the whistle blows
          const ramp = clamp(pt / (final ? 80 : 65), 0, 1);
          // bars hold still until GO so nobody gets swatted while frozen
          low.w = run ? 0.75 + 0.7 * ramp : 0;
          high.w = run ? -(0.42 + 0.5 * ramp) : 0;
          for (const bar of [low, high]) {
            bar.angle += bar.w * dt;
            setYaw(bar.body, bar.angle);
            bar.body.angVel.set(0, bar.w, 0);
          }
          if (final && sim.phase === 'play') {
            if (pt > nextDrop) {
              const alive = sectors.filter((s) => s.state === 0);
              if (alive.length > 3) {
                const s = rng.pick(alive);
                s.state = 1;
                s.t = 0;
                sim.emit('crack', null, s);
              }
              nextDrop = pt + Math.max(3.5, 8 - pt * 0.05);
            }
          }
          for (const s of sectors) {
            if (s.state === 1) {
              s.t += dt;
              const sh = Math.sin(s.t * 60) * 0.05 * Math.min(1, s.t);
              s.body.pos.set(Math.cos(s.mid) * sh, s.home.y + sh * 0.3, Math.sin(s.mid) * sh);
              if (s.t > 2.2) { s.state = 2; s.t = 0; s.vy = 0; sim.emit('fall', null, s); }
            } else if (s.state === 2) {
              s.t += dt;
              s.vy -= 30 * dt;
              s.body.pos.y += s.vy * dt;
              s.body.vel.set(0, s.vy, 0);
              if (s.body.pos.y < -30) { s.state = 3; s.body.enabled = false; s.body.hidden = true; }
            }
          }
        },
        brain: (sim, bean, skill) => new RingBrain(sim, bean, skill, L),
      };
      return L;
    },
  };
}

class RingBrain {
  constructor(sim, bean, skill, L) {
    this.sim = sim;
    this.b = bean;
    this.skill = skill;
    this.L = L;
    this.rng = sim.rng;
    this.prefR = this.rng.range(3, 6.6) - skill * 0.8;
    this.ang = Math.atan2(bean.pos.z, bean.pos.x);
    this.drift = this.rng.range(-0.25, 0.25);
    this.timingErr = 0;
    this.spread = 0.025 + (1 - skill) * 0.075;
    this.blunder = 0.01 + (1 - skill) * 0.07;
    this.panic = (1 - skill) * 0.05;
    this.ignoreT = 0;
    this.retarget = 0;
  }
  onRespawn() {}
  think(dt) {
    const b = this.b, L = this.L;
    if (b.frozen) { b.mx = b.mz = 0; return; }
    this.retarget -= dt;
    if (this.retarget <= 0) {
      this.retarget = this.rng.range(1.5, 4);
      this.drift = this.rng.range(-0.3, 0.3);
      if (this.rng() < 0.3) this.prefR = clamp(this.prefR + this.rng.range(-1.5, 1.5), 2.6, 8.5);
    }
    this.ang += this.drift * dt;
    // stay over solid stage (final): move to an intact slice
    if (!L.intactAt(this.ang)) {
      let best = this.ang, bd = 1e9;
      for (const s of L.sectors) {
        if (s.state !== 0) continue;
        const d = Math.abs(Math.atan2(Math.sin(s.mid - this.ang), Math.cos(s.mid - this.ang)));
        if (d < bd) { bd = d; best = s.mid; }
      }
      this.ang = best;
    }
    const tx = Math.cos(this.ang) * this.prefR, tz = Math.sin(this.ang) * this.prefR;
    const r = Math.hypot(b.pos.x, b.pos.z);
    const urgent = r > RAD - 1.8 || !L.intactAt(Math.atan2(b.pos.z, b.pos.x));
    // plant your feet when the low bar is close, then time the jump
    const near = L.arrival(L.low, b.pos.x, b.pos.z) < 0.95 && r > HUB + 0.3;
    if (near && !urgent) { b.mx = b.mz = 0; }
    else steer(b, tx, tz, urgent ? 1 : 0.55, 0.6);

    if (this.ignoreT > 0) this.ignoreT -= dt;
    if (!b.grounded || b.state !== 'normal') return;
    const tl = L.arrival(L.low, b.pos.x, b.pos.z, b.vel.x, b.vel.z);
    const lead = 0.335 + this.timingErr;
    if (tl > lead - 0.03 && tl < lead + 0.03 && this.ignoreT <= 0 && r > HUB + 0.3) {
      if (this.rng() < this.blunder) { this.ignoreT = 0.5; return; }
      // a smart bean skips a jump that would meet the high bar mid-air (and eats the low bar
      // only if the high one is truly unavoidable)
      const th = L.arrival(L.high, b.pos.x, b.pos.z, b.vel.x, b.vel.z);
      const clash = th > 0.02 && th < 0.62;
      if (clash && this.rng() < 0.4 + this.skill * 0.5) { this.ignoreT = 0.25; return; }
      b.jumpPressed = true;
      this.timingErr = this.rng.range(-1, 1) * this.spread;
    } else if (this.rng() < this.panic * dt) {
      b.jumpPressed = true;
    }
  }
}

export const ring = makeRing(false);
export const ringFinal = makeRing(true);
export { Vector3 };
