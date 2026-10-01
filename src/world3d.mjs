// The place around the board, built in code: rainy EDSA with its wet asphalt, lane paint and puddles, the
// median with its lamps, the sidewalk and its signs, the estero between concrete walls, the pilapil and the
// gabi on the far bank, shanties along the water, the elevated railway, the skyline and its billboards, a
// footbridge (Manong Enforcer's post) and a bridge over the estero at either end. Four places share the
// street and dress it their own way: Cubao at dusk under the MRT, España in the flood, Quiapo by the Pasig
// with its church, Maynila at night under the LRT with neon. Scanned surfaces (envpack.mjs) replace the
// painted ones once they load.
import * as THREE from './vendor/three.module.min.js';
import { Kit, lamp, matrix, mergeGeometries } from './kit.mjs';
import { gabiLeafGeo } from './models3d.mjs';
import { waterMaterial } from './water3d.mjs';
import { HALF, wz, ROAD_Y, WALK_Y, ISLAND_Y, WATER_Y, BANK_Y } from './space.mjs';
import { BAYS } from './game.mjs';

const TAU = Math.PI * 2, HP = Math.PI / 2;
const X0 = -70, X1 = 70, XW = X1 - X0; // how far the street runs east and west
let rs = 20260930;
const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const pick = (a) => a[Math.floor(rnd() * a.length)];

// Every ground material shares the rain: puddles gather (glossy, dark, still), the rest is damp.
export const WET = { wet: { value: 0.6 }, puddleMap: { value: null }, wetTime: { value: 0 } };
function wetify(m, { puddles = true, scale = 0.05 } = {}) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, WET);
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWPos;\nuniform float wet, wetTime; uniform sampler2D puddleMap;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  float pud = ${puddles ? `smoothstep(0.56, 0.66, texture2D(puddleMap, vWPos.xz * ${scale.toFixed(3)}).r) * smoothstep(0.2, 0.8, wet)` : '0.0'};
  diffuseColor.rgb *= mix(1.0 - wet * 0.32, 0.42, pud);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor * (1.0 - wet * 0.45), 0.03, pud);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  normal = normalize(mix(normal, nonPerturbedNormal, pud * 0.9));`);
  };
  m.customProgramCacheKey = () => 'wet' + (puddles ? 'p' : '') + scale;
  return m;
}

// A tag the scanned-material loader reads: which scan covers this, over how many metres.
const tag = (m, kind, w, h) => { m.userData.surface = { kind, w, h }; return m; };
function plane(w, h, m, { x = 0, y = 0, z = 0, rx = -HP, ry = 0, receive = true } = {}) {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.receiveShadow = receive;
  return o;
}
const mesh = (geo, m, cast = true, receive = true) => { const o = new THREE.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = receive; return o; };

export function buildWorld({ scene, T, tex }) {
  const root = new THREE.Group(); root.name = 'world'; scene.add(root);
  const add = (o) => { root.add(o); return o; };
  WET.puddleMap.value = (() => { const t = T.paint(256, 256, (() => { const n = T.fbm(256, 256, 48, 4, T.rng(3)); return (x, y) => { const v = n[y * 256 + x] * 255; return [v, v, v]; }; })()).map; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t; })();

  // ---------- materials ----------
  const asphaltT = T.paint(256, 256, (() => { const r = T.rng(11), big = T.fbm(256, 256, 96, 4, r), grain = T.noise(256, 256, 2, r); return (x, y) => { const i = y * 256 + x, v = 70 + (big[i] - 0.5) * 26 + (grain[i] - 0.5) * 30; return [v, v, v * 1.03, grain[i]]; }; })(), { repeat: [XW / 3, 10 / 3], strength: 2 });
  const M = {
    asphalt: wetify(tag(new THREE.MeshStandardMaterial({ map: asphaltT.map, normalMap: asphaltT.normalMap, roughness: 0.92 }), 'asphalt', XW, 10), { scale: 0.06 }),
    pavers: wetify(tag(new THREE.MeshStandardMaterial({ color: '#b8b0a2', roughness: 0.9 }), 'pavers', XW, 8), { scale: 0.08 }),
    concrete: wetify(tag(new THREE.MeshStandardMaterial({ color: '#a8a49a', roughness: 0.9 }), 'concrete', XW, 2), { puddles: false }),
    mud: wetify(tag(new THREE.MeshStandardMaterial({ color: '#5a4a34', roughness: 1 }), 'mud', 4, 2), { puddles: false }),
    grass: wetify(tag(new THREE.MeshStandardMaterial({ color: '#4a6a2a', roughness: 0.9 }), 'grass', 60, 24), { puddles: false }),
    grassStrip: wetify(tag(new THREE.MeshStandardMaterial({ color: '#4a6a2a', roughness: 0.9 }), 'grass', 4, 2), { puddles: false }),
    paint: new THREE.MeshStandardMaterial({ color: '#e8e4d8', roughness: 0.5, emissive: '#e8e4d8', emissiveIntensity: 0.06 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#f2c21a', roughness: 0.5, emissive: '#f2c21a', emissiveIntensity: 0.06 }),
    vc: wetify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), { puddles: false }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.8 }),
    lamp: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    wall: new THREE.MeshStandardMaterial({ roughness: 0.92, ...(() => { const e = T.embankment(); return { map: e.map, normalMap: e.normalMap }; })() }),
    bed: new THREE.MeshStandardMaterial({ color: '#1a1c14', roughness: 1 }),
    gabi: new THREE.MeshPhysicalMaterial({ map: tex.gabi, color: '#ffffff', roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25, side: THREE.DoubleSide }),
    stalk: new THREE.MeshStandardMaterial({ color: '#5a8a3a', roughness: 0.6 }),
  };
  M.gabi.userData.keep = true;

  // ---------- the road ----------
  add(plane(XW, 10, M.asphalt, { z: 6, y: ROAD_Y }));
  const lines = [], yl = [];
  for (const z of [3, 5, 7, 9]) for (let x = X0; x < X1; x += 8) { const g = new THREE.PlaneGeometry(3, 0.13); g.rotateX(-HP); g.translate(x + 1.5, ROAD_Y + 0.006, z); lines.push(g); }
  for (const z of [10.72]) { const g = new THREE.PlaneGeometry(XW, 0.14); g.rotateX(-HP); g.translate(0, ROAD_Y + 0.006, z); lines.push(g); }
  for (const z of [1.28, 1.46]) { const g = new THREE.PlaneGeometry(XW, 0.1); g.rotateX(-HP); g.translate(0, ROAD_Y + 0.006, z); yl.push(g); }
  add(mesh(mergeGeometries(lines), M.paint, false)); add(mesh(mergeGeometries(yl), M.yellow, false));
  // manholes and patched potholes
  const road = new Kit();
  for (let k = 0; k < 10; k++) road.cyl('vc', 0.36, 0.36, 0.02, '#3a3a3c', { x: -40 + k * 9 + rnd() * 3, y: 0.004, z: 2 + Math.floor(rnd() * 5) * 2 + 0.9 * (rnd() - 0.5) }, 16);
  // ---------- the sidewalk, and the storefronts behind it ----------
  add(plane(XW, 8, M.pavers, { z: 15, y: WALK_Y }));
  const curb = new Kit();
  for (let x = X0; x < X1; x += 1.2) curb.box('vc', 1.2, 0.2, 0.24, (Math.round((x - X0) / 1.2)) % 2 ? '#f2c21a' : '#2a2a2a', { x: x + 0.6, y: 0.08, z: 11.06 });
  // the median: yellow-and-black curbs, plant boxes, lamps
  add(mesh(new THREE.BoxGeometry(XW, ISLAND_Y, 1.64), tag(M.concrete, 'concrete', XW, 2), false, true)).position.set(0, ISLAND_Y / 2, 0);
  for (const z of [-0.91, 0.91]) for (let x = X0; x < X1; x += 1.2) curb.box('vc', 1.2, ISLAND_Y + 0.04, 0.18, (Math.round((x - X0) / 1.2)) % 2 ? '#f2c21a' : '#1e1e1e', { x: x + 0.6, y: (ISLAND_Y + 0.04) / 2, z });
  const lamps = [];
  for (const x of [-37, -29, -21, -13, -5, 3, 11, 19, 27, 35]) lamps.push({ x, z: -0.72 });
  const lk = new Kit();
  for (const L of lamps) {
    // the lamp posts stand only past the board's ends, so no pole ever hides a lane
    if (Math.abs(L.x) > HALF + 1) {
      lk.cyl('metal', 0.09, 0.13, 8.2, '#7a8088', { x: L.x, y: 4.1 + ISLAND_Y, z: L.z }, 10);
      for (const s of [-1, 1]) {
        lk.box('metal', 0.08, 0.08, 2.2, '#7a8088', { x: L.x, y: 8.1, z: L.z + s * 1.0, rx: s * 0.12 });
        lk.rbox('metal', 0.34, 0.12, 0.62, 0.05, '#5a6068', { x: L.x, y: 8.05, z: L.z + s * 2.0 });
        lk.box('lamp', 0.26, 0.03, 0.5, lamp('#ffc070', 6), { x: L.x, y: 7.98, z: L.z + s * 2.0 });
      }
      lk.box('vc', 0.5, 0.5, 0.5, '#8a867c', { x: L.x, y: 0.47, z: L.z + 0.1 });
    }
    // a planter at every other lamp's foot: soil and bougainvillea
    lk.box('vc', 0.9, 0.26, 0.36, '#8a867c', { x: L.x + 2, y: ISLAND_Y + 0.13, z: -0.66 });
    for (let s = 0; s < 4; s++) lk.ball('vc', 0.16 + rnd() * 0.06, pick(['#e8388a', '#f25aa8', '#d82878', '#3f8f3a']), { x: L.x + 1.7 + s * 0.2, y: ISLAND_Y + 0.34, z: -0.66 + (rnd() - 0.5) * 0.16, sy: 0.8 });
  }
  // the MMDA sign on the sidewalk, and a waiting shed
  const sgn = new Kit();
  sgn.cyl('metal', 0.04, 0.04, 2.4, '#9aa0a8', { x: -13.2, y: WALK_Y + 1.2, z: 11.8 });
  sgn.box('vc', 1.3, 0.6, 0.04, '#f4f1e8', { x: -13.2, y: WALK_Y + 2.2, z: 11.8 });
  sgn.box('vc', 1.36, 0.66, 0.03, '#d8283c', { x: -13.2, y: WALK_Y + 2.2, z: 11.79 });
  for (const x of [28.7, 33.3]) for (const z of [12.1, 13.9]) sgn.cyl('metal', 0.05, 0.05, 2.5, '#9aa0a8', { x, y: WALK_Y + 1.25, z });
  sgn.rbox('vc', 5.2, 0.12, 2.3, 0.05, '#2f6fd6', { x: 31, y: WALK_Y + 2.55, z: 13 });
  sgn.box('vc', 4.4, 0.08, 0.5, '#6a6a70', { x: 31, y: WALK_Y + 0.45, z: 13.6 });
  const signMat = new THREE.MeshStandardMaterial({ map: T.stencil('BAWAL TUMAWID', { w: 512, h: 96, color: '#d8283c' }), transparent: true, roughness: 0.6 });
  const signFace = plane(1.24, 0.32, signMat, { x: -13.2, y: WALK_Y + 2.3, z: 11.83, rx: 0 }); add(signFace);
  const signFace2 = plane(1.1, 0.2, new THREE.MeshStandardMaterial({ map: T.stencil('NAKAMAMATAY', { w: 512, h: 96, color: '#1a1a1a' }), transparent: true, roughness: 0.6 }), { x: -13.2, y: WALK_Y + 2.03, z: 11.83, rx: 0 }); add(signFace2);

  // ---------- the estero ----------
  const water = waterMaterial({ color: '#2a4a40', deep: '#0e1c18', normal: tex.waterN, opacity: 0.86, rows: true });
  const waterMesh = add(plane(XW, 14, water, { z: -7, y: WATER_Y, receive: true }));
  add(plane(XW, 16, M.bed, { z: -7, y: WATER_Y - 1.3 }));
  // the wall below the median, and the far bank's walls
  const wallGeo = new THREE.PlaneGeometry(XW, 2.4); M.wall.map = M.wall.map.clone(); M.wall.map.repeat.set(XW / 3, 1); M.wall.map.needsUpdate = true;
  const wallN = add(mesh(wallGeo, M.wall, false)); wallN.position.set(0, ISLAND_Y - 1.2, -0.84); wallN.rotation.y = Math.PI;
  // the pilapil: earth banks between the five bays, and the far bank beyond
  const bank = new Kit(), bays = BAYS.map((c) => c * 2 - HALF + 1);
  const cuts = [X0, ...bays.flatMap((x) => [x - 1.05, x + 1.05]), X1];
  for (let i = 0; i < cuts.length; i += 2) {
    const a = cuts[i], b = cuts[i + 1];
    bank.rbox('mud', b - a + 0.2, 1.2, 2.3, 0.3, '#ffffff', { x: (a + b) / 2, y: BANK_Y - 0.6, z: -12.05 });
  }
  for (const x of bays) bank.box('mud', 2.4, 1.2, 1.2, '#ffffff', { x, y: BANK_Y - 0.62, z: -13.6 }); // the back of each bay
  const bankGeo = bank.build();
  const pilapil = add(mesh(bankGeo.mud, M.mud, true, true));
  // grass along the top of each bank
  for (let i = 0; i < cuts.length; i += 2) { const a = cuts[i], b = cuts[i + 1]; add(plane(Math.min(b - a - 0.1, 60), 2.0, M.grassStrip, { x: (a + b) / 2, y: BANK_Y + 0.012, z: -12.1 })); }
  add(plane(XW, 25, M.grass, { z: -25.6, y: BANK_Y }));
  // the gabi: on the pilapil between the bays and thick along the bank
  const leafGeo = gabiLeafGeo(1), spots = [];
  for (let i = 0; i < cuts.length; i += 2) {
    const a = Math.max(cuts[i], -40), b = Math.min(cuts[i + 1], 40);
    for (let x = a + 0.4; x < b - 0.3; x += 0.55 + rnd() * 0.4) spots.push([x, -12.2 + (rnd() - 0.5) * 0.9, 0.35 + rnd() * 0.5, 0.45 + rnd() * 0.35]);
  }
  for (let k = 0; k < 150; k++) spots.push([-40 + rnd() * 80, -13.8 - rnd() * 5, 0.6 + rnd() * 1.1, 0.6 + rnd() * 0.6]);
  const leafIM = new THREE.InstancedMesh(leafGeo, M.gabi, spots.length), stalkGeo = new THREE.CylinderGeometry(0.025, 0.04, 1, 6); stalkGeo.translate(0, 0.5, 0);
  const stalkIM = new THREE.InstancedMesh(stalkGeo, M.stalk, spots.length);
  spots.forEach(([x, z, h, s], i) => {
    const yaw = rnd() * TAU, tilt = 0.5 + rnd() * 0.5;
    leafIM.setMatrixAt(i, matrix({ x: x + Math.cos(yaw) * 0.12, y: BANK_Y + h, z: z - Math.sin(yaw) * 0.12, ry: yaw, rz: -tilt, s }));
    stalkIM.setMatrixAt(i, matrix({ x, y: BANK_Y, z, sy: h, rz: (rnd() - 0.5) * 0.3 }));
  });
  for (const o of [leafIM, stalkIM]) { o.castShadow = true; o.receiveShadow = true; add(o); }

  // ---------- the two bridges over the estero, at the ends of the board ----------
  const br = new Kit();
  for (const s of [-1, 1]) {
    const cx = s * (HALF + 2.2);
    br.box('vc', 4.0, 0.34, 13.2, '#8a8680', { x: cx, y: 0.75, z: -6.6 });
    br.box('vc', 4.0, 0.08, 13.2, '#4a4a4c', { x: cx, y: 0.96, z: -6.6 });
    for (const e of [-1, 1]) { br.box('vc', 0.14, 0.12, 13.2, '#b0aca4', { x: cx + e * 1.9, y: 1.52, z: -6.6 }); for (let z = -12.8; z < -0.4; z += 0.8) br.box('metal', 0.05, 0.55, 0.05, '#6a7078', { x: cx + e * 1.9, y: 1.22, z }); }
    br.box('vc', 4.0, 1.4, 0.4, '#8a8680', { x: cx, y: 0.1, z: -0.8 }); br.box('vc', 4.0, 1.4, 0.4, '#8a8680', { x: cx, y: 0.1, z: -12.6 });
  }
  // ---------- the footbridge over EDSA, west of the board ----------
  const fb = new Kit(), fx = -(HALF + 3.6);
  for (const z of [11.8, 6, 0.2]) for (const e of [-0.9, 0.9]) fb.box('vc', 0.36, 5.3, 0.36, '#8a8a90', { x: fx + e, y: 2.65, z });
  fb.box('vc', 2.4, 0.3, 12.2, '#9a9aa0', { x: fx, y: 5.3, z: 6 });
  for (const e of [-1.15, 1.15]) { fb.box('metal', 0.06, 1.1, 12.2, '#2f6fd6', { x: fx + e, y: 6.0, z: 6 }); for (let z = 0.2; z < 12; z += 0.5) fb.box('metal', 0.04, 1.0, 0.04, '#2f6fd6', { x: fx + e, y: 5.95, z }); }
  fb.rbox('vc', 2.6, 0.12, 12.4, 0.05, '#c8c8cc', { x: fx, y: 8.2, z: 6 }); // its roof
  for (const z of [0.4, 6, 11.6]) fb.box('metal', 0.1, 2.8, 0.1, '#6a6a70', { x: fx + 1.2, y: 6.8, z });
  fb.box('vc', 2.0, 0.3, 7.4, '#9a9aa0', { x: fx, y: 2.75, z: 15.2, rx: 0.76 }); // the stairs down to the sidewalk
  for (let s = 0; s < 16; s++) fb.box('vc', 2.0, 0.06, 0.1, '#b0b0b4', { x: fx, y: 5.2 - s * 0.32, z: 12.6 + s * 0.33 });
  const tarp = new THREE.MeshStandardMaterial({ map: (() => { const c = T.canvas(512, 128), x = c.getContext('2d'); x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, 512, 128); x.fillStyle = '#1f4fa8'; x.fillRect(0, 0, 512, 26); x.fillStyle = '#d8283c'; x.font = 'italic 900 58px "Barlow Condensed", sans-serif'; x.textAlign = 'center'; x.fillText('BAWAL TUMAWID', 256, 82); x.fillStyle = '#fff'; x.font = '800 18px "Baloo 2", sans-serif'; x.fillText('MMDA · GAMITIN ANG FOOTBRIDGE', 256, 20); x.fillStyle = '#1a1a1a'; x.fillText('NAKAMAMATAY!', 256, 114); return T.toTex(c); })(), roughness: 0.8, side: THREE.DoubleSide });
  const tarpM = plane(6, 1.3, tarp, { x: fx + 1.25, y: 5.95, z: 5.2, rx: 0, ry: HP }); add(tarpM);

  // ---------- behind the sidewalk: a row of shophouses, their signs lit ----------
  add(plane(400, 190, M.vc, { z: 106, y: -0.02 })).material = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.95 });
  const shop = new Kit(), SIGNS = ['#e8384f', '#2f6fd6', '#ffd23f', '#3fae5a', '#ff8ae2', '#f08a1a'];
  for (let x = -70; x < 70;) {
    const w = 5 + rnd() * 4, h = 3.8 + rnd() * 2.4, d = 8, c = pick(['#d8cfc0', '#c0c8c8', '#e0d0b0', '#b8b0c0', '#d0b8a0']), cx = x + w / 2, zf = 19.6;
    shop.box('vc', w, h, d, c, { x: cx, y: h / 2, z: zf + d / 2 });
    shop.box('vc', w + 0.1, 0.22, 0.3, '#e8e2d6', { x: cx, y: h + 0.11, z: zf + 0.1 }); // a parapet along the roof
    // a striped awning, sloping out over the sidewalk
    const ac = pick(SIGNS);
    for (let s2 = 0; s2 < Math.floor(w / 0.5); s2++) shop.box('vc', 0.5, 0.05, 1.5, s2 % 2 ? '#f4f1e8' : ac, { x: x + 0.25 + s2 * 0.5, y: 2.85, z: zf - 0.7, rx: 0.32 });
    shop.box('lamp', w * 0.8, 0.8, 0.1, lamp(pick(SIGNS), 1.3), { x: cx, y: 3.5, z: zf - 0.05 }); // the shop's lit sign
    shop.box('vc', w * 0.8 + 0.16, 0.92, 0.08, '#2a2a2e', { x: cx, y: 3.5, z: zf - 0.02 });
    shop.box('lamp', w * 0.7, 2.2, 0.06, lamp('#ffdcaa', 0.9), { x: cx, y: 1.3, z: zf - 0.05 }); // its lit front
    if (rnd() < 0.4) { shop.box('lamp', 0.12, 1.6, 0.5, lamp(pick(SIGNS), 1.5), { x: x + 0.3, y: 3.9, z: zf - 0.35 }); } // a blade sign
    // the upper floors: framed windows, sills, an aircon here and there, a balcony on some
    for (let fl = 1; fl < h / 3 - 0.3; fl++) {
      const y = 2 + fl * 3, n = Math.floor(w / 1.6);
      for (let k2 = 0; k2 < n; k2++) {
        const wx2 = x + 0.9 + k2 * 1.6, lit = rnd() < 0.4;
        shop.box('vc', 1.06, 1.26, 0.06, '#f0ece2', { x: wx2, y, z: zf - 0.02 }); // the frame
        shop.box(lit ? 'lamp' : 'vc', 0.9, 1.1, 0.06, lit ? lamp('#ffcf88', 1.2) : '#1a1d24', { x: wx2, y, z: zf - 0.05 });
        shop.box('vc', 1.16, 0.08, 0.2, '#d8d2c6', { x: wx2, y: y - 0.66, z: zf - 0.1 }); // sill
        for (let b = -0.4; b <= 0.41; b += 0.2) shop.box('metal', 0.03, 1.1, 0.03, '#2a2a2a', { x: wx2 + b, y, z: zf - 0.1 }); // grille
        if (rnd() < 0.35) { shop.rbox('vc', 0.7, 0.45, 0.32, 0.04, '#d8dce0', { x: wx2, y: y - 1.0, z: zf - 0.2 }); shop.cyl('vc', 0.15, 0.15, 0.02, '#4a4e54', { x: wx2 + 0.12, y: y - 1.0, z: zf - 0.37, rx: Math.PI / 2 }, 12); }
      }
      if (rnd() < 0.5) {
        shop.box('vc', w * 0.7, 0.12, 0.9, '#cfc8bc', { x: cx, y: y - 1.2, z: zf - 0.45 }); // a balcony
        for (let b = 0; b <= w * 0.7; b += 0.18) shop.box('metal', 0.025, 0.8, 0.025, '#3a3a3e', { x: cx - w * 0.35 + b, y: y - 0.75, z: zf - 0.88 });
        shop.box('metal', w * 0.7, 0.05, 0.05, '#3a3a3e', { x: cx, y: y - 0.35, z: zf - 0.88 });
        for (let p2 = 0; p2 < 3; p2++) shop.ball('vc', 0.18, pick(['#3f8f3a', '#4fa044', '#e8388a']), { x: cx - w * 0.3 + p2 * 0.5, y: y - 0.95, z: zf - 0.7 });
      }
    }
    if (rnd() < 0.5) shop.cyl('vc', 0.5, 0.5, 0.9, '#2f6fd6', { x: cx + w * 0.25, y: h + 0.45, z: zf + 3 }, 12); // a water tank on the roof
    x += w + 0.15;
  }
  // ---------- the far bank: shanties along the water ----------
  const sh = new Kit(), SH = ['#d8a060', '#6aa0c8', '#e8d0a0', '#c86a50', '#8ac08a', '#e0e0d8', '#b0a0d0', '#f0c040'];
  for (let x = -60; x < 60;) {
    const w = 2.6 + rnd() * 2.4, h = 2.4 + rnd() * 2.6, d = 3 + rnd() * 1.5, z = -17.5 - rnd() * 1.2, c = pick(SH);
    sh.box('vc', w, h, d, c, { x: x + w / 2, y: BANK_Y + h / 2 + 0.6, z: z - d / 2 });
    for (const px of [x + 0.2, x + w - 0.2]) sh.box('vc', 0.12, 0.7, 0.12, '#5a4a3a', { x: px, y: BANK_Y + 0.3, z: z - 0.2 }); // stilts
    sh.box('metal', w + 0.5, 0.06, d + 0.8, rnd() < 0.5 ? '#9a6a4a' : '#a8acb0', { x: x + w / 2, y: BANK_Y + h + 0.7, z: z - d / 2 + 0.2, rx: -0.12 }); // tin roof
    const win = Math.floor(w / 1.3);
    for (let k = 0; k < win; k++) sh.box(rnd() < 0.5 ? 'lamp' : 'vc', 0.6, 0.55, 0.04, rnd() < 0.5 ? lamp('#ffcf88', 1.6) : '#1a1d24', { x: x + 0.7 + k * 1.3, y: BANK_Y + h * 0.62 + 0.6, z: z + 0.02 });
    if (rnd() < 0.6) { // laundry on a line
      const ly = BANK_Y + h * 0.4 + 0.6;
      sh.box('vc', w, 0.012, 0.012, '#2a2a2a', { x: x + w / 2, y: ly + 0.35, z: z + 0.5 });
      for (let k = 0; k < 4; k++) sh.box('vc', 0.36, 0.5, 0.02, pick(['#e8384f', '#ffd23f', '#2f6fd6', '#ffffff', '#3fae5a', '#ff8ae2']), { x: x + 0.5 + k * (w / 4.4), y: ly + 0.1, z: z + 0.5 });
    }
    x += w + 0.2 + rnd() * 0.6;
  }

  // ---------- place pieces: the railway, the skyline, the landmarks ----------
  const places = [0, 1, 2, 3].map(() => { const g = new THREE.Group(); g.visible = false; add(g); return g; });
  const winMats = [0, 1, 2, 3].map((n) => [0, 1, 2].map((k) => { const w = T.windows(40 + n * 7 + k, { cols: 8, rows: 14, color: ['#7a8090', '#8a8478', '#6a7078'][k], lit: [0.35, 0.15, 0.25, 0.6][n], warm: k !== 2 }); return new THREE.MeshStandardMaterial({ map: w.map, emissiveMap: w.emissive, emissive: '#ffffff', emissiveIntensity: [1.2, 0.5, 0.6, 2.2][n], roughness: 0.7 }); }));
  const skyline = (n, g, { z0 = -46, count = 26, tall = 1 } = {}) => {
    const groups = [[], [], []], roof = new Kit();
    for (let k = 0; k < count; k++) {
      const w = 8 + rnd() * 10, h = (12 + rnd() * 34) * tall, d = 8 + rnd() * 8, x = -110 + (k / count) * 220 + rnd() * 6, z = z0 - rnd() * 50;
      const block = (bw, bh, bd, by) => { const geo = new THREE.BoxGeometry(bw, bh, bd); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * bw / 10, uv.getY(i) * bh / 16); geo.translate(x, by + bh / 2, z); groups[k % 3].push(geo); };
      // a podium, the tower, and on some a setback above: not just boxes
      const pod = 6 + rnd() * 4;
      block(w * 1.25, pod, d * 1.2, 0);
      const top = rnd() < 0.55 ? h * (0.55 + rnd() * 0.2) : h;
      block(w, top - pod, d, pod);
      if (top < h) block(w * 0.68, h - top, d * 0.7, top);
      roof.box('vc', w * (top < h ? 0.72 : 1.04), 0.6, d * (top < h ? 0.74 : 1.04), '#5a5c62', { x, y: h + 0.3, z }); // the crown
      if (rnd() < 0.6) roof.cyl('vc', 1, 1, 1.8, '#6a7080', { x: x + w * 0.2, y: h + 1.5, z }, 10);
      if (rnd() < 0.5) { roof.cyl('metal', 0.08, 0.08, 6, '#8a8a90', { x: x - w * 0.2, y: h + 3.6, z }, 6); roof.ball('lamp', 0.3, lamp('#ff3020', 3), { x: x - w * 0.2, y: h + 6.6, z }); } // a mast with its warning light
      if (n >= 2 && rnd() < 0.4) roof.box('lamp', w * 1.02, 0.3, d * 1.02, lamp(pick(['#40d0ff', '#ff4fb0', '#ffd23f']), 1.6), { x, y: pod + 0.15, z }); // an LED band
    }
    for (const [slot, geo] of Object.entries(roof.build())) g.add(mesh(geo, slot === 'lamp' ? M.lamp : slot === 'metal' ? M.metal : M.vc, false, false));
    groups.forEach((list, k) => { const mt = winMats[n][k].clone(); mt.map = mt.map.clone(); mt.emissiveMap = mt.emissiveMap.clone(); for (const t of [mt.map, mt.emissiveMap]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.needsUpdate = true; } g.add(mesh(mergeGeometries(list), mt, false, false)); });
  };
  const railway = (g, { z = -27, color = '#9a9890', train = '#d8dce0', stripe = '#1f5fbf' } = {}) => {
    const k = new Kit();
    for (let x = -100; x <= 100; x += 20) { k.box('vc', 1.5, 8.6, 1.8, color, { x, y: 4.3, z }); k.box('vc', 2.2, 0.9, 5.4, color, { x, y: 8.8, z }); }
    k.box('vc', 220, 1.1, 7.6, color, { y: 9.6, z }); k.box('vc', 220, 0.9, 0.2, '#b8b4ac', { y: 10.6, z: z + 3.7 }); k.box('vc', 220, 0.9, 0.2, '#b8b4ac', { y: 10.6, z: z - 3.7 });
    k.box('lamp', 220, 0.08, 0.06, lamp('#fff0d0', 1.6), { y: 9.02, z: z + 3.75 }); // a strip of light along its underside
    const built = k.build();
    for (const [slot, geo] of Object.entries(built)) g.add(mesh(geo, slot === 'lamp' ? M.lamp : M.vc, false, true));
    // the train: three cars with lit windows
    const tk = new Kit();
    for (let c = 0; c < 3; c++) {
      const cx = c * 16.4;
      tk.rbox('vc', 16, 3.2, 3.1, 0.3, train, { x: cx, y: 12.0, z: z + 1.4 });
      tk.box('vc', 16.02, 0.3, 3.12, stripe, { x: cx, y: 11.2, z: z + 1.4 });
      tk.box('lamp', 14.6, 0.9, 3.14, lamp('#fff2d8', 1.8), { x: cx, y: 12.4, z: z + 1.4 });
      for (let w = -7; w <= 7; w += 1.6) tk.box('vc', 0.22, 0.94, 3.16, '#2a2c30', { x: cx + w, y: 12.4, z: z + 1.4 });
    }
    tk.box('lamp', 0.1, 0.3, 0.5, lamp('#ffffff', 6), { x: 32.9, y: 11.6, z: z + 2.2 }); tk.box('lamp', 0.1, 0.3, 0.5, lamp('#ffffff', 6), { x: 32.9, y: 11.6, z: z + 0.6 });
    const t = new THREE.Group(); const tb = tk.build();
    for (const [slot, geo] of Object.entries(tb)) t.add(mesh(geo, slot === 'lamp' ? M.lamp : M.vc, false, false));
    g.add(t);
    return t;
  };
  const billboard = (g, ad, x, y, z, w = 12, ry = 0) => {
    const tx = T.billboard(ad), m = new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: '#ffffff', emissiveIntensity: 1.0, roughness: 0.6 });
    const o = plane(w, w * 0.375, m, { x, y, z, rx: 0, ry }); g.add(o);
    const k = new Kit(); k.box('vc', w + 0.4, w * 0.375 + 0.4, 0.3, '#2a2a2e', { x, y, z: z - 0.2 }); k.box('vc', 0.5, y, 0.5, '#5a5a60', { x: x - w * 0.3, y: y / 2, z: z - 0.4 }); k.box('vc', 0.5, y, 0.5, '#5a5a60', { x: x + w * 0.3, y: y / 2, z: z - 0.4 });
    for (let s = -2; s <= 2; s++) k.box('lamp', 0.3, 0.12, 0.5, lamp('#fff4e0', 4), { x: x + s * w / 5, y: y + w * 0.19 + 0.35, z: z + 0.5 });
    const b = k.build(); g.add(mesh(b.vc, M.vc, false, false)); g.add(mesh(b.lamp, M.lamp, false, false));
    return m;
  };
  const neonSign = (g, text, color, x, y, z, w = 6) => {
    const tx = T.neon(text, color), m = new THREE.MeshBasicMaterial({ map: tx, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, color: new THREE.Color(color).multiplyScalar(2.6) });
    const o = plane(w, w / 4, m, { x, y, z, rx: 0 }); g.add(o); return o;
  };
  // Cubao: the MRT, the big dome, billboards on EDSA
  const trains = [];
  trains[0] = railway(places[0]);
  skyline(0, places[0]);
  { const k = new Kit(); k.add('vc', new THREE.SphereGeometry(28, 32, 12, 0, TAU, 0, HP * 0.55), '#c8c4bc', { x: -48, y: 0, z: -80, sy: 0.55 }); k.cyl('vc', 30, 30, 6, '#8a8680', { x: -48, y: 3, z: -80 }, 32); places[0].add(mesh(k.build().vc, M.vc, false, false)); }
  const ads = [billboard(places[0], T.ADS[0], -12, 15.5, -24.5, 13), billboard(places[0], T.ADS[3], 16, 15.5, -24.5, 13)];
  // España: old apartments, the university's tower, the flood
  skyline(1, places[1], { z0: -40, count: 22, tall: 0.6 });
  { const k = new Kit(); k.box('vc', 60, 14, 12, '#d8cfb8', { x: 6, y: 7, z: -66 }); k.box('vc', 9, 34, 9, '#e0d8c2', { x: 6, y: 17, z: -64 }); k.box('vc', 1, 6, 1, '#d8c890', { x: 6, y: 37, z: -64 }); k.box('vc', 4, 1, 1, '#d8c890', { x: 6, y: 38.5, z: -64 }); for (let x = -20; x <= 32; x += 4) k.box('lamp', 1.8, 1.4, 0.1, lamp('#ffe0b0', 0.7), { x, y: 9, z: -59.9 }); const b = k.build(); places[1].add(mesh(b.vc, M.vc, false, false)); places[1].add(mesh(b.lamp, M.lamp, false, false)); }
  ads.push(billboard(places[1], T.ADS[2], -4, 14, -26, 14));
  // Quiapo: the church, the river's steel bridge
  skyline(2, places[2], { z0: -52, count: 20, tall: 0.8 });
  { const k = new Kit(), cz = -58;
    k.box('vc', 18, 14, 30, '#e8dcc0', { x: 0, y: 7, z: cz - 10 });
    k.cyl('vc', 6.5, 6.5, 5, '#e0d4b8', { x: 0, y: 16.5, z: cz - 14 }, 24);
    k.add('vc', new THREE.SphereGeometry(6.6, 24, 12, 0, TAU, 0, HP), '#c8b890', { x: 0, y: 19, z: cz - 14 });
    k.cyl('vc', 0.8, 1.2, 3, '#e0d4b8', { x: 0, y: 26.8, z: cz - 14 }, 12); k.box('vc', 0.4, 3, 0.4, '#d8c890', { x: 0, y: 29.5, z: cz - 14 }); k.box('vc', 1.8, 0.4, 0.4, '#d8c890', { x: 0, y: 30.2, z: cz - 14 });
    for (const s of [-1, 1]) { k.box('vc', 5.5, 24, 5.5, '#ece2c8', { x: s * 7.5, y: 12, z: cz + 3 }); k.box('vc', 4.6, 5, 4.6, '#e0d4b8', { x: s * 7.5, y: 26.5, z: cz + 3 }); k.add('vc', new THREE.SphereGeometry(2.4, 16, 8, 0, TAU, 0, HP), '#c8b890', { x: s * 7.5, y: 29, z: cz + 3 }); k.box('vc', 0.3, 2, 0.3, '#d8c890', { x: s * 7.5, y: 32, z: cz + 3 }); for (let y = 6; y < 24; y += 6) k.box('lamp', 1.4, 2.2, 0.1, lamp('#ffd9a0', 0.9), { x: s * 7.5, y, z: cz + 5.8 }); }
    k.box('lamp', 3, 5, 0.1, lamp('#ffd9a0', 0.9), { x: 0, y: 5, z: cz + 5.1 });
    const b = k.build(); places[2].add(mesh(b.vc, M.vc, false, false)); places[2].add(mesh(b.lamp, M.lamp, false, false));
    // Quezon Bridge's arch over the east bridge
    const a = new Kit();
    for (let s = 0; s <= 16; s++) { const t = s / 16, zz = -13 + t * 12.6, y = 1.2 + Math.sin(t * Math.PI) * 5.2; a.box('metal', 0.3, 0.3, 0.9, '#6a7a8a', { x: HALF + 0.4, y, z: zz, rx: Math.cos(t * Math.PI) * -0.9 }); a.box('metal', 0.3, 0.3, 0.9, '#6a7a8a', { x: HALF + 4.0, y, z: zz, rx: Math.cos(t * Math.PI) * -0.9 }); if (s % 2 === 0 && s > 0 && s < 16) { a.box('metal', 0.06, y - 1.1, 0.06, '#8a9aaa', { x: HALF + 0.4, y: (y + 1.1) / 2, z: zz }); a.box('metal', 0.06, y - 1.1, 0.06, '#8a9aaa', { x: HALF + 4.0, y: (y + 1.1) / 2, z: zz }); a.box('metal', 3.6, 0.2, 0.2, '#6a7a8a', { x: HALF + 2.2, y, z: zz }); } }
    places[2].add(mesh(a.build().metal, M.metal, true, true));
  }
  ads.push(billboard(places[2], T.ADS[5], 18, 13, -30, 12));
  // Maynila: the LRT over Taft, neon, a denser, taller city
  trains[3] = railway(places[3], { color: '#8a8a8e', train: '#e8e8ec', stripe: '#d8283c' });
  skyline(3, places[3], { tall: 1.2 });
  const neons = [neonSign(places[3], 'HOTEL', '#ff4fb0', -18, 16, -34, 7), neonSign(places[3], 'KARAOKE', '#40e0ff', 8, 18, -36, 8), neonSign(places[3], 'LUGAWAN 24/7', '#ffd23f', 24, 13, -31, 8), neonSign(places[3], 'PAWNSHOP', '#7cff7a', -34, 12, -30, 7), neonSign(places[3], 'SARI-SARI', '#ff7a3a', 36, 9, -24, 6)];
  ads.push(billboard(places[3], T.ADS[4], -2, 16.5, -24.5, 13));

  // the kit-built statics, merged by material
  for (const kit of [road, curb, lk, sgn, br, fb, sh, shop]) for (const [slot, geo] of Object.entries(kit.build())) add(mesh(geo, slot === 'lamp' ? M.lamp : slot === 'metal' ? M.metal : M.vc, slot !== 'lamp', true));

  // the flood on España: brown water over the road and the sidewalk
  const flood = waterMaterial({ color: '#5a4a30', deep: '#2a2010', normal: tex.waterN, opacity: 0.72 });
  flood.userData.water.wStill.value = 0.6;
  const floodMesh = add(plane(XW, 18, flood, { z: 7, y: ROAD_Y + 0.07 })); floodMesh.visible = false; floodMesh.renderOrder = 2;

  let place = -1;
  function setPlace(n) {
    place = n;
    places.forEach((g, i) => { g.visible = i === n; });
    floodMesh.visible = n === 1;
    const W = [['#2a4a40', '#0e1c18'], ['#5a4a2e', '#2a2010'], ['#2e5058', '#0e1e24'], ['#1a3038', '#060e12']][n];
    water.color.set(W[0]); water.userData.water.wDeep.value.set(W[1]);
  }
  const trainT = [0, 0, 0, 0];
  function update(t, dt) {
    for (const i of [0, 3]) if (trains[i] && place === i) { trainT[i] = (trainT[i] + dt) % 26; const k = trainT[i] / 26; trains[i].position.x = -140 + k * 280; }
    WET.wetTime.value = t;
  }
  return { root, M, water, flood, waterMesh, floodMesh, lamps, setPlace, update, places, neons, ads, bays };
}
