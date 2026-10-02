// Unified input: touch (floating joystick + buttons + drag to look), keyboard & mouse, gamepad.

const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  dive: ['ShiftLeft', 'ShiftRight', 'KeyE', 'KeyX', 'KeyK'],
  camL: ['KeyQ', 'Comma'],
  camR: ['KeyR', 'Period'],
};

export class Input {
  constructor(root, ui) {
    this.root = root;
    this.ui = ui;
    this.keys = new Set();
    this.mode = matchMedia('(pointer: coarse)').matches ? 'touch' : 'kbm';
    this.enabled = false;
    this.sx = 0; this.sy = 0;
    this.jumpEdge = false; this.diveEdge = false; this.jumpHeld = false;
    this.camDX = 0; this.camDY = 0;
    this.pauseEdge = false;
    this.anyEdge = false;
    this.stick = null; // {id, ox, oy, x, y}
    this.look = null; // {id, x, y}
    this.mouse = null;
    this.padPrev = [];
    this.onMode = null;

    this.el = {
      layer: document.getElementById('touchLayer'),
      stick: document.getElementById('stick'),
      knob: document.getElementById('knob'),
      jump: document.getElementById('btnJump'),
      dive: document.getElementById('btnDive'),
    };

    addEventListener('keydown', (e) => this.key(e, true));
    addEventListener('keyup', (e) => this.key(e, false));
    addEventListener('blur', () => { this.keys.clear(); this.stick = null; this.look = null; this.drawStick(); });

    const L = this.el.layer;
    L.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.move(e), { passive: false });
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e));
    L.addEventListener('contextmenu', (e) => e.preventDefault());

    const btn = (el, on) => {
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.setMode(e.pointerType === 'mouse' ? this.mode : 'touch');
        el.classList.add('down');
        on(true);
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
      });
      const off = () => { el.classList.remove('down'); on(false); };
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
    };
    btn(this.el.jump, (d) => { if (d) this.jumpEdge = true; this.jumpHeld = d; });
    btn(this.el.dive, (d) => { if (d) this.diveEdge = true; });
  }

  setMode(m) {
    if (m === this.mode) return;
    this.mode = m;
    if (this.onMode) this.onMode(m);
  }

  key(e, d) {
    const c = e.code;
    if (d) this.setMode('kbm');
    if (d && !e.repeat) {
      if (KEYS.jump.includes(c)) this.jumpEdge = true;
      if (KEYS.dive.includes(c)) this.diveEdge = true;
      if (c === 'Escape' || c === 'KeyP') this.pauseEdge = true;
      this.anyEdge = true;
    }
    if (d) this.keys.add(c); else this.keys.delete(c);
    if (this.enabled && (c === 'Space' || c.startsWith('Arrow'))) e.preventDefault();
  }

  down(e) {
    if (e.pointerType === 'mouse') {
      this.setMode('kbm');
      this.mouse = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.anyEdge = true;
      return;
    }
    this.setMode('touch');
    this.anyEdge = true;
    const w = innerWidth;
    if (e.clientX < w * 0.45 && !this.stick) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      this.drawStick();
    } else if (!this.look) {
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
    e.preventDefault();
  }

  move(e) {
    if (this.mouse && e.pointerId === this.mouse.id) {
      const h = innerHeight;
      this.camDX += (e.clientX - this.mouse.x) / h;
      this.camDY += (e.clientY - this.mouse.y) / h;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      return;
    }
    if (this.stick && e.pointerId === this.stick.id) {
      this.stick.x = e.clientX; this.stick.y = e.clientY;
      // drag the base along when the thumb overshoots (feels better on small screens)
      const R = this.stickR();
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > R * 1.35) { this.stick.ox += (dx / d) * (d - R * 1.35); this.stick.oy += (dy / d) * (d - R * 1.35); }
      this.drawStick();
      e.preventDefault();
    } else if (this.look && e.pointerId === this.look.id) {
      const h = innerHeight;
      this.camDX += ((e.clientX - this.look.x) / h) * 1.15;
      this.camDY += ((e.clientY - this.look.y) / h) * 1.15;
      this.look.x = e.clientX; this.look.y = e.clientY;
      e.preventDefault();
    }
  }

  up(e) {
    if (this.mouse && e.pointerId === this.mouse.id) this.mouse = null;
    if (this.stick && e.pointerId === this.stick.id) { this.stick = null; this.drawStick(); }
    if (this.look && e.pointerId === this.look.id) this.look = null;
  }

  stickR() {
    return Math.min(64, Math.max(44, Math.min(innerWidth, innerHeight) * 0.12));
  }

  drawStick() {
    const s = this.el.stick, k = this.el.knob;
    if (!s) return;
    if (!this.stick) {
      s.classList.remove('active');
      s.style.transform = '';
      k.style.transform = '';
      return;
    }
    const R = this.stickR();
    s.classList.add('active');
    s.style.transform = `translate(${this.stick.ox}px, ${this.stick.oy}px)`;
    let dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    k.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  // Sample everything once per frame.
  poll() {
    let sx = 0, sy = 0;
    const k = (list) => list.some((c) => this.keys.has(c));
    if (k(KEYS.left)) sx -= 1;
    if (k(KEYS.right)) sx += 1;
    if (k(KEYS.up)) sy += 1;
    if (k(KEYS.down)) sy -= 1;
    if (k(KEYS.camL)) this.camDX -= 0.012;
    if (k(KEYS.camR)) this.camDX += 0.012;
    if (sx && sy) { sx *= Math.SQRT1_2; sy *= Math.SQRT1_2; }
    if (this.stick) {
      const R = this.stickR();
      let dx = (this.stick.x - this.stick.ox) / R, dy = (this.stick.y - this.stick.oy) / R;
      const d = Math.hypot(dx, dy);
      if (d < 0.14) { dx = 0; dy = 0; }
      else {
        const m = Math.min(1, (d - 0.14) / 0.72);
        dx = (dx / d) * m; dy = (dy / d) * m;
      }
      sx = dx; sy = -dy;
    }
    // gamepad
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const ax = p.axes;
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      if (dz(ax[0]) || dz(ax[1])) { sx = dz(ax[0]); sy = -dz(ax[1]); this.setMode('pad'); }
      if (ax.length > 3) { this.camDX += dz(ax[2]) * 0.022; this.camDY += dz(ax[3]) * 0.016; }
      const b = p.buttons.map((x) => x.pressed);
      const was = this.padPrev[p.index] || [];
      if (b[0] && !was[0]) { this.jumpEdge = true; this.anyEdge = true; this.setMode('pad'); }
      if ((b[1] && !was[1]) || (b[2] && !was[2])) { this.diveEdge = true; this.anyEdge = true; }
      if (b[9] && !was[9]) this.pauseEdge = true;
      if (b[14]) sx = -1;
      if (b[15]) sx = 1;
      if (b[12]) sy = 1;
      if (b[13]) sy = -1;
      this.padPrev[p.index] = b;
      break;
    }
    const out = {
      sx, sy,
      jump: this.jumpEdge,
      dive: this.diveEdge,
      camDX: this.camDX,
      camDY: this.camDY,
      pause: this.pauseEdge,
      any: this.anyEdge,
    };
    this.jumpEdge = this.diveEdge = this.pauseEdge = this.anyEdge = false;
    this.camDX = this.camDY = 0;
    return out;
  }

  reset() {
    this.jumpEdge = this.diveEdge = this.pauseEdge = this.anyEdge = false;
    this.camDX = this.camDY = 0;
    this.stick = null;
    this.look = null;
    this.drawStick();
  }
}
