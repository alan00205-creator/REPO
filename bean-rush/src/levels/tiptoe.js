// 隱形小路 — a field of identical tiles; only a hidden winding path is solid. Fake tiles
// shake and drop when stepped on (and come back later), so the crowd learns the route.

import { Path } from '../ai.js';
import { LK, arch, gridSpawns, areaSpawner } from './parts.js';

const COLS = 6;
const ROWS = 14;
const SIZE = 2.3;
const PITCH = 2.5;
const TOP = 0;
const colX = (c) => -((COLS - 1) / 2) * PITCH + c * PITCH;
const rowZ = (r) => -17.75 - r * PITCH;
const LAST = rowZ(ROWS - 1);

export default {
  id: 'tiptoe',
  name: '隱形小路',
  en: 'SECRET PATH',
  type: 'race',
  desc: '一大片地板只有一條路是真的，踩到假的會塌下去。跟著前面的豆豆走，或自己賭一把！',
  tip: '別人踩過沒事的地板就是安全的。',
  sky: 'dusk',
  build({ kit: k, sim, rng }) {
    const tiles = [];
    const rows = [];
    // hidden path: one solid tile per row, wandering at most one column per row
    let c = rng.int(1, COLS - 2);
    for (let r = 0; r < ROWS; r++) {
      if (r > 0) c = Math.min(COLS - 1, Math.max(0, c + rng.int(-1, 1)));
      const real = new Set([c]);
      if (rng() < 0.3) real.add(Math.min(COLS - 1, Math.max(0, c + (rng() < 0.5 ? -1 : 1))));
      const row = { z: rowZ(r), doors: [], id: r };
      for (let cc = 0; cc < COLS; cc++) {
        const t = {
          x: colX(cc), z: rowZ(r), top: TOP, fake: !real.has(cc), state: 0, t: 0,
          color: (r + cc) % 2 ? '#c9b8ff' : '#ffd1ec', flash: 0, gone: false, tilt: 0,
          open: false, solidKnown: false, row: r,
        };
        const body = k.body(t.x, TOP - 0.4, t.z, {});
        k.addBox(body, 0, 0, 0, SIZE, 0.8, SIZE, { look: false });
        body.onContact = (bean, ct, s) => {
          if (ct.n.y < 0.5 || s.phase !== 'play') return;
          if (t.fake) {
            if (t.state === 0) { t.state = 1; t.t = 0; t.solidKnown = true; s.emit('crack', bean, t); }
          } else if (!t.open) {
            t.open = true;
            t.color = '#9be7b0';
          }
        };
        t.body = body;
        tiles.push(t);
        row.doors.push(t);
      }
      rows.push(row);
    }

    k.box(0, -0.6, -5, 26, 1.2, 14, { look: LK.start });
    arch(k, 0, 0, -11.4, 21.6, { c: '#8b6cff', banner: 'checker' });
    k.box(0, -0.6, -14.3, 16, 1.2, 4.6, { look: LK.floorLilac });
    const endZ = LAST - SIZE / 2 - 0.1;
    k.box(0, -0.6, endZ - 7.5, 24, 1.2, 15, { look: LK.finish });
    arch(k, 0, 0, endZ - 4.5, 22, { c: '#ffb000', banner: 'checker' });
    k.scene((g) => g.gridTiles(tiles, SIZE, 0.8));

    const nodes = [
      { x: 0, z: 2, w: 6 },
      { x: 0, z: -12, w: 4 },
    ];
    for (let r = 0; r < ROWS; r++) nodes.push({ x: 0, z: rowZ(r) + PITCH / 2, door: r, look: 1.6 });
    nodes.push({ x: 0, z: LAST - PITCH / 2, w: 5 });
    nodes.push({ x: 0, z: endZ - 14, w: 6 });

    return {
      path: new Path(nodes),
      doorRows: rows,
      hazards: [],
      killY: -7,
      timeLimit: 160,
      checkpoints: [
        { test: () => false, spawn: areaSpawner(-7, 7, -3, -10, 0.1) },
        { test: (p) => p.z < -12.4 && p.y > -0.5, spawn: areaSpawner(-6, 6, -12.6, -15.6, 0.1) },
      ],
      spawns: (n) => gridSpawns(n, 0, -5, 17, 9, 0.05, rng),
      finish: (p) => p.z < endZ - 4.5 && p.y > -0.5,
      camYaw: () => 0,
      camPitch: 0.5,
      camDist: 9.5,
      flyover: [
        [0, 20, endZ - 18, 0, 0, endZ],
        [12, 12, -36, 0, 0, -34],
        [-11, 10, -22, 0, 0, -24],
        [0, 6.5, 9, 0, 1.2, -6],
      ],
      update(t, dt) {
        for (const tl of tiles) {
          const b = tl.body;
          if (tl.state === 1) {
            tl.t += dt;
            tl.flash = 0.6;
            tl.tilt = Math.sin(tl.t * 50) * 0.04;
            if (tl.t > 0.3) { tl.state = 2; tl.t = 0; tl.vy = 0; tl.flash = 0; tl.tilt = 0; }
          } else if (tl.state === 2) {
            tl.t += dt;
            tl.vy -= 26 * dt;
            b.pos.y += tl.vy * dt;
            b.vel.set(0, tl.vy, 0);
            b.shapes[0].enabled = b.pos.y > TOP - 1.4;
            if (b.pos.y < -9) { tl.gone = true; b.vel.set(0, 0, 0); }
            // the tile floats back up a few seconds later
            if (tl.t > 5) { tl.state = 0; tl.gone = false; b.pos.y = TOP - 0.4; b.prevPos.copy(b.pos); b.shapes[0].enabled = true; }
          }
          tl.top = b.pos.y + 0.4;
        }
      },
    };
  },
};
