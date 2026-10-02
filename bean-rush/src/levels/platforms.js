// 漂浮積木 — race across the goo on moving blocks: sliders, lifts and ferries.

import { Path } from '../ai.js';
import { LK, arch, gridSpawns, areaSpawner } from './parts.js';
import { TAU } from '../util.js';

const BLOCK = (c) => ({ top: { t: 'grid', c, c2: '#ffffff', s: 2 }, side: { t: 'hstripe', c: '#ffffff', c2: c, s: 0.8 } });

export default {
  id: 'blocks',
  name: '漂浮積木',
  en: 'FLOAT BLOCKS',
  type: 'race',
  desc: '積木在黏液上滑來滑去、升上降下。看準時機跳上去，別掉下去！',
  tip: '平台還沒靠過來就先等一下，跳太早會掉下去。',
  sky: 'day',
  build({ kit: k, sim, rng }) {
    const movers = [];
    // a moving block: centre (x, top-0.5, z), size w×d, motion f(t) → {x,y,z} offset
    const mover = (x, top, z, w, d, look, f) => {
      const body = k.body(x, top - 0.5, z, {});
      k.addBox(body, 0, 0, 0, w, 1, d, { look });
      movers.push({ body, home: { x, y: top - 0.5, z }, f });
      return body;
    };

    k.box(0, -0.6, -5, 26, 1.2, 14, { look: LK.start });
    arch(k, 0, 0, -11.4, 21.6, { c: '#3fc8ff', banner: 'checker' });
    k.box(0, -0.6, -16.5, 18, 1.2, 9, { look: LK.floorSky });

    // 1. sliders: two rows of blocks gliding left-right
    const P1 = 4.4;
    for (const [z, ph] of [[-23.2, 0], [-29.4, Math.PI / 2]]) {
      for (const k2 of [0, 1]) {
        // the pair glides together so the two blocks never overlap
        mover(k2 ? 3.6 : -3.6, 0, z, 4.2, 4.2, BLOCK(k2 ? '#ffd84d' : '#ff86c8'), (t) => ({ x: Math.sin((t / P1) * TAU + ph) * 2.2, y: 0, z: 0 }));
      }
    }
    k.box(0, -0.6, -37, 18, 1.2, 10, { look: LK.floorLilac });

    // 2. lifts up to a higher shelf
    const P2 = 4.2;
    [-5, 0, 5].forEach((x, i) => {
      mover(x, 0, -44.4, 4.2, 4.6, BLOCK(['#5fd3ff', '#9be7b0', '#c9b8ff'][i]), (t) => ({ x: 0, y: (1 - Math.cos((t / P2) * TAU + i * 2.1)) * 2.1, z: 0 }));
    });
    k.box(0, (4.2 - 6) / 2, -52.4, 18, 10.2, 11.4, { look: LK.floorMint });

    // 3. ferries shuttling forward and back over a long gap
    const P3 = 6.5;
    [-4.5, 4.5].forEach((x, i) => {
      mover(x, 4.2, -63, 5, 6, BLOCK(i ? '#ffb37a' : '#ff9ad5'), (t) => ({ x: 0, y: 0, z: -Math.sin((t / P3) * TAU + i * Math.PI) * 2.2 }));
    });
    k.box(0, (4.2 - 6) / 2, -76, 18, 10.2, 12, { look: LK.floorLemon });
    // 4. last sliders, faster, then the finish
    for (const [z, ph] of [[-84.6, 1], [-90.2, 2.4]]) {
      mover(-3.7, 4.2, z, 4.4, 4.8, BLOCK('#7be07b'), (t) => ({ x: Math.sin((t / 3.8) * TAU + ph) * 2.3, y: 0, z: 0 }));
      mover(3.7, 4.2, z, 4.4, 4.8, BLOCK('#5fd3ff'), (t) => ({ x: Math.sin((t / 3.8) * TAU + ph) * 2.3, y: 0, z: 0 }));
    }
    k.box(0, (4.2 - 6) / 2, -102, 24, 10.2, 18, { look: LK.finish });
    arch(k, 0, 4.2, -101, 22, { c: '#ffb000', banner: 'checker' });

    const path = new Path([
      { x: 0, z: 2, w: 7 },
      { x: 0, z: -12, w: 5 },
      { x: 0, z: -20.5, lanes: [-3.6, 3.6], laneW: 0.5 },
      { x: 0, z: -33, w: 4 },
      { x: 0, z: -41.5, lanes: [-5, 0, 5], laneW: 0.3 },
      { x: 0, z: -47.5, w: 5 },
      { x: 0, z: -59.5, lanes: [-4.5, 4.5], laneW: 0.4 },
      { x: 0, z: -70, w: 5 },
      { x: 0, z: -82.4, lanes: [-3.7, 3.7], laneW: 0.5 },
      { x: 0, z: -94, w: 5 },
      { x: 0, z: -108, w: 6 },
    ]);

    return {
      path,
      hazards: [],
      killY: -7,
      timeLimit: 150,
      checkpoints: [
        { test: () => false, spawn: areaSpawner(-7, 7, -3, -10, 0.1) },
        { test: (p) => p.z < -32.5 && p.y > -0.5, spawn: areaSpawner(-6, 6, -33, -35, 0.1) },
        { test: (p) => p.z < -47.2 && p.y > 3.6, spawn: areaSpawner(-6, 6, -48, -50, 4.3) },
        { test: (p) => p.z < -70.5 && p.y > 3.6, spawn: areaSpawner(-6, 6, -71, -73, 4.3) },
      ],
      spawns: (n) => gridSpawns(n, 0, -5, 17, 9, 0.05, rng),
      finish: (p) => p.z < -101 && p.y > 3.6,
      camYaw: () => 0,
      camPitch: 0.4,
      flyover: [
        [0, 22, -118, 0, 4, -98],
        [14, 14, -80, 0, 4, -70],
        [-13, 12, -50, 0, 2, -44],
        [12, 9, -26, 0, 0, -24],
        [0, 6.5, 9, 0, 1.2, -6],
      ],
      update(t) {
        for (const m of movers) {
          const o = m.f(t);
          const o2 = m.f(t + 0.01);
          m.body.pos.set(m.home.x + o.x, m.home.y + o.y, m.home.z + o.z);
          m.body.vel.set((o2.x - o.x) * 100, (o2.y - o.y) * 100, (o2.z - o.z) * 100);
        }
      },
    };
  },
};
