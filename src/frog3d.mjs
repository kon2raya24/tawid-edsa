// Kokak, modelled and animated in code: a glossy, spotted palaka with big eyes that blink and follow the
// traffic, a throat that breathes, jointed legs that fold at rest and kick out in a hop, and his gabi-leaf
// hat. pose() takes what the view knows (the hop, the landing, the idle time, death) and sets every joint:
// a crouch before take-off, stretch in the air, squash on landing with a springy recovery.
import * as THREE from './vendor/three.module.min.js';
import { gabiLeafGeo } from './models3d.mjs';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const HP = Math.PI / 2;

// the rear leg's joint angles (in the leg's own plane): folded at rest, straight out behind in a jump
const REST = { hip: -0.36, knee: -2.45, ankle: 2.66 }, KICK = { hip: -2.7, knee: -0.3, ankle: -0.2 };

export function createKokak(mats, { scale = 1 } = {}) {
  const root = new THREE.Group(); root.name = 'Kokak';
  const squash = new THREE.Group(); root.add(squash);
  const body = new THREE.Group(); squash.add(body);
  const m = (geo, mat, x = 0, y = 0, z = 0, parent = body) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
  const ball = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);

  // the body and head, one smooth shape: wide at the back, a round snout
  const torso = m(ball(0.5, 36, 24), mats.skin, 0.0, 0.4, 0);
  torso.scale.set(1.12, 0.7, 0.95);
  const snout = m(ball(0.36, 28, 18), mats.skin, 0.3, 0.44, 0);
  snout.scale.set(1.0, 0.66, 1.08);
  const throat = m(ball(0.26, 18, 12), mats.belly, 0.34, 0.26, 0); throat.scale.set(1.1, 0.7, 1.2);
  // the mouth: a long smile around the snout
  const mouth = m(new THREE.TorusGeometry(0.36, 0.016, 5, 26, Math.PI * 0.86), mats.dark, 0.3, 0.36, 0);
  mouth.rotation.set(HP, 0, -Math.PI * 0.43); mouth.scale.set(1.02, 1.1, 1);
  for (const s of [-1, 1]) { const n = m(ball(0.022, 6, 5), mats.dark, 0.63, 0.5, s * 0.07); n.castShadow = false; }
  for (const s of [-1, 1]) { const c = m(new THREE.CircleGeometry(0.07, 12), mats.blush, 0.46, 0.38, s * 0.3); c.rotation.y = s * 0.9; c.castShadow = false; }
  // the eyes: bumps on the head, big glossy balls, lids that blink
  const eyes = [];
  for (const s of [-1, 1]) {
    m(ball(0.2, 20, 14), mats.skin, 0.22, 0.64, s * 0.24);
    const pivot = new THREE.Group(); pivot.position.set(0.26, 0.72, s * 0.25); body.add(pivot);
    const eye = m(ball(0.17, 24, 16), mats.eye, 0, 0, 0, pivot); eye.rotation.y = -s * 0.42;
    const lid = m(new THREE.SphereGeometry(0.185, 20, 10, 0, Math.PI * 2, 0, HP), mats.skin, 0, 0, 0, pivot);
    lid.rotation.set(0, 0, 0); lid.castShadow = false;
    eyes.push({ pivot, eye, lid, s });
  }
  // his gabi-leaf hat
  const hat = m(gabiLeafGeo(0.5), mats.hat, -0.06, 0.8, 0); hat.rotation.set(0.1, Math.PI, -0.18);
  const stem = m(new THREE.CylinderGeometry(0.015, 0.02, 0.18, 6), mats.hat, -0.02, 0.86, 0); stem.rotation.z = 0.9;

  // legs: groups at each joint, so a leg folds and kicks like a leg
  const limb = (len, r, mat, parent) => { const g = new THREE.Group(); parent.add(g); const o = m(new THREE.CapsuleGeometry(r, len, 4, 12), mat, len / 2, 0, 0, g); o.rotation.z = -HP; return g; };
  const rear = [], front = [];
  for (const s of [-1, 1]) {
    const hipAt = new THREE.Group(); hipAt.position.set(-0.3, 0.3, s * 0.34); hipAt.rotation.y = s * 0.28; squash.add(hipAt);
    const leg = mats.leg || mats.skin;
    const hip = limb(0.26, 0.13, leg, hipAt);
    const knee = limb(0.34, 0.085, leg, hip); knee.position.x = 0.34;
    const ankle = new THREE.Group(); ankle.position.x = 0.4; knee.add(ankle);
    const foot = m(ball(0.14, 14, 8), leg, 0.18, -0.02, 0, ankle); foot.scale.set(1.7, 0.3, 1.1);
    for (const t of [-1, 0, 1]) { const toe = m(ball(0.045, 8, 6), leg, 0.4, -0.02, t * 0.1, ankle); toe.scale.set(1.2, 0.7, 1); }
    rear.push({ hip, knee, ankle, s });
    const sh = new THREE.Group(); sh.position.set(0.3, 0.32, s * 0.32); squash.add(sh);
    const arm = limb(0.2, 0.065, leg, sh);
    const hand = m(ball(0.08, 10, 8), leg, 0.3, 0, 0, arm); hand.scale.set(1.2, 0.5, 1.3);
    for (const t of [-1, 0, 1]) m(ball(0.03, 6, 5), leg, 0.36, -0.01, t * 0.06, arm);
    front.push({ sh, arm, s });
  }
  root.scale.setScalar(scale);

  const st = { blink: 2 + Math.random() * 3, blinkT: 0, look: new THREE.Vector2(), breath: Math.random() * 6 };
  // One frame's pose. p: { hop (0..1 or -1), land (seconds since landing), idle (s), dead, deadT (0..1),
  // look: [yaw, pitch] of what matters, from Kokak's nose, reduced, dt }.
  function pose(p) {
    const dt = p.dt || 0;
    st.breath += dt;
    const hop = p.hop >= 0 ? p.hop : -1;
    // squash and stretch: a crouch at take-off, long in the air, flattened on landing, a springy recovery
    let sy = 1, pitch = 0;
    if (hop >= 0) {
      const crouch = 1 - smooth(0, 0.16, hop), air = smooth(0.08, 0.42, hop) * (1 - smooth(0.62, 1, hop));
      sy = 1 - 0.24 * crouch * (hop < 0.16 ? 1 : 0) + 0.2 * air;
      pitch = -0.3 * air + 0.22 * smooth(0.7, 1, hop);
    } else if (p.land < 0.4) {
      const t = p.land / 0.4; // a damped spring after landing
      sy = 1 - 0.26 * Math.exp(-t * 4) * Math.cos(t * 9);
    }
    if (!p.reduced && hop < 0) sy *= 1 + Math.sin(st.breath * 3.1) * 0.012;
    if (p.dead) ({ sy, pitch } = deathPose(p, sy, pitch));
    const sxz = 1 / Math.sqrt(Math.max(0.2, sy));
    squash.scale.set(sxz, sy, sxz);
    body.rotation.z = -pitch;
    throat.scale.set(1.1, 0.7 + (p.reduced || hop >= 0 ? 0 : Math.max(0, Math.sin(st.breath * 3.1)) * 0.12), 1.2 + (hop >= 0 ? 0 : Math.max(0, Math.sin(st.breath * 3.1)) * 0.14));
    // legs: folded, kicked out in the air, reaching to land
    const kick = hop >= 0 ? smooth(0, 0.2, hop) * (1 - smooth(0.55, 0.95, hop)) : 0;
    const landK = p.land < 0.25 ? 1 - p.land / 0.25 : 0;
    for (const L of rear) {
      const k = p.dead === 'flat' ? 0.6 : kick;
      L.hip.rotation.z = lerp(REST.hip, KICK.hip, k) + landK * 0.12;
      L.knee.rotation.z = lerp(REST.knee, KICK.knee, k);
      L.ankle.rotation.z = lerp(REST.ankle, KICK.ankle, k);
    }
    const reach = hop >= 0 ? smooth(0.45, 0.85, hop) : 0, tuck = hop >= 0 ? smooth(0, 0.2, hop) * (1 - reach) : 0;
    for (const A of front) { A.sh.rotation.z = -1.25 + reach * 0.85 + tuck * -0.5 + landK * 0.3; A.sh.rotation.y = A.s * (0.35 - reach * 0.2); }
    // blinking, and the eyes following what matters
    st.blink -= dt;
    if (st.blink <= 0) { st.blinkT = 0.14; st.blink = 1.8 + Math.random() * 3.5; }
    st.blinkT = Math.max(0, st.blinkT - dt);
    const shut = p.dead === 'sleep' ? 1 : p.dead ? 0.35 : hop >= 0 ? 0 : st.blinkT > 0 ? Math.sin((st.blinkT / 0.14) * Math.PI) : 0;
    if (p.look) st.look.lerp(new THREE.Vector2(p.look[0], p.look[1]), Math.min(1, dt * 8)); else st.look.multiplyScalar(Math.max(0, 1 - dt * 3));
    for (const E of eyes) {
      E.lid.rotation.z = lerp(1.25, -0.55, shut); // the lid rolls down over the eye
      E.eye.rotation.set(0, -E.s * 0.42 + clamp(st.look.x, -0.7, 0.7), clamp(st.look.y, -0.3, 0.3));
      E.eye.scale.setScalar(p.dead === 'flat' ? 1.15 : 1);
    }
  }
  function deathPose(p, sy, pitch) {
    const k = p.deadT;
    switch (p.dead) {
      case 'flat': return { sy: lerp(1, 0.16, smooth(0, 0.12, k)), pitch: 0 };
      case 'squeeze': return { sy: 1 + Math.sin(k * 30) * 0.2 * (1 - k), pitch: Math.sin(k * 20) * 0.2 };
      case 'bonk': return { sy: 1 - 0.3 * Math.exp(-k * 8), pitch: -0.4 * smooth(0, 0.2, k) };
      case 'sleep': return { sy: lerp(1, 0.82, smooth(0, 0.4, k)), pitch: 0.12 * smooth(0, 0.4, k) };
      default: return { sy, pitch };
    }
  }
  pose({ hop: -1, land: 9, dt: 0 });
  return { root, pose, eyes };
}

// Canvas textures for Kokak: the spotted skin (belly pale below), the eye with a frog's pupil, the hat.
export function frogTextures(T) {
  const skin = T.canvas(512, 256), x = skin.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#4cc23a'); g.addColorStop(0.45, '#6ee04a'); g.addColorStop(0.62, '#a6ec6a'); g.addColorStop(0.7, '#e8e6a0'); g.addColorStop(1, '#f2eec0');
  x.fillStyle = g; x.fillRect(0, 0, 512, 256);
  const r = T.rng(77);
  for (let k = 0; k < 70; k++) {
    const sx = r() * 512, sy = 10 + r() * 130, rad = 4 + r() * 12;
    x.fillStyle = `rgba(30,80,30,${0.35 + r() * 0.35})`; x.beginPath(); x.ellipse(sx, sy, rad * 1.3, rad, r() * 3, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(160,230,120,0.25)'; x.beginPath(); x.ellipse(sx - 1, sy - 1, rad * 0.5, rad * 0.35, 0, 0, Math.PI * 2); x.fill();
  }
  for (let k = 0; k < 2500; k++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,200' : '20,60,20'},${r() * 0.08})`; x.fillRect(r() * 512, r() * 256, 2, 2); }
  const eye = T.canvas(256, 128), e = eye.getContext('2d');
  e.fillStyle = '#f4f2e8'; e.fillRect(0, 0, 256, 128);
  const cx = 128, cy = 64;
  const ir = e.createRadialGradient(cx, cy, 2, cx, cy, 30); ir.addColorStop(0, '#f8d060'); ir.addColorStop(0.6, '#c88a1a'); ir.addColorStop(1, '#5a3a0a');
  e.fillStyle = ir; e.beginPath(); e.ellipse(cx, cy, 30, 34, 0, 0, Math.PI * 2); e.fill();
  e.fillStyle = '#0a0806'; e.beginPath(); e.ellipse(cx, cy, 20, 12, 0, 0, Math.PI * 2); e.fill();
  e.fillStyle = 'rgba(255,255,255,0.95)'; e.beginPath(); e.ellipse(cx - 9, cy - 11, 6, 5, 0, 0, Math.PI * 2); e.fill();
  e.strokeStyle = '#2a1a06'; e.lineWidth = 3; e.beginPath(); e.ellipse(cx, cy, 30, 34, 0, 0, Math.PI * 2); e.stroke();
  const leaf = T.canvas(256, 256), l = leaf.getContext('2d');
  const lg = l.createRadialGradient(128, 128, 10, 128, 128, 150); lg.addColorStop(0, '#5ab048'); lg.addColorStop(1, '#2f7a2a');
  l.fillStyle = lg; l.fillRect(0, 0, 256, 256);
  l.strokeStyle = 'rgba(200,240,160,0.55)'; l.lineWidth = 3;
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; l.beginPath(); l.moveTo(128, 128); l.quadraticCurveTo(128 + Math.cos(a + 0.2) * 60, 128 + Math.sin(a + 0.2) * 60, 128 + Math.cos(a) * 128, 128 + Math.sin(a) * 128); l.stroke(); }
  // the legs: the same green and spots, no pale belly
  const legC = T.canvas(256, 128), lx = legC.getContext('2d');
  lx.fillStyle = '#5ccf46'; lx.fillRect(0, 0, 256, 128);
  for (let k = 0; k < 30; k++) { lx.fillStyle = `rgba(30,90,30,${0.35 + r() * 0.3})`; lx.beginPath(); lx.ellipse(r() * 256, r() * 128, 6 + r() * 8, 4 + r() * 6, r() * 3, 0, Math.PI * 2); lx.fill(); }
  return { skin: T.toTex(skin), eye: T.toTex(eye), leaf: T.toTex(leaf), leg: T.toTex(legC) };
}
