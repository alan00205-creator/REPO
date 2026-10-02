// A contestant: physical state, movement controller and collision response.

import { Vector3 } from 'three';
import { clamp, dampAngle } from './util.js';

export const BEAN_R = 0.42;
export const BEAN_H = 1.5;
const OFFS = [BEAN_R, BEAN_H * 0.5, BEAN_H - BEAN_R];

export const TUNE = {
  run: 6.4,
  accGround: 44,
  decGround: 36,
  accAir: 14,
  jump: 8.7,
  gravity: 26,
  maxFall: 34,
  diveH: 9.4,
  diveV: 4.4,
  coyote: 0.1,
  buffer: 0.13,
};

const tmpV = new Vector3();
const tmpP = new Vector3();

export class Bean {
  constructor(id, o = {}) {
    this.id = id;
    this.name = o.name || 'bean';
    this.isPlayer = !!o.isPlayer;
    this.look = o.look || null; // cosmetics
    this.speedMul = o.speedMul || 1;

    this.pos = new Vector3();
    this.prevPos = new Vector3();
    this.vel = new Vector3();
    this.yaw = 0;
    this.prevYaw = 0;

    // control inputs (world space move vector, edge-triggered buttons)
    this.mx = 0;
    this.mz = 0;
    this.jumpPressed = false;
    this.divePressed = false;
    this.frozen = false;

    this.state = 'normal'; // normal | dive | slide | tumble | getup
    this.stateT = 0;
    this.tumbleDur = 1;
    this.knockCd = 0;
    this.ghost = null;
    this.ghostT = 0;
    this.grounded = false;
    this.wasGrounded = false;
    this.groundBody = null;
    this.groundN = new Vector3(0, 1, 0);
    this.groundVel = new Vector3();
    this.groundSlip = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.airT = 0;
    this.fallSpeed = 0;
    this.shadowY = 0;

    this.active = true; // simulated + rendered
    this.out = false; // eliminated
    this.finished = false;
    this.place = 0;
    this.finishT = 0;
    this.checkpoint = 0;
    this.respawnT = 0; // >0 while waiting to respawn (hidden)
    this.lastSafe = new Vector3();
    this.stats = { falls: 0, hits: 0 };
    this.brain = null;
    this.blink = Math.random() * 3;
  }

  place3(x, y, z, yaw) {
    this.pos.set(x, y, z);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.yaw = this.prevYaw = yaw;
    this.state = 'normal';
    this.stateT = 0;
    this.grounded = false;
    this.lastSafe.copy(this.pos);
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
  }

  knock(vx, vy, vz, dur, sim, cause) {
    if (this.knockCd > 0) return false;
    this.vel.set(vx, vy, vz);
    this.setState('tumble');
    this.tumbleDur = dur;
    this.knockCd = 0.45;
    // let the thing that hit us pass through while we tumble, so one hit is one tumble
    if (cause && cause.hazard) { this.ghost = cause; this.ghostT = dur + 0.35; }
    this.grounded = false;
    this.stats.hits++;
    if (sim) sim.emit('bonk', this, cause);
    return true;
  }

  step(dt, sim) {
    const world = sim.world;
    const T = TUNE;
    this.prevPos.copy(this.pos);
    this.prevYaw = this.yaw;
    this.stateT += dt;
    if (this.knockCd > 0) this.knockCd -= dt;
    if (this.ghostT > 0) { this.ghostT -= dt; if (this.ghostT <= 0) this.ghost = null; }
    this.blink -= dt;

    if (this.jumpPressed) this.jumpBuf = T.buffer;
    else if (this.jumpBuf > 0) this.jumpBuf -= dt;
    const dive = this.divePressed;
    this.jumpPressed = false;
    this.divePressed = false;

    let mx = this.mx, mz = this.mz;
    if (this.frozen) { mx = 0; mz = 0; this.jumpBuf = 0; }
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }

    const v = this.vel;
    const gv = this.groundVel;
    const grip = 1 - this.groundSlip * 0.88;

    if (this.grounded) this.coyote = T.coyote;
    else if (this.coyote > 0) this.coyote -= dt;

    switch (this.state) {
      case 'normal': {
        const spd = T.run * this.speedMul;
        const dx = mx * spd, dz = mz * spd;
        if (this.grounded) {
          let rx = v.x - gv.x, rz = v.z - gv.z;
          const acc = (ml > 0.05 ? T.accGround : T.decGround) * grip;
          const ex = dx - rx, ez = dz - rz;
          const el = Math.hypot(ex, ez);
          const step = acc * dt;
          if (el <= step) { rx = dx; rz = dz; }
          else { rx += (ex / el) * step; rz += (ez / el) * step; }
          v.x = rx + gv.x;
          v.z = rz + gv.z;
        } else if (ml > 0.05) {
          const ex = dx - v.x, ez = dz - v.z;
          const el = Math.hypot(ex, ez);
          const step = T.accAir * dt;
          // In the air only steer toward the input; never brake momentum the input agrees with.
          if (el > 1e-4) {
            const k = Math.min(1, step / el);
            const nx = v.x + ex * k, nz = v.z + ez * k;
            const cur = Math.hypot(v.x, v.z), nxt = Math.hypot(nx, nz);
            if (nxt >= cur || nxt >= spd * 0.98) { v.x = nx; v.z = nz; }
            else { v.x = nx; v.z = nz; }
          }
        } else {
          v.x *= 1 - 0.6 * dt;
          v.z *= 1 - 0.6 * dt;
        }
        if (ml > 0.08) this.yaw = dampAngle(this.yaw, Math.atan2(mx, mz), 16, dt);

        if (this.jumpBuf > 0 && this.coyote > 0 && !this.frozen) {
          v.y = T.jump + Math.max(0, gv.y);
          this.jumpBuf = 0;
          this.coyote = 0;
          this.grounded = false;
          sim.emit('jump', this);
        } else if (dive && !this.frozen) {
          let fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
          if (ml > 0.2) { fx = mx / ml; fz = mz / ml; this.yaw = Math.atan2(fx, fz); }
          const base = this.grounded ? 1 : 0.92;
          v.x = fx * T.diveH * base * this.speedMul + (this.grounded ? gv.x : 0);
          v.z = fz * T.diveH * base * this.speedMul + (this.grounded ? gv.z : 0);
          v.y = this.grounded ? T.diveV : Math.max(v.y * 0.4 + 2.6, 2.6);
          this.grounded = false;
          this.coyote = 0;
          this.setState('dive');
          sim.emit('dive', this);
        }
        break;
      }
      case 'dive': {
        // slight steering
        if (ml > 0.1) {
          const s = Math.hypot(v.x, v.z);
          const want = Math.atan2(mx, mz);
          const cur = Math.atan2(v.x, v.z);
          const na = dampAngle(cur, want, 1.6, dt);
          v.x = Math.sin(na) * s;
          v.z = Math.cos(na) * s;
          this.yaw = na;
        }
        if (this.grounded && this.stateT > 0.06) {
          this.setState('slide');
          sim.emit('land', this, 6);
        }
        break;
      }
      case 'slide':
      case 'getup':
      case 'tumble': {
        if (this.grounded) {
          const fr = (this.state === 'slide' ? 15 : this.state === 'getup' ? 30 : 9) * grip;
          let rx = v.x - gv.x, rz = v.z - gv.z;
          const rl = Math.hypot(rx, rz);
          const step = fr * dt;
          if (rl <= step) { rx = 0; rz = 0; }
          else { rx -= (rx / rl) * step; rz -= (rz / rl) * step; }
          v.x = rx + gv.x;
          v.z = rz + gv.z;
        }
        if (this.state === 'slide' && this.stateT > 0.32) this.setState('getup');
        else if (this.state === 'getup' && this.stateT > 0.2) this.setState('normal');
        else if (this.state === 'tumble' && this.stateT > this.tumbleDur && (this.grounded || this.stateT > this.tumbleDur + 2.5)) {
          this.setState('getup');
        }
        break;
      }
    }

    // gravity
    v.y -= T.gravity * dt;
    if (v.y < -T.maxFall) v.y = -T.maxFall;

    // integrate + collide in substeps
    this.wasGrounded = this.grounded;
    this.grounded = false;
    this.groundBody = null;
    const prevGV = tmpP.copy(gv);
    gv.set(0, 0, 0);
    this.groundSlip = 0;
    const N = 2;
    const sdt = dt / N;
    for (let k = 0; k < N; k++) {
      this.pos.x += v.x * sdt;
      this.pos.y += v.y * sdt;
      this.pos.z += v.z * sdt;
      this.collide(world, sim, sdt);
    }

    // Stick to the ground when walking down slopes or off descending platforms.
    if (!this.grounded && this.wasGrounded && this.state !== 'tumble' && this.state !== 'dive' && v.y <= prevGV.y + 0.5) {
      const h = world.rayDown(this.pos.x, this.pos.y + 0.25, this.pos.z, 0.6);
      if (h > this.pos.y - 0.32) {
        this.pos.y = h;
        if (v.y < prevGV.y) v.y = prevGV.y;
        this.grounded = true;
        gv.copy(prevGV);
      }
    }

    if (this.grounded) {
      this.airT = 0;
      if (!this.wasGrounded && this.fallSpeed > 3) sim.emit('land', this, this.fallSpeed);
      this.fallSpeed = 0;
      // carry rotation from spinning floors
      if (this.groundBody && this.groundBody.angVel.y !== 0) this.yaw += this.groundBody.angVel.y * dt;
      if (this.groundBody && this.groundBody.data.safe !== false && !this.groundBody.kinematic) this.lastSafe.copy(this.pos);
    } else {
      this.airT += dt;
      if (-v.y > this.fallSpeed) this.fallSpeed = -v.y;
    }

    // shadow height for the renderer + AI
    this.shadowY = world.rayDown(this.pos.x, this.pos.y + 0.3, this.pos.z, 30, true);
  }

  collide(world, sim, dt) {
    const p = this.pos;
    const v = this.vel;
    const sp = Math.hypot(v.x, v.y, v.z) * dt;
    const cands = world.gather(p.x, p.y + BEAN_H * 0.5, p.z, BEAN_H * 0.5 + 0.2 + sp);
    if (cands.length === 0) return;
    for (let iter = 0; iter < 2; iter++) {
      for (let k = 0; k < 3; k++) {
        const oy = OFFS[k];
        const n = world.sphereVs(cands, p.x, p.y + oy, p.z, BEAN_R);
        for (let i = 0; i < n; i++) {
          const c = world.contacts[i];
          const body = c.body;
          if (body === this.ghost) continue;
          if (body.onContact && iter === 0) body.onContact(this, c, sim);
          if (!body.solid || !body.enabled || !c.shape.enabled) continue;
          const nrm = c.n;
          tmpP.set(p.x - nrm.x * BEAN_R, p.y + oy - nrm.y * BEAN_R, p.z - nrm.z * BEAN_R);
          const cv = body.pointVel(tmpP, tmpV);
          if (body.conveyor && nrm.y > 0.5) cv.add(body.conveyor);
          if (k === 0 && nrm.y > 0.55 && !body.hazard) {
            const dy = Math.min(c.depth / nrm.y, c.depth * 2.5 + 0.05);
            p.y += dy;
            if (v.y < cv.y) v.y = cv.y;
            this.grounded = true;
            this.groundBody = body;
            this.groundN.copy(nrm);
            this.groundVel.copy(cv);
            this.groundSlip = body.slip;
            if (body.bounce > 0) {
              v.y = body.bounce;
              this.grounded = false;
              sim.emit('boing', this);
            }
          } else {
            p.x += nrm.x * c.depth;
            p.y += nrm.y * c.depth;
            p.z += nrm.z * c.depth;
            const rvn = (v.x - cv.x) * nrm.x + (v.y - cv.y) * nrm.y + (v.z - cv.z) * nrm.z;
            if (rvn < 0) {
              v.x -= nrm.x * rvn;
              v.y -= nrm.y * rvn;
              v.z -= nrm.z * rvn;
            }
            if (body.hazard > 0) {
              const hs = cv.x * nrm.x + cv.y * nrm.y + cv.z * nrm.z;
              const cs = Math.hypot(cv.x, cv.y, cv.z);
              if (hs > 1.0 && cs > 1.5) {
                let hx = cv.x, hz = cv.z;
                const hl = Math.hypot(hx, hz) || 1;
                hx /= hl; hz /= hl;
                // blend motion direction with the contact normal so beans fly away from the object
                let kx = hx * 0.7 + nrm.x * 0.6, kz = hz * 0.7 + nrm.z * 0.6;
                const kl = Math.hypot(kx, kz) || 1;
                kx /= kl; kz /= kl;
                const pow = body.hazard * (cs * 0.85 + 4);
                this.knock(kx * pow, 5 + Math.min(cs, 12) * 0.35 * body.hazard, kz * pow, 0.8 + Math.min(cs, 14) * 0.035, sim, body);
              }
            } else if (body.bounce > 0) {
              const b = body.bounce;
              v.x = nrm.x * b;
              v.z = nrm.z * b;
              v.y = Math.max(v.y, 4);
              if (this.state !== 'tumble') this.knock(v.x, v.y, v.z, 0.5, sim, body);
              sim.emit('boing', this);
            }
            if (nrm.y < -0.5 && v.y > cv.y) v.y = cv.y;
            if (k === 0 && nrm.y > 0.55 && body.hazard) {
              // standing on top of a moving hazard: ride it
              this.grounded = true;
              this.groundBody = body;
              this.groundVel.copy(cv);
            }
          }
        }
      }
    }
  }
}

// Push overlapping beans apart (cheap, horizontal).
export function separateBeans(beans) {
  const D = BEAN_R * 2 * 0.95;
  for (let i = 0; i < beans.length; i++) {
    const a = beans[i];
    if (!a.active || a.respawnT > 0) continue;
    for (let j = i + 1; j < beans.length; j++) {
      const b = beans[j];
      if (!b.active || b.respawnT > 0) continue;
      const dy = a.pos.y - b.pos.y;
      if (dy > BEAN_H || dy < -BEAN_H) continue;
      let dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= D * D) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-4) { dx = Math.cos(i * 2.39); dz = Math.sin(i * 2.39); d = 1; }
      else { dx /= d; dz /= d; }
      // Stand on a head: if one is clearly above, let it rest there instead of sliding sideways.
      if (Math.abs(dy) > BEAN_H * 0.75) {
        const top = dy > 0 ? a : b;
        const bot = dy > 0 ? b : a;
        if (top.vel.y <= 0.5) {
          top.pos.y = bot.pos.y + BEAN_H * 0.98;
          if (top.vel.y < bot.vel.y) top.vel.y = bot.vel.y;
          top.grounded = true;
          top.groundVel.copy(bot.vel);
          // slide off gently
          top.vel.x += dx * (dy > 0 ? 1 : -1) * 0.6;
          top.vel.z += dz * (dy > 0 ? 1 : -1) * 0.6;
        }
        continue;
      }
      const push = (D - d) * 0.5;
      a.pos.x += dx * push; a.pos.z += dz * push;
      b.pos.x -= dx * push; b.pos.z -= dz * push;
      // exchange a bit of momentum along the normal
      const rv = (a.vel.x - b.vel.x) * dx + (a.vel.z - b.vel.z) * dz;
      if (rv < 0) {
        const imp = rv * 0.5;
        a.vel.x -= dx * imp; a.vel.z -= dz * imp;
        b.vel.x += dx * imp; b.vel.z += dz * imp;
      }
    }
  }
}

export { clamp };
