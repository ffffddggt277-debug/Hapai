// @ts-nocheck
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { WORLD, WALLS, CASES, CABINETS, DECOR, WALL_DECOR, EXITS, COINS, ITEMS, RULES, OCCLUDERS, visionPolygon, move, caseReach, cabinetReach, interactPoint, segmentHit, angleDiff, roomAt } from '@hapai/shared';

const MODELS = ['thief', 'case', 'cabinet', 'crown', 'chest', 'lion', 'whale', 'katana', 'bust', 'painting1', 'painting2', 'horse', 'vase_blue', 'vase_brass', 'vase_white', 'clock', 'lantern', 'statue', 'bench', 'grandclock', 'cupboard', 'chair', 'fan', 'shields', 'camera', 'coin', 'sack', 'drone', 'ropes', 'van'];
const rand = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, t) => a + (b - a) * t;
const WALL_H = 1.65, THIEF_H = 1.32;

// ---------- процедурные текстуры
function canvasTex(w, h, draw, repeat = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function noise(g, w, h, alpha, n = 4000, light = true) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${light ? '255,255,255' : '0,0,0'},${Math.random() * alpha})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); } }
function veins(g, w, h, color, count, width) {
  g.strokeStyle = color; for (let i = 0; i < count; i++) { g.lineWidth = Math.random() * width + .4; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { const nx = x + rand(-w * .3, w * .3), ny = y + rand(-h * .3, h * .3); g.quadraticCurveTo(x + rand(-40, 40), y + rand(-40, 40), nx, ny); x = nx; y = ny; } g.stroke(); }
}
const TEX = {
  marble: (a = '#e9e4da', b = '#d8d1c4', vein = 'rgba(120,110,100,.25)', tiles = 2) => canvasTex(512, 512, (g, w, h) => {
    const s = w / tiles; for (let i = 0; i < tiles; i++) for (let j = 0; j < tiles; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); }
    g.save(); g.filter = 'blur(1px)'; veins(g, w, h, vein, 14, 2.2); g.restore(); noise(g, w, h, .05, 6000);
    g.strokeStyle = 'rgba(40,30,20,.35)'; g.lineWidth = 2; for (let i = 0; i <= tiles; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  }),
  checker: () => canvasTex(512, 512, (g, w, h) => {
    const s = w / 4; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#1e2230' : '#e6e0d3'; g.fillRect(i * s, j * s, s, s); }
    g.save(); g.filter = 'blur(1px)'; veins(g, w, h, 'rgba(140,130,120,.22)', 16, 2); g.restore(); noise(g, w, h, .04, 5000);
  }),
  parquet: (base = [120, 72, 40]) => canvasTex(512, 512, (g, w, h) => {
    const pw = 128, ph = 32;
    for (let y = -ph; y < h + ph; y += ph) for (let x = -pw; x < w + pw; x += pw) {
      const row = Math.round(y / ph), off = (row % 2) * pw / 2, k = rand(.75, 1.15);
      g.fillStyle = `rgb(${base[0] * k | 0},${base[1] * k | 0},${base[2] * k | 0})`; g.fillRect(x + off, y, pw - 2, ph - 2);
      g.strokeStyle = 'rgba(0,0,0,.08)'; for (let l = 0; l < 4; l++) { g.beginPath(); const yy = y + rand(4, ph - 4); g.moveTo(x + off, yy); g.lineTo(x + off + pw, yy + rand(-2, 2)); g.stroke(); }
    }
    noise(g, w, h, .05, 4000, false);
  }),
  concrete: () => canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#5c5f66'; g.fillRect(0, 0, w, h); noise(g, w, h, .08, 20000, false); noise(g, w, h, .06, 12000); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); }),
  asphalt: () => canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#23262d'; g.fillRect(0, 0, w, h); noise(g, w, h, .07, 30000); noise(g, w, h, .1, 10000, false); }),
  carpet: () => canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#7a1424'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9a84a'; g.fillRect(14, 0, 8, h); g.fillRect(w - 22, 0, 8, h); g.strokeStyle = 'rgba(217,168,74,.35)'; g.lineWidth = 3; for (let y = 0; y < h; y += 64) { g.beginPath(); g.moveTo(w / 2, y + 8); g.lineTo(w / 2 + 40, y + 32); g.lineTo(w / 2, y + 56); g.lineTo(w / 2 - 40, y + 32); g.closePath(); g.stroke(); } noise(g, w, h, .05, 3000, false); }),
  wall: () => canvasTex(512, 512, (g, w, h) => {
    // верх — тёмно-изумрудные обои, низ — деревянные панели
    g.fillStyle = '#1f3d3c'; g.fillRect(0, 0, w, h * .58);
    g.globalAlpha = .12; g.fillStyle = '#9fd8c9'; for (let y = 12; y < h * .58; y += 40) for (let x = (y / 40 % 2) * 20; x < w; x += 40) { g.beginPath(); g.ellipse(x, y, 6, 10, 0, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1;
    g.fillStyle = '#d8c48f'; g.fillRect(0, h * .58, w, 10);
    g.fillStyle = '#3b2416'; g.fillRect(0, h * .58 + 10, w, h);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3; for (let x = 8; x < w; x += 128) g.strokeRect(x, h * .64, 112, h * .3);
    g.fillStyle = '#120c08'; g.fillRect(0, h - 22, w, 22); noise(g, w, h, .04, 3000);
  }),
  cap: () => canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#e3d7b8'; g.fillRect(0, 0, w, h); noise(g, w, h, .06, 1500, false); }),
  wood: () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6d4426'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(30,15,5,.35)'; for (let i = 0; i < 30; i++) { g.lineWidth = rand(.5, 2); g.beginPath(); const y = rand(0, h); g.moveTo(0, y); g.bezierCurveTo(w * .3, y + rand(-8, 8), w * .6, y + rand(-8, 8), w, y + rand(-6, 6)); g.stroke(); } g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4); }),
  hazard: () => canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1a1a'; for (let x = -h; x < w + h; x += 48) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 24, 0); g.lineTo(x + 24 - h, h); g.lineTo(x - h, h); g.fill(); } }),
  glow: (color = '255,214,150') => canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, `rgba(${color},1)`); gr.addColorStop(.4, `rgba(${color},.35)`); gr.addColorStop(1, `rgba(${color},0)`); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, [1, 1]),
  ring: () => canvasTex(128, 128, (g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 10, 0, Math.PI * 2); g.stroke(); g.globalAlpha = .35; g.lineWidth = 22; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 14, 0, Math.PI * 2); g.stroke(); }, [1, 1]),
  arrows: () => canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { g.globalAlpha = .4 + i * .3; g.beginPath(); const y = 92 - i * 30; g.moveTo(w / 2, y - 22); g.lineTo(w / 2 + 34, y + 8); g.lineTo(w / 2 + 20, y + 8); g.lineTo(w / 2, y - 8); g.lineTo(w / 2 - 20, y + 8); g.lineTo(w / 2 - 34, y + 8); g.closePath(); g.fill(); } }, [1, 1]),
  star: () => canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#ffe14d'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 30, a = i / 10 * Math.PI * 2 - Math.PI / 2; g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } g.closePath(); g.fill(); g.strokeStyle = '#7a4a00'; g.lineWidth = 3; g.stroke(); }, [1, 1]),
};

export class HeistEngine {
  constructor(container, overlay, hooks = {}) {
    this.container = container; this.overlay = overlay; this.hooks = hooks; this.disposed = false;
    this.assets = {}; this.entities = new Map(); this.effects = []; this.labels = new Map(); this.floaters = [];
    this.mode = 'menu'; this.state = null; this.myId = null; this.input = { x: 0, z: 0, angle: Math.PI / 2, interact: false };
    this.you = { x: 22, z: 20, angle: -Math.PI / 2 }; this.time = 0; this.reveal = { value: 1 }; this.shake = 0; this.quality = hooks.quality || 'high';
    this.clock = new THREE.Clock(); this.camTarget = new THREE.Vector3(22, 0, 16); this.hint = null; this.lobbyRoster = [];
    this.mask = document.createElement('canvas'); this.mask.width = 352; this.mask.height = 256; this.mctx = this.mask.getContext('2d');
    this.fogTex = new THREE.CanvasTexture(this.mask); this.fogTex.minFilter = this.fogTex.magFilter = THREE.LinearFilter;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#05070d'); this.scene.fog = new THREE.Fog('#05070d', 34, 60);
    this.camera = new THREE.PerspectiveCamera(38, 1, .5, 120);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);
    this.applyQuality();
    this.lights(); this.buildStatic();
    this.resize = () => { const w = container.clientWidth || 1, h = container.clientHeight || 1; this.aspect = w / h; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%'; };
    this.resize(); this.ro = new ResizeObserver(this.resize); this.ro.observe(container);
    this.loadAssets(); this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }
  applyQuality() {
    const mobile = matchMedia('(pointer: coarse)').matches;
    const pr = this.quality === 'low' ? 1 : this.quality === 'medium' ? Math.min(devicePixelRatio, 1.3) : Math.min(devicePixelRatio, mobile ? 1.5 : 1.8);
    this.renderer.setPixelRatio(pr); this.renderer.shadowMap.enabled = this.quality !== 'low';
    if (this.roomLights) for (const l of this.roomLights) l.visible = this.quality === 'high' || (this.quality === 'medium' && l.userData.main);
  }
  setQuality(q) { this.quality = q; this.applyQuality(); this.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); }
  // ---------- туман войны: шейдерный патч для всех материалов
  fog(m) {
    if (!m || m.userData.fogged) return m; m.userData.fogged = true;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      prev?.(sh, r);
      sh.uniforms.uMask = { value: this.fogTex }; sh.uniforms.uReveal = this.reveal;
      sh.vertexShader = 'varying vec3 vHW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvHW=(modelMatrix*vec4(transformed,1.0)).xyz;');
      if (sh.vertexShader.includes('#include <skinning_vertex>') && !sh.vertexShader.includes('vHW=')) sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvHW=(modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = 'uniform sampler2D uMask; uniform float uReveal; varying vec3 vHW;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
        float vis=max(uReveal, texture2D(uMask, vec2(vHW.x/${WORLD.width.toFixed(1)}, 1.0-vHW.z/${WORLD.height.toFixed(1)})).r);
        float lum=dot(outgoingLight, vec3(.3,.59,.11));
        vec3 memory=mix(vec3(lum), outgoingLight, .25)*vec3(.20,.24,.36);
        outgoingLight=mix(memory, outgoingLight, vis);
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'hapai-fog2-' + (m.type);
    return m;
  }
  mat(color, rough = .7, metal = 0, extra = {}) { return this.fog(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra })); }
  lights() {
    this.hemi = new THREE.HemisphereLight(0x9fb4ff, 0x1c1410, 1.25); this.scene.add(this.hemi);
    const moon = new THREE.DirectionalLight(0xc8d6ff, 1.7); moon.position.set(-8, 22, 10); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 }); moon.shadow.bias = -.0006; moon.shadow.normalBias = .02;
    this.moon = moon; this.scene.add(moon); this.scene.add(moon.target);
    this.roomLights = [];
    const spots = [[7, 8], [7, 24], [22, 4.5], [22, 12.5], [22, 19.5], [22, 27.5], [37, 8], [37, 24]];
    spots.forEach(([x, z], i) => { const l = new THREE.PointLight(0xffd6a0, 22, 13, 1.5); l.position.set(x, 3.4, z); l.userData.main = i % 2 === 0; this.scene.add(l); this.roomLights.push(l); });
    this.alarmLights = [0, 1].map(() => { const l = new THREE.PointLight(0xff2030, 0, 9, 1.4); l.position.y = 2.2; this.scene.add(l); return l; });
    this.exitLight = new THREE.PointLight(0x3dffb0, 18, 7, 1.5); this.exitLight.position.y = 1.6; this.scene.add(this.exitLight);
    this.applyQuality();
  }
  // ---------- статичная карта
  boxUV(w, h, d, scale = 1.6) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const spans = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * spans[f][0] / scale, f === 2 || f === 3 ? uv.getY(i) * spans[f][1] / scale : uv.getY(i)); }
    return g;
  }
  floor(x0, z0, x1, z1, tex, rep = 1, rough = .55, y = 0) {
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / rep, (z1 - z0) / rep);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), this.mat('#ffffff', rough, 0, { map: t }));
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; this.scene.add(m); return m;
  }
  buildStatic() {
    const S = this.scene;
    // улица снаружи
    const asphalt = TEX.asphalt(); asphalt.repeat.set(30, 25);
    const street = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), this.mat('#ffffff', .95, 0, { map: asphalt })); street.rotation.x = -Math.PI / 2; street.position.set(22, -.03, 16); street.receiveShadow = true; S.add(street);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(48, .08, 36), this.mat('#6d6f75', .9)); curb.position.set(22, -.02, 16); curb.receiveShadow = true; S.add(curb);
    // полы залов
    this.floor(0, 0, 14, 16, TEX.parquet([128, 78, 42]), 2.2);
    this.floor(0, 16, 14, 32, TEX.marble('#e8e2d6', '#d6cebf'), 2);
    this.floor(14, 0, 30, 9, TEX.checker(), 2.4, .35);
    this.floor(14, 9, 30, 23, TEX.marble('#2a2c33', '#23252b', 'rgba(220,200,160,.18)', 2), 2.2, .28);
    this.floor(14, 23, 30, 32, TEX.concrete(), 4, .9);
    this.floor(30, 0, 44, 16, TEX.parquet([86, 50, 30]), 2.2);
    this.floor(30, 16, 44, 32, TEX.marble('#1e3a33', '#183029', 'rgba(230,200,120,.22)', 2), 2, .3);
    // ковровая дорожка и мозаика под короной
    const runner = this.floor(20.6, 9.2, 23.4, 22.8, TEX.carpet(), 2.8, .95, .006); runner.material.map.repeat.set(1, 5);
    const mosaic = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.25, 64), this.mat('#d9a84a', .3, .8)); mosaic.rotation.x = -Math.PI / 2; mosaic.position.set(22, .012, 16); S.add(mosaic);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 64), this.mat('#151820', .25, .2)); disc.rotation.x = -Math.PI / 2; disc.position.set(22, .01, 16); disc.receiveShadow = true; S.add(disc);
    // полосы «опасность» у дока
    const hz = TEX.hazard(); hz.repeat.set(4, 1);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(16, .35), this.mat('#ffffff', .8, 0, { map: hz })); stripe.rotation.x = -Math.PI / 2; stripe.position.set(22, .008, 23.6); S.add(stripe);
    // стены
    const wallTex = TEX.wall(), capTex = TEX.cap();
    const wallMat = this.mat('#ffffff', .8, 0, { map: wallTex }), capMat = this.mat('#ffffff', .5, .1, { map: capTex }), baseMat = this.mat('#0f0b08', .7);
    for (const [x, z, w, d] of WALLS) {
      const m = new THREE.Mesh(this.boxUV(w, WALL_H, d), wallMat); m.position.set(x, WALL_H / 2, z); m.castShadow = m.receiveShadow = true; S.add(m);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + .1, .09, d + .1), capMat); cap.position.set(x, WALL_H + .04, z); cap.castShadow = true; S.add(cap);
    }
    // ворота-выходы
    this.exits = EXITS.map(e => {
      const g = new THREE.Group(); g.position.set(e.x, 0, e.z); S.add(g);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48), this.mat('#0d3d33', .4, .1, { transparent: true, opacity: .9 })); pad.rotation.x = -Math.PI / 2; pad.position.y = .015; g.add(pad);
      const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.1), new THREE.MeshBasicMaterial({ map: TEX.ring(), color: '#3dffb0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); ring.rotation.x = -Math.PI / 2; ring.position.y = .03; g.add(ring);
      const arrows = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: TEX.arrows(), color: '#3dffb0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      arrows.rotation.x = -Math.PI / 2; const out = e.z < 2 ? Math.PI : e.z > 30 ? 0 : e.x < 2 ? -Math.PI / 2 : Math.PI / 2; arrows.rotation.z = out + Math.PI; arrows.position.y = .035; g.add(arrows);
      // рольставня в проёме
      const vert = e.x < 2 || e.x > 42; const shutter = new THREE.Mesh(new THREE.BoxGeometry(vert ? .18 : 3, WALL_H, vert ? 3 : .18), this.mat('#8a1c24', .6, .4));
      const sx = e.x < 2 ? .25 : e.x > 42 ? 43.75 : e.x, sz = e.z < 2 ? .25 : e.z > 30 ? 31.75 : e.z; shutter.position.set(sx, WALL_H / 2, sz); shutter.castShadow = true; S.add(shutter);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(.6, 1.4, 3.2, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#3dffb0', transparent: true, opacity: .12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.y = 1.6; g.add(beam);
      return { g, pad, ring, arrows, shutter, beam, e };
    });
    // мягкие световые пятна на полу (дёшево, но атмосферно)
    const glow = TEX.glow();
    for (const [x, z] of [[7, 8], [7, 24], [22, 4.5], [22, 16], [37, 8], [37, 24], [22, 27.5]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: glow, color: '#ffcf8a', transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending })); p.rotation.x = -Math.PI / 2; p.position.set(x, .02, z); S.add(p); }
    this.fanMixers = [];
  }
  async loadAssets() {
    const loader = new GLTFLoader(); let done = 0;
    try {
      await Promise.all(MODELS.map(async n => { const g = await loader.loadAsync(`/models/${n}.glb`); this.assets[n] = g; done++; this.hooks.onProgress?.(done / MODELS.length); }));
      if (this.disposed) return;
      this.prepare(); this.placeProps(); this.ready = true; this.hooks.onReady?.();
      this.refreshShowcase();
    } catch (err) { console.error(err); this.hooks.onError?.('Не удалось загрузить 3D-модели. Обнови страницу.'); }
  }
  prepare() {
    // общие настройки: тени, туман
    for (const [n, g] of Object.entries(this.assets)) g.scene.traverse(o => { if (o.isMesh) { o.castShadow = n !== 'case' || !o.name.includes('Glass'); o.receiveShadow = true; if (o.material) { o.material = o.material.clone(); this.fog(o.material); } } });
    const th = this.assets.thief; const box = new THREE.Box3().setFromObject(th.scene); this.thiefScale = THIEF_H / (box.max.y - box.min.y); this.thiefMinY = box.min.y;
  }
  clone(n) { const g = this.assets[n]; const c = n === 'thief' ? skClone(g.scene) : g.scene.clone(true); c.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.onBeforeCompile = g.scene.getObjectByProperty('uuid', o.uuid)?.material?.onBeforeCompile; o.material.userData.fogged = false; this.fog(o.material); } }); return c; }
  orient(f) { return Math.atan2(f[0], f[1]); }
  placeProps() {
    const S = this.scene;
    // витрины и экспонаты
    this.cases = CASES.map((c, i) => {
      const g = new THREE.Group(); g.position.set(c.x, 0, c.z); S.add(g); const item = ITEMS[c.item]; const o = { def: c, g, glass: null, item: null, base: null };
      if (c.type === 'case') {
        const cs = this.clone('case'); if (c.big) cs.scale.set(1.4, 1.1, 1.4); g.add(cs);
        cs.traverse(m => { if (m.isMesh && m.name.includes('Glass')) { o.glass = m; m.material.transparent = true; m.material.opacity = .2; m.material.depthWrite = false; m.material.roughness = .05; m.material.envMapIntensity = 2; m.castShadow = false; } });
        const it = this.clone(item.model); it.position.y = c.big ? .9 : .8; if (c.big) it.scale.setScalar(1.6); g.add(it); o.item = it;
        if (c.item === 'katana') { it.rotation.y = Math.PI / 4; it.position.y = .86; }
        const halo = new THREE.Mesh(new THREE.PlaneGeometry(c.big ? 3.4 : 2.2, c.big ? 3.4 : 2.2), new THREE.MeshBasicMaterial({ map: TEX.glow('255,226,170'), transparent: true, opacity: c.big ? .55 : .3, depthWrite: false, blending: THREE.AdditiveBlending })); halo.rotation.x = -Math.PI / 2; halo.position.y = .02; g.add(halo); o.halo = halo;
      } else if (c.type === 'wall') {
        const p = this.clone(item.model); p.rotation.y = this.orient(c.f); p.position.set(c.f[0] * .02, .55, c.f[1] * .02); g.add(p); o.item = p;
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(.7, .05, .12), this.mat('#d9a84a', .3, .9)); lamp.position.set(c.f[0] * .1, 1.5, c.f[1] * .1); lamp.rotation.y = this.orient(c.f); g.add(lamp);
        const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.6), new THREE.MeshBasicMaterial({ map: TEX.glow('255,226,170'), transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); halo.rotation.x = -Math.PI / 2; halo.position.set(c.f[0] * .8, .02, c.f[1] * .8); g.add(halo); o.halo = halo;
        const empty = new THREE.Mesh(new THREE.PlaneGeometry(1.1, .85), this.mat('#0c1414', .9)); empty.rotation.y = this.orient(c.f); empty.position.set(c.f[0] * .01, 1.05, c.f[1] * .01); empty.visible = false; g.add(empty); o.emptyMark = empty;
      } else {
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(.62, .7, .32, 32), this.mat('#e8e2d6', .3, .05)); plinth.position.y = .16; plinth.castShadow = plinth.receiveShadow = true; g.add(plinth);
        const it = this.clone(item.model); it.position.y = .32; g.add(it); o.item = it;
        const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: TEX.glow('255,210,120'), transparent: true, opacity: .45, depthWrite: false, blending: THREE.AdditiveBlending })); halo.rotation.x = -Math.PI / 2; halo.position.y = .03; g.add(halo); o.halo = halo;
      }
      // маячок тревоги
      const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, .14, 16), new THREE.MeshBasicMaterial({ color: '#ff2030' })); beacon.position.set(c.type === 'wall' ? c.f[0] * .15 : 0, c.type === 'wall' ? 1.75 : c.big ? 1.62 : 1.48, c.type === 'wall' ? c.f[1] * .15 : 0); beacon.visible = false; g.add(beacon); o.beacon = beacon;
      const flare = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: TEX.glow('255,40,50'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); flare.position.copy(beacon.position); flare.visible = false; g.add(flare); o.flare = flare;
      return o;
    });
    this.crownSpot = new THREE.SpotLight(0xfff0c8, 40, 9, .42, .5, 1.2); this.crownSpot.position.set(22, 6, 16.5); this.crownSpot.target.position.set(22, .8, 16); S.add(this.crownSpot, this.crownSpot.target);
    // шкафы
    this.cabinets = CABINETS.map(h => {
      const c = this.clone('cabinet'); c.position.set(h.x - h.f[0] * .02, 0, h.z - h.f[1] * .02); c.rotation.y = this.orient(h.f); S.add(c);
      const doors = []; c.traverse(o => { if (/^Door/.test(o.name)) doors.push({ o, base: o.rotation.y, sign: o.name.endsWith('L') ? -1 : 1 }); });
      const hint = new THREE.Mesh(new THREE.RingGeometry(.36, .42, 32), new THREE.MeshBasicMaterial({ color: '#8fd3ff', transparent: true, opacity: .0, depthWrite: false })); const ip = interactPoint(h); hint.rotation.x = -Math.PI / 2; hint.position.set(ip.x, .03, ip.z); S.add(hint);
      return { h, c, doors, open: 0, target: 0, closeAt: 0, hint };
    });
    // декор
    for (const d of DECOR) {
      let o;
      if (d.kind === 'desk') { o = new THREE.Group(); const top = new THREE.Mesh(this.boxUV(d.w, .08, d.d, 1), this.mat('#ffffff', .6, 0, { map: TEX.wood() })); top.position.y = .74; o.add(top); for (const sx of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.08, .74, d.d - .1), this.mat('#2a1b10')); leg.position.set(sx * (d.w / 2 - .08), .37, 0); o.add(leg); } const mon = new THREE.Mesh(new THREE.BoxGeometry(.6, .38, .05), this.mat('#111', .3, .5)); mon.position.set(-.3, 1.0, .1); o.add(mon); const scr = new THREE.Mesh(new THREE.PlaneGeometry(.55, .32), new THREE.MeshBasicMaterial({ color: '#4fd1ff' })); scr.position.set(-.3, 1.0, .13); o.add(scr); this.monitor = scr; }
      else if (d.kind === 'crates') { o = new THREE.Group(); const wt = TEX.wood(); [[0, 0, 0, .9], [.75, 0, .1, .7], [.3, .9, 0, .7]].forEach(([x, y, z, s]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), this.mat('#ffffff', .8, 0, { map: wt })); b.position.set(x - .3, y + s / 2, z); b.rotation.y = rand(-.3, .3); b.castShadow = b.receiveShadow = true; o.add(b); }); }
      else if (this.assets[d.kind]) { o = this.clone(d.kind); if (d.kind === 'fan') { const mx = new THREE.AnimationMixer(o); this.assets.fan.animations.forEach(a => mx.clipAction(a).play()); this.fanMixers.push(mx); o.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(o), sz = bb.getSize(new THREE.Vector3()); const k = 1.3 / Math.max(sz.x, sz.y, sz.z); const inner = new THREE.Group(); inner.add(o); o.scale.multiplyScalar(k); o.position.y -= bb.min.y * k; o = inner; } }
      if (!o) continue; o.position.set(d.x, 0, d.z); o.rotation.y = d.r || 0; o.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); S.add(o);
    }
    // щиты и камеры на стенах
    this.secCams = [];
    for (const w of WALL_DECOR) {
      if (w.kind === 'shield') { const src = this.assets.shields.scene.getObjectByName(`Shield${w.i}`); if (!src) continue; const s = src.clone(true); s.position.set(w.x, 1.05, w.z); s.rotation.set(0, this.orient(w.f) + Math.PI / 2, 0); S.add(s); }
      else { const c = this.clone('camera'); c.position.set(w.x, WALL_H + .1, w.z); c.rotation.y = this.orient(w.f) + Math.PI; S.add(c); this.secCams.push({ c, base: c.rotation.y, ph: rand(0, 6) }); }
    }
    // фургоны снаружи
    this.vans = EXITS.map(e => { const v = this.clone('van'); v.position.set(e.van[0], 0, e.van[1]); v.rotation.y = e.van[2]; this.scene.add(v); const hl = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), new THREE.MeshBasicMaterial({ map: TEX.glow('255,240,190'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); hl.rotation.x = -Math.PI / 2; hl.position.set(e.van[0] + Math.sin(e.van[2]) * 3.2, .02, e.van[1] + Math.cos(e.van[2]) * 3.2); this.scene.add(hl); v.userData.hl = hl; return v; });
    // ограждение короны
    // монеты
    this.coins = new Map(COINS.map(([x, z], i) => { const c = this.clone('coin'); c.position.set(x, .25, z); c.scale.setScalar(1.1); c.traverse(m => { if (m.isMesh) { m.material.emissive = new THREE.Color('#5a3a00'); m.material.metalness = .9; m.material.roughness = .25; m.material.color.set('#ffcc33'); } }); c.visible = false; this.scene.add(c); return [`coin-${i}`, c]; }));
  }
  // ---------- витрина меню / лобби
  refreshShowcase() {
    if (!this.ready) return;
    if (!this.showcase) { this.showcase = new THREE.Group(); this.scene.add(this.showcase); this.showcaseThieves = []; }
    const want = this.mode === 'menu' ? [{ id: 'm1', color: '#ffd23f', anim: 'Idle' }, { id: 'm2', color: '#3ee6c4', anim: 'Steal' }, { id: 'm3', color: '#ff6b6b', anim: 'Walk' }] : this.mode === 'lobby' ? this.lobbyRoster.map(r => ({ id: r.id, color: r.color, name: r.name, anim: r.ready ? 'Cheer' : 'Idle' })) : [];
    // пересобираем при изменении
    const key = want.map(w => w.id + w.anim + w.color).join('|');
    if (key === this.showKey) return; this.showKey = key;
    for (const t of this.showcaseThieves) { this.showcase.remove(t.group); this.removeLabel('show-' + t.id); }
    this.showcaseThieves = [];
    want.forEach((w, i) => {
      const t = this.makeThief(w.color); this.showcase.add(t.group);
      if (this.mode === 'menu') { const pos = [[22.9, 17.4, -2.4], [21.0, 17.25, 2.6], [24.4, 18.6, -2.9]][i]; t.group.position.set(pos[0], 0, pos[1]); t.group.rotation.y = pos[2]; }
      else { const n = want.length, a = (i - (n - 1) / 2) * .38; t.group.position.set(22 + Math.sin(a) * 3.1, 0, 16 + Math.cos(a) * 3.1); t.group.rotation.y = a + Math.PI * 0 ; t.group.lookAt(22, 0, 25); }
      this.playAnim(t, w.anim, { fade: 0 }); t.mixer.setTime(i * .37);
      t.id = w.id; t.name = w.name; this.showcaseThieves.push(t);
    });
  }
  setLobby(roster) { this.lobbyRoster = roster || []; this.refreshShowcase(); }
  setMode(mode) {
    this.mode = mode; this.reveal.value = mode === 'game' ? 0 : 1;
    if (mode !== 'game') { for (const [id, e] of this.entities) { this.scene.remove(e.group); this.removeLabel(id); } this.entities.clear(); this.started = false; this.clearHint(); }
    if (this.showcase) this.showcase.visible = mode === 'menu' || mode === 'lobby';
    this.refreshShowcase();
  }
  // ---------- персонажи
  makeThief(color) {
    const model = this.clone('thief'); const group = new THREE.Group();
    model.scale.setScalar(this.thiefScale); model.position.y = -this.thiefMinY * this.thiefScale; group.add(model);
    // цветное кольцо игрока
    const ring = new THREE.Mesh(new THREE.RingGeometry(.4, .5, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .85, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = .02; group.add(ring);
    const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(.42, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .35, depthWrite: false })); shadowDisc.rotation.x = -Math.PI / 2; shadowDisc.position.y = .012; group.add(shadowDisc);
    // мешок добычи на спине
    const sack = this.clone('sack'); sack.visible = false; let spine = null; model.traverse(o => { if (o.isBone && /Spine2/.test(o.name)) spine = o; });
    if (spine) { spine.add(sack); sack.scale.setScalar(1 / this.thiefScale * .55); sack.position.set(0, 0, 0); sack.rotation.set(0, 0, 0); }
    // цветная повязка — тонкий тор на голове
    let head = null; model.traverse(o => { if (o.isBone && /Head_/.test(o.name)) head = o; });
    if (head) { const band = new THREE.Mesh(new THREE.TorusGeometry(1, .16, 8, 32), this.fog(new THREE.MeshStandardMaterial({ color, roughness: .5, emissive: new THREE.Color(color).multiplyScalar(.25) }))); head.add(band); band.scale.setScalar(.55 / this.thiefScale * .5); band.rotation.x = Math.PI / 2; band.position.set(0, .06 / this.thiefScale * .9, 0); this.headBand = band; }
    const mixer = new THREE.AnimationMixer(model), actions = {};
    for (const clip of this.assets.thief.animations) { const a = mixer.clipAction(clip); actions[clip.name] = a; if (['Push', 'Dash', 'Hide', 'Caught'].includes(clip.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } }
    return { group, model, mixer, actions, ring, sack, spine, current: null, color };
  }
  playAnim(e, name, { fade = .15, speed = 1 } = {}) {
    const a = e.actions[name]; if (!a) return; a.timeScale = speed;
    if (e.current === name) return;
    const prev = e.actions[e.current]; a.reset().setEffectiveWeight(1).fadeIn(fade).play(); if (prev) prev.fadeOut(fade); e.current = name;
  }
  // ---------- метки ников
  label(id, text, color, self) {
    let l = this.labels.get(id);
    if (!l) { const el = document.createElement('div'); el.className = 'nameplate' + (self ? ' self' : ''); el.innerHTML = '<b></b><i></i>'; this.overlay.appendChild(el); l = { el, name: el.querySelector('b'), bag: el.querySelector('i'), text: '', bagv: -1 }; this.labels.set(id, l); }
    if (l.text !== text) { l.name.textContent = text; l.text = text; l.el.style.setProperty('--c', color); }
    return l;
  }
  removeLabel(id) { const l = this.labels.get(id); if (l) { l.el.remove(); this.labels.delete(id); } }
  project(v) { const p = v.clone().project(this.camera); const r = this.renderer.domElement.getBoundingClientRect(); const o = this.overlay.getBoundingClientRect(); return { x: (p.x + 1) / 2 * r.width + r.left - o.left, y: (1 - p.y) / 2 * r.height + r.top - o.top, z: p.z }; }
  floater(x, y, z, text, cls = '') { const el = document.createElement('div'); el.className = 'floater ' + cls; el.textContent = text; this.overlay.appendChild(el); this.floaters.push({ el, pos: new THREE.Vector3(x, y, z), born: this.time }); }
  // ---------- состояние сервера
  setState(s, myId) {
    this.state = s; this.myId = myId;
    if (!this.started && s.you) { Object.assign(this.you, { x: s.you.x, z: s.you.z, angle: s.you.angle }); this.camTarget.set(s.you.x, 0, s.you.z); this.started = true; }
    if (s.events?.length) this.handleEvents(s.events);
  }
  setInput(i) { this.input = { ...i }; }
  pointerAngle(cx, cy) {
    const r = this.renderer.domElement.getBoundingClientRect(); const ndc = new THREE.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera); const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -.6), hit)) return Math.atan2(hit.z - this.you.z, hit.x - this.you.x);
    return this.input.angle;
  }
  handleEvents(events) {
    const A = this.hooks.audio;
    for (const e of events) {
      const near = e.x === undefined ? 1 : Math.max(0, 1 - Math.hypot(e.x - this.you.x, e.z - this.you.z) / 16);
      const mine = e.pid === this.myId;
      if (e.type === 'stolen') { const c = this.cases?.find(o => o.def.id === e.caseId); if (c) this.shatter(c); A?.glass(mine ? 1 : near); if (mine) { this.floater(e.x, 1.6, e.z, `+${e.value} ◈`, 'gold'); this.shake = .25; } }
      else if (e.type === 'alarm') { A?.alarmStart(); }
      else if (e.type === 'deposit') { if (mine) { this.floater(e.x, 1.4, e.z, `+${e.value} ◈ ВЫНЕСЕНО`, 'big'); A?.cash(1); this.burst(e.x, e.z, '#ffd23f', 30); } else A?.cash(near * .6); }
      else if (e.type === 'push') { A?.whoosh(mine ? .7 : near * .5); }
      else if (e.type === 'hit') { A?.thump(mine || e.by === this.myId ? 1 : near); this.burst(e.x, e.z, '#ffffff', 12, .6); if (mine) this.shake = .45; if (e.lost && (mine || e.by === this.myId)) this.floater(e.x, 1.5, e.z, `−${e.lost} ◈`, 'red'); }
      else if (e.type === 'dash') { if (mine) A?.dash(1); else A?.dash(near * .5); }
      else if (e.type === 'caught') { A?.caught(mine ? 1 : near); this.burst(e.x, e.z, '#ff3b4f', 26, .9); if (mine) { this.shake = .7; if (e.lost) this.floater(e.x, 1.6, e.z, `−${e.lost} ◈`, 'red'); } }
      else if (e.type === 'cabinet') { const c = this.cabinets?.find(k => k.h.id === e.cabId); if (c) { c.target = 1; c.closeAt = this.time + .7; } A?.creak(mine ? 1 : near); if (mine && e.open) this.hideEnter = this.time; if (mine && !e.open) this.hideEnter = 0; }
      else if (e.type === 'coin') { if (mine) { A?.coin(); this.floater(e.x, 1.1, e.z, '+5', 'coin'); } }
      else if (e.type === 'sack') { if (mine) { A?.coin(); this.floater(e.x, 1.2, e.z, `+${e.value} ◈`, 'gold'); } }
      else if (e.type === 'spotted') { if (e.pid === this.myId) A?.spotted(); }
      else if (e.type === 'full') { if (mine) this.hooks.onToast?.('Рюкзак полон — неси добычу к выходу!'); }
      else if (e.type === 'occupied') { if (mine) this.hooks.onToast?.('Шкаф занят'); }
      else if (e.type === 'exit') { A?.exitChange(); }
      else if (e.type === 'finale') { A?.finale(); }
      else if (e.type === 'start') { A?.start(); }
      else if (e.type === 'end') { A?.end(); }
    }
  }
  shatter(c) {
    const origin = new THREE.Vector3(c.def.x, c.def.type === 'wall' ? 1.05 : 1.05, c.def.z);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, .09, 0, .02, .03, .1, 0], 3)); geo.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: '#cdeaff', roughness: .05, metalness: .2, transparent: true, opacity: .8, side: THREE.DoubleSide });
    for (let i = 0; i < (c.def.type === 'case' ? 34 : 12); i++) { const s = new THREE.Mesh(geo, m); s.position.copy(origin).add(new THREE.Vector3(rand(-.4, .4), rand(-.2, .4), rand(-.4, .4))); this.scene.add(s); this.effects.push({ o: s, v: new THREE.Vector3(rand(-2.5, 2.5), rand(1, 3.5), rand(-2.5, 2.5)), spin: new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), life: 1.4, ground: true }); }
  }
  burst(x, z, color, n = 16, up = 1.2) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true }); const geo = new THREE.SphereGeometry(.05, 6, 4);
    for (let i = 0; i < n; i++) { const s = new THREE.Mesh(geo, m); s.position.set(x, .6, z); this.scene.add(s); const a = rand(0, Math.PI * 2), sp = rand(1, 3.2); this.effects.push({ o: s, v: new THREE.Vector3(Math.cos(a) * sp, rand(1, 3) * up, Math.sin(a) * sp), life: .9, fade: true }); }
  }
  clearHint() { if (this.hintEl) this.hintEl.style.display = 'none'; if (this.hint) { this.hint = null; this.hooks.onHint?.(null); } }
  // ---------- подсказка взаимодействия
  updateHint(s) {
    const me = this.you, you = s.you; let best = null, bd = 9;
    if (s.phase === 'playing' && !you.action?.type?.startsWith('hide') && !you.stunned) {
      CASES.forEach((def, i) => { const st = s.cases[i]; if (!st || st[0] || !caseReach(def, me)) return; const ip = def.type === 'wall' ? interactPoint(def) : def; const d = Math.hypot(me.x - ip.x, me.z - ip.z); if (d < bd) { bd = d; best = { kind: 'steal', def, i, progress: st[1], item: ITEMS[def.item], full: you.bag + ITEMS[def.item].value > RULES.capacity, x: def.x, z: def.z, y: def.type === 'wall' ? 1.75 : def.big ? 1.9 : 1.7 }; } });
      for (const h of CABINETS) { if (!cabinetReach(h, me)) continue; const ip = interactPoint(h); const d = Math.hypot(me.x - ip.x, me.z - ip.z) - .2; if (d < bd) { bd = d; best = { kind: 'hide', h, cd: you.hideCd, x: h.x, z: h.z, y: 2.0 }; } }
    }
    if (you.action?.type === 'steal') { const i = CASES.findIndex(c => c.id === you.action.caseId); const def = CASES[i]; best = { kind: 'steal', def, i, progress: s.cases[i]?.[1] || 0, item: ITEMS[def.item], active: true, x: def.x, z: def.z, y: def.type === 'wall' ? 1.75 : def.big ? 1.9 : 1.7 }; }
    const key = best ? `${best.kind}:${best.def?.id || best.h?.id}:${best.full ? 1 : 0}:${best.cd > 0 ? 1 : 0}:${best.active ? 1 : 0}` : '';
    if (key !== this.hintKey) { this.hintKey = key; this.hint = best; this.hooks.onHint?.(best); }
    if (!this.hintEl) { this.hintEl = document.createElement('div'); this.hintEl.className = 'world-hint'; this.hintEl.innerHTML = '<div class="wh-ring"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><circle class="p" cx="20" cy="20" r="17"/></svg><kbd>E</kbd></div><div class="wh-text"><b></b><span></span></div>'; this.overlay.appendChild(this.hintEl); this.hintRing = this.hintEl.querySelector('.p'); this.hintTitle = this.hintEl.querySelector('b'); this.hintSub = this.hintEl.querySelector('span'); }
    if (!best) { this.hintEl.style.display = 'none'; return; }
    this.hintEl.style.display = 'flex';
    if (best.kind === 'steal') {
      this.hintEl.dataset.kind = best.full ? 'blocked' : best.active ? 'active' : 'steal';
      this.hintTitle.textContent = best.item.name; this.hintSub.textContent = best.full ? 'Рюкзак полон' : best.active ? 'Взлом… не отпускай!' : `Удерживай · ${best.item.value} ◈`;
      this.hintRing.style.strokeDashoffset = String(106.8 * (1 - (best.progress || 0)));
    } else {
      this.hintEl.dataset.kind = best.cd > 0 ? 'blocked' : 'hide'; this.hintTitle.textContent = 'Шкаф'; this.hintSub.textContent = best.cd > 0 ? `Через ${Math.ceil(best.cd)} с` : 'Спрятаться на 5 с'; this.hintRing.style.strokeDashoffset = '106.8';
    }
  }
  // ---------- маска видимости
  updateMask(hidden) {
    const c = this.mctx, w = this.mask.width, h = this.mask.height, sx = w / WORLD.width, sz = h / WORLD.height;
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    if (hidden) { c.fillStyle = '#1a1a1a'; } else {
      const pts = visionPolygon(this.you, 90); c.save(); c.filter = 'blur(3px)'; c.beginPath(); pts.forEach(([x, z], i) => i ? c.lineTo(x * sx, z * sz) : c.moveTo(x * sx, z * sz)); c.closePath();
      const g = c.createRadialGradient(this.you.x * sx, this.you.z * sz, RULES.range * sx * .55, this.you.x * sx, this.you.z * sz, RULES.range * sx); g.addColorStop(0, '#fff'); g.addColorStop(1, '#444'); c.fillStyle = g; c.fill(); c.restore();
    }
    this.fogTex.needsUpdate = true;
  }
  // ---------- главный цикл
  loop() {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), .05); this.time += dt; const T = this.time;
    for (const m of this.fanMixers) m.update(dt);
    if (this.secCams) for (const s of this.secCams) s.c.rotation.y = s.base + Math.sin(T * .5 + s.ph) * .6;
    if (this.mode !== 'game' || !this.state) this.loopShowcase(dt, T); else this.loopGame(dt, T);
    // эффекты
    for (let i = this.effects.length - 1; i >= 0; i--) { const f = this.effects[i]; f.life -= dt; f.v.y -= 9 * dt; f.o.position.addScaledVector(f.v, dt); if (f.spin) { f.o.rotation.x += f.spin.x * dt; f.o.rotation.y += f.spin.y * dt; } if (f.o.position.y < .02) { f.o.position.y = .02; f.v.multiplyScalar(.3); f.v.y = Math.abs(f.v.y) * .3; } if (f.fade) f.o.scale.setScalar(Math.max(.01, f.life)); if (f.life <= 0) { this.scene.remove(f.o); this.effects.splice(i, 1); } }
    for (let i = this.floaters.length - 1; i >= 0; i--) { const f = this.floaters[i], age = T - f.born; const p = this.project(f.pos.clone().add(new THREE.Vector3(0, age * .9, 0))); f.el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%,-50%) scale(${Math.min(1, age * 6)})`; f.el.style.opacity = String(Math.max(0, 1.4 - age)); if (age > 1.5) { f.el.remove(); this.floaters.splice(i, 1); } }
    this.renderer.render(this.scene, this.camera);
  }
  loopShowcase(dt, T) {
    const a = T * .06; const target = new THREE.Vector3(22.6, this.mode === 'lobby' ? -.4 : .9, 17.4);
    const r = this.mode === 'lobby' ? 7.4 : 6.2, h = this.mode === 'lobby' ? 3.6 : 2.6;
    const portrait = this.aspect < .9;
    this.camera.position.set(target.x + Math.sin(a) * r * (portrait ? 1.35 : 1), h + (portrait ? 1.5 : 0), target.z + Math.cos(a) * r * (portrait ? 1.35 : 1)); this.camera.lookAt(target.x, target.y, target.z);
    this.camera.fov = portrait ? 50 : 38; this.camera.updateProjectionMatrix();
    this.moon.position.set(target.x - 8, 22, target.z + 10); this.moon.target.position.copy(target);
    if (this.showcaseThieves) for (const t of this.showcaseThieves) { t.mixer.update(dt); if (this.mode === 'lobby' && t.name) { const l = this.label('show-' + t.id, t.name, t.color, t.id === this.myId); const p = this.project(t.group.position.clone().add(new THREE.Vector3(0, 1.55, 0))); l.el.style.transform = `translate(${p.x}px, ${p.y}px)`; l.el.style.display = 'flex'; l.bag.style.display = 'none'; } }
    if (this.mode !== 'lobby') for (const [id] of this.labels) if (id.startsWith('show-')) this.removeLabel(id);
    if (this.cases) this.animateCases(null, T, dt);
    for (const v of this.vans || []) v.userData.hl.material.opacity = 0;
    this.exitLight.intensity = 0;
    for (const x of this.exits) { x.ring.material.color.set('#3dffb0'); x.beam.visible = false; }
  }
  animateCases(s, T, dt) {
    const alarmIds = new Set((s?.alarms || []).map(a => CASES.find(c => Math.abs(c.x - a.x) < .01 && Math.abs(c.z - a.z) < .01)?.id));
    let li = 0;
    this.cases.forEach((o, i) => {
      const st = s?.cases?.[i] || [0, 0]; const empty = !!st[0];
      if (o.item) { o.item.visible = !empty; if (o.def.type === 'case') o.item.rotation.y += dt * (o.def.big ? .6 : .35); }
      if (o.glass) { o.glass.visible = !empty; o.glass.material.opacity = .2 + st[1] * .3; o.glass.material.color.setRGB(.75 + st[1] * .25, .9 - st[1] * .5, 1 - st[1] * .6); }
      if (o.emptyMark) o.emptyMark.visible = empty; if (o.halo) o.halo.material.opacity = (empty ? .06 : o.def.big ? .55 : .3) * (1 + Math.sin(T * 2 + i) * .08);
      const alarm = alarmIds.has(o.def.id); o.beacon.visible = alarm; o.flare.visible = alarm;
      if (alarm) { o.flare.material.opacity = .5 + Math.sin(T * 12) * .5; o.flare.lookAt(this.camera.position); o.beacon.rotation.y += dt * 8; if (li < 2) { const L = this.alarmLights[li++]; L.position.set(o.def.x, 2.2, o.def.z); L.intensity = 30 + Math.sin(T * 12) * 25; } }
      if (empty && o.wasFull === true && !o.shattered) o.shattered = true; o.wasFull = !empty; if (!empty) o.shattered = false;
    });
    for (; li < 2; li++) this.alarmLights[li].intensity = 0;
  }
  loopGame(dt, T) {
    const s = this.state, me = s.you; const hidden = me.action?.type === 'hide';
    // предсказание своего движения
    const canMove = s.phase === 'playing' && !me.stunned && !hidden;
    if (canMove) {
      const dashing = me.anim === 'dash'; const stealing = me.action?.type === 'steal';
      const speed = dashing ? RULES.dashSpeed : RULES.speed * (1 - me.bag / RULES.capacity * RULES.slow) * (stealing ? .35 : 1);
      const mx = this.input.x, mz = this.input.z, moving = Math.hypot(mx, mz) > .1;
      if (dashing && !moving) move(this.you, Math.cos(this.you.angle) * speed * dt, Math.sin(this.you.angle) * speed * dt); else move(this.you, mx * speed * dt, mz * speed * dt);
    }
    const err = Math.hypot(this.you.x - me.x, this.you.z - me.z);
    if (err > 2.2 || !canMove) { this.you.x = lerp(this.you.x, me.x, err > 2.2 ? 1 : Math.min(1, dt * 12)); this.you.z = lerp(this.you.z, me.z, err > 2.2 ? 1 : Math.min(1, dt * 12)); }
    else if (err > .05) { this.you.x = lerp(this.you.x, me.x, Math.min(1, dt * 3)); this.you.z = lerp(this.you.z, me.z, Math.min(1, dt * 3)); }
    this.you.angle = canMove && !(me.action?.type === 'steal') ? this.input.angle : me.angle;
    if (s.phase !== 'playing') this.you.angle = this.input.angle;
    this.updateMask(hidden);
    // камера: сверху под углом, с упреждением в сторону взгляда
    const portrait = this.aspect < .9; const look = 1.6;
    const tx = this.you.x + Math.cos(this.you.angle) * look, tz = this.you.z + Math.sin(this.you.angle) * look * .7;
    this.camTarget.x = lerp(this.camTarget.x, tx, Math.min(1, dt * 4)); this.camTarget.z = lerp(this.camTarget.z, tz, Math.min(1, dt * 4));
    const height = portrait ? 17 : 12, back = portrait ? 7.5 : 7;
    this.shake = Math.max(0, this.shake - dt * 1.6); const sh = this.shake * this.shake * .35;
    this.camera.fov = portrait ? 46 : 40; this.camera.updateProjectionMatrix();
    this.camera.position.set(this.camTarget.x + rand(-sh, sh), height + rand(-sh, sh), this.camTarget.z + back); this.camera.lookAt(this.camTarget.x, 0, this.camTarget.z - .5);
    this.moon.position.set(this.camTarget.x - 8, 22, this.camTarget.z + 10); this.moon.target.position.set(this.camTarget.x, 0, this.camTarget.z);
    // выходы
    this.exits.forEach((x, i) => {
      const active = i === s.activeExit; const col = active ? (s.finale ? '#ffcf3d' : '#3dffb0') : '#ff3b4f';
      x.ring.material.color.set(col); x.arrows.material.color.set(col); x.arrows.visible = active; x.beam.visible = active; x.beam.material.color.set(col);
      x.ring.material.opacity = active ? .8 + Math.sin(T * 4) * .2 : .25; x.ring.scale.setScalar(active ? 1 + Math.sin(T * 3) * .04 : .9); x.arrows.position.y = .035; x.arrows.material.opacity = active ? .6 + Math.sin(T * 6) * .4 : 0;
      x.shutter.position.y = lerp(x.shutter.position.y, active ? WALL_H * 1.45 : WALL_H / 2, Math.min(1, dt * 3)); x.pad.material.color.set(active ? '#0d4a3a' : '#2a1218');
      if (active) { this.exitLight.position.set(x.e.x, 1.6, x.e.z); this.exitLight.color.set(col); this.exitLight.intensity = 16 + Math.sin(T * 4) * 4; }
      const v = this.vans[i]; v.userData.hl.material.opacity = active ? .5 : 0;
    });
    this.animateCases(s, T, dt);
    // шкафы: двери
    for (const c of this.cabinets) {
      if (c.closeAt && this.time > c.closeAt) { c.target = 0; c.closeAt = 0; }
      c.open = lerp(c.open, c.target, Math.min(1, dt * 10)); for (const d of c.doors) d.o.rotation.y = d.base + d.sign * c.open * 1.75;
      const ip = interactPoint(c.h); const near = Math.hypot(this.you.x - ip.x, this.you.z - ip.z) < 2.2 && s.phase === 'playing' && !hidden; c.hint.material.opacity = lerp(c.hint.material.opacity, near ? .7 : 0, Math.min(1, dt * 6));
    }
    // монеты
    const coinSet = new Set(s.coins); for (const [id, c] of this.coins) { c.visible = coinSet.has(id); if (c.visible) { c.rotation.y += dt * 3; c.position.y = .3 + Math.sin(T * 3 + c.position.x) * .06; } }
    // сущности
    const seen = new Set();
    const myView = { ...me, x: this.you.x, z: this.you.z, angle: this.you.angle };
    const leader = [...s.roster].sort((a, b) => b.score - a.score)[0];
    for (const p of [myView, ...s.players]) {
      const self = p.id === me.id; const id = p.id; let e = this.entities.get(id);
      if (!e) { e = this.makeThief(p.color); e.kind = 'player'; this.scene.add(e.group); e.group.position.set(p.x, 0, p.z); this.entities.set(id, e); e.angle = p.angle; }
      seen.add(id);
      const hide = self && hidden;
      // анимация входа в шкаф
      if (hide) {
        const cab = CABINETS.find(h => h.id === me.action.cabId); const el = me.action.elapsed;
        if (el < .55) { e.group.visible = true; const k = Math.min(1, Math.max(0, (el - .12) / .4)); const ip = interactPoint(cab); e.group.position.set(lerp(ip.x, cab.x, k), 0, lerp(ip.z, cab.z, k)); e.group.rotation.y = this.orient([-cab.f[0], -cab.f[1]]) + Math.PI * Math.min(1, k * 1.4); this.playAnim(e, 'Hide', { fade: .1 }); }
        else e.group.visible = false;
      } else {
        e.group.visible = true;
        const tgt = new THREE.Vector3(p.x, 0, p.z);
        const prev = e.group.position.clone();
        if (self) e.group.position.copy(tgt); else e.group.position.lerp(tgt, Math.min(1, dt * 14));
        const moved = prev.distanceTo(e.group.position) / Math.max(dt, .001);
        e.angle = e.angle + angleDiff(p.angle, e.angle) * Math.min(1, dt * 14); e.group.rotation.y = Math.PI / 2 - e.angle;
        const anim = self ? (me.anim === 'move' || (Math.hypot(this.input.x, this.input.z) > .1 && canMove && me.anim === 'idle') ? 'move' : me.anim) : p.anim;
        const map = { idle: 'Idle', move: 'Walk', steal: 'Steal', push: 'Push', dash: 'Dash', stunned: 'Stunned', caught: 'Caught' };
        if (s.phase === 'results') this.playAnim(e, leader?.id === id ? 'Cheer' : 'Idle'); else this.playAnim(e, map[anim] || 'Idle', { speed: anim === 'move' ? Math.max(1.1, Math.min(2, moved / 2.4)) : 1, fade: anim === 'push' || anim === 'dash' ? .06 : .16 });
      }
      e.mixer.update(dt);
      e.sack.visible = p.bag > 0; if (p.bag > 0) e.sack.scale.setScalar(1 / this.thiefScale * (.45 + Math.min(1, p.bag / RULES.capacity) * .55));
      e.ring.material.opacity = .55 + Math.sin(T * 4) * .15;
      // звёздочки над оглушённым
      const dizzy = p.anim === 'stunned' || p.anim === 'caught';
      if (dizzy && !e.stars) { e.stars = new THREE.Group(); for (let k = 0; k < 3; k++) { const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.starTex ||= TEX.star(), depthWrite: false })); st.scale.setScalar(.22); st.position.set(Math.cos(k * 2.1) * .35, 0, Math.sin(k * 2.1) * .35); e.stars.add(st); } e.stars.position.y = 1.35; e.group.add(e.stars); }
      if (e.stars) { e.stars.visible = dizzy; e.stars.rotation.y += dt * 5; }
      // ник
      if (!hide || (self && me.action.elapsed < .55)) {
        const l = this.label(id, p.name, p.color, self); const pos = this.project(e.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
        l.el.style.display = 'flex'; l.el.style.transform = `translate(${pos.x}px, ${pos.y}px)`; l.el.classList.toggle('leader', leader?.id === id && leader.score > 0);
        if (l.bagv !== p.bag) { l.bagv = p.bag; l.bag.textContent = p.bag ? `${p.bag} ◈` : ''; l.bag.style.display = p.bag ? 'inline-block' : 'none'; }
      } else this.labels.get(id) && (this.labels.get(id).el.style.display = 'none');
    }
    // мешки
    for (const k of s.sacks) {
      let e = this.entities.get(k.id); if (!e) { const g = this.clone('sack'); e = { group: g, kind: 'sack' }; g.position.set(k.x, 0, k.z); g.scale.setScalar(.8); this.scene.add(g); this.entities.set(k.id, e); e.born = T; }
      seen.add(k.id); e.group.visible = true; const age = T - e.born; e.group.position.y = Math.max(0, Math.sin(Math.min(1, age * 2.5) * Math.PI) * .5); e.group.rotation.y += dt * .8;
      const l = this.label(k.id, `${k.value} ◈`, '#ffd23f', false); l.el.classList.add('loot'); const pos = this.project(e.group.position.clone().add(new THREE.Vector3(0, .85, 0))); l.el.style.display = 'flex'; l.el.style.transform = `translate(${pos.x}px, ${pos.y}px)`; l.bag.style.display = 'none';
    }
    // дроны
    for (const d of s.drones) {
      let e = this.entities.get(d.id);
      if (!e) {
        const g = this.clone('drone'); g.scale.setScalar(1.25); const rotors = []; let lr, lb; g.traverse(o => { if (/^Rotor/.test(o.name)) rotors.push(o); if (o.name === 'LightRed') lr = o; if (o.name === 'LightBlue') lb = o; });
        const cone = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#7fd0ff', transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
        const spot = new THREE.Mesh(new THREE.CircleGeometry(.7, 32), new THREE.MeshBasicMaterial({ map: TEX.glow('140,210,255'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); spot.rotation.x = -Math.PI / 2;
        this.scene.add(g, cone, spot); e = { group: g, kind: 'drone', rotors, lr, lb, cone, spot, angle: d.angle }; g.position.set(d.x, 2.1, d.z); this.entities.set(d.id, e);
      }
      seen.add(d.id); e.group.visible = e.cone.visible = e.spot.visible = true;
      e.group.position.lerp(new THREE.Vector3(d.x, 2.1 + Math.sin(T * 3 + d.x) * .08, d.z), Math.min(1, dt * 12)); e.angle += angleDiff(d.angle, e.angle) * Math.min(1, dt * 10); e.group.rotation.y = Math.PI / 2 - e.angle; e.group.rotation.z = Math.sin(T * 2) * .05;
      for (const r of e.rotors) r.rotation.y += dt * 40;
      const alert = d.state === 'chase' || d.state === 'respond'; const flash = Math.sin(T * 14) > 0;
      if (e.lr) e.lr.visible = !alert || flash; if (e.lb) e.lb.visible = !alert || !flash;
      e.cone.material.color.set(d.state === 'chase' ? '#ff3040' : d.state === 'respond' ? '#ff9a2e' : d.state === 'search' ? '#ffd23f' : '#7fd0ff'); e.cone.material.opacity = d.state === 'chase' ? .22 : .14;
      e.spot.position.set(e.group.position.x, .03, e.group.position.z); e.spot.material.color.copy(e.cone.material.color);
      if (!e.coneAt || T - e.coneAt > .08) { e.coneAt = T; const poly = this.droneCone(e.group.position.x, e.group.position.z, e.angle); e.cone.geometry.dispose(); e.cone.geometry = poly; }
    }
    for (const [id, e] of this.entities) if (!seen.has(id)) { e.group.visible = false; if (e.cone) { e.cone.visible = false; e.spot.visible = false; } const l = this.labels.get(id); if (l) l.el.style.display = 'none'; if (e.kind === 'sack') { this.scene.remove(e.group); this.entities.delete(id); this.removeLabel(id); } }
    this.updateHint(s);
    this.hooks.onDrones?.(s.drones.length ? Math.min(...s.drones.map(d => Math.hypot(d.x - this.you.x, d.z - this.you.z))) : 99);
  }
  droneCone(x, z, angle) {
    const fov = 80 * Math.PI / 180, range = 7, n = 28, pos = [x, .04, z];
    for (let i = 0; i <= n; i++) { const a = angle - fov / 2 + i / n * fov, bx = x + Math.cos(a) * range, bz = z + Math.sin(a) * range; let t = 1; for (const w of OCCLUDERS) { const h = segmentHit(x, z, bx, bz, w); if (h !== null && h < t) t = h; } pos.push(x + (bx - x) * t, .04, z + (bz - z) * t); }
    const idx = []; for (let i = 1; i <= n; i++) idx.push(0, i, i + 1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
  }
  debugRay(px, py) {
    const r = this.renderer.domElement.getBoundingClientRect(); const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2((px - r.left) / r.width * 2 - 1, -(py - r.top) / r.height * 2 + 1), this.camera);
    return rc.intersectObjects(this.scene.children, true).filter(h => h.object.visible).slice(0, 3).map(h => { const n = []; let o = h.object; while (o && n.length < 6) { n.push(o.name || o.type); o = o.parent; } return n.join('<') + ' @' + h.distance.toFixed(1); });
  }
  destroy() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect();
    for (const [, l] of this.labels) l.el.remove(); this.hintEl?.remove(); for (const f of this.floaters) f.el.remove();
    this.scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose?.(); m.dispose(); }); });
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
