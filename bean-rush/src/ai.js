// Bot brains. Race levels share PathBrain (follow a corridor polyline, jump gaps, react to
// hazard hints, pick doors). Arena levels provide their own brain via level.brain().

import { clamp } from './util.js';

export function makeBrain(sim, bean, skill) {
  if (sim.level.brain) return sim.level.brain(sim, bean, skill);
  return new PathBrain(sim, bean, skill);
}

// Ground height under (x,z) searched from y+up down to y-down; -Infinity if none.
export function groundAt(world, x, y, z, up = 1.2, down = 3) {
  return world.rayDown(x, y + up, z, up + down, true);
}

export class Path {
  // nodes: [{x, z, w, lanes?, door?, slow?}]  segment i uses node i's properties
  constructor(nodes) {
    this.n = nodes;
    this.len = [];
    this.cum = [0];
    this.dir = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const l = Math.hypot(dx, dz) || 1e-3;
      this.len.push(l);
      this.dir.push([dx / l, dz / l]);
      this.cum.push(this.cum[i] + l);
    }
    this.total = this.cum[this.cum.length - 1];
  }

  // Closest segment to (x,z) searching around `hint`. Returns {i, t, s, d}.
  project(x, z, hint = 0, out = {}) {
    let best = 1e9;
    const lo = Math.max(0, hint - 2), hi = Math.min(this.len.length - 1, hint + 3);
    for (let i = lo; i <= hi; i++) {
      const a = this.n[i];
      const [dx, dz] = this.dir[i];
      let t = (x - a.x) * dx + (z - a.z) * dz;
      t = clamp(t, 0, this.len[i]);
      const px = a.x + dx * t, pz = a.z + dz * t;
      const d = Math.hypot(x - px, z - pz);
      // mild bias toward later segments so beans move on at corners
      const score = d - i * 0.01;
      if (score < best) { best = score; out.i = i; out.t = t; out.s = this.cum[i] + t; out.d = d; }
    }
    return out;
  }

  projectGlobal(x, z, out = {}) {
    let best = 1e9;
    for (let i = 0; i < this.len.length; i++) {
      const a = this.n[i];
      const [dx, dz] = this.dir[i];
      let t = clamp((x - a.x) * dx + (z - a.z) * dz, 0, this.len[i]);
      const d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
      if (d < best) { best = d; out.i = i; out.t = t; out.s = this.cum[i] + t; out.d = d; }
    }
    return out;
  }

  // Point at arc length s: {x, z, i}
  at(s, out = {}) {
    s = clamp(s, 0, this.total);
    let i = 0;
    while (i < this.len.length - 1 && this.cum[i + 1] < s) i++;
    const a = this.n[i];
    const t = s - this.cum[i];
    out.x = a.x + this.dir[i][0] * t;
    out.z = a.z + this.dir[i][1] * t;
    out.i = i;
    return out;
  }
}

const P = {};
const Q = {};

export class PathBrain {
  constructor(sim, bean, skill) {
    this.sim = sim;
    this.b = bean;
    this.skill = skill;
    this.rng = sim.rng;
    this.path = sim.level.path;
    this.seg = 0;
    this.lane = (this.rng() * 2 - 1) * 0.85;
    this.laneTimer = this.rng.range(2, 6);
    this.laneChoice = {};
    this.doorPick = {};
    this.waitT = 0;
    this.bestS = 0;
    this.stuckT = 0;
    this.hesitate = 0;
    this.jumpCd = 0;
    this.react = 0.05 + (1 - skill) * 0.16; // seconds of reaction lag
    this.blunder = 0.015 + (1 - skill) * 0.1; // chance to misjudge a timed hazard
    this.timingSpread = 0.025 + (1 - skill) * 0.07;
    this.timingErr = 0;
    this.ignoreT = 0;
    this.hintT = 0;
    this.lastHint = null;
    this.mood = this.rng.range(0.92, 1); // throttle
  }

  onRespawn() {
    const pr = this.path.projectGlobal(this.b.pos.x, this.b.pos.z, P);
    this.seg = pr.i;
    this.bestS = pr.s;
    this.stuckT = 0;
    this.waitT = 0;
    this.hesitate = this.rng.range(0.1, 0.6) * (1.2 - this.skill);
  }

  think(dt) {
    const b = this.b;
    const sim = this.sim;
    if (b.frozen) { b.mx = b.mz = 0; return; }
    if (b.finished) { this.celebrate(dt); return; }
    if (this.jumpCd > 0) this.jumpCd -= dt;
    if (this.hesitate > 0) { this.hesitate -= dt; b.mx = b.mz = 0; return; }

    const path = this.path;
    const pr = path.project(b.pos.x, b.pos.z, this.seg, P);
    this.seg = pr.i;
    const node = path.n[pr.i];

    // stuck detection
    if (pr.s > this.bestS + 0.6) { this.bestS = pr.s; this.stuckT = 0; }
    else if (b.state === 'normal' && this.waitT <= 0) this.stuckT += dt;
    if (this.stuckT > 2.6 && this.jumpCd <= 0) {
      b.jumpPressed = true;
      this.jumpCd = 0.8;
      this.lane = clamp(-this.lane + this.rng.range(-0.4, 0.4), -0.9, 0.9);
      this.doorPick = {};
      this.stuckT = 1.2;
      this.unstick = (this.unstick || 0) + 1;
      if (this.unstick > 5) { this.unstick = 0; sim.respawn(b); return; }
    }

    this.laneTimer -= dt;
    if (this.laneTimer < 0) {
      this.laneTimer = this.rng.range(2.5, 7);
      this.lane = clamp(this.lane + this.rng.range(-0.6, 0.6), -0.9, 0.9);
    }

    // target point ahead on the path
    const look = node.look ?? 3.2;
    const tp = path.at(pr.s + look, Q);
    const tnode = path.n[tp.i];
    const [dx, dz] = path.dir[tp.i];
    const rx = -dz, rz = dx; // right-hand lateral axis (perpendicular)
    let tx = tp.x, tz = tp.z;
    if (tnode.lanes) {
      let li = this.laneChoice[tp.i];
      if (li === undefined) {
        // nearest lane with some randomness
        const lat = (b.pos.x - tp.x) * rx + (b.pos.z - tp.z) * rz;
        let best = 0, bd = 1e9;
        tnode.lanes.forEach((l, k) => { const d = Math.abs(l - lat) + this.rng() * 3; if (d < bd) { bd = d; best = k; } });
        li = this.laneChoice[tp.i] = best;
      }
      const off = tnode.lanes[li] + this.lane * (tnode.laneW || 0.4);
      tx += rx * off; tz += rz * off;
    } else if (tnode.door !== undefined) {
      const door = this.pickDoor(tnode.door);
      if (door) {
        tx = door.x;
        // aim through the doorway, not at its centre plane
        tz = Math.min(tz, door.z - 1);
        if (b.pos.z > door.z + 0.2) tz = door.z - 2;
      }
    } else {
      const off = this.lane * (tnode.w || 2);
      tx += rx * off; tz += rz * off;
    }

    let mx = tx - b.pos.x, mz = tz - b.pos.z;
    let ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    let throttle = this.mood;

    // Hazard hints from the level. Timing hints (jump) are checked every frame against a
    // per-bot timing error; slower hints (wait / dodge) are sampled at the bot's reaction rate.
    let wantJump = false, wantWait = false;
    const hz = sim.level.hazards;
    if (this.ignoreT > 0) this.ignoreT -= dt;
    this.hintT -= dt;
    const sample = this.hintT <= 0;
    if (sample) { this.hintT = this.react * this.rng.range(0.6, 1.2); this.lastHint = null; }
    if (hz) {
      for (const h of hz) {
        if (!h.aiHint) continue;
        const r = h.aiHint(b, this);
        if (!r) continue;
        if (r.jump) {
          if (this.ignoreT > 0) continue;
          if (this.rng() < this.blunder) { this.ignoreT = 0.45; continue; }
          wantJump = true;
          this.timingErr = this.rng.range(-1, 1) * this.timingSpread;
          break;
        }
        if (sample && !this.lastHint) this.lastHint = r;
      }
    }
    const hint = this.lastHint;
    if (hint) {
      if (hint.wait) wantWait = true;
      if (hint.dodge) { mx += rx * hint.dodge * 1.6; mz += rz * hint.dodge * 1.6; ml = Math.hypot(mx, mz); mx /= ml; mz /= ml; }
      if (hint.slow) throttle *= hint.slow;
    }

    // Gap logic
    if (b.grounded && b.state === 'normal') {
      const y = b.pos.y;
      const g1 = groundAt(sim.world, b.pos.x + mx * 0.95, y, b.pos.z + mz * 0.95, 1.3, 2.6);
      if (g1 === -Infinity || g1 < y - 2.5) {
        const g2 = groundAt(sim.world, b.pos.x + mx * 2.4, y, b.pos.z + mz * 2.4, 1.2, 1.8);
        const g3 = groundAt(sim.world, b.pos.x + mx * 3.6, y, b.pos.z + mz * 3.6, 1.0, 1.8);
        const ok2 = g2 > y - 1.8 && g2 < y + 1.0;
        const ok3 = g3 > y - 1.8 && g3 < y + 0.9;
        if (ok2 || ok3) {
          wantJump = true;
          this.waitT = 0;
          if (!ok2 && ok3) this.diveLater = 0.32;
        } else {
          this.waitT += dt;
          wantWait = this.waitT < 3 + this.skill * 3;
          if (!wantWait) { wantJump = true; this.waitT = 0; }
        }
      } else if (this.waitT > 0) this.waitT = Math.max(0, this.waitT - dt * 2);
    }

    if (this.diveLater !== undefined) {
      this.diveLater -= dt;
      if (this.diveLater <= 0) {
        if (!b.grounded && b.vel.y < 2) b.divePressed = true;
        this.diveLater = undefined;
      }
    }

    if (wantWait && !wantJump) throttle = 0;
    b.mx = mx * throttle;
    b.mz = mz * throttle;
    if (wantJump && b.grounded && this.jumpCd <= 0) {
      b.jumpPressed = true;
      this.jumpCd = 0.35;
    }

    // Random flourish dives near the end or on long straights
    const remain = path.total - pr.s;
    if (remain < 7 && remain > 2 && b.grounded && b.state === 'normal' && this.rng() < 0.03) b.divePressed = true;
  }

  pickDoor(rowId) {
    const row = this.sim.level.doorRows[rowId];
    if (!row) return null;
    let d = this.doorPick[rowId];
    if (d && !d.solidKnown) return d;
    // Prefer doors already smashed open; otherwise any not known to be solid.
    const open = row.doors.filter((x) => x.open);
    const unknown = row.doors.filter((x) => !x.open && !x.solidKnown);
    let pool = open.length && (this.rng() < 0.75 || !unknown.length) ? open : unknown;
    if (!pool.length) pool = row.doors.filter((x) => !x.solidKnown);
    if (!pool.length) pool = row.doors;
    // weigh by distance
    const bx = this.b.pos.x;
    pool = pool.slice().sort((a, c) => Math.abs(a.x - bx) - Math.abs(c.x - bx) + (this.rng() - 0.5) * 6);
    d = pool[0];
    this.doorPick[rowId] = d;
    return d;
  }

  celebrate(dt) {
    const b = this.b;
    b.mx = b.mz = 0;
    if (b.grounded && this.rng() < dt * 0.7) b.jumpPressed = true;
  }
}

// Shared helper for arena brains: steer toward a point with a throttle.
export function steer(b, tx, tz, throttle = 1, stopDist = 0.25) {
  const dx = tx - b.pos.x, dz = tz - b.pos.z;
  const d = Math.hypot(dx, dz);
  if (d < stopDist) { b.mx = b.mz = 0; return d; }
  const k = Math.min(1, d / 1.2) * throttle;
  b.mx = (dx / d) * k;
  b.mz = (dz / d) * k;
  return d;
}
