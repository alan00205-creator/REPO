// Level graphics: procedural canvas textures, cached materials and a geometry builder that
// batches every face into one mesh per material set.

import {
  BufferGeometry, Float32BufferAttribute, Mesh, MeshLambertMaterial, MeshPhongMaterial, MeshBasicMaterial,
  CanvasTexture, RepeatWrapping, SRGBColorSpace, Matrix4, Matrix3, Vector3, Color, Group, SphereGeometry,
  CapsuleGeometry, CylinderGeometry, BoxGeometry, InstancedMesh, Object3D, PlaneGeometry, DoubleSide,
} from 'three';
import { drawFruit } from './art.js';

const texCache = new Map();
const matCache = new Map();

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Draw a texture for a leaf spec. Textures carry their own colours (material colour = white).
function paint(spec) {
  const c1 = spec.c || '#ffffff', c2 = spec.c2 || '#dddddd';
  let cv;
  let g;
  const N = 256;
  switch (spec.t) {
    case 'grid': {
      cv = canvas(N); g = cv.getContext('2d');
      g.fillStyle = c2; g.fillRect(0, 0, N, N);
      g.fillStyle = c1; roundRect(g, 6, 6, N - 12, N - 12, 34); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.28)'; roundRect(g, 22, 18, N - 44, 40, 18); g.fill();
      break;
    }
    case 'dots': {
      cv = canvas(N); g = cv.getContext('2d');
      g.fillStyle = c1; g.fillRect(0, 0, N, N);
      g.fillStyle = c2;
      for (const [x, y] of [[64, 64], [192, 192], [192, 64], [64, 192]]) {
        g.beginPath(); g.arc(x, y, (x + y) % 128 === 0 ? 30 : 22, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case 'hstripe': case 'vstripe': {
      cv = canvas(64); g = cv.getContext('2d');
      g.fillStyle = c1; g.fillRect(0, 0, 64, 64);
      g.fillStyle = c2;
      if (spec.t === 'hstripe') g.fillRect(0, 32, 64, 32); else g.fillRect(32, 0, 32, 64);
      break;
    }
    case 'stripe': case 'candy': {
      cv = canvas(128); g = cv.getContext('2d');
      g.fillStyle = c1; g.fillRect(0, 0, 128, 128);
      g.fillStyle = c2;
      for (let i = -2; i < 3; i++) {
        g.beginPath();
        g.moveTo(i * 64, 0); g.lineTo(i * 64 + 32, 0); g.lineTo(i * 64 + 32 + 128, 128); g.lineTo(i * 64 + 128, 128);
        g.closePath(); g.fill();
      }
      break;
    }
    case 'checker': {
      cv = canvas(64); g = cv.getContext('2d');
      g.fillStyle = c1; g.fillRect(0, 0, 64, 64);
      g.fillStyle = c2; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
      break;
    }
    case 'plank': {
      cv = canvas(128); g = cv.getContext('2d');
      g.fillStyle = c1; g.fillRect(0, 0, 128, 128);
      g.fillStyle = c2;
      g.fillRect(0, 0, 128, 6); g.fillRect(0, 64, 128, 6);
      g.fillRect(40, 6, 5, 58); g.fillRect(100, 70, 5, 58);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 10, 128, 8); g.fillRect(0, 74, 128, 8);
      break;
    }
    case 'spiral': {
      cv = canvas(N); g = cv.getContext('2d');
      g.fillStyle = c1; g.fillRect(0, 0, N, N);
      g.translate(N / 2, N / 2);
      g.fillStyle = c2;
      for (let k = 0; k < 6; k++) {
        g.beginPath();
        g.moveTo(0, 0);
        for (let a = 0; a <= 1.0; a += 0.05) {
          const ang = (k / 6) * Math.PI * 2 + a * 2.2;
          g.lineTo(Math.cos(ang) * a * N * 0.5, Math.sin(ang) * a * N * 0.5);
        }
        for (let a = 1.0; a >= 0; a -= 0.05) {
          const ang = (k / 6) * Math.PI * 2 + a * 2.2 + 0.42;
          g.lineTo(Math.cos(ang) * a * N * 0.5, Math.sin(ang) * a * N * 0.5);
        }
        g.closePath(); g.fill();
      }
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(0, 0, N * 0.09, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'arrow': {
      cv = canvas(128); g = cv.getContext('2d');
      g.fillStyle = c1; g.fillRect(0, 0, 128, 128);
      g.fillStyle = c2;
      // chevron pointing toward +v (canvas up = +v after flipY)
      for (const oy of [0, 64]) {
        g.beginPath();
        g.moveTo(14, 54 + oy); g.lineTo(64, 14 + oy); g.lineTo(114, 54 + oy); g.lineTo(114, 70 + oy - 16 + 10);
        g.lineTo(64, 34 + oy); g.lineTo(14, 64 + oy); g.closePath(); g.fill();
      }
      break;
    }
    case 'door': {
      cv = canvas(128, 160); g = cv.getContext('2d');
      g.fillStyle = c2; g.fillRect(0, 0, 128, 160);
      g.fillStyle = c1; roundRect(g, 10, 10, 108, 140, 14); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6; roundRect(g, 24, 24, 80, 112, 10); g.stroke();
      g.fillStyle = '#ffffff'; g.font = 'bold 74px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('?', 64, 82);
      break;
    }
    case 'band': {
      cv = canvas(64, 128); g = cv.getContext('2d');
      g.fillStyle = c1; g.fillRect(0, 0, 64, 128);
      g.fillStyle = c2; g.fillRect(0, 52, 64, 24);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, 56, 64, 5);
      break;
    }
    case 'cupside': {
      cv = canvas(N); g = cv.getContext('2d');
      const gr = g.createLinearGradient(0, 0, 0, N);
      gr.addColorStop(0, '#fff6ea'); gr.addColorStop(0.35, c1); gr.addColorStop(1, '#c99a66');
      g.fillStyle = gr; g.fillRect(0, 0, N, N);
      g.fillStyle = c2;
      for (let i = 0; i < 26; i++) {
        const x = (i * 97) % N, y = N * 0.62 + ((i * 53) % 90);
        g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill();
      }
      break;
    }
    case 'text': {
      cv = canvas(512, 128); g = cv.getContext('2d');
      g.fillStyle = c1; g.fillRect(0, 0, 512, 128);
      g.fillStyle = c2; g.font = '900 78px "Titan One", "Huninn", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(spec.text || '', 256, 70);
      break;
    }
    default:
      return null;
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function keyOf(spec) {
  return [spec.t, spec.c, spec.c2, spec.shiny ? 1 : 0, spec.text || '', spec.scroll ? 's' + spec.scroll.join(',') : '', spec.emis || ''].join('|');
}

export class Gfx {
  constructor(view) {
    this.view = view;
    this.root = new Group();
    this.root.name = 'level';
    this.dynamic = [];
    this.scrolling = [];
    this.updaters = [];
    this.owned = []; // per-level materials/textures to free with the level
    this.shadows = view.shadows;
    view.scene.add(this.root);
  }

  texture(spec) {
    const k = keyOf(spec);
    if (texCache.has(k)) return texCache.get(k);
    const t = paint(spec);
    texCache.set(k, t);
    return t;
  }

  material(spec) {
    if (typeof spec === 'string') spec = { t: 'plain', c: spec };
    const k = keyOf(spec);
    if (matCache.has(k) && !spec.scroll) return matCache.get(k);
    const map = spec.t === 'plain' ? null : this.texture(spec);
    const opts = { color: spec.t === 'plain' ? new Color(spec.c || '#ffffff') : 0xffffff };
    let m;
    if (spec.shiny) m = new MeshPhongMaterial({ ...opts, map, shininess: 70, specular: 0x555555 });
    else m = new MeshLambertMaterial({ ...opts, map });
    if (spec.emis) { m.emissive = new Color(spec.emis); m.emissiveIntensity = 0.6; }
    if (spec.scroll) {
      m.map = map.clone();
      m.map.needsUpdate = true;
      this.scrolling.push({ tex: m.map, v: spec.scroll, s: spec.s || 2 });
    }
    matCache.set(k, m);
    return m;
  }

  builder() {
    return new GeoBuilder(this);
  }

  addStatic(mesh) {
    mesh.updateMatrix();
    mesh.receiveShadow = this.shadows;
    mesh.castShadow = this.shadows;
    this.root.add(mesh);
  }

  addDynamic(mesh, body) {
    mesh.castShadow = this.shadows;
    mesh.receiveShadow = this.shadows;
    this.root.add(mesh);
    this.dynamic.push({ mesh, body });
  }

  update(alpha, dt, time) {
    for (const d of this.dynamic) {
      const b = d.body, m = d.mesh;
      m.visible = !b.hidden;
      if (!m.visible) continue;
      m.position.lerpVectors(b.prevPos, b.pos, alpha);
      m.quaternion.slerpQuaternions(b.prevQuat, b.quat, alpha);
    }
    for (const s of this.scrolling) {
      // world-space belt speed → uv offset (uv = local / tile size)
      s.tex.offset.y -= (Math.hypot(s.v[0], s.v[1]) / s.s) * dt;
    }
    for (const u of this.updaters) u(alpha, dt, time);
  }

  dispose() {
    this.view.scene.remove(this.root);
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    for (const s of this.scrolling) s.tex.dispose();
    for (const o of this.owned) o.dispose();
  }

  // Floating candy islands and balloons around a level (purely decorative).
  decorate(cx, cz, inner, rng, gooY) {
    const b = this.builder();
    const GRASS = ['#9be7b0', '#ffd1ec', '#c9b8ff'];
    const CANDY = ['#ff5fa2', '#ffd23f', '#3fc8ff', '#4fd8a3', '#8b6cff', '#ff9a3c'];
    const m = new Matrix4();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rng() * 0.3;
      const d = inner + 40 + rng() * 80;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const y = gooY + 4 + rng() * 12 + d * 0.04;
      const r = 6 + rng() * 9;
      const g = GRASS[i % GRASS.length];
      b.cyl(m.makeTranslation(x, y, z), r, r * 0.92, 2.2, 22, { top: { t: 'dots', c: g, c2: '#ffffff', s: 3 }, side: { t: 'hstripe', c: '#ffffff', c2: '#ff86c8', s: 1.1 } });
      b.cyl(m.makeTranslation(x, y - 1.1 - r * 0.6, z), r * 0.92, 0.4, r * 1.2, 16, { t: 'plain', c: '#b79bd8' });
      const trees = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < trees; k++) {
        const ta = rng() * Math.PI * 2, tr = rng() * r * 0.55;
        const tx = x + Math.cos(ta) * tr, tz = z + Math.sin(ta) * tr;
        const h = 3 + rng() * 4;
        b.cylAt(tx, y + 1.1 + h / 2, tz, 0.3, h, { t: 'plain', c: '#ffffff' });
        b.sphereAt(tx, y + 1.1 + h + 1.4, tz, 1.8 + rng(), { t: 'candy', c: CANDY[(i + k) % CANDY.length], c2: '#ffffff', s: 1.6, shiny: 1 });
      }
    }
    for (let i = 0; i < 14; i++) {
      const a = rng() * Math.PI * 2;
      const d = inner + 10 + rng() * 40;
      const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d, y = gooY + 12 + rng() * 14;
      b.sphereAt(x, y, z, 2.2, { t: 'candy', c: CANDY[i % CANDY.length], c2: '#ffffff', s: 1.6, shiny: 1 }, 1, 1.2, 1);
      b.cylAt(x, y - 2.6 - 3, z, 0.06, 6, { t: 'plain', c: '#ffffff' });
    }
    const mesh = b.build();
    if (mesh) { mesh.castShadow = false; mesh.receiveShadow = false; mesh.matrixAutoUpdate = false; this.root.add(mesh); }
  }

  // ---- special visuals ------------------------------------------------------
  fruitTiles(L, size, span) {
    const fruitMats = L.fruits.map((_, i) => {
      const cv = canvas(256);
      const g = cv.getContext('2d');
      g.fillStyle = '#fff7e6'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#ffe2b8'; roundRect(g, 10, 10, 236, 236, 30); g.fill();
      drawFruit(g, i, 128, 132, 92);
      const t = new CanvasTexture(cv); t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
      const m = new MeshLambertMaterial({ map: t });
      this.owned.push(t, m);
      return m;
    });
    const blank = (() => {
      const cv = canvas(256); const g = cv.getContext('2d');
      g.fillStyle = '#d9d2ff'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#ece8ff'; roundRect(g, 10, 10, 236, 236, 30); g.fill();
      g.fillStyle = '#9c8cf0'; g.font = '900 150px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('?', 128, 140);
      const t = new CanvasTexture(cv); t.colorSpace = SRGBColorSpace;
      const m = new MeshLambertMaterial({ map: t });
      this.owned.push(t, m);
      return m;
    })();
    const gone = new MeshLambertMaterial({ color: 0x6a5acd });
    this.owned.push(gone);
    const side = this.material({ t: 'hstripe', c: '#ffffff', c2: '#ff8fcf' });
    const bottom = this.material({ t: 'plain', c: '#8f7fe0' });
    // two draw groups per tile: the fruit face, and everything else
    const geo = new BoxGeometry(size, 1, size);
    {
      const idx = Array.from(geo.getIndex().array);
      const faces = geo.groups.map((g) => idx.slice(g.start, g.start + g.count));
      const top = faces[2];
      const rest = faces.filter((_, i) => i !== 2).flat();
      geo.setIndex([...top, ...rest]);
      geo.clearGroups();
      geo.addGroup(0, top.length, 0);
      geo.addGroup(top.length, rest.length, 1);
    }
    void bottom;
    for (const tl of L.tiles) {
      const mats = [blank, side];
      const mesh = new Mesh(geo, mats);
      tl.mesh = mesh;
      this.addDynamic(mesh, tl.body);
    }
    // big screen behind the stage
    const scr = this.builder();
    scr.boxAt(0, 6.5, -span / 2 - 5, 9.5, 8.5, 0.8, { t: 'plain', c: '#2b2d5c' });
    scr.boxAt(-4.2, 1, -span / 2 - 5, 0.8, 11, 0.8, { t: 'hstripe', c: '#ffffff', c2: '#ff5fa2', s: 1.2 });
    scr.boxAt(4.2, 1, -span / 2 - 5, 0.8, 11, 0.8, { t: 'hstripe', c: '#ffffff', c2: '#ff5fa2', s: 1.2 });
    this.addStatic(scr.build());
    const panel = new Mesh(new PlaneGeometry(8.2, 7.2), blank);
    panel.position.set(0, 6.5, -span / 2 - 4.55);
    this.root.add(panel);
    const ring = new Mesh(new PlaneGeometry(8.2, 0.5), new MeshBasicMaterial({ color: 0xffd84d }));
    ring.position.set(0, 2.6, -span / 2 - 4.5);
    this.root.add(ring);
    this.updaters.push(() => {
      const st = L.st;
      for (const tl of L.tiles) {
        const m = tl.mesh.material;
        m[0] = tl.face >= 0 ? fruitMats[tl.face] : tl.face === -2 ? gone : blank;
      }
      const show = st.stage === 'hide' || st.stage === 'drop' || st.stage === 'rise';
      panel.material = show && st.target >= 0 ? fruitMats[st.target] : blank;
      const cyc = st.stage === 'hide' ? Math.max(0, st.countdown) / 3.6 : st.stage === 'show' ? 1 : 0;
      ring.scale.x = Math.max(0.001, cyc);
    });
  }

  hexTiles(L, S, HH) {
    const geo = new CylinderGeometry(S * 0.965, S * 0.965, HH * 2, 6, 1);
    // lighter top, darker sides
    const col = [];
    const nrm = geo.getAttribute('normal');
    for (let i = 0; i < nrm.count; i++) {
      const top = nrm.getY(i) > 0.5;
      const v = top ? 1 : nrm.getY(i) < -0.5 ? 0.55 : 0.78;
      col.push(v, v, v);
    }
    geo.setAttribute('color', new Float32BufferAttribute(col, 3));
    const mat = new MeshPhongMaterial({ vertexColors: true, shininess: 40, specular: 0x333333 });
    this.owned.push(mat);
    const im = new InstancedMesh(geo, mat, L.tiles.length);
    // stacked floors would shade each other almost black; only receive
    im.castShadow = false;
    im.receiveShadow = this.shadows;
    const layerCol = [new Color('#ff7ac0'), new Color('#ffd84d'), new Color('#5fd3ff')];
    const hot = new Color('#ffffff');
    const tmp = new Color();
    const o = new Object3D();
    this.root.add(im);
    this.updaters.push((alpha, dt, time) => {
      let n = 0;
      for (const tl of L.tiles) {
        if (tl.state === 3) continue;
        const base = layerCol[tl.li];
        let y = tl.y, s = 1;
        if (tl.state === 1) {
          const f = Math.min(1, tl.t / 0.8);
          tmp.copy(base).lerp(hot, 0.35 + 0.5 * f * (0.5 + 0.5 * Math.sin(time * 40)));
          y -= f * 0.12;
        } else if (tl.state === 2) {
          tmp.copy(base).lerp(hot, 0.3);
          s = Math.max(0.05, 1 - tl.t * 0.5);
        } else {
          // subtle ripple on intact floors
          tmp.copy(base).multiplyScalar(0.92 + 0.08 * Math.sin(time * 1.5 + tl.x * 0.3 + tl.z * 0.2 + tl.li));
        }
        o.position.set(tl.x, y, tl.z);
        o.scale.set(s, 1, s);
        o.updateMatrix();
        im.setMatrixAt(n, o.matrix);
        im.setColorAt(n, tmp);
        n++;
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    });
  }
}

// ---------------------------------------------------------------------------
const _m3 = new Matrix3();
const _v = new Vector3();
const _n = new Vector3();
const _mA = new Matrix4();
const _mB = new Matrix4();

export class GeoBuilder {
  constructor(gfx) {
    this.gfx = gfx;
    this.groups = new Map();
  }

  group(spec) {
    if (typeof spec === 'string') spec = { t: 'plain', c: spec };
    const k = keyOf(spec);
    let g = this.groups.get(k);
    if (!g) { g = { spec, pos: [], nrm: [], uv: [] }; this.groups.set(k, g); }
    return g;
  }

  // Add one quad (4 corners in local space, CCW seen from outside) with UVs.
  quad(m, spec, p0, p1, p2, p3, uv) {
    const g = this.group(spec);
    _m3.getNormalMatrix(m);
    // (p1 - p0) x (p2 - p0): also valid for fan triangles where p3 === p0
    const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    _n.set(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]).applyMatrix3(_m3).normalize();
    const pts = [p0, p1, p2, p0, p2, p3];
    const uvs = [uv[0], uv[1], uv[2], uv[0], uv[2], uv[3]];
    for (let i = 0; i < 6; i++) {
      _v.set(pts[i][0], pts[i][1], pts[i][2]).applyMatrix4(m);
      g.pos.push(_v.x, _v.y, _v.z);
      g.nrm.push(_n.x, _n.y, _n.z);
      g.uv.push(uvs[i][0], uvs[i][1]);
    }
  }

  box(m, w, h, d, look) {
    const L = look.top || look.side ? look : { top: look, side: look, bottom: look };
    const top = L.top || L.side, side = L.side || L.top, bottom = L.bottom || side, front = L.front || side;
    const x = w / 2, y = h / 2, z = d / 2;
    const s = (sp) => (sp.s || 2);
    const fit = (sp) => sp.t === 'door' || sp.t === 'text' || sp.t === 'band' || sp.t === 'spiral';
    const uvR = (sp, a0, a1, b0, b1) => fit(sp) ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[a0 / s(sp), b0 / s(sp)], [a1 / s(sp), b0 / s(sp)], [a1 / s(sp), b1 / s(sp)], [a0 / s(sp), b1 / s(sp)]];
    // top (+y)
    this.quad(m, top, [-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], uvR(top, -x, x, z, -z).map(([u, v]) => [u, -v]));
    // bottom
    this.quad(m, bottom, [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], uvR(bottom, -x, x, -z, z));
    // +z (front)
    this.quad(m, front, [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], uvR(front, -x, x, -y, y));
    // -z
    this.quad(m, front, [x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], uvR(front, -x, x, -y, y));
    // +x
    this.quad(m, side, [x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], uvR(side, -z, z, -y, y));
    // -x
    this.quad(m, side, [-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], uvR(side, -z, z, -y, y));
  }

  cyl(m, rTop, rBot, h, seg, look, a0 = 0, a1 = Math.PI * 2) {
    const L = look.top || look.side ? look : { top: look, side: look, bottom: look };
    const top = L.top || L.side, side = L.side || L.top, bottom = L.bottom || side;
    const y = h / 2;
    const ss = side.s || 2;
    const fitTop = top.t === 'spiral' || top.t === 'band';
    const ts = top.s || 2;
    const full = a1 - a0 >= Math.PI * 2 - 1e-6;
    for (let i = 0; i < seg; i++) {
      const t0 = a0 + ((a1 - a0) * i) / seg, t1 = a0 + ((a1 - a0) * (i + 1)) / seg;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      // side (angles run atan2(z, x) counter-clockwise; quad wound outward)
      const u0 = (t0 * (rTop + rBot)) / 2 / ss, u1 = (t1 * (rTop + rBot)) / 2 / ss;
      this.quad(m, side, [rBot * c1, -y, rBot * s1], [rBot * c0, -y, rBot * s0], [rTop * c0, y, rTop * s0], [rTop * c1, y, rTop * s1], [[-u1, -y / ss], [-u0, -y / ss], [-u0, y / ss], [-u1, y / ss]]);
      // caps as thin quads from centre (degenerate quad = triangle)
      const tuv = (cx, cz) => fitTop ? [cx / (2 * rTop) + 0.5, -cz / (2 * rTop) + 0.5] : [cx / ts, -cz / ts];
      this.quad(m, top, [0, y, 0], [rTop * c1, y, rTop * s1], [rTop * c0, y, rTop * s0], [0, y, 0], [tuv(0, 0), tuv(rTop * c1, rTop * s1), tuv(rTop * c0, rTop * s0), tuv(0, 0)]);
      this.quad(m, bottom, [0, -y, 0], [rBot * c0, -y, rBot * s0], [rBot * c1, -y, rBot * s1], [0, -y, 0], [[0, 0], [0, 0], [0, 0], [0, 0]]);
    }
    if (!full) {
      // flat end faces of a partial cylinder
      for (const t of [a0, a1]) {
        const c = Math.cos(t), s = Math.sin(t);
        const pts = t === a0
          ? [[0, -y, 0], [rBot * c, -y, rBot * s], [rTop * c, y, rTop * s], [0, y, 0]]
          : [[rBot * c, -y, rBot * s], [0, -y, 0], [0, y, 0], [rTop * c, y, rTop * s]];
        this.quad(m, side, pts[0], pts[1], pts[2], pts[3], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      }
    }
  }

  // Annular sector, axis Y, angles atan2(z, x).
  sector(m, rIn, rOut, h, a0, a1, look) {
    const L = look.top || look.side ? look : { top: look, side: look };
    const top = L.top || L.side, side = L.side || L.top;
    const y = h / 2;
    const seg = Math.max(4, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 48));
    const ts = top.s || 2, ss = side.s || 2;
    for (let i = 0; i < seg; i++) {
      const t0 = a0 + ((a1 - a0) * i) / seg, t1 = a0 + ((a1 - a0) * (i + 1)) / seg;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      const P = (r, c, s, yy) => [r * c, yy, r * s];
      const tu = (p) => [p[0] / ts, -p[2] / ts];
      const q = [P(rIn, c0, s0, y), P(rIn, c1, s1, y), P(rOut, c1, s1, y), P(rOut, c0, s0, y)];
      this.quad(m, top, q[0], q[1], q[2], q[3], q.map(tu));
      // outer wall
      const u0 = (t0 * rOut) / ss, u1 = (t1 * rOut) / ss;
      this.quad(m, side, P(rOut, c1, s1, -y), P(rOut, c0, s0, -y), P(rOut, c0, s0, y), P(rOut, c1, s1, y), [[-u1, -y / ss], [-u0, -y / ss], [-u0, y / ss], [-u1, y / ss]]);
      // inner wall
      if (rIn > 0) this.quad(m, side, P(rIn, c0, s0, -y), P(rIn, c1, s1, -y), P(rIn, c1, s1, y), P(rIn, c0, s0, y), [[0, 0], [1, 0], [1, 1], [0, 1]]);
      // bottom
      this.quad(m, side, P(rIn, c1, s1, -y), P(rIn, c0, s0, -y), P(rOut, c0, s0, -y), P(rOut, c1, s1, -y), [[0, 0], [0, 0], [0, 0], [0, 0]]);
    }
    for (const t of [a0, a1]) {
      const c = Math.cos(t), s = Math.sin(t);
      const a = [rIn * c, -y, rIn * s], b = [rOut * c, -y, rOut * s], cc = [rOut * c, y, rOut * s], d = [rIn * c, y, rIn * s];
      const uv = [[0, -y / ss], [(rOut - rIn) / ss, -y / ss], [(rOut - rIn) / ss, y / ss], [0, y / ss]];
      if (t === a0) this.quad(m, side, b, a, d, cc, uv);
      else this.quad(m, side, a, b, cc, d, uv);
    }
  }

  // Append an arbitrary three geometry (positions/normals/uvs) under matrix m.
  geometry(geo, m, spec, uScale = 1, vScale = 1) {
    const g = this.group(spec);
    const p = geo.getAttribute('position'), n = geo.getAttribute('normal'), uv = geo.getAttribute('uv');
    const idx = geo.getIndex();
    _m3.getNormalMatrix(m);
    const count = idx ? idx.count : p.count;
    for (let k = 0; k < count; k++) {
      const i = idx ? idx.getX(k) : k;
      _v.fromBufferAttribute(p, i).applyMatrix4(m);
      _n.fromBufferAttribute(n, i).applyMatrix3(_m3).normalize();
      g.pos.push(_v.x, _v.y, _v.z);
      g.nrm.push(_n.x, _n.y, _n.z);
      g.uv.push(uv ? uv.getX(i) * uScale : 0, uv ? uv.getY(i) * vScale : 0);
    }
  }

  sphere(m, seg, spec) {
    this.geometry(sphereGeo(seg), m, spec);
  }

  capsuleX(m, halfLen, r, spec) {
    const geo = capsuleGeo(r, halfLen * 2);
    _mA.makeRotationZ(-Math.PI / 2);
    _mB.multiplyMatrices(m, _mA);
    this.geometry(geo, _mB, spec, 3, (halfLen * 2 + 2 * r) / (spec.s || 1.3));
  }

  // --- local-coordinate conveniences used by deco callbacks
  boxAt(x, y, z, w, h, d, look) {
    this.box(_mA.makeTranslation(x, y, z), w, h, d, look);
  }

  cylAt(x, y, z, r, h, look, rotX = 0, rBot = r) {
    _mA.makeRotationX(rotX).setPosition(x, y, z);
    this.cyl(_mA, r, rBot, h, 28, look);
  }

  sphereAt(x, y, z, r, spec, sx = 1, sy = 1, sz = 1) {
    _mA.makeScale(r * sx, r * sy, r * sz).setPosition(x, y, z);
    this.sphere(_mA, 18, spec);
  }

  capsuleXAt(x, y, z, halfLen, r, spec) {
    this.capsuleX(_mA.makeTranslation(x, y, z), halfLen, r, spec);
  }

  build() {
    if (this.groups.size === 0) return null;
    const geo = new BufferGeometry();
    const pos = [], nrm = [], uv = [];
    const mats = [];
    let start = 0;
    for (const g of this.groups.values()) {
      const n = g.pos.length / 3;
      if (!n) continue;
      pos.push(...g.pos);
      nrm.push(...g.nrm);
      uv.push(...g.uv);
      geo.addGroup(start, n, mats.length);
      mats.push(this.gfx.material(g.spec));
      start += n;
    }
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    return new Mesh(geo, mats);
  }
}

const sphereCache = new Map();
function sphereGeo(seg) {
  if (!sphereCache.has(seg)) sphereCache.set(seg, new SphereGeometry(1, seg, Math.max(6, Math.round(seg * 0.65))));
  return sphereCache.get(seg);
}
function capsuleGeo(r, len) {
  return new CapsuleGeometry(r, len, 6, 16);
}

export { DoubleSide };
