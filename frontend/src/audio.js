export class AudioCue {
  constructor() {
    this.enabled = localStorage.getItem('audioCuesEnabled') !== 'false';
    this.ctx = null;
  }

  setEnabled(val) {
    this.enabled = val;
    localStorage.setItem('audioCuesEnabled', val);
  }

  isEnabled() {
    return this.enabled;
  }

  _getCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this.ctx;
  }

  playTone(freq, duration, type = 'sine') {
    if (!this.enabled) return;
    try {
      const ctx = this._getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
    }
  }

  playSweep(startFreq, endFreq, duration) {
    if (!this.enabled) return;
    try {
      const ctx = this._getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + duration);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
    }
  }
}
