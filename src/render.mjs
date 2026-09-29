// Draws Tawid EDSA: the palayan and its gabi leaves, the water and the road with everything on them,
// Kokak, the rain, and the HUD. It reads the game state only; lanes are drawn at the exact fractional
// tick, since every lane is a function of time.
import { COLS, ROWS, CELL, HOP, BAYS, ISLAND, START, BAY_BUWAYA, TICK, objectsAt, snakeX, anakX, isWater } from './game.mjs';

export const T = 32, TOP = 48, BOTTOM = 36, W = COLS * T, H = TOP + ROWS * T + BOTTOM;
const X = (u) => (u / CELL) * T; // rules units to pixels
const RY = (row) => TOP + row * T; // the top of a row
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const FONT = (w, s) => `${w} ${s}px "Baloo 2", system-ui, sans-serif`;
const JEEPS = ['#e8384f', '#2f6fd6', '#ffd23f', '#3fae5a', '#ff8ae2', '#ff9f43'];
export const CAUSES = {
  tubig: 'Tinangay ng baha!', anod: 'Naanod!', buwaya: 'Nakagat ng buwaya!', pilapil: 'Bumangga sa pilapil!', ahas: 'Ahas!', oras: 'Ubos ang oras!',
  jeep: 'Beep beep! Jeep!', bus: 'Bus! Para, para!', taxi: 'Taxi!', tricycle: 'Tricycle!', motor: 'Motor!', pedicab: 'Pedicab!', truck: 'Trak!', kalesa: 'Kalesa!',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const scenes = new Map();
  const parts = [], popups = [], rings = [];
  let lastT = null, reduced = false, flash = 0, shake = 0;
  let rain = null;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
  }

  // ---------- the scene that never moves, painted once per place ----------
  function scene(g) {
    const key = g.def.n;
    if (scenes.has(key)) return scenes.get(key);
    const c = document.createElement('canvas'); c.width = W * 2; c.height = ROWS * T * 2;
    const m = c.getContext('2d'); m.scale(2, 2);
    const col = g.def.colors;
    // the palayan, with its dikes and five little ponds
    m.fillStyle = '#5f8f3a'; m.fillRect(0, 0, W, T);
    m.strokeStyle = '#8fbf4a'; m.lineWidth = 1;
    for (let x = 2; x < W; x += 4) { m.beginPath(); m.moveTo(x, 3 + (x % 3)); m.lineTo(x + 1, T - 4); m.stroke(); }
    m.fillStyle = '#7a5a36'; m.fillRect(0, T - 5, W, 5);
    for (const b of BAYS) {
      m.fillStyle = col.water; m.beginPath(); m.roundRect(b * T + 1, 2, T - 2, T - 3, 8); m.fill();
      m.strokeStyle = '#4a3a22'; m.lineWidth = 1.5; m.stroke();
    }
    // the water
    m.fillStyle = col.water; m.fillRect(0, T, W, 5 * T);
    m.fillStyle = 'rgba(255,255,255,0.05)'; for (let r = 1; r <= 5; r++) m.fillRect(0, r * T + 14, W, 2);
    // the island: a concrete median with a painted curb and plant boxes
    m.fillStyle = col.island; m.fillRect(0, ISLAND * T, W, T);
    for (let x = 0; x < W; x += 16) { m.fillStyle = (x / 16) % 2 ? '#ffd23f' : '#23242c'; m.fillRect(x, ISLAND * T, 16, 3); m.fillRect(x, ISLAND * T + T - 3, 16, 3); }
    for (const px of [1, 13]) { m.fillStyle = '#5a3a1a'; m.fillRect(px * T + 3, ISLAND * T + 7, T - 6, T - 14); m.fillStyle = '#3fae5a'; for (let k = 0; k < 4; k++) { m.beginPath(); m.arc(px * T + 8 + k * 5, ISLAND * T + 11, 4, 0, TAU); m.fill(); } }
    // the road: asphalt, lane lines and a yellow line by the island
    m.fillStyle = col.road; m.fillRect(0, 7 * T, W, 5 * T);
    m.fillStyle = '#ffd23f'; m.fillRect(0, 7 * T + 1, W, 2);
    m.fillStyle = 'rgba(255,255,255,0.7)';
    for (let r = 8; r <= 11; r++) for (let x = 6; x < W; x += 28) m.fillRect(x, r * T - 1, 14, 2);
    m.fillStyle = 'rgba(255,255,255,0.05)'; for (let k = 0; k < 40; k++) { m.beginPath(); m.ellipse(Math.random() * W, 7 * T + Math.random() * 5 * T, rnd(6, 18), rnd(2, 4), 0, 0, TAU); m.fill(); } // puddles
    // the sidewalk, with its sign
    m.fillStyle = col.walk; m.fillRect(0, START * T, W, T);
    m.strokeStyle = 'rgba(0,0,0,0.12)'; for (let x = 0; x < W; x += 16) m.strokeRect(x + 0.5, START * T + 0.5, 16, T - 1);
    m.fillStyle = '#9a9a9a'; m.fillRect(0, START * T, W, 3);
    m.fillStyle = '#6b6b6b'; m.fillRect(30, START * T + 4, 2, T - 6);
    m.fillStyle = '#fff'; m.fillRect(8, START * T + 4, 46, 16); m.strokeStyle = '#e8384f'; m.lineWidth = 1.5; m.strokeRect(8.5, START * T + 4.5, 45, 15);
    m.fillStyle = '#e8384f'; m.font = FONT(800, 5.6); m.textAlign = 'center'; m.fillText('BAWAL TUMAWID', 31, START * T + 11); m.fillText('NAKAMAMATAY', 31, START * T + 17.5); m.textAlign = 'left';
    // a waiting shed on the right
    m.fillStyle = '#2f6fd6'; m.fillRect(W - 60, START * T + 3, 52, 6); m.fillStyle = '#6b6b6b'; m.fillRect(W - 58, START * T + 9, 2, T - 10); m.fillRect(W - 12, START * T + 9, 2, T - 10);
    scenes.set(key, c);
    return c;
  }

  // ---------- effects ----------
  const emit = (p) => { if (parts.length < (reduced ? 100 : 300)) parts.push({ g: 0, drag: 0.93, size: 2, ...p, max: p.life }); };
  const popup = (text, x, y, color, size = 12, life = 1.1) => popups.push({ text, x, y, color, size, life, max: life });

  function frogPos(g, alpha = 0) {
    const f = g.frog;
    if (f.hop) { const k = clamp((f.hop.t + alpha) / HOP, 0, 1); return [X(f.hop.fx + (f.hop.tx - f.hop.fx) * k) , RY(f.hop.frow + (f.hop.trow - f.hop.frow) * k) + T / 2, k]; }
    return [X(f.x), RY(f.row) + T / 2, 0];
  }

  function event(e, g) {
    const [fx, fy] = frogPos(g);
    switch (e.type) {
      case 'land':
        if (e.water) { rings.push({ x: fx, y: fy, r: 4, life: 0.5 }); }
        break;
      case 'home': {
        const x = BAYS[e.bay] * T + T / 2, y = RY(0) + T / 2;
        popup(`KOKAK! +${e.points}`, x, y + 18, '#7cf29a', 12, 1.4);
        if (e.lamok) popup('Sarap ng lamok!', x, y + 32, '#ffd23f', 11, 1.4);
        if (e.anak) popup('Salamat, Kuya!', x, y + 44, '#9ad7ff', 11, 1.4);
        for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; emit({ x, y, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, life: 0.6, color: pick(['#7cf29a', '#fff', '#ffd23f']) }); }
        break;
      }
      case 'levelClear': flash = reduced ? 0 : 0.3; popup('KUMPLETO ANG PAMILYA!', W / 2, RY(3), '#ffd23f', 18, 2.2); break;
      case 'died': {
        const txt = CAUSES[e.cause] || 'Aray!';
        popup(txt, clamp(fx, 60, W - 60), fy - 16, '#ff8ae2', 13, 1.4);
        if (isWater(e.row) || e.cause === 'tubig' || e.cause === 'anod') { rings.push({ x: fx, y: fy, r: 4, life: 0.8 }); for (let k = 0; k < 12; k++) emit({ x: fx, y: fy, vx: rnd(-50, 50), vy: rnd(-80, -10), g: 200, life: 0.6, color: 'rgba(200,230,255,0.9)' }); }
        else { shake = reduced ? 0 : 4; for (let k = 0; k < 10; k++) emit({ x: fx, y: fy, vx: rnd(-60, 60), vy: rnd(-60, 60), life: 0.5, color: pick(['#ffd23f', '#fff', '#7cf29a']) }); }
        break;
      }
      case 'lamok': popup('Bzzz!', BAYS[e.bay] * T + T / 2, RY(0) + 6, '#ffd23f', 10); break;
      case 'buwayaPeek': popup('?!', BAYS[e.bay] * T + T / 2, RY(0) + 4, '#ff5c5c', 12); break;
      case 'anak': popup('Kuya! Tulong!', W / 2, RY(e.row) - 2, '#9ad7ff', 11, 1.6); break;
      case 'anakAboard': popup('Sakay na, bunso!', fx, fy - 16, '#9ad7ff', 11); break;
      case 'extraLife': popup('EXTRA BUHAY!', W / 2, RY(6) + 20, '#7cf29a', 16, 1.6); break;
      case 'timeLow': popup('Bilis, Kokak!', W / 2, RY(START) - 6, '#ff9f43', 13); break;
      default: break;
    }
  }

  function updateFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= p.drag; p.vy *= p.g ? 1 : p.drag; }
    for (let i = popups.length - 1; i >= 0; i--) { const p = popups[i]; p.life -= dt; p.y -= 14 * dt; if (p.life <= 0) popups.splice(i, 1); }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.life -= dt; r.r += 30 * dt; if (r.life <= 0) rings.splice(i, 1); }
    flash = Math.max(0, flash - dt); shake = Math.max(0, shake - dt * 30);
  }

  // ---------- vehicles, drawn along their lane, nose first ----------
  function vehicle(type, x0, x1, y, dir, k, t, night, board) {
    const len = x1 - x0, cy = y + T / 2;
    ctx.save(); ctx.translate(dir > 0 ? x0 : x1, cy); ctx.scale(dir > 0 ? 1 : -1, 1); // now the nose points to +x at len
    const half = { motor: 5, pedicab: 9, tricycle: 10, taxi: 9, jeep: 11, kalesa: 10 }[type] || 12;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.roundRect(3, -half + 2, len - 4, half * 2, half); ctx.fill();
    switch (type) {
      case 'jeep': {
        const c = JEEPS[k % JEEPS.length];
        ctx.fillStyle = '#c9ccd4'; ctx.beginPath(); ctx.roundRect(len - 18, -9, 16, 18, 4); ctx.fill(); // the silver hood
        ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(2, -11, len - 18, 22, 3); ctx.fill();
        ctx.fillStyle = '#fff'; for (let s = 0; s < 3; s++) ctx.fillRect(4, -9 + s * 7, len - 24, 1.5); // the stripes
        ctx.fillStyle = '#23242c'; ctx.fillRect(len - 20, -8, 3, 16); // windshield
        ctx.fillStyle = '#fff'; ctx.fillRect(len - 34, -6, 13, 12);
        ctx.fillStyle = '#e8384f'; ctx.font = FONT(800, 4.6); ctx.save(); ctx.translate(len - 27.5, 0); ctx.rotate(Math.PI / 2 * (dir > 0 ? 1 : 1)); ctx.textAlign = 'center'; if (dir < 0) ctx.scale(-1, 1); ctx.fillText(board, 0, 1.6); ctx.restore();
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(len - 4, -5, 2, 2); ctx.fillRect(len - 4, 3, 2, 2); // the chrome horses
        break;
      }
      case 'bus': {
        ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.roundRect(2, -12, len - 4, 24, 4); ctx.fill();
        ctx.fillStyle = '#2f6fd6'; ctx.fillRect(2, -12, len - 4, 5); ctx.fillRect(2, 7, len - 4, 5);
        ctx.fillStyle = '#9aa0a6'; ctx.fillRect(14, -5, 14, 10); ctx.fillRect(len - 40, -5, 14, 10); // aircon
        ctx.fillStyle = '#23242c'; ctx.fillRect(len - 8, -9, 4, 18);
        ctx.fillStyle = '#2f6fd6'; ctx.font = FONT(800, 7); ctx.save(); if (dir < 0) { ctx.translate(len / 2, 0); ctx.scale(-1, 1); ctx.translate(-len / 2, 0); } ctx.textAlign = 'center'; ctx.fillText('P2P', len / 2, 3); ctx.restore();
        break;
      }
      case 'taxi':
        ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.roundRect(2, -9, len - 4, 18, 5); ctx.fill();
        ctx.fillStyle = '#23242c'; ctx.fillRect(len - 12, -7, 4, 14); ctx.fillRect(5, -6, 3, 12);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(len / 2 - 5, -3, 8, 6);
        break;
      case 'truck':
        ctx.fillStyle = '#8b5a2b'; ctx.fillRect(2, -12, len - 18, 24);
        ctx.fillStyle = '#c8894a'; for (let s = 6; s < len - 18; s += 9) ctx.fillRect(s, -10, 7, 20);
        ctx.fillStyle = '#e8384f'; ctx.beginPath(); ctx.roundRect(len - 16, -10, 14, 20, 3); ctx.fill();
        ctx.fillStyle = '#23242c'; ctx.fillRect(len - 7, -8, 3, 16);
        break;
      case 'tricycle':
        ctx.fillStyle = '#23242c'; ctx.fillRect(10, -4, len - 12, 4); // the motorbike
        ctx.fillStyle = '#e8384f'; ctx.beginPath(); ctx.arc(len - 12, -2, 4, 0, TAU); ctx.fill(); // rider
        ctx.fillStyle = JEEPS[(k + 2) % JEEPS.length]; ctx.beginPath(); ctx.roundRect(4, -1, len - 12, 12, 3); ctx.fill(); // sidecar
        ctx.fillStyle = '#fff'; ctx.fillRect(6, 2, len - 16, 2);
        break;
      case 'pedicab':
        ctx.strokeStyle = '#6b6b6b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(len - 4, -3); ctx.stroke();
        ctx.fillStyle = '#3fae5a'; ctx.beginPath(); ctx.arc(len - 12, -4, 3.5, 0, TAU); ctx.fill();
        ctx.fillStyle = '#2f6fd6'; ctx.beginPath(); ctx.roundRect(4, 0, len - 14, 10, 3); ctx.fill();
        break;
      case 'motor':
        ctx.fillStyle = '#23242c'; ctx.beginPath(); ctx.roundRect(6, -3, len - 10, 6, 3); ctx.fill();
        ctx.fillStyle = JEEPS[(k + 4) % JEEPS.length]; ctx.beginPath(); ctx.arc(len / 2, 0, 5, 0, TAU); ctx.fill(); // helmet
        ctx.fillStyle = '#fff'; ctx.fillRect(len / 2 + 1, -2, 3, 4);
        break;
      case 'kalesa': {
        const trot = Math.sin(t * 0.3) * 1.5;
        ctx.fillStyle = '#7a4a2a'; ctx.beginPath(); ctx.ellipse(len - 12, 0, 10, 5, 0, 0, TAU); ctx.fill(); // the horse
        ctx.beginPath(); ctx.ellipse(len - 3, trot * 0.5, 4, 3, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#b8742c'; ctx.beginPath(); ctx.roundRect(4, -10, len - 30, 20, 4); ctx.fill(); // carriage
        ctx.fillStyle = '#e8384f'; ctx.fillRect(6, -8, len - 34, 3); ctx.fillRect(6, 5, len - 34, 3);
        ctx.fillStyle = '#23242c'; ctx.fillRect(10, -12, 8, 2); ctx.fillRect(10, 10, 8, 2);
        break;
      }
      default: ctx.fillStyle = '#888'; ctx.fillRect(2, -10, len - 4, 20);
    }
    ctx.restore();
    if (night) { // headlights on the wet road
      const nx = dir > 0 ? x1 : x0;
      const gr = ctx.createRadialGradient(nx, cy, 2, nx + dir * 26, cy, 30);
      gr.addColorStop(0, 'rgba(255,240,180,0.5)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = gr; ctx.fillRect(nx + (dir > 0 ? 0 : -44), cy - 16, 44, 32);
    }
  }

  // ---------- floating things ----------
  function floater(type, o, lane, y, t) {
    const x0 = X(o.left), x1 = X(o.right), len = x1 - x0, cy = y + T / 2;
    const cells = Math.round(len / T);
    // going under: lower in the water, then just ripples
    let sink = 0;
    if (o.sub === 1 || o.sub === 3) sink = 0.5; else if (o.sub === 2) sink = 1;
    if (sink >= 1) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; for (let c = 0; c < cells; c++) { ctx.beginPath(); ctx.ellipse(x0 + c * T + T / 2, cy, 9, 4, 0, 0, TAU); ctx.stroke(); } return; }
    ctx.save(); ctx.globalAlpha = 1 - sink * 0.45;
    if (o.buwaya) { buwaya(x0, x1, cy, lane.dir, t); ctx.restore(); return; }
    switch (type) {
      case 'troso':
        ctx.fillStyle = '#6b4526'; ctx.beginPath(); ctx.roundRect(x0 + 1, cy - 10, len - 2, 20, 9); ctx.fill();
        ctx.strokeStyle = '#4a2e18'; ctx.lineWidth = 1; for (let s = x0 + 10; s < x1 - 8; s += 12) { ctx.beginPath(); ctx.moveTo(s, cy - 7); ctx.lineTo(s + 6, cy - 7); ctx.moveTo(s + 3, cy + 5); ctx.lineTo(s + 9, cy + 5); ctx.stroke(); }
        ctx.fillStyle = '#b8864a'; ctx.beginPath(); ctx.ellipse(x1 - 5, cy, 4, 9, 0, 0, TAU); ctx.fill();
        break;
      case 'balsa':
        for (let s = 0; s < 4; s++) { ctx.fillStyle = s % 2 ? '#c9b35a' : '#b5a04a'; ctx.beginPath(); ctx.roundRect(x0 + 1, cy - 11 + s * 5.5, len - 2, 5, 2.5); ctx.fill(); }
        ctx.fillStyle = '#6b4a2a'; for (let s = x0 + 8; s < x1; s += 22) ctx.fillRect(s, cy - 11, 2, 22);
        break;
      case 'pagong':
        for (let c = 0; c < cells; c++) {
          const px = x0 + c * T + T / 2;
          ctx.fillStyle = '#3f7a35'; for (const [a, b] of [[-8, -7], [8, -7], [-8, 7], [8, 7]]) { ctx.beginPath(); ctx.ellipse(px + a, cy + b, 3.5, 2.5, 0, 0, TAU); ctx.fill(); }
          ctx.beginPath(); ctx.arc(px + lane.dir * 12, cy, 3.5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#5f9a3a'; ctx.beginPath(); ctx.ellipse(px, cy, 10, 9, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#3f6a28'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px - 5, cy - 6); ctx.lineTo(px + 5, cy + 6); ctx.moveTo(px + 5, cy - 6); ctx.lineTo(px - 5, cy + 6); ctx.stroke();
        }
        break;
      case 'salbabida':
        for (let c = 0; c < cells; c++) { const px = x0 + c * T + T / 2; for (let s = 0; s < 8; s++) { ctx.strokeStyle = s % 2 ? '#fff' : '#ff6b3d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(px, cy, 9, (s / 8) * TAU, ((s + 1) / 8) * TAU); ctx.stroke(); } }
        break;
      case 'batya':
        for (let c = 0; c < cells; c++) { const px = x0 + c * T + T / 2; ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.arc(px, cy, 12, 0, TAU); ctx.fill(); ctx.fillStyle = '#c3c8cc'; ctx.beginPath(); ctx.arc(px, cy, 9, 0, TAU); ctx.fill(); ctx.fillStyle = '#6b757c'; ctx.fillRect(px - 13, cy - 1.5, 3, 3); ctx.fillRect(px + 10, cy - 1.5, 3, 3); }
        break;
      case 'banig':
        ctx.fillStyle = '#d9b77a'; ctx.fillRect(x0 + 1, cy - 11, len - 2, 22);
        for (let s = 0; s < 5; s++) { ctx.fillStyle = ['#e8384f', '#3fae5a', '#2f6fd6', '#ffd23f', '#ff8ae2'][s]; ctx.fillRect(x0 + 1, cy - 9 + s * 4, len - 2, 1.6); }
        ctx.strokeStyle = 'rgba(80,50,20,0.4)'; for (let s = x0 + 4; s < x1; s += 6) { ctx.beginPath(); ctx.moveTo(s, cy - 11); ctx.lineTo(s, cy + 11); ctx.stroke(); }
        break;
      case 'styro':
        for (let c = 0; c < cells; c++) { const px = x0 + c * T + 3; ctx.fillStyle = '#f4f4f4'; ctx.fillRect(px, cy - 10, T - 6, 20); ctx.strokeStyle = '#c9c9c9'; ctx.strokeRect(px + 0.5, cy - 9.5, T - 7, 19); ctx.fillStyle = '#e8384f'; ctx.fillRect(px + 4, cy - 2, T - 14, 3); }
        break;
      case 'lily':
        for (let c = 0; c < cells; c++) { const px = x0 + c * T + T / 2; for (const [a, b] of [[-6, -4], [6, -3], [0, 5], [-7, 6], [7, 6]]) { ctx.fillStyle = '#3f8f3a'; ctx.beginPath(); ctx.arc(px + a, cy + b, 6, 0, TAU); ctx.fill(); } ctx.fillStyle = '#b88ad6'; ctx.beginPath(); ctx.arc(px, cy - 2, 3.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(px, cy - 2, 1.2, 0, TAU); ctx.fill(); }
        break;
      case 'bangka':
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 + 6, cy - 13); ctx.lineTo(x1 - 6, cy - 13); ctx.moveTo(x0 + 6, cy + 13); ctx.lineTo(x1 - 6, cy + 13); for (const s of [x0 + len * 0.3, x0 + len * 0.7]) { ctx.moveTo(s, cy - 13); ctx.lineTo(s, cy + 13); } ctx.stroke();
        ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.moveTo(x0 + 2, cy); ctx.quadraticCurveTo(x0 + 8, cy - 8, x0 + 16, cy - 8); ctx.lineTo(x1 - 16, cy - 8); ctx.quadraticCurveTo(x1 - 8, cy - 8, x1 - 2, cy); ctx.quadraticCurveTo(x1 - 8, cy + 8, x1 - 16, cy + 8); ctx.lineTo(x0 + 16, cy + 8); ctx.quadraticCurveTo(x0 + 8, cy + 8, x0 + 2, cy); ctx.fill();
        ctx.fillStyle = '#2f6fd6'; ctx.fillRect(x0 + 12, cy - 2, len - 24, 4);
        break;
      case 'ferry':
        ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.roundRect(x0 + 1, cy - 12, len - 2, 24, 10); ctx.fill();
        ctx.fillStyle = '#2f6fd6'; ctx.fillRect(x0 + 8, cy - 12, len - 16, 4); ctx.fillRect(x0 + 8, cy + 8, len - 16, 4);
        ctx.fillStyle = '#9ad7ff'; for (let s = x0 + 14; s < x1 - 14; s += 12) ctx.fillRect(s, cy - 6, 7, 12);
        break;
      default: ctx.fillStyle = '#6b4526'; ctx.fillRect(x0, cy - 9, len, 18);
    }
    ctx.restore();
  }

  function buwaya(x0, x1, cy, dir, t) {
    ctx.save(); ctx.translate(dir > 0 ? x0 : x1, cy); ctx.scale(dir > 0 ? 1 : -1, 1);
    const len = x1 - x0;
    ctx.fillStyle = '#3f6a28';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(10, -6, 24, -9); ctx.lineTo(len - 26, -10); ctx.lineTo(len - 2, -5); ctx.lineTo(len - 2, 5); ctx.lineTo(len - 26, 10); ctx.lineTo(24, 9); ctx.quadraticCurveTo(10, 6, 0, 0); ctx.fill();
    ctx.fillStyle = '#5f8f3a'; for (let s = 26; s < len - 30; s += 8) { ctx.beginPath(); ctx.arc(s, 0, 2.5, 0, TAU); ctx.fill(); }
    const jaw = 2 + Math.abs(Math.sin(t * 0.08)) * 3;
    ctx.fillStyle = '#fff'; for (let s = len - 24; s < len - 4; s += 4) { ctx.beginPath(); ctx.moveTo(s, -jaw); ctx.lineTo(s + 2, -jaw - 2.5); ctx.lineTo(s + 4, -jaw); ctx.moveTo(s, jaw); ctx.lineTo(s + 2, jaw + 2.5); ctx.lineTo(s + 4, jaw); ctx.fill(); }
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(len - 22, -7, 2.4, 0, TAU); ctx.arc(len - 22, 7, 2.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#23242c'; ctx.fillRect(len - 23, -8, 1.4, 2.4); ctx.fillRect(len - 23, 6, 1.4, 2.4);
    ctx.restore();
  }

  // ---------- Kokak ----------
  function frog(x, y, dir, k, s = 1, color = '#4fbf4a', hat = true) {
    const ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][dir] + Math.PI / 2; // sprite faces up
    const stretch = Math.sin(k * Math.PI);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(1, 3, 10, 9, 0, 0, TAU); ctx.fill();
    // legs, stretched mid-hop
    ctx.fillStyle = shade(color, -0.2);
    const reach = 2 + stretch * 6;
    for (const sx of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(sx * 9, 7 + reach * 0.6, 3, 5 + reach * 0.4, sx * 0.4, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx * 8, -6 - stretch * 2, 2.5, 3.5, -sx * 0.4, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(0, 1, 9, 10, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(color, -0.25); for (const [a, b] of [[-3, 3], [3, 5], [0, 7]]) { ctx.beginPath(); ctx.arc(a, b, 1.6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4.5, -7, 3.6, 0, TAU); ctx.arc(4.5, -7, 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#23242c'; ctx.beginPath(); ctx.arc(-4.5, -8, 1.8, 0, TAU); ctx.arc(4.5, -8, 1.8, 0, TAU); ctx.fill();
    if (hat) { ctx.fillStyle = '#2f9a3a'; ctx.beginPath(); ctx.ellipse(0, -1, 6, 4, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#1f6a28'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-6, -1); ctx.lineTo(6, -1); ctx.stroke(); } // his gabi-leaf hat
    ctx.restore();
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), f = (v) => clamp(Math.round(v * (1 + k)), 0, 255);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function deadFrog(g, t, x, y) {
    const f = g.frog, k = 1 - g.phaseT / 72;
    const water = ['tubig', 'anod'].includes(f.dead);
    if (water) {
      ctx.globalAlpha = 1 - k; frog(x, y + k * 4, f.dir, 0, 1 - k * 0.5); ctx.globalAlpha = 1;
      if (!reduced) for (let b = 0; b < 3; b++) { ctx.fillStyle = 'rgba(220,240,255,0.8)'; ctx.beginPath(); ctx.arc(x - 5 + b * 5, y - (t * 20 + b * 7) % 18, 1.6, 0, TAU); ctx.fill(); }
    } else if (f.dead === 'oras') {
      frog(x, y, f.dir, 0); ctx.fillStyle = '#fff8e1'; ctx.font = FONT(800, 10); ctx.fillText('z', x + 8, y - 10 - (k * 8)); ctx.fillText('z', x + 13, y - 16 - (k * 8));
    } else {
      ctx.save(); ctx.translate(x, y); ctx.scale(1.3, 0.35 + 0.1 * Math.sin(k * 10)); ctx.translate(-x, -y); frog(x, y, f.dir, 0); ctx.restore();
      for (let s = 0; s < 3; s++) { const a = t * 5 + (s * TAU) / 3; star(x + Math.cos(a) * 11, y - 8 + Math.sin(a) * 4); }
    }
  }
  function star(x, y) {
    ctx.fillStyle = '#ffd23f'; ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 1.4 : 3.4; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  }

  // ---------- the leaves at the top ----------
  function bays(g, t) {
    for (let b = 0; b < BAYS.length; b++) {
      const x = BAYS[b] * T + T / 2, y = RY(0) + T / 2;
      // the gabi leaf, heart shaped
      ctx.fillStyle = '#2f8f3a'; ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.bezierCurveTo(x - 14, y + 2, x - 11, y - 11, x, y - 5); ctx.bezierCurveTo(x + 11, y - 11, x + 14, y + 2, x, y + 9); ctx.fill();
      ctx.strokeStyle = '#6fbf5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 8); ctx.stroke();
      if (g.homes[b]) { frog(x, y, 2, 0, 0.8, ['#4fbf4a', '#7ccf5a', '#3faf7a', '#8fcf4a', '#5fbf8a'][b], false); ctx.fillStyle = '#ff8ae2'; ctx.font = FONT(800, 8); ctx.textAlign = 'center'; if (Math.floor(t * 1.5 + b) % 4 === 0) ctx.fillText('♥', x + 9, y - 8); ctx.textAlign = 'left'; }
      if (g.lamok && g.lamok.bay === b) { const lx = x + Math.cos(t * 9) * 5, ly = y - 3 + Math.sin(t * 13) * 3; ctx.fillStyle = '#23242c'; ctx.beginPath(); ctx.ellipse(lx, ly, 3, 1.8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(lx - 1, ly - 3, 1.6, 2.6, -0.4, 0, TAU); ctx.ellipse(lx + 1.5, ly - 3, 1.6, 2.6, 0.4, 0, TAU); ctx.fill(); }
      if (g.buwaya && g.buwaya.bay === b) {
        const warn = g.buwaya.t > BAY_BUWAYA.stay;
        ctx.fillStyle = '#3f6a28';
        if (warn) { ctx.beginPath(); ctx.arc(x - 5, y + 2, 3.4, 0, TAU); ctx.arc(x + 5, y + 2, 3.4, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x - 5, y + 1.5, 1.6, 0, TAU); ctx.arc(x + 5, y + 1.5, 1.6, 0, TAU); ctx.fill(); }
        else { ctx.beginPath(); ctx.roundRect(x - 9, y - 12, 18, 24, 7); ctx.fill(); ctx.fillStyle = '#fff'; for (let s = -7; s < 7; s += 3.5) { ctx.beginPath(); ctx.moveTo(s, 0); ctx.moveTo(x + s, y + 6); ctx.lineTo(x + s + 1.75, y + 9); ctx.lineTo(x + s + 3.5, y + 6); ctx.fill(); } ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x - 4, y - 5, 2, 0, TAU); ctx.arc(x + 4, y - 5, 2, 0, TAU); ctx.fill(); }
      }
    }
  }

  // ---------- the HUD ----------
  function hud(g, best) {
    ctx.fillStyle = '#12141f'; ctx.fillRect(0, 0, W, TOP);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillStyle = '#cfd0f0'; ctx.font = FONT(700, 10); ctx.fillText('PUNTOS', 12, 13);
    ctx.fillStyle = '#ffd23f'; ctx.font = FONT(800, 18); ctx.fillText(String(g.score).padStart(6, '0'), 12, 32);
    ctx.textAlign = 'right'; ctx.fillStyle = '#cfd0f0'; ctx.font = FONT(700, 10); ctx.fillText('BEST', W - 12, 13);
    ctx.fillStyle = '#ff8ae2'; ctx.font = FONT(800, 18); ctx.fillText(String(Math.max(best, g.score)).padStart(6, '0'), W - 12, 32);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff8e1'; ctx.font = FONT(800, 15); ctx.fillText(`${g.def.name} · ${g.def.road}`, W / 2, 18);
    ctx.fillStyle = '#9ad7ff'; ctx.font = FONT(700, 11); ctx.fillText(`Level ${g.level}${g.loop ? ` · Ikot ${g.loop + 1}` : ''} · ${g.def.water}`, W / 2, 35);
    // bottom: lives and the time
    const by = H - BOTTOM;
    ctx.fillStyle = '#12141f'; ctx.fillRect(0, by, W, BOTTOM);
    for (let k = 0; k < Math.min(g.lives - (g.phase === 'dying' ? 0 : 1), 7); k++) frog(16 + k * 20, by + BOTTOM / 2, 0, 0, 0.62);
    const frac = clamp(g.timeLeft / (g.diff.timer * 60), 0, 1);
    const bw = 160, bx = W - bw - 96; // the pause button sits at the right end
    ctx.textAlign = 'right'; ctx.fillStyle = '#cfd0f0'; ctx.font = FONT(800, 11); ctx.fillText('ORAS', bx - 6, by + BOTTOM / 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.roundRect(bx, by + 12, bw, 12, 6); ctx.fill();
    ctx.fillStyle = frac < 0.25 ? '#ff5c5c' : frac < 0.5 ? '#ffb36b' : '#7cf29a';
    ctx.beginPath(); ctx.roundRect(bx + bw * (1 - frac), by + 12, bw * frac, 12, 6); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  function banner(text, sub, color = '#ffd23f') {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const y = RY(6) + T / 2;
    ctx.fillStyle = 'rgba(10,10,24,0.75)'; ctx.fillRect(0, y - 30, W, sub ? 60 : 44);
    ctx.font = FONT(800, 24); ctx.lineWidth = 5; ctx.strokeStyle = '#12141f'; ctx.strokeText(text, W / 2, y - (sub ? 8 : 0) - 6);
    ctx.fillStyle = color; ctx.fillText(text, W / 2, y - (sub ? 8 : 0) - 6);
    if (sub) { ctx.font = FONT(700, 13); ctx.fillStyle = '#fff8e1'; ctx.fillText(sub, W / 2, y + 16); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ---------- the frame ----------
  function draw(g, t, opts = {}) {
    reduced = !!opts.reduced;
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1);
    lastT = t;
    updateFx(dt);
    const k = canvas.width / W;
    const alpha = g.phase === 'play' || g.phase === 'ready' || g.phase === 'dying' ? clamp(g.acc / TICK, 0, 1) : 0;
    const tt = g.tick + alpha; // every lane is a function of time: draw it exactly between ticks
    const sx = shake && !reduced ? rnd(-shake, shake) : 0, sy = shake && !reduced ? rnd(-shake, shake) : 0;
    ctx.setTransform(k, 0, 0, canvas.height / H, sx * k, sy * k);
    ctx.drawImage(scene(g), 0, TOP, W, ROWS * T);
    // the water moves: little wave marks drifting with each lane
    for (let r = 1; r <= 5; r++) {
      const l = g.lanes[r]; if (!l) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      const off = ((X(l.dir * l.speed * tt) % 40) + 40) % 40;
      for (let x = -40 + off; x < W; x += 40) ctx.fillRect(x, RY(r) + 6 + (r % 2) * 16, 12, 1.5);
    }
    bays(g, t);
    for (let r = 1; r <= 11; r++) {
      const l = g.lanes[r]; if (!l) continue;
      for (const o of objectsAt(l, tt)) {
        if (o.right < -T || o.left > CELL * COLS + CELL) continue;
        if (l.kind === 'water') floater(l.type, o, l, RY(r), tt);
        else vehicle(l.type, X(o.left), X(o.right), RY(r), l.dir, o.k, tt, g.def.night, g.def.board);
      }
    }
    if (g.anak) {
      const ax = X(anakX(g, tt)), ay = RY(g.anak.row) + T / 2;
      frog(ax, ay + (reduced ? 0 : Math.sin(t * 6) * 1), 2, 0, 0.55, '#9ad76a', false);
    }
    if (g.snake) {
      const sxp = X(snakeX(g, tt)), syp = RY(ISLAND) + T / 2, dirR = Math.sin(((tt * g.snake.speed) / ((COLS - 1) * CELL)) * Math.PI) >= 0;
      ctx.strokeStyle = '#3fae5a'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
      for (let s = 0; s <= 10; s++) { const px = sxp - 22 + s * 4.4; ctx.lineTo(px, syp + Math.sin(s * 1.2 + t * 8) * 3); }
      ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = '#2f8f3a'; ctx.beginPath(); ctx.arc(sxp + (dirR ? 22 : -22), syp, 4.5, 0, TAU); ctx.fill();
      ctx.fillStyle = '#e8384f'; ctx.fillRect(sxp + (dirR ? 26 : -30), syp - 0.6, 4, 1.2);
    }
    // Kokak
    if (g.phase !== 'over' && g.phase !== 'clear') {
      const [fx, fy, hk] = frogPos(g, alpha);
      if (g.phase === 'dying') deadFrog(g, t, fx, fy);
      else {
        frog(fx, fy - Math.sin(hk * Math.PI) * 4, g.frog.dir, hk, 1 + Math.sin(hk * Math.PI) * 0.12);
        if (g.frog.carry) frog(fx, fy - 2, g.frog.dir, 0, 0.5, '#9ad76a', false);
      }
    }
    // splashes and bits
    for (const r of rings) { ctx.strokeStyle = `rgba(230,245,255,${clamp(r.life * 1.4, 0, 1)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * 1.4, r.r * 0.7, 0, 0, TAU); ctx.stroke(); }
    for (const p of parts) { ctx.globalAlpha = clamp((p.life / p.max) * 1.5, 0, 1); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    // the night, and the rain
    if (g.def.night) {
      const gr = ctx.createRadialGradient(W / 2, RY(6), 60, W / 2, RY(6), 360);
      gr.addColorStop(0, 'rgba(8,10,30,0.15)'); gr.addColorStop(1, 'rgba(8,10,30,0.55)');
      ctx.fillStyle = gr; ctx.fillRect(0, TOP, W, ROWS * T);
      for (const lx of [3, 11]) { const glow = ctx.createRadialGradient(lx * T, RY(ISLAND) + T / 2, 2, lx * T, RY(ISLAND) + T / 2, 70); glow.addColorStop(0, 'rgba(255,214,120,0.35)'); glow.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = glow; ctx.fillRect(lx * T - 70, RY(ISLAND) - 54, 140, 140); ctx.fillStyle = '#ffe6a0'; ctx.beginPath(); ctx.arc(lx * T, RY(ISLAND) + T / 2, 3, 0, TAU); ctx.fill(); }
    }
    drawRain(g, dt);
    if (flash > 0) { ctx.fillStyle = `rgba(255,248,220,${flash})`; ctx.fillRect(0, TOP, W, ROWS * T); }
    ctx.setTransform(k, 0, 0, canvas.height / H, 0, 0);
    hud(g, opts.best || 0);
    ctx.textAlign = 'center';
    for (const p of popups) {
      const a = clamp((p.life / p.max) * 2, 0, 1);
      ctx.font = FONT(800, p.size); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(18,20,31,${a})`; ctx.strokeText(p.text, p.x, p.y);
      ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y); ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
    if (g.phase === 'ready') banner(`${g.def.name} · ${g.def.road}`, 'Tawid na, Kokak!');
    if (opts.banner) banner(...opts.banner);
  }

  function drawRain(g, dt) {
    const want = Math.round((reduced ? 30 : 140) * g.def.rain);
    if (!rain) rain = [];
    while (rain.length < want) rain.push({ x: Math.random() * W, y: TOP + Math.random() * ROWS * T, v: rnd(260, 380) });
    if (rain.length > want) rain.length = want;
    ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
    for (const d of rain) {
      d.y += d.v * dt; d.x -= d.v * 0.25 * dt;
      if (d.y > TOP + ROWS * T) { d.y = TOP; d.x = Math.random() * (W + 60); if (!reduced && Math.random() < 0.3) rings.push({ x: d.x - 20, y: TOP + Math.random() * ROWS * T, r: 1, life: 0.35 }); }
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 2, d.y - 7);
    }
    ctx.stroke();
    if (rings.length > 80) rings.splice(0, rings.length - 80);
  }

  function reset() { parts.length = 0; popups.length = 0; rings.length = 0; flash = 0; shake = 0; }
  return { draw, resize, event, reset, frogIcon: frog };
}
