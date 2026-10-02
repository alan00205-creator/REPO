// 拳擊走廊 — race down narrow walkways while boxing-glove pistons punch out from the sides.

import { Path } from '../ai.js';
import { LK, arch, gridSpawns, areaSpawner } from './parts.js';

const HALF = 4; // walkway half-width
const GLOVE = { top: { t: 'plain', c: '#ff4f64' }, side: { t: 'band', c: '#ff4f64', c2: '#ffffff', shiny: 1 }, front: { t: 'plain', c: '#ff7a8a', shiny: 1 } };
const HOUSING = { top: { t: 'plain', c: '#ffd84d' }, side: { t: 'hstripe', c: '#2b2d5c', c2: '#ffd84d', s: 0.9 } };

// extension 0..1 over one cycle: rest, punch, hold, retract
function ext(u) {
  if (u < 0.5) return 0;
  if (u < 0.56) return (u - 0.5) / 0.06;
  if (u < 0.74) return 1;
  return Math.max(0, 1 - (u - 0.74) / 0.26);
}

export default {
  id: 'punch',
  name: '拳擊走廊',
  en: 'PUNCH ALLEY',
  type: 'race',
  desc: '窄窄的走道兩邊藏著拳擊手套，一出拳就把豆豆揍進黏液。抓準空檔衝過去！',
  tip: '手套縮回去的瞬間就是通過的時機。',
  sky: 'sunset',
  build({ kit: k, sim, rng }) {
    const pistons = [];
    const REACH = 4.6;
    const piston = (side, z, period, phase) => {
      const homeX = side * (HALF + 1.6);
      k.box(side * (HALF + 2.3), 0.9, z, 2.2, 3.0, 3.0, { look: HOUSING });
      const body = k.body(homeX, 1.0, z, { hazard: 1.15, ground: false });
      k.addBox(body, 0, 0, 0, 2.8, 1.8, 2.4, { look: GLOVE });
      pistons.push({ side, z, period, phase, body, homeX });
    };

    k.box(0, -0.6, -5, 26, 1.2, 14, { look: LK.start });
    arch(k, 0, 0, -11.4, 21.6, { c: '#ff4f64', banner: 'checker' });

    // alley 1: pistons from alternating sides
    k.box(0, -0.6, -31, HALF * 2, 1.2, 38, { look: LK.floorPeach });
    for (let i = 0; i < 6; i++) piston(i % 2 ? 1 : -1, -16 - i * 5.6, 2.6 + (i % 3) * 0.25, rng());
    // rest stop
    k.box(0, -0.6, -55, 16, 1.2, 10, { look: LK.floorMint });
    // alley 2: pistons from both sides at once, and a split path
    k.box(-3.2, -0.6, -78, 4.4, 1.2, 36, { look: LK.floorLilac });
    k.box(3.2, -0.6, -78, 4.4, 1.2, 36, { look: LK.floorSky });
    for (let i = 0; i < 6; i++) {
      const z = -64 - i * 5.4;
      // a lane's glove comes in from its outer side
      const sideL = { side: -1, z, period: 2.3, phase: rng(), lane: -3.2 };
      const sideR = { side: 1, z: z - 2.7, period: 2.3, phase: rng(), lane: 3.2 };
      for (const p of [sideL, sideR]) {
        const homeX = p.side * (HALF + 3.0);
        k.box(p.side * (HALF + 3.6), 0.9, p.z, 2.2, 3.0, 3.0, { look: HOUSING });
        const body = k.body(homeX, 1.0, p.z, { hazard: 1.15, ground: false });
        k.addBox(body, 0, 0, 0, 2.8, 1.8, 2.4, { look: GLOVE });
        pistons.push({ side: p.side, z: p.z, period: p.period, phase: p.phase, body, homeX, reach: 6.2 });
      }
    }
    k.box(0, -0.6, -104, 24, 1.2, 16, { look: LK.finish });
    arch(k, 0, 0, -101, 22, { c: '#ffb000', banner: 'checker' });

    const xAt = (p, t) => p.homeX - p.side * (p.reach || REACH) * ext((((t / p.period + p.phase) % 1) + 1) % 1);
    // stay out of a glove's path while it is about to punch
    const pistonHint = {
      aiHint(bean) {
        for (const p of pistons) {
          const ahead = bean.pos.z - p.z;
          if (ahead < -1.8 || ahead > 3.8) continue;
          const travel = (ahead + 1.9) / 5.2;
          const from = ahead < 1.6 ? 0 : 0.05;
          for (let s = from; s <= travel + 0.1; s += 0.08) {
            const inner = xAt(p, sim.time + s) - p.side * 1.4; // glove's inner face
            const hit = p.side > 0 ? bean.pos.x > inner - 0.6 : bean.pos.x < inner + 0.6;
            if (!hit) continue;
            if (ahead >= 1.6) return { wait: true };
            // already in the glove's path: on the wide alley step aside, on the split lanes run
            return p.reach ? null : { dodge: -p.side, slow: 1 };
          }
        }
        return null;
      },
    };

    const path = new Path([
      { x: 0, z: 2, w: 6 },
      { x: 0, z: -12, w: 1.5 },
      { x: 0, z: -50, w: 4 },
      { x: 0, z: -60, lanes: [-3.2, 3.2], laneW: 0.4 },
      { x: 0, z: -96, w: 5 },
      { x: 0, z: -110, w: 6 },
    ]);

    return {
      path,
      hazards: [pistonHint],
      killY: -7,
      timeLimit: 150,
      checkpoints: [
        { test: () => false, spawn: areaSpawner(-7, 7, -3, -10, 0.1) },
        { test: (p) => p.z < -50.5 && p.y > -0.5, spawn: areaSpawner(-5, 5, -51, -54, 0.1) },
      ],
      spawns: (n) => gridSpawns(n, 0, -5, 17, 9, 0.05, rng),
      finish: (p) => p.z < -101 && p.y > -0.5,
      camYaw: () => 0,
      camPitch: 0.42,
      flyover: [
        [0, 18, -118, 0, 0, -100],
        [11, 10, -82, 0, 0, -76],
        [-11, 10, -44, 0, 0, -40],
        [10, 8, -20, 0, 0, -22],
        [0, 6.5, 9, 0, 1.2, -6],
      ],
      update(t) {
        for (const p of pistons) {
          const x = xAt(p, t);
          p.body.vel.set((xAt(p, t + 0.01) - x) * 100, 0, 0);
          p.body.pos.x = x;
        }
      },
    };
  },
};
