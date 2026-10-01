// Sound for Tawid EDSA. Real recordings (CC0, from Kenney): the thud of a hit, a landing on wood, on a
// turtle's shell, on the grass or the concrete, steel-drum jingles for a full family, a bonus life and the
// end, and menu clicks. Around them, synthesized: a jaunty loop over the rain, Kokak's "ko-kak!", a
// jeepney horn now and then, splashes. Nothing plays until start() runs from a user gesture; the
// recordings load then, and without them the synthesized sounds play alone.
const SAMPLES = { hit: 3, metal: 3, wood: 3, soft: 3, grass: 3, step: 3, clear: 1, extra: 1, over: 1, ui: 3 };
const SURFACE = { troso: 'wood', balsa: 'wood', bangka: 'wood', banig: 'soft', ferry: 'metal', batya: 'metal', pagong: 'soft', lily: 'soft', salbabida: 'soft', styro: 'soft' };
const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
// I–V–vi–IV in C, one bar each; a melody of eighth notes (-1 rests), and a bass on the beat
const CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
const MELODY = [
  [76, -1, 74, 72, 74, -1, 76, -1], [74, -1, 71, 67, 71, 74, -1, -1],
  [72, -1, 76, 79, 76, 72, -1, 69], [72, 74, 76, -1, 74, 72, 69, -1],
];

export function createAudio({ base = 'assets/sfx/' } = {}) {
  let ctx = null, master = null, music = null, sfx = null, noise = null, rainGain = null, muted = false;
  const buf = {}, norm = {}, mix = { music: 1, sfx: 1 };
  // each recording scaled to the same peak, so the takes sit level with each other and with the synth
  const peakNorm = (b) => { let p = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) p = Math.max(p, Math.abs(d[i])); } return p > 0.001 ? 0.7 / p : 1; };
  let step = 0, nextAt = 0, playing = false, tempo = 118, hornT = 6;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    // everything goes through a limiter, so stacked sounds never clip
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8; limiter.knee.value = 4; limiter.ratio.value = 18; limiter.attack.value = 0.003; limiter.release.value = 0.18;
    limiter.connect(ctx.destination);
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(limiter);
    music = ctx.createGain(); music.gain.value = 0; music.connect(master);
    sfx = ctx.createGain(); sfx.gain.value = mix.sfx; sfx.connect(master);
    for (const [k, n] of Object.entries(SAMPLES)) for (let i = 0; i < n; i++) { const name = n > 1 ? k + i : k; fetch(`${base}${name}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject())).then((a) => ctx.decodeAudioData(a)).then((b) => { buf[name] = b; norm[name] = peakNorm(b); }).catch(() => { /* synth only */ }); }
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

  // one take of a recording, a little higher or lower each time; false if it isn't loaded
  function play(name, gain = 1, rate = 1, vary = 0.08, when = 0) {
    if (!ctx || muted) return false;
    const n = SAMPLES[name] || 0, takes = n > 1 ? Array.from({ length: n }, (_, i) => name + i).filter((k) => buf[k]) : buf[name] ? [name] : [];
    if (!takes.length) return false;
    const s = ctx.createBufferSource(), g = ctx.createGain();
    const key = takes[Math.floor(Math.random() * takes.length)];
    s.buffer = buf[key]; s.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * vary);
    g.gain.value = gain * (norm[key] || 1); s.connect(g).connect(sfx); s.start(ctx.currentTime + when);
    return true;
  }
  // water: a plop with a bubble, bigger for a fall in
  function splash(big = false, when = 0) { hiss(big ? 0.5 : 0.14, big ? 900 : 1600, big ? 0.2 : 0.07, when, 'lowpass', big ? 180 : 500); tone(big ? 260 : 520, big ? 0.18 : 0.08, 'sine', big ? 0.06 : 0.035, when + 0.02, big ? 2.2 : 1.8); }
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
    setMix(m) { mix.music = m.music ?? mix.music; mix.sfx = m.sfx ?? mix.sfx; if (sfx) sfx.gain.value = mix.sfx; },
    ui(k = 0) { if (!play('ui' + k, 0.5, 1, 0.02)) tone(880, 0.04, 'square', 0.02); },
    update(g, on, dt) {
      if (!ctx) return;
      const live = on && g && (g.phase === 'play' || g.phase === 'ready');
      if (live !== playing) { playing = live; if (live) nextAt = ctx.currentTime + 0.05; }
      music.gain.setTargetAtTime(live ? mix.music * 0.55 : 0, ctx.currentTime, 0.2); // the music sits under the effects
      tempo = 112 + (g ? (g.def.n - 1) * 6 + g.loop * 8 : 0) + (g && g.timeLeft < 600 ? 14 : 0);
      rainGain.gain.setTargetAtTime(g && !muted ? (on ? 0.02 + 0.05 * g.def.rain : 0.012 + 0.03 * g.def.rain) * mix.sfx : 0, ctx.currentTime, 0.5);
      // somewhere on EDSA, a jeepney honks
      if (live && (hornT -= dt) <= 0) { hornT = 4 + Math.random() * 7; horn(0, 0.012, 1 + Math.floor(Math.random() * 2)); }
    },
    event(e, g) {
      if (!ctx || muted) return;
      switch (e.type) {
        case 'hop': tone(e.dir === 2 ? 520 : 640, 0.07, 'square', 0.035, 0, 1.5); break;
        case 'land': {
          if (e.water) { const lane = g && g.lanes[e.row]; if (!play(SURFACE[lane && lane.type] || 'wood', 0.5, 1.1)) hiss(0.08, 1800, 0.04); splash(false); }
          else if (e.row === 0) play('soft', 0.5, 1.2);
          else if (!play(e.row >= 12 || e.row === 6 ? 'step' : 'step', 0.35, 1.3)) hiss(0.04, 900, 0.03, 0, 'lowpass');
          if (g && g.def && g.def.n === 2 && e.row >= 7 && e.row <= 11) splash(false);
          break;
        }
        case 'go': horn(0, 0.04); break;
        case 'home': play('soft', 0.6, 0.9); croak(); [0, 4, 7, 12].forEach((k, i) => tone(NOTE(72 + k), 0.12, 'triangle', 0.05, 0.3 + i * 0.07)); if (e.lamok) tone(900, 0.2, 'sine', 0.05, 0.1, 0.4); break;
        case 'levelClear': if (play('clear', 0.7, 1, 0)) { croak(1.2); croak(1.5); break; } [60, 64, 67, 72, 67, 72, 76, 79].forEach((n, i) => { tone(NOTE(n), 0.16, 'square', 0.045, i * 0.12); tone(NOTE(n - 12), 0.16, 'triangle', 0.05, i * 0.12); }); croak(1.1); croak(1.4); break;
        case 'died':
          if (['tubig', 'anod'].includes(e.cause)) { splash(true); hiss(0.5, 900, 0.18, 0, 'lowpass', 150); for (let k = 0; k < 4; k++) tone(300 + k * 90, 0.06, 'sine', 0.04, 0.2 + k * 0.08, 1.6); }
          else if (e.cause === 'oras') [67, 64, 60].forEach((n, i) => tone(NOTE(n), 0.2, 'triangle', 0.06, i * 0.16));
          else { horn(0, 0.05); if (!play('hit', 0.9, 0.9)) tone(160, 0.3, 'sawtooth', 0.06, 0.28, 0.4); play('metal', 0.4, 0.8, 0.1, 0.03); hiss(0.2, 400, 0.12, 0.05, 'lowpass'); }
          break;
        case 'lusot': { // a car whooshing past, a little pitch drop as it goes
          const t0 = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g2 = ctx.createGain();
          src.buffer = noise; f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(500, t0); f.frequency.exponentialRampToValueAtTime(2600, t0 + 0.16); f.frequency.exponentialRampToValueAtTime(700, t0 + 0.42);
          g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(0.22, t0 + 0.12); g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
          src.connect(f).connect(g2).connect(sfx); src.start(t0, Math.random()); src.stop(t0 + 0.5);
          tone(330, 0.3, 'sawtooth', 0.02, 0.05, 0.7);
          [0, 7].forEach((k, i) => tone(NOTE(84 + k), 0.07, 'square', 0.035, 0.18 + i * 0.06));
          break;
        }
        case 'whistle': [0, 0.16, 0.32].forEach((w, i) => { tone(2350, i === 2 ? 0.34 : 0.12, 'sine', 0.06, w, 1.02); tone(2480, i === 2 ? 0.34 : 0.12, 'sine', 0.03, w + 0.01); }); break;
        case 'lamok': tone(600, 0.3, 'sawtooth', 0.008, 0, 1.03); break;
        case 'buwayaPeek': tone(90, 0.3, 'sawtooth', 0.05, 0, 0.8); break;
        case 'buwayaBites': tone(120, 0.12, 'square', 0.05); tone(120, 0.12, 'square', 0.05, 0.15); break;
        case 'anak': croak(0, 0.03); break;
        case 'anakAboard': [0, 4, 7].forEach((k, i) => tone(NOTE(79 + k), 0.08, 'triangle', 0.05, i * 0.05)); break;
        case 'anakLost': tone(400, 0.3, 'triangle', 0.04, 0, 0.5); break;
        case 'timeLow': for (let k = 0; k < 3; k++) tone(880, 0.06, 'square', 0.04, k * 0.12); break;
        case 'extraLife': if (play('extra', 0.6, 1, 0)) break; [0, 4, 7, 12, 16].forEach((k, i) => tone(NOTE(72 + k), 0.14, 'square', 0.04, i * 0.08)); break;
        case 'gameover': if (play('over', 0.6, 1, 0)) break; [67, 64, 60, 55].forEach((n, i) => tone(NOTE(n), 0.4, 'triangle', 0.07, i * 0.28)); break;
        default: break;
      }
    },
  };
}
