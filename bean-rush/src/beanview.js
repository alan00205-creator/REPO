// Renders every bean with instanced meshes (body, eyes, hands, feet, hats, shadows) and owns
// their cartoon animation: waddle, squash & stretch, flailing, dives and ragdoll tumbles.

import {
  InstancedMesh, MeshPhongMaterial, MeshBasicMaterial, MeshLambertMaterial, CapsuleGeometry, SphereGeometry,
  PlaneGeometry, ConeGeometry, InstancedBufferAttribute, Matrix4, Quaternion, Vector3, Color, CanvasTexture,
  SRGBColorSpace, Mesh, Float32BufferAttribute, DynamicDrawUsage, BackSide,
} from 'three';
import { BEAN_R, BEAN_H } from './bean.js';
import { clamp, lerpAngle, damp } from './util.js';
import { colorOf, HATS } from './cosmetics.js';
import { hatGeometry } from './hats.js';

const PIV = BEAN_H / 2;
const _m = new Matrix4();
const _root = new Matrix4();
const _tmp = new Matrix4();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _qi = new Quaternion();
const _v = new Vector3();
const _s = new Vector3();
const _ax = new Vector3();
const _up = new Vector3();
const _c = new Color();
const Y = new Vector3(0, 1, 0);
const X = new Vector3(1, 0, 0);

function eyeTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
  g.lineCap = 'round';
  if (kind === 'open') {
    g.fillStyle = '#1d1b2e';
    g.beginPath(); g.ellipse(64, 70, 30, 36, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(52, 54, 11, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(76, 86, 5, 0, Math.PI * 2); g.fill();
  } else if (kind === 'dizzy') {
    g.strokeStyle = '#1d1b2e'; g.lineWidth = 9;
    g.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) {
      const r = 4 + a * 2.6;
      const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
      if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  } else if (kind === 'happy') {
    g.strokeStyle = '#1d1b2e'; g.lineWidth = 13;
    g.beginPath(); g.arc(64, 80, 30, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  } else if (kind === 'sad') {
    g.fillStyle = '#1d1b2e';
    g.beginPath(); g.ellipse(64, 76, 26, 30, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(54, 64, 9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#1d1b2e'; g.lineWidth = 10;
    g.beginPath(); g.moveTo(14, 30); g.lineTo(70, 16); g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function eyeGeometry() {
  // front-facing dome with planar UVs
  const g = new SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  g.rotateX(Math.PI / 2);
  const p = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.5 + 0.5, p.getY(i) * 0.5 + 0.5);
  return g;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(40,20,60,0.55)');
  gr.addColorStop(0.6, 'rgba(40,20,60,0.3)');
  gr.addColorStop(1, 'rgba(40,20,60,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

function bodyMaterial() {
  const m = new MeshPhongMaterial({ color: 0xffffff, shininess: 55, specular: 0x3a3a3a });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFace = { value: new Color('#ffe8d4') };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 aC1;
attribute vec3 aC2;
attribute float aPat;
varying vec3 vC1;
varying vec3 vC2;
varying float vPat;
varying vec3 vLoc;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vC1 = aC1; vC2 = aC2; vPat = aPat; vLoc = position;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uFace;
varying vec3 vC1;
varying vec3 vC2;
varying float vPat;
varying vec3 vLoc;
vec3 beanColor() {
  vec3 p = vLoc;
  float ang = atan(p.x, p.z);
  float fx = ang / 0.66;
  float fy = (p.y - 1.03) / 0.27;
  float fd = fx * fx + fy * fy;
  if (fd < 1.0) return uFace;
  int pat = int(vPat + 0.5);
  float t = 0.0;
  if (pat == 1) t = step(0.5, fract(p.y * 3.3 + 0.15));
  else if (pat == 2) { vec2 q = vec2(ang * 1.75, p.y * 4.2); vec2 c = fract(q) - 0.5; t = step(length(c), 0.27); }
  else if (pat == 3) t = step(p.y, 0.62);
  else if (pat == 4) { float bx = ang / 0.78; float by = (p.y - 0.5) / 0.38; t = step(bx * bx + by * by, 1.0); }
  else if (pat == 5) { vec2 q = floor(vec2(ang * 1.6 + 8.0, p.y * 3.2)); t = mod(q.x + q.y, 2.0); }
  else if (pat == 6) { float w = sin(ang * 6.0) * 0.07; t = step(0.5, fract(p.y * 2.4 + w)); }
  else if (pat == 7) t = step(0.0, p.x);
  vec3 col = mix(vC1, vC2, t);
  // soft rim around the face
  if (fd < 1.18) col = mix(col, uFace, 0.35);
  return col;
}`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( beanColor(), opacity );');
  };
  return m;
}

export class BeanView {
  constructor(scene, max, shadows) {
    this.scene = scene;
    this.max = max;
    this.shadowMaps = shadows;
    this.anim = new Map();

    const bodyGeo = new CapsuleGeometry(BEAN_R, BEAN_H - BEAN_R * 2, 10, 22);
    bodyGeo.translate(0, PIV, 0);
    this.aC1 = new InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aC2 = new InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aPat = new InstancedBufferAttribute(new Float32Array(max), 1);
    bodyGeo.setAttribute('aC1', this.aC1);
    bodyGeo.setAttribute('aC2', this.aC2);
    bodyGeo.setAttribute('aPat', this.aPat);
    this.body = this.inst(bodyGeo, bodyMaterial(), max);

    const eg = eyeGeometry();
    this.eyes = {};
    for (const k of ['open', 'dizzy', 'happy', 'sad']) {
      this.eyes[k] = this.inst(eg, new MeshLambertMaterial({ map: eyeTexture(k), emissive: 0x222222 }), max * 2);
      this.eyes[k].castShadow = false;
    }
    const sph = new SphereGeometry(1, 12, 9);
    this.hands = this.inst(sph, new MeshPhongMaterial({ color: 0xffffff, shininess: 40, specular: 0x333333 }), max * 2);
    this.feet = this.inst(sph, new MeshPhongMaterial({ color: 0xffffff, shininess: 30, specular: 0x222222 }), max * 2);

    const sg = new PlaneGeometry(1, 1);
    sg.rotateX(-Math.PI / 2);
    this.shadow = this.inst(sg, new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 1 }), max);
    this.shadow.castShadow = false;
    this.shadow.renderOrder = 1;
    this.shadow.visible = !shadows;

    this.hats = {};
    for (const h of HATS) {
      if (h.id === 'none') continue;
      const geo = hatGeometry(h.id);
      if (!geo) continue;
      this.hats[h.id] = this.inst(geo, new MeshPhongMaterial({ vertexColors: true, shininess: 50, specular: 0x333333 }), max);
    }

    // floating marker over the player
    const mk = new ConeGeometry(0.24, 0.42, 4);
    mk.rotateX(Math.PI);
    this.marker = new Mesh(mk, new MeshBasicMaterial({ color: 0xffd84d }));
    // outline: a slightly larger back-faced copy
    const mko = new Mesh(mk, new MeshBasicMaterial({ color: 0x2b2d5c, side: BackSide }));
    mko.scale.setScalar(1.28);
    this.marker.add(mko);
    this.marker.visible = false;
    scene.add(this.marker);
    this.looksKey = '';
  }

  inst(geo, mat, n) {
    const m = new InstancedMesh(geo, mat, n);
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.count = 0;
    m.castShadow = this.shadowMaps;
    m.receiveShadow = false;
    m.frustumCulled = false;
    this.scene.add(m);
    return m;
  }

  setShadows(on) {
    this.shadowMaps = on;
    this.shadow.visible = !on;
    for (const m of [this.body, this.hands, this.feet, ...Object.values(this.hats)]) m.castShadow = on;
  }

  dispose() {
    for (const m of [this.body, this.hands, this.feet, this.shadow, ...Object.values(this.eyes), ...Object.values(this.hats)]) {
      this.scene.remove(m);
    }
    this.scene.remove(this.marker);
  }

  stateOf(b) {
    let a = this.anim.get(b);
    if (!a) {
      a = {
        phase: Math.random() * 6, sq: 0, sqV: 0, lean: 0, roll: 0, tq: new Quaternion(), lie: 0,
        blinkT: 1 + Math.random() * 3, blink: 0, run: 0, air: 0, wave: 0, celebrate: 0, sad: 0, dizzy: 0,
        yawV: 0, lastYaw: b.yaw, hide: 0,
      };
      this.anim.set(b, a);
    }
    return a;
  }

  onEvent(e) {
    const b = e.bean;
    if (!b) return;
    const a = this.stateOf(b);
    switch (e.type) {
      case 'jump': a.sq = 0.16; a.sqV = 1.5; break;
      case 'land': a.sqV -= Math.min(4.5, (e.extra || 6) * 0.32); break;
      case 'dive': a.sq = 0.05; break;
      case 'bonk': a.dizzy = 2.2; a.sqV -= 2; break;
      case 'finish': a.celebrate = 99; break;
      case 'boing': a.sq = 0.22; a.sqV = 2; break;
    }
  }

  update(beans, alpha, dt, time, opts = {}) {
    const counts = { body: 0, eye: { open: 0, dizzy: 0, happy: 0, sad: 0 }, hands: 0, feet: 0, shadow: 0 };
    const hatCounts = {};
    let looksDirty = false;
    let playerShown = false;

    for (const b of beans) {
      const a = this.stateOf(b);
      const hidden = !b.active || b.respawnT > 0 || b.hideView;
      if (hidden) continue;
      const i = counts.body;
      if (i >= this.max) break;

      // colours (cheap to keep in sync every frame)
      const look = b.look || {};
      _c.set(colorOf(look.color));
      if (this.aC1.getX(i) !== _c.r || this.aC1.getY(i) !== _c.g || this.aC1.getZ(i) !== _c.b) looksDirty = true;
      this.aC1.setXYZ(i, _c.r, _c.g, _c.b);
      const c1 = _c.clone();
      _c.set(colorOf(look.color2 || 'white'));
      this.aC2.setXYZ(i, _c.r, _c.g, _c.b);
      this.aPat.setX(i, look.pattern || 0);

      // --- pose -------------------------------------------------------------
      const px = b.prevPos.x + (b.pos.x - b.prevPos.x) * alpha;
      const py = b.prevPos.y + (b.pos.y - b.prevPos.y) * alpha;
      const pz = b.prevPos.z + (b.pos.z - b.prevPos.z) * alpha;
      const yaw = lerpAngle(b.prevYaw, b.yaw, alpha);
      const hs = Math.hypot(b.vel.x - (b.grounded ? b.groundVel.x : 0), b.vel.z - (b.grounded ? b.groundVel.z : 0));
      const st = b.state;

      a.run = damp(a.run, b.grounded && st === 'normal' ? clamp(hs / 6.4, 0, 1) : 0, 12, dt);
      a.air = damp(a.air, b.grounded ? 0 : 1, 10, dt);
      a.phase += hs * dt * 2.3;
      // squash spring
      const k = 220, c = 14;
      a.sqV += (-k * a.sq - c * a.sqV) * dt;
      a.sq += a.sqV * dt;
      a.sq = clamp(a.sq, -0.35, 0.35);
      const stretch = !b.grounded && st === 'normal' ? clamp(b.vel.y * 0.012, -0.08, 0.1) : 0;
      const sy = 1 + a.sq + stretch;
      const sxz = 1 - (a.sq + stretch) * 0.55;
      // turning lean
      let dyaw = ((yaw - a.lastYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      a.lastYaw = yaw;
      a.yawV = damp(a.yawV, clamp(dyaw / Math.max(dt, 1e-3), -8, 8), 10, dt);
      a.roll = damp(a.roll, -a.yawV * 0.035 * a.run, 10, dt);
      a.lean = damp(a.lean, a.run * 0.2 + (st === 'normal' && !b.grounded ? 0.1 : 0), 10, dt);

      // body orientation (in yaw space)
      let lieTarget = 0;
      if (st === 'dive' || st === 'slide') {
        _q2.setFromAxisAngle(X, 1.38);
        a.tq.slerp(_q2, 1 - Math.exp(-18 * dt));
        lieTarget = 1;
      } else if (st === 'tumble') {
        if (!b.grounded) {
          // spin around the axis perpendicular to travel
          _v.set(b.vel.x, 0, b.vel.z);
          const sp = _v.length();
          _ax.set(b.vel.z, 0, -b.vel.x).normalize();
          if (sp > 0.5) {
            _q.setFromAxisAngle(Y, -yaw);
            _ax.applyQuaternion(_q);
            _q2.setFromAxisAngle(_ax, sp * dt * 1.6);
            a.tq.premultiply(_q2).normalize();
          }
        } else {
          // flop onto the back with a wobble
          _q2.setFromAxisAngle(X, -1.4 + Math.sin(time * 18) * 0.06 * Math.max(0, 1 - b.stateT));
          a.tq.slerp(_q2, 1 - Math.exp(-9 * dt));
        }
        lieTarget = 1;
      } else if (st === 'getup') {
        a.tq.slerp(_qi.identity(), 1 - Math.exp(-16 * dt));
      } else {
        a.tq.slerp(_qi.identity(), 1 - Math.exp(-20 * dt));
      }
      _up.copy(Y).applyQuaternion(a.tq);
      a.lie = clamp(1 - _up.y, 0, 1);
      void lieTarget;

      // root transform
      const bob = Math.abs(Math.sin(a.phase)) * 0.06 * a.run;
      const yOff = -(PIV - BEAN_R) * Math.min(1, a.lie * 1.15) + bob;
      _q.setFromAxisAngle(Y, yaw);
      _root.makeRotationFromQuaternion(_q);
      _root.setPosition(px, py + yOff, pz);
      // pose rotation about the pivot (centre)
      _q2.setFromAxisAngle(X, a.lean * (1 - a.lie));
      _q.copy(a.tq).multiply(_q2);
      _q2.setFromAxisAngle(new Vector3(0, 0, 1), a.roll * (1 - a.lie));
      _q.multiply(_q2);
      _tmp.makeTranslation(0, PIV, 0);
      _root.multiply(_tmp);
      _m.makeRotationFromQuaternion(_q);
      _root.multiply(_m);
      _m.makeScale(sxz, sy, sxz);
      _root.multiply(_m);
      _tmp.makeTranslation(0, -PIV, 0);
      _root.multiply(_tmp);

      this.body.setMatrixAt(i, _root);

      // --- eyes ---------------------------------------------------------------
      a.blinkT -= dt;
      if (a.blinkT <= 0) { a.blink = 0.13; a.blinkT = 2 + Math.random() * 3.5; }
      if (a.blink > 0) a.blink -= dt;
      if (a.dizzy > 0) a.dizzy -= dt;
      let ek = 'open';
      if (st === 'tumble' || (a.dizzy > 0 && st !== 'normal')) ek = 'dizzy';
      else if (b.finished || a.celebrate > 0 || opts.happy === b) ek = 'happy';
      else if (opts.sad === b) ek = 'sad';
      const eyeSy = a.blink > 0 && ek === 'open' ? 0.15 : 1;
      for (const side of [-1, 1]) {
        _q.setFromAxisAngle(Y, side * 0.3);
        _m.compose(_v.set(side * 0.125, 1.07, 0.375), _q, _s.set(0.11, 0.135 * eyeSy, 0.07));
        _tmp.multiplyMatrices(_root, _m);
        this.eyes[ek].setMatrixAt(counts.eye[ek]++, _tmp);
      }

      // --- hands & feet --------------------------------------------------------
      const swing = Math.sin(a.phase) * a.run;
      const flail = a.air * (st === 'normal' ? 1 : 0.4);
      const cel = b.finished ? 1 : 0;
      for (const side of [-1, 1]) {
        let hx = side * 0.5, hy = 0.7, hz = 0.02;
        hz += side * swing * 0.2;
        hy += Math.abs(swing) * 0.04;
        // arms up when airborne or celebrating
        const up = Math.max(flail, cel);
        hy += up * (0.45 + Math.sin(time * 14 + side) * 0.06 * up);
        hx += side * up * 0.08;
        if (st === 'dive' || st === 'slide') { hx = side * 0.3; hy = 1.25; hz = 0.18; }
        _m.compose(_v.set(hx, hy, hz), _qi.identity(), _s.set(0.13, 0.13, 0.13));
        _tmp.multiplyMatrices(_root, _m);
        this.hands.setMatrixAt(counts.hands, _tmp);
        this.hands.setColorAt(counts.hands++, c1);

        const ph = a.phase + (side > 0 ? 0 : Math.PI);
        let fy = 0.08 + Math.max(0, Math.sin(ph)) * 0.13 * a.run;
        let fz = 0.04 + Math.cos(ph) * 0.17 * a.run;
        if (!b.grounded && st === 'normal') { fy += 0.04; fz -= 0.08; }
        _m.compose(_v.set(side * 0.17, fy, fz), _qi.identity(), _s.set(0.15, 0.1, 0.21));
        _tmp.multiplyMatrices(_root, _m);
        this.feet.setMatrixAt(counts.feet, _tmp);
        _c.copy(c1).multiplyScalar(0.78);
        this.feet.setColorAt(counts.feet++, _c);
      }

      // --- hat --------------------------------------------------------------------
      const hat = look.hat && this.hats[look.hat] ? look.hat : null;
      if (hat) {
        _m.makeTranslation(0, 1.08, 0);
        _tmp.multiplyMatrices(_root, _m);
        const n = hatCounts[hat] || 0;
        this.hats[hat].setMatrixAt(n, _tmp);
        hatCounts[hat] = n + 1;
      }

      // --- blob shadow -----------------------------------------------------------
      if (!this.shadowMaps && b.shadowY > -1e8) {
        const h = Math.max(0, py - b.shadowY);
        const s = clamp(1.25 - h * 0.08, 0.35, 1.25);
        _m.compose(_v.set(px, b.shadowY + 0.03, pz), _qi.identity(), _s.set(s, 1, s));
        this.shadow.setMatrixAt(counts.shadow++, _m);
      }

      if (b === opts.marker) {
        playerShown = true;
        this.marker.position.set(px, py + BEAN_H + 0.95 + Math.sin(time * 4) * 0.08 + (hat ? 0.35 : 0), pz);
        this.marker.rotation.y = time * 2;
      }
      counts.body++;
    }

    this.body.count = counts.body;
    for (const k in this.eyes) { this.eyes[k].count = counts.eye[k]; this.eyes[k].instanceMatrix.needsUpdate = true; }
    this.hands.count = counts.hands;
    this.feet.count = counts.feet;
    this.shadow.count = counts.shadow;
    for (const k in this.hats) { this.hats[k].count = hatCounts[k] || 0; this.hats[k].instanceMatrix.needsUpdate = true; }
    for (const m of [this.body, this.hands, this.feet, this.shadow]) m.instanceMatrix.needsUpdate = true;
    if (this.hands.instanceColor) this.hands.instanceColor.needsUpdate = true;
    if (this.feet.instanceColor) this.feet.instanceColor.needsUpdate = true;
    this.aC1.needsUpdate = true;
    this.aC2.needsUpdate = true;
    this.aPat.needsUpdate = true;
    void looksDirty;
    this.marker.visible = playerShown && opts.showMarker !== false;
  }
}

export { Float32BufferAttribute };
