// Level construction helpers. Every helper creates the collision shape and, when a renderer
// is attached (gfx != null), the matching visual. Headless runs pass gfx = null.

import { Vector3, Quaternion, Euler, Matrix4 } from 'three';
import { Body, Shape, BOX, CYL, SPHERE, CAPSULE, SECTOR, CUSTOM } from './physics.js';

const _e = new Euler();
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3(1, 1, 1);

function quatFrom(o) {
  if (o.quat) return o.quat;
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
  return new Quaternion().setFromEuler(_e);
}

export class Kit {
  constructor(world, gfx, rng) {
    this.world = world;
    this.gfx = gfx;
    this.rng = rng;
    this.statics = gfx ? gfx.builder() : null;
    this.dynamic = []; // [body, builder]
    this.after = [];
  }

  // ---- static geometry -------------------------------------------------
  box(x, y, z, w, h, d, o = {}) {
    const body = new Body({ pos: _p.set(x, y, z), quat: quatFrom(o), ...o });
    body.add(new Shape(BOX, { half: new Vector3(w / 2, h / 2, d / 2), tag: o.tag }));
    this.world.add(body);
    if (this.gfx && o.look !== false) {
      _m.compose(body.pos, body.quat, _s);
      (o.kinematic ? this.ownBuilder(body) : this.statics).box(_m, w, h, d, o.look || 'floor');
    }
    return body;
  }

  cyl(x, y, z, r, h, o = {}) {
    const body = new Body({ pos: _p.set(x, y, z), ...o });
    body.add(new Shape(CYL, { r, hh: h / 2, tag: o.tag }));
    this.world.add(body);
    if (this.gfx && o.look !== false) {
      _m.compose(body.pos, body.quat, _s);
      (o.kinematic ? this.ownBuilder(body) : this.statics).cyl(_m, r, r, h, o.seg || 32, o.look || 'floor');
    }
    return body;
  }

  // ---- kinematic bodies ------------------------------------------------
  body(x, y, z, o = {}) {
    const body = new Body({ pos: _p.set(x, y, z), quat: quatFrom(o), kinematic: true, ...o });
    this.world.add(body);
    return body;
  }

  ownBuilder(body) {
    let rec = this.dynamic.find((d) => d[0] === body);
    if (!rec) { rec = [body, this.gfx.builder()]; this.dynamic.push(rec); }
    return rec[1];
  }

  addBox(body, x, y, z, w, h, d, o = {}) {
    const q = quatFrom(o);
    const s = body.add(new Shape(BOX, { pos: _p.set(x, y, z), quat: q, half: new Vector3(w / 2, h / 2, d / 2), tag: o.tag }));
    this.reindex(body, s);
    if (this.gfx && o.look !== false) {
      _m.compose(_p.set(x, y, z), q, _s);
      this.ownBuilder(body).box(_m, w, h, d, o.look || 'floor');
    }
    return s;
  }

  addCyl(body, x, y, z, r, h, o = {}) {
    const s = body.add(new Shape(CYL, { pos: _p.set(x, y, z), r, hh: h / 2, tag: o.tag }));
    this.reindex(body, s);
    if (this.gfx && o.look !== false) {
      _m.compose(_p.set(x, y, z), _q.identity(), _s);
      this.ownBuilder(body).cyl(_m, r, r, h, o.seg || 32, o.look || 'floor');
    }
    return s;
  }

  addSphere(body, x, y, z, r, o = {}) {
    const s = body.add(new Shape(SPHERE, { pos: _p.set(x, y, z), r, tag: o.tag }));
    this.reindex(body, s);
    if (this.gfx && o.look !== false) {
      _m.compose(_p.set(x, y, z), _q.identity(), _s.set(r, r, r));
      this.ownBuilder(body).sphere(_m, o.seg || 20, o.look || 'floor');
      _s.set(1, 1, 1);
    }
    return s;
  }

  // Capsule lying along local X (rotate with o.ry etc.).
  addCapsule(body, x, y, z, halfLen, r, o = {}) {
    const q = quatFrom(o);
    const s = body.add(new Shape(CAPSULE, { pos: _p.set(x, y, z), quat: q, r, hh: halfLen, tag: o.tag }));
    this.reindex(body, s);
    if (this.gfx && o.look !== false) {
      _m.compose(_p.set(x, y, z), q, _s);
      this.ownBuilder(body).capsuleX(_m, halfLen, r, o.look || 'floor');
    }
    return s;
  }

  addSector(body, x, y, z, rIn, rOut, h, a0, a1, o = {}) {
    const s = body.add(new Shape(SECTOR, { pos: _p.set(x, y, z), rIn, r: rOut, hh: h / 2, a0, a1, tag: o.tag }));
    this.reindex(body, s);
    if (this.gfx && o.look !== false) {
      _m.compose(_p.set(x, y, z), _q.identity(), _s);
      this.ownBuilder(body).sector(_m, rIn, rOut, h, a0, a1, o.look || 'floor');
    }
    return s;
  }

  addCustom(body, o) {
    const s = body.add(new Shape(CUSTOM, o));
    this.reindex(body, s);
    return s;
  }

  // Visual-only additions to a body's mesh (or statics when body is null).
  deco(body, fn) {
    if (!this.gfx) return;
    fn(body ? this.ownBuilder(body) : this.statics, this.gfx);
  }

  // Arbitrary scene objects (only with a renderer).
  scene(fn) {
    if (this.gfx) this.after.push(fn);
  }

  reindex(body, shape) {
    if (this.world.bodies.includes(body)) {
      this.world.shapes.push(shape);
      body.updateWorld();
    }
  }

  finish() {
    if (!this.gfx) return;
    const g = this.gfx;
    const st = this.statics.build();
    if (st) { st.matrixAutoUpdate = false; g.addStatic(st); }
    for (const [body, b] of this.dynamic) {
      const mesh = b.build();
      if (!mesh) continue;
      body.mesh = mesh;
      mesh.position.copy(body.pos);
      mesh.quaternion.copy(body.quat);
      g.addDynamic(mesh, body);
    }
    for (const fn of this.after) fn(g);
  }
}

export { BOX, CYL, SPHERE, CAPSULE, SECTOR, CUSTOM, Body, Shape };
