// Reusable obstacles and set pieces. Each returns the body plus an `aiHint` where bots need one.

import { Quaternion, Vector3 } from 'three';
import { TAU } from '../util.js';

export const LK = {
  floorLilac: { top: { t: 'grid', c: '#cdbdff', c2: '#bba6ff', s: 3 }, side: { t: 'hstripe', c: '#ff8fcf', c2: '#ffd1ec', s: 1.2 } },
  floorMint: { top: { t: 'grid', c: '#bff3dc', c2: '#a6e9cb', s: 3 }, side: { t: 'hstripe', c: '#5cc9a7', c2: '#c7f5e5', s: 1.2 } },
  floorSky: { top: { t: 'grid', c: '#c3e6ff', c2: '#a9d8ff', s: 3 }, side: { t: 'hstripe', c: '#5aa8ff', c2: '#d4ebff', s: 1.2 } },
  floorPeach: { top: { t: 'grid', c: '#ffe0bf', c2: '#ffd1a3', s: 3 }, side: { t: 'hstripe', c: '#ff9a62', c2: '#ffe2cc', s: 1.2 } },
  floorLemon: { top: { t: 'grid', c: '#fff2a8', c2: '#ffe680', s: 3 }, side: { t: 'hstripe', c: '#ffb84d', c2: '#fff0c9', s: 1.2 } },
  bridge: { top: { t: 'plank', c: '#ffe7b8', c2: '#f3cf8e', s: 2 }, side: { t: 'plain', c: '#d7a463' } },
  start: { top: { t: 'checker', c: '#ffffff', c2: '#ffd9f0', s: 4 }, side: { t: 'hstripe', c: '#ff7ac0', c2: '#ffffff', s: 1.2 } },
  finish: { top: { t: 'grid', c: '#fff5c2', c2: '#ffe680', s: 3 }, side: { t: 'hstripe', c: '#ffc23d', c2: '#fff4d1', s: 1.2 } },
  hub: { top: { t: 'dots', c: '#ffe14d', c2: '#ffb000', s: 1.4 }, side: { t: 'vstripe', c: '#ff4f9a', c2: '#ffffff', s: 1.1 } },
  bar: { t: 'candy', c: '#ff3d7f', c2: '#ffffff', s: 1.3, shiny: 1 },
  barBlue: { t: 'candy', c: '#2fa6ff', c2: '#ffffff', s: 1.3, shiny: 1 },
  ball: { t: 'band', c: '#ff4fa3', c2: '#ffd84d', shiny: 1 },
  steel: { t: 'plain', c: '#8e88c8', shiny: 1 },
  post: { t: 'hstripe', c: '#ffffff', c2: '#ff7ac0', s: 1.6 },
  white: { t: 'plain', c: '#ffffff' },
  rail: { top: { t: 'plain', c: '#ffffff' }, side: { t: 'hstripe', c: '#ffd84d', c2: '#ff9f1c', s: 0.9 } },
  tea: { top: { t: 'grid', c: '#f4dcb8', c2: '#e9c99b', s: 3 }, side: { t: 'hstripe', c: '#b07a4f', c2: '#f4dcb8', s: 1.2 } },
  teaDark: { top: { t: 'grid', c: '#e8c493', c2: '#d9ad74', s: 3 }, side: { t: 'hstripe', c: '#8f5a35', c2: '#e8c493', s: 1.2 } },
  boba: { t: 'plain', c: '#3a2216', shiny: 1 },
  disc: { top: { t: 'spiral', c: '#ffd34d', c2: '#ff8a3d' }, side: { t: 'vstripe', c: '#ffffff', c2: '#ff8a3d', s: 1.4 } },
  disc2: { top: { t: 'spiral', c: '#8fe3ff', c2: '#3d8aff' }, side: { t: 'vstripe', c: '#ffffff', c2: '#3d8aff', s: 1.4 } },
  disc3: { top: { t: 'spiral', c: '#ffb3e1', c2: '#ff4fa3' }, side: { t: 'vstripe', c: '#ffffff', c2: '#ff4fa3', s: 1.4 } },
  wall: { t: 'dots', c: '#7d6cf2', c2: '#9384ff', s: 2 },
  wallTop: { t: 'hstripe', c: '#ffd84d', c2: '#ffffff', s: 1 },
};

// Rotation about Y by `a` maps local +X to world angle -a in atan2(z, x) terms.
const _q = new Quaternion();
const _ax = new Vector3();

export function setYaw(body, a) {
  body.quat.setFromAxisAngle(_ax.set(0, 1, 0), a);
}

// ---------------------------------------------------------------------------
// Low sweeping bar on a hub. Bots jump when an arm is about to reach them.
export function sweeper(k, sim, x, y, z, o = {}) {
  const R = o.len ?? 8.5;
  const barY = o.barY ?? 0.45;
  const r = o.r ?? 0.32;
  const body = k.body(x, y, z, { hazard: o.hazard ?? 0.62, ground: false });
  const hubR = o.hubR ?? 1.1;
  k.addCyl(body, 0, 0.75, 0, hubR, 1.5, { look: LK.hub });
  k.addCapsule(body, 0, barY, 0, R, r, { look: o.look || LK.bar });
  if (o.cross) k.addCapsule(body, 0, barY, 0, R, r, { look: o.look || LK.bar, ry: Math.PI / 2 });
  k.deco(body, (b) => {
    b.sphereAt(0, 1.5, 0, hubR * 0.7, LK.hub.top, 1, 0.55, 1);
    const caps = o.cross ? [[R, 0], [-R, 0], [0, R], [0, -R]] : [[R, 0], [-R, 0]];
    for (const [cx, cz] of caps) b.sphereAt(cx, barY, cz, r * 1.25, { t: 'plain', c: '#ffffff', shiny: 1 });
  });
  const st = { body, x, y, z, R, barY, r, w: o.speed ?? 1, angle: o.phase ?? 0, arms: o.cross ? 4 : 2, kind: 'low' };
  st.update = (dt, wOverride) => {
    if (wOverride !== undefined) st.w = wOverride;
    st.angle += st.w * dt;
    setYaw(body, st.angle);
    body.angVel.set(0, st.w, 0);
  };
  // time until an arm sweeps over the bean's angular position
  // vx, vz: the bean's own velocity, so a bean running around the hub times it correctly
  st.arrival = (bx, bz, vx = 0, vz = 0) => {
    const px = bx - x, pz = bz - z;
    const phi = Math.atan2(pz, px);
    const r2 = px * px + pz * pz || 1e-6;
    const dphi = (px * vz - pz * vx) / r2;
    const alpha = -st.angle;
    const span = TAU / st.arms;
    let d;
    if (st.w > 0) d = (((alpha - phi) % span) + span) % span;
    else d = (((phi - alpha) % span) + span) % span;
    const rate = Math.sign(st.w) * (st.w + dphi);
    return rate > 0.05 ? d / rate : 99;
  };
  st.aiHint = (b, brain) => {
    const dx = b.pos.x - x, dz = b.pos.z - z;
    const rr = Math.hypot(dx, dz);
    if (rr > R + 0.9 || rr < 1.0 || b.pos.y > y + 1.5 || b.pos.y < y - 1) return null;
    if (!b.grounded) return null;
    const t = st.arrival(b.pos.x, b.pos.z, b.vel.x, b.vel.z);
    // Feet clear the bar from ~0.1 s to ~0.57 s into a jump. Centre the bar's pass in that
    // window, i.e. jump when the bar is ~0.33 s away (plus this bot's timing error).
    const lead = 0.335 + (brain.timingErr || 0);
    if (t > lead - 0.03 && t < lead + 0.03) return { jump: true };
    return null;
  };
  return st;
}

// ---------------------------------------------------------------------------
// Pendulum ball swinging across X, hinged at (x, pivotY, z).
export function pendulum(k, sim, x, pivotY, z, o = {}) {
  const L = o.len ?? 7.2;
  const br = o.r ?? 1.25;
  const A = o.amp ?? 0.9;
  const P = o.period ?? 3;
  const ph = o.phase ?? 0;
  const w = TAU / P;
  const body = k.body(x, pivotY, z, { hazard: o.hazard ?? 0.85, ground: false });
  k.addSphere(body, 0, -L, 0, br, { look: o.look || LK.ball });
  k.deco(body, (b) => {
    b.boxAt(0, -(L - br) / 2, 0, 0.18, L - br, 0.18, LK.steel);
    b.cylAt(0, 0, 0, 0.35, 0.8, LK.steel, Math.PI / 2);
  });
  const st = { body, x, z, L, br, A, w, ph };
  st.angleAt = (t) => A * Math.sin(w * t + ph);
  st.offAt = (t) => L * Math.sin(st.angleAt(t));
  st.update = (t) => {
    const a = st.angleAt(t);
    body.quat.setFromAxisAngle(_ax.set(0, 0, 1), a);
    body.angVel.set(0, 0, A * w * Math.cos(w * t + ph));
  };
  st.aiHint = (b, brain) => {
    if (Math.abs(b.pos.x - x) > 2.4) return null;
    const ahead = b.pos.z - z; // course runs toward -Z
    if (ahead < -1.8 || ahead > 4.6) return null;
    if (ahead < 1.95) return null; // inside the swing zone: commit
    const t = sim.time;
    const travel = (ahead + 1.8) / 6.2;
    for (let s = 0.05; s <= travel + 0.15; s += 0.1) {
      if (Math.abs(st.offAt(t + s) - (b.pos.x - x)) < br + 0.9) return { wait: true };
    }
    return null;
  };
  return st;
}

// ---------------------------------------------------------------------------
export function turntable(k, x, y, z, r, h, speed, look) {
  const body = k.body(x, y, z, { slip: 0 });
  k.addCyl(body, 0, 0, 0, r, h, { look: look || LK.disc, seg: 40 });
  k.deco(body, (b) => {
    b.cylAt(0, h / 2 + 0.03, 0, 0.6, 0.06, { t: 'plain', c: '#ffffff' });
  });
  const st = { body, angle: 0, w: speed };
  st.update = (dt) => {
    st.angle += st.w * dt;
    setYaw(body, st.angle);
    body.angVel.set(0, st.w, 0);
  };
  return st;
}

// ---------------------------------------------------------------------------
// A wall of doors spanning x in [-W/2, W/2] at depth z; `fakes` of them are solid.
export function doorRow(k, sim, z, W, n, fakes, look, rowId) {
  const rng = sim.rng;
  const H = 3.4;
  const pw = 0.7;
  const dw = (W - pw * (n + 1)) / n;
  const doors = [];
  const fakeSet = new Set(rng.shuffle([...Array(n).keys()]).slice(0, fakes));
  for (let i = 0; i <= n; i++) {
    const px = -W / 2 + pw / 2 + i * (dw + pw);
    k.box(px, H / 2, z, pw, H, 0.9, { look: LK.post });
  }
  k.box(0, H + 0.7, z, W + 0.4, 1.4, 1.0, { look: { top: LK.wallTop, side: LK.wall } });
  for (let i = 0; i < n; i++) {
    const x = -W / 2 + pw + dw / 2 + i * (dw + pw);
    const door = { x, z, open: false, fake: fakeSet.has(i), solidKnown: false, t: 0, wob: 0, hitCd: 0 };
    const body = k.box(x, H / 2, z, dw - 0.02, H - 0.02, 0.45, {
      kinematic: true,
      look: { top: look, side: look, front: { t: 'door', c: look.c, c2: look.c2 } },
      data: { door },
      onContact(bean, c, s) {
        if (door.open) return;
        if (door.fake) {
          if (!door.solidKnown || door.hitCd <= 0) { s.emit('thud', bean); door.hitCd = 0.5; }
          door.solidKnown = true;
          door.wob = 0.45;
        } else if (bean.state !== 'tumble') {
          door.open = true;
          body.solid = false;
          s.emit('doorBreak', bean, door);
        }
      },
    });
    door.body = body;
    door.home = body.pos.clone();
    doors.push(door);
  }
  const row = { z, doors, id: rowId };
  row.update = (dt) => {
    for (const d of doors) {
      if (d.hitCd > 0) d.hitCd -= dt;
      const b = d.body;
      if (d.open) {
        d.t += dt;
        const f = Math.min(1, d.t * 2.6);
        const ang = -f * f * Math.PI * 0.5; // topple forward (toward -Z)
        // hinge along the bottom of the panel
        const hy = 0, hz = d.home.z;
        b.quat.setFromAxisAngle(_ax.set(1, 0, 0), ang);
        b.pos.set(d.home.x, hy + Math.cos(-ang) * H / 2, hz - Math.sin(-ang) * H / 2);
        if (d.t > 1.2) b.pos.y -= (d.t - 1.2) * 1.5;
        if (d.t > 2.2) { b.enabled = false; b.hidden = true; }
      } else if (d.wob > 0) {
        d.wob = Math.max(0, d.wob - dt);
        b.quat.setFromAxisAngle(_ax.set(1, 0, 0), Math.sin(d.wob * 40) * d.wob * 0.12);
      }
    }
  };
  return row;
}

// ---------------------------------------------------------------------------
// Ramp from (z0, y0) to (z1, y1) along -Z with top surface on those heights.
export function ramp(k, x, z0, y0, z1, y1, w, thick, look) {
  const dz = z0 - z1; // positive length along -Z
  const dy = y1 - y0;
  const len = Math.hypot(dz, dy);
  const th = Math.atan2(dy, dz);
  const cz = (z0 + z1) / 2, cy = (y0 + y1) / 2;
  const nY = Math.cos(th), nZ = Math.sin(th);
  return k.box(x, cy - nY * thick / 2, cz - nZ * thick / 2, w, thick, len + 0.3, { rx: th, look });
}

// ---------------------------------------------------------------------------
// Decorative arch spanning width W at depth z (with optional banner text texture).
export function arch(k, x, y, z, W, o = {}) {
  const H = o.h ?? 6;
  const colA = o.c || '#ff5fa2';
  k.box(x - W / 2, y + H / 2, z, 1.1, H, 1.1, { look: { top: { t: 'plain', c: '#ffffff' }, side: { t: 'hstripe', c: colA, c2: '#ffffff', s: 1.4 } } });
  k.box(x + W / 2, y + H / 2, z, 1.1, H, 1.1, { look: { top: { t: 'plain', c: '#ffffff' }, side: { t: 'hstripe', c: colA, c2: '#ffffff', s: 1.4 } } });
  k.deco(null, (b) => {
    b.boxAt(x, y + H + 0.6, z, W + 1.6, 1.6, 1.2, { side: { t: o.banner || 'checker', c: '#ffffff', c2: '#2b2d5c', s: 1.6, text: o.text }, top: { t: 'plain', c: colA } });
    b.sphereAt(x - W / 2, y + H + 0.2, z, 0.9, { t: 'plain', c: '#ffd84d', shiny: 1 });
    b.sphereAt(x + W / 2, y + H + 0.2, z, 0.9, { t: 'plain', c: '#ffd84d', shiny: 1 });
  });
}

// Conveyor strip: a thin static box whose surface pushes beans along `dir`.
export function conveyor(k, x, y, z, w, d, vx, vz, o = {}) {
  const body = k.box(x, y - 0.1, z, w, 0.22, d, {
    conveyor: new Vector3(vx, 0, vz),
    rx: o.rx || 0,
    look: { top: { t: 'arrow', c: '#5a5c8f', c2: '#ffd84d', s: 2, scroll: [vx, vz] }, side: { t: 'plain', c: '#3b3d6e' } },
  });
  return body;
}

// Shared spawn grid on a rectangle facing -Z.
export function gridSpawns(n, cx, cz, w, d, y, rng, yaw = Math.PI) {
  const cols = Math.max(1, Math.round(Math.sqrt(n * w / d)));
  const rows = Math.ceil(n / cols);
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    const x = cx - w / 2 + (cols === 1 ? w / 2 : (c / (cols - 1)) * w) + rng.range(-0.25, 0.25);
    const z = cz - d / 2 + (rows === 1 ? d / 2 : (r / (rows - 1)) * d) + rng.range(-0.2, 0.2);
    out.push({ x, y, z, yaw });
  }
  return out;
}

export function areaSpawner(x0, x1, z0, z1, y, yaw = Math.PI) {
  return (rng) => ({ x: rng.range(x0, x1), y, z: rng.range(z0, z1), yaw });
}
