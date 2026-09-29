// A planner for the title demo and the balance tests. Every lane is a function of time, so it looks
// ahead exactly: it runs the rules' own frogTick on copies of the frog, breadth first over hops and
// waits that each last one hop's worth of ticks, and takes the first step of the shortest way home.
// With a short lookahead and a pause before each move it plays more like a person.
import { frogTick, HOP, UP, RIGHT, DOWN, LEFT, NOINPUT } from './game.mjs';

const ACTIONS = [UP, LEFT, RIGHT, -1, DOWN];

// One action from frog f, starting at tick t: the frog after it, { home } if it got home, or null if
// it died (or the hop was not possible).
function act(g, f0, t, a) {
  const f = { ...f0 };
  for (let k = 0; k < HOP; k++) {
    const r = frogTick(g, f, t + k, k === 0 ? a : -1);
    if (k === 0 && a >= 0 && !r.started) return null;
    if (r.dead) return null;
    if (r.home >= 0) return { f, home: r.home };
  }
  return { f };
}

// The first move of the shortest safe way home within `depth` moves; if there is none, the first move
// toward the most progress that still survives the whole lookahead. -1 means wait.
export function plan(g, { depth = 30, budget = 8000 } = {}) {
  const t0 = g.tick + 1;
  let layer = [{ f: { ...g.frog }, first: null }];
  let spent = 0;
  let fallback = -1;
  for (let d = 0; d < depth && layer.length; d++) {
    const next = new Map();
    for (const node of layer) {
      for (const a of ACTIONS) {
        if (++spent > budget) break;
        const r = act(g, node.f, t0 + d * HOP, a);
        if (!r) continue;
        const first = node.first === null ? a : node.first;
        if (r.home !== undefined) return first;
        const key = r.f.row * 4096 + Math.round(r.f.x / 30);
        if (!next.has(key)) next.set(key, { f: r.f, first });
      }
    }
    if (!next.size) break;
    layer = [...next.values()];
    // the furthest-up survivor of the deepest layer reached; ties go to the one nearest the middle
    let best = null;
    for (const n of layer) if (!best || n.f.row < best.f.row || (n.f.row === best.f.row && Math.abs(n.f.x - 1800) < Math.abs(best.f.x - 1800))) best = n;
    fallback = best.first;
    if (spent > budget) break;
  }
  return fallback;
}

const MEM = new WeakMap(); // per game: the tick of the next decision, so a wait is not replanned every tick

// The planner as a player. react: ticks it looks at a fresh frog and between hops before deciding;
// jitter: up to that many ticks late on the button, without looking again, the way a person is.
export function bot(g, { depth = 30, budget = 8000, react = 0, jitter = 0, rand = null } = {}) {
  if (g.phase !== 'play' || g.frog.hop) return NOINPUT;
  const m = MEM.get(g) || { at: 0, frog: null, press: -1 };
  MEM.set(g, m);
  if (m.frog !== g.frog) { m.frog = g.frog; m.at = g.tick + react; m.press = -1; } // a new frog: look before leaping
  if (g.tick < m.at) return NOINPUT;
  if (m.press >= 0) { const a = m.press; m.press = -1; return { pressed: [a], held: [] }; }
  if (g.frog.idle < react) return NOINPUT;
  const a = plan(g, { depth, budget });
  if (a < 0) { m.at = g.tick + HOP; return NOINPUT; }
  const late = jitter && rand ? Math.floor(rand() * (jitter + 1)) : 0;
  if (late) { m.press = a; m.at = g.tick + late; return NOINPUT; }
  return { pressed: [a], held: [] };
}
