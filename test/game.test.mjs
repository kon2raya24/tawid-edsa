import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, nextLevel, tick, step, hashState, objectsAt, platformAt, frogTick, diveState, snakeX, anakX, newFrog, colX,
  COLS, CELL, SPAN, HOP, DIE, READY, REPEAT, BAYS, ISLAND, START, UP, DOWN, LEFT, RIGHT, POINTS, DIVE, BAY_BUWAYA, DIFFICULTY,
} from '../src/game.mjs';
import { STAGES } from '../src/stages.mjs';

// A game in play, with no bonuses about to appear unless a test asks for them.
function play(difficulty = 'katamtaman', over = {}) {
  const g = createGame({ seed: 7, difficulty, ...over });
  g.phase = 'play'; g.phaseT = 0;
  g.lamokT = g.buwayaT = g.anakT = 1e9;
  return g;
}
const lane = (row, o) => ({ row, kind: row <= 5 ? 'water' : 'road', type: o.type || 'troso', dir: 1, speed: 0, len: 3, loop: 20, at: [0], dive: [], buwaya: -1, ...o });
const run = (g, n, input) => { const ev = []; for (let k = 0; k < n; k++) ev.push(...tick(g, typeof input === 'function' ? input(k) : input)); return ev; };
const press = (d) => ({ pressed: [d], held: [] });
const put = (g, row, x) => { g.frog.row = row; g.frog.x = x; g.frog.hop = null; g.best = Math.min(g.best, row); };

test('every lane in every place and difficulty: objects glide at a steady speed, wrap out of sight and never overlap', () => {
  for (const d of Object.keys(DIFFICULTY)) for (let level = 1; level <= 8; level++) {
    const g = createGame({ seed: 1, difficulty: d, level });
    for (const l of g.lanes.filter(Boolean)) {
      assert.ok(l.loop >= COLS + l.len, `${d} ${level} row ${l.row}: loop too short`);
      let prev = objectsAt(l, 0);
      for (let t = 1; t < 1500; t++) {
        const now = objectsAt(l, t);
        for (const o of now) {
          const p = prev[o.k], moved = o.left - p.left;
          if (Math.abs(moved - l.dir * l.speed) > 1e-6) {
            // a wrap: only ever while the object is wholly off screen, before and after
            const edge = l.speed + 1e-6; // it wraps within one tick of leaving the screen
            assert.ok(p.right <= edge || p.left >= SPAN - edge, `${d} ${level} row ${l.row}: popped out at ${p.left}`);
            assert.ok(o.right <= edge || o.left >= SPAN - edge, `${d} ${level} row ${l.row}: popped in at ${o.left}`);
          }
        }
        const s = [...now].sort((a, b) => a.left - b.left);
        for (let i = 1; i < s.length; i++) assert.ok(s[i].left >= s[i - 1].right - 1e-6, `${d} ${level} row ${l.row}: overlap`);
        prev = now;
      }
    }
  }
});

test('a hop takes exactly HOP ticks, scores 10 for a new row, and a press during a hop is kept for the landing', () => {
  const g = play();
  for (const r of [7, 8, 9, 10, 11]) g.lanes[r] = lane(r, { at: [100] }); // keep the road clear of the frog
  let ev = run(g, 1, press(UP));
  assert.equal(ev[0].type, 'hop');
  ev = run(g, HOP - 2, (k) => (k === 2 ? press(UP) : { pressed: [], held: [] }));
  assert.equal(g.frog.row, START);
  ev = run(g, 1);
  assert.equal(g.frog.row, 11); assert.equal(g.score, POINTS.step);
  run(g, 1);
  assert.ok(g.frog.hop, 'the kept press starts the next hop on the next tick');
  run(g, HOP - 1); assert.equal(g.frog.row, 10);
  // hopping back down and up again earns nothing
  run(g, 1, press(DOWN)); run(g, HOP + 1, press(UP)); run(g, HOP);
  assert.equal(g.score, 2 * POINTS.step);
});

test('holding a direction keeps hopping, with a short pause between hops', () => {
  const g = play();
  for (const r of [7, 8, 9, 10, 11]) g.lanes[r] = lane(r, { at: [100] });
  const hold = { pressed: [], held: [UP] };
  run(g, REPEAT + 1, hold);
  assert.ok(g.frog.hop);
  run(g, 3 * (HOP + REPEAT), hold);
  assert.ok(g.frog.row <= 9, `row ${g.frog.row}`);
});

test('sideways hops stay on the grid on the road and never leave the screen', () => {
  const g = play();
  for (const r of [7, 8, 9, 10, 11]) g.lanes[r] = lane(r, { at: [100] });
  for (let k = 0; k < 10; k++) run(g, HOP + 1, press(LEFT));
  assert.equal(g.frog.x, colX(0));
  run(g, HOP + 1, press(LEFT));
  assert.equal(g.frog.x, colX(0));
});

test('traffic: touching a vehicle ends the frog, and the cause names the vehicle', () => {
  const g = play();
  g.lanes[11] = lane(11, { type: 'jeep', dir: 1, speed: 4, len: 2, loop: 20, at: [3] });
  const ev = run(g, 400, (k) => (k === 0 ? press(UP) : { pressed: [], held: [] }));
  const d = ev.find((e) => e.type === 'died');
  assert.ok(d); assert.equal(d.cause, 'jeep');
});

test('water: a log carries the frog at its speed, open water sinks it, and a ride off screen sweeps it away', () => {
  const g = play();
  g.lanes[5] = lane(5, { dir: 1, speed: 3, len: 3, loop: 20, at: [6] });
  put(g, 5, colX(7));
  const x0 = g.frog.x;
  run(g, 30);
  assert.equal(g.phase, 'play'); assert.equal(g.frog.x, x0 + 90);
  const swept = run(g, 2000).find((e) => e.type === 'died');
  assert.equal(swept.cause, 'anod');

  const h = play();
  h.lanes[5] = lane(5, { at: [100] });
  put(h, 5, colX(7));
  const ev = run(h, 1);
  assert.equal(ev.find((e) => e.type === 'died').cause, 'tubig');
});

test('a diving pagong is safe while going under, and sinks the frog once it is under', () => {
  const g = play();
  g.lanes[5] = lane(5, { type: 'pagong', dir: 1, speed: 0, len: 3, at: [6], dive: [0] });
  put(g, 5, colX(7));
  let t = g.tick;
  while (diveState(g.lanes[5], 0, t + 1) !== 1) t++;
  run(g, t - g.tick);
  assert.equal(g.phase, 'play');
  run(g, DIVE.sink - 1);
  assert.equal(g.phase, 'play', 'still going under');
  run(g, 2);
  assert.equal(g.phase, 'dying'); assert.equal(g.frog.dead, 'tubig');
});

test('landing on the water uses the platform edge tolerance: kinder on Madali', () => {
  for (const [d, ok] of [['madali', true], ['katamtaman', false]]) {
    const g = play(d);
    g.lanes[5] = lane(5, { at: [6], len: 3 });
    put(g, ISLAND, colX(7));
    g.frog.x = 6 * CELL - 0.15 * CELL; // just left of the log
    g.lanes[ISLAND] = null;
    // hop up from the island: x is snapped to the column centre first, so use the water row itself
    const f = { ...newFrog(), row: 5, x: 6 * CELL - 0.15 * CELL };
    const r = frogTick(g, f, g.tick + 1, -1);
    assert.equal(!r.dead, ok, d);
  }
});

test('home: a free gabi leaf takes the frog in; the dike and a full leaf do not; five home clears the level', () => {
  const g = play();
  g.lanes[1] = lane(1, { at: [0], len: 15, loop: 30 });
  for (let b = 0; b < 5; b++) {
    put(g, 1, colX(BAYS[b]));
    const before = g.score;
    const ev = run(g, HOP + 1, press(UP));
    const h = ev.find((e) => e.type === 'home');
    assert.ok(h, `bay ${b}`);
    assert.ok(g.score - before >= POINTS.home);
    if (b < 4) { assert.equal(g.frog.row, START); assert.equal(g.phase, 'play'); }
  }
  assert.equal(g.phase, 'clear');

  const d = play();
  d.lanes[1] = lane(1, { at: [0], len: 15, loop: 30 });
  put(d, 1, colX(2)); // between bays: the rice-paddy dike
  run(d, HOP + 1, press(UP));
  assert.equal(d.frog.dead, 'pilapil');
  const e = play();
  e.lanes[1] = lane(1, { at: [0], len: 15, loop: 30 });
  e.homes[2] = true;
  put(e, 1, colX(BAYS[2]));
  run(e, HOP + 1, press(UP));
  assert.equal(e.frog.dead, 'pilapil');
});

test('a lamok on a leaf and a carried anak are each worth 200 more', () => {
  const g = play();
  g.lanes[1] = lane(1, { at: [0], len: 15, loop: 30 });
  g.lamok = { bay: 1, t: 100 };
  g.frog.carry = true;
  put(g, 1, colX(BAYS[1]));
  g.timeLeft = 60 * 10;
  const ev = run(g, HOP + 1, press(UP));
  const h = ev.find((e) => e.type === 'home');
  assert.equal(h.points, POINTS.home + POINTS.perSec * 9 + POINTS.lamok + POINTS.anak);
});

test('the anak rides its log until the frog reaches it, and is lost if the frog is', () => {
  const g = play();
  g.lanes[4] = lane(4, { at: [3, 10], len: 3, dir: 1, speed: 0 });
  g.anak = { row: 4, k: 0, off: 1.5 * CELL, t: 500 };
  put(g, 4, anakX(g, g.tick));
  let ev = run(g, 1);
  assert.ok(ev.some((e) => e.type === 'anakAboard'));
  assert.ok(g.frog.carry);
  g.lanes[3] = lane(3, { at: [100] });
  ev = run(g, HOP + 2, press(UP));
  assert.ok(ev.some((e) => e.type === 'anakLost'));
});

test('the buwaya: its back is a ride, its head bites; in a leaf, its eyes warn before its jaws', () => {
  const g = play();
  g.lanes[3] = lane(3, { type: 'troso', dir: 1, speed: 0, len: 3, at: [5], buwaya: 0 });
  put(g, 3, 5 * CELL + HALFCELL);
  assert.equal(run(g, 5).length, 0);
  put(g, 3, 8 * CELL - 30);
  assert.equal(run(g, 1).find((e) => e.type === 'died').cause, 'buwaya');

  const h = play();
  h.lanes[1] = lane(1, { at: [0], len: 15, loop: 30 });
  h.buwaya = { bay: 2, t: BAY_BUWAYA.warn + BAY_BUWAYA.stay };
  put(h, 1, colX(BAYS[2]));
  assert.ok(run(h, HOP + 1, press(UP)).some((e) => e.type === 'home'), 'only its eyes: safe');
  const k = play();
  k.lanes[1] = lane(1, { at: [0], len: 15, loop: 30 });
  k.buwaya = { bay: 2, t: 100 };
  put(k, 1, colX(BAYS[2]));
  run(k, HOP + 1, press(UP));
  assert.equal(k.frog.dead, 'buwaya');
});
const HALFCELL = CELL / 2;

test('the ahas patrols the island from its level on, end to end, and bites', () => {
  assert.equal(createGame({ difficulty: 'katamtaman', level: 2 }).snake, null);
  const g = play('katamtaman', { level: 3 });
  assert.ok(g.snake);
  const xs = Array.from({ length: 3000 }, (_, t) => snakeX(g, t));
  assert.ok(Math.min(...xs) <= colX(0) + 1 && Math.max(...xs) >= colX(COLS - 1) - 1);
  let t = g.tick;
  while (Math.abs(snakeX(g, t + 1) - colX(7)) > 20) t++;
  run(g, t - g.tick - 1);
  put(g, ISLAND, colX(7));
  assert.equal(run(g, 2).find((e) => e.type === 'died').cause, 'ahas');
});

test('the timer: when it runs out the frog is lost, and it resets for the next frog', () => {
  const g = play();
  g.lanes[11] = lane(11, { at: [100] });
  g.timeLeft = 5;
  const ev = run(g, 5);
  assert.equal(ev.find((e) => e.type === 'died').cause, 'oras');
  run(g, DIE);
  assert.equal(g.timeLeft, g.diff.timer * 60);
});

test('lives, game over and an extra life', () => {
  const g = play();
  g.lanes[11] = lane(11, { at: [100] });
  const lives = g.lives;
  for (let k = 0; k < lives; k++) { g.timeLeft = 1; run(g, 1 + DIE); }
  assert.equal(g.phase, 'over'); assert.equal(g.lives, 0);
  const h = play();
  h.score = h.diff.extraLife - 5;
  h.lanes[11] = lane(11, { at: [100] });
  const ev = run(h, HOP + 1, press(UP));
  assert.ok(ev.some((e) => e.type === 'extraLife'));
  assert.equal(h.lives, h.diff.lives + 1);
});

test('bonuses come and go on their own: lamok, buwaya peeks from its level on, the anak', () => {
  const g = createGame({ seed: 3, difficulty: 'katamtaman', level: 2 });
  g.frog.x = colX(7);
  const seen = new Set();
  for (let k = 0; k < 4000; k++) {
    for (const e of tick(g)) seen.add(e.type);
    if (g.phase === 'dying' || g.phase === 'over') break;
  }
  // the frog sits on the sidewalk until the timer takes it, so it lives 40 s
  for (const t of ['lamok', 'buwayaPeek', 'anak']) assert.ok(seen.has(t), t);
  assert.equal(createGame({ difficulty: 'katamtaman', level: 1 }).bayBuwaya, false);
});

test('replays are exact, whatever the frame rate', () => {
  const inputs = (k) => ({ pressed: k % 37 === 0 ? [[UP, UP, LEFT, UP, RIGHT][(k / 37) % 5]] : [], held: [] });
  const a = createGame({ seed: 11 }), b = createGame({ seed: 11 });
  for (let k = 0; k < 3000; k++) tick(a, inputs(k));
  for (let k = 0; k < 3000; k++) tick(b, inputs(k));
  assert.equal(hashState(a), hashState(b));
  const c = createGame({ seed: 11 }), d = createGame({ seed: 11 });
  for (let k = 0; k < 600; k++) step(c, { pressed: k === 70 ? [UP] : [], held: [] }, 1 / 60);
  for (let k = 0; k < 200; k++) step(d, { pressed: k === 23 ? [UP] : [], held: [] }, 1 / 20);
  assert.equal(c.tick, d.tick);
  assert.equal(c.frog.row, d.frog.row);
});

test('the next level keeps score and lives; after the fourth place comes the second round, faster', () => {
  const g = createGame({ seed: 2, difficulty: 'katamtaman' });
  g.score = 1234; g.lives = 2;
  const n = nextLevel(g);
  assert.equal(n.level, 2); assert.equal(n.score, 1234); assert.equal(n.lives, 2); assert.equal(n.def.n, 2);
  const l1 = createGame({ level: 1 }), l5 = createGame({ level: 5 });
  assert.equal(l5.def.n, 1); assert.equal(l5.loop, 1);
  assert.ok(l5.lanes[11].speed > l1.lanes[11].speed);
  assert.ok(l5.snake && l5.bayBuwaya, 'the second round has everything');
});

test('Madali: slower lanes, longer logs, more time and a wider leaf', () => {
  const m = createGame({ difficulty: 'madali' }), k = createGame({ difficulty: 'katamtaman' });
  assert.ok(m.lanes[11].speed < k.lanes[11].speed);
  assert.ok(m.lanes.filter((l) => l && l.kind === 'water').some((l, i) => l.len > k.lanes[l.row].len));
  assert.ok(m.diff.timer > k.diff.timer && m.diff.homeTol > k.diff.homeTol);
  assert.equal(m.lanes[5].dive.length, 0, 'no diving on the first Madali level');
  assert.equal(STAGES.length, 4);
});

test('the ready pause holds the frog while the traffic already runs', () => {
  const g = createGame({ seed: 1 });
  const before = objectsAt(g.lanes[11], g.tick)[0].left;
  run(g, READY - 1, press(UP));
  assert.equal(g.phase, 'ready'); assert.equal(g.frog.row, START);
  assert.notEqual(objectsAt(g.lanes[11], g.tick)[0].left, before);
  assert.equal(platformAt(g, 12, colX(7), g.tick), null);
});

test('a near miss, "Lusot!": landing just behind a vehicle driving away, or hopping out just before one arrives, is worth 25', async () => {
  const { NEAR, LUSOT } = await import('../src/game.mjs');
  // the frog hops from the sidewalk into row 11, landing just behind a jeep driving east (still, so it's exact)
  const behind = (gapU) => {
    const g = play();
    const x = colX(7);
    g.lanes[11] = lane(11, { type: 'jeep', dir: 1, speed: 0, len: 2, loop: 20, at: [(x + 78 + gapU - 20) / CELL] });
    const ev = run(g, HOP + 1, (k) => (k === 0 ? press(UP) : { pressed: [], held: [] }));
    return { ev, g };
  };
  let r = behind(NEAR - 10);
  assert.ok(!r.ev.some((e) => e.type === 'died'));
  const l = r.ev.find((e) => e.type === 'lusot');
  assert.ok(l && l.how === 'behind'); assert.equal(r.g.score, POINTS.step + POINTS.lusot);
  r = behind(NEAR + 30);
  assert.ok(!r.ev.some((e) => e.type === 'lusot'), 'a wide gap is no near miss');
  // a jeep driving west, toward the frog: landing in front of it is a near miss only if the frog gets out
  const g = play();
  g.lanes[11] = lane(11, { at: [100] });
  put(g, 11, colX(7)); g.best = 11;
  // a car reaches the frog's spot a few ticks after its hop up takes it out of the lane
  g.lanes[11] = lane(11, { type: 'taxi', dir: -1, speed: 30, len: 1, loop: 40, at: [(colX(7) + 78 - 20 + HOP / 2 * 30 + 3 * 30) / CELL] });
  g.lanes[10] = lane(10, { at: [100] });
  const ev = run(g, HOP + 2, (k) => (k === 0 ? press(UP) : { pressed: [], held: [] }));
  assert.ok(!ev.some((e) => e.type === 'died'), JSON.stringify(ev));
  const e = ev.find((x) => x.type === 'lusot');
  assert.ok(e && e.how === 'escaped' && e.row === 11 && LUSOT >= 3);
  // and if the car is far off, nothing
  const g2 = play();
  put(g2, 11, colX(7)); g2.best = 11;
  g2.lanes[11] = lane(11, { type: 'taxi', dir: -1, speed: 30, len: 1, loop: 40, at: [(colX(7) + 78 - 20 + HOP / 2 * 30 + (LUSOT + 6) * 30) / CELL] });
  g2.lanes[10] = lane(10, { at: [100] });
  assert.ok(!run(g2, HOP + 2, (k) => (k === 0 ? press(UP) : { pressed: [], held: [] })).some((x) => x.type === 'lusot'));
});
