import { describe, it, expect, beforeAll, beforeEach, afterEach, jest } from '@jest/globals';

let VoiceService, AudioCue, RideState, STATES;

function setupBrowserMocks() {
  window.speechSynthesis = {
    speak: jest.fn(),
    cancel: jest.fn(),
  };
  window.SpeechSynthesisUtterance = jest.fn().mockImplementation((text) => ({ text }));
  window.AudioContext = jest.fn().mockImplementation(() => ({
    createOscillator: jest.fn().mockReturnValue({
      type: '',
      frequency: { setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    }),
    createGain: jest.fn().mockReturnValue({
      gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
      connect: jest.fn(),
    }),
    destination: {},
    currentTime: 0,
  }));
  window.webkitAudioContext = window.AudioContext;
  window.showAlert = jest.fn();
  global.indexedDB = {
    open: () => {
      const req = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        result: {
          objectStoreNames: { contains: () => false },
          createObjectStore: () => ({}),
          transaction: () => ({
            objectStore: () => ({
              add: () => {},
              getAll: () => ({ result: [] }),
              delete: () => {},
            }),
          }),
        },
      };
      setTimeout(() => { if (req.onsuccess) req.onsuccess({ target: { result: req.result } }); }, 0);
      return req;
    },
  };
  Object.defineProperty(global.navigator, 'locks', {
    value: {
      request: jest.fn().mockImplementation((name, opts, cb) => {
        if (typeof opts === 'function') { cb = opts; opts = {}; }
        return Promise.resolve(cb({}));
      }),
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(global.navigator, 'wakeLock', {
    value: {
      request: jest.fn().mockResolvedValue({ release: jest.fn().mockResolvedValue() }),
    },
    writable: true,
    configurable: true,
  });
}

jest.unstable_mockModule('./gps.js', () => ({
  GPSManager: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

jest.unstable_mockModule('./sync.js', () => ({
  SyncService: jest.fn().mockImplementation(() => ({
    startSync: jest.fn(),
    stopSync: jest.fn(),
    flush: jest.fn().mockResolvedValue(),
    addPoint: jest.fn(),
    setRideId: jest.fn(),
  })),
}));

jest.unstable_mockModule('./api.js', () => ({
  startRide: jest.fn().mockResolvedValue({ ride_id: 42 }),
  stopRide: jest.fn().mockResolvedValue({}),
  getActiveRide: jest.fn(),
}));

beforeAll(async () => {
  setupBrowserMocks();
  const voiceModule = await import('./voice.js');
  VoiceService = voiceModule.VoiceService;
  const audioModule = await import('./audio.js');
  AudioCue = audioModule.AudioCue;
  const stateModule = await import('./state.js');
  RideState = stateModule.RideState;
  STATES = stateModule.STATES;
});

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('VoiceService', () => {
  it('speak method queues text and processes it', () => {
    const voice = new VoiceService();
    voice.speak('Ride started');
    expect(voice.queue.length).toBe(0);
    expect(voice.speaking).toBe(true);
    expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
    expect(window.SpeechSynthesisUtterance).toHaveBeenCalledWith('Ride started');
  });

  it('enabled defaults to true', () => {
    const voice = new VoiceService();
    expect(voice.isEnabled()).toBe(true);
  });

  it('reads disabled state from localStorage', () => {
    localStorage.setItem('voiceEnabled', 'false');
    const voice = new VoiceService();
    expect(voice.isEnabled()).toBe(false);
  });

  it('setEnabled persists to localStorage', () => {
    const voice = new VoiceService();
    voice.setEnabled(false);
    expect(voice.isEnabled()).toBe(false);
    expect(localStorage.getItem('voiceEnabled')).toBe('false');
    voice.setEnabled(true);
    expect(voice.isEnabled()).toBe(true);
    expect(localStorage.getItem('voiceEnabled')).toBe('true');
  });

  it('does not speak when disabled', () => {
    const voice = new VoiceService();
    voice.setEnabled(false);
    voice.speak('Should not speak');
    expect(voice.queue.length).toBe(0);
    expect(window.speechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('queues additional messages while speaking', () => {
    const voice = new VoiceService();
    voice.speak('First');
    voice.speak('Second');
    expect(voice.queue.length).toBe(1);
    expect(voice.queue[0]).toBe('Second');
  });

  it('speak returns early when speechSynthesis unavailable', () => {
    const orig = window.speechSynthesis;
    delete window.speechSynthesis;
    const voice = new VoiceService();
    voice.speak('No synth');
    expect(voice.queue.length).toBe(0);
    window.speechSynthesis = orig;
  });
});

describe('AudioCue', () => {
  it('playTone creates oscillator and gain nodes', () => {
    const audio = new AudioCue();
    audio.playTone(440, 0.5);
    const ctx = audio._getCtx();
    expect(ctx.createOscillator).toHaveBeenCalled();
    expect(ctx.createGain).toHaveBeenCalled();
  });

  it('playSweep ramps frequency', () => {
    const audio = new AudioCue();
    audio.playSweep(440, 880, 0.3);
    const ctx = audio._getCtx();
    const osc = ctx.createOscillator.mock.results[0].value;
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(440, 0);
    expect(osc.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(880, 0.3);
  });

  it('enabled defaults to true', () => {
    const audio = new AudioCue();
    expect(audio.isEnabled()).toBe(true);
  });

  it('reads disabled state from localStorage', () => {
    localStorage.setItem('audioCuesEnabled', 'false');
    const audio = new AudioCue();
    expect(audio.isEnabled()).toBe(false);
  });

  it('setEnabled persists to localStorage', () => {
    const audio = new AudioCue();
    audio.setEnabled(false);
    expect(audio.isEnabled()).toBe(false);
    expect(localStorage.getItem('audioCuesEnabled')).toBe('false');
    audio.setEnabled(true);
    expect(audio.isEnabled()).toBe(true);
    expect(localStorage.getItem('audioCuesEnabled')).toBe('true');
  });

  it('does not play when disabled', () => {
    const audio = new AudioCue();
    audio.setEnabled(false);
    audio.playTone(440, 0.5);
    expect(audio.ctx).toBeNull();
  });

  it('silently handles AudioContext errors', () => {
    const orig = window.AudioContext;
    window.AudioContext = jest.fn().mockImplementation(() => { throw new Error('no audio'); });
    window.webkitAudioContext = window.AudioContext;
    const audio = new AudioCue();
    expect(() => audio.playTone(440, 0.5)).not.toThrow();
    window.AudioContext = orig;
    window.webkitAudioContext = orig;
  });

  it('reuses AudioContext across calls', () => {
    const audio = new AudioCue();
    const ctx1 = audio._getCtx();
    const ctx2 = audio._getCtx();
    expect(ctx1).toBe(ctx2);
    expect(window.AudioContext).toHaveBeenCalledTimes(1);
  });
});

describe('RideState voice/audio hooks', () => {
  const makeUi = () => ({
    onStateChange: jest.fn(),
    updateTimer: jest.fn(),
    updateSpeed: jest.fn(),
    onSummary: jest.fn(),
  });

  it('constructor creates voice and audio instances', () => {
    const state = new RideState(makeUi());
    expect(state.voice).toBeInstanceOf(VoiceService);
    expect(state.audio).toBeInstanceOf(AudioCue);
  });

  it('autoPause triggers voice and audio cues', () => {
    const state = new RideState(makeUi());
    const voiceSpy = jest.spyOn(state.voice, 'speak');
    const audioSpy = jest.spyOn(state.audio, 'playTone');
    state.autoPause();
    expect(voiceSpy).toHaveBeenCalledWith('Ride paused');
    expect(audioSpy).toHaveBeenCalledWith(300, 0.15);
  });

  it('manualPause triggers voice and audio cues', () => {
    const state = new RideState(makeUi());
    const voiceSpy = jest.spyOn(state.voice, 'speak');
    const audioSpy = jest.spyOn(state.audio, 'playTone');
    state.manualPause();
    expect(voiceSpy).toHaveBeenCalledWith('Ride paused');
    expect(audioSpy).toHaveBeenCalledWith(300, 0.15);
  });

  it('autoResume triggers voice and audio cues', () => {
    const state = new RideState(makeUi());
    const voiceSpy = jest.spyOn(state.voice, 'speak');
    const audioSpy = jest.spyOn(state.audio, 'playTone');
    state.autoResume();
    expect(voiceSpy).toHaveBeenCalledWith('Ride resumed');
    expect(audioSpy).toHaveBeenCalledWith(660, 0.15);
  });

  it('manualResume triggers voice and audio cues', () => {
    const state = new RideState(makeUi());
    const voiceSpy = jest.spyOn(state.voice, 'speak');
    const audioSpy = jest.spyOn(state.audio, 'playTone');
    state.manualResume();
    expect(voiceSpy).toHaveBeenCalledWith('Ride resumed');
    expect(audioSpy).toHaveBeenCalledWith(660, 0.15);
  });

  it('start triggers voice and audio cues', async () => {
    const state = new RideState(makeUi());
    const voiceSpy = jest.spyOn(state.voice, 'speak');
    const audioSpy = jest.spyOn(state.audio, 'playSweep');
    await state.start();
    expect(voiceSpy).toHaveBeenCalledWith('Ride started');
    expect(audioSpy).toHaveBeenCalledWith(440, 880, 0.3);
    expect(state.state).toBe(STATES.RECORDING);
  });

  it('stop triggers voice and audio cues', async () => {
    const state = new RideState(makeUi());
    state.rideId = 42;
    state.state = STATES.RECORDING;
    state.stats.distance = 15.5;
    state.stats.movingSeconds = 5400;
    const voiceSpy = jest.spyOn(state.voice, 'speak');
    const audioSpy = jest.spyOn(state.audio, 'playSweep');
    await state.stop();
    expect(voiceSpy).toHaveBeenCalledWith('Ride complete. 15.5 kilometers in 90 minutes');
    expect(audioSpy).toHaveBeenCalledWith(880, 220, 0.5);
  });

  it('onPoint announces every 5km milestone', () => {
    jest.useFakeTimers();
    const state = new RideState(makeUi());
    state.state = STATES.RECORDING;
    state.stats.distance = 4.95;
    state.stats.movingSeconds = 3600;
    state.stats.lastLat = 52.0;
    state.stats.lastLng = 4.0;
    state._lastMilestoneKm = 0;
    const voiceSpy = jest.spyOn(state.voice, 'speak');
    const audioSpy = jest.spyOn(state.audio, 'playTone');

    state.onPoint({ lat: 52.0006, lng: 4.0, speed_kmh: 15 });

    expect(voiceSpy).toHaveBeenCalledWith('5 kilometers in 60 minutes');
    expect(audioSpy).toHaveBeenCalledWith(660, 0.15);

    jest.advanceTimersByTime(100);

    expect(audioSpy).toHaveBeenCalledWith(880, 0.15);
  });

  it('onPoint does not announce before 5km', () => {
    const state = new RideState(makeUi());
    state.state = STATES.RECORDING;
    state.stats.distance = 0.5;
    state.stats.movingSeconds = 600;
    state.stats.lastLat = 52.0;
    state.stats.lastLng = 4.0;
    state._lastMilestoneKm = 0;
    const voiceSpy = jest.spyOn(state.voice, 'speak');

    state.onPoint({ lat: 52.001, lng: 4.0, speed_kmh: 10 });

    expect(voiceSpy).not.toHaveBeenCalled();
  });

  it('onPoint does not announce during PAUSED state', () => {
    const state = new RideState(makeUi());
    state.state = STATES.PAUSED;
    state.stats.distance = 5.5;
    state.stats.movingSeconds = 3600;
    state.stats.lastLat = 52.0;
    state.stats.lastLng = 4.0;
    state._lastMilestoneKm = 0;
    const voiceSpy = jest.spyOn(state.voice, 'speak');

    state.onPoint({ lat: 52.001, lng: 4.0, speed_kmh: 0 });

    expect(voiceSpy).not.toHaveBeenCalled();
  });
});
