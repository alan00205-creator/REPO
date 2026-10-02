// 彈跳夜市 — race up a staircase of tall tiers; the only way up is the trampoline at the
// foot of each wall. Bouncy pillars and a sweeper make each tier busy.

import { Path } from '../ai.js';
import { LK, sweeper, arch, gridSpawns, areaSpawner, ramp, turntable } from './parts.js';

const W = 18;
const TRAMP = { top: { t: 'dots', c: '#ff5fa2', c2: '#ffd1ec', s: 1.2 }, side: { t: 'hstripe', c: '#2b2d5c', c2: '#ff5fa2', s: 0.6 } };
const PILLAR = { t: 'band', c: '#5fd3ff', c2: '#ffffff', shiny: 1 };

export default {
  id: 'bounce',
  name: '彈跳夜市',
  en: 'BOUNCE MARKET',
  type: 'race',
  desc: '一層比一層高！踩上牆腳的彈跳床才上得去，小心彈跳柱把你撞飛。',
  tip: '彈跳床在每一層的盡頭，直直衝過去就會被彈上去。',
  sky: 'sunset',
  build({ kit: k, sim, rng }) {
    // tier: a tall block whose top is at y, spanning z0 → z1 (z1 more negative)
    const tier = (y, z0, z1, look) => k.box(0, (y - 6) / 2, (z0 + z1) / 2, W, y + 6, z0 - z1, { look });
    const tramp = (y, z0) => k.box(0, y - 0.2, z0 - 1.1, W - 0.2, 0.3, 2.2, { bounce: 15.5, look: TRAMP });

    k.box(0, -0.6, -5, 26, 1.2, 14, { look: LK.start });
    arch(k, 0, 0, -11.4, 21.6, { c: '#ff9a3c', banner: 'checker' });

    // tier 0 (ground level) with bouncy pillars
    tier(0, -12, -34, LK.floorPeach);
    const bumpers = [];
    const pillar = (x, y, z) => {
      const b = k.body(x, y + 1.1, z, { bounce: 8.5, ground: false, kinematic: false });
      k.addCyl(b, 0, 0, 0, 0.75, 2.2, { look: { top: { t: 'plain', c: '#ffffff' }, side: PILLAR } });
      bumpers.push({ x, z, y });
    };
    for (const [x, z] of [[-5, -17], [0, -20], [5, -17], [-6.5, -24], [6.5, -24], [-2, -26], [2.6, -26.5], [-4.5, -30.5], [0.5, -31], [5.5, -30.5]]) pillar(x, 0, z);
    tramp(0, -34);

    // tier 1: a cross-shaped sweeper
    tier(3.5, -36.2, -62, LK.floorLilac);
    const sw = sweeper(k, sim, 0, 3.5, -49, { len: 8, speed: 0.8, cross: true });
    tramp(3.5, -62);

    // tier 2: a pillar maze
    tier(7, -64.2, -86, LK.floorMint);
    for (const [x, z] of [[-6, -68], [-2, -69], [2, -68], [6, -69], [-4, -73], [0, -74], [4, -73], [-7, -78], [-2, -78.5], [3, -78], [7, -78.5], [-4.5, -82.5], [0.5, -83], [5, -82.5]]) pillar(x, 7, z);
    tramp(7, -86);

    // tier 3, a slide down, two spinning discs, then the finish
    tier(10.5, -88.2, -96, LK.floorSky);
    ramp(k, 0, -96, 10.5, -106, 6, W, 1.2, LK.floorLemon);
    k.box(0, 6 - 0.6, -108, W, 1.2, 4, { look: LK.floorLemon });
    const discs = [turntable(k, 0, 5.6, -114.7, 4.6, 0.8, 0.7, LK.disc), turntable(k, 1.6, 5.6, -124.4, 4.6, 0.8, -0.85, LK.disc3)];
    k.box(0, 6 - 0.6, -137, 24, 1.2, 16, { look: LK.finish });
    arch(k, 0, 6, -134, 22, { c: '#ffb000', banner: 'checker' });

    const bumperHint = {
      aiHint(bean) {
        for (const p of bumpers) {
          if (Math.abs(bean.pos.y - p.y) > 1.5) continue;
          const ahead = bean.pos.z - p.z, lat = bean.pos.x - p.x;
          if (ahead > 0.3 && ahead < 3 && Math.abs(lat) < 1.6) return { dodge: lat >= 0 ? 1 : -1, slow: 0.85 };
        }
        return null;
      },
    };

    const path = new Path([
      { x: 0, z: 2, w: 7 },
      { x: 0, z: -12, w: 6 },
      { x: 0, z: -35, w: 6, look: 2.5 },
      { x: 0, z: -37, w: 6 },
      { x: 0, z: -63, w: 6, look: 2.5 },
      { x: 0, z: -65, w: 6 },
      { x: 0, z: -87, w: 6, look: 2.5 },
      { x: 0, z: -89, w: 6 },
      { x: 0, z: -109, w: 2 },
      { x: 0, z: -114.7, w: 1.4 },
      { x: 1.6, z: -124.4, w: 1.4 },
      { x: 0, z: -131, w: 6 },
      { x: 0, z: -142, w: 6 },
    ]);

    return {
      path,
      hazards: [sw, bumperHint],
      killY: -7,
      timeLimit: 150,
      checkpoints: [
        { test: () => false, spawn: areaSpawner(-7, 7, -3, -10, 0.1) },
        { test: (p) => p.z < -36.6 && p.y > 3, spawn: areaSpawner(-7, 7, -37.5, -39.5, 3.6) },
        { test: (p) => p.z < -64.6 && p.y > 6.5, spawn: areaSpawner(-7, 7, -65.2, -66.8, 7.1) },
        { test: (p) => p.z < -88.6 && p.y > 10, spawn: areaSpawner(-6, 6, -89.2, -91, 10.6) },
      ],
      spawns: (n) => gridSpawns(n, 0, -5, 17, 9, 0.05, rng),
      finish: (p) => p.z < -134 && p.y > 5.4,
      camYaw: () => 0,
      camPitch: 0.36,
      flyover: [
        [0, 22, -150, 0, 6, -130],
        [14, 18, -104, 0, 8, -92],
        [-12, 16, -78, 0, 7, -72],
        [-13, 13, -48, 0, 4, -44],
        [12, 9, -22, 0, 1, -20],
        [0, 6.5, 9, 0, 1.2, -6],
      ],
      update(t, dt) {
        sw.update(dt);
        for (const d of discs) d.update(dt);
      },
    };
  },
};
