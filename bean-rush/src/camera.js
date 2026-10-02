// Third-person follow camera with gentle auto-alignment, intro fly-overs and spectating.

import { Vector3, CatmullRomCurve3 } from 'three';
import { clamp, damp, dampAngle, wrapAngle } from './util.js';

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.yaw = 0;
    this.pitch = 0.32;
    this.dist = 8.6;
    this.baseDist = 8.6;
    this.basePitch = 0.32;
    this.target = new Vector3();
    this.look = new Vector3();
    this.idle = 9;
    this.mode = 'follow';
    this.shakeT = 0;
    this.shakeA = 0;
    this.fly = null;
    this.sens = 1;
    this.invertY = false;
    this.aspectBoost = 0;
    this._p = new Vector3();
  }

  // dx, dy in "screen fraction" units from drags / sticks
  rotate(dx, dy) {
    this.yaw -= dx * 3.4 * this.sens;
    this.pitch = clamp(this.pitch + dy * 2.2 * this.sens * (this.invertY ? -1 : 1), -0.12, 1.15);
    this.idle = 0;
  }

  shake(a) {
    this.shakeA = Math.max(this.shakeA, a);
    this.shakeT = 0.35;
  }

  snapTo(pos, yaw, pitch) {
    this.target.copy(pos);
    this.yaw = yaw;
    if (pitch !== undefined) this.pitch = pitch;
  }

  startFlyover(keys, dur) {
    const pts = keys.map((k) => new Vector3(k[0], k[1], k[2]));
    const looks = keys.map((k) => new Vector3(k[3], k[4], k[5]));
    this.fly = { curve: new CatmullRomCurve3(pts, false, 'centripetal'), look: new CatmullRomCurve3(looks, false, 'centripetal'), t: 0, dur };
    this.mode = 'fly';
  }

  // Returns true once the fly-over is finished.
  update(dt, o) {
    const cam = this.cam;
    if (this.mode === 'fly' && this.fly) {
      const f = this.fly;
      f.t += dt;
      const u = clamp(f.t / f.dur, 0, 1);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      f.curve.getPoint(e, cam.position);
      f.look.getPoint(e, this.look);
      cam.lookAt(this.look);
      return u >= 1;
    }
    if (this.mode === 'orbit') {
      // slow orbit around a point (lobby / results)
      this.yaw += dt * (o.orbitSpeed ?? 0.15);
      this.target.lerp(o.focus, 1 - Math.exp(-6 * dt));
      this.place(o.focus ? this.target : this.target);
      return false;
    }

    const p = o.focus;
    if (!p) return false;
    // follow target: snappy horizontally, softer vertically so jumps don't yank the view
    this.target.x = damp(this.target.x, p.x, 14, dt);
    this.target.z = damp(this.target.z, p.z, 14, dt);
    const ty = p.y + 1.25;
    this.target.y = damp(this.target.y, ty, ty < this.target.y - 2.5 ? 9 : 5, dt);

    this.idle += dt;
    if (o.hintYaw !== null && o.hintYaw !== undefined && this.idle > 1.6) {
      const k = o.moving ? 1.6 : 0.6;
      this.yaw = dampAngle(this.yaw, o.hintYaw, k, dt);
    }
    if (this.idle > 2.5) this.pitch = damp(this.pitch, this.basePitch, 1.2, dt);
    this.dist = damp(this.dist, this.baseDist + this.aspectBoost, 4, dt);
    this.place(this.target);
    return false;
  }

  place(t) {
    const cam = this.cam;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    cam.position.set(t.x + Math.sin(this.yaw) * cp * this.dist, t.y + sp * this.dist + 0.4, t.z + Math.cos(this.yaw) * cp * this.dist);
    this.look.copy(t);
    if (this.shakeT > 0) {
      this.shakeT -= 1 / 60;
      const a = this.shakeA * (this.shakeT / 0.35);
      cam.position.x += (Math.random() - 0.5) * a;
      cam.position.y += (Math.random() - 0.5) * a;
    } else this.shakeA = 0;
    cam.lookAt(this.look);
  }

  // Camera-relative move: stick (sx right, sy forward) → world (x, z)
  toWorld(sx, sy, out) {
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    out.x = fx * sy + rx * sx;
    out.z = fz * sy + rz * sx;
    return out;
  }
}

export { wrapAngle };
