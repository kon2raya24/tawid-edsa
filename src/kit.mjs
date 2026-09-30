// A small modelling kit: primitives with a vertex colour, placed and merged into one geometry per
// material slot, so a whole jeepney is a handful of draws. Colours may go above 1 for lamps, which the
// film look then blooms.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry, mergeGeometries } from './vendor/three-extra.min.js';

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
const C = new THREE.Color();

// Every geometry the kit merges carries the same attributes: position, normal, uv and color.
function prep(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  const n = g.attributes.position.count, col = new Float32Array(n * 3);
  if (Array.isArray(color)) for (let i = 0; i < n; i++) col.set(color, i * 3);
  else { C.set(color); for (let i = 0; i < n; i++) col.set([C.r, C.g, C.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
  return g;
}
// A colour, scaled: lamp(colour, 4) glows four times as bright as white.
export const lamp = (color, k) => { C.set(color); return [C.r * k, C.g * k, C.b * k]; };

export function matrix({ x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, s = 1 } = {}) {
  return new THREE.Matrix4().compose(tmpP.set(x, y, z), tmpQ.setFromEuler(tmpE.set(rx, ry, rz, 'XYZ')), tmpS.set(sx * s, sy * s, sz * s));
}

export class Kit {
  constructor() { this.slots = new Map(); }
  add(slot, geo, color, at = {}) {
    const g = prep(geo, color);
    g.applyMatrix4(at.isMatrix4 ? at : matrix(at));
    if (!this.slots.has(slot)) this.slots.set(slot, []);
    this.slots.get(slot).push(g);
    return this;
  }
  box(slot, w, h, d, color, at) { return this.add(slot, new THREE.BoxGeometry(w, h, d), color, at); }
  rbox(slot, w, h, d, r, color, at) { return this.add(slot, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.999), color, at); }
  // a cylinder along y unless turned
  cyl(slot, rt, rb, h, color, at, seg = 14) { return this.add(slot, new THREE.CylinderGeometry(rt, rb, h, seg), color, at); }
  ball(slot, r, color, at, ws = 16, hs = 10) { return this.add(slot, new THREE.SphereGeometry(r, ws, hs), color, at); }
  build() {
    const out = {};
    for (const [slot, list] of this.slots) { out[slot] = mergeGeometries(list, false); out[slot].computeBoundingSphere(); for (const g of list) g.dispose(); }
    return out;
  }
}

// A shape lathed around y from [radius, height] pairs.
export const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
// A flat outline extruded d deep (along z, centred), bevelled a touch.
export function extrude(pts, d, bevel = 0.02) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -d / 2);
  return g;
}
export { mergeGeometries };
