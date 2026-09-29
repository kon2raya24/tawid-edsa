// The page: screens, input (keys, swipes and taps, the touch d-pad), the loop, sound, saves and hints.
// The rules live in game.mjs; the drawing in render.mjs.
import { createGame, nextLevel, step, DIFFICULTY, UP, RIGHT, DOWN, LEFT } from './game.mjs';
import { STAGES, TIPS } from './stages.mjs';
import { bot } from './bot.mjs';
import { rand } from './rng.mjs';
import { createRenderer } from './render.mjs';
import { createAudio } from './audio.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1';
const AUTOPLAY = TEST && Q.get('autoplay') === '1';
const KEY = 'tawidedsa.v1';
const store = {
  get() { if (TEST) return null; try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } },
  set(v) { if (TEST) return; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage unavailable: play on */ } },
};
const touch = matchMedia('(pointer: coarse)').matches;
const saved = store.get() || {};
const data = {
  best: Number(saved.best) || 0, muted: !!saved.muted, calm: !!saved.calm, safety: !!saved.safety,
  difficulty: DIFFICULTY[saved.difficulty] ? saved.difficulty : 'madali',
  hints: Array.isArray(saved.hints) ? saved.hints : [],
  reached: saved.reached && typeof saved.reached === 'object' ? saved.reached : {},
};
const persist = () => store.set(data);
const reduced = () => data.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const seed = () => (TEST && Q.get('seed') ? Number(Q.get('seed')) : Math.floor(Math.random() * 1e9));
const buzz = (p) => { try { if (navigator.vibrate && touch) navigator.vibrate(p); } catch { /* no haptics */ } };
const tip = () => TIPS[1 + Math.floor(Math.random() * (TIPS.length - 1))];
const placeOf = (level) => STAGES[(level - 1) % STAGES.length];

const $ = (id) => document.getElementById(id);
const R = createRenderer($('board'));
const A = createAudio();
A.setMuted(data.muted);

let mode = 'title', game = null, pending = null;
const demoDice = { rs: Math.floor(Math.random() * 1e9) };
let demo = newDemo();
function newDemo() { return createGame({ seed: seed(), difficulty: 'madali', level: 1 + Math.floor(Math.random() * 4) }); }

const SCREENS = ['title', 'safety', 'pause', 'clear', 'over'];
function show(name) {
  for (const id of SCREENS) $(id).hidden = id !== name;
  if (name) { toasts.length = 0; $('toast').hidden = true; }
  $('pause-btn').hidden = name !== null;
  document.body.classList.toggle('playing', name === null);
  const first = name && ($(name).querySelector('button.primary') || $(name).querySelector('button'));
  if (first) first.focus({ preventScroll: true });
}
const later = (ms, fn) => { const token = game; setTimeout(() => { if (game === token) fn(); }, ms); };

function start(level = 1) {
  A.start();
  if (!data.safety && !AUTOPLAY) { pending = level; mode = 'safety'; show('safety'); return; }
  game = createGame({ seed: seed(), difficulty: data.difficulty, level });
  begin();
  hint('move', touch ? 'I-swipe o i-tap ang laro para tumalon. May d-pad din sa ibaba.' : 'Arrow keys o WASD para tumalon. Isang pindot, isang talon.');
}
function begin() {
  R.reset(); mode = 'play'; clearInput(); show(null);
  if (game.snake) hint(`snake`, 'May ahas sa isla! Pabalik-balik lang siya. Abangan ang pagdaan.');
}

function levelCleared() {
  data.reached[data.difficulty] = Math.max(data.reached[data.difficulty] || 1, game.level + 1);
  persist();
  later(1800, () => {
    mode = 'clear';
    $('clear-place').textContent = `Level ${game.level} · ${game.def.name}: nakauwi ang lahat!`;
    const next = placeOf(game.level + 1);
    $('clear-next').textContent = `Susunod: ${next.name} · ${next.road}${game.level % STAGES.length === 0 ? ' (mas mabilis na!)' : ''}`;
    $('clear-tip').textContent = `"${tip()}" — Manong Enforcer`;
    show('clear');
  });
}
function nextOne() { if (mode !== 'clear') return; game = nextLevel(game); begin(); }

function gameOver() {
  later(1200, () => {
    mode = 'over';
    const isBest = game.score > data.best;
    data.best = Math.max(data.best, game.score); persist();
    $('over-score').textContent = game.score;
    $('over-best').textContent = isBest && game.score ? 'Bagong best! New best!' : `Best: ${data.best}`;
    $('over-best').classList.toggle('new', isBest && game.score > 0);
    $('over-where').textContent = `Umabot ka sa Level ${game.level} · ${game.def.name}, ${game.homes.filter(Boolean).length} sa 5 ang nakauwi.`;
    $('over-tip').textContent = `"${tip()}" — Manong Enforcer`;
    $('continue').textContent = `Ituloy sa Level ${game.level}`;
    $('continue').hidden = game.level <= 1;
    show('over');
  });
}

// ---------- hints ----------
const toasts = [];
let toastBusy = false;
function toast(text, ms = 3200) { if (AUTOPLAY) return; toasts.push([text, ms]); if (!toastBusy) nextToast(); }
function nextToast() {
  const el = $('toast'), item = toasts.shift();
  toastBusy = !!item;
  if (!item) { el.hidden = true; return; }
  el.textContent = item[0]; el.hidden = false;
  setTimeout(nextToast, item[1]);
}
function hint(id, text) { if (data.hints.includes(id)) return; data.hints.push(id); persist(); toast(text); }

function onEvent(e) {
  R.event(e, game);
  A.event(e);
  switch (e.type) {
    case 'land': if (e.water) hint('water', 'Sa troso, balsa at pagong ka tumapak. Tatangayin ka ng tubig!'); break;
    case 'lamok': hint('lamok', 'May lamok sa dahon! Sunggaban para sa +200.'); break;
    case 'anak': hint('anak', 'May anak na palaka sa troso! Tumapak sa kanya at iuwi para sa +200.'); break;
    case 'buwayaPeek': hint('buwaya', 'Buwaya sa dahon! Mata pa lang, ligtas pa. Pag panga na, huwag!'); break;
    case 'died': buzz([50, 30, 80]); if (e.cause === 'pilapil') hint('pilapil', 'Tumalon diretso sa dahon ng gabi, hindi sa pilapil.'); break;
    case 'home': buzz(25); break;
    case 'levelClear': levelCleared(); break;
    case 'gameover': gameOver(); break;
    default: break;
  }
}

function pause() { if (mode === 'play') { mode = 'pause'; show('pause'); } }
function resume() { if (mode === 'pause') { mode = 'play'; clearInput(); show(null); } }
function toMenu() { mode = 'title'; game = null; updateTitle(); show('title'); }

// ---------- input ----------
const DIRS = { ArrowUp: UP, ArrowRight: RIGHT, ArrowDown: DOWN, ArrowLeft: LEFT, w: UP, d: RIGHT, s: DOWN, a: LEFT };
const held = new Set();
let pressed = [];
function clearInput() { held.clear(); pressed = []; }
const playing = () => mode === 'play' && game;
document.addEventListener('keydown', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k in DIRS && playing()) { e.preventDefault(); if (!e.repeat) pressed.push(DIRS[k]); held.add(DIRS[k]); return; }
  const onButton = document.activeElement?.tagName === 'BUTTON';
  if ((k === ' ' || k === 'Enter') && !onButton) {
    if (mode === 'title') { e.preventDefault(); start(); return; }
    if (mode === 'clear') { e.preventDefault(); nextOne(); return; }
  }
  if (k === 'p' || k === 'Escape') { if (mode === 'play') pause(); else if (mode === 'pause') resume(); }
  if (k === 'm') toggleSound();
});
document.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k in DIRS) held.delete(DIRS[k]); });
window.addEventListener('blur', clearInput);

// swipe the board to hop that way; a tap hops forward
const stage = $('stage');
let sw = null;
stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' || !playing()) return; A.start(); sw = { x: e.clientX, y: e.clientY, used: false }; });
stage.addEventListener('pointermove', (e) => {
  if (!sw || sw.used || !playing()) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (Math.hypot(dx, dy) < 22) return;
  pressed.push(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP));
  sw.used = true;
});
stage.addEventListener('pointerup', (e) => { if (sw && !sw.used && playing() && !e.target.closest('button')) pressed.push(UP); sw = null; });
stage.addEventListener('pointercancel', () => { sw = null; });
for (const b of document.querySelectorAll('[data-dir]')) {
  const d = Number(b.dataset.dir);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); A.start(); if (playing()) { pressed.push(d); held.add(d); } b.setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => held.delete(d));
}

function toggleSound() { A.start(); data.muted = !data.muted; A.setMuted(data.muted); persist(); labels(); }
function labels() {
  for (const b of document.querySelectorAll('.sound')) { b.textContent = data.muted ? '🔇' : '🔊'; b.setAttribute('aria-label', data.muted ? 'Sound off, turn it on' : 'Sound on, turn it off'); }
  for (const b of document.querySelectorAll('.calm')) { b.setAttribute('aria-pressed', String(data.calm)); b.textContent = data.calm ? 'Bawas-galaw: on' : 'Bawas-galaw: off'; }
  for (const b of document.querySelectorAll('[data-diff]')) b.setAttribute('aria-pressed', String(b.dataset.diff === data.difficulty));
  $('diff-note').textContent = {
    madali: 'Madali: 5 buhay, 60 segundo, mas mabagal ang trapiko at mas mahaba ang troso.',
    katamtaman: 'Katamtaman: ang klasiko. 3 buhay, 40 segundo, lumulubog ang pagong.',
    mahirap: 'Mahirap: 2 buhay, 30 segundo, rush hour na. May buwaya agad, at ahas pagdating sa España.',
  }[data.difficulty];
  updateTitle();
}
for (const b of document.querySelectorAll('.sound')) b.onclick = toggleSound;
for (const b of document.querySelectorAll('.calm')) b.onclick = () => { data.calm = !data.calm; persist(); labels(); };
for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => { data.difficulty = b.dataset.diff; persist(); labels(); };
$('play').onclick = () => start();
$('resume-level').onclick = () => start(data.reached[data.difficulty] || 1);
$('safety-ok').onclick = () => { data.safety = true; persist(); const l = pending || 1; pending = null; start(l); };
$('next').onclick = nextOne;
$('retry').onclick = () => start();
$('continue').onclick = () => start(game.level);
$('resume').onclick = resume;
$('pause-btn').onclick = pause;
for (const b of document.querySelectorAll('.menu')) b.onclick = toMenu;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
function updateTitle() {
  $('title-best').textContent = data.best ? `Best: ${data.best}` : '';
  const r = data.reached[data.difficulty] || 1;
  $('resume-level').hidden = r <= 1;
  $('resume-level').textContent = `Ituloy · Level ${r}`;
}
labels();

// ---------- loop ----------
let last = performance.now(), t = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now; t += dt;
  if (game && mode === 'play') {
    const input = AUTOPLAY ? bot(game, { react: 6, jitter: 3, rand: () => rand(demoDice) }) : { pressed, held: [...held] };
    pressed = [];
    for (const e of step(game, input, dt)) onEvent(e);
  } else if (!game) {
    if (demo.phase === 'over' || demo.phase === 'clear') demo = newDemo();
    for (const e of step(demo, bot(demo, { react: 10, jitter: 3, rand: () => rand(demoDice) }), dt)) R.event(e, demo);
  }
  R.draw(game || demo, t, { reduced: reduced(), best: data.best });
  A.update(game || demo, !!game && mode === 'play', dt);
  requestAnimationFrame(frame);
}
window.addEventListener('resize', R.resize);
new ResizeObserver(() => R.resize()).observe($('board'));
R.resize();
show('title');
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && !TEST) navigator.serviceWorker.register('sw.js').catch(() => { /* online-only then */ });

if (TEST) {
  window.__te = { get game() { return game; }, get mode() { return mode; }, get demo() { return demo; }, start };
  if (Q.get('difficulty')) data.difficulty = Q.get('difficulty');
  if (Q.get('go') === '1') { data.safety = true; start(Number(Q.get('level')) || 1); }
}
