// 珍奶大滾坡 — uphill race against rolling tapioca pearls, a stirring-stick sweeper and
// backward conveyors.

import { Vector3 } from 'three';
import { Path } from '../ai.js';
import { LK, sweeper, ramp, arch, conveyor, gridSpawns, areaSpawner } from './parts.js';

const W = 22; // course width
const TAN = Math.tan((10 * Math.PI) / 180);

// Surface height along the course for the pearls (null over a trench).
function surf(z) {
  if (z > -12) return 0;
  if (z > -14.6) return null;
  if (z > -44) return (-14.6 - z) * (5.2 / 29.4);
  if (z > -66) return 5.2;
  if (z > -68.6) return null;
  if (z > -100) return 5.2 + (-68.6 - z) * (5.6 / 31.4);
  return 10.8;
}

export default {
  id: 'boba',
  name: '珍奶大滾坡',
  en: 'BOBA HILL',
  type: 'race',
  desc: '一路往上爬！巨大珍珠會從坡頂滾下來，小心別被撞回起點。',
  tip: '珍珠滾下來時往旁邊閃，別硬碰硬。',
  sky: 'sunset',
  build({ kit: k, sim, rng }) {
    // start
    k.box(0, -0.6, -5, 26, 1.2, 14, { look: LK.start });
    arch(k, 0, 0, -10.6, 24, { c: '#b07a4f' });
    // slope 1
    ramp(k, 0, -14.6, 0, -44, 5.2, W, 1.2, LK.tea);
    // plateau 1
    k.box(0, 5.2 - 0.6, -55, W, 1.2, 22, { look: LK.teaDark });
    const stir = sweeper(k, sim, 0, 5.2, -55, { len: 9.4, speed: 0.72, cross: true, look: { t: 'candy', c: '#ff8a3d', c2: '#fff1d6', s: 1.3, shiny: 1 } });
    // slope 2
    ramp(k, 0, -68.6, 5.2, -100, 10.8, W, 1.2, LK.tea);
    const ang = Math.atan(5.6 / 31.4);
    const down = new Vector3(0, -Math.sin(ang), Math.cos(ang)).multiplyScalar(3.4);
    const BELTS = [-76, -85.5, -94.5];
    for (const cz of BELTS) {
      const y = surf(cz);
      conveyor(k, 0, y + 0.07, cz, W - 0.4, 3.6, down.x, down.z, { rx: ang }).conveyor.copy(down);
    }
    // summit: a field of bouncy pearls, then the finish
    k.box(0, 10.8 - 0.6, -114, 26, 1.2, 28, { look: LK.finish });
    const bumpers = [];
    for (const [bx, bz] of [[-6.5, -103.5], [0, -103.5], [6.5, -103.5], [-3.2, -108], [3.2, -108], [-8.5, -108.5], [8.5, -108.5], [0, -112.5]]) {
      const body = k.body(bx, 10.8 + 1.0, bz, { bounce: 8.5, ground: false, kinematic: false });
      k.addSphere(body, 0, 0, 0, 1.15, { look: { t: 'band', c: '#ff9fd6', c2: '#ffffff', shiny: 1 }, seg: 20 });
      bumpers.push({ x: bx, z: bz });
    }
    arch(k, 0, 10.8, -118, 22, { c: '#b07a4f' });

    // trench floors are open goo; rails along the climb
    const rail = (z0, y0, z1, y1) => {
      ramp(k, -W / 2 - 0.35, z0, y0 + 1.4, z1, y1 + 1.4, 0.7, 1.4, LK.rail);
      ramp(k, W / 2 + 0.35, z0, y0 + 1.4, z1, y1 + 1.4, 0.7, 1.4, LK.rail);
    };
    rail(-14.6, 0, -44, 5.2);
    rail(-44, 5.2, -66, 5.2);
    rail(-68.6, 5.2, -100, 10.8);

    // pearl gantries
    const gantries = [
      { z: -43.2, y: 5.2, every: 1.05, outs: [-7.5, -2.5, 2.5, 7.5] },
      { z: -99.2, y: 10.8, every: 0.82, outs: [-8, -4, 0, 4, 8] },
    ];
    for (const g of gantries) {
      k.box(-W / 2 - 0.9, g.y + 3.6, g.z - 0.6, 1, 7.2, 1, { look: LK.post });
      k.box(W / 2 + 0.9, g.y + 3.6, g.z - 0.6, 1, 7.2, 1, { look: LK.post });
      k.deco(null, (b) => {
        b.capsuleXAt(0, g.y + 7.2, g.z - 0.6, W / 2 + 1, 0.9, { t: 'hstripe', c: '#ff6fb5', c2: '#ffffff', s: 1.2, shiny: 1 });
        for (const ox of g.outs) b.cylAt(ox, g.y + 6.3, g.z - 0.6, 1.0, 1.4, { side: { t: 'plain', c: '#ffffff' }, top: { t: 'plain', c: '#2a1a12' } });
      });
    }

    // giant cup behind the finish
    k.deco(null, (b) => {
      b.cylAt(0, 10.8 + 6, -136, 6, 12, { side: { t: 'cupside', c: '#f0d2a6', c2: '#3a2216', s: 4 }, top: { t: 'plain', c: '#d9a86c' } }, 0, 5.2);
      b.cylAt(2.4, 10.8 + 15, -135, 0.7, 10, { t: 'plain', c: '#ff5fa2', shiny: 1 }, 0.25);
    });

    // --- pearls
    const balls = [];
    for (let i = 0; i < 22; i++) {
      const r = 1.15 + rng() * 0.2;
      const body = k.body(0, -50, 0, { hazard: 0.58, ground: false });
      k.addSphere(body, 0, 0, 0, r, { look: LK.boba, seg: 18 });
      body.enabled = false;
      body.hidden = true;
      balls.push({ body, r, vel: body.vel, live: false, spin: 0 });
    }
    const timers = gantries.map(() => rng.range(0, 0.6));

    function spawnBall(g) {
      const b = balls.find((x) => !x.live);
      if (!b) return;
      const ox = rng.pick(g.outs) + rng.range(-0.6, 0.6);
      b.live = true;
      b.sink = 0;
      b.body.enabled = true;
      b.body.hidden = false;
      b.body.pos.set(ox, g.y + 6.0, g.z - 0.6);
      b.body.prevPos.copy(b.body.pos);
      b.vel.set(rng.range(-1.2, 1.2), -1, rng.range(1.5, 3));
      sim.emit('drop', null, b.body.pos);
    }

    const ballHint = {
      aiHint(bean) {
        for (const b of balls) {
          if (!b.live) continue;
          const ahead = bean.pos.z - b.body.pos.z; // ball uphill (more negative z) = ahead
          if (ahead < -1 || ahead > 9 || b.vel.z < 1) continue;
          const lat = bean.pos.x - b.body.pos.x;
          if (Math.abs(lat) > b.r + 1.1) continue;
          if (Math.abs(bean.pos.y - (b.body.pos.y - b.r)) > 3) continue;
          let dir = lat >= 0 ? 1 : -1;
          if (Math.abs(bean.pos.x + dir * 2) > W / 2 - 1) dir = -dir;
          // lateral axis for a -Z path is +X, so dodge sign maps straight onto x
          return { dodge: dir, slow: 0.8 };
        }
        return null;
      },
    };

    // steer around the bouncy pearls on the summit
    const bumperHint = {
      aiHint(bean) {
        if (bean.pos.z > -100) return null;
        for (const p of bumpers) {
          const ahead = bean.pos.z - p.z;
          const lat = bean.pos.x - p.x;
          if (ahead > 0.3 && ahead < 3.2 && Math.abs(lat) < 1.9) return { dodge: lat >= 0 ? 1 : -1, slow: 0.85 };
        }
        return null;
      },
    };

    // hop across the backward belts instead of trudging up them
    const beltHint = {
      aiHint(bean) {
        if (!bean.grounded) return null;
        for (const cz of BELTS) {
          if (bean.pos.z < cz + 2.5 && bean.pos.z > cz - 1.2) return { jump: true };
        }
        return null;
      },
    };

    const path = new Path([
      { x: 0, z: 2, w: 8 },
      { x: 0, z: -11, w: 7 },
      { x: 0, z: -16, w: 7.5 },
      { x: 0, z: -44, w: 7 },
      { x: 0, z: -66, w: 7 },
      { x: 0, z: -70, w: 7.5 },
      { x: 0, z: -100, w: 7 },
      { x: 0, z: -126, w: 6 },
    ]);

    return {
      path,
      hazards: [ballHint, stir, beltHint, bumperHint],
      killY: -7,
      timeLimit: 160,
      checkpoints: [
        { test: () => false, spawn: areaSpawner(-8, 8, -3, -10, 0.1) },
        { test: (p) => p.z < -44.6 && p.y > 4.4, spawn: areaSpawner(-8, 8, -45.2, -47.2, 5.3) },
        { test: (p) => p.z < -69.4 && p.y > 4.8, spawn: areaSpawner(-8, 8, -69.6, -71, 5.6) },
      ],
      spawns: (n) => gridSpawns(n, 0, -5, 18, 9, 0.05, rng),
      finish: (p) => p.z < -118 && p.y > 10,
      camYaw: () => 0,
      camPitch: 0.36,
      flyover: [
        [0, 22, -138, 0, 11, -116],
        [13, 16, -96, 0, 8, -86],
        [-12, 13, -58, 0, 5, -55],
        [11, 9, -30, 0, 2, -28],
        [0, 6.5, 9, 0, 1.2, -6],
      ],
      surf,
      update(t, dt) {
        stir.update(dt);
        {
          gantries.forEach((g, i) => {
            timers[i] -= dt;
            if (timers[i] <= 0) {
              const ramp = sim.phase === 'play' ? Math.min(1, sim.t / 40) : 0;
              timers[i] = g.every * rng.range(0.7, 1.3) * (1.15 - 0.3 * ramp);
              spawnBall(g);
            }
          });
        }
        for (const b of balls) {
          if (!b.live) continue;
          const p = b.body.pos, v = b.vel;
          v.y -= 26 * dt;
          p.addScaledVector(v, dt);
          const h = b.sink ? null : surf(p.z);
          if (h === null && !b.sink) b.sink = p.z > -40 ? -12 : -66;
          if (h !== null && p.y - b.r < h && p.y - b.r > h - 1.5) {
            p.y = h + b.r;
            if (v.y < -4) { v.y = -v.y * 0.28; sim.emit('thump', null, p); }
            else v.y = 0;
            const onSlope = (p.z < -14.6 && p.z > -44) || (p.z < -68.6 && p.z > -100);
            if (onSlope) v.z = Math.min(9.5, v.z + 3.2 * dt);
            else v.z = Math.max(1.5, v.z - 0.6 * dt);
          } else if (b.sink) {
            // dropped into a trench: stay inside its walls while sinking
            const near = b.sink;
            const far = near - 2.6;
            if (p.z > near - 0.3) p.z = near - 0.3;
            if (p.z < far + 0.3) p.z = far + 0.3;
            v.z *= 0.9;
          }
          if (Math.abs(p.x) > W / 2 - b.r) { p.x = Math.sign(p.x) * (W / 2 - b.r); v.x = -v.x * 0.7; }
          b.spin += (v.z / b.r) * dt;
          b.body.quat.setFromAxisAngle(AX, b.spin);
          if (p.y < -12 || p.z > 6) {
            b.live = false;
            b.body.enabled = false;
            b.body.hidden = true;
          }
        }
        // pearls bump each other
        for (let i = 0; i < balls.length; i++) {
          const a = balls[i];
          if (!a.live) continue;
          for (let j = i + 1; j < balls.length; j++) {
            const c = balls[j];
            if (!c.live) continue;
            const d = a.body.pos.distanceTo(c.body.pos);
            const m = a.r + c.r;
            if (d < m && d > 1e-4) {
              const n = TMP.subVectors(a.body.pos, c.body.pos).divideScalar(d);
              const push = (m - d) / 2;
              a.body.pos.addScaledVector(n, push);
              c.body.pos.addScaledVector(n, -push);
              const rv = TMP2.subVectors(a.vel, c.vel).dot(n);
              if (rv < 0) { a.vel.addScaledVector(n, -rv); c.vel.addScaledVector(n, rv); }
            }
          }
        }
      },
    };
  },
};

const AX = new Vector3(1, 0, 0);
const TMP = new Vector3();
const TMP2 = new Vector3();
export { TAN };
