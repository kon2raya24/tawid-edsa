// The things on the lanes, modelled in code: EDSA's traffic (jeepneys with chrome and colour, P2P buses,
// taxis, tricycles, motorsiklo, pedicabs, trucks, a kalesa), everything that floats in the estero (troso,
// balsa, pagong, salbabida, batya, banig, styro, water lilies, bangka, a ferry, the buwaya), the gabi
// leaves, and the little ones. Each is a few merged geometries, one per material slot (kit.mjs), built
// facing +x with the middle at x = 0: vehicles stand on y = 0, floaters float with y = 0 at the waterline.
import * as THREE from './vendor/three.module.min.js';
import { Kit, lamp, lathe, extrude, matrix } from './kit.mjs';

const TAU = Math.PI * 2, HP = Math.PI / 2;
const HEAD = lamp('#fff1d0', 6), TAIL = lamp('#ff2a1a', 4), TAILDIM = lamp('#ff3a22', 1.6), AMBER = lamp('#ffb030', 3);
const DARK = '#16181c', TYRE = '#1b1b1d', RUBBER = '#26262a', WHITE = '#f2efe6';

// The paint a vehicle's 'paint' slot is tinted with, one per object, by lane and index.
export const PAINT = {
  jeep: ['#d8283c', '#2a5fc8', '#f2c21a', '#2f9a4a', '#e85aa8', '#f08a1a', '#7a3ab8', '#1aa8b8'],
  bus: ['#1f5fbf', '#1f8a4a', '#c8283a', '#e8a01a'],
  taxi: ['#f4f1e6', '#f4f1e6', '#f2c81a', '#f4f1e6'],
  tricycle: ['#d8283c', '#2a5fc8', '#f2c21a', '#2f9a4a', '#e85aa8', '#1aa8b8'],
  motor: ['#d8283c', '#1a1a1a', '#2a5fc8', '#f2c21a', '#e8e8e8'],
  pedicab: ['#2a5fc8', '#2f9a4a', '#d8283c', '#f2c21a'],
  truck: ['#c8283a', '#1f5fbf', '#2f8a4a', '#e8e0d0'],
  kalesa: ['#b8282a', '#1f4fa8', '#1f7a4a', '#d8a020'],
  bangka: ['#1f6fd0', '#d8283c', '#2f9a4a', '#f2c21a'],
  ferry: ['#1f5fbf', '#1f8a8a'],
};

// A wheel: unit radius and width, turning about z. One pool draws every wheel in the street.
export function wheelModel() {
  const k = new Kit();
  k.cyl('body', 1, 1, 1, TYRE, { rx: HP }, 18);
  k.cyl('chrome', 0.58, 0.58, 1.04, '#c9ced6', { rx: HP }, 14);
  k.cyl('body', 0.2, 0.2, 1.08, '#3a3a40', { rx: HP }, 8);
  for (let s = 0; s < 5; s++) k.box('chrome', 0.1, 0.9, 1.06, '#aab0ba', { rz: (s / 5) * Math.PI }); // spokes, so the turning shows
  return k.build();
}

// ---------- the traffic ----------
// Every vehicle: its merged parts, its wheels [x, z, radius, width], and its lights [x, y, z] (head
// lamps throw a pool of light on the road ahead; tail lamps glow red behind), its length in metres.
function jeep() {
  const k = new Kit(), L = 3.8;
  k.box('body', 3.5, 0.16, 1.4, DARK, { x: -0.1, y: 0.34 });
  k.rbox('paint', 2.85, 0.72, 1.62, 0.05, '#ffffff', { x: -0.47, y: 0.78 }); // the passenger body
  k.box('body', 2.86, 0.07, 1.64, WHITE, { x: -0.47, y: 1.1 }); // the beltline
  for (const [y, c] of [[0.62, '#ffd23f'], [0.7, '#e8384f'], [0.9, '#ffffff']]) k.box('body', 2.7, 0.035, 1.635, c, { x: -0.5, y }); // stripes
  k.box('body', 2.75, 0.44, 1.46, '#101216', { x: -0.45, y: 1.35 }); // the dark inside, through the open windows
  for (let px = -1.85; px <= 0.95; px += 0.47) k.box('paint', 0.07, 0.44, 1.61, '#ffffff', { x: px, y: 1.35 }); // window posts
  k.box('body', 2.6, 0.12, 1.3, '#3a2a1a', { x: -0.5, y: 0.95 }); // the benches
  k.rbox('paint', 3.1, 0.14, 1.74, 0.06, '#ffffff', { x: -0.45, y: 1.64 }); // the roof
  k.box('chrome', 3.0, 0.04, 0.05, '#dfe3ea', { x: -0.45, y: 1.73, z: 0.84 }); k.box('chrome', 3.0, 0.04, 0.05, '#dfe3ea', { x: -0.45, y: 1.73, z: -0.84 });
  k.box('sign', 0.08, 0.26, 1.3, '#ffffff', { x: 1.02, y: 1.84 }); // the route board
  k.box('body', 0.1, 0.3, 1.36, DARK, { x: 0.97, y: 1.84 });
  k.box('glass', 0.05, 0.42, 1.42, '#1c2430', { x: 0.99, y: 1.33, rz: -0.12 }); // the windshield
  k.box('body', 0.06, 0.44, 0.05, DARK, { x: 1.0, y: 1.33 });
  k.rbox('chrome', 0.9, 0.52, 1.22, 0.1, '#d8dde5', { x: 1.38, y: 0.8 }); // the silver hood
  k.rbox('paint', 0.86, 0.26, 1.64, 0.08, '#ffffff', { x: 1.34, y: 0.66 }); // the fenders
  for (let s = -3; s <= 3; s++) k.box('chrome', 0.04, 0.4, 0.05, '#eef1f5', { x: 1.85, y: 0.78, z: s * 0.085 }); // grille slats
  k.box('chrome', 0.05, 0.46, 0.66, '#9aa0aa', { x: 1.83, y: 0.78 });
  for (const z of [-0.62, -0.46, 0.46, 0.62]) k.cyl('lamp', 0.075, 0.075, 0.05, HEAD, { x: 1.86, y: 0.8, z, rz: HP }, 12);
  for (const z of [-0.54, 0.54]) k.cyl('chrome', 0.18, 0.18, 0.04, '#cfd5dd', { x: 1.85, y: 0.8, z, rz: HP }, 14);
  k.rbox('chrome', 0.12, 0.13, 1.74, 0.04, '#e6e9ee', { x: 1.9, y: 0.44 }); // bumper
  k.box('chrome', 0.3, 0.16, 0.1, '#eef1f5', { x: 1.5, y: 1.12, z: 0.18 }); k.box('chrome', 0.3, 0.16, 0.1, '#eef1f5', { x: 1.5, y: 1.12, z: -0.18 }); // the chrome horses
  k.box('chrome', 0.14, 0.22, 0.08, '#eef1f5', { x: 1.63, y: 1.24, z: 0.18, rz: 0.4 }); k.box('chrome', 0.14, 0.22, 0.08, '#eef1f5', { x: 1.63, y: 1.24, z: -0.18, rz: 0.4 });
  for (const z of [-0.8, 0.8]) { k.cyl('chrome', 0.012, 0.012, 0.7, '#dfe3ea', { x: 1.0, y: 2.05, z }); k.box('body', 0.18, 0.1, 0.01, z > 0 ? '#e8384f' : '#2f6fd6', { x: 0.92, y: 2.34, z }); } // antennas with little flags
  for (const z of [-0.95, 0.95]) k.box('chrome', 0.05, 0.14, 0.1, '#e6e9ee', { x: 1.02, y: 1.25, z }); // mirrors
  k.box('body', 0.04, 0.9, 0.66, '#08090b', { x: -1.9, y: 1.02 }); // the back door, open
  k.box('chrome', 0.18, 0.05, 0.7, '#dfe3ea', { x: -1.93, y: 0.44 }); // the step
  for (const z of [-0.7, 0.7]) { k.box('lamp', 0.03, 0.16, 0.14, TAIL, { x: -1.9, y: 0.66, z }); k.box('body', 0.02, 0.36, 0.3, '#8a1a1a', { x: -1.2, y: 0.36, z: z * 1.12 }); }
  return { parts: k.build(), len: L, wheels: [[1.32, 0.7, 0.36, 0.26], [-1.22, 0.7, 0.36, 0.26], [1.32, -0.7, 0.36, 0.26], [-1.22, -0.7, 0.36, 0.26]], head: [[1.9, 0.8, 0.54], [1.9, 0.8, -0.54]], tail: [[-1.92, 0.66, 0.7], [-1.92, 0.66, -0.7]] };
}

function bus() {
  const k = new Kit(), L = 5.7;
  k.box('body', 5.4, 0.2, 1.6, DARK, { y: 0.38 });
  k.rbox('body', 5.7, 1.1, 1.82, 0.1, WHITE, { y: 0.95 });
  k.box('paint', 5.62, 0.22, 1.84, '#ffffff', { y: 0.95 }); // the operator's stripe
  k.box('paint', 5.62, 0.06, 1.84, '#ffffff', { y: 1.42 });
  k.box('lamp', 5.2, 0.62, 1.78, lamp('#ffd8a0', 0.9), { x: -0.15, y: 1.8 }); // lit windows
  for (let px = -2.6; px <= 2.3; px += 0.9) k.box('body', 0.12, 0.66, 1.83, '#1a1d22', { x: px, y: 1.8 });
  k.box('glass', 5.3, 0.1, 1.84, '#1c2430', { x: -0.1, y: 2.14 });
  k.rbox('body', 5.7, 0.3, 1.8, 0.1, WHITE, { y: 2.3 });
  k.rbox('body', 1.6, 0.26, 1.2, 0.06, '#b8bcc4', { x: -0.8, y: 2.5 }); // the aircon
  k.box('glass', 0.06, 0.92, 1.6, '#1a2230', { x: 2.84, y: 1.72, rz: -0.06 }); // windshield
  k.box('lamp', 0.05, 0.16, 1.3, AMBER, { x: 2.85, y: 2.3 }); // the route sign
  for (const z of [-0.62, 0.62]) k.box('lamp', 0.04, 0.14, 0.34, HEAD, { x: 2.86, y: 0.64, z });
  k.rbox('body', 0.14, 0.2, 1.84, 0.05, '#2a2c30', { x: 2.86, y: 0.42 });
  for (const z of [-0.72, 0.72]) k.box('lamp', 0.04, 0.4, 0.16, TAIL, { x: -2.86, y: 0.95, z });
  k.box('body', 0.04, 0.34, 1.2, '#1a2230', { x: -2.86, y: 1.8 });
  return { parts: k.build(), len: L, wheels: [[1.95, 0.8, 0.46, 0.3], [-1.9, 0.8, 0.46, 0.3], [1.95, -0.8, 0.46, 0.3], [-1.9, -0.8, 0.46, 0.3]], head: [[2.9, 0.64, 0.62], [2.9, 0.64, -0.62]], tail: [[-2.9, 0.95, 0.72], [-2.9, 0.95, -0.72]] };
}

function taxi() {
  const k = new Kit(), L = 1.9;
  k.rbox('paint', 1.9, 0.46, 1.44, 0.14, '#ffffff', { y: 0.5 });
  k.rbox('glass', 1.0, 0.44, 1.3, 0.14, '#1a2230', { x: -0.08, y: 0.92 });
  k.rbox('paint', 0.9, 0.08, 1.32, 0.04, '#ffffff', { x: -0.1, y: 1.14 });
  k.box('lamp', 0.22, 0.14, 0.5, lamp('#ffe39a', 1.8), { x: -0.08, y: 1.24 }); // TAXI
  k.box('body', 0.24, 0.02, 0.52, DARK, { x: -0.08, y: 1.16 });
  k.box('body', 1.92, 0.08, 1.46, '#c9c5b8', { y: 0.48 }); // a chrome-ish rub strip
  for (const z of [-0.5, 0.5]) { k.box('lamp', 0.04, 0.1, 0.24, HEAD, { x: 0.94, y: 0.56, z }); k.box('lamp', 0.04, 0.1, 0.2, TAIL, { x: -0.94, y: 0.6, z: z * 1.1 }); }
  k.box('body', 0.08, 0.12, 1.4, '#2a2c30', { x: 0.96, y: 0.34 }); k.box('body', 0.08, 0.12, 1.4, '#2a2c30', { x: -0.96, y: 0.34 });
  return { parts: k.build(), len: L, wheels: [[0.58, 0.64, 0.27, 0.2], [-0.58, 0.64, 0.27, 0.2], [0.58, -0.64, 0.27, 0.2], [-0.58, -0.64, 0.27, 0.2]], head: [[0.97, 0.56, 0.5], [0.97, 0.56, -0.5]], tail: [[-0.97, 0.6, 0.55], [-0.97, 0.6, -0.55]] };
}

// A rider in a raincoat and a helmet, sitting at x, on the side z.
function rider(k, x, z, y, coat = '#2f5fae', helmet = '#e8384f', lean = 0.3) {
  k.rbox('body', 0.34, 0.5, 0.42, 0.12, coat, { x, y: y + 0.28, z, rz: -lean }); // body
  k.box('body', 0.4, 0.14, 0.14, '#2a2a3a', { x: x + 0.15, y: y + 0.02, z: z + 0.14 }); k.box('body', 0.4, 0.14, 0.14, '#2a2a3a', { x: x + 0.15, y: y + 0.02, z: z - 0.14 }); // thighs
  k.box('body', 0.1, 0.36, 0.1, coat, { x: x + 0.28, y: y + 0.36, z: z + 0.2, rz: -1.0 }); k.box('body', 0.1, 0.36, 0.1, coat, { x: x + 0.28, y: y + 0.36, z: z - 0.2, rz: -1.0 }); // arms to the bars
  k.ball('body', 0.13, '#c98a5a', { x: x + 0.08, y: y + 0.66, z });
  k.ball('paint', 0.17, '#ffffff', { x: x + 0.06, y: y + 0.72, z, sy: 0.92 }); // helmet
  k.box('glass', 0.04, 0.1, 0.22, '#141820', { x: x + 0.2, y: y + 0.68, z });
}

function tricycle() {
  const k = new Kit(), L = 1.9, bz = -0.45;
  k.rbox('body', 1.1, 0.24, 0.26, 0.08, '#2a2c30', { x: 0.0, y: 0.48, z: bz }); // the motorbike
  k.rbox('paint', 0.5, 0.2, 0.3, 0.08, '#ffffff', { x: 0.25, y: 0.66, z: bz }); // tank
  k.box('body', 0.5, 0.08, 0.26, '#141414', { x: -0.22, y: 0.66, z: bz }); // seat
  k.cyl('chrome', 0.025, 0.025, 0.62, '#cfd5dd', { x: 0.6, y: 0.62, z: bz, rz: 0.35 }); k.box('chrome', 0.04, 0.04, 0.5, '#cfd5dd', { x: 0.5, y: 0.95, z: bz });
  k.cyl('lamp', 0.07, 0.07, 0.05, HEAD, { x: 0.66, y: 0.84, z: bz, rz: HP }, 12);
  rider(k, -0.2, bz, 0.7, '#1f7a4a', '#ffd23f');
  k.rbox('paint', 1.5, 0.66, 0.96, 0.08, '#ffffff', { x: 0.0, y: 0.68, z: 0.25 }); // the sidecar
  k.box('body', 1.3, 0.3, 0.8, '#101216', { x: -0.05, y: 1.12, z: 0.25 }); // its dark cabin
  k.box('glass', 0.04, 0.34, 0.86, '#1a2230', { x: 0.74, y: 1.14, z: 0.25, rz: -0.2 });
  k.rbox('paint', 1.72, 0.08, 1.46, 0.04, '#ffffff', { x: -0.02, y: 1.5, z: -0.02 }); // the roof over both
  k.box('body', 1.72, 0.03, 1.47, '#ffd23f', { x: -0.02, y: 1.45, z: -0.02 });
  for (const [x, z] of [[0.7, 0.68], [-0.72, 0.68], [-0.72, -0.2], [0.55, -0.2]]) k.cyl('chrome', 0.02, 0.02, 0.8, '#cfd5dd', { x, y: 1.08, z });
  k.box('lamp', 0.03, 0.1, 0.14, TAIL, { x: -0.77, y: 0.62, z: 0.6 }); k.box('lamp', 0.03, 0.08, 0.1, TAIL, { x: -0.58, y: 0.62, z: bz });
  return { parts: k.build(), len: L, wheels: [[0.66, bz, 0.27, 0.12], [-0.48, bz, 0.27, 0.12], [0.0, 0.72, 0.24, 0.14]], head: [[0.7, 0.84, bz]], tail: [[-0.78, 0.62, 0.6]] };
}

function motor() {
  const k = new Kit(), L = 1.8;
  k.rbox('body', 1.0, 0.24, 0.24, 0.08, '#2a2c30', { x: 0, y: 0.5 });
  k.rbox('paint', 0.56, 0.24, 0.32, 0.1, '#ffffff', { x: 0.22, y: 0.7 });
  k.rbox('paint', 0.4, 0.2, 0.26, 0.08, '#ffffff', { x: 0.62, y: 0.78, rz: -0.3 }); // the front cowl
  k.box('body', 0.52, 0.08, 0.26, '#141414', { x: -0.26, y: 0.7 });
  k.cyl('chrome', 0.04, 0.05, 0.55, '#cfd5dd', { x: -0.4, y: 0.38, z: 0.16, rz: HP + 0.1 }); // exhaust
  k.cyl('chrome', 0.025, 0.025, 0.6, '#cfd5dd', { x: 0.62, y: 0.58, rz: 0.35 }); k.box('chrome', 0.04, 0.04, 0.56, '#cfd5dd', { x: 0.5, y: 0.98 });
  k.cyl('lamp', 0.08, 0.08, 0.05, HEAD, { x: 0.76, y: 0.84, rz: HP }, 12);
  rider(k, -0.22, 0, 0.72, '#e8384f', '#ffffff', 0.4);
  k.box('lamp', 0.03, 0.08, 0.14, TAIL, { x: -0.62, y: 0.72 });
  return { parts: k.build(), len: L, wheels: [[0.64, 0, 0.3, 0.14], [-0.6, 0, 0.3, 0.16]], head: [[0.8, 0.84, 0]], tail: [[-0.64, 0.72, 0]] };
}

function pedicab() {
  const k = new Kit(), L = 1.9, bz = -0.45;
  k.box('body', 1.0, 0.04, 0.04, '#3a3a40', { x: 0.05, y: 0.6, z: bz, rz: 0.1 }); k.box('body', 0.04, 0.5, 0.04, '#3a3a40', { x: -0.1, y: 0.55, z: bz, rz: 0.3 }); k.cyl('chrome', 0.02, 0.02, 0.62, '#cfd5dd', { x: 0.55, y: 0.6, z: bz, rz: 0.3 });
  k.box('chrome', 0.04, 0.04, 0.42, '#cfd5dd', { x: 0.48, y: 0.92, z: bz });
  k.box('body', 0.22, 0.06, 0.18, '#141414', { x: -0.22, y: 0.82, z: bz });
  rider(k, -0.18, bz, 0.84, '#e8a01a', '#2a2a3a', 0.2);
  k.rbox('paint', 1.2, 0.52, 0.86, 0.06, '#ffffff', { x: -0.05, y: 0.58, z: 0.28 }); // the sidecar
  k.box('body', 1.0, 0.1, 0.7, '#3a2a1a', { x: -0.05, y: 0.86, z: 0.28 });
  k.rbox('body', 1.3, 0.06, 1.0, 0.03, '#2f6fd6', { x: -0.05, y: 1.5, z: 0.28 }); // the canopy
  for (const [x, z] of [[0.52, 0.66], [-0.6, 0.66], [0.52, -0.08], [-0.6, -0.08]]) k.cyl('chrome', 0.015, 0.015, 0.7, '#cfd5dd', { x, y: 1.14, z });
  k.cyl('lamp', 0.04, 0.04, 0.04, lamp('#fff1d0', 3), { x: 0.56, y: 0.82, z: bz, rz: HP }, 8);
  return { parts: k.build(), len: L, wheels: [[0.62, bz, 0.3, 0.06], [-0.46, bz, 0.3, 0.06], [-0.05, 0.72, 0.26, 0.08]], head: [[0.6, 0.82, bz]], tail: [] };
}

function truck() {
  const k = new Kit(), L = 3.8;
  k.box('body', 3.6, 0.18, 1.3, DARK, { y: 0.4 });
  k.rbox('paint', 0.95, 1.2, 1.7, 0.1, '#ffffff', { x: 1.4, y: 1.15 }); // the cab
  k.box('glass', 0.05, 0.5, 1.5, '#1a2230', { x: 1.88, y: 1.4, rz: -0.08 });
  k.box('glass', 0.6, 0.42, 1.72, '#1a2230', { x: 1.42, y: 1.42 });
  k.box('chrome', 0.05, 0.36, 1.1, '#c9ced6', { x: 1.88, y: 0.8 });
  for (const z of [-0.66, 0.66]) k.box('lamp', 0.04, 0.14, 0.26, HEAD, { x: 1.89, y: 0.78, z });
  k.rbox('body', 0.14, 0.18, 1.74, 0.05, '#2a2c30', { x: 1.9, y: 0.48 });
  k.box('body', 2.75, 0.1, 1.7, '#5a3a20', { x: -0.5, y: 0.62 }); // the bed
  for (const z of [-0.82, 0.82]) for (let s = 0; s < 3; s++) k.box('body', 2.75, 0.14, 0.05, s % 2 ? '#9a6a3a' : '#8b5a2b', { x: -0.5, y: 0.78 + s * 0.17, z });
  for (let s = 0; s < 3; s++) k.box('body', 0.05, 0.14, 1.7, s % 2 ? '#9a6a3a' : '#8b5a2b', { x: -1.86, y: 0.78 + s * 0.17 });
  for (let s = 0; s < 5; s++) k.ball('body', 0.34, '#c8b080', { x: -1.5 + s * 0.52, y: 0.95, z: (s % 2 ? 0.3 : -0.3), sx: 1.2, sy: 0.7 }); // sacks of rice
  for (let s = 0; s < 4; s++) k.ball('body', 0.3, '#d8c090', { x: -1.25 + s * 0.52, y: 1.3, z: (s % 2 ? -0.25 : 0.25), sx: 1.2, sy: 0.7 });
  for (const z of [-0.7, 0.7]) k.box('lamp', 0.04, 0.14, 0.18, TAIL, { x: -1.9, y: 0.55, z });
  return { parts: k.build(), len: L, wheels: [[1.35, 0.74, 0.42, 0.28], [-1.0, 0.74, 0.42, 0.34], [1.35, -0.74, 0.42, 0.28], [-1.0, -0.74, 0.42, 0.34]], head: [[1.92, 0.78, 0.66], [1.92, 0.78, -0.66]], tail: [[-1.92, 0.55, 0.7], [-1.92, 0.55, -0.7]] };
}

function kalesa() {
  const k = new Kit(), L = 3.8;
  // the horse
  const brown = '#6a3e22';
  k.ball('body', 0.5, brown, { x: 1.2, y: 1.15, sx: 1.45, sy: 0.72, sz: 0.62 });
  k.rbox('body', 0.26, 0.62, 0.24, 0.1, brown, { x: 1.78, y: 1.52, rz: -0.55 }); // neck
  k.rbox('body', 0.5, 0.22, 0.2, 0.08, brown, { x: 2.0, y: 1.7, rz: -0.35 }); // head
  k.box('body', 0.05, 0.4, 0.08, '#1a120c', { x: 1.72, y: 1.66, rz: -0.55 }); // mane
  k.cyl('body', 0.03, 0.07, 0.6, '#1a120c', { x: 0.52, y: 1.02, rz: -0.5 }); // tail
  k.box('body', 0.08, 0.1, 0.66, '#b8282a', { x: 1.55, y: 1.35 }); k.box('chrome', 0.06, 0.06, 0.68, '#e0b040', { x: 1.62, y: 1.44 }); // harness
  // the carriage
  k.box('body', 1.5, 0.06, 0.08, '#6a4a2a', { x: 0.5, y: 0.95, z: 0.34 }); k.box('body', 1.5, 0.06, 0.08, '#6a4a2a', { x: 0.5, y: 0.95, z: -0.34 }); // shafts
  k.rbox('paint', 1.7, 0.56, 1.24, 0.06, '#ffffff', { x: -0.85, y: 1.05 });
  k.box('chrome', 1.72, 0.05, 1.26, '#e0b040', { x: -0.85, y: 1.32 }); // brass trim
  k.box('body', 1.4, 0.12, 1.1, '#3a1a10', { x: -0.9, y: 1.36 });
  k.add('body', new THREE.CylinderGeometry(0.66, 0.66, 1.9, 16, 1, true, 0, Math.PI), '#1a1a1a', { x: -0.9, y: 1.62, rz: HP, ry: 0 }); // the hood over the seat
  for (const [x, z] of [[0.05, 0.6], [0.05, -0.6], [-1.75, 0.6], [-1.75, -0.6]]) k.cyl('chrome', 0.02, 0.02, 0.5, '#e0b040', { x, y: 1.6, z });
  rider(k, 0.15, 0, 1.28, '#e8e0c8', '#3a2a1a', 0.05); // the kutsero
  k.box('lamp', 0.1, 0.14, 0.1, lamp('#ffcf70', 3), { x: 0.12, y: 1.55, z: 0.64 }); k.box('lamp', 0.1, 0.14, 0.1, lamp('#ffcf70', 3), { x: 0.12, y: 1.55, z: -0.64 });
  return { parts: k.build(), len: L, wheels: [[-0.95, 0.72, 0.62, 0.08], [-0.95, -0.72, 0.62, 0.08]], head: [], tail: [], lanterns: [[0.12, 1.55, 0.64], [0.12, 1.55, -0.64]], horse: true };
}
// The horse's legs: one leg, hung from its top, swung by the view as it trots.
export function horseLeg() {
  const k = new Kit();
  k.rbox('body', 0.12, 0.8, 0.12, 0.05, '#5a321a', { y: -0.4 });
  k.box('body', 0.14, 0.1, 0.15, '#1a120c', { y: -0.8 });
  return k.build();
}

const VEHICLE = { jeep, bus, taxi, tricycle, motor, pedicab, truck, kalesa };
const vCache = new Map();
export function vehicleModel(type) {
  if (!vCache.has(type)) vCache.set(type, (VEHICLE[type] || taxi)());
  return vCache.get(type);
}

// ---------- the estero ----------
// Each floater: whole(len) parts for the full object, or unit parts repeated once a cell; `top` is where
// Kokak stands (above the waterline), `bob` how much it rocks, and diving things sink as a whole.
function stretchUV(geo, u, v) { const a = geo.attributes.uv; for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) * u, a.getY(i) * v); return geo; }

function troso(len) {
  const k = new Kit(), Lm = len * 2 - 0.3, r = 0.44;
  k.add('bark', stretchUV(new THREE.CylinderGeometry(r, r * 0.94, Lm, 18, 4, true), 2, Lm / 2.2), '#ffffff', { y: -0.1, rz: HP });
  for (const s of [-1, 1]) {
    k.add('endgrain', new THREE.CircleGeometry(r * (s > 0 ? 0.94 : 1), 18), '#ffffff', { x: s * Lm / 2, y: -0.1, ry: s * HP });
    k.add('bark', new THREE.TorusGeometry(r * 0.97, 0.05, 6, 18), '#6a5040', { x: s * Lm / 2, y: -0.1, ry: HP });
  }
  // branch stubs and moss
  for (let q = 0; q < len; q++) {
    const x = -Lm / 2 + 0.8 + q * 1.9 + (q % 2) * 0.4, a = q % 2 ? 0.6 : -0.9;
    k.add('bark', new THREE.CylinderGeometry(0.06, 0.1, 0.34, 8), '#ffffff', { x, y: -0.1 + Math.cos(a) * r, z: Math.sin(a) * r, rx: a });
    k.ball('body', 0.2, '#4a6a2a', { x: x + 0.5, y: -0.1 + r * 0.8, z: -0.18, sx: 1.6, sy: 0.35 });
  }
  return { parts: k.build(), top: 0.32, bob: 0.03, roll: 0.03 };
}

function balsa(len) {
  const k = new Kit(), Lm = len * 2 - 0.3;
  for (let s = 0; s < 7; s++) {
    const z = -0.68 + s * 0.227;
    k.add('bamboo', stretchUV(new THREE.CylinderGeometry(0.105, 0.105, Lm - (s % 2) * 0.12, 10), 1, Lm / 1.2), '#ffffff', { z, y: 0.02, rz: HP });
  }
  for (const x of [-Lm / 2 + 0.35, 0, Lm / 2 - 0.35]) {
    k.add('bamboo', new THREE.CylinderGeometry(0.07, 0.07, 1.6, 8), '#e0d0a0', { x, y: 0.15, rx: HP });
    for (let s = 0; s < 7; s += 2) k.add('body', new THREE.TorusGeometry(0.1, 0.022, 5, 10), '#8a6a3a', { x, y: 0.1, z: -0.68 + s * 0.227, ry: HP });
  }
  return { parts: k.build(), top: 0.2, bob: 0.04, roll: 0.02 };
}

// One pagong. Its flippers are separate so they can paddle.
function pagongUnit() {
  const k = new Kit();
  k.add('shell', new THREE.SphereGeometry(0.72, 22, 10, 0, TAU, 0, HP), '#ffffff', { y: 0.02, sy: 0.5, sx: 1.05 });
  k.add('body', new THREE.TorusGeometry(0.72, 0.06, 6, 22), '#4a5a2a', { y: 0.03, rx: HP, sx: 1.05 });
  k.ball('body', 0.7, '#c8b878', { y: 0.0, sx: 1.0, sy: 0.16, sz: 0.94 }); // plastron
  k.ball('skin', 0.2, '#ffffff', { x: 0.86, y: 0.08, sx: 1.3, sy: 0.85 }); // head
  k.ball('body', 0.045, '#0a0a0a', { x: 1.0, y: 0.15, z: 0.1 }); k.ball('body', 0.045, '#0a0a0a', { x: 1.0, y: 0.15, z: -0.1 });
  k.add('skin', new THREE.ConeGeometry(0.08, 0.3, 8), '#ffffff', { x: -0.82, y: 0.02, rz: HP });
  return { parts: k.build(), top: 0.36, bob: 0.03 };
}
export function flipperModel() {
  const k = new Kit();
  k.ball('skin', 0.2, '#ffffff', { x: 0.16, sx: 1.7, sy: 0.3, sz: 0.8 }, 8, 5);
  return k.build();
}

function salbabidaUnit() {
  const k = new Kit(), n = 8;
  for (let s = 0; s < n; s++) k.add('plastic', new THREE.TorusGeometry(0.55, 0.19, 10, 6, TAU / n + 0.01), s % 2 ? '#f4f1ea' : '#ff5a2a', { y: 0.08, rx: HP, rz: (s / n) * TAU });
  k.add('body', new THREE.TorusGeometry(0.4, 0.02, 4, 16), '#e8e0d0', { y: 0.2, rx: HP });
  return { parts: k.build(), top: 0.26, bob: 0.05 };
}

function batyaUnit() {
  const k = new Kit();
  k.add('metal', lathe([[0, -0.14], [0.5, -0.14], [0.56, -0.05], [0.66, 0.24], [0.7, 0.27], [0.64, 0.27], [0.6, 0.22], [0.5, -0.06], [0, -0.06]], 26), '#b8bec6');
  for (const s of [-1, 1]) k.add('metal', new THREE.TorusGeometry(0.1, 0.02, 5, 10, Math.PI), '#9aa0a8', { x: s * 0.72, y: 0.24, ry: s > 0 ? HP : -HP, rx: HP });
  return { parts: k.build(), top: 0.28, bob: 0.06, spin: 0.2 };
}

function banig(len) {
  const k = new Kit(), Lm = len * 2 - 0.3;
  k.add('banig', stretchUV(new THREE.BoxGeometry(Lm, 0.04, 1.62, 8, 1, 2), Lm / 2, 1), '#ffffff', { y: 0.03 });
  for (const s of [-1, 1]) k.add('banig', stretchUV(new THREE.CylinderGeometry(0.1, 0.1, 1.62, 10), 1, 1), '#e8d8b0', { x: s * (Lm / 2 - 0.05), y: 0.08, rx: HP });
  return { parts: k.build(), top: 0.07, bob: 0.03, roll: 0.02 };
}

function styroUnit() {
  const k = new Kit();
  k.rbox('plastic', 1.5, 0.5, 1.1, 0.06, '#f4f4f0', { y: 0.12 });
  k.box('plastic', 1.52, 0.04, 1.12, '#e0e0da', { y: 0.34 }); // the lid's seam
  k.box('body', 0.9, 0.12, 0.02, '#d8283c', { y: 0.18, z: 0.56 }); k.box('body', 0.9, 0.12, 0.02, '#2a5fc8', { y: 0.18, z: -0.56 });
  return { parts: k.build(), top: 0.38, bob: 0.06, spin: 0.15 };
}

function lilyUnit() {
  const k = new Kit(), leaves = [[0, 0, 0.36], [0.45, 0.25, 0.3], [-0.4, 0.3, 0.32], [0.3, -0.42, 0.3], [-0.42, -0.3, 0.28], [0.62, -0.1, 0.22], [-0.66, 0.02, 0.22]];
  leaves.forEach(([x, z, r], i) => {
    k.add('leaf', new THREE.CylinderGeometry(r, r * 0.9, 0.04, 14), i % 2 ? '#3f8f3a' : '#4fa044', { x, y: 0.05 + i * 0.004, z, rx: (i % 3 - 1) * 0.12, rz: (i % 2 - 0.5) * 0.2 });
    k.ball('leaf', 0.09, '#5fa850', { x: x * 0.7, y: 0.02, z: z * 0.7, sy: 0.8 }); // the swollen stalks
  });
  for (const [x, z] of [[0.05, 0.05], [-0.2, -0.1]]) {
    k.cyl('leaf', 0.02, 0.025, 0.4, '#5a8a3a', { x, y: 0.25, z });
    for (let s = 0; s < 6; s++) k.ball('flower', 0.07, s % 2 ? '#b98ae0' : '#a070d0', { x: x + Math.cos(s * 2.1) * 0.06, y: 0.35 + s * 0.05, z: z + Math.sin(s * 2.1) * 0.06 });
  }
  return { parts: k.build(), top: 0.1, bob: 0.03 };
}

function bangka(len) {
  const k = new Kit(), Lm = len * 2 - 0.35;
  k.add('paint', new THREE.SphereGeometry(1, 24, 10, 0, TAU, HP, HP * 0.9), '#ffffff', { y: 0.26, sx: Lm / 2, sy: 0.46, sz: 0.5 }); // the hull, a long cup
  k.add('body', new THREE.TorusGeometry(1, 0.035, 5, 30), WHITE, { y: 0.26, rx: HP, sx: Lm / 2, sy: 0.5, sz: 1 });
  k.add('wood', new THREE.CircleGeometry(1, 24), '#6a4a2a', { y: 0.2, rx: -HP, sx: Lm / 2 * 0.96, sy: 0.46 });
  for (const x of [-Lm * 0.28, 0, Lm * 0.28]) k.add('bamboo', new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8), '#e0d0a0', { x, y: 0.34, rx: HP }); // the crossbeams
  for (const z of [-0.9, 0.9]) k.add('bamboo', stretchUV(new THREE.CylinderGeometry(0.075, 0.06, Lm * 0.9, 10), 1, Lm / 1.2), '#ffffff', { y: 0.06, z, rz: HP }); // the katig
  for (const x of [-Lm * 0.28, 0, Lm * 0.28]) for (const z of [-0.9, 0.9]) k.add('bamboo', new THREE.CylinderGeometry(0.03, 0.03, 0.34, 6), '#d8c890', { x, y: 0.2, z, rx: z > 0 ? -0.6 : 0.6 });
  return { parts: k.build(), top: 0.4, bob: 0.05, roll: 0.03 };
}

function ferry(len) {
  const k = new Kit(), Lm = len * 2 - 0.3;
  k.rbox('body', Lm, 0.5, 1.74, 0.2, WHITE, { y: 0.05 });
  k.box('paint', Lm - 0.1, 0.12, 1.76, '#ffffff', { y: 0.2 });
  k.rbox('body', Lm - 1.3, 0.62, 1.4, 0.1, '#e8e6e0', { x: -0.2, y: 0.62 }); // the cabin
  k.box('lamp', Lm - 1.5, 0.28, 1.42, lamp('#ffe0b0', 0.9), { x: -0.2, y: 0.66 }); // lit windows
  for (let x = -Lm / 2 + 1; x < Lm / 2 - 1.2; x += 0.7) k.box('body', 0.08, 0.3, 1.43, '#2a2c30', { x, y: 0.66 });
  k.rbox('paint', Lm - 1.1, 0.12, 1.56, 0.05, '#ffffff', { x: -0.2, y: 0.98 }); // the roof
  k.box('lamp', 0.1, 0.1, 0.1, lamp('#ff2020', 4), { x: -0.2, y: 1.1, z: 0.7 }); k.box('lamp', 0.1, 0.1, 0.1, lamp('#20ff40', 4), { x: -0.2, y: 1.1, z: -0.7 });
  return { parts: k.build(), top: 1.04, bob: 0.02, roll: 0.01 };
}

// The buwaya, len cells long, its head at +x. Its jaw opens and shuts (a separate part).
function buwaya(len) {
  const k = new Kit(), Lm = len * 2 - 0.3, hx = Lm / 2;
  k.add('croc', new THREE.SphereGeometry(1, 24, 12), '#ffffff', { x: -0.15, y: -0.02, sx: Lm * 0.34, sy: 0.3, sz: 0.52 }); // the back
  k.add('croc', new THREE.ConeGeometry(0.4, Lm * 0.42, 12), '#ffffff', { x: -hx + Lm * 0.21, y: 0.0, rz: HP, sy: 1, sz: 0.55 }); // the tail
  for (let s = 0; s < 14; s++) { const x = -hx + 0.5 + s * (Lm * 0.72 / 14); k.box('croc', 0.12, 0.1, 0.1, '#ffffff', { x, y: 0.26 - Math.max(0, -x - 1) * 0.06, z: 0.12 }); k.box('croc', 0.12, 0.1, 0.1, '#ffffff', { x, y: 0.26 - Math.max(0, -x - 1) * 0.06, z: -0.12 }); } // the scutes
  k.add('croc', new THREE.SphereGeometry(1, 16, 8), '#ffffff', { x: hx - 1.15, y: 0.02, sx: 0.55, sy: 0.24, sz: 0.4 }); // the neck
  k.rbox('croc', 1.4, 0.2, 0.52, 0.09, '#ffffff', { x: hx - 0.65, y: -0.04 }); // the lower jaw
  for (const s of [-1, 1]) for (const x of [-1.2, 0.2]) k.rbox('croc', 0.34, 0.1, 0.18, 0.04, '#ffffff', { x: x + (x > 0 ? 0 : 0), y: -0.1, z: s * 0.48, ry: s * 0.4 }); // legs
  return { parts: k.build(), top: 0.28, bob: 0.02 };
}
// The upper jaw, hinged at its back: the eyes glow, the teeth show.
export function crocJaw() {
  const k = new Kit();
  k.rbox('croc', 1.36, 0.18, 0.5, 0.08, '#ffffff', { x: 0.68, y: 0.07 });
  for (let s = 0; s < 6; s++) for (const z of [-0.22, 0.22]) k.add('tooth', new THREE.ConeGeometry(0.035, 0.12, 5), '#f4f1e0', { x: 0.2 + s * 0.2, y: -0.04, z, rx: Math.PI });
  for (const z of [-0.16, 0.16]) { k.ball('croc', 0.1, '#ffffff', { x: 0.12, y: 0.18, z }); k.ball('lamp', 0.06, lamp('#ffd030', 2.2), { x: 0.16, y: 0.23, z }); k.box('body', 0.02, 0.07, 0.015, '#0a0a0a', { x: 0.215, y: 0.235, z }); }
  k.ball('body', 0.03, '#0a0a0a', { x: 1.3, y: 0.17, z: 0.08 }); k.ball('body', 0.03, '#0a0a0a', { x: 1.3, y: 0.17, z: -0.08 });
  return k.build();
}

const FLOAT = { troso: { whole: troso }, balsa: { whole: balsa }, banig: { whole: banig }, bangka: { whole: bangka }, ferry: { whole: ferry }, pagong: { unit: pagongUnit }, salbabida: { unit: salbabidaUnit }, batya: { unit: batyaUnit }, styro: { unit: styroUnit }, lily: { unit: lilyUnit } };
const fCache = new Map();
// The model for a floater of `len` cells: { parts, top, bob, unit } (unit: parts are one cell's worth).
export function floaterModel(type, len) {
  const key = type + ':' + len;
  if (fCache.has(key)) return fCache.get(key);
  const f = FLOAT[type] || FLOAT.troso;
  const m = f.whole ? { ...f.whole(len), unit: false } : { ...f.unit(), unit: true };
  fCache.set(key, m);
  return m;
}
export function buwayaModel(len) {
  const key = 'buwaya:' + len;
  if (!fCache.has(key)) fCache.set(key, buwaya(len));
  return fCache.get(key);
}

// ---------- the leaves and the frogs ----------
// A gabi leaf: a big heart, cupped a little, its point toward +x; the stalk joins near the notch.
export function gabiLeafGeo(size = 1) {
  const s = new THREE.Shape(), n = 40;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * TAU, r = 0.5 * (1 - 0.18 * Math.cos(t)) * (1 - 0.35 * Math.exp(-((t - Math.PI) ** 2) * 18));
    const x = Math.cos(t) * r * 1.12 + 0.08, y = Math.sin(t) * r * 0.92;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  const g = new THREE.ShapeGeometry(s, 8);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    uv.setXY(i, x + 0.5, y + 0.5);
    p.setXYZ(i, x * size, (-(x * x + y * y) * 0.28 + Math.abs(y) * 0.12) * size, -y * size); // lying flat on y, cupped
  }
  g.computeVertexNormals();
  return g;
}

// A little frog, merged: the family on the leaves and the lost anak. Faces +x, sits on y = 0.
export function miniFrog() {
  const k = new Kit();
  k.add('skin', new THREE.SphereGeometry(0.5, 18, 12), '#ffffff', { y: 0.34, sx: 1.05, sy: 0.66, sz: 0.9 });
  for (const s of [-1, 1]) {
    k.ball('skin', 0.19, '#ffffff', { x: 0.2, y: 0.62, z: s * 0.2 });
    k.ball('eye', 0.16, '#ffffff', { x: 0.26, y: 0.68, z: s * 0.21 });
    k.ball('body', 0.075, '#0a0a0a', { x: 0.39, y: 0.7, z: s * 0.22, sx: 0.6, sy: 0.8 });
    k.ball('skin', 0.22, '#ffffff', { x: -0.26, y: 0.2, z: s * 0.36, sx: 1.4, sy: 0.7, sz: 0.8 }); // thighs
    k.ball('skin', 0.12, '#ffffff', { x: 0.1, y: 0.06, z: s * 0.52, sx: 1.6, sy: 0.4 }); // feet
    k.ball('skin', 0.09, '#ffffff', { x: 0.38, y: 0.1, z: s * 0.3, sx: 1.2, sy: 0.5 });
  }
  k.add('body', new THREE.TorusGeometry(0.34, 0.02, 4, 16, Math.PI * 0.7), '#1a3a14', { x: 0.2, y: 0.4, rx: HP, rz: -Math.PI * 0.35, sy: 1 });
  return k.build();
}

// A lamok: a thin dark body, long legs; its wings are separate, to beat.
export function lamokModel() {
  const k = new Kit();
  k.ball('body', 0.08, '#1a1a20', { sx: 2.2, sy: 0.7, sz: 0.7 });
  k.ball('body', 0.05, '#2a2a30', { x: 0.2 });
  k.cyl('body', 0.006, 0.006, 0.2, '#1a1a20', { x: 0.32, y: -0.02, rz: HP + 0.3 });
  for (let s = 0; s < 3; s++) for (const z of [-1, 1]) k.cyl('body', 0.005, 0.005, 0.34, '#1a1a20', { x: -0.08 + s * 0.08, y: -0.12, z: z * 0.1, rx: z * 0.6, rz: (s - 1) * 0.4 });
  for (let s = 0; s < 4; s++) k.box('body', 0.02, 0.012, 0.13, s % 2 ? '#f4f1e8' : '#1a1a20', { x: -0.12 + s * 0.035 }); // stripes: it's an Aedes
  return k.build();
}
export function wingGeo() { const g = new THREE.CircleGeometry(0.2, 12); g.scale(0.45, 1, 1); g.translate(0, 0.2, 0); g.rotateX(-HP); return g; }

// The ahas: a stretch of its body (a ball the view strings along a curve) and its head.
export function snakeHead() {
  const k = new Kit();
  k.ball('snake', 0.2, '#ffffff', { x: 0.1, sx: 1.6, sy: 0.7, sz: 1.1 });
  for (const z of [-0.12, 0.12]) { k.ball('lamp', 0.045, lamp('#ffe040', 2), { x: 0.28, y: 0.1, z }); k.box('body', 0.012, 0.05, 0.01, '#000000', { x: 0.315, y: 0.11, z }); }
  k.box('body', 0.22, 0.01, 0.03, '#e8384f', { x: 0.5, y: -0.02 }); k.box('body', 0.07, 0.01, 0.06, '#e8384f', { x: 0.62, y: -0.02, ry: 0.4 }); // the tongue
  return k.build();
}

export { matrix };

// Manong Enforcer: blue uniform, a reflective vest, a cap, a whistle. Faces +x; his right arm (a
// separate part, hung from the shoulder) waves.
export function enforcerModel() {
  const k = new Kit(), skin = '#b87a4a';
  for (const z of [-0.1, 0.1]) { k.rbox('body', 0.15, 0.82, 0.16, 0.05, '#1a2a4a', { y: 0.45, z }); k.rbox('body', 0.26, 0.1, 0.14, 0.04, '#141414', { x: 0.05, y: 0.05, z }); }
  k.rbox('body', 0.3, 0.62, 0.42, 0.1, '#6a9ad8', { y: 1.16 }); // the polo
  k.rbox('body', 0.32, 0.5, 0.44, 0.08, '#c8f040', { y: 1.18, sx: 1.02 }); // the vest
  for (const y of [1.06, 1.3]) k.box('body', 0.33, 0.04, 0.45, '#e8eef0', { y });
  k.rbox('body', 0.12, 0.56, 0.12, 0.05, '#6a9ad8', { y: 1.12, z: -0.27, rx: 0.1 }); // the left arm, down
  k.ball('body', 0.12, skin, { y: 1.58 });
  k.cyl('body', 0.13, 0.13, 0.08, '#1f3f8a', { y: 1.68 }, 14); k.box('body', 0.16, 0.02, 0.24, '#1f3f8a', { x: 0.1, y: 1.65 }); // cap and visor
  k.box('body', 0.04, 0.04, 0.04, '#e8e8e8', { x: 0.12, y: 1.52 }); // whistle
  return k.build();
}
export function enforcerArm() {
  const k = new Kit();
  k.rbox('body', 0.12, 0.56, 0.12, 0.05, '#6a9ad8', { y: 0.26 });
  k.ball('body', 0.07, '#b87a4a', { y: 0.58 });
  return k.build();
}
