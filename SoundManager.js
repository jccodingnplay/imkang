export default class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this._init();
    }

    _init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            this.enabled = false;
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    }

    _play(fn) {
        if (!this.enabled || !this.ctx) return;
        try { fn(); } catch(e) {}
    }

    playShoot() {
        this._play(() => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, this.ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + 0.1);
        });
    }

    playExplosion() {
        this._play(() => {
            const bufferSize = this.ctx.sampleRate * 0.3;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 400;
            source.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
            source.start(this.ctx.currentTime);
            source.stop(this.ctx.currentTime + 0.3);
        });
    }

    playHit() {
        this._play(() => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
            osc.start(this.ctx.currentTime);
            osc.stop(this.ctx.currentTime + 0.15);
        });
    }

    playPowerUp() {
        this._play(() => {
            const notes = [523, 659, 784, 1047];
            notes.forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'sine';
                const t = this.ctx.currentTime + i * 0.1;
                osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
                osc.start(t);
                osc.stop(t + 0.15);
            });
        });
    }

    playLevelUp() {
        this._play(() => {
            const notes = [523, 659, 784, 1047, 1319];
            notes.forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.type = 'triangle';
                const t = this.ctx.currentTime + i * 0.12;
                osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(0.3, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
                osc.start(t);
                osc.stop(t + 0.25);
            });
        });
    }
}
