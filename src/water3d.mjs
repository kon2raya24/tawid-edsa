// The estero's water: a physical material whose surface is drawn in its shader. Each lane's current
// carries its own ripples and foam the way that lane flows (so you can read the river), rain rings open
// everywhere, the sky and the lamps reflect in it, and it is murky enough that a diving pagong shows
// only as a shadow. The same material, browner and stiller, is the flood on España.
import * as THREE from './vendor/three.module.min.js';

let n = 0;
export function waterMaterial({ color = '#23413a', deep = '#0d1a18', normal, opacity = 0.9, rows = null } = {}) {
  const u = {
    wTime: { value: 0 }, wRain: { value: 0.5 }, wNorm: { value: normal }, wDeep: { value: new THREE.Color(deep) },
    wVel: { value: new Float32Array(7) }, wFoam: { value: new THREE.Color('#c8d8d0') }, wRows: { value: rows ? 1 : 0 }, wStill: { value: 0 },
  };
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.06, metalness: 0, ior: 1.333, specularIntensity: 1, transparent: opacity < 1, opacity, envMapIntensity: 1.6, clearcoat: 0.3, clearcoatRoughness: 0.1 });
  m.userData.water = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vWPos;
uniform float wTime, wRain, wRows, wStill; uniform sampler2D wNorm; uniform vec3 wDeep, wFoam; uniform float wVel[7];
float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// the lane a point is in (rows 1..5 lie between z = -11 and z = -1), and how near its edge
float laneVel(float z){ float r = clamp(floor((z + 13.0) / 2.0), 0.0, 6.0); return wVel[int(r)]; }
// rain: rings opening in a jittered grid, two layers
vec2 rainRings(vec2 p, float t, float cell){
  vec2 g = floor(p / cell), f = p / cell - g; vec2 n = vec2(0.0);
  float h = wh(g), ph = fract(t * (0.9 + h * 0.5) + h * 7.0);
  vec2 c = vec2(0.25 + 0.5 * wh(g + 3.1), 0.25 + 0.5 * wh(g + 5.7));
  vec2 d = f - c; float r = length(d), rad = ph * 0.45, w = 0.06;
  float ring = exp(-pow((r - rad) / w, 2.0)) * (1.0 - ph) * step(h, wRain * 0.9 + 0.1);
  n += (r > 0.0001 ? d / r : vec2(0.0)) * ring;
  return n;
}
` + sh.fragmentShader
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec3 P = vWPos; float v = wRows > 0.5 ? laneVel(P.z) : 0.0; float t = wTime;
    // two scrolls of the ripple map, carried by the lane's current
    vec2 q1 = P.xz * vec2(0.22, 0.34) + vec2(-v * t * 0.22, t * 0.012);
    vec2 q2 = P.xz * vec2(0.5, 0.42) + vec2(-v * t * 0.5 + t * 0.02, -t * 0.03);
    vec3 n1 = texture2D(wNorm, q1).xyz * 2.0 - 1.0, n2 = texture2D(wNorm, q2).xyz * 2.0 - 1.0;
    vec2 slope = (n1.xy * 0.55 + n2.xy * 0.4) * (1.0 - wStill * 0.7);
    slope += rainRings(P.xz, t * 1.6, 0.55) * 0.9 * wRain + rainRings(P.xz + 17.3, t * 1.3 + 0.5, 0.8) * 0.7 * wRain;
    vec3 nW = normalize(vec3(-slope.x, 1.0, -slope.y));
    normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
  }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 P = vWPos; float v = wRows > 0.5 ? laneVel(P.z) : 0.0;
    // foam streaks drifting with each lane: they show which way, and how fast, the current runs
    vec2 fq = vec2(P.x * 0.35 - v * wTime * 0.35, P.z * 3.2);
    float streak = texture2D(wNorm, fq * vec2(0.3, 0.05)).x;
    float foam = smoothstep(0.66, 0.76, streak) * (wRows > 0.5 ? 1.0 : 0.3) * (1.0 - wStill);
    // the seams between lanes that run opposite ways churn a little
    float fe = fract((P.z + 13.0) / 2.0), edge = wRows > 0.5 && P.z > -11.0 ? 1.0 - smoothstep(0.0, 0.08, min(fe, 1.0 - fe)) : 0.0;
    diffuseColor.rgb = mix(diffuseColor.rgb, wDeep, 0.35 + 0.25 * texture2D(wNorm, P.xz * 0.05).x);
    diffuseColor.rgb = mix(diffuseColor.rgb, wFoam, clamp(foam * 0.55 + edge * 0.12, 0.0, 0.7));
  }`);
  };
  const key = 'tawid-water-' + (++n);
  m.customProgramCacheKey = () => key;
  return m;
}

// Each frame: the time, the rain, and each row's current (m/s along x) for rows 0..6.
export function updateWater(m, t, rain, vel) {
  const u = m.userData.water;
  u.wTime.value = t; u.wRain.value = rain;
  if (vel) for (let r = 0; r < 7; r++) u.wVel.value[r] = vel[r] || 0;
}
