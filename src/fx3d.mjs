// Effects: the rain (streaks falling through the whole view, drawn on the GPU), the rain's splashes on the
// street, sparks, droplets and leaves thrown by the game's moments, and words that float up from where
// things happen (in the page, over the canvas, so they stay crisp).
import * as THREE from './vendor/three.module.min.js';
import { WATER_Y, ROAD_Y, WALK_Y, ISLAND_Y, BANK_Y } from './space.mjs';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createFx(scene, T, { layer = null, max = 700 } = {}) {
  // ---------- rain ----------
  const RAIN = 3200;
  const quad = new THREE.PlaneGeometry(1, 1); quad.translate(0, -0.5, 0);
  const rg = new THREE.InstancedBufferGeometry(); rg.index = quad.index; rg.attributes.position = quad.attributes.position; rg.attributes.uv = quad.attributes.uv;
  const seeds = new Float32Array(RAIN * 4); for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
  rg.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 4)); rg.instanceCount = 0;
  const rainU = { time: { value: 0 }, center: { value: new THREE.Vector3() }, size: { value: new THREE.Vector3(56, 16, 44) }, speed: { value: 16 }, wind: { value: 0.18 }, color: { value: new THREE.Color('#cfd8e8') }, opacity: { value: 0.35 }, len: { value: 0.9 }, map: { value: T.rainDrop() } };
  const rainMat = new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 seed; uniform float time, speed, wind, len; uniform vec3 center, size; varying vec2 vUv; varying float vA;
      void main(){
        float fall = fract(seed.z + time * speed * (0.8 + 0.4 * seed.w) / size.y);
        vec3 base = center + vec3((seed.x - 0.5) * size.x, size.y * (1.0 - fall) - 1.0, (seed.y - 0.5) * size.z);
        base.x += wind * (1.0 - fall) * size.y;
        vec3 axis = normalize(vec3(wind, -1.0, 0.0));
        vec3 toCam = normalize(cameraPosition - base), side = normalize(cross(axis, toCam));
        vec3 p = base + side * position.x * 0.025 + axis * (position.y + 0.5) * len * (0.7 + seed.w * 0.6);
        vUv = uv; vA = smoothstep(0.0, 0.08, fall) * (1.0 - smoothstep(0.92, 1.0, fall));
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float opacity; varying vec2 vUv; varying float vA;
      void main(){ float a = texture2D(map, vUv).a * opacity * vA; gl_FragColor = vec4(color * a, a); }`,
  });
  const rain = new THREE.Mesh(rg, rainMat); rain.frustumCulled = false; rain.renderOrder = 5; scene.add(rain);

  // ---------- splashes: rings opening where drops land on the street and the water ----------
  const SPL = 900;
  const sq = new THREE.PlaneGeometry(1, 1); sq.rotateX(-Math.PI / 2);
  const sg = new THREE.InstancedBufferGeometry(); sg.index = sq.index; sg.attributes.position = sq.attributes.position; sg.attributes.uv = sq.attributes.uv;
  const sseeds = new Float32Array(SPL * 4); for (let i = 0; i < sseeds.length; i++) sseeds[i] = Math.random();
  sg.setAttribute('seed', new THREE.InstancedBufferAttribute(sseeds, 4)); sg.instanceCount = 0;
  const splU = { time: { value: 0 }, center: { value: new THREE.Vector3() }, size: { value: new THREE.Vector3(56, 0, 44) }, map: { value: T.ring() }, color: { value: new THREE.Color('#dfe8f4') }, opacity: { value: 0.32 }, hWater: { value: WATER_Y }, flood: { value: 0 } };
  const splMat = new THREE.ShaderMaterial({
    uniforms: splU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 seed; uniform float time, hWater, flood; uniform vec3 center, size; varying vec2 vUv; varying float vA;
      void main(){
        float k = fract(seed.z + time * (1.4 + seed.w));
        float cyc = floor(seed.z + time * (1.4 + seed.w));
        vec2 j = fract(vec2(sin(cyc * 12.9 + seed.x * 78.2), sin(cyc * 39.3 + seed.y * 11.1)) * 437.5) - 0.5;
        vec3 base = center + vec3((seed.x - 0.5 + j.x * 0.2) * size.x, 0.0, (seed.y - 0.5 + j.y * 0.2) * size.z);
        float z = base.z, y;
        if (z > 11.0) y = ${WALK_Y.toFixed(3)}; else if (z > 1.0) y = ${ROAD_Y.toFixed(3)} + flood * 0.07; else if (z > -0.9) y = ${ISLAND_Y.toFixed(3)}; else if (z > -11.0) y = hWater; else if (z > -13.2) y = ${BANK_Y.toFixed(3)}; else y = ${BANK_Y.toFixed(3)};
        base.y = y + 0.012;
        float s = 0.05 + k * (0.22 + seed.w * 0.12);
        vUv = uv; vA = (1.0 - k) * (1.0 - k);
        gl_Position = projectionMatrix * viewMatrix * vec4(base + position * s, 1.0);
      }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float opacity; varying vec2 vUv; varying float vA;
      void main(){ float a = texture2D(map, vUv).a * opacity * vA; gl_FragColor = vec4(color * a, a); }`,
  });
  const splashes = new THREE.Mesh(sg, splMat); splashes.frustumCulled = false; splashes.renderOrder = 4; scene.add(splashes);

  // ---------- particles ----------
  const pg = new THREE.BufferGeometry(), pPos = new Float32Array(max * 3), pCol = new Float32Array(max * 3), pSize = new Float32Array(max);
  pg.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pCol, 3)); pg.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
  const pMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: T.glow(64) }, scale: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    vertexShader: `attribute float size; uniform float scale; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D map; varying vec3 vC; void main(){ float a = texture2D(map, gl_PointCoord).a; gl_FragColor = vec4(vC * a, a); }`,
  });
  const points = new THREE.Points(pg, pMat); points.frustumCulled = false; points.renderOrder = 6; scene.add(points);
  const parts = [];
  const col = new THREE.Color();
  function emit(x, y, z, color, n, { speed = 2, up = 2, life = 0.6, g = 9, size = 0.12, spread = 1, floor = null, drag = 0.98 } = {}) {
    col.set(color);
    for (let i = 0; i < n && parts.length < max; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      parts.push({ x, y, z, vx: Math.cos(a) * s * spread, vy: up * (0.5 + Math.random() * 0.7), vz: Math.sin(a) * s * spread, life: life * (0.6 + Math.random() * 0.6), max: life, g, size: size * (0.6 + Math.random() * 0.8), r: col.r, gg: col.g, b: col.b, floor, drag });
    }
  }

  // ---------- floating words ----------
  const words = [];
  const v3 = new THREE.Vector3();
  function say(text, x, y, z, { cls = '', life = 1.3, rise = 1.2 } = {}) {
    if (!layer) return;
    const el = document.createElement('div'); el.className = `float ${cls}`; el.textContent = text; layer.appendChild(el);
    words.push({ el, x, y, z, life, max: life, rise });
    while (words.length > 10) { const w = words.shift(); w.el.remove(); }
  }

  function update(dt, t, camera, { rain: amount = 0, center, reduced = false, flood = 0, rainColor = null } = {}) {
    // the rain follows the camera's view of the board
    rainU.time.value = t; splU.time.value = t;
    if (center) { rainU.center.value.copy(center); splU.center.value.set(center.x, 0, center.z); }
    rg.instanceCount = Math.round(RAIN * clamp(amount, 0, 1) * (reduced ? 0.35 : 1));
    sg.instanceCount = Math.round(SPL * clamp(amount, 0, 1) * (reduced ? 0.3 : 1));
    rainU.speed.value = 14 + amount * 6; rainU.opacity.value = 0.12 + amount * 0.13; splU.flood.value = flood;
    if (rainColor) { rainU.color.value.set(rainColor); splU.color.value.set(rainColor); }
    // particles
    let n = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy -= p.g * dt; p.vx *= p.drag; p.vz *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.floor !== null && p.y < p.floor) { p.y = p.floor; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
    }
    for (const p of parts) {
      const a = clamp((p.life / p.max) * 1.6, 0, 1);
      pPos[n * 3] = p.x; pPos[n * 3 + 1] = p.y; pPos[n * 3 + 2] = p.z;
      pCol[n * 3] = p.r * a; pCol[n * 3 + 1] = p.gg * a; pCol[n * 3 + 2] = p.b * a; pSize[n] = p.size;
      n++;
    }
    pg.setDrawRange(0, n);
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true; pg.attributes.size.needsUpdate = true;
    // the words drift up and fade, pinned to where they happened
    if (layer) {
      const W = layer.clientWidth, H = layer.clientHeight;
      for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i];
        w.life -= dt;
        if (w.life <= 0) { w.el.remove(); words.splice(i, 1); continue; }
        const k = 1 - w.life / w.max;
        v3.set(w.x, w.y + (reduced ? 0.4 : w.rise * (1 - (1 - k) ** 2)), w.z).project(camera);
        const x = ((v3.x + 1) / 2) * W, y = ((1 - v3.y) / 2) * H;
        w.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${(0.8 + Math.min(1, k * 6) * 0.2).toFixed(3)})`;
        w.el.style.opacity = String(clamp(w.life / 0.35, 0, 1));
      }
    }
  }
  function clear() { parts.length = 0; for (const w of words) w.el.remove(); words.length = 0; }
  function setScale(h) { pMat.uniforms.scale.value = h * 0.9; }
  return { emit, say, update, clear, setScale, rainMat, points };
}
