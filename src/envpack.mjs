// Real surroundings: CC0 scans from Poly Haven, converted by the Bakbakan tools (assets/env/). A
// photographed sky per place lights and reflects everything and is seen behind the city; scanned asphalt,
// pavers, concrete, mud, grass, bark and bamboo replace the painted surfaces. Without the files, the
// painted place stays as it is.
import * as THREE from './vendor/three.module.min.js';
import { HDRLoader } from './vendor/three-fx.min.js';

// what each tagged surface becomes: [Poly Haven material, metres a tile covers]
const SURF = { asphalt: ['asphalt_02', 3.2], pavers: ['concrete_pavers', 1.6], concrete: ['concrete_floor_worn_001', 2.5], mud: ['mud_forest', 3], grass: ['leafy_grass', 3] };
export const SKY = ['belfast_sunset_puresky', 'kloofendal_28d_misty_puresky', 'qwantani_sunset_puresky', 'qwantani_night_puresky'];

export async function loadEnv(base = 'assets/env/') {
  const res = await fetch(base + 'env.json');
  if (!res.ok) throw new Error('no env');
  return { base, index: await res.json(), tex: new Map(), sky: new Map(), bg: new Map() };
}

const texLoader = new THREE.TextureLoader();
export function loadTex(env, id) {
  const t = env.index.tex[id];
  if (!t) return Promise.resolve(null);
  if (!env.tex.has(id)) env.tex.set(id, Promise.all(['diff', 'nor', 'arm'].map((k) => (t[k] ? texLoader.loadAsync(env.base + t[k]).catch(() => null) : null))).then(([diff, nor, arm]) => {
    if (diff) diff.colorSpace = THREE.SRGBColorSpace;
    for (const x of [diff, nor, arm]) if (x) { x.wrapS = x.wrapT = THREE.RepeatWrapping; x.anisotropy = 8; }
    return { diff, nor, arm };
  }));
  return env.tex.get(id);
}
export function loadSky(env, id, pmrem) {
  if (!env.index.sky[id]) return Promise.resolve(null);
  if (!env.sky.has(id)) env.sky.set(id, new HDRLoader().loadAsync(env.base + env.index.sky[id]).then((t) => { t.mapping = THREE.EquirectangularReflectionMapping; const rt = pmrem.fromEquirectangular(t); t.dispose(); return rt.texture; }).catch(() => null));
  return env.sky.get(id);
}
export function loadBackdrop(env, id) {
  const f = env.index.backdrop && env.index.backdrop[id];
  if (!f) return Promise.resolve(null);
  if (!env.bg.has(id)) env.bg.set(id, texLoader.loadAsync(env.base + f).then((t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }).catch(() => null));
  return env.bg.get(id);
}

// The scanned surfaces, put on every tagged material under root. onProgress(fraction) as they arrive.
export async function dressSurfaces(env, root, onProgress = null) {
  const mats = new Map();
  root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.userData.surface) mats.set(m, m.userData.surface); });
  let done = 0;
  await Promise.all([...mats].map(async ([m, s]) => {
    const [id, tile] = SURF[s.kind] || [];
    const t = id && (await loadTex(env, id));
    done++; if (onProgress) onProgress(done / mats.size);
    if (!t || !t.diff) return;
    const rep = [s.w / tile, s.h / tile], use = (x) => { if (!x) return null; const c = x.clone(); c.repeat.set(...rep); c.needsUpdate = true; return c; };
    m.map = use(t.diff); m.normalMap = use(t.nor); m.normalScale = new THREE.Vector2(1, 1);
    if (t.arm) { m.roughnessMap = use(t.arm); m.aoMap = use(t.arm); m.aoMapIntensity = 0.7; }
    m.color.set(s.tint || '#ffffff'); m.roughness = 1;
    m.needsUpdate = true;
  }));
}

// Real props where a street and an estero bank would have them: [prop, x, y, z, turn, scale]. None stands
// on a row Kokak crosses: they dress the sidewalk's back edge, the ends of the median and the far bank.
const PROPS = [
  ['utility_box_02', -9, 0.16, 17.6, Math.PI, 1], ['WetFloorSign_01', 13.4, 0.16, 14.1, 0.6, 1.4], ['trashbag', 22.6, 0.16, 14.6, 0.3, 1], ['trashbag', 23.2, 0.16, 15.1, 1.7, 0.9],
  ['cardboard_box_01', 23.9, 0.16, 14.5, 0.4, 1.1], ['plastic_crate_02', -24, 0.16, 16.5, 0.2, 1.2], ['plastic_crate_02', -24.1, 0.42, 16.5, -0.1, 1.2],
  ['concrete_road_barrier', 16.6, 0.22, 0, Math.PI / 2, 1.1], ['concrete_road_barrier', -16.6, 0.22, 0, Math.PI / 2, 1.1],
  ['old_tyre', -8.4, 0.08, -14.6, 1.2, 1.2], ['plastic_jerrycan', 4.6, 0.08, -14.9, 0.7, 1.3], ['trashbag', 9.2, 0.08, -15.3, 0.9, 1.1], ['plastic_crate_02', -3.6, 0.08, -16.2, 0.5, 1.2],
  ['rock_moss_set_01~2', -15.8, -0.3, -13.8, 0.4, 0.9], ['rock_moss_set_01~2', 15.4, -0.3, -14.2, 2.1, 0.8],
  ['fern_02~0', -10.2, 0.08, -14.4, 0.3, 1.4], ['fern_02~1', -1.8, 0.08, -14.5, 1.3, 1.4], ['fern_02~0', 7.8, 0.08, -14.3, 2.2, 1.3], ['fern_02~1', 13.6, 0.08, -14.6, 0.8, 1.4],
  ['shrub_02~0', -20, 0.08, -15.6, 0.2, 0.9], ['shrub_02~1', 20.5, 0.08, -15.4, 1.4, 0.9], ['shrub_02~0', 0.8, 0.08, -16.4, 2.4, 0.8],
];
export async function dressProps(env, parent) {
  const { GLTFLoader } = await import('./vendor/three-mocap.min.js');
  const loader = new GLTFLoader(), cache = new Map(), group = new THREE.Group(); group.name = 'real props';
  await Promise.all(PROPS.map(async ([id, x, y, z, ry, s]) => {
    if (!env.index.props[id]) return;
    if (!cache.has(id)) cache.set(id, loader.loadAsync(env.base + 'props/' + id + '.glb').then((g) => g.scene).catch(() => null));
    const tpl = await cache.get(id);
    if (!tpl) return;
    const o = tpl.clone(); o.position.set(x, y, z); o.rotation.y = ry; o.scale.setScalar(s);
    o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    group.add(o);
  }));
  parent.add(group);
  return group;
}
