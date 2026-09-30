// Procedural textures, painted into canvases at load time: the helpers (seeded noise, a normal map from
// heights) come from Tumbang Preso. Here they paint the turtle shells, the croc, the banig, the end grain
// of a log, the gabi leaves, the route boards, the billboards and the neon, the rain and the water.
import * as THREE from './vendor/three.module.min.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export function rng(seed) { let s = (seed >>> 0) % 2147483647 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
const hex = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const shade = (c, k) => { const [r, g, b] = hex(c); const f = (v) => clamp(Math.round(v * k), 0, 255); return `rgb(${f(r)},${f(g)},${f(b)})`; };

// Smooth value noise on a wrapping lattice, so every texture tiles.
export function noise(w, h, cell, r) {
  const gw = Math.max(1, Math.round(w / cell)), gh = Math.max(1, Math.round(h / cell)), grid = new Float32Array(gw * gh);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const out = new Float32Array(w * h), s = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    const gy = (y / h) * gh, y0 = Math.floor(gy) % gh, y1 = (y0 + 1) % gh, fy = s(gy - Math.floor(gy));
    for (let x = 0; x < w; x++) {
      const gx = (x / w) * gw, x0 = Math.floor(gx) % gw, x1 = (x0 + 1) % gw, fx = s(gx - Math.floor(gx));
      const a = grid[y0 * gw + x0], b = grid[y0 * gw + x1], c = grid[y1 * gw + x0], d = grid[y1 * gw + x1];
      out[y * w + x] = lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
    }
  }
  return out;
}
export function fbm(w, h, cell, octaves, r) {
  const out = new Float32Array(w * h);
  let amp = 1, tot = 0;
  for (let o = 0; o < octaves; o++) { const n = noise(w, h, Math.max(1, cell / 2 ** o), r); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; tot += amp; amp *= 0.5; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function toTex(c, { repeat = null, color = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
// A normal map from a height field: the slope in x and y, packed into RGB.
export function normalMap(hgt, w, h, strength = 2, opts = {}) {
  const c = canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const l = hgt[j * w + ((i - 1 + w) % w)], rr = hgt[j * w + ((i + 1) % w)], u = hgt[((j - 1 + h) % h) * w + i], d = hgt[((j + 1) % h) * w + i];
    let nx = (l - rr) * strength, ny = (d - u) * strength, nz = 1;
    const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const p = (j * w + i) * 4;
    img.data[p] = (nx * 0.5 + 0.5) * 255; img.data[p + 1] = (ny * 0.5 + 0.5) * 255; img.data[p + 2] = (nz * 0.5 + 0.5) * 255; img.data[p + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  return toTex(c, { ...opts, color: false });
}
// Paint pixels from a function of (x, y) giving [r, g, b] (0-255) and optionally a height.
export function paint(w, h, fn, { repeat = null, strength = 0 } = {}) {
  const c = canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), hgt = strength ? new Float32Array(w * h) : null;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const v = fn(i, j), p = (j * w + i) * 4;
    img.data[p] = clamp(v[0], 0, 255); img.data[p + 1] = clamp(v[1], 0, 255); img.data[p + 2] = clamp(v[2], 0, 255); img.data[p + 3] = 255;
    if (hgt) hgt[j * w + i] = v[3] ?? 0;
  }
  x.putImageData(img, 0, 0);
  return { map: toTex(c, { repeat }), normalMap: hgt ? normalMap(hgt, w, h, strength, { repeat }) : null, canvas: c };
}


// ---------- Tawid EDSA ----------
const TAU = Math.PI * 2;
const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };

// A pagong's shell, laid out for a dome (the top of a sphere): the scutes are Voronoi cells of points
// set out like a real carapace, a ring of marginals at the rim, growth rings in each.
export function shell(seed = 5, size = 512) {
  const r = rng(seed), pts = [[0, 1]];
  for (let k = 0; k < 6; k++) pts.push([(k / 6) * TAU + 0.3, 0.62]);
  for (let k = 0; k < 13; k++) pts.push([(k / 13) * TAU + r() * 0.1, 0.22]);
  const P = pts.map(([a, v]) => { const th = (1 - v) * Math.PI / 2; return [Math.sin(th) * Math.cos(a), Math.cos(th), Math.sin(th) * Math.sin(a)]; });
  const tone = P.map(() => 0.85 + r() * 0.3), n = fbm(size, size / 2, 32, 3, r);
  return paint(size, size / 2, (x, y) => {
    const u = x / size, v = 1 - y / (size / 2), a = u * TAU, th = (1 - v) * Math.PI / 2, q = [Math.sin(th) * Math.cos(a), Math.cos(th), Math.sin(th) * Math.sin(a)];
    let d1 = 9, d2 = 9, id = 0;
    for (let i = 0; i < P.length; i++) { const d = Math.hypot(q[0] - P[i][0], q[1] - P[i][1], q[2] - P[i][2]); if (d < d1) { d2 = d1; d1 = d; id = i; } else if (d < d2) d2 = d; }
    const edge = d2 - d1, seam = edge < 0.035, ring = Math.sin(d1 * 60) * 0.5 + 0.5, k = tone[id] * (0.82 + ring * 0.12 + (n[y * size + x] - 0.5) * 0.2);
    const base = seam ? [34, 30, 18] : [96 * k, 88 * k, 40 * k + (v < 0.12 ? 30 : 0)];
    return [...base, seam ? -1 : Math.min(1, edge * 6) + ring * 0.08];
  }, { strength: 3 });
}

// Crocodile hide: rows of square scales, knobbly, dark olive.
export function croc(seed = 6, size = 256) {
  const r = rng(seed), n = noise(size, size, 6, r), f = fbm(size, size, 64, 3, r);
  return paint(size, size, (x, y) => {
    const sx = (x % 16) / 16, sy = (y % 12) / 12, bump = Math.sin(sx * Math.PI) * Math.sin(sy * Math.PI), seam = sx < 0.1 || sy < 0.12;
    const k = (0.7 + bump * 0.35 + (n[y * size + x] - 0.5) * 0.3) * (seam ? 0.55 : 1) * (0.85 + f[y * size + x] * 0.3);
    return [58 * k, 72 * k, 36 * k, seam ? -0.5 : bump];
  }, { repeat: [3, 3], strength: 4 });
}

// A banig: pandan strips woven on the diagonal, in the bright colours of a sleeping mat.
export function banig(seed = 7, size = 256) {
  const r = rng(seed), n = noise(size, size, 3, r), cols = [[216, 40, 120], [40, 150, 80], [240, 200, 40], [120, 60, 170], [230, 220, 190], [230, 90, 40]];
  return paint(size, size, (x, y) => {
    const a = (x + y) % 16, b = (x - y + 1024) % 16, over = (Math.floor((x + y) / 16) + Math.floor((x - y + 1024) / 16)) % 2;
    const t = over ? a : b, band = Math.sin((t / 16) * Math.PI), stripe = Math.floor(((over ? x - y + 1024 : x + y) / 16) / 3) % cols.length;
    const c = (Math.floor(y / 48) % 3 === 1) ? cols[stripe] : [214, 190, 140];
    const k = (0.62 + band * 0.4 + (n[y * size + x] - 0.5) * 0.12);
    return [c[0] * k, c[1] * k, c[2] * k, band];
  }, { repeat: [1, 1], strength: 3 });
}

// A log's cut end: pale wood, growth rings, a few checks from drying.
export function endGrain(seed = 8, size = 256) {
  const r = rng(seed), n = fbm(size, size, 32, 3, r), cracks = Array.from({ length: 5 }, () => r() * TAU);
  return paint(size, size, (x, y) => {
    const dx = x / size - 0.5, dy = y / size - 0.5, d = Math.hypot(dx, dy) * 2, a = Math.atan2(dy, dx);
    const ring = Math.sin((d + n[y * size + x] * 0.08) * 60) * 0.5 + 0.5, crack = cracks.some((c) => Math.abs(((a - c + Math.PI * 3) % TAU) - Math.PI) < 0.03 * (1 - d) && d > 0.1);
    const k = (d > 0.9 ? 0.55 : 0.8 + ring * 0.2) * (crack ? 0.4 : 1);
    return [190 * k, 150 * k, 100 * k, crack ? -1 : ring * 0.3];
  }, { strength: 2 });
}

// A gabi leaf, glossy: veins from where the stalk joins, near the notch, out to the edge.
export function gabiLeaf(seed = 9, size = 256) {
  const c = canvas(size, size), x = c.getContext('2d'), r = rng(seed);
  const g = x.createRadialGradient(size * 0.36, size * 0.5, 4, size * 0.5, size * 0.5, size * 0.62);
  g.addColorStop(0, '#6fbf52'); g.addColorStop(0.5, '#3f9a3a'); g.addColorStop(1, '#23682a');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const ox = size * 0.36, oy = size * 0.5;
  for (let k = 0; k < 13; k++) {
    const a = -Math.PI * 0.9 + (k / 12) * Math.PI * 1.8, len = size * (0.5 + r() * 0.1);
    x.strokeStyle = 'rgba(210,240,170,0.7)'; x.lineWidth = k === 6 ? 4 : 2.2;
    x.beginPath(); x.moveTo(ox, oy); x.quadraticCurveTo(ox + Math.cos(a) * len * 0.5, oy + Math.sin(a) * len * 0.45, ox + Math.cos(a) * len, oy + Math.sin(a) * len * 0.92); x.stroke();
    for (let s = 1; s < 5; s++) { const t = s / 5, px = ox + Math.cos(a) * len * t, py = oy + Math.sin(a) * len * 0.9 * t; x.lineWidth = 0.8; x.strokeStyle = 'rgba(200,235,160,0.35)'; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a + 0.9) * 14, py + Math.sin(a + 0.9) * 14); x.stroke(); }
  }
  for (let k = 0; k < 600; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '230,255,200' : '10,40,10'},${r() * 0.06})`; x.fillRect(r() * size, r() * size, 2, 2); }
  return toTex(c);
}

// The route board on a jeepney's roof.
export function routeBoard(route, via = 'VIA EDSA') {
  const w = 512, h = 96, c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, w, h);
  x.fillStyle = '#d8283c'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10);
  x.fillStyle = '#1a1a2a'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = 'italic 900 58px "Barlow Condensed", "Baloo 2", sans-serif'; x.fillText(route, w / 2, h * 0.44, w * 0.9);
  x.font = '800 18px "Baloo 2", sans-serif'; x.fillStyle = '#d8283c'; x.fillText(via, w / 2, h * 0.82);
  return toTex(c);
}

// A big lit billboard over EDSA: the ads are the game's own.
export const ADS = [
  { bg: ['#e8283c', '#8a0a1a'], title: 'KOKAK COLA', sub: 'Sarap ng ulan!', fg: '#fff4c0', art: 'bottle' },
  { bg: ['#ffd23f', '#e88a10'], title: 'PALAKA PAWNSHOP', sub: 'Sangla na, uwi na!', fg: '#2a1a0a', art: 'ring' },
  { bg: ['#1a8a5a', '#0a3a2a'], title: 'BYE BYE, LAMOK!', sub: 'Taob, taktak, tuyo · Kontra dengue', fg: '#eaffe0', art: 'lamok' },
  { bg: ['#2a5fc8', '#0a1a4a'], title: 'MMDA', sub: 'Tumawid sa tamang tawiran!', fg: '#ffffff', art: 'walk' },
  { bg: ['#f25aa8', '#6a1a8a'], title: 'TOYO KING', sub: 'Isang patak, sarap na!', fg: '#fff4f8', art: 'bottle' },
  { bg: ['#1a1a1a', '#3a3a3a'], title: 'LOLA ISKA LUGAWAN', sub: 'Bukas 24 oras', fg: '#ffd23f', art: 'bowl' },
];
export function billboard(ad, { w = 1024, h = 384 } = {}) {
  const c = canvas(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, ad.bg[0]); g.addColorStop(1, ad.bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,0.08)'; for (let k = 0; k < 8; k++) { x.beginPath(); x.arc(w * 0.8, h * 0.5, 60 + k * 50, 0, TAU); x.lineWidth = 18; x.strokeStyle = 'rgba(255,255,255,0.05)'; x.stroke(); }
  // the art on the right
  x.save(); x.translate(w * 0.82, h * 0.52);
  if (ad.art === 'bottle') { x.fillStyle = '#2a1a10'; x.beginPath(); x.roundRect(-40, -110, 80, 200, 26); x.fill(); x.fillRect(-16, -160, 32, 60); x.fillStyle = ad.fg; x.fillRect(-40, -30, 80, 50); }
  else if (ad.art === 'ring') { x.strokeStyle = '#fff4c0'; x.lineWidth = 26; x.beginPath(); x.arc(0, 20, 80, 0, TAU); x.stroke(); x.fillStyle = '#9ae0ff'; x.beginPath(); x.moveTo(0, -120); x.lineTo(40, -70); x.lineTo(0, -40); x.lineTo(-40, -70); x.fill(); }
  else if (ad.art === 'lamok') { x.strokeStyle = '#eaffe0'; x.lineWidth = 16; x.beginPath(); x.arc(0, 0, 110, 0, TAU); x.stroke(); x.beginPath(); x.moveTo(-78, -78); x.lineTo(78, 78); x.stroke(); x.fillStyle = '#0a0a0a'; x.beginPath(); x.ellipse(0, 0, 50, 16, -0.3, 0, TAU); x.fill(); }
  else if (ad.art === 'walk') { x.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) x.fillRect(-130 + k * 56, 40, 36, 90); x.beginPath(); x.arc(0, -90, 24, 0, TAU); x.fill(); x.fillRect(-12, -64, 24, 70); }
  else if (ad.art === 'bowl') { x.fillStyle = '#f4f1e8'; x.beginPath(); x.arc(0, -10, 100, 0, Math.PI); x.fill(); x.fillStyle = '#ffd23f'; x.fillRect(-100, -20, 200, 14); x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 8; for (let k = -1; k <= 1; k++) { x.beginPath(); x.moveTo(k * 40, -40); x.bezierCurveTo(k * 40 + 20, -80, k * 40 - 20, -100, k * 40, -140); x.stroke(); } }
  x.restore();
  x.fillStyle = ad.fg; x.textAlign = 'left'; x.textBaseline = 'middle';
  x.font = `italic 900 ${h * 0.34}px "Barlow Condensed", "Baloo 2", sans-serif`; x.fillText(ad.title, w * 0.05, h * 0.4, w * 0.66);
  x.font = `800 ${h * 0.11}px "Baloo 2", sans-serif`; x.fillText(ad.sub, w * 0.05, h * 0.72, w * 0.66);
  return toTex(c);
}

// Neon lettering: bright tubes on black, for an emissive map (the bloom does the glow).
export function neon(text, color, { w = 512, h = 128, font = 'italic 900 88px "Barlow Condensed", sans-serif' } = {}) {
  const c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = font;
  x.shadowColor = color; x.shadowBlur = 18; x.strokeStyle = color; x.lineWidth = 7; x.strokeText(text, w / 2, h / 2 + 4, w * 0.92);
  x.shadowBlur = 0; x.strokeStyle = '#ffffff'; x.lineWidth = 2.2; x.strokeText(text, w / 2, h / 2 + 4, w * 0.92);
  return toTex(c);
}

// Soft light: a round pool for lamps on the ground, and a streak for a light's reflection on wet asphalt.
export function glow(size = 128) {
  const c = canvas(size, size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return toTex(c, { color: false });
}
export function streak(w = 64, h = 256) {
  const c = canvas(w, h), x = c.getContext('2d');
  for (let j = 0; j < h; j++) {
    const t = j / h, a = Math.pow(1 - t, 1.6) * (0.75 + 0.25 * Math.sin(j * 0.9)); // strongest at the light, broken by ripples
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, j, w, 1);
  }
  return toTex(c, { color: false });
}
// Rain: a thin bright streak with soft ends; a ring for a drop's splash.
export function rainDrop() {
  const c = canvas(8, 64), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(3, 0, 2, 64);
  return toTex(c, { color: false });
}
export function ring(size = 64) {
  const c = canvas(size, size), x = c.getContext('2d');
  x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = size * 0.06; x.beginPath(); x.arc(size / 2, size / 2, size * 0.42, 0, TAU); x.stroke();
  return toTex(c, { color: false });
}

// A building front far off: floors of windows, some lit (lit 0..1), for the skyline.
export function windows(seed, { cols = 8, rows = 12, color = '#6a7080', lit = 0.3, warm = true } = {}) {
  const w = cols * 16, h = rows * 16, c = canvas(w, h), x = c.getContext('2d'), e = canvas(w, h), y = e.getContext('2d'), r = rng(seed);
  x.fillStyle = color; x.fillRect(0, 0, w, h); y.fillStyle = '#000'; y.fillRect(0, 0, w, h);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const on = r() < lit, px = i * 16 + 3, py = j * 16 + 4;
    x.fillStyle = on ? '#3a3020' : '#1c2028'; x.fillRect(px, py, 10, 9);
    if (on) { y.fillStyle = warm ? (r() < 0.7 ? '#ffd9a0' : '#e8f0ff') : '#a0d8ff'; y.globalAlpha = 0.5 + r() * 0.5; y.fillRect(px, py, 10, 9); y.globalAlpha = 1; }
    x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(px, py + 9, 10, 1);
  }
  const map = toTex(c), emissive = toTex(e);
  for (const t of [map, emissive]) { t.magFilter = THREE.LinearFilter; }
  return { map, emissive };
}

// The water's small ripples: a tiling height field, as a normal map.
export function waterNormal(seed = 10, size = 256) {
  const r = rng(seed), a = fbm(size, size, 32, 4, r), b = noise(size, size, 8, r);
  const h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = a[i] * 0.8 + b[i] * 0.3;
  const n = normalMap(h, size, size, 5);
  n.wrapS = n.wrapT = THREE.RepeatWrapping;
  return n;
}

// A wall of old concrete blocks along the estero, stained dark where the water rises, with moss.
export function embankment(seed = 12, size = 256) {
  const r = rng(seed), n = fbm(size, size, 48, 4, r), g = noise(size, size, 2, r);
  return paint(size, size, (x, y) => {
    const row = Math.floor(y / 32), bx = (x + (row % 2) * 32) % 64, seam = y % 32 < 2 || bx < 2, i = y * size + x;
    const wet = Math.min(1, Math.max(0, (y / size - 0.45) * 2.2)), moss = n[i] > 0.58 && y / size > 0.35 ? (n[i] - 0.58) * 3 : 0;
    const k = (0.72 + (n[i] - 0.5) * 0.3 + (g[i] - 0.5) * 0.08) * (seam ? 0.6 : 1) * (1 - wet * 0.45);
    return [lerp(150 * k, 70, moss), lerp(146 * k, 96, moss), lerp(136 * k, 40, moss), seam ? -1 : g[i] * 0.3];
  }, { repeat: [8, 1], strength: 3 });
}

// Painted road lines, a zebra crossing and a "BAWAL TUMAWID" stencil, drawn once on transparent canvas.
export function stencil(text, { w = 512, h = 128, color = '#f4f1e8' } = {}) {
  const c = canvas(w, h), x = c.getContext('2d');
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `900 ${h * 0.7}px "Barlow Condensed", "Baloo 2", sans-serif`;
  x.fillText(text, w / 2, h / 2, w * 0.96);
  const r = rng(w), img = x.getImageData(0, 0, w, h);
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] && r() < 0.18) img.data[i] *= 0.4; // worn
  x.putImageData(img, 0, 0);
  return toTex(c);
}
export { rgba };
