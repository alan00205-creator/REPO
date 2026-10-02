// Hat geometry, merged from primitives with vertex colours. Origin = centre of the head
// sphere (bean-local y = 1.08), +Z = forward.

import {
  BufferGeometry, Float32BufferAttribute, SphereGeometry, CylinderGeometry, BoxGeometry, ConeGeometry,
  TorusGeometry, Matrix4, Color, Euler, Quaternion, Vector3,
} from 'three';

function merge(parts) {
  const pos = [], nrm = [], col = [];
  const n3 = new Matrix4();
  const v = new Vector3();
  for (const { geo, color, m } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    const c = new Color(color);
    n3.copy(m).invert().transpose();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).transformDirection(n3);
      nrm.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
    }
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  out.setAttribute('color', new Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

const E = new Euler();
const Q = new Quaternion();
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  E.set(rx, ry, rz);
  Q.setFromEuler(E);
  return new Matrix4().compose(new Vector3(x, y, z), Q, new Vector3(sx, sy, sz));
}
const P = (geo, color, m = M()) => ({ geo, color, m });
const dome = (r, frac = 0.5, seg = 18) => new SphereGeometry(r, seg, 10, 0, Math.PI * 2, 0, Math.PI * frac);

export function hatGeometry(id) {
  switch (id) {
    case 'cap':
      return merge([
        P(dome(0.445, 0.48), '#ff4f5e', M(0, 0.02, 0)),
        P(new CylinderGeometry(0.3, 0.3, 0.035, 20), '#e23a4a', M(0, 0.07, 0.42, 0, 0, 0, 1, 1, 1.15)),
        P(new SphereGeometry(0.05, 8, 6), '#ffffff', M(0, 0.47, 0)),
        P(new BoxGeometry(0.2, 0.12, 0.02), '#ffffff', M(0, 0.26, 0.385, -0.55)),
      ]);
    case 'party':
      return merge([
        P(new ConeGeometry(0.24, 0.55, 18), '#ff5fa2', M(0, 0.62, -0.02, -0.12)),
        P(new TorusGeometry(0.23, 0.04, 8, 18), '#ffd84d', M(0, 0.36, 0.0, Math.PI / 2 - 0.12)),
        P(new SphereGeometry(0.085, 10, 8), '#ffffff', M(0, 0.9, -0.05)),
        P(new SphereGeometry(0.05, 8, 6), '#5fd3ff', M(0.1, 0.55, 0.15)),
        P(new SphereGeometry(0.05, 8, 6), '#ffd84d', M(-0.09, 0.66, 0.1)),
      ]);
    case 'cat':
      return merge([
        P(new ConeGeometry(0.16, 0.3, 4), '#ff9a3c', M(0.22, 0.42, 0, 0, Math.PI / 4, -0.35)),
        P(new ConeGeometry(0.16, 0.3, 4), '#ff9a3c', M(-0.22, 0.42, 0, 0, Math.PI / 4, 0.35)),
        P(new ConeGeometry(0.09, 0.18, 4), '#ffc2d6', M(0.22, 0.4, 0.07, 0, Math.PI / 4, -0.35)),
        P(new ConeGeometry(0.09, 0.18, 4), '#ffc2d6', M(-0.22, 0.4, 0.07, 0, Math.PI / 4, 0.35)),
      ]);
    case 'bunny':
      return merge([
        P(new SphereGeometry(1, 12, 10), '#ffffff', M(0.15, 0.62, -0.02, 0, 0, -0.22, 0.09, 0.33, 0.06)),
        P(new SphereGeometry(1, 12, 10), '#ffffff', M(-0.15, 0.62, -0.02, 0, 0, 0.22, 0.09, 0.33, 0.06)),
        P(new SphereGeometry(1, 12, 10), '#ffb3cf', M(0.15, 0.62, 0.025, 0, 0, -0.22, 0.05, 0.24, 0.03)),
        P(new SphereGeometry(1, 12, 10), '#ffb3cf', M(-0.15, 0.62, 0.025, 0, 0, 0.22, 0.05, 0.24, 0.03)),
      ]);
    case 'douli':
      return merge([
        P(new ConeGeometry(0.78, 0.36, 22), '#e9c46a', M(0, 0.44, 0)),
        P(new CylinderGeometry(0.42, 0.44, 0.09, 22), '#d6453d', M(0, 0.3, 0)),
        P(new SphereGeometry(0.04, 6, 4), '#c08a3e', M(0, 0.63, 0)),
      ]);
    case 'miner':
      return merge([
        P(dome(0.46, 0.5), '#ffd23f', M(0, 0.05, 0, 0, 0, 0, 1, 0.92, 1)),
        P(new CylinderGeometry(0.5, 0.5, 0.04, 22), '#f2b51a', M(0, 0.06, 0.02)),
        P(new BoxGeometry(0.06, 0.08, 0.5), '#f2b51a', M(0, 0.47, 0, 0, 0, 0)),
        P(new CylinderGeometry(0.1, 0.12, 0.12, 14), '#e9e9f0', M(0, 0.3, 0.43, Math.PI / 2 - 0.3)),
        P(new CylinderGeometry(0.075, 0.075, 0.02, 14), '#fff6a8', M(0, 0.32, 0.5, Math.PI / 2 - 0.3)),
      ]);
    case 'helmet':
      return merge([
        P(dome(0.47, 0.52), '#56c2ff', M(0, 0.0, 0)),
        P(new BoxGeometry(0.1, 0.06, 0.9), '#ffffff', M(0, 0.45, 0, 0, 0, 0)),
        P(new CylinderGeometry(0.48, 0.48, 0.05, 22, 1, true, -0.9, 1.8), '#2b2d5c', M(0, 0.03, 0)),
        P(new BoxGeometry(0.34, 0.04, 0.16), '#2b2d5c', M(0, 0.06, 0.48, -0.25)),
      ]);
    case 'boba':
      return merge([
        P(new CylinderGeometry(0.3, 0.24, 0.52, 18), '#e9c9a0', M(0, 0.62, 0)),
        P(new CylinderGeometry(0.315, 0.315, 0.06, 18), '#ffffff', M(0, 0.9, 0)),
        P(new CylinderGeometry(0.04, 0.04, 0.55, 8), '#ff5fa2', M(0.08, 1.12, -0.02, 0, 0, -0.25)),
        ...[0, 1, 2, 3, 4, 5].map((i) => P(new SphereGeometry(0.06, 8, 6), '#3a2216', M(Math.cos(i) * 0.25, 0.45, Math.sin(i) * 0.25))),
      ]);
    case 'pineapple':
      return merge([
        P(new SphereGeometry(1, 16, 12), '#ffb627', M(0, 0.62, 0, 0, 0, 0, 0.3, 0.36, 0.3)),
        ...[0, 1, 2, 3, 4].map((i) => P(new ConeGeometry(0.06, 0.32, 6), '#3fae4f', M(Math.cos(i * 1.26) * 0.06, 1.05, Math.sin(i * 1.26) * 0.06, Math.sin(i * 1.26) * 0.4, 0, -Math.cos(i * 1.26) * 0.4))),
        ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => P(new SphereGeometry(0.035, 6, 4), '#d9821a', M(Math.cos(i * 0.8) * 0.29, 0.5 + (i % 3) * 0.12, Math.sin(i * 0.8) * 0.29))),
      ]);
    case 'chef':
      return merge([
        P(new CylinderGeometry(0.33, 0.36, 0.3, 20), '#ffffff', M(0, 0.48, 0)),
        P(new SphereGeometry(1, 16, 10), '#ffffff', M(0, 0.76, 0, 0, 0, 0, 0.42, 0.28, 0.42)),
        P(new SphereGeometry(1, 12, 8), '#f2f2fa', M(0.18, 0.82, 0.1, 0, 0, 0, 0.2, 0.2, 0.2)),
        P(new SphereGeometry(1, 12, 8), '#f2f2fa', M(-0.15, 0.83, -0.12, 0, 0, 0, 0.2, 0.2, 0.2)),
      ]);
    case 'flower':
      return merge([
        P(new CylinderGeometry(0.025, 0.025, 0.35, 6), '#3fae4f', M(0, 0.58, 0)),
        P(new SphereGeometry(1, 8, 6), '#3fae4f', M(0.09, 0.55, 0, 0, 0, -0.6, 0.12, 0.04, 0.07)),
        ...[0, 1, 2, 3, 4].map((i) => P(new SphereGeometry(1, 10, 8), '#ff86c8', M(Math.cos(i * 1.256) * 0.11, 0.8, Math.sin(i * 1.256) * 0.11 + 0.02, 0, 0, 0, 0.1, 0.05, 0.1))),
        P(new SphereGeometry(0.07, 10, 8), '#ffd23f', M(0, 0.82, 0.02)),
      ]);
    case 'chick':
      return merge([
        P(new SphereGeometry(0.2, 14, 10), '#ffe14d', M(0, 0.52, -0.02, 0, 0, 0, 1, 0.85, 1.1)),
        P(new SphereGeometry(0.13, 14, 10), '#ffe14d', M(0, 0.74, 0.1)),
        P(new ConeGeometry(0.045, 0.1, 8), '#ff9a3c', M(0, 0.73, 0.25, Math.PI / 2)),
        P(new SphereGeometry(0.022, 6, 4), '#2b2d5c', M(0.06, 0.78, 0.21)),
        P(new SphereGeometry(0.022, 6, 4), '#2b2d5c', M(-0.06, 0.78, 0.21)),
        P(new SphereGeometry(1, 8, 6), '#ffd23f', M(0.18, 0.54, -0.02, 0, 0, -0.5, 0.05, 0.1, 0.12)),
        P(new SphereGeometry(1, 8, 6), '#ffd23f', M(-0.18, 0.54, -0.02, 0, 0, 0.5, 0.05, 0.1, 0.12)),
      ]);
    case 'propeller':
      return merge([
        P(dome(0.44, 0.45), '#5fd3ff', M(0, 0.03, 0)),
        P(new CylinderGeometry(0.03, 0.03, 0.2, 6), '#2b2d5c', M(0, 0.52, 0)),
        P(new BoxGeometry(0.7, 0.02, 0.12), '#ff5468', M(0, 0.63, 0, 0, 0.3, 0.12)),
        P(new BoxGeometry(0.7, 0.02, 0.12), '#ffd23f', M(0, 0.635, 0, 0, 0.3 + Math.PI / 2, -0.12)),
        P(new SphereGeometry(0.05, 8, 6), '#ffffff', M(0, 0.65, 0)),
      ]);
    case 'crown': {
      const parts = [P(new CylinderGeometry(0.3, 0.27, 0.16, 20, 1, true), '#ffc928', M(0, 0.47, 0))];
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        parts.push(P(new ConeGeometry(0.07, 0.2, 6), '#ffc928', M(Math.sin(a) * 0.28, 0.63, Math.cos(a) * 0.28)));
        parts.push(P(new SphereGeometry(0.035, 8, 6), '#ffffff', M(Math.sin(a) * 0.28, 0.74, Math.cos(a) * 0.28)));
      }
      parts.push(P(new SphereGeometry(0.06, 10, 8), '#ff4d6d', M(0, 0.48, 0.3)));
      parts.push(P(new CylinderGeometry(0.27, 0.27, 0.02, 20), '#ffde6b', M(0, 0.4, 0)));
      return merge(parts);
    }
  }
  return null;
}
