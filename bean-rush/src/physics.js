// Collision world for the beans. Beans are approximated by three stacked spheres and pushed
// out of every shape they overlap. Shapes belong to bodies; a body can be static or kinematic
// (moved by level code each step), and exposes its surface velocity so beans ride platforms
// and get swatted by sweepers.

import { Vector3, Quaternion } from 'three';

export const BOX = 1;
export const CYL = 2;
export const SPHERE = 3;
export const CAPSULE = 4; // segment along local X with a radius
export const SECTOR = 5; // annular pie slice, vertical axis
export const CUSTOM = 6; // shape.collide / shape.rayDown supplied by level code

const _v = new Vector3();
const _q = new Quaternion();

export class Shape {
  constructor(type, o = {}) {
    this.type = type;
    this.lp = o.pos ? new Vector3().copy(o.pos) : new Vector3();
    this.lq = o.quat ? new Quaternion().copy(o.quat) : new Quaternion();
    this.wp = new Vector3();
    this.wq = new Quaternion();
    this.iq = new Quaternion();
    this.enabled = true;
    this.body = null;
    this.tag = o.tag || null;
    this.he = o.half ? new Vector3().copy(o.half) : new Vector3(0.5, 0.5, 0.5); // box half extents
    this.r = o.r ?? 0.5; // cyl / sphere / capsule radius, sector outer radius
    this.rIn = o.rIn ?? 0; // sector inner radius
    this.hh = o.hh ?? 0.5; // cyl / sector half height, capsule half length
    this.a0 = o.a0 ?? 0; // sector angles (body local, measured atan2(z, x))
    this.a1 = o.a1 ?? Math.PI / 2;
    this.collide = o.collide || null;
    this.rayDown = o.rayDown || null;
    this.br = o.br ?? this.computeBound();
  }

  computeBound() {
    switch (this.type) {
      case BOX: return this.he.length();
      case CYL: return Math.hypot(this.r, this.hh);
      case SPHERE: return this.r;
      case CAPSULE: return this.hh + this.r;
      case SECTOR: return Math.hypot(this.r, this.hh);
      default: return 1e6;
    }
  }
}

export class Body {
  constructor(o = {}) {
    this.pos = o.pos ? new Vector3().copy(o.pos) : new Vector3();
    this.quat = o.quat ? new Quaternion().copy(o.quat) : new Quaternion();
    this.prevPos = this.pos.clone();
    this.prevQuat = this.quat.clone();
    this.vel = new Vector3();
    this.angVel = new Vector3();
    this.shapes = [];
    this.enabled = true;
    this.kinematic = !!o.kinematic;
    this.hazard = o.hazard || 0; // >0: swats beans that it moves into
    this.bounce = o.bounce || 0; // >0: bumper
    this.ground = o.ground ?? true; // AI ground probes may stand on it
    this.slip = o.slip || 0; // 0 = grippy, 1 = ice
    this.conveyor = o.conveyor ? new Vector3().copy(o.conveyor) : null;
    this.onContact = o.onContact || null; // (bean, contact) => void
    this.solid = o.solid ?? true; // false = contact callback only (trigger-ish)
    this.mesh = null;
    this.data = o.data || {};
  }

  add(shape) {
    shape.body = this;
    this.shapes.push(shape);
    return shape;
  }

  // Remember last transform (for render interpolation) — call once per step before moving.
  savePrev() {
    this.prevPos.copy(this.pos);
    this.prevQuat.copy(this.quat);
  }

  updateWorld() {
    for (const s of this.shapes) {
      s.wq.multiplyQuaternions(this.quat, s.lq);
      s.iq.copy(s.wq).invert();
      s.wp.copy(s.lp).applyQuaternion(this.quat).add(this.pos);
    }
  }

  // Velocity of the body's surface at world point p.
  pointVel(p, out) {
    out.copy(this.vel);
    if (this.angVel.x !== 0 || this.angVel.y !== 0 || this.angVel.z !== 0) {
      _v.subVectors(p, this.pos);
      const ax = this.angVel.x, ay = this.angVel.y, az = this.angVel.z;
      out.x += ay * _v.z - az * _v.y;
      out.y += az * _v.x - ax * _v.z;
      out.z += ax * _v.y - ay * _v.x;
    }
    return out;
  }
}

// Contact record, reused.
export class Contact {
  constructor() {
    this.n = new Vector3();
    this.depth = 0;
    this.shape = null;
    this.body = null;
    this.sub = -1; // sub-id for custom shapes (e.g. which hex tile)
  }
}

const L = new Vector3();

function contactBox(s, cx, cy, cz, r, c) {
  L.set(cx - s.wp.x, cy - s.wp.y, cz - s.wp.z).applyQuaternion(s.iq);
  const h = s.he;
  const px = L.x < -h.x ? -h.x : L.x > h.x ? h.x : L.x;
  const py = L.y < -h.y ? -h.y : L.y > h.y ? h.y : L.y;
  const pz = L.z < -h.z ? -h.z : L.z > h.z ? h.z : L.z;
  const dx = L.x - px, dy = L.y - py, dz = L.z - pz;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > r * r) return false;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    c.n.set(dx / d, dy / d, dz / d);
    c.depth = r - d;
  } else {
    const ex = h.x - Math.abs(L.x), ey = h.y - Math.abs(L.y), ez = h.z - Math.abs(L.z);
    if (ey <= ex && ey <= ez) { c.n.set(0, L.y < 0 ? -1 : 1, 0); c.depth = r + ey; }
    else if (ex <= ez) { c.n.set(L.x < 0 ? -1 : 1, 0, 0); c.depth = r + ex; }
    else { c.n.set(0, 0, L.z < 0 ? -1 : 1); c.depth = r + ez; }
  }
  c.n.applyQuaternion(s.wq);
  return true;
}

// Vertical cylinder centred on (x,y,z). Exported so custom shapes (hex tiles) can reuse it.
export function contactCylRaw(x, y, z, R, hh, cx, cy, cz, r, c) {
  const lx = cx - x, ly = cy - y, lz = cz - z;
  const dr = Math.sqrt(lx * lx + lz * lz);
  const qy = ly < -hh ? -hh : ly > hh ? hh : ly;
  let qx = lx, qz = lz;
  if (dr > R) { qx = (lx / dr) * R; qz = (lz / dr) * R; }
  const dx = lx - qx, dy = ly - qy, dz = lz - qz;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > r * r) return false;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    c.n.set(dx / d, dy / d, dz / d);
    c.depth = r - d;
  } else {
    const et = hh - Math.abs(ly), es = R - dr;
    if (et <= es) { c.n.set(0, ly < 0 ? -1 : 1, 0); c.depth = r + et; }
    else if (dr > 1e-6) { c.n.set(lx / dr, 0, lz / dr); c.depth = r + es; }
    else { c.n.set(1, 0, 0); c.depth = r + es; }
  }
  return true;
}

function contactSphere(s, cx, cy, cz, r, c) {
  const dx = cx - s.wp.x, dy = cy - s.wp.y, dz = cz - s.wp.z;
  const rr = s.r + r;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > rr * rr) return false;
  const d = Math.sqrt(d2);
  if (d > 1e-6) c.n.set(dx / d, dy / d, dz / d);
  else c.n.set(0, 1, 0);
  c.depth = rr - d;
  return true;
}

function contactCapsule(s, cx, cy, cz, r, c) {
  L.set(cx - s.wp.x, cy - s.wp.y, cz - s.wp.z).applyQuaternion(s.iq);
  const t = L.x < -s.hh ? -s.hh : L.x > s.hh ? s.hh : L.x;
  const dx = L.x - t, dy = L.y, dz = L.z;
  const rr = s.r + r;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > rr * rr) return false;
  const d = Math.sqrt(d2);
  if (d > 1e-6) c.n.set(dx / d, dy / d, dz / d);
  else c.n.set(0, 1, 0);
  c.depth = rr - d;
  c.n.applyQuaternion(s.wq);
  return true;
}

function normAng(a) {
  a %= Math.PI * 2;
  return a < 0 ? a + Math.PI * 2 : a;
}

function contactSector(s, cx, cy, cz, r, c) {
  L.set(cx - s.wp.x, cy - s.wp.y, cz - s.wp.z).applyQuaternion(s.iq);
  const span = s.a1 - s.a0;
  const rr = Math.sqrt(L.x * L.x + L.z * L.z);
  const ang = Math.atan2(L.z, L.x);
  const da = normAng(ang - s.a0);
  let qx, qz;
  const inside = da <= span;
  if (inside) {
    const rc = rr < s.rIn ? s.rIn : rr > s.r ? s.r : rr;
    if (rr > 1e-6) { qx = (L.x / rr) * rc; qz = (L.z / rr) * rc; }
    else { qx = Math.cos(s.a0 + span / 2) * rc; qz = Math.sin(s.a0 + span / 2) * rc; }
  } else {
    // nearest bounding edge
    const e = da - span < Math.PI * 2 - da ? s.a1 : s.a0;
    const ex = Math.cos(e), ez = Math.sin(e);
    let t = L.x * ex + L.z * ez;
    t = t < s.rIn ? s.rIn : t > s.r ? s.r : t;
    qx = ex * t; qz = ez * t;
  }
  const qy = L.y < -s.hh ? -s.hh : L.y > s.hh ? s.hh : L.y;
  const dx = L.x - qx, dy = L.y - qy, dz = L.z - qz;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > r * r) return false;
  if (d2 > 1e-10) {
    const d = Math.sqrt(d2);
    c.n.set(dx / d, dy / d, dz / d);
    c.depth = r - d;
  } else {
    // centre inside the solid: push out the nearest face
    const et = s.hh - Math.abs(L.y);
    const eo = s.r - rr;
    const ei = s.rIn > 0 ? rr - s.rIn : 1e9;
    const e0 = rr * Math.sin(da);
    const e1 = rr * Math.sin(span - da);
    let m = et; c.n.set(0, L.y < 0 ? -1 : 1, 0);
    if (eo < m) { m = eo; c.n.set(L.x / rr, 0, L.z / rr); }
    if (ei < m) { m = ei; c.n.set(-L.x / rr, 0, -L.z / rr); }
    if (e0 < m) { m = e0; c.n.set(Math.sin(s.a0), 0, -Math.cos(s.a0)); }
    if (e1 < m) { m = e1; c.n.set(-Math.sin(s.a1), 0, Math.cos(s.a1)); }
    c.depth = r + m;
  }
  c.n.applyQuaternion(s.wq);
  return true;
}

export class World {
  constructor() {
    this.bodies = [];
    this.shapes = [];
    this.contacts = [];
    for (let i = 0; i < 64; i++) this.contacts.push(new Contact());
    this.nContacts = 0;
    this._cand = [];
  }

  add(body) {
    this.bodies.push(body);
    for (const s of body.shapes) this.shapes.push(s);
    body.updateWorld();
    return body;
  }

  remove(body) {
    const i = this.bodies.indexOf(body);
    if (i >= 0) this.bodies.splice(i, 1);
    this.shapes = this.shapes.filter((s) => s.body !== body);
  }

  // Gather shapes whose bounds come within `rad` of (x,y,z).
  gather(x, y, z, rad) {
    const out = this._cand;
    out.length = 0;
    const sh = this.shapes;
    for (let i = 0; i < sh.length; i++) {
      const s = sh[i];
      if (!s.enabled || !s.body.enabled) continue;
      if (s.type === CUSTOM) { out.push(s); continue; }
      const dx = x - s.wp.x, dy = y - s.wp.y, dz = z - s.wp.z;
      const rr = rad + s.br;
      if (dx * dx + dy * dy + dz * dz < rr * rr) out.push(s);
    }
    return out;
  }

  // Contacts between a sphere and a candidate list; returns count, records in this.contacts.
  sphereVs(cands, cx, cy, cz, r) {
    let n = 0;
    const cs = this.contacts;
    for (let i = 0; i < cands.length; i++) {
      const s = cands[i];
      if (s.type === CUSTOM) {
        n = s.collide(cx, cy, cz, r, cs, n);
        continue;
      }
      const c = cs[n];
      let hit = false;
      switch (s.type) {
        case BOX: hit = contactBox(s, cx, cy, cz, r, c); break;
        case CYL: hit = contactCylRaw(s.wp.x, s.wp.y, s.wp.z, s.r, s.hh, cx, cy, cz, r, c); break;
        case SPHERE: hit = contactSphere(s, cx, cy, cz, r, c); break;
        case CAPSULE: hit = contactCapsule(s, cx, cy, cz, r, c); break;
        case SECTOR: hit = contactSector(s, cx, cy, cz, r, c); break;
      }
      if (hit) {
        c.shape = s;
        c.body = s.body;
        c.sub = -1;
        n++;
        if (n >= cs.length) cs.push(new Contact());
      }
    }
    return n;
  }

  // Cast a vertical ray downward from (x,y,z). Returns hit height or -Infinity.
  // opts.groundOnly skips bodies not flagged as ground (hazards, balls).
  rayDown(x, y, z, maxDist, groundOnly = false, hit = null) {
    let best = -Infinity;
    let bestShape = null;
    const minY = y - maxDist;
    const sh = this.shapes;
    for (let i = 0; i < sh.length; i++) {
      const s = sh[i];
      if (!s.enabled || !s.body.enabled || !s.body.solid) continue;
      if (groundOnly && !s.body.ground) continue;
      let h = -Infinity;
      if (s.type === CUSTOM) {
        if (s.rayDown) h = s.rayDown(x, y, z, maxDist);
      } else {
        const dx = x - s.wp.x, dz = z - s.wp.z;
        if (dx * dx + dz * dz > s.br * s.br) continue;
        if (s.wp.y - s.br > y) continue;
        h = rayShape(s, x, y, z);
      }
      if (h <= y + 1e-4 && h >= minY && h > best) { best = h; bestShape = s; }
    }
    if (hit) hit.shape = bestShape;
    return best;
  }
}

// Highest surface point under (x, ·, z) that lies at or below y.
function rayShape(s, x, y, z) {
  switch (s.type) {
    case CYL: {
      const dx = x - s.wp.x, dz = z - s.wp.z;
      if (dx * dx + dz * dz > s.r * s.r) return -Infinity;
      const top = s.wp.y + s.hh;
      return top <= y ? top : -Infinity;
    }
    case SPHERE: {
      const dx = x - s.wp.x, dz = z - s.wp.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > s.r * s.r) return -Infinity;
      const top = s.wp.y + Math.sqrt(s.r * s.r - d2);
      return top <= y ? top : -Infinity;
    }
    case SECTOR: {
      L.set(x - s.wp.x, 0, z - s.wp.z).applyQuaternion(s.iq);
      const rr = Math.hypot(L.x, L.z);
      if (rr > s.r || rr < s.rIn) return -Infinity;
      const da = normAng(Math.atan2(L.z, L.x) - s.a0);
      if (da > s.a1 - s.a0) return -Infinity;
      const top = s.wp.y + s.hh;
      return top <= y ? top : -Infinity;
    }
    case BOX:
    case CAPSULE: {
      // Ray (x, y, z) -> downward, in shape local space; slab test.
      _q.copy(s.iq);
      L.set(x - s.wp.x, y - s.wp.y, z - s.wp.z).applyQuaternion(_q);
      _v.set(0, -1, 0).applyQuaternion(_q);
      const h = s.type === BOX ? s.he : null;
      const hx = h ? h.x : s.hh + s.r, hy = h ? h.y : s.r, hz = h ? h.z : s.r;
      let tmin = 0, tmax = 1e5;
      const o = [L.x, L.y, L.z], d = [_v.x, _v.y, _v.z], e = [hx, hy, hz];
      for (let k = 0; k < 3; k++) {
        if (Math.abs(d[k]) < 1e-8) {
          if (o[k] < -e[k] || o[k] > e[k]) return -Infinity;
        } else {
          let t1 = (-e[k] - o[k]) / d[k], t2 = (e[k] - o[k]) / d[k];
          if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
          if (t1 > tmin) tmin = t1;
          if (t2 < tmax) tmax = t2;
          if (tmin > tmax) return -Infinity;
        }
      }
      return y - tmin;
    }
  }
  return -Infinity;
}
