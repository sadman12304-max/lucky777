// Синтезированные звуки на WebAudio — без файлов и загрузок.

let ctx = null;
let enabled = true;

function ensure() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq = 440, dur = 0.1, type = 'sine', gain = 0.05, when = 0, slideTo = null }) {
  if (!enabled) return;
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.25, gain = 0.06, when = 0 } = {}) {
  if (!enabled) return;
  const ac = ensure();
  if (!ac) return;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.value = gain;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(ac.currentTime + when);
}

export const sfx = {
  setEnabled(v) { enabled = Boolean(v); },
  get enabled() { return enabled; },

  click() {
    tone({ freq: 640, dur: 0.045, type: 'triangle', gain: 0.03 });
  },
  tick() {
    tone({ freq: 320, dur: 0.03, type: 'square', gain: 0.018 });
  },
  spin() {
    tone({ freq: 120, dur: 0.3, type: 'sawtooth', gain: 0.02, slideTo: 320 });
  },
  stop() {
    tone({ freq: 440, dur: 0.07, type: 'triangle', gain: 0.04 });
    tone({ freq: 660, dur: 0.1, type: 'triangle', gain: 0.03, when: 0.05 });
  },
  win() {
    [523.25, 659.25, 783.99].forEach((f, i) => {
      tone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.045, when: i * 0.07 });
    });
  },
  bigWin() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.05, when: i * 0.09 });
    });
    noise({ dur: 0.4, gain: 0.02, when: 0.1 });
  },
  coin() {
    tone({ freq: 880, dur: 0.06, type: 'square', gain: 0.025 });
    tone({ freq: 1320, dur: 0.09, type: 'square', gain: 0.02, when: 0.05 });
  },
  crash() {
    tone({ freq: 220, dur: 0.5, type: 'sawtooth', gain: 0.06, slideTo: 40 });
    noise({ dur: 0.45, gain: 0.08 });
  },
  lose() {
    tone({ freq: 220, dur: 0.18, type: 'sine', gain: 0.035, slideTo: 140 });
  },
  bonus() {
    [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.05, when: i * 0.1 });
    });
  },
};
