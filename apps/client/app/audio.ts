// @ts-nocheck
// Все звуки синтезируются WebAudio — без внешних файлов.
export class Sound {
  ctx = null; master = null; sfx = null; music = null; volume = .8; musicVolume = .45; sirenNode = null; humNode = null; musicTimer = null; step = 0; intensity = 0; sirenStop = null;
  constructor() { try { const s = JSON.parse(localStorage.getItem('hapai-audio') || '{}'); if (typeof s.volume === 'number') this.volume = s.volume; if (typeof s.music === 'number') this.musicVolume = s.music; } catch {} }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return; this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
    const comp = this.ctx.createDynamicsCompressor(); comp.connect(this.master);
    this.sfx = this.ctx.createGain(); this.sfx.connect(comp); this.music = this.ctx.createGain(); this.music.gain.value = this.musicVolume; this.music.connect(comp);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 1.5, this.ctx.sampleRate); const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  save() { try { localStorage.setItem('hapai-audio', JSON.stringify({ volume: this.volume, music: this.musicVolume })); } catch {} }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; this.save(); }
  setMusic(v) { this.musicVolume = v; if (this.music) this.music.gain.value = v; this.save(); }
  t() { return this.ctx.currentTime; }
  tone(freq, dur, { type = 'sine', vol = .3, to = null, at = 0, attack = .005, dest = null } = {}) {
    if (!this.ctx) return; const t = this.t() + at, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(dest || this.sfx); o.start(t); o.stop(t + dur + .05);
  }
  noise(dur, { vol = .3, type = 'bandpass', freq = 1200, q = 1, to = null, at = 0, dest = null } = {}) {
    if (!this.ctx) return; const t = this.t() + at, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur); f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); s.connect(f).connect(g).connect(dest || this.sfx); s.start(t, Math.random()); s.stop(t + dur + .05);
  }
  click() { this.tone(900, .05, { type: 'square', vol: .06 }); this.tone(1400, .04, { vol: .05, at: .02 }); }
  hover() { this.tone(1200, .03, { vol: .025 }); }
  coin() { this.tone(988, .08, { type: 'square', vol: .08 }); this.tone(1319, .25, { type: 'square', vol: .07, at: .07 }); }
  glass(v = 1) { if (v < .03) return; this.noise(.5, { vol: .5 * v, type: 'highpass', freq: 3000 }); for (let i = 0; i < 9; i++) this.tone(2500 + Math.random() * 3500, .25 + Math.random() * .3, { vol: .05 * v, at: Math.random() * .25 }); this.tone(180, .2, { type: 'triangle', vol: .2 * v, to: 60 }); }
  cash(v = 1) { if (v < .03) return; this.noise(.08, { vol: .25 * v, freq: 4000 }); [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, .5, { type: 'triangle', vol: .12 * v, at: .06 + i * .07 })); this.tone(2637, .8, { vol: .08 * v, at: .35 }); }
  thump(v = 1) { if (v < .03) return; this.tone(140, .25, { vol: .5 * v, to: 45 }); this.noise(.12, { vol: .3 * v, freq: 500, type: 'lowpass' }); }
  whoosh(v = 1) { if (v < .03) return; this.noise(.25, { vol: .25 * v, freq: 600, to: 2500, q: 2 }); }
  dash(v = 1) { if (v < .03) return; this.noise(.35, { vol: .35 * v, freq: 300, to: 3000, q: 1.5 }); this.tone(300, .2, { type: 'sawtooth', vol: .05 * v, to: 900 }); }
  caught(v = 1) { if (v < .03) return; this.tone(880, .5, { type: 'square', vol: .12 * v, to: 110 }); this.tone(440, .15, { type: 'sawtooth', vol: .12 * v, at: .1 }); this.tone(440, .15, { type: 'sawtooth', vol: .12 * v, at: .3 }); this.noise(.4, { vol: .2 * v, freq: 2000, q: 6 }); }
  creak(v = 1) { if (v < .03) return; this.tone(110, .45, { type: 'sawtooth', vol: .06 * v, to: 170 }); this.noise(.3, { vol: .12 * v, freq: 700, q: 8 }); this.tone(70, .15, { vol: .25 * v, at: .45 }); }
  spotted() { this.tone(1760, .09, { type: 'square', vol: .12 }); this.tone(1760, .09, { type: 'square', vol: .12, at: .14 }); }
  exitChange() { this.tone(523, .15, { type: 'triangle', vol: .15 }); this.tone(784, .3, { type: 'triangle', vol: .15, at: .12 }); }
  beep(hi = false) { this.tone(hi ? 1320 : 660, hi ? .5 : .18, { type: 'square', vol: .12 }); }
  start() { this.tone(392, .2, { type: 'sawtooth', vol: .12 }); this.tone(523, .2, { type: 'sawtooth', vol: .12, at: .12 }); this.tone(784, .6, { type: 'sawtooth', vol: .14, at: .24 }); }
  end() { [784, 659, 523, 392].forEach((f, i) => this.tone(f, .4, { type: 'triangle', vol: .14, at: i * .16 })); }
  finale() { this.intensity = 1; for (let i = 0; i < 3; i++) this.tone(600, .3, { type: 'square', vol: .1, to: 1200, at: i * .35 }); }
  stealTick(p) { this.tone(2200 + p * 1800, .03, { type: 'square', vol: .035 }); this.noise(.03, { vol: .05, freq: 5000 }); }
  alarmStart() { this.tone(1200, .12, { type: 'square', vol: .06 }); }
  siren(level) {
    if (!this.ctx) return;
    if (!this.sirenNode && level > 0) {
      const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
      o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = 760; o2.frequency.value = 763; lfo.frequency.value = 1.6; lg.gain.value = 260; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      f.type = 'lowpass'; f.frequency.value = 2400; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g).connect(this.sfx); o.start(); o2.start(); lfo.start(); this.sirenNode = { o, o2, lfo, g };
    }
    if (!this.sirenNode) return;
    this.sirenNode.g.gain.setTargetAtTime(level * .09, this.t(), .15);
    if (level <= .001 && !this.sirenStop) this.sirenStop = setTimeout(() => { try { this.sirenNode.o.stop(); this.sirenNode.o2.stop(); this.sirenNode.lfo.stop(); } catch {} this.sirenNode = null; this.sirenStop = null; }, 900);
    else if (level > .001 && this.sirenStop) { clearTimeout(this.sirenStop); this.sirenStop = null; }
  }
  hum(level) {
    if (!this.ctx) return;
    if (!this.humNode) { const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = 118; o2.type = 'sawtooth'; o2.frequency.value = 236.5; f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 1.2; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g).connect(this.sfx); o.start(); o2.start(); this.humNode = { g }; }
    this.humNode.g.gain.setTargetAtTime(level * .05, this.t(), .2);
  }
  startMusic() {
    if (!this.ctx || this.musicTimer) return; this.step = 0; let next = this.t() + .1;
    const bass = [55, 0, 55, 65.4, 0, 55, 73.4, 0, 55, 0, 55, 65.4, 0, 82.4, 73.4, 65.4];
    const tick = () => {
      while (next < this.t() + .3) {
        const s = this.step % 16, bpm = this.intensity ? 138 : 108, dur = 60 / bpm / 4, at = next - this.t();
        if (bass[s]) this.tone(bass[s], dur * 1.8, { type: 'triangle', vol: .22, at, dest: this.music, attack: .01 });
        if (s % 2 === 0) this.noise(.04, { vol: s % 4 === 2 ? .06 : .03, type: 'highpass', freq: 7000, at, dest: this.music });
        if (s === 4 || s === 12) this.noise(.12, { vol: .07, freq: 1800, q: .8, at, dest: this.music });
        if (s === 0 && this.step % 64 === 0) [220, 261.6, 329.6].forEach(f => this.tone(f, 1.6, { vol: .03, at, dest: this.music, attack: .2 }));
        if (this.intensity && s % 4 === 0) this.tone(110, .1, { vol: .25, to: 50, at, dest: this.music });
        next += dur; this.step++;
      }
    };
    this.musicTimer = setInterval(tick, 80); tick();
  }
  stopMusic() { clearInterval(this.musicTimer); this.musicTimer = null; this.intensity = 0; }
  stopAll() { this.stopMusic(); this.siren(0); this.hum(0); }
}