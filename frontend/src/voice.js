export class VoiceService {
  constructor() {
    this.enabled = localStorage.getItem('voiceEnabled') !== 'false';
    this.speaking = false;
    this.queue = [];
  }

  setEnabled(val) {
    this.enabled = val;
    localStorage.setItem('voiceEnabled', val);
  }

  isEnabled() {
    return this.enabled;
  }

  speak(text) {
    if (!this.enabled || !window.speechSynthesis) return;
    this.queue.push(text);
    this._processQueue();
  }

  _processQueue() {
    if (this.speaking || this.queue.length === 0) return;
    this.speaking = true;
    const text = this.queue.shift();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.onend = () => {
      this.speaking = false;
      this._processQueue();
    };
    window.speechSynthesis.speak(utterance);
  }
}
