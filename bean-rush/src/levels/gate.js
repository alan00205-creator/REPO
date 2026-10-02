// 大門衝衝衝 — opening race: sweepers, door walls, pendulum bridges, turntables.

import { Path } from '../ai.js';
import { LK, sweeper, pendulum, turntable, doorRow, ramp, arch, gridSpawns, areaSpawner } from './parts.js';

export default {
  id: 'gate',
  name: '大門衝衝衝',
  en: 'GATE RUSH',
  type: 'race',
  desc: '躲過旋轉棒、撞開真的門、通過擺錘吊橋，第一批衝過終點的晉級！',
  tip: '有些門是假的，撞不開就換一扇！',
  sky: 'day',
  build({ kit: k, sim, rng }) {
    // --- start plaza
    k.box(0, -0.6, -5, 26, 1.2, 14, { look: LK.start });
    arch(k, 0, 0, 1.5, 24, { c: '#ff5fa2', banner: 'checker' });

    // --- sweeper field
    k.box(0, -0.6, -33, 20, 1.2, 42, { look: LK.floorLilac });
    // soft rails so a swat sends you tumbling, not swimming
    k.box(-10.35, 0.6, -33, 0.7, 1.4, 42, { look: LK.rail });
    k.box(10.35, 0.6, -33, 0.7, 1.4, 42, { look: LK.rail });
    const sw1 = sweeper(k, sim, 0, 0, -21.5, { speed: 1.0, phase: 0.4 });
    const sw2 = sweeper(k, sim, 0, 0, -41.5, { speed: -1.15, phase: 1.9, look: LK.barBlue });

    // --- door rows
    k.box(0, -0.6, -68, 20, 1.2, 28, { look: LK.floorSky });
    const rows = [
      doorRow(k, sim, -60, 20, 5, 1, { t: 'plain', c: '#ffd84d', c2: '#ff9f1c' }, 0),
      doorRow(k, sim, -68, 20, 5, 2, { t: 'plain', c: '#6fe0ff', c2: '#2f8cff' }, 1),
      doorRow(k, sim, -76, 20, 5, 3, { t: 'plain', c: '#ff9ad5', c2: '#ff3d8b' }, 2),
    ];

    // --- pendulum bridges over the goo
    const pend = [];
    for (const bx of [-6, 0, 6]) {
      k.box(bx, -0.4, -94, 3, 0.8, 24.4, { look: LK.bridge });
    }
    for (const [pz, ph] of [[-89, 0], [-99.5, 1.6]]) {
      k.box(0, 9.1, pz, 21.5, 0.7, 0.7, { look: { top: LK.white, side: { t: 'hstripe', c: '#7d6cf2', c2: '#ffffff', s: 1 } } });
      k.box(-10.6, 2.1, pz, 0.8, 14.6, 0.8, { look: LK.post });
      k.box(10.6, 2.1, pz, 0.8, 14.6, 0.8, { look: LK.post });
      [-6, 0, 6].forEach((bx, i) => {
        pend.push(pendulum(k, sim, bx, 8.6, pz, { phase: ph + i * 2.1 + rng.range(-0.3, 0.3), period: 2.9 + i * 0.15 }));
      });
    }

    // --- checkpoint landing, turntables, finish
    k.box(0, -0.6, -110, 20, 1.2, 8, { look: LK.floorMint });
    const discs = [
      turntable(k, 0, -0.4, -119.2, 4.6, 0.8, 0.55, LK.disc),
      turntable(k, 2, -0.4, -128.9, 4.6, 0.8, -0.7, LK.disc2),
      turntable(k, -1.5, -0.4, -138.7, 4.6, 0.8, 0.85, LK.disc3),
    ];
    k.box(0, -0.6, -148.2, 20, 1.2, 8.2, { look: LK.floorLemon });
    ramp(k, 0, -152, 0, -158, 1.6, 20, 1.2, LK.floorLemon);
    k.box(0, 1.0, -166, 24, 1.2, 16, { look: LK.finish });
    arch(k, 0, 1.6, -163, 22, { c: '#ffb000', banner: 'checker' });

    const path = new Path([
      { x: 0, z: 2, w: 8 },
      { x: 0, z: -12, w: 6.5 },
      { x: 0, z: -30, w: 6.5 },
      { x: 0, z: -50, w: 6.5 },
      { x: 0, z: -56, door: 0, look: 3.6 },
      { x: 0, z: -64, door: 1, look: 3.6 },
      { x: 0, z: -72, door: 2, look: 3.6 },
      { x: 0, z: -79.5, w: 5 },
      { x: 0, z: -82.4, lanes: [-6, 0, 6], laneW: 0.5 },
      { x: 0, z: -106.5, w: 5 },
      { x: 0, z: -113.2, w: 1.6 },
      { x: 0, z: -119.2, w: 1.4 },
      { x: 2, z: -128.9, w: 1.4 },
      { x: -1.5, z: -138.7, w: 1.4 },
      { x: 0, z: -146, w: 6 },
      { x: 0, z: -158, w: 6 },
      { x: 0, z: -170, w: 6 },
    ]);

    return {
      path,
      doorRows: rows,
      hazards: [sw1, sw2, ...pend],
      killY: -7,
      timeLimit: 150,
      checkpoints: [
        { test: () => false, spawn: areaSpawner(-8, 8, -3, -10, 0.1) },
        { test: (p) => p.z < -79.6 && p.y > -1.5, spawn: areaSpawner(-7, 7, -80.3, -81.7, 0.1) },
        { test: (p) => p.z < -106.6 && p.y > -1.5, spawn: areaSpawner(-7, 7, -107.5, -112, 0.1) },
      ],
      spawns: (n) => gridSpawns(n, 0, -5, 17, 9, 0.05, rng),
      finish: (p) => p.z < -163 && p.y > 0.8,
      camYaw: () => 0,
      flyover: [
        [0, 15, -182, 0, 2, -160],
        [14, 11, -136, 0, 0, -128],
        [-13, 12, -98, 0, 1, -94],
        [12, 9, -70, 0, 1.5, -68],
        [-10, 9, -38, 0, 0, -32],
        [0, 6.5, 9, 0, 1.2, -6],
      ],
      update(t, dt) {
        sw1.update(dt);
        sw2.update(dt);
        for (const r of rows) r.update(dt);
        for (const p of pend) p.update(t);
        for (const d of discs) d.update(dt);
      },
    };
  },
};
