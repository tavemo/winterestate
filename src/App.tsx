import { AnimatePresence, motion } from "framer-motion";
import { Copy, RotateCcw, Settings2, Volume2, VolumeX } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import IntroLetter from "./components/IntroLetter";
import PresentBox from "./components/PresentBox";
import TerminalReveal from "./components/TerminalReveal";
import { useSfx } from "./sfx";

type Settings = {
  sound: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
};

type Stage = "note" | "present" | "terminal" | "reward" | "final";

type AppState = {
  stage: Stage;
  settings: Settings;
};

const STORAGE_KEY = "christmas_card_turbo_v1";
const REVEAL_CODE = "Y9J8X-5G546-Q4FRK";
const MUSIC_XMAS = "/easter/xmas.mp3";
const MUSIC_POST_HIJACK = "/easter/do-dekar.mp3";
const MUSIC_EMPTY = "/easter/metal%20gear.mp3";
const MUSIC_ROCK_XMAS = "/easter/rockxmas.mp3";
const MUSIC_ACDC = "/easter/acdc.mp3";
const MUSIC_SLAPPA = "/easter/slappa.mp3";
const MUSIC_END = "/easter/end.mp3";
const MUSIC_VICTORY = "/easter/victory.mp3";

function trackTargetVol(track: "xmas" | "post" | "metal" | "rockxmas" | "acdc" | "slappa") {
  // Keep “loot box” / hype tracks louder than the intro bed.
  if (track === "xmas") return 0.7;
  if (track === "rockxmas") return 0.95;
  if (track === "acdc") return 0.92;
  if (track === "slappa") return 0.9;
  if (track === "metal") return 0.9;
  return 0.85; // post-hijack dark bed
}

const DEFAULT_STATE: AppState = {
  stage: "note",
  settings: {
    sound: true,
    reduceMotion: false,
    highContrast: false,
  },
};

function safeParse(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== "object") return base;
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const prev = (base as Record<string, unknown>)[k];
      (base as Record<string, unknown>)[k] = deepMerge((prev ?? {}) as Record<string, unknown>, v);
    } else {
      (base as Record<string, unknown>)[k] = v;
    }
  }
  return base;
}

function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse(raw);
  const merged = deepMerge(structuredClone(DEFAULT_STATE), parsed) as AppState;
  // Always resume where they left off (iOS can reload tabs unpredictably).
  return merged;
}

function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function useAppState() {
  const [state, setState] = useState<AppState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    document.body.classList.toggle("reduce-motion", !!state.settings.reduceMotion);
    document.body.classList.toggle("high-contrast", !!state.settings.highContrast);
  }, [state.settings.highContrast, state.settings.reduceMotion]);

  return { state, setState };
}

function useSnow(ref: React.RefObject<HTMLCanvasElement | null>, opts: { reduceMotion: boolean; intensity: number }) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const flakes: Array<{ x: number; y: number; r: number; s: number; dx: number }> = [];
    const count = Math.floor(90 * opts.intensity);

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    function resize() {
      w = canvas.width = Math.floor(window.innerWidth * window.devicePixelRatio);
      h = canvas.height = Math.floor(window.innerHeight * window.devicePixelRatio);
    }

    function init() {
      flakes.length = 0;
      for (let i = 0; i < count; i++) {
        flakes.push({
          x: rand(0, w),
          y: rand(0, h),
          r: rand(0.7, 2.2) * window.devicePixelRatio,
          s: rand(0.3, 1.3) * window.devicePixelRatio,
          dx: rand(-0.2, 0.2) * window.devicePixelRatio,
        });
      }
    }

    let raf = 0;
    function tick() {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgba(216,246,255,${0.28 + Math.min(0.22, 0.08 * opts.intensity)})`;
      for (const f of flakes) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
        if (!opts.reduceMotion) {
          f.y += f.s * opts.intensity;
          f.x += f.dx * opts.intensity;
        }
        if (f.y > h + 10) f.y = -10;
        if (f.x < -10) f.x = w + 10;
        if (f.x > w + 10) f.x = -10;
      }
      raf = window.requestAnimationFrame(tick);
    }

    resize();
    init();
    tick();
    const onResize = () => {
      resize();
      init();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, [ref, opts.intensity, opts.reduceMotion]);
}

type Debris = {
  x: number;
  y: number;
  s: number;
  r: number;
  vy: number;
  vx: number;
  spin: number;
  type: "domino" | "hat" | "glyph";
  hue: number;
  ch: string;
};

function useDebris(ref: React.RefObject<HTMLCanvasElement | null>, opts: { reduceMotion: boolean; intensity: number; drama: number }) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const items: Debris[] = [];
    const glyphs = "01△◇✶✷✸✹⋆+*";

    const rand = (min: number, max: number) => min + Math.random() * (max - min);
    const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

    function resize() {
      w = canvas.width = Math.floor(window.innerWidth * dpr);
      h = canvas.height = Math.floor(window.innerHeight * dpr);
    }

    function spawn(n: number) {
      for (let i = 0; i < n; i++) {
        const t = Math.random();
        const type: Debris["type"] = t < 0.46 ? "glyph" : t < 0.76 ? "domino" : "hat";
        items.push({
          x: rand(0, w),
          y: rand(-h, 0),
          s: rand(0.75, 1.25) * dpr,
          r: rand(0, Math.PI * 2),
          vy: rand(36, 110) * dpr * (0.7 + opts.intensity * 0.35),
          vx: rand(-12, 12) * dpr * (0.25 + opts.drama * 0.7),
          spin: rand(-1.6, 1.6) * (0.25 + opts.drama),
          type,
          hue: Math.random(),
          ch: type === "glyph" ? pick(glyphs.split("")) : "",
        });
      }
    }

    function roundRectPath(x: number, y: number, ww: number, hh: number, rr: number) {
      const r = Math.max(0, Math.min(rr, Math.min(ww, hh) / 2));
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + ww - r, y);
      ctx.quadraticCurveTo(x + ww, y, x + ww, y + r);
      ctx.lineTo(x + ww, y + hh - r);
      ctx.quadraticCurveTo(x + ww, y + hh, x + ww - r, y + hh);
      ctx.lineTo(x + r, y + hh);
      ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    let raf = 0;
    function tick() {
      // trailing fade = matrix-ish
      ctx.fillStyle = `rgba(4,10,12,${0.12 + opts.drama * 0.18})`;
      ctx.fillRect(0, 0, w, h);

      const target = Math.floor((22 + opts.intensity * 34) * (0.65 + opts.drama * 0.65));
      if (items.length < target) spawn(target - items.length);

      for (const it of items) {
        if (!opts.reduceMotion) {
          it.y += it.vy * 0.016;
          it.x += it.vx * 0.016;
          it.r += it.spin * 0.016;
        }

        if (it.y > h + 80) {
          it.y = rand(-180, -20);
          it.x = rand(0, w);
          it.ch = it.type === "glyph" ? pick(glyphs.split("")) : it.ch;
        }
        if (it.x < -80) it.x = w + 80;
        if (it.x > w + 80) it.x = -80;

        ctx.save();
        ctx.translate(it.x, it.y);
        ctx.rotate(it.r);
        ctx.scale(it.s, it.s);

        if (it.type === "domino") {
          ctx.fillStyle = "rgba(216,246,255,0.24)";
          ctx.strokeStyle = "rgba(103,211,255,0.22)";
          ctx.lineWidth = 1.2;
          const rw = 14;
          const rh = 24;
          roundRectPath(-rw / 2, -rh / 2, rw, rh, 4);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = "rgba(103,211,255,0.14)";
          ctx.beginPath();
          ctx.moveTo(-rw / 2 + 2, 0);
          ctx.lineTo(rw / 2 - 2, 0);
          ctx.stroke();
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          for (const [px, py] of [
            [-3.5, -6],
            [3.5, -6],
            [0, 6],
          ]) {
            ctx.beginPath();
            ctx.arc(px, py, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (it.type === "hat") {
          // simple santa hat: red triangle + white brim + pom
          ctx.fillStyle = "rgba(208,36,61,0.24)";
          ctx.strokeStyle = "rgba(255,215,122,0.22)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(-10, 8);
          ctx.lineTo(0, -14);
          ctx.lineTo(10, 8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "rgba(255,215,122,0.22)";
          ctx.fillRect(-11, 7, 22, 5);
          ctx.beginPath();
          ctx.arc(3, -14, 3.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // glyph
          const alpha = 0.24 + opts.drama * 0.32;
          ctx.fillStyle = `rgba(31,143,84,${alpha})`;
          ctx.font = "18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
          ctx.fillText(it.ch || "0", -5, 6);
        }

        ctx.restore();
      }

      raf = window.requestAnimationFrame(tick);
    }

    resize();
    // start with a modest number; it will ramp up.
    spawn(Math.floor(16 + opts.intensity * 10));
    tick();
    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.cancelAnimationFrame(raf);
    };
  }, [ref, opts.drama, opts.intensity, opts.reduceMotion]);
}

export default function App() {
  const { state, setState } = useAppState();
  const snowRef = useRef<HTMLCanvasElement | null>(null);
  const debrisRef = useRef<HTMLCanvasElement | null>(null);
  const [terminalDrama, setTerminalDrama] = useState(0);
  const [rageHold, setRageHold] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const handoffTimerRef = useRef<number | null>(null);
  const snowIntensity =
    state.stage === "terminal"
      ? 2.4 + terminalDrama * 2.2
      : state.stage === "present"
        ? 1.3
        : state.stage === "final"
          ? 1.15
          : 1;
  useSnow(snowRef, { reduceMotion: state.settings.reduceMotion, intensity: snowIntensity });
  const debrisIntensity = state.stage === "terminal" ? 1.4 + terminalDrama * 2.2 : state.stage === "present" ? 0.55 : 0.25;
  useDebris(debrisRef, { reduceMotion: state.settings.reduceMotion, intensity: debrisIntensity, drama: state.stage === "terminal" ? terminalDrama : 0 });
  const sfx = useSfx({ enabled: state.settings.sound, reduceMotion: state.settings.reduceMotion });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const stage = state.stage;
  const [copied, setCopied] = useState(false);
  const showBottomBar = stage !== "note" && stage !== "present";
  const showOptionsInBar = stage === "final" || stage === "terminal" || stage === "reward";
  const preloadOnceRef = useRef(false);
  const copiedTimerRef = useRef<number | null>(null);
  const rewardTimerRef = useRef<number | null>(null);
  const [hijacked, setHijacked] = useState(false);
  const musicRef = useRef<{
    a: HTMLAudioElement;
    b: HTMLAudioElement;
    active: "a" | "b";
    track: string | null;
    target: number;
  } | null>(null);
  const endRef = useRef<HTMLAudioElement | null>(null);
  const endPlayedRef = useRef(false);
  const victoryRef = useRef<HTMLAudioElement | null>(null);
  const [victoryHoldMs, setVictoryHoldMs] = useState(7200);
  const roomWinAudioTimerRef = useRef<number | null>(null);

  const assetSfxRef = useRef<{
    defs: Record<
      string,
      {
        srcs: string[];
        pool: HTMLAudioElement[];
        idx: number;
        ok: boolean;
        baseVol: number;
      }
    >;
  } | null>(null);

  const ensureMusic = () => {
    if (musicRef.current) return musicRef.current;
    const a = new Audio();
    const b = new Audio();
    for (const el of [a, b]) {
      el.loop = true;
      el.preload = "auto";
      el.volume = 0;
      // Best effort: avoid “full screen player” behavior in some browsers.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any).playsInline = true;
    }
    musicRef.current = { a, b, active: "a", track: null, target: 0.85 };
    return musicRef.current;
  };

  const ensureAssetSfx = () => {
    if (assetSfxRef.current) return assetSfxRef.current;
    const mk = (srcs: string[], baseVol: number) => {
      const def = { srcs, pool: [] as HTMLAudioElement[], idx: 0, ok: true, baseVol };
      // Two voices per src so rapid taps still overlap cleanly.
      for (const src of srcs) {
        for (let i = 0; i < 2; i++) {
          const a = new Audio();
          a.preload = "auto";
          a.src = src;
          a.volume = 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (a as any).playsInline = true;
          a.addEventListener("error", () => {
            def.ok = false;
          });
          def.pool.push(a);
        }
      }
      return def;
    };

    assetSfxRef.current = {
      defs: {
        giftOpen: mk(["/sfx/gift_open.mp3"], 0.95),
        lootTap: mk(["/sfx/loot_tap_1.mp3", "/sfx/loot_tap_2.mp3", "/sfx/loot_tap_3.mp3"], 0.95),
        lootJackpot: mk(["/sfx/loot_jackpot.mp3"], 1.0),
        victory: mk(["/easter/victory.mp3"], 1.0),
      },
    };
    return assetSfxRef.current;
  };

  const playAssetSfx = (key: "giftOpen" | "lootTap" | "lootJackpot" | "victory", intensity = 1) => {
    if (!state.settings.sound) return false;
    const store = ensureAssetSfx();
    const def = store.defs[key];
    if (!def || !def.ok || def.pool.length === 0) return false;
    const el = def.pool[def.idx++ % def.pool.length];
    try {
      el.currentTime = 0;
      el.volume = Math.max(0, Math.min(1, def.baseVol * Math.max(0.25, Math.min(1, intensity))));
      const p = el.play();
      if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {});
      return true;
    } catch {
      return false;
    }
  };

  const musicStop = () => {
    const m = musicRef.current;
    if (!m) return;
    for (const el of [m.a, m.b]) {
      try {
        el.pause();
        el.volume = 0;
      } catch {
        // ignore
      }
    }
    m.track = null;
  };

  const endStop = () => {
    try {
      if (!endRef.current) return;
      endRef.current.pause();
      endRef.current.currentTime = 0;
    } catch {
      // ignore
    }
  };

  const endPlayOnce = async () => {
    if (!state.settings.sound) return;
    if (endPlayedRef.current) return;
    endPlayedRef.current = true;
    // Make the ending feel like a true “final track”: stop loops underneath.
    musicStop();
    victoryStop();
    sfx.setRageHold(false);
    try {
      const a = endRef.current ?? new Audio();
      a.loop = false;
      a.preload = "auto";
      a.src = MUSIC_END;
      a.volume = 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a as any).playsInline = true;
      endRef.current = a;
      a.currentTime = 0;
      await a.play();
    } catch {
      // If blocked by browser policy, ignore.
    }
  };

  const victoryEnsure = () => {
    if (victoryRef.current) return victoryRef.current;
    const a = new Audio();
    a.loop = false;
    a.preload = "auto";
    a.src = MUSIC_VICTORY;
    a.volume = 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a as any).playsInline = true;
    a.addEventListener("loadedmetadata", () => {
      const ms = Math.round((a.duration || 7.2) * 1000);
      if (Number.isFinite(ms) && ms > 1000) setVictoryHoldMs(Math.max(2200, Math.min(20_000, ms)));
    });
    victoryRef.current = a;
    return a;
  };

  const victoryStop = () => {
    try {
      const a = victoryRef.current;
      if (!a) return;
      a.pause();
      a.currentTime = 0;
    } catch {
      // ignore
    }
  };

  const victoryPlay = async () => {
    if (!state.settings.sound) return;
    try {
      const a = victoryEnsure();
      a.currentTime = 0;
      a.volume = 1;
      await a.play();
    } catch {
      // ignore
    }
  };

  const musicSetExclusiveVolume = (vol: number) => {
    const m = ensureMusic();
    try {
      m.a.volume = 0;
      m.b.volume = 0;
      m[m.active].volume = Math.max(0, Math.min(1, vol));
    } catch {
      // ignore
    }
  };

  const musicRaiseToTarget = () => {
    const m = ensureMusic();
    musicSetExclusiveVolume(m.target);
  };

  const musicPrime = async (track: "xmas" | "post" | "metal" | "rockxmas" | "acdc" | "slappa") => {
    if (!state.settings.sound) return;
    const src =
      track === "xmas"
        ? MUSIC_XMAS
        : track === "metal"
          ? MUSIC_EMPTY
          : track === "rockxmas"
            ? MUSIC_ROCK_XMAS
            : track === "acdc"
              ? MUSIC_ACDC
              : track === "slappa"
                ? MUSIC_SLAPPA
                : MUSIC_POST_HIJACK;
    const m = ensureMusic();
    m.target = trackTargetVol(track);
    const nextKey: "a" | "b" = m.active === "a" ? "b" : "a";
    const next = m[nextKey];
    try {
      if (next.src !== src) next.src = src;
      next.loop = true;
      next.preload = "auto";
      next.volume = 0;
      next.currentTime = 0;
      await next.play();
      // Make the primed track the active one for the next reveal.
      m.active = nextKey;
      m.track = src;
    } catch {
      // If play is blocked, just keep current bed; the game still works.
    }
  };

  const musicPlay = async (track: "xmas" | "post" | "metal" | "rockxmas" | "acdc" | "slappa", hardCut = false) => {
    if (!state.settings.sound) return;
    const src =
      track === "xmas"
        ? MUSIC_XMAS
        : track === "metal"
          ? MUSIC_EMPTY
          : track === "rockxmas"
            ? MUSIC_ROCK_XMAS
            : track === "acdc"
              ? MUSIC_ACDC
              : track === "slappa"
                ? MUSIC_SLAPPA
            : MUSIC_POST_HIJACK;
    const m = ensureMusic();
    if (m.track === src) return;
    m.target = trackTargetVol(track);

    const nextKey: "a" | "b" = m.active === "a" ? "b" : "a";
    const cur = m[m.active];
    const next = m[nextKey];
    m.track = src;

    try {
      if (next.src !== src) next.src = src;
      next.currentTime = 0;
      next.volume = 0;
      await next.play();
    } catch {
      // If play is blocked, user gesture didn’t reach here; ignore.
      return;
    }

    const dur = hardCut ? 220 : 650;
    const t0 = performance.now();
    const startCur = cur.volume;
    const raf = () => {
      const t = Math.min(1, (performance.now() - t0) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      next.volume = m.target * ease;
      cur.volume = startCur * (1 - ease);
      if (t < 1) {
        requestAnimationFrame(raf);
      } else {
        // Keep the old track playing at zero volume so we can switch back later
        // without needing a new user gesture (important for timed overlays).
        cur.volume = 0;
        m.active = nextKey;
      }
    };
    requestAnimationFrame(raf);
  };

  const musicDuck = (ms: number, target = 0.18) => {
    const m = musicRef.current;
    if (!m) return;
    const a0 = m.a.volume;
    const b0 = m.b.volume;
    const t0 = performance.now();
    const downMs = 140;
    const upMs = 420;
    const holdMs = Math.max(0, ms - downMs - upMs);
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      const dt = performance.now() - t0;
      let k = 0;
      if (dt <= downMs) {
        k = clamp01(dt / downMs);
        // ease out
        k = 1 - Math.pow(1 - k, 3);
        m.a.volume = lerp(a0, Math.min(a0, target), k);
        m.b.volume = lerp(b0, Math.min(b0, target), k);
      } else if (dt <= downMs + holdMs) {
        m.a.volume = Math.min(a0, target);
        m.b.volume = Math.min(b0, target);
      } else if (dt <= downMs + holdMs + upMs) {
        k = clamp01((dt - downMs - holdMs) / upMs);
        // ease in
        k = k * k;
        m.a.volume = lerp(Math.min(a0, target), a0, k);
        m.b.volume = lerp(Math.min(b0, target), b0, k);
      } else {
        m.a.volume = a0;
        m.b.volume = b0;
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const preloadEaster = () => {
    if (preloadOnceRef.current) return;
    preloadOnceRef.current = true;
    try {
      const imgs = [
        "/easter/fixer.webp",
        "/easter/angus.gif",
        "/easter/slappa.jpeg",
        "/easter/daughter.webp",
        "/easter/snow.jpg",
        "/easter/sow.jpg",
      ];
      for (const src of imgs) {
        const im = new Image();
        im.decoding = "async";
        im.src = src;
      }

      // Optional asset SFX (if you add files under public/sfx/)
      // We preload so the first tap doesn't feel delayed on iOS.
      const aud = [
        "/sfx/gift_open.mp3",
        "/sfx/loot_tap_1.mp3",
        "/sfx/loot_tap_2.mp3",
        "/sfx/loot_tap_3.mp3",
        "/sfx/loot_jackpot.mp3",
        "/easter/victory.mp3",
        "/easter/rockxmas.mp3",
        "/easter/acdc.mp3",
        "/easter/slappa.mp3",
        "/easter/end.mp3",
      ];
      for (const src of aud) {
        const a = new Audio();
        a.preload = "auto";
        a.src = src;
        try {
          a.load();
        } catch {
          // ignore
        }
      }
                  } catch {
      // ignore
    }
  };
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      if (handoffTimerRef.current) window.clearTimeout(handoffTimerRef.current);
      if (rewardTimerRef.current) window.clearTimeout(rewardTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (stage !== "reward") return;
    // Let it breathe as a celebration, but allow skip.
    if (rewardTimerRef.current) window.clearTimeout(rewardTimerRef.current);
    rewardTimerRef.current = window.setTimeout(() => setState((s) => ({ ...s, stage: "final" })), state.settings.reduceMotion ? 1200 : 12_500);
    return () => {
      if (rewardTimerRef.current) window.clearTimeout(rewardTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, state.settings.reduceMotion]);

  useEffect(() => {
    document.body.dataset.stage = stage;
    // Keep CSS “drama” ramps scoped to terminal.
    if (stage !== "terminal") {
      document.documentElement.style.setProperty("--drama", "0");
      delete document.body.dataset.termPhase;
      delete document.body.dataset.termRoom;
      delete document.body.dataset.termRoomIdx;
    }
    return () => {
      // Keep it clean if the component unmounts
      delete document.body.dataset.stage;
    };
  }, [stage]);

  useEffect(() => {
    document.documentElement.style.setProperty("--rage", rageHold && stage === "terminal" ? "1" : "0");
  }, [rageHold, stage]);

  const [victory, setVictory] = useState(false);

  useEffect(() => {
    // Keep music in sync with sound toggle.
    if (!state.settings.sound) {
      musicStop();
      endStop();
      victoryStop();
      if (roomWinAudioTimerRef.current) window.clearTimeout(roomWinAudioTimerRef.current);
      endPlayedRef.current = false;
      sfx.setRageHold(false);
      return;
    }
    // If sound is enabled, do not autoplay; wait for user gesture via IntroLetter/Present events.
    // (musicPlay is called from those handlers).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.settings.sound]);

  useEffect(() => {
    // Reset the “end track played” marker when restarting a run.
    if (stage === "note" || !victory) {
      endPlayedRef.current = false;
      endStop();
      victoryStop();
      if (roomWinAudioTimerRef.current) window.clearTimeout(roomWinAudioTimerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, victory]);

  useEffect(() => {
    // Reward screen: play end.mp3 exactly once (right after the last correct answer flow).
    if (stage === "reward" && victory) {
      void endPlayOnce();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, victory]);

    return (
    <>
      <canvas id="snow" aria-hidden="true" ref={snowRef} />
      <canvas id="debris" aria-hidden="true" ref={debrisRef} />
      <div className="snowSparkle" aria-hidden="true" />
      <div className="festiveOverlay" aria-hidden="true">
        <svg className="festiveOverlay__svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          {/* Top garland wire */}
          <path
            className="festiveWire"
            d="M0 120 C 160 70, 320 170, 500 120 C 700 70, 840 170, 1000 120"
            fill="none"
          />

          {/* Garland leaves */}
          <path
            className="festiveGarland"
            d="M0 138 C 120 110, 220 156, 330 132 C 430 114, 540 164, 650 132 C 760 100, 860 160, 1000 132 L1000 172 L0 172 Z"
          />

          {/* Bulbs */}
          <g className="festiveBulbs">
            <circle className="festiveBulb festiveBulb--r" cx="80" cy="128" r="10" />
            <circle className="festiveBulb festiveBulb--g" cx="150" cy="110" r="9" />
            <circle className="festiveBulb festiveBulb--y" cx="230" cy="142" r="10" />
            <circle className="festiveBulb festiveBulb--b" cx="310" cy="122" r="9" />
            <circle className="festiveBulb festiveBulb--r" cx="390" cy="112" r="10" />
            <circle className="festiveBulb festiveBulb--g" cx="470" cy="142" r="9" />
            <circle className="festiveBulb festiveBulb--y" cx="550" cy="122" r="10" />
            <circle className="festiveBulb festiveBulb--b" cx="630" cy="110" r="9" />
            <circle className="festiveBulb festiveBulb--r" cx="710" cy="140" r="10" />
            <circle className="festiveBulb festiveBulb--g" cx="790" cy="122" r="9" />
            <circle className="festiveBulb festiveBulb--y" cx="870" cy="110" r="10" />
            <circle className="festiveBulb festiveBulb--b" cx="940" cy="132" r="9" />
          </g>

          {/* Corner holly */}
          <g className="festiveHolly">
            <path className="festiveLeaf" d="M58 212 C 44 188, 56 162, 86 156 C 104 153, 122 162, 128 176 C 114 182, 98 190, 82 210 Z" />
            <path className="festiveLeaf" d="M162 190 C 144 176, 142 152, 162 138 C 176 128, 200 128, 214 138 C 206 152, 196 170, 170 192 Z" />
            <circle className="festiveBerry" cx="130" cy="196" r="8" />
            <circle className="festiveBerry" cx="148" cy="202" r="6.2" />
            <circle className="festiveBerry" cx="140" cy="182" r="5.6" />

            <g transform="translate(1000 0) scale(-1 1)">
              <path className="festiveLeaf" d="M58 212 C 44 188, 56 162, 86 156 C 104 153, 122 162, 128 176 C 114 182, 98 190, 82 210 Z" />
              <path className="festiveLeaf" d="M162 190 C 144 176, 142 152, 162 138 C 176 128, 200 128, 214 138 C 206 152, 196 170, 170 192 Z" />
              <circle className="festiveBerry" cx="130" cy="196" r="8" />
              <circle className="festiveBerry" cx="148" cy="202" r="6.2" />
              <circle className="festiveBerry" cx="140" cy="182" r="5.6" />
            </g>
          </g>
        </svg>
                </div>
      <div className="crt" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />
      <div className="cornerMark" aria-hidden="true">
        THE ESTATE
                </div>

      <AnimatePresence>
        {settingsOpen ? (
          <motion.div
            className="modalOverlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="modalPanel"
              initial={{ y: 10, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 10, scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.16 }}
              role="dialog"
              aria-label="Options"
            >
              <div className="modalPanel__title">Options</div>

              <label className="settingsRow">
                <span className="settingsRow__label">Reduce motion</span>
                    <input
                  type="checkbox"
                  checked={state.settings.reduceMotion}
                  onChange={(e) =>
                    setState((s) => ({ ...s, settings: { ...s.settings, reduceMotion: e.target.checked } }))
                  }
                />
              </label>

              <label className="settingsRow">
                <span className="settingsRow__label">High contrast</span>
                <input
                  type="checkbox"
                  checked={state.settings.highContrast}
                  onChange={(e) =>
                    setState((s) => ({ ...s, settings: { ...s.settings, highContrast: e.target.checked } }))
                  }
                />
              </label>

              <div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
                    <button
                  className="btn btn--danger"
                      type="button"
                      onClick={() => {
                    setSettingsOpen(false);
                    setVictory(false);
                    setHijacked(false);
                    sfx.reset();
                    sfx.setRageHold(false);
                    musicStop();
                    endStop();
                    victoryStop();
                    if (state.settings.sound) void musicPlay("xmas", true);
                    setState((s) => ({ ...s, stage: "note" }));
                  }}
                >
                  Start over
                    </button>
              <button
                  className="btn btn--ghost"
                type="button"
                  onClick={() => {
                    sfx.tick();
                    setSettingsOpen(false);
                  }}
                >
                  Done
              </button>
        </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="scene" aria-live="polite">
        <AnimatePresence>
          {handoff ? (
            <motion.div
              className="handoffOverlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: state.settings.reduceMotion ? 0.01 : 0.22 }}
              aria-hidden="true"
            >
              <motion.div
                className="handoffOverlay__panel"
                initial={{ opacity: 0, y: 10, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.99 }}
                transition={{ duration: state.settings.reduceMotion ? 0.01 : 0.22 }}
              >
                <div className="handoffOverlay__k">SIGNAL DIVERT</div>
                <div className="handoffOverlay__t">ESTATE LINK ENGAGED</div>
                <div className="handoffOverlay__s">Pulling you into the access panel…</div>
                <div className="handoffOverlay__bar">
                  <div className="handoffOverlay__barFill" />
      </div>
              </motion.div>
              <div className="handoffOverlay__noise" />
              <div className="handoffOverlay__grid" />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="focusWrap">
          <AnimatePresence mode="wait">
            {stage === "note" ? (
              <motion.div
                key="note"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: state.settings.reduceMotion ? 0.01 : 0.28 }}
              >
                <IntroLetter
                  onFirstGesture={() => {
                    // Autoplay rules: we can only actually start audio after a user gesture.
                    // This makes the note screen feel “alive” immediately (even before seal break).
                    preloadEaster();
                    sfx.primeOn();
                    void musicPlay("xmas");
                  }}
                  onSealBreak={() => {
                    // First user gesture: ensure sound is on and start happy music.
                    setState((s) => ({ ...s, settings: { ...s.settings, sound: true } }));
                    preloadEaster();
                    sfx.primeOn();
                    void musicPlay("xmas");
                    sfx.tick();
                  }}
                  onPageTurn={() => sfx.pageTurn()}
                  onUiTap={() => sfx.tick()}
                  onBegin={() => {
                    // Loot-box "open" hit (asset SFX if present, otherwise procedural).
                    // Let the open SFX fully dominate; keep bed effectively paused (but still "playing" for iOS).
                    musicDuck(900, 0.0);
                    const ok = playAssetSfx("giftOpen", 1);
                    if (!ok) sfx.begin();
                    // Present tapping phase: NO background music, only loud loot-box hits.
                    musicStop();
                    setVictory(false);
                    setHijacked(false);
                    setState((s) => ({ ...s, stage: "present" }));
                  }}
                />
              </motion.div>
            ) : null}

            {stage === "present" ? (
              <motion.div
                key="present"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: state.settings.reduceMotion ? 0.01 : 0.28 }}
              >
          <div className="vaultCard">
                  <PresentBox
                    reduceMotion={state.settings.reduceMotion}
                    onOpened={() => {
                      // Present opened: satisfying hit, but DO NOT use victory.mp3 (reserved for correct answers + final win).
                      musicDuck(620, 0.12);
                      sfx.success();
                      setHandoff(true);
                      setState((s) => ({ ...s, stage: "terminal" }));
                      if (handoffTimerRef.current) window.clearTimeout(handoffTimerRef.current);
                      handoffTimerRef.current = window.setTimeout(() => setHandoff(false), state.settings.reduceMotion ? 1 : 1650);
                    }}
                    onEmptyBeat={() => {
                      if (!state.settings.sound) return;
                      // Box opened… and it's empty. Hard switch to the Metal Gear beat.
                      void musicPlay("metal", true);
                    }}
                    onClick={() => sfx.tick()}
                    onTapLoot={({ progress, finalTap }) => {
                      // Gift tapping: SFX must be louder than the music.
                      // Duck the bed to (near) silence on every tap, then it rises back when tapping stops.
                      musicDuck(finalTap ? 1400 : 260, 0.0);
                      if (finalTap) {
                        const ok = playAssetSfx("lootJackpot", 1);
                        if (!ok) sfx.lootJackpot();
                      } else {
                        const ok = playAssetSfx("lootTap", 0.7 + 0.45 * progress);
                        if (!ok) sfx.lootTap(progress);
                      }
                    }}
                    onHackBeat={() => {
                      // This is the “hijack” moment: make the music flip hard and feel intense.
                      setHijacked(true);
                      sfx.hackGlitch();
                      void musicPlay("post", true);
                    }}
                    onWink={() => sfx.tick()}
                  />
          </div>
              </motion.div>
            ) : null}

            {stage === "terminal" ? (
              <motion.div
                key="terminal"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: state.settings.reduceMotion ? 0.01 : 0.28 }}
              >
          <div className="vaultCard">
                  <TerminalReveal
                    code={REVEAL_CODE}
                    reduceMotion={state.settings.reduceMotion}
                    winHoldMs={victoryHoldMs}
                    roomWinHoldMs={state.settings.reduceMotion ? 600 : 3400}
                    onRoomChange={(idx, qid) => {
                      if (stage !== "terminal") return;
                      document.body.dataset.termRoom = qid;
                      document.body.dataset.termRoomIdx = String(idx + 1);
                    }}
                    onCopy={() => sfx.tick()}
                    onTap={() => sfx.lootTap(Math.min(1, terminalDrama))}
                    onSlappa={(on) => {
                      if (!state.settings.sound) return;
                      void musicPlay(on ? "xmas" : "post", true);
                    }}
                    onRiddleOk={(idx, qid) => {
                      // Special stingers
                      if (qid === "R05") sfx.acdcHit();
                      sfx.roomOk(idx + 1);
                      setRageHold(false);
                      sfx.setRageHold(false);
                    }}
                    onRoomWinStart={(idx) => {
                      // Per-room “green win” moment:
                      // - ONLY ONE song audible: play victory.mp3 exclusively
                      // - Prime the NEXT room's bed during this user gesture so iOS allows it
                      // - When the green overlay ends, fade back up to the bed (no overlap)
                      if (!state.settings.sound) return;
                      const hold = state.settings.reduceMotion ? 1 : 3400;

                      // Stop bed audibly (keep it paused/quiet).
                      musicSetExclusiveVolume(0);

                      // Ensure victory plays now (this callback is inside the submit click/Enter gesture).
                      void victoryPlay();

                      // Decide the next bed for the upcoming room index.
                      // idx is 0-based current room; next room is idx+1.
                      const nextIdx = idx + 1;
                      const nextTrack = nextIdx === 3 ? "rockxmas" : nextIdx === 4 ? "acdc" : nextIdx === 5 ? "slappa" : hijacked ? "post" : "xmas";
                      void musicPrime(nextTrack);

                      if (roomWinAudioTimerRef.current) window.clearTimeout(roomWinAudioTimerRef.current);
                      roomWinAudioTimerRef.current = window.setTimeout(() => {
                        // End the victory song snippet and bring the bed up for the next room.
                        victoryStop();
                        musicRaiseToTarget();
                      }, hold);
                    }}
                    onWrong={() => {
                      musicDuck(1100, 0.06);
                      sfx.wrong();
                      sfx.rage();
                      setRageHold(true);
                      sfx.setRageHold(true);
                    }}
                    onBoot={() => sfx.tick()}
                    onWinStart={() => {
                      // Big dopamine moment: switch soundtrack to epic immediately, but hold the win screen.
                      setVictory(true);
                      // Stop looping beds and play the full victory track under the green screen.
                      musicStop();
                      sfx.setRageHold(false);
                      void victoryPlay();
                    }}
                    onComplete={() => {
                      setState((s) => ({ ...s, stage: "reward" }));
                    }}
                    onProgress={(idx, total) => {
                      if (stage !== "terminal") return;
                      const t = total <= 1 ? 0 : idx / (total - 1);
                      setTerminalDrama(t);
                      document.documentElement.style.setProperty("--drama", t.toFixed(3));

                      // 3-phase arc:
                      // - calm/relaxing: early rooms
                      // - fun: mid rooms
                      // - intense: ONLY last 2 rooms
                      const lastTwoStart = Math.max(0, total - 2);
                      const phase = idx < 4 ? 0 : idx < lastTwoStart ? 1 : 2;
                      document.body.dataset.termPhase = String(phase);
                    }}
                  />
      </div>
              </motion.div>
            ) : null}

            {stage === "reward" ? (
              <motion.div
                key="reward"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: state.settings.reduceMotion ? 0.01 : 0.28 }}
              >
                <div className="vaultCard rewardScene" role="group" aria-label="Celebration">
                  <div className="rewardSteam" aria-hidden="true" />
                  <div className="rewardValves" aria-hidden="true">
                    <span className="rewardValve rewardValve--a" />
                    <span className="rewardValve rewardValve--b" />
                    <span className="rewardValve rewardValve--c" />
            </div>
                  <div className="whisperRain" aria-hidden="true">
                    {Array.from({ length: state.settings.reduceMotion ? 0 : 14 }).map((_, i) => {
                      const phrases = ["steam…", "shh…", "there’s a valve for that", "steamy steamy…"];
                      const txt = phrases[i % phrases.length];
                return (
                        <span
                          key={i}
                          className="whisperRain__t"
                          style={
                            {
                              ["--i" as never]: i,
                              ["--x" as never]: `${(i * 19) % 100}%`,
                              ["--d" as never]: `${(i * 0.65) % 7.5}s`,
                              ["--dur" as never]: `${9.5 + (i % 6) * 1.35}s`,
                            } as React.CSSProperties
                          }
                        >
                          {txt}
                        </span>
                );
              })}
          </div>

                  <div className="rewardScene__kicker">ACCESS GRANTED</div>
                  <div className="rewardScene__title">Merry Christmas</div>
                  <div className="rewardScene__sub">Rooms unlocked. The Estate smiles.</div>

                  <div className="rewardScene__panel">
                    <div className="rewardScene__line">
                      <span className="rewardTag">KEY</span>
                      <span className="rewardValue">THE ESTATE</span>
        </div>
                    <div className="rewardScene__line">
                      <span className="rewardTag">CODE</span>
                      <span className="rewardValue">{REVEAL_CODE}</span>
                </div>
                  </div>

                  <div className="rewardScene__mystery">Now… where does it go?</div>
                  <div className="rewardScene__tiny">The blue book knows.</div>

                    <button
                    className="btn btn--primary rewardScene__btn"
                      type="button"
                    onClick={() => setState((s) => ({ ...s, stage: "final" }))}
                  >
                    Reveal the code screen
                    </button>

                  <div className="rewardConfetti" aria-hidden="true">
                    {Array.from({ length: state.settings.reduceMotion ? 80 : 220 }).map((_, i) => (
                      <span
                        key={i}
                        className={`rewardConfetti__p ${i % 9 === 0 ? "rewardConfetti__p--domino" : ""}`}
                        style={{ ["--i" as never]: i } as React.CSSProperties}
                      />
                    ))}
                  </div>
                  </div>
              </motion.div>
        ) : null}

            {stage === "final" ? (
          <motion.div
                key="final"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: state.settings.reduceMotion ? 0.01 : 0.28 }}
              >
                <div className="vaultCard finalScene" role="group" aria-label="Final reveal">
                  <div className="finalScene__kicker">Merry Christmas</div>
                  <div className="finalScene__title">Your code</div>
                  <div className="finalScene__code" aria-label="Code">
                    {REVEAL_CODE}
              </div>
                  <div className="finalDominos" aria-hidden="true">
                    <span className="finalDomino finalDomino--a" />
                    <span className="finalDomino finalDomino--b" />
                  </div>
                  <div className="finalScene__actions">
                <button
                  className="btn btn--primary iconBtn"
                type="button"
                onClick={async () => {
                  try {
                          await navigator.clipboard.writeText(REVEAL_CODE);
                          sfx.tick();
                          setCopied(true);
                          if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
                          copiedTimerRef.current = window.setTimeout(() => setCopied(false), 900);
                  } catch {
                          // ignore
                  }
                }}
              >
                      <Copy className="icon" aria-hidden="true" />
                      Copy
              </button>
                    <button
                      className="btn btn--ghost"
                  type="button"
                  onClick={() => {
                        setVictory(false);
                        setState((s) => ({ ...s, stage: "note" }));
                  }}
                >
                      Start over
                </button>
              </div>
      <AnimatePresence>
                    {copied ? (
          <motion.div
                        className="toast"
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: state.settings.reduceMotion ? 0.01 : 0.18 }}
                        aria-live="polite"
                      >
                        Copied
            </motion.div>
                    ) : null}
                  </AnimatePresence>
                  </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
        </div>
      </main>

      {showBottomBar ? (
        <footer className="bottomBar" role="group" aria-label="Controls">
          <div className="bottomBar__inner">
                <button
            className="bottomBtn"
                  type="button"
            aria-label={state.settings.sound ? "Sound on" : "Sound off"}
            title={state.settings.sound ? "Sound on" : "Sound off"}
                  onClick={() => {
              sfx.tick();
              const enabling = !state.settings.sound;
              setState((s) => ({ ...s, settings: { ...s.settings, sound: !s.settings.sound } }));
              if (enabling) {
                sfx.primeOn();
                // Kick music immediately on the same gesture.
                // Present tapping phase intentionally has NO background music.
                if (stage !== "present" || hijacked) {
                  void musicPlay(hijacked ? "post" : "xmas", true);
                }
              } else {
                musicStop();
                sfx.setRageHold(false);
              }
            }}
          >
            {state.settings.sound ? <Volume2 className="icon" aria-hidden="true" /> : <VolumeX className="icon" aria-hidden="true" />}
            <span className="bottomBtn__label">{state.settings.sound ? "Sound" : "Muted"}</span>
                </button>

                <button
              className="bottomBtn bottomBtn--ghost"
                  type="button"
              aria-label="Restart"
              title="Restart"
                  onClick={() => {
                // Take control back: hard reset to the letter without relying on browser reload.
                setSettingsOpen(false);
                setVictory(false);
                setHijacked(false);
                setRageHold(false);
                sfx.reset();
                sfx.setRageHold(false);
                musicStop();
                endStop();
                victoryStop();
                if (state.settings.sound) void musicPlay("xmas", true);
                setState((s) => ({ ...s, stage: "note" }));
              }}
            >
              <RotateCcw className="icon" aria-hidden="true" />
              <span className="bottomBtn__label">Restart</span>
                </button>

          {showOptionsInBar ? (
                <button
              className="bottomBtn bottomBtn--ghost"
                  type="button"
              aria-label="Options"
              title="Options"
                  onClick={() => {
                sfx.tick();
                setSettingsOpen(true);
                  }}
                >
              <Settings2 className="icon" aria-hidden="true" />
              <span className="bottomBtn__label">Options</span>
                </button>
          ) : null}
              </div>
        </footer>
        ) : null}
    </>
  );
}


