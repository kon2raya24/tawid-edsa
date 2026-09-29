// Balance, played by the planner in src/bot.mjs. The perfect planner sees every lane exactly, so if it
// can't get a frog home without dying, the level is unfair. The person-like planner looks ten moves
// ahead, pauses before each hop, and presses up to 5 ticks late without looking again, which is how
// people die. Its floors sit a little under what it reaches today.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tick } from '../src/game.mjs';
import { bot } from '../src/bot.mjs';
import { rand } from '../src/rng.mjs';

function play(difficulty, level, seed, opts) {
  const g = createGame({ seed, difficulty, level });
  const dice = { rs: seed * 99 };
  for (let k = 0; k < 60 * 300; k++) {
    tick(g, bot(g, { ...opts, rand: () => rand(dice) }));
    if (g.phase === 'clear' || g.phase === 'over') break;
  }
  return { clear: g.phase === 'clear', deaths: g.deaths };
}

test('every place, in both rounds, on every difficulty, can be cleared without losing a frog', () => {
  for (const d of ['madali', 'katamtaman', 'mahirap']) for (const level of [1, 2, 3, 4, 5]) for (const seed of [1, 2]) {
    const r = play(d, level, seed, { depth: 30 });
    assert.ok(r.clear && r.deaths === 0, `${d} level ${level} seed ${seed}: ${JSON.stringify(r)}`);
  }
});

const PERSON = { depth: 10, react: 6, jitter: 5 };
const clears = (d, level, n = 10) => Array.from({ length: n }, (_, i) => play(d, level, i + 1, PERSON)).filter((r) => r.clear).length;

test('a person-like player: Madali is kind for the first three places, and the difficulties are in order', () => {
  const m = [1, 2, 3].map((l) => clears('madali', l));
  assert.ok(m[0] >= 8, `Madali level 1: ${m[0]}/10`);
  assert.ok(m[0] + m[1] + m[2] >= 22, `Madali levels 1-3: ${m.join(', ')}`);
  const early = (d) => clears(d, 1) + clears(d, 2);
  const [a, b, c] = [m[0] + m[1], early('katamtaman'), early('mahirap')];
  assert.ok(a > b && b > c, `first two levels: Madali ${a}, Katamtaman ${b}, Mahirap ${c}`);
});
