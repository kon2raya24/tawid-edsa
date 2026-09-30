// The 3D view of Tawid EDSA, in three.js. It only reads the rules (game.mjs): every lane is a function of
// time, so it draws each object at the exact fractional tick, and it continues each lane past the board's
// edges with the lane's own next copies, so the traffic runs on out of sight instead of popping. Traffic
// and floaters are drawn in instanced pools (a draw per part, however many jeepneys), with their lamps
// throwing light and red streaks on the wet road. The camera frames the board from a tilted three-quarter
// view and follows Kokak; each level opens with a flyover, deaths get a short punch-in, and the frame goes
// through the film look (post.mjs).
import * as THREE from './vendor/three.module.min.js';
import { COLS, CELL, HOP, BAYS, ISLAND, START, HOME, BAY_BUWAYA, TICK, DIVE, objectsAt, platformAt, snakeX, anakX, isWater, isRoad, UP, RIGHT, DOWN, LEFT } from './game.mjs';
import { M as UM, HALF, wx, wz, ROAD_Y, WALK_Y, ISLAND_Y, WATER_Y, BANK_Y } from './space.mjs';
import * as T from './tex.mjs';
import { createPost } from './post.mjs';
import { vehicleModel, wheelModel, horseLeg, floaterModel, buwayaModel, flipperModel, crocJaw, miniFrog, lamokModel, wingGeo, snakeHead, gabiLeafGeo, PAINT, enforcerModel, enforcerArm } from './models3d.mjs';
import { createKokak, frogTextures } from './frog3d.mjs';
import { updateWater } from './water3d.mjs';
import { buildWorld, WET } from './world3d.mjs';
import { createFx } from './fx3d.mjs';
import { loadSky, loadBackdrop, dressSurfaces, dressProps, loadTex, SKY } from './envpack.mjs';

const TAU = Math.PI * 2, HP = Math.PI / 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mod = (a, m) => ((a % m) + m) % m;
const YAW = [HP, 0, -HP, Math.PI]; // Kokak facing up, right, down, left
const VIS = 40; // metres either side of the middle that the lanes are drawn out to

// The four places' light: the sky photo, the sun [colour, strength, elevation, azimuth], the sky light,
// the photo's share of the light, fog [colour, near, far], how bright the lamps and headlamps burn, the
// rain's colour, how wet the ground is, and a painted sky [top, middle, horizon] until the photo loads.
const LOOK = [
  { key: 'cubao', sun: ['#ff9058', 2.3, 0.2, -2.0], hemi: ['#8a8cc8', '#2e2430', 0.42], env: 0.32, fog: ['#4a3c5c', 40, 175], lamps: 1.1, cars: 1.15, rainC: '#e6d6ee', wet: 0.8, grad: ['#1a1838', '#6a4a78', '#e88a68'], exposure: 0.95 },
  { key: 'espana', sun: ['#e4ecee', 0.85, 0.95, -1.2], hemi: ['#c0cace', '#4a4638', 1.2], env: 0.6, fog: ['#8e9892', 26, 120], lamps: 0.45, cars: 0.65, rainC: '#e2eaf0', wet: 1, grad: ['#5a6468', '#98a2a4', '#c4c8c0'], exposure: 1.0 },
  { key: 'quiapo', sun: ['#ffc478', 3.2, 0.3, -2.25], hemi: ['#a8c0e0', '#4a3a28', 0.6], env: 0.65, fog: ['#b4a088', 40, 190], lamps: 0.55, cars: 0.7, rainC: '#fff2d8', wet: 0.65, grad: ['#3a6aa8', '#a0b8d0', '#f8d8a0'], exposure: 1.0 },
  { key: 'maynila', sun: ['#8a9cff', 0.45, 0.85, 0.8], hemi: ['#34447a', '#120e18', 0.5], env: 0.3, fog: ['#161c30', 34, 150], lamps: 1.7, cars: 1.5, rainC: '#c0ccff', wet: 1, grad: ['#05060c', '#141a30', '#2e2848'], exposure: 1.05 },
];

// ---------- instanced pools ----------
class Pool {
  constructor(parent, geo, mat, cap, { shadow = true, tint = false, order = 0 } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.castShadow = shadow; this.mesh.receiveShadow = true; this.mesh.renderOrder = order;
    if (tint) { this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); }
    this.n = 0; this.cap = cap; parent.add(this.mesh);
  }
  put(m, color) { if (this.n >= this.cap) return; this.mesh.setMatrixAt(this.n, m); if (color && this.mesh.instanceColor) this.mesh.setColorAt(this.n, color); this.n++; }
  end() { this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; this.n = 0; }
}

export function createView(canvas, { gfx = null, low = false, layer = null, touch = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const fixed = gfx !== null && gfx !== '' && !isNaN(+gfx);
  let level = fixed ? clamp(+gfx, 0, 2) : low ? 1 : 2;
  const pixelRatio = () => Math.min(window.devicePixelRatio || 1, level >= 2 ? 2 : level === 1 ? 1.5 : 1);
  renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = level > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#6a5870', 40, 170);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.3, 420);
  scene.add(camera);
  const post = createPost(renderer, scene, camera, { level, auto: !fixed });
  const pmrem = new THREE.PMREMGenerator(renderer);

  // ---------- textures and materials ----------
  const shellT = T.shell(), crocT = T.croc(), banigT = T.banig(), endT = T.endGrain();
  const bambooT = T.paint(64, 256, (() => { const r = T.rng(4), f = T.noise(64, 256, 3, r); return (x, y) => { const node = Math.abs((y % 64) - 32) < 2, k = (0.85 + f[y * 64 + x] * 0.25) * (node ? 0.62 : 1); return [200 * k, 180 * k, 110 * k, node ? 1 : 0]; }; })(), { strength: 3 });
  const barkT = T.paint(256, 256, (() => { const r = T.rng(13), f = T.fbm(256, 256, 32, 4, r), fine = T.noise(256, 256, 3, r); return (x, y) => { const i = y * 256 + x, ridge = Math.abs(Math.sin((y / 256) * 40 + f[i] * 9)), v = 38 + ridge * 44 + (fine[i] - 0.5) * 20; return [v * 1.12, v * 0.92, v * 0.7, ridge + fine[i] * 0.3]; }; })(), { strength: 5 });
  for (const t of [barkT.map, barkT.normalMap, bambooT.map, bambooT.normalMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  const frogT = frogTextures(T);
  const tex = { gabi: T.gabiLeaf(), waterN: T.waterNormal() };
  const routes = ['CUBAO', 'QUIAPO', 'BACLARAN', 'MOA'].map((r, i) => T.routeBoard(r, ['VIA EDSA', 'VIA ESPAÑA', 'VIA QUEZON BLVD', 'VIA TAFT'][i]));
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, ...o });
  const MATS = {
    paint: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }),
    body: std({ roughness: 0.62 }),
    chrome: std({ roughness: 0.14, metalness: 1 }),
    metal: std({ roughness: 0.4, metalness: 0.85 }),
    glass: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.03, metalness: 0.2, clearcoat: 1 }),
    lamp: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    sign: new THREE.MeshStandardMaterial({ map: routes[0], emissive: '#ffffff', emissiveMap: routes[0], emissiveIntensity: 0.55, roughness: 0.5 }),
    bark: std({ map: barkT.map, normalMap: barkT.normalMap, roughness: 0.85 }),
    endgrain: std({ map: endT.map, normalMap: endT.normalMap, roughness: 0.8 }),
    bamboo: std({ map: bambooT.map, normalMap: bambooT.normalMap, roughness: 0.5 }),
    banig: std({ map: banigT.map, normalMap: banigT.normalMap, roughness: 0.8 }),
    shell: new THREE.MeshPhysicalMaterial({ vertexColors: true, map: shellT.map, normalMap: shellT.normalMap, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    skin: std({ color: '#6a7a4a', roughness: 0.5 }),
    plastic: std({ roughness: 0.35 }),
    leaf: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 0.5 }),
    flower: std({ roughness: 0.6, emissive: '#301040', emissiveIntensity: 0.3 }),
    wood: std({ roughness: 0.8 }),
    croc: new THREE.MeshPhysicalMaterial({ vertexColors: true, map: crocT.map, normalMap: crocT.normalMap, roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    tooth: std({ roughness: 0.3 }),
    eye: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.1, clearcoat: 1 }),
    snake: new THREE.MeshPhysicalMaterial({ color: '#3f8a3a', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 }),
    fskin: new THREE.MeshPhysicalMaterial({ vertexColors: true, map: frogT.skin, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12 }),
  };
  const frogMats = {
    skin: new THREE.MeshPhysicalMaterial({ map: frogT.skin, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.1 }),
    belly: new THREE.MeshPhysicalMaterial({ color: '#eae6b0', roughness: 0.45, clearcoat: 0.6 }),
    leg: new THREE.MeshPhysicalMaterial({ map: frogT.leg, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.1 }),
    dark: new THREE.MeshStandardMaterial({ color: '#10200c', roughness: 0.6 }),
    blush: new THREE.MeshStandardMaterial({ color: '#ff8a9a', roughness: 0.8, transparent: true, opacity: 0.55, depthWrite: false }),
    eye: new THREE.MeshPhysicalMaterial({ map: frogT.eye, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 }),
    hat: new THREE.MeshPhysicalMaterial({ map: frogT.leaf, roughness: 0.4, clearcoat: 0.5, side: THREE.DoubleSide }),
  };
  const glowT = T.glow(), streakT = T.streak();
  const addMat = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: true });

  // ---------- the place ----------
  const world = buildWorld({ scene, T, tex });
  const hemi = new THREE.HemisphereLight('#a098c8', '#3a2e34', 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffa06a', 1.6);
  sun.castShadow = level > 0; sun.shadow.mapSize.set(level >= 2 ? 2048 : 1024, level >= 2 ? 2048 : 1024);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 22, bottom: -22, near: 1, far: 120 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const lampLights = [-13, -5, 3, 11].map((x) => { const l = new THREE.PointLight('#ffb870', 0, 16, 1.6); l.position.set(x, 7.6, 1.2); scene.add(l); return l; });
  const pulse = new THREE.PointLight('#7cf29a', 0, 9, 2); scene.add(pulse);
  const neonLights = [['#ff4fb0', -16, 9, -19], ['#40e0ff', 10, 10, -20]].map(([c, x, y, z]) => { const l = new THREE.PointLight(c, 0, 26, 1.4); l.position.set(x, y, z); scene.add(l); return l; });
  // the sky: painted until the photograph loads
  const skyU = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() } };
  const skyPaint = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top, mid, low; varying vec3 v; void main(){ float h = v.y; vec3 c = h > 0.08 ? mix(mid, top, smoothstep(0.08, 0.6, h)) : mix(low, mid, smoothstep(-0.05, 0.08, h)); gl_FragColor = vec4(c, 1.0); }' });
  const skyPhoto = new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(380, 48, 24), skyPaint); sky.renderOrder = -10; scene.add(sky);

  // ---------- pools for everything that moves ----------
  const dyn = new THREE.Group(); dyn.name = 'lanes'; scene.add(dyn);
  const pools = new Map();
  const TINT = new Set(['paint']);
  function poolsFor(key, parts, cap, { mats = MATS, tint = TINT, shadow = true } = {}) {
    if (pools.has(key)) return pools.get(key);
    const list = Object.entries(parts).map(([slot, geo]) => ({ slot, pool: new Pool(dyn, geo, mats[slot] || MATS.body, cap, { tint: tint.has(slot), shadow: shadow && slot !== 'lamp' }) }));
    pools.set(key, list);
    return list;
  }
  const allPools = () => { const out = []; for (const l of pools.values()) for (const p of l) out.push(p.pool); return out; };
  const wheel = poolsFor('wheel', wheelModel(), 420);
  const legs = poolsFor('horseLeg', horseLeg(), 16);
  const flip = poolsFor('flipper', flipperModel(), 160);
  const jaw = poolsFor('jaw', crocJaw(), 8);
  const family = poolsFor('mini', miniFrog(), 10, { mats: { ...MATS, skin: MATS.fskin }, tint: new Set(['skin']) });
  const lamokP = poolsFor('lamok', lamokModel(), 2);
  const wingP = poolsFor('wing', { body: wingGeo() }, 4, { mats: { body: new THREE.MeshBasicMaterial({ color: '#dfe8ff', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }) } });
  const snakeP = poolsFor('snakeHead', snakeHead(), 2, { mats: { ...MATS } });
  const segP = poolsFor('snakeSeg', { snake: new THREE.SphereGeometry(0.16, 12, 8) }, 40);
  const padP = poolsFor('pad', { gabi: gabiLeafGeo(1.7) }, 5, { mats: { gabi: world.M.gabi } });
  const glowP = new Pool(dyn, (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-HP); return g; })(), addMat(glowT), 320, { shadow: false, tint: true, order: 3 });
  const streakP = new Pool(dyn, (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-HP); g.translate(0, 0, 0.5); return g; })(), addMat(streakT), 320, { shadow: false, tint: true, order: 3 });
  // light through the rain: cones from every headlamp and streetlamp, brightest at the lamp
  const beamTex = (() => { const c = T.canvas(4, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 4, 128); return T.toTex(c, { color: false }); })();
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: true });
  const carBeam = new THREE.CylinderGeometry(0.08, 0.9, 5, 14, 1, true); carBeam.translate(0, -2.5, 0); carBeam.rotateZ(HP); // narrow at the lamp (x = 0), out along +x
  const lampBeam = new THREE.CylinderGeometry(0.2, 2.4, 7.6, 16, 1, true); lampBeam.translate(0, -3.8, 0);
  const beamP = new Pool(dyn, carBeam, beamMat, 160, { shadow: false, tint: true, order: 4 });
  const lampBeamP = new Pool(dyn, lampBeam, beamMat, 40, { shadow: false, tint: true, order: 4 });
  // ripples: rings opening where Kokak lands in or near the water
  const rippleP = new Pool(dyn, (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-HP); return g; })(), addMat(T.ring(128)), 24, { shadow: false, tint: true, order: 3 });
  const ripples = [];
  const ripple = (x, y, z, size = 1) => { ripples.push({ x, y, z, t: 0, size }); if (ripples.length > 24) ripples.shift(); };
  const foamP = new Pool(dyn, (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-HP); return g; })(), (() => { const m = addMat(glowT); m.opacity = 0.5; return m; })(), 200, { shadow: false, tint: true, order: 3 });

  // ---------- Kokak and the family ----------
  const kokak = createKokak(frogMats, { scale: 1.3 }); scene.add(kokak.root);
  const carried = createKokak(frogMats, { scale: 0.55 }); scene.add(carried.root); carried.root.visible = false;
  const FAMILY = ['#9ae07a', '#c8f07a', '#7ad8a0', '#e0e87a', '#8ad0d8'].map((c) => new THREE.Color(c));

  // Manong Enforcer, on the footbridge over EDSA, watching the traffic (and Kokak)
  const enforcer = new THREE.Group(); enforcer.position.set(-(HALF + 3.6) + 0.4, 5.45, 9.2); enforcer.rotation.y = -0.5; scene.add(enforcer);
  for (const geo of Object.values(enforcerModel())) { const o = new THREE.Mesh(geo, MATS.body); o.castShadow = true; enforcer.add(o); }
  const arm = new THREE.Group(); arm.position.set(0, 1.38, 0.27); enforcer.add(arm);
  for (const geo of Object.values(enforcerArm())) { const o = new THREE.Mesh(geo, MATS.body); o.castShadow = true; arm.add(o); }
  let waveT = 0;
  // ---------- effects ----------
  const fx = createFx(scene, T, { layer });

  // ---------- scratch ----------
  const m4 = new THREE.Matrix4(), m5 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v = new THREE.Vector3(), sv = new THREE.Vector3(), col = new THREE.Color(), col2 = new THREE.Color();
  const compose = (out, x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => out.compose(v.set(x, y, z), q.setFromEuler(e3.set(rx, ry, rz, 'YXZ')), sv.set(sx, sy, sz));
  const HEADC = new THREE.Color(1.0, 0.86, 0.62), TAILC = new THREE.Color(1.0, 0.1, 0.05), LAMPC = new THREE.Color(1.0, 0.62, 0.3);

  // ---------- the place, the light ----------
  let placeN = -1, look = LOOK[0], env = null;
  function setPlace(n) {
    if (n === placeN) return;
    placeN = n; look = LOOK[n];
    world.setPlace(n); post.setStage(look.key);
    MATS.sign.map = MATS.sign.emissiveMap = routes[n]; MATS.sign.needsUpdate = true;
    const [sc, si, el, az] = look.sun;
    sun.color.set(sc); sun.intensity = si;
    sun.position.set(Math.cos(el) * Math.sin(az) * 60, Math.sin(el) * 60, Math.cos(el) * Math.cos(az) * 60);
    hemi.color.set(look.hemi[0]); hemi.groundColor.set(look.hemi[1]); hemi.intensity = look.hemi[2];
    scene.fog.color.set(look.fog[0]); scene.fog.near = look.fog[1]; scene.fog.far = look.fog[2];
    skyU.top.value.set(look.grad[0]); skyU.mid.value.set(look.grad[1]); skyU.low.value.set(look.grad[2]);
    WET.wet.value = look.wet;
    for (const l of lampLights) { l.intensity = 26 * look.lamps; }
    neonLights.forEach((l) => { l.intensity = n === 3 ? 18 : 0; });
    renderer.toneMappingExposure = look.exposure;
    sky.material = skyPaint; scene.environment = null;
    if (env) dressSky(n);
  }
  function dressSky(n) {
    loadSky(env, SKY[n], pmrem).then((t) => { if (t && placeN === n) { scene.environment = t; scene.environmentIntensity = look.env; } });
    loadBackdrop(env, SKY[n]).then((t) => { if (t && placeN === n) { skyPhoto.map = t; skyPhoto.color.setScalar(n === 3 ? 0.9 : 1); skyPhoto.needsUpdate = true; sky.material = skyPhoto; sky.rotation.y = [0.3, 0.6, -2.0, 1.2][n]; } });
  }
  function setEnv(e, onProgress) {
    env = e;
    if (placeN >= 0) dressSky(placeN);
    const extra = Promise.all([loadTex(e, 'bark_brown_02'), loadTex(e, 'bamboo_wall')]).then(([bark, bam]) => {
      if (bark && bark.diff) { MATS.bark.map = bark.diff; MATS.bark.normalMap = bark.nor; MATS.bark.needsUpdate = true; }
      if (bam && bam.diff) { MATS.bamboo.map = bam.diff; MATS.bamboo.normalMap = bam.nor; MATS.bamboo.needsUpdate = true; }
    });
    dressProps(e, world.root).catch(() => null);
    return Promise.all([dressSurfaces(e, world.root, onProgress), extra]);
  }

  // ---------- where things are ----------
  // How far under a diving thing is (0 afloat .. 1 gone), smoothly, from its place in the dive cycle.
  function sinkOf(lane, o, tt) {
    if (!lane.dive.includes(o.k)) return 0;
    const p = mod(tt + o.k * 83 + lane.row * 37, DIVE.period), a = DIVE.up, b = a + DIVE.sink, c = b + DIVE.under;
    if (p < a) return 0;
    if (p < b) return 0.55 * smooth(a, b, p);
    if (p < c) return 0.55 + 0.45 * smooth(b, b + 10, p) - 0.45 * smooth(c - 10, c, p);
    return 0.55 * (1 - smooth(c, DIVE.period, p));
  }
  const modelOf = (lane, o) => (o.buwaya ? buwayaModel(lane.len) : floaterModel(lane.type, lane.len));
  const bobOf = (lane, o, t) => Math.sin(t * 1.7 + o.k * 1.3 + lane.row) * 0.035;
  // The height Kokak stands at on a row, at x (rules units) and tick tt.
  function groundY(g, row, xu, tt, t) {
    if (row >= START) return WALK_Y;
    if (row === ISLAND) return ISLAND_Y;
    if (isRoad(row)) return ROAD_Y + (placeN === 1 ? 0.02 : 0);
    if (row === HOME) { for (const b of BAYS) if (Math.abs(xu - (b * CELL + CELL / 2)) < CELL * 0.6) return WATER_Y + 0.1; return BANK_Y; }
    const lane = g.lanes[row], o = lane && platformAt(g, row, xu, tt);
    if (!o) return WATER_Y - 0.25;
    const m = modelOf(lane, o);
    return WATER_Y + m.top - sinkOf(lane, o, tt) * (m.top + 0.4) + bobOf(lane, o, t);
  }

  // ---------- drawing the lanes ----------
  const tint = new THREE.Color();
  let beamRain = 0.5;
  function drawLanes(g, tt, t, o) {
    beamRain = g.def.rain;
    const carsK = look.cars;
    for (let r = 1; r <= 11; r++) {
      const lane = g.lanes[r]; if (!lane) continue;
      const Lu = lane.loop * CELL, z = wz(r), rot = lane.dir > 0 ? 0 : Math.PI, dz = lane.dir > 0 ? 1 : -1;
      for (const ob of objectsAt(lane, tt)) for (const shift of [-Lu, 0, Lu]) {
        const x0 = wx(ob.left + shift), x1 = wx(ob.right + shift);
        if (x1 < -VIS || x0 > VIS) continue;
        const cx = (x0 + x1) / 2;
        if (lane.kind === 'road') drawVehicle(lane, ob, cx, z, rot, dz, t, carsK, g);
        else drawFloater(lane, ob, cx, x0, z, rot, tt, t);
      }
    }
  }
  function drawVehicle(lane, ob, cx, z, rot, dz, t, carsK, g) {
    const m = vehicleModel(lane.type), ps = poolsFor('v:' + lane.type, m.parts, 40);
    const pal = PAINT[lane.type] || PAINT.taxi; tint.set(pal[(ob.k + lane.row * 3) % pal.length]);
    const bob = Math.sin(t * 9 + ob.k * 2 + lane.row) * 0.012 + (placeN === 1 ? 0.0 : 0);
    compose(m4, cx, ROAD_Y + bob, z, rot, 0, lane.type === 'motor' ? Math.sin(t * 2 + ob.k) * 0.03 : 0);
    for (const p of ps) p.pool.put(m4, p.slot === 'paint' ? tint : null);
    // wheels roll with the lane's speed
    const dist = (t * lane.speed * 60 * UM);
    for (const [wx0, wz0, r, w] of m.wheels) { compose(m5, wx0, r, wz0, 0, 0, -dist / r, r, r, w); m5.premultiply(m4); for (const p of wheel) p.pool.put(m5); }
    if (m.horse) { for (const [lx, lz, ph] of [[1.55, 0.2, 0], [1.55, -0.2, Math.PI], [0.85, 0.2, Math.PI], [0.85, -0.2, 0]]) { compose(m5, lx, 0.88, lz, 0, 0, Math.sin(t * 9 + ph + ob.k) * 0.45); m5.premultiply(m4); for (const p of legs) p.pool.put(m5); } }
    // the lamps: pools of light ahead, red glow behind, and their long reflections on the wet road
    const wetK = look.wet;
    for (const [hx, hy, hz] of m.head) {
      v.set(hx, 0, hz).applyMatrix4(m4);
      col.copy(HEADC).multiplyScalar(0.2 * carsK);
      compose(m5, v.x + dz * 2.2, ROAD_Y + 0.015, v.z, 0, 0, 0, 4.2, 1, 1.3); glowP.put(m5, col);
      col.copy(HEADC).multiplyScalar(0.5 * carsK * wetK); compose(m5, v.x + dz * 0.1, ROAD_Y + 0.02, v.z, 0, 0, 0, 0.28, 1, 2.6 * wetK + 0.4); streakP.put(m5, col);
      v.set(hx, hy, hz).applyMatrix4(m4); col.copy(HEADC).multiplyScalar(0.022 * carsK * (0.4 + beamRain)); compose(m5, v.x, v.y, v.z, rot, 0, -0.06); beamP.put(m5, col);
    }
    for (const [hx, hy, hz] of m.tail) {
      v.set(hx, 0, hz).applyMatrix4(m4);
      col.copy(TAILC).multiplyScalar(0.55 * carsK); compose(m5, v.x - dz * 0.5, ROAD_Y + 0.016, v.z, 0, 0, 0, 1.3, 1, 0.8); glowP.put(m5, col);
      col.copy(TAILC).multiplyScalar(0.7 * carsK * wetK); compose(m5, v.x - dz * 0.08, ROAD_Y + 0.02, v.z, 0, 0, 0, 0.2, 1, 2.2 * wetK + 0.3); streakP.put(m5, col);
    }
    if (m.lanterns) for (const [hx, , hz] of m.lanterns) { v.set(hx, 0, hz).applyMatrix4(m4); col.set(1, 0.7, 0.35).multiplyScalar(0.5 * carsK); compose(m5, v.x, ROAD_Y + 0.015, v.z, 0, 0, 0, 1.6, 1, 1.6); glowP.put(m5, col); }
    if (placeN === 1) { col.set(0.5, 0.45, 0.35); compose(m5, cx, ROAD_Y + 0.085, z, 0, 0, 0, m.len * 1.15, 1, 1.9); foamP.put(m5, col); } // pushing through the flood
  }
  function drawFloater(lane, ob, cx, x0, z, rot, tt, t) {
    const m = modelOf(lane, ob), key = ob.buwaya ? 'buwaya:' + lane.len : lane.type + ':' + lane.len;
    const ps = poolsFor('f:' + key, m.parts, m.unit ? 72 : 24);
    const s = sinkOf(lane, ob, tt), bob = bobOf(lane, ob, t);
    const y = WATER_Y + bob - s * (m.top + 0.55);
    const pal = PAINT[lane.type]; if (pal) tint.set(pal[(ob.k + lane.row) % pal.length]);
    // a diving thing wobbles just before it goes, so you can see it coming
    const p = mod(tt + ob.k * 83 + lane.row * 37, DIVE.period), warn = lane.dive.includes(ob.k) && p > DIVE.up - 45 && p < DIVE.up ? Math.sin(t * 30) * 0.05 : 0;
    const roll = (m.roll || 0) * Math.sin(t * 1.3 + ob.k), tilt = s > 0 && s < 1 ? s * 0.25 : 0;
    const n = m.unit ? lane.len : 1;
    for (let c = 0; c < n; c++) {
      const ux = m.unit ? x0 + (c + 0.5) * 2 : cx;
      const spin = m.spin ? Math.sin(t * 0.7 + c + ob.k) * m.spin : 0;
      compose(m4, ux, y, z, rot + spin, roll + warn, tilt * (c % 2 ? 1 : -1));
      for (const pp of ps) pp.pool.put(m4, pp.slot === 'paint' ? tint : null);
      if (lane.type === 'pagong' && !ob.buwaya) for (const [fx0, fz0, ph] of [[0.45, 0.55, 0], [0.45, -0.55, Math.PI], [-0.45, 0.5, Math.PI], [-0.45, -0.5, 0]]) {
        compose(m5, fx0, 0.0, fz0, (fz0 > 0 ? -0.5 : 0.5) + Math.sin(t * 5 + ph + c) * 0.5 * (fz0 > 0 ? 1 : -1) + (fx0 < 0 ? Math.PI : 0), 0, 0); m5.premultiply(m4);
        for (const pp of flip) pp.pool.put(m5);
      }
    }
    if (ob.buwaya) { // the jaw snaps now and then
      const open = 0.08 + 0.5 * Math.pow(Math.max(0, Math.sin(t * 1.9 + ob.k)), 6);
      compose(m5, (lane.len * 2 - 0.3) / 2 - 1.35, 0.02, 0, 0, 0, open); m5.premultiply(m4);
      for (const pp of jaw) pp.pool.put(m5);
    }
    // foam at the waterline, a wake behind
    if (s < 0.95) {
      col.set(0.34, 0.4, 0.4).multiplyScalar(1 - s * 0.7);
      compose(m5, cx, WATER_Y + 0.012, z, 0, 0, 0, lane.len * 2 + 0.3, 1, 2.0); foamP.put(m5, col);
    } else { col.set(0.2, 0.24, 0.26); compose(m5, cx, WATER_Y + 0.012, z, 0, 0, 0, lane.len * 1.6, 1, 1.4 + Math.sin(t * 6) * 0.2); foamP.put(m5, col); if (Math.random() < 0.15) fx.emit(cx + (Math.random() - 0.5) * lane.len * 1.6, WATER_Y + 0.02, z + (Math.random() - 0.5), '#a8c8d8', 1, { speed: 0.1, up: 0.8, life: 0.4, size: 0.07, g: 0 }); }
  }

  // the streetlamps' light on the road and in the water
  function drawLamps(t) {
    const k = look.lamps;
    for (const L of world.lamps) {
      if (Math.abs(L.x) > HALF + 1) for (const bz of [-2.72, 1.28]) { col.copy(LAMPC).multiplyScalar(0.011 * k * (0.4 + beamRain)); compose(m4, L.x, 7.95, bz, 0); lampBeamP.put(m4, col); }
      col.copy(LAMPC).multiplyScalar(0.16 * k); compose(m4, L.x, ROAD_Y + 0.012, 2.4, 0, 0, 0, 7, 1, 5); glowP.put(m4, col);
      col.copy(LAMPC).multiplyScalar(0.45 * k); compose(m4, L.x, ROAD_Y + 0.018, 1.4, 0, 0, 0, 0.5, 1, 6 * look.wet); streakP.put(m4, col);
      if (Math.abs(L.x) > HALF + 1) { col.copy(LAMPC).multiplyScalar(0.5 * k); compose(m4, L.x + Math.sin(t * 2 + L.x) * 0.06, WATER_Y + 0.02, -2.6, 0, 0, 0, 0.6, 1, 5.5); streakP.put(m4, col); }
    }
  }

  // the leaves, the family, the lamok, the buwaya in a leaf, the ahas, the lost anak
  function drawHome(g, tt, t, o) {
    BAYS.forEach((b, i) => {
      const x = wx(b * CELL + CELL / 2), z = wz(HOME);
      compose(m4, x, WATER_Y + 0.05 + Math.sin(t * 1.2 + i) * 0.02, z, 0.4 * Math.sin(i * 7) + Math.PI, 0, 0); for (const p of padP) p.pool.put(m4);
      if (g.homes[i]) {
        const hop = homePop[i] > 0 ? Math.sin((1 - homePop[i]) * Math.PI) * 0.8 : 0, breath = o.reduced ? 0 : Math.sin(t * 3 + i) * 0.02;
        compose(m4, x, WATER_Y + 0.12 + hop, z, -HP + Math.sin(t * 0.5 + i) * 0.3, 0, 0, 0.62, 0.62 * (1 + breath), 0.62);
        for (const p of family) p.pool.put(m4, p.slot === 'skin' ? FAMILY[i] : null);
      }
      if (g.lamok && g.lamok.bay === i) {
        const lx = x + Math.cos(t * 5.1) * 0.5, ly = 0.5 + Math.sin(t * 7.3) * 0.18, lz = z + Math.sin(t * 6.2) * 0.4;
        compose(m4, lx, ly, lz, t * 5, 0, 0, 2.2, 2.2, 2.2); for (const p of lamokP) p.pool.put(m4);
        for (const s of [-1, 1]) { compose(m5, -0.02, 0.05, 0, 0, s * (0.3 + Math.sin(t * 90) * 0.5), 0); m5.premultiply(m4); for (const p of wingP) p.pool.put(m5); }
        col.set(1, 0.9, 0.5).multiplyScalar(0.25 + Math.sin(t * 8) * 0.08); compose(m4, lx, WATER_Y + 0.06, lz, 0, 0, 0, 1.3, 1, 1.3); glowP.put(m4, col);
      }
      if (g.buwaya && g.buwaya.bay === i) {
        const warn = g.buwaya.t > BAY_BUWAYA.stay, rise = warn ? -0.16 : 0.1, open = warn ? 0 : 0.35 + Math.abs(Math.sin(t * 6)) * 0.35;
        compose(m4, x, WATER_Y + rise, z - 0.9, -HP, 0, 0, 1.2, 1.2, 1.2);
        compose(m5, 0, 0, 0, 0, 0, open); m5.premultiply(m4); for (const p of jaw) p.pool.put(m5);
        if (!warn) { col.set(0.6, 0.1, 0.05); compose(m5, x, WATER_Y + 0.02, z, 0, 0, 0, 2.2, 1, 2.2); glowP.put(m5, col); }
      }
    });
    // the ahas on the island, head first, its body swinging behind
    if (g.snake) {
      const sx = snakeX(g, tt), sn = snakeX(g, tt + 1), dir = sn >= sx ? 1 : -1, hx = wx(sx) + dir * 1.4, z = wz(ISLAND);
      for (let s = 0; s < 18; s++) {
        const bx = hx - dir * (0.25 + s * 0.17), bz = z + Math.sin(bx * 2.2 - t * 7 * dir) * 0.3 * Math.min(1, s / 3), sc = 1 - Math.max(0, s - 12) * 0.12;
        compose(m4, bx, ISLAND_Y + 0.13 * sc, bz, 0, 0, 0, 1.1 * sc, 0.85 * sc, sc); for (const p of segP) p.pool.put(m4);
      }
      compose(m4, hx, ISLAND_Y + 0.14, z + Math.sin(hx * 2.2 - t * 7 * dir) * 0.08, dir > 0 ? 0 : Math.PI); for (const p of snakeP) p.pool.put(m4);
    }
    if (g.anak) {
      const ax = wx(anakX(g, tt)), row = g.anak.row, y = groundY(g, row, anakX(g, tt), tt, t);
      const hop = o.reduced ? 0 : Math.max(0, Math.sin(t * 5)) * 0.25;
      compose(m4, ax, y + hop, wz(row), -HP + Math.sin(t * 2) * 0.4, 0, 0, 0.42, 0.42, 0.42); for (const p of family) p.pool.put(m4, col2.set('#b8f08a'));
    }
  }
  const homePop = [0, 0, 0, 0, 0];

  // ---------- Kokak ----------
  const fs = { land: 9, x: 0, y: 0, z: 0, yaw: HP, deadT: 0, pop: 0, lastHop: null, riding: 0 };
  function frogWorld(g, alpha, tt, t) {
    const f = g.frog;
    if (f.hop) {
      const k = clamp((f.hop.t + alpha) / HOP, 0, 1);
      const xu = f.hop.fx + (f.hop.tx - f.hop.fx) * k, row = f.hop.frow + (f.hop.trow - f.hop.frow) * k;
      const y0 = groundY(g, f.hop.frow, f.hop.fx, tt, t), y1 = groundY(g, f.hop.trow, f.hop.tx, tt + (HOP - f.hop.t), t);
      return { x: wx(xu), z: wz(row), y: lerp(y0, y1, k) + Math.sin(k * Math.PI) * (0.55 + Math.max(0, y0 - y1) * 0.3), k };
    }
    let xu = f.x;
    if (isWater(f.row) && g.phase === 'play') { const o = platformAt(g, f.row, f.x, g.tick); if (o && o.sub !== 2) xu += g.lanes[f.row].dir * g.lanes[f.row].speed * alpha; }
    return { x: wx(xu), z: wz(f.row), y: groundY(g, f.row, xu, tt, t), k: -1 };
  }
  // what Kokak's eyes follow: the nearest thing coming at him in his row or the next
  function lookFor(g, fw, tt) {
    const f = g.frog; let best = null, bd = 9;
    for (const r of [f.row - 1, f.row]) {
      const lane = g.lanes[r]; if (!lane || lane.kind !== 'road') continue;
      for (const o of objectsAt(lane, tt)) { const cx = wx((o.left + o.right) / 2), dx = cx - fw.x; if (Math.sign(-dx) === lane.dir && Math.abs(dx) < bd) { bd = Math.abs(dx); best = [cx, wz(r)]; } }
    }
    if (!best) return null;
    const yaw = Math.atan2(-(best[1] - fw.z), best[0] - fw.x) - fs.yaw;
    return [Math.atan2(Math.sin(yaw), Math.cos(yaw)), 0];
  }
  const DEATH = { tubig: 'sink', anod: 'sink', buwaya: 'bite', ahas: 'squeeze', pilapil: 'bonk', oras: 'sleep' };
  function drawKokak(g, alpha, tt, t, dt, o) {
    const f = g.frog, show = g.phase !== 'over' && g.phase !== 'clear' && !(o.hideFrog);
    kokak.root.visible = show; carried.root.visible = false;
    if (!show) return;
    const fw = frogWorld(g, alpha, tt, t);
    if (fw.k < 0 && fs.lastHop) { fs.land = 0; fs.lastHop = null; }
    if (fw.k >= 0) fs.lastHop = true;
    fs.land += dt;
    const want = YAW[f.dir];
    fs.yaw += Math.atan2(Math.sin(want - fs.yaw), Math.cos(want - fs.yaw)) * Math.min(1, dt * 26);
    let y = fw.y, dead = null, sc = 1;
    if (g.phase === 'dying') {
      fs.deadT = 1 - g.phaseT / 72;
      dead = DEATH[f.dead] || 'flat';
      if (dead === 'sink') y = lerp(fw.y, WATER_Y - 1.1, smooth(0.05, 0.7, fs.deadT));
      if (dead === 'bite') { y += Math.sin(fs.deadT * Math.PI) * 0.8; sc = 1 - smooth(0.3, 0.8, fs.deadT); }
      if (dead === 'flat') y = Math.max(ROAD_Y, fw.y);
    } else fs.deadT = 0;
    fs.pop = Math.max(0, fs.pop - dt * 3);
    sc *= 1 - fs.pop * fs.pop;
    kokak.root.position.set(fw.x, y, fw.z);
    kokak.root.rotation.y = fs.yaw + (dead === 'sink' ? Math.sin(t * 8) * 0.3 : 0);
    kokak.root.scale.setScalar(Math.max(0.001, sc));
    kokak.pose({ hop: fw.k, land: fs.land, dt, reduced: o.reduced, look: g.phase === 'play' ? lookFor(g, fw, tt) : null, dead, deadT: fs.deadT });
    fs.x = fw.x; fs.y = y; fs.z = fw.z;
    if (f.carry && g.phase === 'play') {
      carried.root.visible = true; carried.root.position.set(fw.x - Math.cos(fs.yaw) * 0.25, y + 0.62, fw.z + Math.sin(fs.yaw) * 0.25); carried.root.rotation.y = fs.yaw;
      carried.pose({ hop: fw.k, land: fs.land, dt, reduced: o.reduced });
    }
    // Kokak's own soft light pool, so he always reads against the dark
    col.set(0.16, 0.24, 0.14); compose(m4, fw.x, Math.max(fw.y, WATER_Y) + 0.02, fw.z, 0, 0, 0, 2.4, 1, 2.4); glowP.put(m4, col);
  }

  // ---------- the camera ----------
  const cam = { tx: 0, tz: 4, dist: 40, pitch: 0.98, shake: 0, punch: 0, px: 0, pz: 0, flash: 0, split: 0, intro: 0, introDur: 0, sway: 0, zoom: 1 };
  const target = new THREE.Vector3(), camPos = new THREE.Vector3(), lookAt = new THREE.Vector3();
  const pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let W = 1, H = 1;
  function margins() { return { mx: 0.02, mt: W < H ? 0.16 : 0.2, mb: touch && W < H ? 0.64 : W < H ? 0.24 : 0.12 }; }
  function setOffset() {
    const { mt, mb } = margins(), cy = (mb - mt) / 2;
    camera.setViewOffset(W, H, 0, (-cy * H) / 2, W, H);
  }
  // The distance that fits the given ground points inside the screen's margins, looking from pitch.
  function fitDistance(tgt, pitch, P) {
    const { mx, mt, mb } = margins();
    let lo = 4, hi = 260;
    for (let i = 0; i < 22; i++) {
      const d = (lo + hi) / 2;
      camera.position.set(tgt.x, tgt.y + Math.sin(pitch) * d, tgt.z + Math.cos(pitch) * d); camera.lookAt(tgt); camera.updateMatrixWorld(true);
      let ok = true;
      for (const p of P) { v.copy(p).project(camera); if (v.z > 1 || Math.abs(v.x) > 1 - mx || v.y > 1 - mt || v.y < -1 + mb) { ok = false; break; } }
      if (ok) hi = d; else lo = d;
    }
    return hi;
  }
  // the board framing: the whole width, and the rows around Kokak (all of them in 'board' mode)
  function framing(g, mode, fz) {
    const aspect = W / H, pitch = aspect < 1 ? 1.0 : 0.76;
    const frogRow = (fz / 2) + 6;
    let r0 = -0.7, r1 = 12.7;
    if (mode !== 'board') { r0 = Math.max(-0.7, frogRow - 5.2); r1 = Math.min(12.7, r0 + 10.6); r0 = Math.min(r0, r1 - 10.6); }
    const z0 = (r0 - 6) * 2, z1 = (r1 - 6) * 2, xw = HALF + 0.6;
    pts[0].set(-xw, 0, z0); pts[1].set(xw, 0, z0); pts[2].set(-xw, 0, z1); pts[3].set(xw, 0, z1); pts[4].set(-xw, 1.2, z1 - 0.6); pts[5].set(xw, 1.2, z1 - 0.6);
    const tz = (z0 + z1) / 2, tgt = target.set(0, 0, tz);
    return { tgt: tgt.clone(), pitch, dist: fitDistance(tgt, pitch, pts) };
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.fov = W < H ? 40 : 38; camera.updateProjectionMatrix(); setOffset();
    post.resize(); fx.setScale(H * renderer.getPixelRatio());
  }

  // ---------- events ----------
  const WATERY = new Set(['tubig', 'anod']);
  function event(e, g, { quiet = false } = {}) {
    const x = fs.x, y = fs.y, z = fs.z;
    switch (e.type) {
      case 'hop': if (isWater(e.row)) fx.emit(x, WATER_Y + 0.1, z, '#bcd8e8', 6, { speed: 1.2, up: 1.5, life: 0.4, size: 0.08 }); break;
      case 'land': {
        fs.land = 0; fs.lastHop = null;
        if (e.water) { fx.emit(x, y + 0.05, z, '#cfe4f0', 12, { speed: 2, up: 2.4, life: 0.5, size: 0.09, floor: WATER_Y }); ripple(x, WATER_Y + 0.02, z, 1); }
        else if (e.row === HOME) ripple(x, WATER_Y + 0.02, z, 1.2);
        else if (placeN === 1 && (isRoad(e.row) || e.row === START)) ripple(x, ROAD_Y + 0.09, z, 0.8);
        else if (isRoad(e.row) || e.row === START) fx.emit(x, y + 0.05, z, placeN === 1 ? '#c8b89a' : '#b8c4d0', placeN === 1 ? 14 : 6, { speed: 1.6, up: 1.8, life: 0.4, size: 0.07, floor: y });
        break;
      }
      case 'home': {
        const bx = wx(BAYS[e.bay] * CELL + CELL / 2), bz = wz(HOME);
        homePop[e.bay] = 1;
        fx.emit(bx, WATER_Y + 0.6, bz, '#7cf29a', 26, { speed: 3, up: 3, life: 0.9, size: 0.16, g: 5 });
        fx.emit(bx, WATER_Y + 0.6, bz, '#ffd23f', 14, { speed: 2.4, up: 3.5, life: 1.0, size: 0.12, g: 4 });
        fx.say(`KOKAK! +${e.points}`, bx, WATER_Y + 1.4, bz, { cls: 'big' });
        if (e.lamok) fx.say('Sarap ng lamok! +200', bx, WATER_Y + 2.2, bz, { cls: 'gold', life: 1.6 });
        if (e.anak) fx.say('Salamat, Kuya! +200', bx, WATER_Y + 2.9, bz, { cls: 'blue', life: 1.7 });
        pulse.position.set(bx, 1.2, bz); pulse.color.set('#7cf29a'); pulseT = 1;
        cam.punch = Math.max(cam.punch, 0.25); cam.px = bx; cam.pz = bz;
        fs.pop = 1; // the next Kokak pops in at the start
        break;
      }
      case 'died': {
        const water = WATERY.has(e.cause) || isWater(e.row);
        if (water) { fx.emit(x, WATER_Y + 0.2, z, '#d8ecf8', 30, { speed: 2.6, up: 4, life: 0.8, size: 0.12, floor: WATER_Y }); ripple(x, WATER_Y + 0.02, z, 1.6); setTimeout(() => ripple(x, WATER_Y + 0.02, z, 1.1), 250); }
        else { fx.emit(x, y + 0.5, z, '#ffd23f', 18, { speed: 4, up: 3, life: 0.6, size: 0.14 }); fx.emit(x, y + 0.5, z, '#ffffff', 10, { speed: 5, up: 2, life: 0.35, size: 0.2 }); cam.flash = 0.8; cam.shake = 0.5; }
        if (e.cause === 'buwaya' || e.cause === 'ahas') { cam.flash = 0.6; cam.shake = 0.3; }
        pulse.position.set(x, y + 1, z); pulse.color.set(water ? '#8ac8ff' : '#ff6a4a'); pulseT = 1;
        cam.punch = 1; cam.px = x; cam.pz = z; waveT = 2.2;
        if (quiet) { cam.flash = 0; cam.shake = 0; cam.punch = 0; }
        break;
      }
      case 'levelClear': for (let k = 0; k < 5; k++) setTimeout(() => firework(), k * 260); if (!quiet) cam.flash = 0.4; break;
      case 'anakAboard': fx.emit(x, y + 0.8, z, '#9ad7ff', 14, { speed: 2, up: 2, life: 0.6, size: 0.12 }); fx.say('Sakay na, bunso!', x, y + 1.6, z, { cls: 'blue' }); break;
      case 'anak': if (g.anak) fx.say('Kuya! Tulong!', wx(anakX(g, g.tick)), WATER_Y + 1.4, wz(g.anak.row), { cls: 'blue', life: 1.6 }); break;
      case 'lamok': fx.say('Bzzz!', wx(BAYS[e.bay] * CELL + CELL / 2), 1.2, wz(HOME), { cls: 'gold' }); break;
      case 'buwayaPeek': fx.say('?!', wx(BAYS[e.bay] * CELL + CELL / 2), 1.2, wz(HOME), { cls: 'red' }); break;
      case 'extraLife': fx.say('EXTRA BUHAY!', x, y + 1.8, z, { cls: 'big', life: 1.8 }); break;
      case 'respawn': fs.pop = 1; break;
      default: break;
    }
  }
  let pulseT = 0;
  function firework() {
    const x = (Math.random() - 0.5) * 30, y = 12 + Math.random() * 8, z = -22 - Math.random() * 10, c = ['#ffd23f', '#ff5ab0', '#7cf29a', '#40d0ff', '#ff8a3a'][Math.floor(Math.random() * 5)];
    fx.emit(x, y, z, c, 60, { speed: 7, up: 0.5, life: 1.4, size: 0.45, g: 3, spread: 1, drag: 0.96 });
    fx.emit(x, y, z, '#ffffff', 16, { speed: 3, up: 0.2, life: 0.5, size: 0.6, g: 1 });
  }

  // A level's establishing shot: from street level beside EDSA, up and over to the board.
  function intro(g, dur = 2.6) { waveT = dur + 1; cam.intro = dur; cam.introDur = dur; setPlace((g.level - 1) % 4); return dur; }
  function skipIntro() { cam.intro = 0; }

  // ---------- each frame ----------
  let clock = 0;
  function frame(g, dt0, o = {}) {
    const dt = clamp(dt0 || 0, 0, 0.1);
    clock += dt;
    const t = clock;
    // follow the film look's level (it steps down by itself on slow devices): shadows and resolution with it
    if (post.level !== level) {
      level = post.level; renderer.shadowMap.enabled = level > 0; sun.castShadow = level > 0;
      scene.traverse((m) => { if (m.material) for (const x of [].concat(m.material)) x.needsUpdate = true; });
      resize();
    }
    setPlace(g.def.n - 1);
    if (debug.introAt != null) cam.intro = debug.introAt;
    const introing = cam.intro > 0;
    if (introing) cam.intro = Math.max(0, cam.intro - dt);
    const alpha = g.phase === 'play' || g.phase === 'ready' || g.phase === 'dying' ? clamp(g.acc / TICK, 0, 1) : 0;
    // during the flyover the traffic runs toward tick 0, where the game begins
    const tt = g.tick + alpha - (introing ? cam.intro * 60 : 0);
    // the current in each water row, for the water's ripples and foam (m/s)
    const vel = [0, 0, 0, 0, 0, 0, 0];
    for (let r = 1; r <= 5; r++) if (g.lanes[r]) vel[r] = g.lanes[r].dir * g.lanes[r].speed * 60 * UM;
    updateWater(world.water, t, look.wet * g.def.rain + 0.2, vel);
    updateWater(world.flood, t, 1, null);
    world.update(t, dt);
    hemi.intensity = look.hemi[2] * (scene.environment ? 1 : 2.4); // until the photographed sky lights the place
    // draw
    drawLanes(g, tt, t, o); drawLamps(t); drawHome(g, tt, t, o);
    for (let i = 0; i < 5; i++) homePop[i] = Math.max(0, homePop[i] - dt * 2.5);
    drawKokak(g, alpha, tt, t, dt, o);
    for (const p of allPools()) p.end();
    for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.t += dt; if (r.t > 0.9) { ripples.splice(i, 1); continue; } const k2 = r.t / 0.9, s2 = (0.4 + k2 * 2.2) * r.size; col.setScalar(0.5 * (1 - k2) * (1 - k2)); compose(m4, r.x, r.y, r.z, 0, 0, 0, s2, 1, s2); rippleP.put(m4, col); }
    glowP.end(); streakP.end(); foamP.end(); beamP.end(); lampBeamP.end(); rippleP.end();
    pulseT = Math.max(0, pulseT - dt * 2.2); pulse.intensity = pulseT * pulseT * 40;
    waveT = Math.max(0, waveT - dt);
    arm.rotation.x = waveT > 0 ? 0.4 + Math.sin(t * 9) * 0.4 : Math.PI - 0.1 + Math.sin(t * 0.8) * 0.04;
    enforcer.rotation.y = -0.5 + Math.sin(t * 0.3) * 0.25;

    // the camera
    const mode = o.mode || 'play';
    const fr = framing(g, o.camMode === 'board' ? 'board' : 'cine', mode === 'play' ? fs.z : 4);
    let px, py, pz, lx, ly, lz;
    const k = Math.min(1, dt * 3.2);
    if (mode === 'title' || mode === 'over') {
      // the menus: a slow drift along EDSA at a low, cinematic angle
      const a = t * 0.05;
      px = Math.sin(a) * 8; py = mode === 'over' ? 14 : 10.5 + Math.sin(a * 1.3) * 1.2; pz = 25 + Math.cos(a * 0.7) * 2;
      lx = Math.sin(a) * 3; ly = mode === 'over' ? 1 : 3.2; lz = mode === 'over' ? -4 : -9;
      cam.tx = lerp(cam.tx, lx, k); cam.tz = lerp(cam.tz, lz, k);
      const kk = o.snap ? 1 : k; camPos.lerp(v.set(px, py, pz), kk); lookAt.lerp(v.set(lx, ly, lz), kk);
    } else if (mode === 'clear') {
      // the family photo: in on the leaves
      camPos.lerp(v.set(Math.sin(t * 0.15) * 2, 8.5, 2.5), Math.min(1, dt * (o.snap ? 60 : 1.6))); lookAt.lerp(v.set(0, -1.2, -11), Math.min(1, dt * (o.snap ? 60 : 2)));
    } else {
      const d = fr.dist * (1 - cam.punch * (o.reduced ? 0 : 0.34));
      const tgt = fr.tgt.clone();
      if (cam.punch > 0 && !o.reduced) { tgt.x = lerp(tgt.x, cam.px, cam.punch * 0.5); tgt.z = lerp(tgt.z, cam.pz, cam.punch * 0.45); }
      if (!o.reduced && o.camMode !== 'board') { tgt.x += clamp(fs.x * 0.08, -1.2, 1.2); tgt.x += Math.sin(t * 0.4) * 0.15; tgt.z += Math.sin(t * 0.33) * 0.1; }
      const goal = v.set(tgt.x, tgt.y + Math.sin(fr.pitch) * d, tgt.z + Math.cos(fr.pitch) * d);
      if (introing) {
        // up from the kerb beside the jeepneys, over the footbridge, onto the board
        const u = 1 - cam.intro / cam.introDur, e = u * u * (3 - 2 * u);
        const a0 = new THREE.Vector3(25, 3.2, 12.6), l0 = new THREE.Vector3(0, 2.4, 1), mid = new THREE.Vector3(14, 13, 22);
        const p1 = a0.clone().lerp(mid, e).lerp(goal, e * e), l1 = l0.clone().lerp(tgt, e);
        camPos.copy(p1); lookAt.copy(l1);
      } else if (mode === 'intro0') { camPos.copy(goal); lookAt.copy(tgt); }
      else { const kk = Math.min(1, dt * (cam.punch > 0.5 ? 9 : 3)); camPos.lerp(goal, kk); lookAt.lerp(tgt, kk); }
    }
    if (o.snap && !introing && mode === 'play') { camPos.copy(v.set(fr.tgt.x, Math.sin(fr.pitch) * fr.dist, fr.tgt.z + Math.cos(fr.pitch) * fr.dist)); lookAt.copy(fr.tgt); }
    cam.punch = Math.max(0, cam.punch - dt * (cam.punch > 0.6 ? 0.9 : 1.8));
    camera.position.copy(camPos);
    const sh = cam.shake > 0 && !o.reduced ? cam.shake : 0;
    cam.shake = Math.max(0, cam.shake - dt * 1.6);
    camera.position.x += (Math.random() - 0.5) * sh * 0.5; camera.position.y += (Math.random() - 0.5) * sh * 0.5;
    camera.lookAt(lookAt);
    if (debug.cam) { camera.position.set(...debug.cam.slice(0, 3)); camera.lookAt(...debug.cam.slice(3, 6)); }
    // the sun's shadow follows the view
    sun.target.position.set(lookAt.x, 0, lookAt.z); sun.position.copy(sun.target.position).add(v.set(Math.cos(look.sun[2]) * Math.sin(look.sun[3]) * 60, Math.sin(look.sun[2]) * 60, Math.cos(look.sun[2]) * Math.cos(look.sun[3]) * 60));
    sky.position.copy(camera.position);
    // the haze starts past the board, however far the camera stands
    const cd = camera.position.distanceTo(lookAt);
    scene.fog.near = cd + look.fog[1] - 30; scene.fog.far = cd + look.fog[2] - 30;
    fx.update(dt, t, camera, { rain: g.def.rain, center: v.set(lookAt.x, 0, lookAt.z + 2), reduced: o.reduced, flood: placeN === 1 ? 1 : 0, rainColor: look.rainC });
    cam.flash = Math.max(0, cam.flash - dt * 3);
    post.render(dt, { flash: o.reduced ? 0 : cam.flash * 0.5, split: o.reduced ? 0 : cam.flash * 0.9, bloomBoost: placeN === 3 ? 0.1 : 0 });
  }

  const debug = { cam: null, introAt: null };
  resize();
  return { debug, frame, event, resize, intro, skipIntro, setEnv, post, renderer, scene, camera, cam, get introLeft() { return cam.intro; }, fx, setPlace, kokakPos: fs };
}
