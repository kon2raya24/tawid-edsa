// The rules of Tawid EDSA: a pure, seeded, fixed 60 Hz simulation. One cell is 240 units. Every lane
// object's position is a function of the tick alone, so anyone (the renderer, the bot) can ask where
// anything will be at any tick. frogTick() moves the frog one tick and reports what happened; the bot
// runs the same function on a copy of the frog to plan. Rendering and audio only read the state.
//
// Tick order: read input, move the frog (hop, ride), hazards and landing, bonuses, the timer.
import { rand } from './rng.mjs';
import { STAGES } from './stages.mjs';

export const COLS = 15, ROWS = 13, CELL = 240, HALF = 120, SPAN = COLS * CELL;
export const HOME = 0, ISLAND = 6, START = 12;
export const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;
export const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
export const TICK = 1 / 60;
export const HOP = 8, DIE = 72, READY = 60, REPEAT = 5;
export const BAYS = [1, 4, 7, 10, 13];
export const FROG = 78; // half the frog's width against traffic, in units
export const DIVE = { period: 330, up: 210, sink: 30, under: 60 }; // then it rises for the rest
export const POINTS = { step: 10, home: 50, perSec: 10, all: 1000, lamok: 200, anak: 200 };
export const LAMOK = { every: [420, 720], stay: 300 };
export const BAY_BUWAYA = { every: [600, 900], warn: 60, stay: 240 };
export const ANAK = { every: [600, 900], stay: 720, row: 4 };
export const SNAKE = { speed: 3, reach: 200 };

export const DIFFICULTY = {
  madali: { key: 'madali', name: 'Madali', lives: 5, speed: 0.75, timer: 60, homeTol: 0.5, landTol: 0.25, longer: true, diveFrom: 2, buwayaFrom: 3, snakeFrom: 4, extraLife: 10000 },
  katamtaman: { key: 'katamtaman', name: 'Katamtaman', lives: 3, speed: 1, timer: 40, homeTol: 0.38, landTol: 0.08, longer: false, diveFrom: 1, buwayaFrom: 2, snakeFrom: 3, extraLife: 10000 },
  mahirap: { key: 'mahirap', name: 'Mahirap', lives: 2, speed: 1.25, timer: 30, homeTol: 0.3, landTol: 0, longer: false, diveFrom: 1, buwayaFrom: 1, snakeFrom: 2, extraLife: 20000 },
};

export const NOINPUT = Object.freeze({ pressed: [], held: [] });
const mod = (a, m) => ((a % m) + m) % m;
export const isWater = (row) => row >= 1 && row <= 5;
export const isRoad = (row) => row >= 7 && row <= 11;
export const colX = (c) => c * CELL + HALF;
const snap = (x) => colX(Math.max(0, Math.min(COLS - 1, Math.round((x - HALF) / CELL))));

// ---------- lanes ----------
function buildLanes(def, diff, loop, diving, buwaya) {
  const mult = diff.speed * (1 + 0.15 * loop);
  const lanes = new Array(ROWS).fill(null);
  const make = (l, kind, row) => {
    let len = l.len;
    if (kind === 'water' && diff.longer) {
      const at = [...l.at].sort((a, b) => a - b);
      const gaps = at.map((a, i) => (i + 1 < at.length ? at[i + 1] : at[0] + l.loop) - a);
      if (Math.min(...gaps) - len >= 2) len += 1; // Madali: longer logs where there's room
    }
    return {
      row, kind, type: l.type, dir: l.dir, speed: l.speed * mult, len, loop: Math.max(l.loop, COLS + len), at: [...l.at],
      dive: diving && l.dive ? (diff.longer ? l.dive.slice(0, 1) : [...l.dive]) : [],
      buwaya: buwaya && l.buwaya !== undefined ? l.buwaya : -1,
    };
  };
  def.lanes.road.forEach((l, k) => { lanes[11 - k] = make(l, 'road', 11 - k); });
  def.lanes.water.forEach((l, k) => { lanes[5 - k] = make(l, 'water', 5 - k); });
  return lanes;
}

// Where a diving object is in its cycle: 0 afloat, 1 going under (still safe), 2 under, 3 coming up.
export function diveState(lane, k, t) {
  const p = mod(t + k * 83 + lane.row * 37, DIVE.period);
  return p < DIVE.up ? 0 : p < DIVE.up + DIVE.sink ? 1 : p < DIVE.up + DIVE.sink + DIVE.under ? 2 : 3;
}

// Every object in a lane at tick t: its left and right edges in units (it may be off screen). A lane's
// 'at' cells are where its objects' left edges are on screen at tick 0.
export function objectsAt(lane, t) {
  const L = lane.loop * CELL, pad = (lane.loop - COLS) * CELL;
  return lane.at.map((a, k) => {
    const left = mod(a * CELL + pad + lane.dir * lane.speed * t, L) - pad;
    return { k, left, right: left + lane.len * CELL, sub: lane.dive.includes(k) ? diveState(lane, k, t) : 0, buwaya: lane.buwaya === k };
  });
}

export function platformAt(g, row, x, t) {
  const lane = g.lanes[row];
  if (!lane || lane.kind !== 'water') return null;
  const tol = g.diff.landTol * CELL;
  for (const o of objectsAt(lane, t)) if (x >= o.left - tol && x <= o.right + tol) return o;
  return null;
}

export function carAt(g, row, x, t) {
  const lane = g.lanes[row];
  if (!lane || lane.kind !== 'road') return null;
  for (const o of objectsAt(lane, t)) if (x + FROG > o.left + 20 && x - FROG < o.right - 20) return o;
  return null;
}

// The crocodile bites with its head: the front cell, whichever way it swims.
export function inHead(lane, o, x) {
  return lane.dir > 0 ? x >= o.right - CELL : x <= o.left + CELL;
}

// The ahas on the island goes back and forth, end to end.
export function snakeX(g, t) {
  if (!g.snake) return null;
  const run = SPAN - CELL, p = mod(t * g.snake.speed, 2 * run);
  return HALF + (p < run ? p : 2 * run - p);
}

export function bayAt(g, x) {
  const tol = g.diff.homeTol * CELL;
  for (let b = 0; b < BAYS.length; b++) if (Math.abs(x - colX(BAYS[b])) <= tol) return b;
  return -1;
}
const bayBites = (g, b) => !!g.buwaya && g.buwaya.bay === b && g.buwaya.t <= BAY_BUWAYA.stay;

// ---------- the frog ----------
// One tick of the frog alone: start a hop (want is a direction or -1), carry it on whatever it rides,
// land it, and check every hazard. It changes only f, so the bot can run it on a copy.
export function frogTick(g, f, t, want) {
  const res = { started: false, landed: false, dead: null, home: -1 };
  if (!f.hop && want >= 0) {
    f.dir = want;
    const trow = f.row + DY[want];
    const land = !isWater(trow) && trow !== HOME;
    let tx = DY[want] ? (land ? snap(f.x) : f.x) : (isWater(f.row) ? f.x : snap(f.x)) + DX[want] * CELL;
    const inside = DY[want] !== 0 || (tx >= HALF - 1 && tx <= SPAN - HALF + 1);
    if (trow >= HOME && trow <= START && inside) {
      f.hop = { t: 0, fx: f.x, frow: f.row, tx, trow, dir: want };
      res.started = true;
    }
  }
  if (f.hop) {
    const h = f.hop;
    if (h.frow === h.trow && isWater(h.frow)) {
      // a sideways hop on the water still drifts with it
      const o = platformAt(g, h.frow, f.x, t - 1);
      if (o && o.sub !== 2) { const v = g.lanes[h.frow].dir * g.lanes[h.frow].speed; h.fx += v; h.tx += v; }
    }
    h.t++;
    f.x = h.fx + ((h.tx - h.fx) * h.t) / HOP;
    if (h.t >= HOP) { f.row = h.trow; f.x = h.tx; f.hop = null; f.idle = 0; res.landed = true; }
  } else {
    f.idle++;
    if (isWater(f.row)) {
      const o = platformAt(g, f.row, f.x, t - 1);
      if (o && o.sub !== 2) f.x += g.lanes[f.row].dir * g.lanes[f.row].speed;
    }
  }
  const row = f.hop ? (f.hop.t < HOP / 2 ? f.hop.frow : f.hop.trow) : f.row;
  if (isRoad(row)) { const c = carAt(g, row, f.x, t); if (c) res.dead = g.lanes[row].type; }
  if (row === ISLAND && g.snake && Math.abs(f.x - snakeX(g, t)) < SNAKE.reach) res.dead = 'ahas';
  if (!f.hop && isWater(f.row)) {
    if (f.x < 0 || f.x > SPAN) res.dead = 'anod';
    else {
      const o = platformAt(g, f.row, f.x, t);
      if (!o || o.sub === 2) res.dead = 'tubig';
      else if (o.buwaya && inHead(g.lanes[f.row], o, f.x)) res.dead = 'buwaya';
    }
  }
  if (res.landed && f.row === HOME) {
    const b = bayAt(g, f.x);
    if (b < 0 || g.homes[b]) res.dead = 'pilapil';
    else if (bayBites(g, b)) res.dead = 'buwaya';
    else res.home = b;
  }
  return res;
}

export const newFrog = () => ({ x: colX(7), row: START, dir: UP, hop: null, idle: 0, buf: -1, carry: false });

// ---------- a game ----------
export function createGame({ seed = 1, difficulty = 'katamtaman', level = 1, score = 0, lives, nextExtra } = {}) {
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.katamtaman;
  const g = {
    seed, difficulty: diff.key, diff, level, score, lives: lives ?? diff.lives,
    nextExtra: nextExtra !== undefined ? nextExtra : (Math.floor(score / diff.extraLife) + 1) * diff.extraLife,
    tick: 0, acc: 0, rs: (seed * 2654435761 + level * 40503) >>> 0, deaths: 0,
  };
  const n = (level - 1) % STAGES.length;
  g.loop = Math.floor((level - 1) / STAGES.length);
  g.def = STAGES[n];
  const on = (from) => g.loop > 0 || g.def.n >= from;
  g.lanes = buildLanes(g.def, diff, g.loop, on(diff.diveFrom), on(diff.buwayaFrom));
  g.snake = on(diff.snakeFrom) ? { speed: SNAKE.speed * diff.speed * (1 + 0.15 * g.loop) } : null;
  g.bayBuwaya = on(diff.buwayaFrom);
  g.homes = [false, false, false, false, false];
  g.lamok = null; g.lamokT = between(g, LAMOK.every);
  g.buwaya = null; g.buwayaT = between(g, BAY_BUWAYA.every);
  g.anak = null; g.anakT = between(g, ANAK.every);
  spawn(g);
  g.phase = 'ready'; g.phaseT = READY;
  return g;
}
export const nextLevel = (g) => createGame({ seed: g.seed, difficulty: g.difficulty, level: g.level + 1, score: g.score, lives: g.lives, nextExtra: g.nextExtra });

const between = (g, [a, b]) => a + Math.floor(rand(g) * (b - a + 1));
function spawn(g) { g.frog = newFrog(); g.best = START; g.timeLeft = g.diff.timer * 60; g.timeWarned = false; }

// Real frame time through a fixed-tick accumulator; presses between ticks are kept for the next one.
export function step(g, input = NOINPUT, dt = TICK) {
  g.inbox = { held: input.held || [], pressed: [...(g.inbox?.pressed || []), ...(input.pressed || [])] };
  g.acc += Math.min(dt, 0.1);
  const ev = [];
  while (g.acc >= TICK - 1e-9) {
    g.acc -= TICK;
    ev.push(...tick(g, g.inbox));
    g.inbox = { held: g.inbox.held, pressed: [] };
  }
  return ev;
}

export function tick(g, input = NOINPUT) {
  const ev = [];
  g.tick++;
  switch (g.phase) {
    case 'ready': if (--g.phaseT <= 0) { g.phase = 'play'; ev.push({ type: 'go' }); } break;
    case 'dying': if (--g.phaseT <= 0) afterDeath(g, ev); break;
    case 'play': play(g, input, ev); break;
    default: break;
  }
  return ev;
}

function play(g, input, ev) {
  const f = g.frog;
  const pressed = input.pressed || [], held = input.held || [];
  if (pressed.length) f.buf = pressed[pressed.length - 1];
  let want = -1;
  if (!f.hop) {
    if (f.buf >= 0) { want = f.buf; f.buf = -1; } else if (held.length && f.idle >= REPEAT) want = held[held.length - 1];
  }
  const r = frogTick(g, f, g.tick, want);
  if (r.started) ev.push({ type: 'hop', dir: f.dir, row: f.hop.frow, to: f.hop.trow });
  if (r.dead) { die(g, r.dead, ev); return; }
  if (r.landed) {
    ev.push({ type: 'land', row: f.row, x: f.x, water: isWater(f.row) });
    if (f.row < g.best) { g.best = f.row; addScore(g, POINTS.step, ev); }
  }
  if (r.home >= 0) { home(g, r.home, ev); if (g.phase !== 'play') return; }
  // the lost little frog: hop onto its log to carry it home
  if (g.anak && !f.hop && f.row === g.anak.row && !f.carry) {
    const ax = anakX(g, g.tick);
    if (Math.abs(f.x - ax) < 0.55 * CELL) { f.carry = true; g.anak = null; ev.push({ type: 'anakAboard' }); }
  }
  bonuses(g, ev);
  if (--g.timeLeft <= 0) { die(g, 'oras', ev); return; }
  if (!g.timeWarned && g.timeLeft <= 600) { g.timeWarned = true; ev.push({ type: 'timeLow' }); }
}

export function anakX(g, t) {
  if (!g.anak) return null;
  const o = objectsAt(g.lanes[g.anak.row], t)[g.anak.k];
  return o.left + g.anak.off;
}

function home(g, b, ev) {
  const f = g.frog;
  g.homes[b] = true;
  const secs = Math.floor(g.timeLeft / 60);
  const lamok = !!g.lamok && g.lamok.bay === b;
  let pts = POINTS.home + POINTS.perSec * secs;
  if (lamok) { pts += POINTS.lamok; g.lamok = null; g.lamokT = between(g, LAMOK.every); }
  if (f.carry) pts += POINTS.anak;
  addScore(g, pts, ev);
  ev.push({ type: 'home', bay: b, points: pts, secs, lamok, anak: f.carry });
  if (g.homes.every(Boolean)) {
    addScore(g, POINTS.all, ev);
    g.phase = 'clear';
    ev.push({ type: 'levelClear', level: g.level, bonus: POINTS.all });
    return;
  }
  spawn(g);
}

function bonuses(g, ev) {
  const free = () => g.homes.map((h, b) => (h || g.lamok?.bay === b || g.buwaya?.bay === b ? -1 : b)).filter((b) => b >= 0);
  // a lamok lands on an empty gabi leaf now and then: eat it for a bonus
  if (g.lamok) { if (--g.lamok.t <= 0) { g.lamok = null; g.lamokT = between(g, LAMOK.every); } }
  else if (--g.lamokT <= 0) {
    const bays = free();
    if (bays.length) { const bay = bays[Math.floor(rand(g) * bays.length)]; g.lamok = { bay, t: LAMOK.stay }; ev.push({ type: 'lamok', bay }); }
    else g.lamokT = between(g, LAMOK.every);
  }
  // a buwaya peeks into an empty leaf: first just its eyes, then its jaws
  if (g.bayBuwaya) {
    if (g.buwaya) {
      if (--g.buwaya.t <= 0) { g.buwaya = null; g.buwayaT = between(g, BAY_BUWAYA.every); } else if (g.buwaya.t === BAY_BUWAYA.stay) ev.push({ type: 'buwayaBites', bay: g.buwaya.bay });
    } else if (--g.buwayaT <= 0) {
      const bays = free();
      if (bays.length) { const bay = bays[Math.floor(rand(g) * bays.length)]; g.buwaya = { bay, t: BAY_BUWAYA.warn + BAY_BUWAYA.stay }; ev.push({ type: 'buwayaPeek', bay }); }
      else g.buwayaT = between(g, BAY_BUWAYA.every);
    }
  }
  // a lost anak na palaka rides a log, waiting to be carried home
  if (g.anak) { if (--g.anak.t <= 0) { g.anak = null; g.anakT = between(g, ANAK.every); ev.push({ type: 'anakGone' }); } }
  else if (!g.frog.carry && --g.anakT <= 0) {
    const lane = g.lanes[ANAK.row];
    const ok = lane.at.map((_, k) => k).filter((k) => !lane.dive.includes(k) && lane.buwaya !== k);
    const k = ok[Math.floor(rand(g) * ok.length)];
    g.anak = { row: ANAK.row, k, off: (lane.len * CELL) / 2, t: ANAK.stay };
    ev.push({ type: 'anak', row: ANAK.row });
  }
}

function die(g, cause, ev) {
  const f = g.frog;
  g.phase = 'dying'; g.phaseT = DIE; g.deaths++;
  f.dead = cause; f.hop = null;
  if (f.carry) { f.carry = false; ev.push({ type: 'anakLost' }); }
  ev.push({ type: 'died', cause, x: f.x, row: f.row });
}

function afterDeath(g, ev) {
  g.lives--;
  if (g.lives <= 0) { g.lives = 0; g.phase = 'over'; ev.push({ type: 'gameover', score: g.score }); return; }
  spawn(g);
  g.phase = 'play';
  ev.push({ type: 'respawn', lives: g.lives });
}

function addScore(g, n, ev) {
  g.score += n;
  while (g.nextExtra && g.score >= g.nextExtra) {
    g.nextExtra += g.diff.extraLife;
    if (g.lives < 9) { g.lives++; ev.push({ type: 'extraLife', lives: g.lives }); }
  }
}

// A stable fingerprint of everything that matters, for replay tests.
export function hashState(g) {
  const f = g.frog;
  return JSON.stringify([g.tick, g.phase, g.score, g.lives, g.homes, g.rs, f.x, f.row, f.hop, f.carry, g.timeLeft, g.lamok, g.buwaya, g.anak]);
}
