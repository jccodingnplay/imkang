/**
 * audio.js — NCS 스타일 Web Audio API 음악 생성기
 * 저작권 없는 전자음악을 프로그래밍으로 합성합니다.
 */

class NCSAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isPlaying = false;
    this.scheduledNodes = [];
    this.startTime = 0;
    this.bpm = 128;
    this.beatInterval = 60 / this.bpm;
    this.currentSong = null;
    this.onEnded = null;
    this.lookahead = 0.1;
    this.scheduleAheadTime = 0.2;
    this.nextBeatTime = 0;
    this.currentBeat = 0;
    this.totalBeats = 0;
    this.timerID = null;
    this.songDuration = 0;
    this.endTimer = null;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ─── 기본 합성 도구 ───
  createOscillator(freq, type, startTime, duration, gainVal = 0.5, detune = 0) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(gainVal, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
    return { osc, gain };
  }

  createKick(time, gain = 1.0) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.4);
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(time); osc.stop(time + 0.45);
  }

  createSnare(time, gain = 0.6) {
    const ctx = this.ctx;
    // Noise
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(gain * 0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass'; filter.frequency.value = 1000;
    noise.connect(filter); filter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start(time); noise.stop(time + 0.2);
    // Tone
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.frequency.value = 180;
    og.gain.setValueAtTime(gain * 0.7, time);
    og.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(og); og.connect(this.masterGain);
    osc.start(time); osc.stop(time + 0.15);
  }

  createHihat(time, gain = 0.3, open = false) {
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const ng = ctx.createGain();
    const dur = open ? 0.2 : 0.04;
    ng.gain.setValueAtTime(gain, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    noise.connect(f); f.connect(ng); ng.connect(this.masterGain);
    noise.start(time); noise.stop(time + dur + 0.01);
  }

  createBass(freq, time, duration, gain = 0.5) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    osc2.type = 'square'; osc2.frequency.value = freq * 0.5;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + duration * 0.5);
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.01);
    g.gain.setValueAtTime(gain, time + duration - 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(filter); osc2.connect(filter);
    filter.connect(g); g.connect(this.masterGain);
    osc.start(time); osc2.start(time);
    osc.stop(time + duration + 0.01);
    osc2.stop(time + duration + 0.01);
  }

  createSynth(freq, time, duration, gain = 0.3, type = 'sawtooth') {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3000, time);
    f.frequency.exponentialRampToValueAtTime(600, time + duration * 0.7);
    osc.type = type; osc.frequency.value = freq; osc.detune.value = 5;
    osc2.type = type; osc2.frequency.value = freq; osc2.detune.value = -5;
    g.gain.setValueAtTime(0.001, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.02);
    g.gain.setValueAtTime(gain * 0.7, time + duration * 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, time + duration);
    osc.connect(f); osc2.connect(f);
    f.connect(g); g.connect(this.masterGain);
    osc.start(time); osc2.start(time);
    osc.stop(time + duration + 0.01);
    osc2.stop(time + duration + 0.01);
  }

  createChord(freqs, time, duration, gain = 0.2) {
    freqs.forEach(f => this.createSynth(f, time, duration, gain / freqs.length, 'sawtooth'));
  }

  createRiser(time, duration) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(2000, time + duration);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.3, time + duration);
    g.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.05);
    osc.connect(g); g.connect(this.masterGain);
    osc.start(time); osc.stop(time + duration + 0.1);
  }

  // ─── 노래들 ───

  // Song 1: "Neon Rush" — Uplifting EDM, 128 BPM
  scheduleSongNeonRush(startTime, bars = 32) {
    const b = this.beatInterval; // 1 beat = 60/128
    const bar = b * 4;          // 1 bar = 4 beats

    // 음계 (A minor)
    const Am = [220, 261.63, 329.63];
    const C  = [261.63, 329.63, 392];
    const G  = [196, 246.94, 329.63];
    const F  = [174.61, 220, 261.63];
    const progression = [Am, C, G, F];

    for (let bar_i = 0; bar_i < bars; bar_i++) {
      const t = startTime + bar_i * bar;
      const phase = bar_i % 16;

      // INTRO: bars 0-3 (드럼 없음)
      if (phase < 4) {
        // 코드 패드
        const chord = progression[bar_i % 4];
        this.createChord(chord.map(f => f * 2), t, bar * 0.9, 0.15);
        // 가벼운 하이햇
        for (let i = 0; i < 8; i++) this.createHihat(t + i * (b / 2), 0.15);
      }

      // BUILD-UP: bars 4-7
      else if (phase < 8) {
        const chord = progression[bar_i % 4];
        this.createChord(chord.map(f => f * 2), t, bar * 0.9, 0.18);
        // 드럼 킥+스네어
        this.createKick(t);
        this.createKick(t + b * 2);
        this.createSnare(t + b);
        this.createSnare(t + b * 3);
        for (let i = 0; i < 8; i++) this.createHihat(t + i * (b / 2), 0.2);
        // 라이저 (마지막 바)
        if (phase === 7) this.createRiser(t, bar);
      }

      // DROP: bars 8-15
      else if (phase < 16) {
        const chord = progression[bar_i % 4];
        // 강한 베이스라인
        const bassNote = [55, 65.41, 49, 43.65][bar_i % 4];
        for (let beat = 0; beat < 4; beat++) {
          this.createBass(bassNote, t + beat * b, b * 0.8, 0.55);
        }
        // 리드 신스
        this.createSynth(chord[2] * 2, t, b * 0.8, 0.22);
        this.createSynth(chord[0] * 2, t + b * 2, b * 0.8, 0.22);
        // 코드
        this.createChord(chord.map(f => f * 2), t + b, b * 0.7, 0.12);
        this.createChord(chord.map(f => f * 2), t + b * 3, b * 0.7, 0.12);
        // 풀 드럼
        this.createKick(t);
        this.createKick(t + b * 0.5);
        this.createKick(t + b * 2);
        this.createKick(t + b * 2.5);
        this.createSnare(t + b);
        this.createSnare(t + b * 3);
        for (let i = 0; i < 16; i++) this.createHihat(t + i * (b / 4), 0.25, i % 4 === 0);
      }
    }
  }

  // Song 2: "Cyber Dream" — Melodic Future Bass, 140 BPM
  scheduleSongCyberDream(startTime, bars = 32) {
    const b = 60 / 140;
    const bar = b * 4;

    // D# minor
    const Dsm = [155.56, 185, 233.08];
    const Fm  = [185, 220, 277.18];
    const Ab  = [207.65, 246.94, 311.13];
    const Bb  = [233.08, 277.18, 349.23];
    const prog = [Dsm, Fm, Ab, Bb];

    for (let bar_i = 0; bar_i < bars; bar_i++) {
      const t = startTime + bar_i * bar;
      const phase = bar_i % 16;

      if (phase < 4) {
        // 멜로디 아르페지오
        const ch = prog[bar_i % 4];
        const arp = [...ch, ch[2] * 2, ch[1] * 2, ch[0] * 2];
        arp.forEach((freq, i) => {
          this.createSynth(freq, t + i * (b / 1.5), b * 0.4, 0.15, 'triangle');
        });
        for (let i = 0; i < 4; i++) this.createHihat(t + i * b, 0.1, false);
      }

      else if (phase < 8) {
        const ch = prog[bar_i % 4];
        const arp = [...ch, ch[2] * 2];
        arp.forEach((freq, i) => {
          this.createSynth(freq, t + i * (b / 1.5), b * 0.5, 0.18, 'triangle');
        });
        this.createKick(t); this.createKick(t + b * 2);
        this.createSnare(t + b); this.createSnare(t + b * 3);
        for (let i = 0; i < 8; i++) this.createHihat(t + i * (b / 2), 0.2);
        if (phase === 7) this.createRiser(t + b * 2, b * 2);
      }

      else {
        const ch = prog[bar_i % 4];
        const bassNote = [77.78, 92.5, 103.83, 116.54][bar_i % 4];
        // 스타카토 베이스
        [0, 0.5, 1.5, 2, 2.5, 3, 3.5].forEach(beat => {
          this.createBass(bassNote, t + beat * b, b * 0.35, 0.5);
        });
        // 슈퍼소 신스 코드
        this.createChord(ch.map(f => f * 4), t, b * 2, 0.14);
        this.createChord(ch.map(f => f * 4), t + b * 2, b * 2, 0.14);
        // 드럼
        this.createKick(t); this.createKick(t + b * 0.75);
        this.createKick(t + b * 2); this.createKick(t + b * 2.75);
        this.createSnare(t + b); this.createSnare(t + b * 3);
        for (let i = 0; i < 16; i++) {
          this.createHihat(t + i * (b / 4), i % 2 === 0 ? 0.3 : 0.15, i % 8 === 0);
        }
      }
    }
  }

  // Song 3: "Phoenix Wave" — Energetic Dubstep, 150 BPM
  scheduleSongPhoenixWave(startTime, bars = 32) {
    const b = 60 / 150;
    const bar = b * 4;

    // E minor
    const Em  = [164.81, 196, 246.94];
    const Bm  = [123.47, 146.83, 185];
    const G   = [196, 246.94, 293.66];
    const D   = [146.83, 185, 220];
    const prog = [Em, Bm, G, D];

    for (let bar_i = 0; bar_i < bars; bar_i++) {
      const t = startTime + bar_i * bar;
      const phase = bar_i % 16;

      if (phase < 4) {
        const ch = prog[bar_i % 4];
        this.createChord(ch.map(f => f * 2), t, bar * 0.95, 0.14);
        for (let i = 0; i < 8; i++) {
          this.createHihat(t + i * (b / 2), 0.15, i % 2 === 0);
        }
      }

      else if (phase < 8) {
        const ch = prog[bar_i % 4];
        this.createChord(ch.map(f => f * 2), t, bar * 0.95, 0.16);
        this.createKick(t); this.createKick(t + b);
        this.createKick(t + b * 2); this.createKick(t + b * 3);
        this.createSnare(t + b * 0.5); this.createSnare(t + b * 2.5);
        for (let i = 0; i < 16; i++) this.createHihat(t + i * (b / 4), 0.22);
        if (phase === 7) this.createRiser(t, bar);
      }

      else {
        const ch = prog[bar_i % 4];
        const bassNote = [41.2, 30.87, 49, 36.71][bar_i % 4];
        // 워블 베이스 (빠른 베이스)
        for (let i = 0; i < 8; i++) {
          this.createBass(bassNote * 2, t + i * (b / 2), b * 0.4, 0.55);
        }
        // 리드
        this.createSynth(ch[2] * 4, t, b * 0.5, 0.25, 'sawtooth');
        this.createSynth(ch[1] * 4, t + b, b * 0.5, 0.2, 'sawtooth');
        this.createSynth(ch[0] * 4, t + b * 2, b, 0.25, 'sawtooth');
        this.createSynth(ch[2] * 4, t + b * 3, b, 0.2, 'sawtooth');
        // 드럼 패턴 (더블 킥)
        [0, 0.25, 1, 1.5, 2, 2.25, 3, 3.5].forEach(beat => {
          this.createKick(t + beat * b, 0.9);
        });
        [0.5, 2.5].forEach(beat => this.createSnare(t + beat * b, 0.7));
        for (let i = 0; i < 16; i++) this.createHihat(t + i * (b / 4), 0.28);
      }
    }
  }

  play(songId, bpm, bars, onEnded) {
    this.init(); this.resume();
    this.stop();
    this.bpm = bpm;
    this.beatInterval = 60 / bpm;
    this.isPlaying = true;
    this.onEnded = onEnded;

    const barDuration = this.beatInterval * 4;
    this.songDuration = bars * barDuration;
    this.startTime = this.ctx.currentTime + 0.1;

    if (songId === 0) this.scheduleSongNeonRush(this.startTime, bars);
    else if (songId === 1) this.scheduleSongCyberDream(this.startTime, bars);
    else if (songId === 2) this.scheduleSongPhoenixWave(this.startTime, bars);

    this.endTimer = setTimeout(() => {
      this.isPlaying = false;
      if (this.onEnded) this.onEnded();
    }, (this.songDuration + 0.5) * 1000);
  }

  stop() {
    this.isPlaying = false;
    if (this.endTimer) { clearTimeout(this.endTimer); this.endTimer = null; }
  }

  getElapsedTime() {
    if (!this.ctx || !this.isPlaying) return 0;
    return Math.max(0, this.ctx.currentTime - this.startTime);
  }

  getProgress() {
    if (!this.songDuration) return 0;
    return Math.min(1, this.getElapsedTime() / this.songDuration);
  }
}

window.audioEngine = new NCSAudioEngine();
