export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc1: null,
    engineOsc2: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    sirenHigh: false,

    unlock() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc1 = this.ctx.createOscillator();
        this.engineOsc1.type = 'sawtooth';
        this.engineOsc1.frequency.value = 55;
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc2.type = 'square';
        this.engineOsc2.frequency.value = 110;
        const eg2 = this.ctx.createGain();
        eg2.gain.value = 0.4;
        this.engineOsc1.connect(this.engineGain);
        this.engineOsc2.connect(eg2);
        eg2.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc1.start();
        this.engineOsc2.start();
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'triangle';
        this.sirenOsc.frequency.value = 700;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
      } catch (_) {
        this.ctx = null;
      }
    },

    setEngine(on, speed01) {
      if (!this.ctx || !this.engineGain) return;
      const t = this.ctx.currentTime;
      this.engineGain.gain.setTargetAtTime(on ? 0.03 + speed01 * 0.05 : 0, t, 0.1);
      this.engineOsc1.frequency.setTargetAtTime(50 + speed01 * 90, t, 0.1);
      this.engineOsc2.frequency.setTargetAtTime(100 + speed01 * 180, t, 0.1);
    },

    siren(on) {
      if (!this.ctx || !this.sirenGain) return;
      const t = this.ctx.currentTime;
      this.sirenGain.gain.setTargetAtTime(on ? 0.04 : 0, t, 0.2);
      if (on && !this.sirenTimer) {
        this.sirenTimer = window.setInterval(() => {
          if (!this.sirenOsc || !this.ctx) return;
          this.sirenHigh = !this.sirenHigh;
          this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 920 : 660, this.ctx.currentTime, 0.05);
        }, 450);
      } else if (!on && this.sirenTimer) {
        window.clearInterval(this.sirenTimer);
        this.sirenTimer = 0;
      }
    },

    tone(freq, dur, type, vol, when) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + (when || 0);
      const o = this.ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.05);
    },

    noiseBurst(dur, vol, freq) {
      if (!this.ctx) return;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(f);
      f.connect(g);
      g.connect(this.master);
      src.start();
    },

    shot() {
      this.noiseBurst(0.14, 0.5, 1800);
      this.tone(150, 0.08, 'square', 0.18, 0);
    },

    pickup() {
      this.tone(660, 0.09, 'sine', 0.2, 0);
      this.tone(990, 0.12, 'sine', 0.2, 0.09);
    },

    click() { this.tone(700, 0.05, 'square', 0.12, 0); },

    hit() { this.tone(120, 0.15, 'sawtooth', 0.25, 0); },

    busted() {
      this.tone(440, 0.3, 'sawtooth', 0.18, 0);
      this.tone(330, 0.4, 'sawtooth', 0.18, 0.25);
    },

    missionDone() {
      this.tone(523, 0.12, 'sine', 0.22, 0);
      this.tone(659, 0.12, 'sine', 0.22, 0.12);
      this.tone(784, 0.22, 'sine', 0.22, 0.24);
    },
  };
  return audio;
}
