// 湯圓滾滾橋 — race over spinning rolling pins: some roll you back, the long ones roll you
// sideways into the goo, and the last set has gaps to jump.

import { Vector3 } from 'three';
import { Path } from '../ai.js';
import { LK, arch, gridSpawns, areaSpawner } from './parts.js';

const X = new Vector3(1, 0, 0);
const Z = new Vector3(0, 0, 1);
const PIN = [
  { t: 'candy', c: '#fff2f8', c2: '#ff86c8', s: 1.4, shiny: 1 },
  { t: 'candy', c: '#f2fbff', c2: '#3fc8ff', s: 1.4, shiny: 1 },
  { t: 'candy', c: '#fffbe8', c2: '#ffb000', s: 1.4, shiny: 1 },
];

export default {
  id: 'logs',
  name: '湯圓滾滾橋',
  en: 'ROLLING PINS',
  type: 'race',
  desc: '橋是一根根轉個不停的大滾筒！有的把你往後捲，有的把你往旁邊帶進黏液裡。',
  tip: '站在滾筒正上方最穩，被帶偏了就往反方向走。',
  sky: 'day',
  build({ kit: k, sim, rng }) {
    const pins = [];
    // spinning pin; axis 'x' (across the course) or 'z' (along it)
    const pin = (x, y, z, r, half, axis, w, look) => {
      const body = k.body(x, y, z, {});
      k.addCapsule(body, 0, 0, 0, half, r, { look, ry: axis === 'z' ? Math.PI / 2 : 0 });
      pins.push({ body, axis, w, a: rng() * 6 });
    };

    k.box(0, -0.6, -5, 26, 1.2, 14, { look: LK.start });
    arch(k, 0, 0, -11.4, 21.6, { c: '#ff86c8', banner: 'checker' });
    k.box(0, -0.6, -15, 18, 1.2, 6, { look: LK.floorPeach });

    // A: six rolling pins across the course, rolling back and forth
    for (let i = 0; i < 6; i++) pin(0, -1.1, -19.4 - i * 2.7, 1.1, 7.4, 'x', i % 2 ? -1.5 : 1.7, PIN[i % 3]);
    k.box(0, -0.6, -38.2, 18, 1.2, 7.8, { look: LK.floorLilac });

    // B: three long pins along the course, rolling you sideways
    [-4.2, 0, 4.2].forEach((x, i) => pin(x, -1.4, -50.3, 1.4, 6.6, 'z', [1.1, -1.4, 1.2][i], PIN[(i + 1) % 3]));
    k.box(0, -0.6, -62.3, 18, 1.2, 7.4, { look: LK.floorMint });

    // C: a longer run of faster pins
    for (let i = 0; i < 6; i++) pin(0, -1.1, -67.4 - i * 2.7, 1.1, 7.4, 'x', i % 2 ? 2.8 : -2.5, PIN[i % 3]);
    k.box(0, -0.6, -86, 18, 1.2, 7.6, { look: LK.floorSky });

    // D: two narrow side-rollers, faster than before
    [-2.4, 2.4].forEach((x, i) => pin(x, -1.3, -99.3, 1.3, 8.2, 'z', i ? -1.8 : 1.7, PIN[i]));
    k.box(0, -0.6, -116.6, 24, 1.2, 15.2, { look: LK.finish });
    arch(k, 0, 0, -114, 22, { c: '#ffb000', banner: 'checker' });

    const path = new Path([
      { x: 0, z: 2, w: 7 },
      { x: 0, z: -12, w: 5 },
      { x: 0, z: -35, w: 5 },
      { x: 0, z: -42.2, lanes: [-4.2, 0, 4.2], laneW: 0.15 },
      { x: 0, z: -58.6, w: 5 },
      { x: 0, z: -66, w: 4 },
      { x: 0, z: -82.5, w: 4 },
      { x: 0, z: -89.6, lanes: [-2.4, 2.4], laneW: 0.15 },
      { x: 0, z: -109.2, w: 5 },
      { x: 0, z: -122, w: 6 },
    ]);

    return {
      path,
      hazards: [],
      killY: -7,
      timeLimit: 150,
      checkpoints: [
        { test: () => false, spawn: areaSpawner(-7, 7, -3, -10, 0.1) },
        { test: (p) => p.z < -35 && p.y > -0.5, spawn: areaSpawner(-6, 6, -35.5, -37.5, 0.1) },
        { test: (p) => p.z < -59.2 && p.y > -0.5, spawn: areaSpawner(-6, 6, -59.6, -61.5, 0.1) },
        { test: (p) => p.z < -82.8 && p.y > -0.5, spawn: areaSpawner(-6, 6, -83.2, -85.5, 0.1) },
      ],
      spawns: (n) => gridSpawns(n, 0, -5, 17, 9, 0.05, rng),
      finish: (p) => p.z < -114 && p.y > -0.5,
      camYaw: () => 0,
      camPitch: 0.4,
      flyover: [
        [0, 18, -130, 0, 0, -112],
        [12, 11, -96, 0, 0, -96],
        [13, 11, -70, 0, 0, -68],
        [-12, 10, -48, 0, 0, -50],
        [11, 8, -24, 0, 0, -24],
        [0, 6.5, 9, 0, 1.2, -6],
      ],
      update(t, dt) {
        for (const p of pins) {
          p.a += p.w * dt;
          if (p.axis === 'x') { p.body.quat.setFromAxisAngle(X, p.a); p.body.angVel.set(p.w, 0, 0); }
          else { p.body.quat.setFromAxisAngle(Z, p.a); p.body.angVel.set(0, 0, p.w); }
        }
      },
    };
  },
};
