// The page: screens, input (keys, swipes and taps, the touch d-pad, a gamepad), the loop, sound, saves,
// hints and the HUD. The rules live in game.mjs; the 3D street in view3d.mjs, or, where WebGL can't
// start, the flat board in render.mjs.
import { createGame, nextLevel, step, DIFFICULTY, UP, RIGHT, DOWN, LEFT, POINTS } from './game.mjs';
import { STAGES, TIPS } from './stages.mjs';
import { bot } from './bot.mjs';
import { rand } from './rng.mjs';
import { createRenderer, CAUSES } from './render.mjs';
import { createAudio } from './audio.mjs';

const Q = new URLSearchParams(location.search);
const TEST = Q.get('test') === '1';
const AUTOPLAY = TEST && Q.get('autoplay') === '1';
const SNAP = TEST && Q.get('snap') === '1'; // headless checks: the camera jumps to where it's going
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
  seen: Array.isArray(saved.seen) ? saved.seen : [], // the levels whose flyover you've watched: shorter after the first time
  gfx: [0, 1, 2].includes(saved.gfx) ? saved.gfx : 'auto', // graphics: auto (steps down on slow devices) or a fixed level
  // the player's settings: the camera (following Kokak, or the whole board), the touch controls, the sound
  opt: { cam: 'cine', pad: 'pad', music: 1, sfx: 1, ...(saved.opt || {}) },
};
const persist = () => store.set(data);
const reduced = () => data.calm || matchMedia('(prefers-reduced-motion: reduce)').matches;
const seed = () => (TEST && Q.get('seed') ? Number(Q.get('seed')) : Math.floor(Math.random() * 1e9));
const buzz = (p) => { try { if (navigator.vibrate && touch) navigator.vibrate(p); } catch { /* no haptics */ } };
const tip = () => TIPS[1 + Math.floor(Math.random() * (TIPS.length - 1))];
const placeOf = (level) => STAGES[(level - 1) % STAGES.length];

const $ = (id) => document.getElementById(id);
let view = null, R = null; // the 3D view, or the flat board when WebGL can't start
const A = createAudio();
A.setMuted(data.muted); A.setMix(data.opt);

let mode = 'title', game = null, pending = null;
const demoDice = { rs: Math.floor(Math.random() * 1e9) };
let demo = newDemo();
function newDemo() { return createGame({ seed: seed(), difficulty: 'madali', level: 1 + Math.floor(Math.random() * 4) }); }

const SCREENS = ['title', 'safety', 'pause', 'clear', 'over', 'settings'];
function show(name) {
  for (const id of SCREENS) $(id).hidden = id !== name;
  if (name) { toasts.length = 0; $('toast').hidden = true; }
  $('pause-btn').hidden = name !== null;
  $('hud').hidden = !(name === null || name === 'pause') && !R;
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
// A level begins with its establishing shot (skipped with any press), then the game's own "ready".
function begin() {
  if (R) R.reset();
  if (view) view.fx.clear();
  clearInput(); show(null);
  lastPhase = null;
  if (view && Q.get('intro') !== '0') {
    const first = !data.seen.includes(game.level);
    if (first) { data.seen.push(game.level); persist(); }
    mode = 'intro'; view.intro(game, reduced() ? 1.1 : first ? 2.4 : 1.5); banner(true);
  }
  else { mode = 'play'; banner(true); }
  if (game.snake) hint('snake', 'May ahas sa isla! Pabalik-balik lang siya. Abangan ang pagdaan.');
}
function banner(on) {
  const el = $('banner');
  if (!on || R) { el.hidden = true; return; }
  const d = game.def;
  $('banner-sub').textContent = `LEVEL ${game.level}${game.loop ? ` · IKOT ${game.loop + 1}` : ''} · ${d.road.toUpperCase()} · ${d.water.toUpperCase()}`;
  $('banner-big').textContent = d.name;
  $('banner-tag').textContent = 'Tawid na, Kokak!';
  el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
}

function levelCleared() {
  data.reached[data.difficulty] = Math.max(data.reached[data.difficulty] || 1, game.level + 1);
  persist();
  toast('KUMPLETO ANG PAMILYA!', 'Kokak! Kokak! +1000', 1700);
  later(1750, () => { A.event({ type: 'whistle' }, game); if (!reduced()) toast('', 'Manong Enforcer: "Ayos, Kokak! Ingat sa susunod!"', 1100); });
  later(3000, () => {
    mode = 'clear';
    $('clear-place').textContent = `Level ${game.level} · ${game.def.name}: nakauwi ang lahat!`;
    const rows = [['Puntos', game.score], ['Buong pamilya', `+${POINTS.all}`], ['Buhay na natitira', game.lives]];
    $('clear-tally').innerHTML = rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
    const next = placeOf(game.level + 1);
    $('clear-next').textContent = `Susunod: ${next.name} · ${next.road}${game.level % STAGES.length === 0 ? ' (mas mabilis na!)' : ''}`;
    $('clear-tip').textContent = `"${tip()}" — Manong Enforcer`;
    show('clear');
  });
}
function nextOne() { if (mode !== 'clear') return; A.ui(1); game = nextLevel(game); begin(); }

function gameOver() {
  later(1400, () => {
    mode = 'over';
    const isBest = game.score > data.best;
    data.best = Math.max(data.best, game.score); persist();
    $('over-score').textContent = game.score;
    $('over-best').textContent = isBest && game.score ? 'Bagong best! New best!' : `Best: ${data.best}`;
    $('over-best').classList.toggle('new', isBest && game.score > 0);
    $('over-where').textContent = `Umabot ka sa Level ${game.level} · ${game.def.name}, ${game.homes.filter(Boolean).length} sa 5 ang nakauwi.`;
    $('over-tip').innerHTML = '<b>Manong Enforcer:</b> ';
    $('over-tip').append(`"${tip()}"`);
    $('continue').textContent = `Ituloy sa Level ${game.level}`;
    $('continue').hidden = game.level <= 1;
    show('over');
  });
}

// ---------- toasts and hints ----------
const toasts = [];
let toastT = 0;
function toast(big, small = '', ms = 1400, cls = '') {
  if (AUTOPLAY) return;
  const el = $('toast');
  el.innerHTML = '<b></b><span></span>'; el.className = cls;
  el.querySelector('b').textContent = big; el.querySelector('span').textContent = small;
  el.querySelector('span').hidden = !small;
  el.hidden = false; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  toastT = ms / 1000;
}
function nextTip() { const t = toasts.shift(); if (t) toast('TIP', t, 3400, 'tip'); }
function hint(id, text) { if (data.hints.includes(id) || AUTOPLAY) return; data.hints.push(id); persist(); toasts.push(text); if (toastT <= 0 && mode !== 'intro') nextTip(); }

let slowT = 0, stopT = 0, lastPhase = null;
function onEvent(e) {
  if (R) R.event(e, game);
  if (view) view.event(e, game);
  A.event(e, game);
  switch (e.type) {
    case 'land': if (e.water) hint('water', 'Sa troso, balsa at pagong ka tumapak. Tatangayin ka ng tubig!'); break;
    case 'lamok': hint('lamok', 'May lamok sa dahon! Sunggaban para sa +200.'); break;
    case 'anak': hint('anak', 'May anak na palaka sa troso! Tumapak sa kanya at iuwi para sa +200.'); break;
    case 'buwayaPeek': hint('buwaya', 'Buwaya sa dahon! Mata pa lang, ligtas pa. Pag panga na, huwag!'); break;
    case 'died':
      buzz([50, 30, 80]);
      if (!reduced()) slowT = 0.42;
      if (!R) toast(CAUSES[e.cause] || 'Aray!', game.lives > 1 ? `${game.lives - 1} pang buhay` : 'Huling buhay na!', 1300);
      if (e.cause === 'pilapil') hint('pilapil', 'Tumalon diretso sa dahon ng gabi, hindi sa pilapil.');
      break;
    case 'home': buzz(25); if (!reduced()) stopT = 0.07; break;
    case 'lusot': buzz(12); if (!reduced()) slowT = Math.max(slowT, 0.14); hint('lusot', 'LUSOT! Muntik na! +25 sa bawat dikit na sasakyan na nalusutan mo.'); break;
    case 'extraLife': if (!R) toast('EXTRA BUHAY!', 'Isa pang Kokak', 1400); break;
    case 'timeLow': if (!R) toast('BILIS, KOKAK!', '10 segundo na lang', 1200); break;
    case 'levelClear': levelCleared(); break;
    case 'gameover': gameOver(); break;
    default: break;
  }
}

function pause() { if (mode === 'play' || mode === 'intro') { if (view) view.skipIntro(); mode = 'pause'; show('pause'); } }
function resume() { if (mode === 'pause') { mode = 'play'; clearInput(); show(null); } }
function toMenu() { mode = 'title'; game = null; banner(false); updateTitle(); show('title'); }

// ---------- input ----------
const DIRS = { ArrowUp: UP, ArrowRight: RIGHT, ArrowDown: DOWN, ArrowLeft: LEFT, w: UP, d: RIGHT, s: DOWN, a: LEFT };
const held = new Set();
let pressed = [];
function clearInput() { held.clear(); pressed = []; }
const playing = () => mode === 'play' && game;
// a press during the flyover skips it; the next one hops
function press(d) { if (mode === 'intro') { if (view) view.skipIntro(); return; } if (playing()) pressed.push(d); }
document.addEventListener('keydown', (e) => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  // any key skips the flyover (a direction only skips it; the next press hops)
  if (mode === 'intro' && !['Shift', 'Control', 'Alt', 'Meta'].includes(k)) { e.preventDefault(); if (k === 'p' || k === 'Escape') pause(); else if (k === 'm') toggleSound(); else view.skipIntro(); return; }
  if (k in DIRS && (playing() || mode === 'intro')) { e.preventDefault(); if (!e.repeat) press(DIRS[k]); if (playing()) held.add(DIRS[k]); return; }
  const onButton = document.activeElement?.tagName === 'BUTTON';
  if ((k === ' ' || k === 'Enter') && !onButton) {
    if (mode === 'title') { e.preventDefault(); start(); return; }
    if (mode === 'clear') { e.preventDefault(); nextOne(); return; }
    if (mode === 'intro') { e.preventDefault(); view.skipIntro(); return; }
  }
  if (k === 'p' || k === 'Escape') { if (mode === 'play' || mode === 'intro') pause(); else if (mode === 'pause') resume(); else if (mode === 'settings') $('settings-ok').click(); }
  if (k === 'm') toggleSound();
});
document.addEventListener('keyup', (e) => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; if (k in DIRS) held.delete(DIRS[k]); });
window.addEventListener('blur', clearInput);

// swipe the street to hop that way; a tap hops forward
const stage = $('stage');
let sw = null;
const onScreen = (e) => e.target.closest('button, a, .screen');
stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' || !(playing() || mode === 'intro') || onScreen(e)) return; A.start(); sw = { x: e.clientX, y: e.clientY, used: false }; });
stage.addEventListener('pointermove', (e) => {
  if (!sw || sw.used) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
  if (Math.hypot(dx, dy) < 22) return;
  press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : (dy > 0 ? DOWN : UP));
  sw.used = true;
});
stage.addEventListener('pointerup', (e) => { if (sw && !sw.used && !onScreen(e)) press(UP); sw = null; });
stage.addEventListener('pointercancel', () => { sw = null; });
for (const b of document.querySelectorAll('[data-dir]')) {
  const d = Number(b.dataset.dir);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); A.start(); press(d); if (playing()) held.add(d); b.setPointerCapture(e.pointerId); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => held.delete(d));
}

// a controller: the d-pad or the left stick hops (hold to keep hopping), Options pauses; in the menus
// the d-pad moves between buttons, ✕ presses, ○ goes back
const pad = { dir: -1, btn: {}, rep: 0, screen: null };
function readPad(dt) {
  const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null;
  if (!p) return;
  const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed), ax = p.axes || [];
  const edge = (i) => { const on = b(i), was = pad.btn[i]; pad.btn[i] = on; return on && !was; };
  const dir = b(12) || ax[1] < -0.55 ? UP : b(13) || ax[1] > 0.55 ? DOWN : b(14) || ax[0] < -0.55 ? LEFT : b(15) || ax[0] > 0.55 ? RIGHT : -1;
  const fresh = dir >= 0 && dir !== pad.dir;
  pad.dir = dir;
  const screen = SCREENS.find((id) => !$(id).hidden) || null;
  if (screen !== pad.screen) { pad.screen = screen; for (const i of [0, 1, 9]) pad.btn[i] = b(i); return; }
  if (!screen) {
    held.delete(UP); held.delete(DOWN); held.delete(LEFT); held.delete(RIGHT);
    if (fresh) press(dir);
    if (dir >= 0 && playing()) held.add(dir);
    if (edge(9)) pause();
    if (mode === 'intro' && p.buttons.some((x, i) => x.pressed && !pad.btn['any' + i])) view.skipIntro();
    p.buttons.forEach((x, i) => { pad.btn['any' + i] = x.pressed; });
    return;
  }
  pad.rep -= dt;
  if (dir >= 0 && (fresh || pad.rep <= 0)) {
    pad.rep = 0.24;
    const items = [...$(screen).querySelectorAll('button, input[type=range]')].filter((el) => el.offsetParent !== null);
    const at = items.indexOf(document.activeElement);
    if (document.activeElement && document.activeElement.type === 'range' && (dir === LEFT || dir === RIGHT)) { const r = document.activeElement; r.value = String(+r.value + (dir === RIGHT ? 1 : -1) * +r.step); r.dispatchEvent(new Event('input')); }
    else if (items.length) { items[(at + (dir === UP || dir === LEFT ? -1 : 1) + items.length) % items.length].focus(); A.ui(0); }
  }
  if (edge(0) && document.activeElement && $(screen).contains(document.activeElement)) document.activeElement.click();
  if (edge(1)) { if (screen === 'settings') $('settings-ok').click(); else if (screen === 'pause') resume(); }
  if (edge(9)) { if (screen === 'pause') resume(); else if (screen === 'title') start(); }
}
window.addEventListener('gamepadconnected', () => { if (mode === 'title') toast('🎮', 'D-pad o stick: talon · ✕: pili · Options: hinto', 2600); });

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
  document.body.classList.toggle('calm', !!data.calm);
  document.body.classList.toggle('nopad', data.opt.pad === 'swipe');
  updateTitle();
}
for (const b of document.querySelectorAll('.sound')) b.onclick = toggleSound;
for (const b of document.querySelectorAll('.calm')) b.onclick = () => { data.calm = !data.calm; persist(); labels(); };
for (const b of document.querySelectorAll('[data-diff]')) b.onclick = () => { data.difficulty = b.dataset.diff; A.ui(0); persist(); labels(); };
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

// ---------- settings ----------
let settingsFrom = 'title';
function openSettings(from) {
  settingsFrom = from; mode = 'settings';
  const o = data.opt, f = document.activeElement, again = f && f.dataset && f.dataset.k ? `[data-k="${f.dataset.k}"]${f.dataset.v !== undefined ? `[data-v="${f.dataset.v}"]` : ''}` : null;
  const cur = (key) => (key === 'gfx' ? data.gfx : key === 'calm' ? data.calm : o[key]);
  const seg = (key, list) => `<div class="modes">${list.map(([v, label]) => `<button type="button" data-k="${key}" data-v="${v}" aria-pressed="${String(cur(key)) === String(v)}">${label}</button>`).join('')}</div>`;
  const slider = (key, label) => `<label class="slide">${label} <input type="range" min="0" max="1" step="0.05" value="${o[key]}" data-k="${key}"></label>`;
  $('settings-body').innerHTML = `
    <div class="grp"><h3>Laro · Game</h3>
    <p class="muted">Camera</p>${seg('cam', [['cine', 'Sinematiko · Follow'], ['board', 'Buong mapa · Board']])}
    <p class="muted">Sa touch · Touch controls</p>${seg('pad', [['pad', 'D-pad + swipe'], ['swipe', 'Swipe lang']])}
    </div><div class="grp"><h3>Tunog · Sound</h3>
    ${slider('music', 'Musika · Music')}${slider('sfx', 'Tunog · Effects')}
    </div><div class="grp"><h3>Itsura · Look</h3>
    <p class="muted">Graphics${view ? ` (ngayon: ${['Mababa', 'Katamtaman', 'Mataas'][view.post.level]})` : ''}</p>${seg('gfx', [['auto', 'Auto'], [2, 'Mataas'], [1, 'Katamtaman'], [0, 'Mababa']])}
    <p class="muted">Yanig ng camera · Camera shake</p>${seg('calm', [[false, 'Buo · Full'], [true, 'Kalmado · Calm']])}</div>`;
  for (const b of $('settings-body').querySelectorAll('button')) b.onclick = () => {
    const k = b.dataset.k, raw = b.dataset.v, v = raw === 'true' ? true : raw === 'false' ? false : isNaN(+raw) ? raw : +raw;
    if (k === 'gfx') { data.gfx = v; if (view) { view.post.setAuto(v === 'auto'); view.post.setLevel(v === 'auto' ? (touch ? 1 : 2) : v); } }
    else if (k === 'calm') data.calm = v;
    else o[k] = v;
    A.ui(0); persist(); labels(); openSettings(settingsFrom);
  };
  for (const r of $('settings-body').querySelectorAll('input[type=range]')) r.oninput = () => { o[r.dataset.k] = +r.value; A.start(); A.setMix(o); persist(); };
  show('settings');
  if (again && $('settings-body').querySelector(again)) $('settings-body').querySelector(again).focus({ preventScroll: true });
}
$('settings-ok').onclick = () => { A.ui(2); if (settingsFrom === 'pause') { mode = 'pause'; show('pause'); } else { mode = 'title'; show('title'); } };
for (const b of document.querySelectorAll('.settings-btn')) b.onclick = () => openSettings(mode === 'pause' ? 'pause' : 'title');
labels();

// ---------- the HUD ----------
const hudEl = { score: $('score'), best: $('best'), name: $('place-name'), sub: $('place-sub'), lives: $('lives'), num: $('time-num'), fill: $('time-fill') };
let hudKey = '';
function hud(g) {
  const lives = Math.min(g.lives - (g.phase === 'dying' ? 0 : 1), 9), frac = Math.max(0, Math.min(1, g.timeLeft / (g.diff.timer * 60)));
  const key = [g.score, data.best, g.level, lives, Math.ceil(g.timeLeft / 60)].join();
  hudEl.fill.style.transform = `scaleX(${frac.toFixed(4)})`;
  if (key === hudKey) return; hudKey = key;
  hudEl.score.textContent = String(g.score).padStart(5, '0');
  hudEl.best.textContent = String(Math.max(data.best, g.score)).padStart(5, '0');
  hudEl.name.textContent = `${g.def.name} · ${g.def.road}`;
  hudEl.sub.textContent = `LEVEL ${g.level}${g.loop ? ` · IKOT ${g.loop + 1}` : ''} · ${g.def.water.toUpperCase()}`;
  hudEl.lives.innerHTML = '<i></i>'.repeat(Math.max(0, Math.min(lives, 5))) + (lives > 5 ? `<span>×${lives}</span>` : '') + (lives <= 0 ? '<span>HULING BUHAY</span>' : '');
  hudEl.num.textContent = String(Math.ceil(g.timeLeft / 60));
  hudEl.fill.classList.toggle('warn', frac < 0.5 && frac >= 0.25); hudEl.fill.classList.toggle('low', frac < 0.25);
}

// ---------- loop ----------
let last = performance.now(), t = 0, hudY = -1;
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now; t += dt;
  readPad(dt);
  if (game && mode === 'intro' && view && view.introLeft <= 0) { mode = 'play'; if (toastT <= 0) nextTip(); }
  document.body.classList.toggle('cine', mode === 'intro' || (mode === 'play' && !!game && game.phase === 'clear'));
  document.body.classList.toggle('introing', mode === 'intro');
  if (game && mode === 'play') {
    const input = AUTOPLAY ? bot(game, { react: 6, jitter: 3, rand: () => rand(demoDice) }) : { pressed, held: [...held] };
    pressed = [];
    slowT = Math.max(0, slowT - dt);
    let gdt = slowT > 0 ? dt * 0.3 : dt;
    if (stopT > 0) { stopT -= dt; gdt = 0; }
    for (const e of step(game, input, gdt)) onEvent(e);
    if (game.phase !== lastPhase) { if (game.phase === 'play' && lastPhase === 'ready') setTimeout(() => { if (mode === 'play') banner(false); }, 500); lastPhase = game.phase; }
  } else if (!game) {
    if (demo.phase === 'over' || demo.phase === 'clear') demo = newDemo();
    for (const e of step(demo, bot(demo, { react: 10, jitter: 3, rand: () => rand(demoDice) }), dt)) { if (R) R.event(e, demo); if (view) view.event(e, demo, { quiet: true }); }
  }
  if (toastT > 0 && (toastT -= dt) <= 0) { $('toast').hidden = true; nextTip(); }
  const g = game || demo;
  if (game && (mode === 'play' || mode === 'intro' || mode === 'pause')) hud(game);
  // on a phone held upright, the lives and the timer sit just under the board, in the strip above the d-pad
  const under = !!view && touch && innerHeight > innerWidth;
  document.body.classList.toggle('hud-under', under);
  if (under) { const y = Math.round(view.boardBottom() + 6); if (y !== hudY) { hudY = y; $('hud-bot').style.top = `${y}px`; } }
  if (view) {
    const vm = !game ? 'title' : mode === 'over' ? 'over' : game.phase === 'clear' ? 'clear' : 'play';
    view.frame(g, dt, { mode: vm, reduced: reduced(), camMode: data.opt.cam, snap: SNAP });
  } else R.draw(g, t, { reduced: reduced(), best: data.best });
  A.update(g, !!game && mode === 'play', dt);
  requestAnimationFrame(frame);
}

async function boot() {
  // the canvas lettering (route boards, billboards, neon) needs the webfonts
  try { await Promise.race([Promise.all([document.fonts.load('900 italic 40px "Barlow Condensed"'), document.fonts.load('800 20px "Baloo 2"')]), new Promise((r) => setTimeout(r, 1500))]); } catch { /* system fonts, then */ }
  try {
    if (Q.get('flat') === '1') throw new Error('flat');
    const { createView } = await import('./view3d.mjs');
    view = createView($('view'), { gfx: Q.get('gfx') ?? (data.gfx === 'auto' ? null : String(data.gfx)), low: touch, layer: $('floaters'), touch });
    window.addEventListener('resize', () => view.resize());
    new ResizeObserver(() => view.resize()).observe($('view'));
    // the scanned street and the photographed skies load in the background, with a bar
    const bar = $('loading'), pct = $('load-pct');
    const loaded = (f) => { bar.hidden = false; pct.textContent = `${Math.round(f * 100)}%`; bar.style.setProperty('--p', `${Math.round(f * 100)}%`); };
    const done = () => { bar.classList.add('done'); setTimeout(() => { bar.hidden = true; }, 700); };
    import('./envpack.mjs').then(({ loadEnv }) => loadEnv(Q.get('env') || 'assets/env/')).then((e) => { loaded(0); return view.setEnv(e, loaded); }).then(done, done);
  } catch {
    // no WebGL: the flat board, as the game first was
    view = null;
    document.body.classList.add('flat'); $('flatwrap').hidden = false;
    R = createRenderer($('board'));
    window.addEventListener('resize', R.resize);
    new ResizeObserver(() => R.resize()).observe($('board'));
    R.resize();
  }
  show('title');
  requestAnimationFrame(frame);
  if (TEST) {
    window.__te = { get game() { return game; }, get mode() { return mode; }, get demo() { return demo; }, start, get view() { return view; }, get flat() { return !!R; }, press };
    if (Q.get('difficulty')) data.difficulty = Q.get('difficulty');
    if (Q.get('cam')) data.opt.cam = Q.get('cam');
    if (Q.get('go') === '1') { data.safety = true; start(Number(Q.get('level')) || 1); }
  }
}
boot();
if ('serviceWorker' in navigator && !TEST) navigator.serviceWorker.register('sw.js').catch(() => { /* online-only then */ });
