// Synthesized sound for Tawid EDSA: a jaunty loop over the rain, a hop blip, Kokak's "ko-kak!", a
// jeepney horn now and then, splashes, and short jingles. Nothing plays until start() runs from a
// user gesture.
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
// I–V–vi–IV in C, one bar each; a melody of eighth notes (-1 rests), and a bass on the beat
const CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
const MELODY = [
  [76, -1, 74, 72, 74, -1, 76, -1], [74, -1, 71, 67, 71, 74, -1, -1],
  [72, -1, 76, 79, 76, 72, -1, 69], [72, 74, 76, -1, 74, 72, 69, -1],
];

export function createAudio() {
  let ctx = null, master = null, music = null, sfx = null, noise = null, rainGain = null, muted = false;
  let step = 0, nextAt = 0, playing = false, tempo = 118, hornT = 6;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = 0; music.connect(master);
    sfx = ctx.createGain(); sfx.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // the rain: looping noise, low-passed, loud or soft by place
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    src.connect(lp).connect(hp).connect(rainGain).connect(master); src.start();
    setInterval(schedule, 50);
  }

  function tone(freq, dur, type = 'square', gain = 0.05, when = 0, bend = 0, out = sfx) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(dur, freq, gain, when = 0, type = 'bandpass', to = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // a jeepney horn: two detuned squares, a little flat, "beep beep"
  function horn(when = 0, gain = 0.035, n = 2) { for (let k = 0; k < n; k++) { tone(415, 0.12, 'square', gain, when + k * 0.17); tone(440, 0.12, 'square', gain * 0.7, when + k * 0.17); } }
  function croak(when = 0, gain = 0.07) { tone(220, 0.09, 'sawtooth', gain, when, 0.7); tone(180, 0.14, 'sawtooth', gain, when + 0.12, 0.6); }

  function schedule() {
    if (!ctx || !playing || muted) return;
    const eighth = 30 / tempo;
    if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + 0.05;
    while (nextAt < ctx.currentTime + 0.2) {
      const when = nextAt - ctx.currentTime, bar = Math.floor(step / 8) % 4, s = step % 8;
      const n = MELODY[bar][s];
      if (n > 0) tone(NOTE(n), eighth * 0.9, 'square', 0.022, when, 0, music);
      if (s % 2 === 0) tone(NOTE(CHORDS[bar][0] - 24 + (s === 4 ? 7 : 0)), eighth * 1.6, 'triangle', 0.07, when, 0, music);
      if (s % 4 === 2) for (const c of CHORDS[bar]) tone(NOTE(c), eighth * 0.5, 'triangle', 0.012, when, 0, music); // the off-beat chop
      nextAt += eighth; step++;
    }
  }

  return {
    start,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; },
    update(g, on, dt) {
      if (!ctx) return;
      const live = on && g && (g.phase === 'play' || g.phase === 'ready');
      if (live !== playing) { playing = live; if (live) nextAt = ctx.currentTime + 0.05; }
      music.gain.setTargetAtTime(live ? 1 : 0, ctx.currentTime, 0.2);
      tempo = 112 + (g ? (g.def.n - 1) * 6 + g.loop * 8 : 0) + (g && g.timeLeft < 600 ? 14 : 0);
      rainGain.gain.setTargetAtTime(on && g && !muted ? 0.02 + 0.05 * g.def.rain : 0, ctx.currentTime, 0.5);
      // somewhere on EDSA, a jeepney honks
      if (live && (hornT -= dt) <= 0) { hornT = 4 + Math.random() * 7; horn(0, 0.012, 1 + Math.floor(Math.random() * 2)); }
    },
    event(e) {
      if (!ctx || muted) return;
      switch (e.type) {
        case 'hop': tone(e.dir === 2 ? 520 : 640, 0.07, 'square', 0.035, 0, 1.5); break;
        case 'land': if (e.water) hiss(0.08, 1800, 0.04); break;
        case 'go': horn(0, 0.04); break;
        case 'home': croak(); [0, 4, 7, 12].forEach((k, i) => tone(NOTE(72 + k), 0.12, 'triangle', 0.05, 0.3 + i * 0.07)); if (e.lamok) tone(900, 0.2, 'sine', 0.05, 0.1, 0.4); break;
        case 'levelClear': [60, 64, 67, 72, 67, 72, 76, 79].forEach((n, i) => { tone(NOTE(n), 0.16, 'square', 0.045, i * 0.12); tone(NOTE(n - 12), 0.16, 'triangle', 0.05, i * 0.12); }); croak(1.1); croak(1.4); break;
        case 'died':
          if (['tubig', 'anod'].includes(e.cause)) { hiss(0.5, 900, 0.18, 0, 'lowpass', 150); for (let k = 0; k < 4; k++) tone(300 + k * 90, 0.06, 'sine', 0.04, 0.2 + k * 0.08, 1.6); }
          else if (e.cause === 'oras') [67, 64, 60].forEach((n, i) => tone(NOTE(n), 0.2, 'triangle', 0.06, i * 0.16));
          else { horn(0, 0.05); tone(160, 0.3, 'sawtooth', 0.06, 0.28, 0.4); hiss(0.2, 400, 0.12, 0.28, 'lowpass'); }
          break;
        case 'lamok': tone(600, 0.3, 'sawtooth', 0.008, 0, 1.03); break;
        case 'buwayaPeek': tone(90, 0.3, 'sawtooth', 0.05, 0, 0.8); break;
        case 'buwayaBites': tone(120, 0.12, 'square', 0.05); tone(120, 0.12, 'square', 0.05, 0.15); break;
        case 'anak': croak(0, 0.03); break;
        case 'anakAboard': [0, 4, 7].forEach((k, i) => tone(NOTE(79 + k), 0.08, 'triangle', 0.05, i * 0.05)); break;
        case 'anakLost': tone(400, 0.3, 'triangle', 0.04, 0, 0.5); break;
        case 'timeLow': for (let k = 0; k < 3; k++) tone(880, 0.06, 'square', 0.04, k * 0.12); break;
        case 'extraLife': [0, 4, 7, 12, 16].forEach((k, i) => tone(NOTE(72 + k), 0.14, 'square', 0.04, i * 0.08)); break;
        case 'gameover': [67, 64, 60, 55].forEach((n, i) => tone(NOTE(n), 0.4, 'triangle', 0.07, i * 0.28)); break;
        default: break;
      }
    },
  };
}
