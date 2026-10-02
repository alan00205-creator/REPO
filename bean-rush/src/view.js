// Renderer, shared environment (sky, clouds, goo sea, lights) and quality management.

import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, Color, Fog, Mesh, SphereGeometry,
  ShaderMaterial, BackSide, PlaneGeometry, MeshLambertMaterial, CanvasTexture, RepeatWrapping, SRGBColorSpace,
  InstancedMesh, IcosahedronGeometry, Object3D, Vector3, PCFShadowMap, NeutralToneMapping, Group, Matrix4,
} from 'three';
import { BeanView } from './beanview.js';
import { FX } from './fx.js';
import { Gfx } from './gfx.js';
import { CameraRig } from './camera.js';
import { makeRng } from './util.js';

export const SKIES = {
  day: { top: '#3fa9ff', mid: '#9fd8ff', hor: '#e6f6ff', bot: '#ffd9f0', sun: '#fff4e0', sunI: 2.1, hemiS: '#dff2ff', hemiG: '#ffc9ec', hemiI: 1.25, fog: '#cfeeff', goo: '#ff6fcf', goo2: '#ffb0ea' },
  sunset: { top: '#5b6cff', mid: '#c49bff', hor: '#ffd2b0', bot: '#ffc2dd', sun: '#ffe0b8', sunI: 2.0, hemiS: '#ffe6d6', hemiG: '#c7a2ff', hemiI: 1.2, fog: '#f5d0d8', goo: '#ff6fbf', goo2: '#ffc0e0' },
  dusk: { top: '#2a2f8f', mid: '#7a5cf0', hor: '#ff9fd6', bot: '#ffb8e1', sun: '#ffd6f2', sunI: 1.9, hemiS: '#d9d0ff', hemiG: '#ff9ccc', hemiI: 1.3, fog: '#c9a6ee', goo: '#c55cff', goo2: '#ff9be3' },
};

function gooTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  const rng = makeRng(7);
  for (let i = 0; i < 70; i++) {
    const x = rng() * 256, y = rng() * 256, r = 4 + rng() * 16;
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) {
      g.beginPath();
      g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0)';
      g.strokeStyle = 'rgba(120,40,120,0.11)';
      g.lineWidth = 3;
      g.stroke();
      g.beginPath();
      g.arc(x + dx - r * 0.3, y + dy - r * 0.3, r * 0.25, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fill();
    }
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  return t;
}

export class View {
  constructor(host, settings) {
    this.host = host;
    this.settings = settings;
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
    const r = this.renderer;
    r.toneMapping = NeutralToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.type = PCFShadowMap;
    host.insertBefore(r.domElement, host.firstChild);
    r.domElement.id = 'gl';

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(60, 1, 0.1, 1200);
    this.rig = new CameraRig(this.camera);

    this.hemi = new HemisphereLight(0xffffff, 0xffffff, 1.2);
    this.sun = new DirectionalLight(0xffffff, 2);
    this.sun.position.set(30, 60, 25);
    this.sunDir = new Vector3(0.45, 0.8, 0.38).normalize();
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.fog = new Fog(0xcfeeff, 90, 420);
    this.scene.fog = this.fog;

    // sky dome
    this.skyMat = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new Color() }, uMid: { value: new Color() }, uHor: { value: new Color() }, uBot: { value: new Color() },
        uSun: { value: new Vector3() }, uSunCol: { value: new Color() },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
      fragmentShader: `uniform vec3 uTop, uMid, uHor, uBot, uSun, uSunCol; varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 c = h > 0.0 ? mix(mix(uHor, uMid, smoothstep(0.0, 0.22, h)), uTop, smoothstep(0.2, 0.85, h)) : mix(uHor, uBot, smoothstep(0.0, -0.25, h));
          float s = max(dot(normalize(vDir), normalize(uSun)), 0.0);
          c += uSunCol * (pow(s, 64.0) * 0.9 + pow(s, 6.0) * 0.18);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new Mesh(new SphereGeometry(900, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    // goo sea
    this.gooTex = gooTexture();
    this.gooTex.repeat.set(60, 60);
    this.gooMat = new MeshLambertMaterial({ color: 0xff6fcf, map: this.gooTex, emissive: 0x5a1650, emissiveIntensity: 0.55 });
    this.gooMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.gooTime = { value: 0 };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec4 wp = modelMatrix * vec4(position, 1.0);
          transformed.z += sin(wp.x * 0.25 + uTime * 1.3) * 0.18 + sin(wp.z * 0.21 - uTime * 1.1) * 0.18;`);
    };
    // The plane is rotated flat, so its local z (the wave offset above) points up.
    this.goo = new Mesh(new PlaneGeometry(1400, 1400, 64, 64), this.gooMat);
    this.goo.rotation.x = -Math.PI / 2;
    this.goo.receiveShadow = false;
    this.scene.add(this.goo);

    // clouds
    this.clouds = new InstancedMesh(new IcosahedronGeometry(1, 1), new MeshLambertMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35 }), 220);
    this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);
    this.decor = new Group();
    this.scene.add(this.decor);
    this.layoutClouds(3);

    this.beans = new BeanView(this.scene, 40, false);
    this.fx = new FX(this.scene);
    this.gfx = null;
    this.time = 0;
    this.quality = 'medium';
    this.dprScale = 1;
    this.applyQuality(settings.quality || 'auto');
    this.setSky('day');
    this.resize();
  }

  layoutClouds(seed) {
    const rng = makeRng(seed);
    const o = new Object3D();
    let n = 0;
    for (let c = 0; c < 34 && n < 210; c++) {
      const a = rng() * Math.PI * 2;
      const d = 160 + rng() * 260;
      const cx = Math.cos(a) * d, cz = Math.sin(a) * d, cy = -10 + rng() * 70;
      const puffs = 4 + Math.floor(rng() * 4);
      const sz = 7 + rng() * 9;
      for (let p = 0; p < puffs && n < 210; p++) {
        o.position.set(cx + (p - puffs / 2) * sz * 0.75 + rng() * 4, cy + rng() * sz * 0.4, cz + rng() * 6);
        const s = sz * (0.7 + rng() * 0.6) * (p === 0 || p === puffs - 1 ? 0.7 : 1);
        o.scale.set(s, s * 0.75, s);
        o.updateMatrix();
        this.clouds.setMatrixAt(n++, o.matrix);
      }
    }
    this.clouds.count = n;
    this.clouds.instanceMatrix.needsUpdate = true;
  }

  setSky(name) {
    const s = SKIES[name] || SKIES.day;
    this.skyName = name;
    const u = this.skyMat.uniforms;
    u.uTop.value.set(s.top); u.uMid.value.set(s.mid); u.uHor.value.set(s.hor); u.uBot.value.set(s.bot);
    u.uSun.value.copy(this.sunDir);
    u.uSunCol.value.set(s.sun);
    this.hemi.color.set(s.hemiS);
    this.hemi.groundColor.set(s.hemiG);
    this.hemi.intensity = s.hemiI;
    this.sun.color.set(s.sun);
    this.sun.intensity = s.sunI;
    this.fog.color.set(s.fog);
    this.gooMat.color.set(s.goo);
    this.gooMat.emissive.set(s.goo).multiplyScalar(0.35);
  }

  setGooLevel(y) {
    this.goo.position.y = y;
  }

  applyQuality(q) {
    this.qualitySetting = q;
    if (q === 'auto') {
      const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
      q = coarse ? 'medium' : 'high';
    }
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.maxDpr = q === 'low' ? Math.min(dpr, 1) * 0.85 : q === 'medium' ? Math.min(dpr, 1.6) : Math.min(dpr, 2);
    this.dprScale = 1;
    this.shadows = q === 'high';
    this.renderer.shadowMap.enabled = this.shadows;
    this.sun.castShadow = this.shadows;
    if (this.beans) this.beans.setShadows(this.shadows);
    if (this.gfx) {
      this.gfx.shadows = this.shadows;
      this.gfx.root.traverse((o) => { if (o.isMesh) { o.castShadow = this.shadows; o.receiveShadow = this.shadows; } });
    }
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.resize();
  }

  // Called with a measured frame rate while playing; trims resolution on struggling devices.
  adapt(fps) {
    if (this.qualitySetting !== 'auto') return;
    if (fps < 42 && this.dprScale > 0.62) { this.dprScale -= 0.12; this.resize(); }
    else if (fps > 58 && this.dprScale < 1) { this.dprScale = Math.min(1, this.dprScale + 0.06); this.resize(); }
  }

  resize() {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.max(0.5, this.maxDpr * this.dprScale));
    this.renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    this.camera.aspect = aspect;
    // keep a usable horizontal field of view in portrait
    const hfov = 78 * (Math.PI / 180);
    let vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect) * (180 / Math.PI);
    vfov = Math.min(Math.max(vfov, 52), 72);
    this.camera.fov = vfov;
    this.rig.aspectBoost = aspect < 1 ? (1 - aspect) * 4.5 : 0;
    this.camera.updateProjectionMatrix();
    this.w = w;
    this.h = h;
  }

  beginLevel() {
    this.endLevel();
    this.gfx = new Gfx(this);
    return this.gfx;
  }

  endLevel() {
    if (this.gfx) { this.gfx.dispose(); this.gfx = null; }
    this.fx.clear();
    this.beans.anim.clear();
  }

  frame(dt, alpha, beans, opts) {
    this.time += dt;
    if (this.gooTime) this.gooTime.value = this.time;
    this.gooTex.offset.x = this.time * 0.006;
    this.gooTex.offset.y = this.time * 0.004;
    if (this.gfx) this.gfx.update(alpha, dt, this.time);
    this.beans.update(beans, alpha, dt, this.time, opts);
    this.fx.update(dt);
    // keep the sun's shadow box around what the camera looks at
    const f = this.rig.look;
    this.sun.target.position.copy(f);
    this.sun.position.copy(f).addScaledVector(this.sunDir, 70);
    this.sky.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }
}

export { Matrix4 };
