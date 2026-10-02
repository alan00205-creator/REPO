// Menu backdrop: a round party stage where your bean poses and friends goof around.

import { steer } from '../ai.js';
import { TAU } from '../util.js';
import { LK, setYaw } from './parts.js';

export default {
  id: 'lobby',
  name: '大廳',
  type: 'lobby',
  sky: 'day',
  build({ kit: k, sim, rng }) {
    k.cyl(0, -0.75, 0, 9, 1.5, { seg: 48, look: { top: { t: 'dots', c: '#ffe680', c2: '#fff4c2', s: 2.4 }, side: { t: 'hstripe', c: '#ff5fa2', c2: '#ffffff', s: 0.75 } } });
    k.cyl(0, -1.9, 0, 9.6, 1.2, { seg: 48, look: { top: { t: 'plain', c: '#ffffff' }, side: { t: 'vstripe', c: '#3fc8ff', c2: '#ffffff', s: 1.3 } } });
    // podium for the player
    k.cyl(0, 0.2, 0, 1.5, 0.4, { seg: 32, look: { top: { t: 'spiral', c: '#ffffff', c2: '#ffd23f' }, side: { t: 'plain', c: '#ffd23f' } } });
    // rim so nobody tumbles off
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      k.cyl(Math.cos(a) * 8.7, 0.35, Math.sin(a) * 8.7, 0.32, 0.7, { seg: 12, look: { t: 'plain', c: i % 2 ? '#ffffff' : '#ff86c8' } });
    }
    // decorative arch + balloons
    k.deco(null, (b) => {
      b.boxAt(-8, 3.8, -8.5, 0.8, 7.6, 0.8, { t: 'hstripe', c: '#ff5fa2', c2: '#ffffff', s: 1.2 });
      b.boxAt(8, 3.8, -8.5, 0.8, 7.6, 0.8, { t: 'hstripe', c: '#ff5fa2', c2: '#ffffff', s: 1.2 });
      b.boxAt(0, 7.8, -8.5, 17, 1.4, 1, { side: { t: 'checker', c: '#ffffff', c2: '#2b2d5c', s: 1.4 }, top: { t: 'plain', c: '#ffd23f' } });
      const cols = ['#ff5fa2', '#ffd23f', '#3fc8ff', '#4fd8a3', '#8b6cff'];
      for (let i = 0; i < 9; i++) {
        const a = -2.4 + i * 0.6;
        b.sphereAt(Math.cos(a) * 13, 6 + (i % 3) * 1.6, Math.sin(a) * 13 - 3, 1.1, { t: 'plain', c: cols[i % 5], shiny: 1 }, 1, 1.18, 1);
      }
    });
    const spinner = k.body(0, 0, 0, { ground: false });
    k.deco(spinner, (b) => {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        b.sphereAt(Math.cos(a) * 11.5, 9, Math.sin(a) * 11.5, 0.7, { t: 'plain', c: ['#ff5fa2', '#ffd23f', '#3fc8ff'][i % 3], shiny: 1 });
      }
    });
    let ang = 0;
    return {
      killY: -12,
      checkpoints: [{ test: () => false, spawn: () => ({ x: rng.range(-5, 5), y: 0.2, z: rng.range(-5, 3), yaw: 0 }) }],
      spawns(n) {
        const out = [{ x: 0, y: 0.45, z: 0, yaw: 0 }];
        for (let i = 1; i < n; i++) {
          const a = Math.PI + 0.25 + ((i - 1) / Math.max(1, n - 2)) * (Math.PI - 0.5);
          out.push({ x: Math.cos(a) * 5.5, y: 0.1, z: Math.sin(a) * 5.5 - 1, yaw: rng.range(0, TAU) });
        }
        return out;
      },
      camYaw: () => 0,
      update(t, dt) {
        ang += dt * 0.15;
        setYaw(spinner, ang);
      },
      brain: (s, bean, skill) => new LobbyBrain(s, bean, skill),
    };
  },
};

class LobbyBrain {
  constructor(sim, bean) {
    this.sim = sim;
    this.b = bean;
    this.rng = sim.rng;
    this.t = this.rng.range(0, 2);
    this.goal = null;
  }
  onRespawn() {}
  think(dt) {
    const b = this.b, rng = this.rng;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = rng.range(1.5, 4.5);
      if (rng() < 0.65) {
        // stay behind the podium so nobody photobombs the menu camera
        const a = Math.PI + rng() * Math.PI, r = rng.range(3.2, 7.4);
        this.goal = [Math.cos(a) * r, Math.sin(a) * r - 0.5];
      } else this.goal = null;
      if (rng() < 0.25) b.jumpPressed = true;
    }
    if (this.goal) {
      const d = steer(b, this.goal[0], this.goal[1], 0.55, 0.5);
      if (d < 0.6) this.goal = null;
      if (b.grounded && rng() < dt * 0.25) b.jumpPressed = true;
      if (b.grounded && rng() < dt * 0.05) b.divePressed = true;
    } else {
      b.mx = b.mz = 0;
      if (b.grounded && rng() < dt * 0.35) b.jumpPressed = true;
    }
    // keep away from the podium
    const r = Math.hypot(b.pos.x, b.pos.z);
    if (r < 2.4 && r > 0.01) { b.mx += (b.pos.x / r) * 0.8; b.mz += (b.pos.z / r) * 0.8; }
    if (b.pos.z > -0.8) b.mz -= 0.9;
  }
}

export { LK };
