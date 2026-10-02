// Pooled instanced particles: confetti, dust puffs, dizzy stars, goo splashes.

import {
  InstancedMesh, PlaneGeometry, IcosahedronGeometry, MeshBasicMaterial, MeshLambertMaterial, Object3D, Color,
  DoubleSide, Shape, ShapeGeometry, DynamicDrawUsage,
} from 'three';

const CONFETTI = ['#ff5fa2', '#ffd84d', '#5fd3ff', '#7be07b', '#b58cff', '#ff9a3c', '#ffffff'];

class Pool {
  constructor(scene, geo, mat, n) {
    this.mesh = new InstancedMesh(geo, mat, n);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.p = [];
    this.n = n;
  }
  add(o) {
    if (this.p.length >= this.n) this.p.shift();
    this.p.push(o);
    return o;
  }
}

const o3 = new Object3D();
const col = new Color();

export class FX {
  constructor(scene) {
    this.scene = scene;
    const star = new Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.45 : 1;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    this.confetti = new Pool(scene, new PlaneGeometry(0.14, 0.24), new MeshBasicMaterial({ side: DoubleSide }), 600);
    this.puff = new Pool(scene, new IcosahedronGeometry(1, 1), new MeshLambertMaterial({ color: 0xffffff }), 160);
    this.stars = new Pool(scene, new ShapeGeometry(star), new MeshBasicMaterial({ color: 0xffe14d, side: DoubleSide }), 80);
    this.goo = new Pool(scene, new IcosahedronGeometry(1, 1), new MeshLambertMaterial({ color: 0xff7ad9, emissive: 0x6a1f5c }), 160);
    for (let i = 0; i < 600; i++) this.confetti.mesh.setColorAt(i, col.set(CONFETTI[i % CONFETTI.length]));
  }

  burstConfetti(x, y, z, n = 60, spread = 3, up = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * spread;
      this.confetti.add({
        x: x + Math.cos(a) * s * 0.3, y, z: z + Math.sin(a) * s * 0.3,
        vx: Math.cos(a) * s * 1.6, vy: up * (0.6 + Math.random() * 0.6), vz: Math.sin(a) * s * 1.6,
        rx: Math.random() * 6, ry: Math.random() * 6, wr: 4 + Math.random() * 8, life: 3 + Math.random() * 2, t: 0,
        c: Math.floor(Math.random() * CONFETTI.length),
      });
    }
  }

  rainConfetti(x, y, z, n = 120, w = 14) {
    for (let i = 0; i < n; i++) {
      this.confetti.add({
        x: x + (Math.random() - 0.5) * w, y: y + Math.random() * 6, z: z + (Math.random() - 0.5) * w,
        vx: 0, vy: -1 - Math.random(), vz: 0, rx: Math.random() * 6, ry: Math.random() * 6, wr: 3 + Math.random() * 6,
        life: 4 + Math.random() * 2, t: 0,
      });
    }
  }

  dust(x, y, z, n = 6, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      this.puff.add({
        x: x + Math.cos(a) * 0.3, y: y + 0.1, z: z + Math.sin(a) * 0.3,
        vx: Math.cos(a) * 1.8 * power, vy: 0.6 + Math.random() * 0.6, vz: Math.sin(a) * 1.8 * power,
        s: 0.16 + Math.random() * 0.1 * power, life: 0.45 + Math.random() * 0.2, t: 0,
      });
    }
  }

  bonk(bean) {
    for (let i = 0; i < 4; i++) this.stars.add({ bean, a: (i / 4) * Math.PI * 2, life: 1.6, t: 0 });
  }

  splash(x, y, z) {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 3;
      this.goo.add({
        x, y, z, vx: Math.cos(a) * s, vy: 5 + Math.random() * 6, vz: Math.sin(a) * s,
        s: 0.12 + Math.random() * 0.2, life: 1 + Math.random() * 0.5, t: 0,
      });
    }
  }

  clear() {
    for (const p of [this.confetti, this.puff, this.stars, this.goo]) p.p.length = 0;
  }

  update(dt) {
    // confetti
    {
      const P = this.confetti;
      let n = 0;
      P.p = P.p.filter((q) => (q.t += dt) < q.life);
      for (const q of P.p) {
        q.vy -= 9 * dt;
        q.vx *= 1 - 1.6 * dt; q.vz *= 1 - 1.6 * dt;
        if (q.vy < -2.2) q.vy = -2.2;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        q.rx += q.wr * dt; q.ry += q.wr * 0.7 * dt;
        o3.position.set(q.x + Math.sin(q.t * 3 + q.rx) * 0.15, q.y, q.z);
        o3.rotation.set(q.rx, q.ry, 0);
        const s = Math.min(1, (q.life - q.t) * 2);
        o3.scale.set(s, s, s);
        o3.updateMatrix();
        P.mesh.setMatrixAt(n++, o3.matrix);
      }
      P.mesh.count = n;
      P.mesh.instanceMatrix.needsUpdate = true;
    }
    for (const P of [this.puff, this.goo]) {
      let n = 0;
      P.p = P.p.filter((q) => (q.t += dt) < q.life);
      for (const q of P.p) {
        if (P === this.goo) q.vy -= 22 * dt; else { q.vx *= 1 - 4 * dt; q.vz *= 1 - 4 * dt; q.vy *= 1 - 2 * dt; }
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
        const k = q.t / q.life;
        const s = P === this.goo ? q.s * (1 - k * 0.6) : q.s * (1 + k * 1.8) * (1 - k);
        o3.position.set(q.x, q.y, q.z);
        o3.rotation.set(0, 0, 0);
        o3.scale.set(s, s, s);
        o3.updateMatrix();
        P.mesh.setMatrixAt(n++, o3.matrix);
      }
      P.mesh.count = n;
      P.mesh.instanceMatrix.needsUpdate = true;
    }
    {
      const P = this.stars;
      let n = 0;
      P.p = P.p.filter((q) => (q.t += dt) < q.life && q.bean.active);
      for (const q of P.p) {
        const b = q.bean;
        q.a += dt * 5;
        const lying = b.state === 'tumble' || b.state === 'getup';
        const hy = lying ? 0.9 : 1.75;
        o3.position.set(b.pos.x + Math.cos(q.a) * 0.45, b.pos.y + hy + Math.sin(q.a * 2) * 0.05, b.pos.z + Math.sin(q.a) * 0.45);
        o3.rotation.set(0, -q.a, 0);
        const s = 0.12 * Math.min(1, (q.life - q.t) * 3);
        o3.scale.set(s, s, s);
        o3.updateMatrix();
        P.mesh.setMatrixAt(n++, o3.matrix);
      }
      P.mesh.count = n;
      P.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
