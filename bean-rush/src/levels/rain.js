// 珍珠雨 — survival: giant tapioca pearls rain down (a shadow marks where), bounce and roll.
// The final variant (珍珠雨決戰) also drops slices of the stage.

import { TAU, clamp } from '../util.js';
import { steer } from '../ai.js';
import { LK } from './parts.js';

const RAD = 10;
const N_SECT = 10;
const COLORS = ['#ffe0bf', '#f4dcb8', '#ffd1a3', '#f0d2a6', '#ffe8cc'];

function makeRain(final) {
  return {
    id: final ? 'rainFinal' : 'rain',
    name: final ? '珍珠雨決戰' : '珍珠雨',
    en: final ? 'BOBA STORM' : 'BOBA RAIN',
    type: final ? 'final' : 'survival',
    desc: final
      ? '珍珠越下越大，腳下的杯蓋還會一片片掉進黏液。最後還站著的就是冠軍！'
      : '巨大珍珠從天而降！看地上的影子躲開，被砸到會被彈飛。撐到時間結束就晉級。',
    tip: '影子出現在哪，珍珠就落在哪。',
    sky: final ? 'dusk' : 'sunset',
    build({ kit: k, sim, rng }) {
      const sectors = [];
      for (let i = 0; i < N_SECT; i++) {
        const a0 = (i / N_SECT) * TAU, a1 = ((i + 1) / N_SECT) * TAU;
        const c = COLORS[i % COLORS.length];
        const body = k.body(0, -0.7, 0, { kinematic: true });
        k.addSector(body, 0, 0, 0, 0, RAD, 1.4, a0, a1, {
          look: { top: { t: 'dots', c, c2: '#ffffff', s: 2.4 }, side: { t: 'hstripe', c: '#b07a4f', c2: c, s: 0.7 } },
        });
        sectors.push({ body, a0, a1, mid: (a0 + a1) / 2, state: 0, t: 0, home: body.pos.clone() });
      }
      // a giant straw overhead, for scale
      k.deco(null, (b) => {
        b.cylAt(-6, 18, -14, 1.1, 30, { t: 'plain', c: '#ff5fa2', shiny: 1 }, 0.5);
      });
      const intactAt = (x, z) => {
        if (Math.hypot(x, z) > RAD) return false;
        const a = Math.atan2(z, x);
        const i = Math.floor((((a % TAU) + TAU) % TAU) / (TAU / N_SECT));
        return sectors[i].state < 2;
      };
      // solid and not about to fall
      const safeAt = (x, z) => {
        if (Math.hypot(x, z) > RAD - 0.6) return false;
        const a = Math.atan2(z, x);
        return sectors[Math.floor((((a % TAU) + TAU) % TAU) / (TAU / N_SECT))].state === 0;
      };

      const balls = [];
      for (let i = 0; i < 26; i++) {
        const r = rng.range(0.9, 1.5);
        const body = k.body(0, -60, 0, { hazard: 0.9, ground: false });
        k.addSphere(body, 0, 0, 0, r, { look: LK.boba, seg: 16 });
        body.enabled = false;
        body.hidden = true;
        const mark = k.body(0, -60, 0, { ground: false });
        k.deco(mark, (b) => b.cylAt(0, 0, 0, r * 1.05, 0.05, { t: 'plain', c: '#6b4a8a' }));
        mark.hidden = true;
        balls.push({ body, mark, r, vel: body.vel, live: false, landed: false, tx: 0, tz: 0 });
      }
      let timer = 1.5;
      const drop = () => {
        const b = balls.find((x) => !x.live);
        if (!b) return;
        const alive = sim.beans.filter((x) => x.active && !x.out);
        let x, z;
        if (alive.length && rng() < 0.55) {
          const t = rng.pick(alive);
          x = t.pos.x + rng.range(-1.8, 1.8);
          z = t.pos.z + rng.range(-1.8, 1.8);
        } else {
          const a = rng() * TAU, d = Math.sqrt(rng()) * (RAD - 1);
          x = Math.cos(a) * d; z = Math.sin(a) * d;
        }
        b.live = true;
        b.landed = false;
        b.tx = x; b.tz = z;
        b.body.enabled = true;
        b.body.hidden = false;
        b.body.pos.set(x, 22, z);
        b.body.prevPos.copy(b.body.pos);
        b.vel.set(0, -8, 0);
        b.mark.pos.set(x, 0.04, z);
        b.mark.prevPos.copy(b.mark.pos);
        b.mark.hidden = !intactAt(x, z);
      };

      let nextDrop = 20;
      const L = {
        killY: -6,
        duration: final ? 0 : 60,
        balls,
        sectors,
        intactAt,
        safeAt,
        checkpoints: [{ test: () => false, spawn: () => ({ x: 0, y: 0.1, z: 0, yaw: Math.PI }) }],
        spawns(n) {
          const out = [];
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU, r = n > 12 && i % 2 ? 3.5 : 6.5;
            out.push({ x: Math.cos(a) * r, y: 0.05, z: Math.sin(a) * r, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) });
          }
          return out;
        },
        safeSpawn(r2) {
          const ok = sectors.filter((s) => s.state === 0);
          const s = ok.length ? r2.pick(ok) : sectors[0];
          return { x: Math.cos(s.mid) * 5, y: 0.1, z: Math.sin(s.mid) * 5, yaw: 0 };
        },
        camYaw: (p) => (Math.hypot(p.x, p.z) > 1 ? Math.atan2(p.x, p.z) : null),
        camPitch: 0.55,
        camDist: 11,
        flyover: [
          [0, 26, 20, 0, 0, 0],
          [18, 10, 8, 0, 1, 0],
          [-14, 8, -12, 0, 1, 0],
        ],
        update(t, dt) {
          const playing = sim.phase === 'play';
          const pt = sim.t;
          if (playing) {
            timer -= dt;
            if (timer <= 0) {
              const ramp = clamp(pt / (final ? 70 : 55), 0, 1);
              timer = (1.15 - 0.75 * ramp) * rng.range(0.7, 1.3);
              drop();
              if (final && ramp > 0.6 && rng() < 0.4) drop();
            }
            if (final && pt > nextDrop) {
              const ok = sectors.filter((s) => s.state === 0);
              if (ok.length > 2) { const s = rng.pick(ok); s.state = 1; s.t = 0; sim.emit('crack', null, s); }
              nextDrop = pt + Math.max(5, 9.5 - pt * 0.05);
            }
          }
          for (const s of sectors) {
            if (s.state === 1) {
              s.t += dt;
              const sh = Math.sin(s.t * 60) * 0.05 * Math.min(1, s.t);
              s.body.pos.set(Math.cos(s.mid) * sh, s.home.y + sh * 0.3, Math.sin(s.mid) * sh);
              if (s.t > 2.2) { s.state = 2; s.t = 0; s.vy = 0; sim.emit('fall', null, s); }
            } else if (s.state === 2) {
              s.vy -= 30 * dt;
              s.body.pos.y += s.vy * dt;
              s.body.vel.set(0, s.vy, 0);
              if (s.body.pos.y < -30) { s.state = 3; s.body.enabled = false; s.body.hidden = true; }
            }
          }
          for (const b of balls) {
            if (!b.live) continue;
            const p = b.body.pos, v = b.vel;
            v.y -= 26 * dt;
            p.addScaledVector(v, dt);
            const onStage = intactAt(p.x, p.z);
            if (onStage && p.y - b.r < 0 && p.y - b.r > -1.2) {
              p.y = b.r;
              if (!b.landed) {
                b.landed = true;
                b.mark.hidden = true;
                const a = rng() * TAU, s = rng.range(1.5, 3.8);
                v.x = Math.cos(a) * s; v.z = Math.sin(a) * s;
                v.y = Math.abs(v.y) * 0.35;
                sim.emit('thump', null, p);
              } else {
                v.y = v.y < -3 ? -v.y * 0.3 : 0;
                v.x *= 1 - 0.25 * dt; v.z *= 1 - 0.25 * dt;
              }
            }
            b.body.quat.setFromAxisAngle(AX.set(v.z, 0, -v.x).normalize(), (t * Math.hypot(v.x, v.z)) / b.r);
            if (p.y < -12) { b.live = false; b.body.enabled = false; b.body.hidden = true; b.mark.hidden = true; }
          }
        },
        brain: (s, bean, skill) => new RainBrain(s, bean, skill, L),
      };
      return L;
    },
  };
}

import { Vector3 } from 'three';
const AX = new Vector3();

class RainBrain {
  constructor(sim, bean, skill, L) {
    this.sim = sim;
    this.b = bean;
    this.skill = skill;
    this.L = L;
    this.rng = sim.rng;
    this.goal = null;
    this.goalT = 0;
    this.notice = 0.15 + (1 - skill) * 0.55; // seconds before a shadow is noticed
  }
  onRespawn() {}
  pickGoal() {
    const L = this.L, rng = this.rng;
    for (let n = 0; n < 12; n++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * 6.5;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (L.safeAt(x, z) && L.safeAt(x * 1.25, z * 1.25)) { this.goal = [x, z]; return; }
    }
    this.goal = [0, 0];
  }
  think(dt) {
    const b = this.b, L = this.L;
    if (b.frozen) { b.mx = b.mz = 0; return; }
    this.goalT -= dt;
    if (!this.goal || this.goalT <= 0 || !L.safeAt(this.goal[0], this.goal[1])) { this.pickGoal(); this.goalT = this.rng.range(2, 5); }
    // the floor under us is shaking: get off it first
    if (!L.safeAt(b.pos.x, b.pos.z)) { steer(b, this.goal[0], this.goal[1], 1, 0.3); return; }
    let fx = 0, fz = 0, danger = false;
    for (const ball of L.balls) {
      if (!ball.live) continue;
      const p = ball.body.pos, v = ball.vel;
      if (!ball.landed) {
        // falling: the shadow shows where; flee it once noticed
        const fallT = (p.y - ball.r) / 20;
        if (fallT > 1.6 - this.notice) continue;
        const dx = b.pos.x - ball.tx, dz = b.pos.z - ball.tz;
        const d = Math.hypot(dx, dz);
        if (d < ball.r + 1.9) { danger = true; fx += (dx / (d || 1)) * 2; fz += (dz / (d || 1)) * 2; }
      } else if (p.y > -1) {
        // rolling: step out of its way
        const dx = b.pos.x - p.x, dz = b.pos.z - p.z;
        const d = Math.hypot(dx, dz);
        const sp = Math.hypot(v.x, v.z);
        if (d < 4 && sp > 0.5) {
          const toward = -(dx * v.x + dz * v.z) / (d * sp);
          if (toward < -0.3) {
            danger = true;
            // perpendicular to the ball's motion, away from it
            let px = -v.z / sp, pz = v.x / sp;
            if (px * dx + pz * dz < 0) { px = -px; pz = -pz; }
            fx += px * 1.5; fz += pz * 1.5;
          }
        }
      }
    }
    if (danger) {
      // don't flee off the edge
      const r = Math.hypot(b.pos.x, b.pos.z);
      if (r > 6.5) { fx -= (b.pos.x / r) * 1.5; fz -= (b.pos.z / r) * 1.5; }
      steer(b, b.pos.x + fx, b.pos.z + fz, 1, 0.05);
      return;
    }
    steer(b, this.goal[0], this.goal[1], 0.6, 0.6);
  }
}

export const rain = makeRain(false);
export const rainFinal = makeRain(true);
export { clamp };
