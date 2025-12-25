import { useMemo, useRef, type MutableRefObject } from "react";

type UseSfxOpts = {
  enabled: boolean;
  reduceMotion: boolean;
};

export type BgmMode = "happy" | "suspense" | "manic" | "manic2" | "epic";

type SfxApi = {
  tick: () => void;
  primeOn: () => void;
  begin: () => void;
  success: () => void;
  finalOk: () => void;
  roomOk: (roomIdx: number) => void;
  pageTurn: () => void;
  lootTap: (p: number) => void;
  lootJackpot: () => void;
  setRageHold: (on: boolean) => void;
  rage: () => void;
  acdcHit: () => void;
  wrong: () => void;
  hackGlitch: () => void;
  reset: () => void;
  startBgm: (mode: BgmMode) => void;
  stopBgm: () => void;
  setBgmMode: (mode: BgmMode) => void;
  setBgmDrama: (t: number) => void;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function now(ctx: AudioContext) {
  return ctx.currentTime;
}

function ensureCtx(ref: MutableRefObject<AudioContext | null>): AudioContext {
  if (ref.current) return ref.current;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const ctx = new Ctx!();
  ref.current = ctx;
  return ctx;
}

async function resumeIfNeeded(ctx: AudioContext) {
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // Ignore (browser policy)
    }
  }
}

function bell(ctx: AudioContext, opts: { t0: number; freq: number; dur: number; gain: number }) {
  const t0 = opts.t0;
  const dur = opts.dur;
  const base = opts.freq;
  const g = clamp(opts.gain, 0, 1);

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(Math.max(0.0002, g), t0 + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  out.connect(ctx.destination);

  // A bell-ish stack: a couple detuned sines + a triangle.
  const partials: Array<{ type: OscillatorType; fMul: number; detune: number; amp: number }> = [
    { type: "sine", fMul: 1.0, detune: -7, amp: 0.55 },
    { type: "sine", fMul: 2.01, detune: 9, amp: 0.35 },
    { type: "triangle", fMul: 3.0, detune: 0, amp: 0.2 },
  ];

  for (const p of partials) {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = p.type;
    o.frequency.setValueAtTime(base * p.fMul, t0);
    o.detune.setValueAtTime(p.detune, t0);
    og.gain.setValueAtTime(p.amp, t0);
    o.connect(og);
    og.connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
}

function thump(ctx: AudioContext, opts: { t0: number; dur: number; gain: number }) {
  const t0 = opts.t0;
  const dur = opts.dur;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(clamp(opts.gain, 0.0002, 1), t0 + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  out.connect(ctx.destination);

  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(140, t0);
  o.frequency.exponentialRampToValueAtTime(55, t0 + dur);
  o.connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

type BgmEngine = {
  gain: GainNode;
  bass: OscillatorNode;
  bassGain: GainNode;
  lead: OscillatorNode;
  leadGain: GainNode;
  drumGain: GainNode;
  stopAt: () => void;
  playing: boolean;
  mode: BgmMode;
  timer: number | null;
  step: number;
  drama: number;
  nb: AudioBuffer | null;
};

type RageBed = {
  gain: GainNode;
  pre: GainNode;
  shaper: WaveShaperNode;
  filter: BiquadFilterNode;
  osc1: OscillatorNode;
  osc2: OscillatorNode;
  lfo: OscillatorNode;
  lfoGain: GainNode;
  noiseSrc: AudioBufferSourceNode;
  on: boolean;
  stopAt: (t: number) => void;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function noiseBuffer(ctx: AudioContext) {
  const len = Math.floor(ctx.sampleRate * 0.2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.65;
  return buf;
}

function kick(ctx: AudioContext, t0: number, g: number, out: GainNode) {
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(140, t0);
  o.frequency.exponentialRampToValueAtTime(52, t0 + 0.12);
  og.gain.setValueAtTime(0.0001, t0);
  og.gain.exponentialRampToValueAtTime(clamp(g, 0.0002, 1), t0 + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  o.connect(og);
  og.connect(out);
  o.start(t0);
  o.stop(t0 + 0.18);
}

function snare(ctx: AudioContext, t0: number, g: number, out: GainNode, nb: AudioBuffer) {
  const src = ctx.createBufferSource();
  src.buffer = nb;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.setValueAtTime(1800, t0);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t0);
  sg.gain.exponentialRampToValueAtTime(clamp(g, 0.0002, 1), t0 + 0.01);
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  src.connect(hp);
  hp.connect(sg);
  sg.connect(out);
  src.start(t0);
  src.stop(t0 + 0.14);
}

function setEngineMix(engine: BgmEngine, mode: BgmMode) {
  engine.mode = mode;
  const master = mode === "manic2" ? 0.13 : mode === "manic" ? 0.12 : mode === "epic" ? 0.14 : mode === "suspense" ? 0.09 : 0.095;
  engine.gain.gain.setTargetAtTime(master, engine.gain.context.currentTime, 0.06);

  if (mode === "happy") {
    engine.leadGain.gain.setTargetAtTime(0.07, engine.gain.context.currentTime, 0.06);
    engine.bassGain.gain.setTargetAtTime(0.06, engine.gain.context.currentTime, 0.06);
    engine.drumGain.gain.setTargetAtTime(0.07, engine.gain.context.currentTime, 0.06);
    return;
  }
  if (mode === "suspense") {
    engine.leadGain.gain.setTargetAtTime(0.045, engine.gain.context.currentTime, 0.06);
    engine.bassGain.gain.setTargetAtTime(0.07, engine.gain.context.currentTime, 0.06);
    engine.drumGain.gain.setTargetAtTime(0.06, engine.gain.context.currentTime, 0.06);
    return;
  }
  if (mode === "epic") {
    engine.leadGain.gain.setTargetAtTime(0.1, engine.gain.context.currentTime, 0.06);
    engine.bassGain.gain.setTargetAtTime(0.085, engine.gain.context.currentTime, 0.06);
    engine.drumGain.gain.setTargetAtTime(0.105, engine.gain.context.currentTime, 0.06);
    return;
  }
  if (mode === "manic2") {
    engine.leadGain.gain.setTargetAtTime(0.09, engine.gain.context.currentTime, 0.06);
    engine.bassGain.gain.setTargetAtTime(0.09, engine.gain.context.currentTime, 0.06);
    engine.drumGain.gain.setTargetAtTime(0.115, engine.gain.context.currentTime, 0.06);
    return;
  }
  // manic
  engine.leadGain.gain.setTargetAtTime(0.075, engine.gain.context.currentTime, 0.06);
  engine.bassGain.gain.setTargetAtTime(0.08, engine.gain.context.currentTime, 0.06);
  engine.drumGain.gain.setTargetAtTime(0.1, engine.gain.context.currentTime, 0.06);
}

function modeBaseBpm(mode: BgmMode) {
  return mode === "manic2" ? 176 : mode === "manic" ? 162 : mode === "epic" ? 132 : mode === "suspense" ? 104 : 116;
}

function restartScheduler(engine: BgmEngine) {
  if (!engine.playing) return;
  if (engine.timer) {
    window.clearInterval(engine.timer);
    engine.timer = null;
  }
  const ctx = engine.gain.context;
  const bpm =
    modeBaseBpm(engine.mode) +
    (engine.mode === "manic" || engine.mode === "manic2" ? Math.floor(engine.drama * (engine.mode === "manic2" ? 28 : 22)) : 0);
  const stepMs = Math.floor((60_000 / bpm) / 2); // 8th notes
  if (!engine.nb) engine.nb = noiseBuffer(ctx);

  const schedule = () => {
    const mode = engine.mode;
    const drama = engine.drama;
    const t0 = now(ctx) + 0.03;
    const s = engine.step % 16;

    // drums (density ramps with drama)
    const kickHit =
      mode === "happy"
        ? s === 0 || s === 8
        : mode === "suspense"
          ? s === 0 || s === 10 || (drama > 0.65 && s === 6)
          : mode === "epic"
            ? s === 0 || s === 6 || s === 8 || s === 14
            : mode === "manic2"
              ? s === 0 || s === 3 || s === 5 || s === 8 || s === 10 || s === 12 || s === 14 || (drama > 0.55 && s === 2) || (drama > 0.8 && s === 6)
              : s === 0 || s === 5 || s === 8 || s === 12 || s === 14 || (drama > 0.6 && s === 2) || (drama > 0.85 && s === 10);
    const snareHit =
      s === 4 ||
      s === 12 ||
      ((mode === "manic" || mode === "manic2") && drama > 0.72 && (s === 7 || s === 15)) ||
      (mode === "manic2" && drama > 0.5 && s === 11);
    if (kickHit) kick(ctx, t0, mode === "happy" ? 0.7 : mode === "suspense" ? 0.7 : 0.95, engine.drumGain);
    if (snareHit) snare(ctx, t0, mode === "happy" ? 0.55 : mode === "suspense" ? 0.6 : 0.82, engine.drumGain, engine.nb);

    // bass + lead
    // Subtle “key lift” as drama rises to make the ramp feel like real progression.
    const lift = mode === "epic" ? 0 : mode === "suspense" ? Math.floor(drama * 2) : Math.floor(drama * 3);
    const rootBase = mode === "epic" ? 98 : mode === "suspense" ? 98 : 110; // G2/A2-ish
    const leadBase = mode === "epic" ? 196 : mode === "suspense" ? 196 : 220;
    const root = rootBase * Math.pow(2, lift / 12);
    const leadRoot = leadBase * Math.pow(2, lift / 12);
    const scale =
      mode === "happy"
        ? [0, 2, 4, 5, 7, 9, 11] // major
        : mode === "epic"
          ? [0, 2, 4, 7, 9, 11] // heroic major-ish
          : mode === "suspense"
            ? [0, 2, 3, 5, 7, 10] // moody minor-ish
            : [0, 3, 5, 7, 10]; // minor pentatonic-ish

    const bassNote = mode === "happy" ? (s % 8 === 6 ? 7 : 0) : s % 4 === 0 ? 0 : s % 8 === 6 ? 7 : 0;
    const bassHz = root * Math.pow(2, bassNote / 12);
    engine.bass.frequency.setTargetAtTime(bassHz, t0, 0.02);

    const leadActive = mode === "happy" ? s % 4 === 0 : mode === "suspense" ? s % 2 === 0 : true;
    if (leadActive) {
      const shift =
        mode === "epic"
          ? 2
          : mode === "manic2"
            ? 4 + Math.floor(drama * 3)
            : mode === "manic"
              ? 3 + Math.floor(drama * 2)
              : mode === "suspense"
                ? 1 + Math.floor(drama * 1)
                : 0;
      const pick = scale[(s + shift) % scale.length];
      const hz = leadRoot * Math.pow(2, pick / 12);
      engine.lead.frequency.setTargetAtTime(hz, t0, 0.02);
      const a =
        mode === "epic"
          ? 0.11
          : mode === "manic2"
            ? 0.095 + drama * 0.03
            : mode === "manic"
              ? 0.085 + drama * 0.02
              : mode === "suspense"
                ? 0.05 + drama * 0.01
                : 0.07;
      engine.leadGain.gain.setTargetAtTime(a, t0, 0.02);
      engine.leadGain.gain.setTargetAtTime(mode === "happy" ? 0.045 : 0.03, t0 + 0.12, 0.05);
    }

    // bells: happy and epic sparkle; manic adds stabs as drama rises
    if (s === 0 && mode !== "manic" && mode !== "manic2") {
      bell(ctx, { t0: t0 + 0.02, freq: mode === "epic" ? 783.99 : mode === "suspense" ? 523.25 : 659.25, dur: 0.14, gain: 0.04 });
    }
    if (mode === "epic" && (s === 8 || s === 12)) {
      bell(ctx, { t0: t0 + 0.02, freq: 987.77, dur: 0.12, gain: 0.03 });
    }
    if ((mode === "manic" || mode === "manic2") && drama > 0.65 && (s === 4 || s === 11)) {
      bell(ctx, { t0: t0 + 0.01, freq: 880, dur: 0.08, gain: 0.02 });
    }
    if (mode === "manic2" && drama > 0.45 && (s === 2 || s === 6 || s === 10 || s === 14)) {
      bell(ctx, { t0: t0 + 0.01, freq: 987.77, dur: 0.06, gain: 0.018 });
    }

    engine.step += 1;
  };

  engine.timer = window.setInterval(schedule, stepMs);
}

function ensureBgm(ref: MutableRefObject<BgmEngine | null>, ctx: AudioContext): BgmEngine {
  if (ref.current) return ref.current;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now(ctx));
  master.connect(ctx.destination);

  const bass = ctx.createOscillator();
  bass.type = "sawtooth";
  const bassGain = ctx.createGain();
  bassGain.gain.value = 0.06;
  bass.connect(bassGain);
  bassGain.connect(master);
  bass.start();

  const lead = ctx.createOscillator();
  lead.type = "square";
  const leadGain = ctx.createGain();
  leadGain.gain.value = 0.05;
  lead.connect(leadGain);
  leadGain.connect(master);
  lead.start();

  const drumGain = ctx.createGain();
  drumGain.gain.value = 0.09;
  drumGain.connect(master);

  const engine: BgmEngine = {
    gain: master,
    bass,
    bassGain,
    lead,
    leadGain,
    drumGain,
    playing: false,
    mode: "happy",
    timer: null,
    step: 0,
    drama: 0,
    nb: null,
    stopAt: () => {
      // Fade out, but keep oscillators alive for a quick restart.
      master.gain.setTargetAtTime(0.0001, now(ctx), 0.06);
    },
  };

  ref.current = engine;
  return engine;
}

function zap(ctx: AudioContext, opts: { t0: number; dur: number; gain: number }) {
  const t0 = opts.t0;
  const dur = opts.dur;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(clamp(opts.gain, 0.0002, 1), t0 + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  out.connect(ctx.destination);

  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(190, t0);
  o.frequency.exponentialRampToValueAtTime(70, t0 + dur);
  o.connect(out);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function staticBurst(ctx: AudioContext, opts: { t0: number; dur: number; gain: number }) {
  const t0 = opts.t0;
  const dur = opts.dur;
  const buf = noiseBuffer(ctx);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(2200, t0);
  bp.Q.setValueAtTime(1.6, t0);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(clamp(opts.gain, 0.0002, 1), t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function distortionCurve(amount: number) {
  const k = clamp(amount, 0, 400);
  const n = 44100;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function rockBurst(ctx: AudioContext, t0: number, dur: number, intensity: number) {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.exponentialRampToValueAtTime(0.08 + intensity * 0.08, t0 + 0.02);
  out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  out.connect(ctx.destination);

  // Distortion chain for a “guitar-ish” bite.
  const ws = ctx.createWaveShaper();
  ws.curve = distortionCurve(220 + intensity * 140);
  ws.oversample = "4x";
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(3200, t0);
  lp.frequency.setTargetAtTime(2400, t0 + 0.12, 0.15);
  ws.connect(lp);
  lp.connect(out);

  // Power-chord-ish stack (root + fifth) with saws.
  const root = 110; // A2-ish
  const fifth = root * Math.pow(2, 7 / 12);
  const dets = [-8, 6];
  for (const base of [root, fifth]) {
    for (const d of dets) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(base, t0);
      o.detune.setValueAtTime(d, t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(ws);
      o.start(t0);
      o.stop(t0 + dur + 0.03);
    }
  }

  // “Scream” = bandpassed noise + rising/falling formant-ish sweep
  const nb = noiseBuffer(ctx);
  const src = ctx.createBufferSource();
  src.buffer = nb;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.setValueAtTime(0.9 + intensity * 0.9, t0);
  bp.frequency.setValueAtTime(750, t0);
  bp.frequency.exponentialRampToValueAtTime(1500, t0 + Math.min(0.35, dur * 0.35));
  bp.frequency.exponentialRampToValueAtTime(520, t0 + dur);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, t0);
  sg.gain.exponentialRampToValueAtTime(0.055 + intensity * 0.06, t0 + 0.02);
  sg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(sg);
  sg.connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);

  // Accent drum hits
  thump(ctx, { t0: t0 + 0.01, dur: 0.11, gain: 0.1 + intensity * 0.1 });
  thump(ctx, { t0: t0 + 0.22, dur: 0.12, gain: 0.08 + intensity * 0.08 });
}

function modeFlipHit(ctx: AudioContext, to: BgmMode) {
  const t0 = now(ctx);
  if (to === "happy") {
    bell(ctx, { t0, freq: 659.25, dur: 0.12, gain: 0.035 });
    bell(ctx, { t0: t0 + 0.05, freq: 783.99, dur: 0.12, gain: 0.03 });
    return;
  }
  if (to === "suspense") {
    // low “whoosh” + tiny click
    thump(ctx, { t0, dur: 0.14, gain: 0.04 });
    return;
  }
  if (to === "manic" || to === "manic2") {
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.14, t0 + 0.01);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    out.connect(ctx.destination);
    const nb = noiseBuffer(ctx);
    kick(ctx, t0 + 0.01, 0.55, out);
    snare(ctx, t0 + 0.09, 0.42, out, nb);
    kick(ctx, t0 + 0.15, 0.58, out);
    // tiny bell sting to read as “Christmas” even when it goes intense
    bell(ctx, { t0: t0 + 0.02, freq: 987.77, dur: 0.09, gain: 0.02 });
    return;
  }
  // epic
  thump(ctx, { t0, dur: 0.16, gain: 0.07 });
  bell(ctx, { t0: t0 + 0.02, freq: 523.25, dur: 0.18, gain: 0.05 });
  bell(ctx, { t0: t0 + 0.07, freq: 659.25, dur: 0.18, gain: 0.045 });
  bell(ctx, { t0: t0 + 0.12, freq: 783.99, dur: 0.2, gain: 0.04 });
}

function ensureRageBed(ref: MutableRefObject<RageBed | null>, ctx: AudioContext) {
  if (ref.current) return ref.current;
  const t0 = now(ctx);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.connect(ctx.destination);

  const pre = ctx.createGain();
  pre.gain.setValueAtTime(1.8, t0);

  const shaper = ctx.createWaveShaper();
  shaper.curve = distortionCurve(0.85);
  shaper.oversample = "4x";

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(780, t0);
  filter.Q.setValueAtTime(0.9, t0);

  // “Guitar-ish” power chord: two detuned saws through distortion.
  const osc1 = ctx.createOscillator();
  osc1.type = "sawtooth";
  osc1.frequency.setValueAtTime(110, t0); // A2-ish
  osc1.detune.setValueAtTime(-7, t0);
  const osc2 = ctx.createOscillator();
  osc2.type = "sawtooth";
  osc2.frequency.setValueAtTime(165, t0); // E3-ish
  osc2.detune.setValueAtTime(6, t0);

  // Hiss for “amp” vibe (very low).
  const nb = noiseBuffer(ctx);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = nb;
  noiseSrc.loop = true;
  const noiseHP = ctx.createBiquadFilter();
  noiseHP.type = "highpass";
  noiseHP.frequency.setValueAtTime(1400, t0);
  const noiseG = ctx.createGain();
  noiseG.gain.setValueAtTime(0.01, t0);

  // LFO wobbles filter slightly so it feels alive.
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(2.2, t0);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(120, t0);

  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);

  osc1.connect(pre);
  osc2.connect(pre);
  pre.connect(shaper);
  shaper.connect(filter);
  filter.connect(gain);

  noiseSrc.connect(noiseHP);
  noiseHP.connect(noiseG);
  noiseG.connect(filter);

  osc1.start(t0);
  osc2.start(t0);
  lfo.start(t0);
  noiseSrc.start(t0);

  const bed: RageBed = {
    gain,
    pre,
    shaper,
    filter,
    osc1,
    osc2,
    lfo,
    lfoGain,
    noiseSrc,
    on: false,
    stopAt: (t: number) => {
      try {
        gain.gain.setTargetAtTime(0.0001, t, 0.08);
        osc1.stop(t + 0.25);
        osc2.stop(t + 0.25);
        lfo.stop(t + 0.25);
        noiseSrc.stop(t + 0.25);
      } catch {
        // ignore
      }
    },
  };
  ref.current = bed;
  return bed;
}

export function useSfx(opts: UseSfxOpts): SfxApi {
  const ctxRef = useRef<AudioContext | null>(null);
  const bgmRef = useRef<BgmEngine | null>(null);
  const rageBedRef = useRef<RageBed | null>(null);

  return useMemo(() => {
    const safePlay = async (fn: (ctx: AudioContext) => void, force = false) => {
      if (!force && !opts.enabled) return;
      const ctx = ensureCtx(ctxRef);
      await resumeIfNeeded(ctx);
      fn(ctx);
    };

    const tick = () => {
      void safePlay((ctx) => bell(ctx, { t0: now(ctx), freq: 880, dur: 0.14, gain: 0.08 }));
    };

    const pageTurn = () => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        // Paper flick: filtered noise + tiny bell dust.
        const nb = noiseBuffer(ctx);
        const src = ctx.createBufferSource();
        src.buffer = nb;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(1200, t0);
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(4200, t0);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.035, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
        src.connect(hp);
        hp.connect(lp);
        lp.connect(g);
        g.connect(ctx.destination);
        src.start(t0);
        src.stop(t0 + 0.14);
        bell(ctx, { t0: t0 + 0.02, freq: 1174.66, dur: 0.08, gain: 0.02 });
      });
    };

    const lootTap = (p: number) => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        const k = clamp01(p);
        // Slot-ish tick + rattle + tiny bell sparkle (ramps with progress).
        thump(ctx, { t0, dur: 0.06, gain: 0.02 + k * 0.03 });
        bell(ctx, { t0: t0 + 0.01, freq: 880 + k * 220, dur: 0.06, gain: 0.02 + k * 0.02 });
        const nb = noiseBuffer(ctx);
        const src = ctx.createBufferSource();
        src.buffer = nb;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(2200 + k * 800, t0);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.02 + k * 0.03, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
        src.connect(bp);
        bp.connect(g);
        g.connect(ctx.destination);
        src.start(t0);
        src.stop(t0 + 0.1);
      });
    };

    const lootJackpot = () => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        // Big “BOOM YA” jackpot hit: drum fill + bells.
        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, t0);
        out.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01);
        out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
        out.connect(ctx.destination);
        const nb = noiseBuffer(ctx);
        kick(ctx, t0 + 0.01, 0.7, out);
        snare(ctx, t0 + 0.12, 0.55, out, nb);
        kick(ctx, t0 + 0.22, 0.75, out);
        snare(ctx, t0 + 0.32, 0.6, out, nb);
        kick(ctx, t0 + 0.42, 0.85, out);
        snare(ctx, t0 + 0.52, 0.7, out, nb);
        thump(ctx, { t0: t0 + 0.18, dur: 0.14, gain: 0.09 });
        bell(ctx, { t0: t0 + 0.02, freq: 783.99, dur: 0.16, gain: 0.06 });
        bell(ctx, { t0: t0 + 0.08, freq: 987.77, dur: 0.14, gain: 0.05 });
        bell(ctx, { t0: t0 + 0.14, freq: 1174.66, dur: 0.12, gain: 0.04 });
      });
    };

    const primeOn = () => {
      // For the click that enables sound; must play even when enabled=false in this render.
      void safePlay((ctx) => bell(ctx, { t0: now(ctx), freq: 988, dur: 0.14, gain: 0.08 }), true);
    };

    const begin = () => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        bell(ctx, { t0, freq: 659.25, dur: 0.18, gain: 0.08 }); // E5
        bell(ctx, { t0: t0 + 0.08, freq: 783.99, dur: 0.18, gain: 0.075 }); // G5
      });
    };

    const success = () => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        const fast = opts.reduceMotion ? 0.02 : 0.06;
        bell(ctx, { t0, freq: 523.25, dur: 0.22, gain: 0.09 }); // C5
        bell(ctx, { t0: t0 + fast, freq: 659.25, dur: 0.22, gain: 0.085 }); // E5
        bell(ctx, { t0: t0 + fast * 2, freq: 783.99, dur: 0.24, gain: 0.08 }); // G5
      });
    };

    const finalOk = () => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        // Big “final access” moment: drum hit + rising pad + bell run.
        thump(ctx, { t0, dur: 0.12, gain: 0.09 });

        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, t0);
        out.gain.exponentialRampToValueAtTime(0.22, t0 + 0.01);
        out.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.8);
        out.connect(ctx.destination);

        const nb = noiseBuffer(ctx);
        // Punchy “BOOM-ya” fill
        kick(ctx, t0 + 0.02, 0.7, out);
        snare(ctx, t0 + 0.12, 0.55, out, nb);
        kick(ctx, t0 + 0.22, 0.78, out);
        snare(ctx, t0 + 0.32, 0.62, out, nb);
        kick(ctx, t0 + 0.44, 0.85, out);

        // Warm “epic” pad chord (C major-ish) with a bright sweep.
        const pad = ctx.createGain();
        pad.gain.setValueAtTime(0.0001, t0);
        pad.gain.exponentialRampToValueAtTime(0.07, t0 + 0.08);
        pad.gain.setTargetAtTime(0.0001, t0 + 3.2, 0.25);

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(620, t0);
        lp.frequency.exponentialRampToValueAtTime(2200, t0 + 0.55);
        lp.frequency.setTargetAtTime(920, t0 + 2.1, 0.35);

        pad.connect(lp);
        lp.connect(ctx.destination);

        const chord = [261.63, 329.63, 392.0]; // C4 E4 G4
        for (const [i, f] of chord.entries()) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = i === 1 ? "triangle" : "sawtooth";
          o.frequency.setValueAtTime(f, t0);
          // little lift at the start
          o.frequency.exponentialRampToValueAtTime(f * 1.06, t0 + 0.45);
          g.gain.setValueAtTime(i === 1 ? 0.22 : 0.18, t0);
          o.connect(g);
          g.connect(pad);
          o.start(t0 + 0.03);
          o.stop(t0 + 3.6);
        }

        // Bell run: quick and bright, sits on top of the pad.
        const step = opts.reduceMotion ? 0.04 : 0.06;
        bell(ctx, { t0: t0 + 0.02, freq: 659.25, dur: 0.18, gain: 0.08 }); // E
        bell(ctx, { t0: t0 + 0.02 + step, freq: 783.99, dur: 0.16, gain: 0.072 }); // G
        bell(ctx, { t0: t0 + 0.02 + step * 2, freq: 987.77, dur: 0.16, gain: 0.06 }); // B
        bell(ctx, { t0: t0 + 0.02 + step * 3, freq: 1174.66, dur: 0.14, gain: 0.05 }); // D
        bell(ctx, { t0: t0 + 0.02 + step * 4, freq: 1318.51, dur: 0.14, gain: 0.045 }); // E
      });
    };

    const roomOk = (roomIdx: number) => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        // “Room unlocked” celebration: festive bells + a tiny drum fill (bigger on milestones).
        const k = clamp01(roomIdx / 10);
        const big = roomIdx === 10 || roomIdx % 3 === 0;
        thump(ctx, { t0, dur: 0.09, gain: (big ? 0.055 : 0.035) + k * 0.02 });

        // Drum fill (short, punchy; avoids being harsh on phone speakers).
        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, t0);
        out.gain.exponentialRampToValueAtTime(big ? 0.18 : 0.12, t0 + 0.01);
        out.gain.exponentialRampToValueAtTime(0.0001, t0 + (big ? 0.55 : 0.36));
        out.connect(ctx.destination);
        const nb = noiseBuffer(ctx);
        const hits = big
          ? [
              // kick/snare “BOOM-ya” vibe
              ["k", 0.02, 0.55],
              ["s", 0.10, 0.42],
              ["k", 0.18, 0.58],
              ["s", 0.26, 0.48],
              ["k", 0.34, 0.62],
              ["s", 0.42, 0.55],
            ]
          : [
              ["k", 0.02, 0.48],
              ["s", 0.14, 0.36],
              ["k", 0.26, 0.5],
            ];
        for (const [t, dt, g] of hits) {
          const tt = t0 + dt;
          if (t === "k") kick(ctx, tt, g as number, out);
          else snare(ctx, tt, g as number, out, nb);
        }

        bell(ctx, { t0: t0 + 0.01, freq: 523.25 + k * 90, dur: 0.14, gain: 0.055 });
        bell(ctx, { t0: t0 + 0.06, freq: 659.25 + k * 120, dur: 0.12, gain: 0.05 });
        // A little “jingle” sparkle on bigger moments / late rooms.
        if (big || roomIdx >= 7) {
          bell(ctx, { t0: t0 + 0.12, freq: 783.99 + k * 160, dur: 0.1, gain: 0.045 });
          bell(ctx, { t0: t0 + 0.18, freq: 987.77 + k * 120, dur: 0.09, gain: 0.032 });
        }
        if (roomIdx === 10) {
          thump(ctx, { t0: t0 + 0.22, dur: 0.12, gain: 0.08 });
        }
      });
    };

    const wrong = () => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        // quick deny: thump + zap + static (make it loud enough to cut through MP3)
        thump(ctx, { t0, dur: 0.12, gain: 0.085 });
        zap(ctx, { t0, dur: 0.22, gain: 0.11 });
        staticBurst(ctx, { t0: t0 + 0.02, dur: 0.18, gain: 0.07 });
        // Annoying-but-fun “bad jingle” (minor-ish fall)
        bell(ctx, { t0: t0 + 0.02, freq: 740, dur: 0.1, gain: 0.048 });
        bell(ctx, { t0: t0 + 0.08, freq: 622, dur: 0.1, gain: 0.045 });
        bell(ctx, { t0: t0 + 0.14, freq: 523.25, dur: 0.11, gain: 0.05 });
      });
    };

    const rage = () => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        const engine = bgmRef.current;
        const pre = engine?.gain.gain.value ?? 0;
        // Duck current BGM hard, then restore.
        if (engine?.playing) {
          engine.gain.gain.setValueAtTime(pre, t0);
          engine.gain.gain.setTargetAtTime(Math.max(0.0001, pre * 0.18), t0, 0.02);
          engine.gain.gain.setTargetAtTime(pre, t0 + 2.0, 0.12);
        }
        rockBurst(ctx, t0 + 0.02, 2.1, 0.72);
      });
    };

    const setRageHold = (on: boolean) => {
      void safePlay(
        (ctx) => {
          const t0 = now(ctx);
          if (!on) {
            const bed = rageBedRef.current;
            if (bed?.on) {
              bed.on = false;
              bed.gain.gain.setTargetAtTime(0.0001, t0, 0.12);
              bed.stopAt(t0);
              rageBedRef.current = null;
            }
            return;
          }
          const bed = ensureRageBed(rageBedRef, ctx);
          bed.on = true;
          // Keep it subtle but present: it should “hang” under the normal music.
          bed.gain.gain.setTargetAtTime(0.045, t0, 0.08);
        },
        true,
      );
    };

    const acdcHit = () => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        const engine = bgmRef.current;
        const pre = engine?.gain.gain.value ?? 0;
        // Briefly duck to make the stinger feel like a cut-in.
        if (engine?.playing) {
          engine.gain.gain.setValueAtTime(pre, t0);
          engine.gain.gain.setTargetAtTime(Math.max(0.0001, pre * 0.55), t0, 0.04);
          engine.gain.gain.setTargetAtTime(pre, t0 + 3.6, 0.16);
        }
        rockBurst(ctx, t0 + 0.02, 3.8, 0.95);
      });
    };

    const hackGlitch = () => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        // Cinematic “UI hijack” stutter: static + descending square + quick duck of bgm.
        const engine = bgmRef.current;
        const pre = engine?.gain.gain.value ?? 0;
        if (engine?.playing) {
          engine.gain.gain.setValueAtTime(pre, t0);
          engine.gain.gain.setTargetAtTime(Math.max(0.0001, pre * 0.35), t0, 0.02);
          engine.gain.gain.setTargetAtTime(pre, t0 + 0.22, 0.07);
        }

        staticBurst(ctx, { t0, dur: 0.22, gain: 0.04 });
        zap(ctx, { t0: t0 + 0.02, dur: 0.22, gain: 0.055 });

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26);
        g.connect(ctx.destination);

        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(1800, t0);
        lp.frequency.exponentialRampToValueAtTime(420, t0 + 0.24);
        lp.connect(g);

        const o = ctx.createOscillator();
        o.type = "square";
        o.frequency.setValueAtTime(520, t0);
        o.frequency.exponentialRampToValueAtTime(78, t0 + 0.24); // tape-stop-ish fall
        o.connect(lp);
        o.start(t0);
        o.stop(t0 + 0.28);
      });
    };

    const reset = () => {
      void safePlay((ctx) => {
        const t0 = now(ctx);
        thump(ctx, { t0, dur: 0.12, gain: 0.08 });
        bell(ctx, { t0: t0 + 0.06, freq: 440, dur: 0.14, gain: 0.06 });
      });
    };

    const startBgm = (mode: BgmMode) => {
      void safePlay((ctx) => {
        const engine = ensureBgm(bgmRef, ctx);
        const prev = engine.mode;
        setEngineMix(engine, mode);
        if (prev !== mode) modeFlipHit(ctx, mode);
        if (!engine.playing) {
          engine.playing = true;
          engine.step = 0;
          engine.gain.gain.setTargetAtTime(0.0001, now(ctx), 0.01);
        }
        restartScheduler(engine);
        engine.gain.gain.setTargetAtTime(
          mode === "epic" ? 0.14 : mode === "manic2" ? 0.13 : mode === "manic" ? 0.12 : mode === "happy" ? 0.1 : 0.09,
          now(ctx),
          0.08,
        );
      });
    };

    const stopBgm = () => {
      void safePlay((ctx) => {
        const engine = bgmRef.current;
        if (!engine) return;
        engine.playing = false;
        if (engine.timer) {
          window.clearInterval(engine.timer);
          engine.timer = null;
        }
        engine.gain.gain.setTargetAtTime(0.0001, now(ctx), 0.06);
        // Also stop any lingering rage bed.
        const bed = rageBedRef.current;
        if (bed?.on) {
          bed.on = false;
          bed.gain.gain.setTargetAtTime(0.0001, now(ctx), 0.08);
          bed.stopAt(now(ctx));
          rageBedRef.current = null;
        }
      });
    };

    const setBgmMode = (mode: BgmMode) => {
      void safePlay((ctx) => {
        const engine = bgmRef.current;
        if (!engine) return;
        const prev = engine.mode;
        setEngineMix(engine, mode);
        if (prev !== mode) modeFlipHit(ctx, mode);
        restartScheduler(engine);
      });
    };

    const setBgmDrama = (t: number) => {
      void safePlay((ctx) => {
        const engine = bgmRef.current;
        if (!engine) return;
        engine.drama = clamp01(t);
        // For manic, ramp density and volume slightly as you progress.
        if (engine.mode === "manic" || engine.mode === "manic2") {
          engine.drumGain.gain.setTargetAtTime((engine.mode === "manic2" ? 0.115 : 0.1) + engine.drama * 0.03, now(ctx), 0.08);
          engine.leadGain.gain.setTargetAtTime((engine.mode === "manic2" ? 0.09 : 0.075) + engine.drama * 0.03, now(ctx), 0.08);
          restartScheduler(engine);
        }
      });
    };

    return {
      tick,
      pageTurn,
      lootTap,
      lootJackpot,
      setRageHold,
      primeOn,
      begin,
      success,
      finalOk,
      roomOk,
      rage,
      acdcHit,
      wrong,
      hackGlitch,
      reset,
      startBgm,
      stopBgm,
      setBgmMode,
      setBgmDrama,
    };
  }, [opts.enabled, opts.reduceMotion]);
}


