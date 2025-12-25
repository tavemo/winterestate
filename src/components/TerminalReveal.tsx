import { AnimatePresence, motion } from "framer-motion";
import { Terminal } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  code: string;
  reduceMotion: boolean;
  winHoldMs?: number;
  roomWinHoldMs?: number;
  onRoomWinStart?: (idx: number, qid: string) => void;
  onRoomWinEnd?: (idx: number, qid: string, early: boolean) => void;
  onRoomChange?: (idx: number, qid: string) => void;
  onBoot?: () => void;
  onCopy?: () => void;
  onTap?: () => void;
  onSlappa?: (on: boolean) => void;
  onRiddleOk?: (idx: number, qid: string) => void;
  onWrong?: () => void;
  onWinStart?: () => void;
  onComplete?: () => void;
  onProgress?: (idx: number, total: number) => void;
};

const KEY_PHRASE = "THE ESTATE";
const EGG_KEY = "egg_daughter_seen_v1";
const CINE_KEY = "cine_boot_seen_v1";
const TITLE_KEY = "term_title_seen_v1";
const EGG_SRC = "/easter/daughter.webp";
const baseUrl = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
const asset = (p: string) => `${baseUrl}${p.replace(/^\//, "")}`;
const FIXER_SRC = asset("/easter/fixer.webp");
const ANGUS_SRC = asset("/easter/angus.gif");
// User-supplied Q4 photos (SNOW vs SOW)
const Q4_A_SRC = asset("/easter/snow.jpg");
const Q4_B_SRC = asset("/easter/sow.jpg");
// File lives under public/easter/November 23, 2025/
const BELLA_SRC = asset("/easter/November%2023%2C%202025/6405B5B7-1368-4516-8CD2-54DBCE81F180.mov");
const SLAPPA_SRC = asset("/easter/slappa.jpeg");

function useTypewriter(lines: string[], speedMs: number, enabled: boolean) {
  const [out, setOut] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const idxRef = useRef(0);

  useEffect(() => {
    setOut([]);
    setDone(false);
    idxRef.current = 0;
    if (!enabled || speedMs === 0) {
      setOut(lines);
      setDone(true);
      return;
    }
    const t = window.setInterval(() => {
      idxRef.current += 1;
      setOut(lines.slice(0, idxRef.current));
      if (idxRef.current >= lines.length) {
        window.clearInterval(t);
        setDone(true);
      }
    }, speedMs);
    return () => window.clearInterval(t);
  }, [enabled, lines, speedMs]);

  return { out, done };
}

type Question =
  | {
      kind: "text";
      id: string;
      room: string;
      q: string;
      a: string | string[];
      placeholder?: string;
      showAngus?: boolean;
      hintLadder: string[];
    }
  | {
      kind: "mcq";
      id: string;
      room: string;
      q: string;
      options: string[];
      answerIndex: number;
      showFixer?: boolean;
      hintLadder: string[];
    }
  | { kind: "bp_extra_letter"; id: string; room: string; q: string; answer: string; hintLadder: string[] };

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeForCompare(s: string) {
  return normalize(s).replace(/[^a-z0-9 ]/g, "");
}

function renderTermLine(line: string) {
  if (!line) return <span className="terminalLine__dim"> </span>;
  const idx = line.indexOf(":");
  if (idx === -1) return <span className="termText">{line}</span>;
  const tag = line.slice(0, idx).trim();
  const rest = line.slice(idx + 1).trimStart();
  const up = tag.toUpperCase();
  const kind =
    up.includes("ERROR") || up.includes("DENIED")
      ? "bad"
      : up.includes("STATUS") || up.includes("READY") || up.includes("OK")
        ? "ok"
        : up.includes("OVERRIDE") || up.includes("REMOTE")
          ? "warn"
          : "info";
  return (
    <>
      <span className={`termTag termTag--${kind}`}>{tag}:</span>
      <span className="termText">{rest}</span>
    </>
  );
}

function QuestionWidget({ qid, reduceMotion }: { qid: string; reduceMotion: boolean }) {
  const [spin, setSpin] = useState(0);
  const [flip, setFlip] = useState(0);
  const [tempo, setTempo] = useState(0);
  return (
    <div className="qWidget">
      {qid === "R01" ? (
        <svg className="qSvg" viewBox="0 0 220 96">
          <rect x="12" y="14" width="196" height="68" rx="18" fill="rgba(7,18,26,0.35)" stroke="rgba(103,211,255,0.18)" />
          {/* A foggy “window” vibe (not literal steam) */}
          <path className="fogSweep" d="M26 58 C46 44, 68 48, 92 36 C116 24, 142 28, 168 18" />
          <path className="fogSweep fogSweep--d2" d="M30 72 C56 60, 78 64, 102 52 C130 38, 154 44, 192 34" />
          <rect x="22" y="22" width="186" height="52" rx="14" fill="rgba(216,246,255,0.04)" />
        </svg>
      ) : null}

      {qid === "R02" ? (
        <svg className="qSvg" viewBox="0 0 220 96">
          <rect x="12" y="14" width="196" height="68" rx="18" fill="rgba(7,18,26,0.28)" stroke="rgba(255,215,122,0.16)" />
          {/* “Silent bright night” vibe (no snowflake icon) */}
          <circle cx="158" cy="36" r="12" fill="rgba(255,215,122,0.12)" stroke="rgba(255,215,122,0.28)" />
          <circle className="nightGlow" cx="158" cy="36" r="20" />
          {Array.from({ length: 12 }).map((_, i) => (
            <circle
              key={i}
              className="nightStar"
              cx={26 + (i * 14) % 170}
              cy={24 + ((i * 19) % 46)}
              r={1.8}
            />
          ))}
        </svg>
      ) : null}

      {qid === "R03" ? (
        <div className="qCard">
          <svg className={`qSvg qSvg--drift${spin % 2}`} viewBox="0 0 220 96" role="img" aria-label="A small map diagram">
            <rect x="12" y="12" width="196" height="72" rx="18" fill="rgba(7,18,26,0.28)" stroke="rgba(103,211,255,0.18)" />

            {/* Tiny compass */}
            <circle cx="38" cy="34" r="14" fill="rgba(0,0,0,0.20)" stroke="rgba(255,215,122,0.18)" />
            <path d="M38 20 L42 34 L38 48 L34 34 Z" fill="rgba(255,215,122,0.22)" />
            <text x="38" y="18" textAnchor="middle" fontSize="8" fill="rgba(216,246,255,0.75)" fontFamily="var(--mono)">
              N
            </text>
            <text x="54" y="37" textAnchor="middle" fontSize="8" fill="rgba(216,246,255,0.55)" fontFamily="var(--mono)">
              E
            </text>

            {/* Stairwell center */}
            <rect x="100" y="40" width="20" height="16" rx="4" fill="rgba(216,246,255,0.10)" stroke="rgba(216,246,255,0.22)" />
            <text x="110" y="52" textAnchor="middle" fontSize="8" fill="rgba(216,246,255,0.8)" fontFamily="var(--mono)">
              S
            </text>

            {/* Library east of stairwell */}
            <rect x="132" y="40" width="28" height="16" rx="4" fill="rgba(103,211,255,0.10)" stroke="rgba(103,211,255,0.35)" />
            <text x="146" y="52" textAnchor="middle" fontSize="8" fill="rgba(103,211,255,0.85)" fontFamily="var(--mono)">
              LIB
            </text>
            <path d="M121 48 L131 48" stroke="rgba(103,211,255,0.45)" strokeWidth="2" strokeLinecap="round" />
            <path d="M129 44 L133 48 L129 52" fill="none" stroke="rgba(103,211,255,0.45)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {/* Greenhouse north of library */}
            <rect x="132" y="20" width="28" height="16" rx="4" fill="rgba(31,143,84,0.10)" stroke="rgba(31,143,84,0.32)" />
            <text x="146" y="32" textAnchor="middle" fontSize="8" fill="rgba(31,255,140,0.78)" fontFamily="var(--mono)">
              GRN
            </text>
            <path d="M146 38 L146 36" stroke="rgba(31,255,140,0.4)" strokeWidth="2" strokeLinecap="round" />

            {/* Gallery opposite greenhouse => unknown location marked as ? */}
            <rect x="68" y="60" width="28" height="16" rx="4" fill="rgba(255,215,122,0.06)" stroke="rgba(255,215,122,0.22)" />
            <text x="82" y="72" textAnchor="middle" fontSize="9" fill="rgba(255,215,122,0.9)" fontFamily="var(--mono)">
              ?
            </text>
            <path
              d="M132 22 C110 30, 96 42, 90 62"
              fill="none"
              stroke="rgba(255,215,122,0.22)"
              strokeWidth="2"
              strokeDasharray="3 3"
              strokeLinecap="round"
            />
          </svg>
          <div className="qTiny">Use the plaques. Choose a direction.</div>
        </div>
      ) : null}

      {qid === "R04" ? (
        <div className="qCard">
          <div className="qTiny">two paintings</div>
          <div className="qDots" />
        </div>
      ) : null}

      {qid === "R05" ? (
        <button className="qCardBtn" type="button" onClick={() => setSpin((n) => n + 1)} aria-label="Equalizer">
          <div className={`qCard qEq qEq--m${spin % 3}`}>
            <div className="qTiny">equalizer</div>
            <div className="qEq__bars" aria-hidden="true">
              {Array.from({ length: 14 }).map((_, i) => (
                <span key={i} className="qEq__bar" style={{ ["--i" as never]: i } as React.CSSProperties} />
              ))}
            </div>
            <div className="qTiny qTiny--muted">tap to boost</div>
          </div>
        </button>
      ) : null}

      {qid === "R06" ? (
        <div className="qCard">
          <div className="qTiny">Pick the top-played track</div>
          <div className="qBars">
            {Array.from({ length: 14 }).map((_, i) => (
              <span key={i} className="qBar" style={{ ["--i" as never]: i } as React.CSSProperties} />
            ))}
          </div>
        </div>
      ) : null}

      {qid === "R07" ? (
        <button className="qCardBtn" type="button" onClick={() => setFlip((n) => n + 1)} aria-label="Toggle the note">
          <div className="qCard">
            <div className="qTiny">{flip % 2 ? "first letters" : "lock note"}</div>
            <div className="qNote">
              {(flip % 2
                ? ["E", "V", "E", "R", "Y"]
                : ["EVERY LOCK OPENS EASILY", "VERY RARELY, IT DOESN’T", "EVEN THEN, TRY AGAIN", "RIGHT ANSWERS WAIT", "YOURS IS IN THE FIRSTS"]
              ).map((t, i) => (
                <div key={i} className="qNote__line">
                  {t}
                </div>
              ))}
            </div>
          </div>
        </button>
      ) : null}

      {qid === "R08" ? (
        <button className="qCardBtn" type="button" onClick={() => setTempo((n) => n + 1)} aria-label="Nudge the lockword">
          <div className="qCard qWordCard">
            <div className="qTiny">{tempo % 2 ? "…something shifts" : "tap to nudge"}</div>
            <div className={`qWord qWord--mask ${tempo % 2 ? "qWord--on" : ""}`} aria-hidden="true">
              <span className="qMask" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="qMask__seg" />
                ))}
              </span>
              <span className="qMaskAdd" aria-hidden="true">
                <span className="qMask__seg qMask__seg--gold" />
                <span className="qMask__seg qMask__seg--gold" />
              </span>
            </div>
            <div className={`qShrink ${tempo % 2 ? "qShrink--on" : ""}`} aria-hidden="true">
              <span className="qShrink__label">gauge</span>
              <span className="qShrink__bar">
                <span className="qShrink__fill" />
              </span>
            </div>
          </div>
        </button>
      ) : null}

      {qid === "R09" || qid === "R10" ? (
        <div className="qCard">
          <div className="qTiny">Final lock</div>
          <div className={`qKeyhole ${reduceMotion ? "qKeyhole--still" : ""}`} />
        </div>
      ) : null}
    </div>
  );
}

function isAnswerOk(q: Question, input: string, pickedIndex: number | null) {
  if (q.kind === "mcq") return pickedIndex === q.answerIndex;
  if (q.kind === "bp_extra_letter") return normalizeForCompare(input) === normalizeForCompare(q.answer);
  const exp = q.a;
  const ans = normalizeForCompare(input);
  if (Array.isArray(exp)) return exp.map(normalizeForCompare).includes(ans);
  return ans === normalizeForCompare(exp);
}

function GalleryPaintings() {
  // Two “paintings”: (ideally) real images. Extra letter should be N.
  const [useFallback, setUseFallback] = useState(false);
  const [zoom, setZoom] = useState<null | "a" | "b">(null);
  useEffect(() => {
    if (!useFallback) return;
    // Keep UI diegetic; log the actionable fix for you (developer).
    // eslint-disable-next-line no-console
    console.warn(
      "[GalleryPair] Missing puzzle photos. Add public/easter/snow.jpg and public/easter/sow.jpg to replace the fallback paintings.",
    );
  }, [useFallback]);
  return (
    <>
      <div className="bpPair" aria-label="Two framed paintings">
        <button className="bpCard bpCard--painting bpCardBtn" type="button" onClick={() => setZoom("a")} aria-label="Open painting 1">
        <div className="bpFrame" aria-hidden="true" />
        {!useFallback ? (
          <img
            className="bpPhoto"
            src={Q4_A_SRC}
            alt="Painting 1"
            loading="eager"
            decoding="async"
            onError={() => setUseFallback(true)}
          />
        ) : (
          <svg viewBox="0 0 140 140" className="bpIllo" role="img" aria-label="Winter painting">
            <defs>
              <linearGradient id="skyA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(103,211,255,0.22)" />
                <stop offset="0.65" stopColor="rgba(7,18,26,0.60)" />
                <stop offset="1" stopColor="rgba(7,18,26,0.85)" />
              </linearGradient>
              <radialGradient id="moonA" cx="65%" cy="30%" r="55%">
                <stop offset="0" stopColor="rgba(255,215,122,0.55)" />
                <stop offset="1" stopColor="rgba(255,215,122,0)" />
              </radialGradient>
              <linearGradient id="paintGrain" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="rgba(255,255,255,0.00)" />
                <stop offset="1" stopColor="rgba(255,255,255,0.12)" />
              </linearGradient>
            </defs>
            <rect x="18" y="18" width="104" height="104" rx="14" fill="url(#skyA)" stroke="rgba(103,211,255,0.22)" strokeWidth="2" />
            <rect x="18" y="18" width="104" height="104" rx="14" fill="url(#moonA)" />
            <path d="M22 86 C44 66, 60 64, 80 56 C96 50, 108 52, 120 44" fill="none" stroke="rgba(232,251,255,0.72)" strokeWidth="4" strokeLinecap="round" />
            <path d="M22 100 C52 84, 78 90, 120 76" fill="none" stroke="rgba(255,215,122,0.22)" strokeWidth="4" strokeLinecap="round" />
            <path d="M18 106 C44 96, 62 96, 92 90 C108 86, 116 84, 122 82 L122 122 L18 122 Z" fill="rgba(0,0,0,0.16)" />
            {Array.from({ length: 26 }).map((_, i) => (
              <circle
                key={i}
                cx={22 + ((i * 11) % 96)}
                cy={26 + ((i * 17) % 86)}
                r={i % 4 === 0 ? 2.0 : 1.2}
                fill="rgba(232,251,255,0.50)"
                opacity={0.62}
              />
            ))}
            <rect x="18" y="18" width="104" height="104" rx="14" fill="url(#paintGrain)" opacity="0.25" />
          </svg>
        )}
        <div className="bpPlacard" aria-hidden="true">
          TITLE: 4 LETTERS
        </div>
        </button>
        <button className="bpCard bpCard--painting bpCardBtn" type="button" onClick={() => setZoom("b")} aria-label="Open painting 2">
        <div className="bpFrame" aria-hidden="true" />
        {!useFallback ? (
          <img
            className="bpPhoto"
            src={Q4_B_SRC}
            alt="Painting 2"
            loading="eager"
            decoding="async"
            onError={() => setUseFallback(true)}
          />
        ) : (
          <svg viewBox="0 0 140 140" className="bpIllo" role="img" aria-label="Sow painting">
            <defs>
              <linearGradient id="bgB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(255,215,122,0.12)" />
                <stop offset="0.6" stopColor="rgba(7,18,26,0.62)" />
                <stop offset="1" stopColor="rgba(7,18,26,0.86)" />
              </linearGradient>
              <linearGradient id="paintGrain2" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(255,255,255,0.00)" />
                <stop offset="1" stopColor="rgba(255,255,255,0.12)" />
              </linearGradient>
            </defs>
            <rect x="18" y="18" width="104" height="104" rx="14" fill="url(#bgB)" stroke="rgba(255,215,122,0.22)" strokeWidth="2" />
            <path
              d="M40 86
                 C 32 70, 36 56, 52 50
                 C 62 46, 74 52, 84 52
                 C 98 52, 110 64, 104 80
                 C 98 96, 82 102, 66 98
                 C 54 96, 46 92, 40 86 Z"
              fill="rgba(0,0,0,0.18)"
              stroke="rgba(232,251,255,0.28)"
              strokeWidth="2"
            />
            <circle cx="86" cy="66" r="2.8" fill="rgba(232,251,255,0.62)" />
            <path d="M82 74 Q90 70 98 74" fill="none" stroke="rgba(103,211,255,0.45)" strokeWidth="3" strokeLinecap="round" />
            {Array.from({ length: 18 }).map((_, i) => (
              <circle
                key={i}
                cx={22 + ((i * 13) % 96)}
                cy={26 + ((i * 19) % 86)}
                r={i % 3 === 0 ? 1.9 : 1.2}
                fill="rgba(232,251,255,0.36)"
                opacity={0.55}
              />
            ))}
            <rect x="18" y="18" width="104" height="104" rx="14" fill="url(#paintGrain2)" opacity="0.22" />
          </svg>
        )}
        <div className="bpPlacard" aria-hidden="true">
          TITLE: 3 LETTERS
        </div>
        </button>
      </div>

      <AnimatePresence>
        {zoom ? (
          <motion.div
            className="bpLightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={() => setZoom(null)}
            role="dialog"
            aria-label="Painting zoom"
          >
            <motion.div
              className="bpLightbox__panel"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img className="bpLightbox__img" src={zoom === "a" ? Q4_A_SRC : Q4_B_SRC} alt="" onError={() => setZoom(null)} />
              <div className="bpLightbox__hint">One title has exactly one extra letter.</div>
              <button className="bpLightbox__close" type="button" onClick={() => setZoom(null)}>
                Close
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export default function TerminalReveal({
  code,
  reduceMotion,
  winHoldMs,
  roomWinHoldMs,
  onRoomWinStart,
  onRoomWinEnd,
  onRoomChange,
  onBoot,
  onCopy,
  onTap,
  onSlappa,
  onRiddleOk,
  onWrong,
  onWinStart,
  onComplete,
  onProgress,
}: Props) {
  const [cineDone, setCineDone] = useState(false);
  const [titleShow, setTitleShow] = useState(false);
  const [answer, setAnswer] = useState("");
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [eggShow, setEggShow] = useState(false);
  const [wrongPulse, setWrongPulse] = useState(0);
  const [showError, setShowError] = useState(false);
  const [wrongMsg, setWrongMsg] = useState("");
  const [ragePulse, setRagePulse] = useState(0);
  const [tries, setTries] = useState<Record<string, number>>({});
  const [okBurst, setOkBurst] = useState(0);
  const [liveMsg, setLiveMsg] = useState("");
  const [hint, setHint] = useState<{ show: boolean; text: string; pulse: number }>({ show: false, text: "", pulse: 0 });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [winShow, setWinShow] = useState(false);
  const winTimerRef = useRef<number | null>(null);
  const [roomWinShow, setRoomWinShow] = useState(false);
  const roomWinTimerRef = useRef<number | null>(null);
  const roomWinDismissedRef = useRef(false);
  const [slappaShow, setSlappaShow] = useState(false);
  const bellaRef = useRef<HTMLVideoElement | null>(null);
  const bellaHoldingRef = useRef(false);
  const bellaRafRef = useRef<number | null>(null);
  const bellaBufRef = useRef("");
  const bellaBufTRef = useRef<number | null>(null);
  const [bellaShow, setBellaShow] = useState(false);
  const [bellaP, setBellaP] = useState(0);
  const [bellaBoom, setBellaBoom] = useState(false);
  const [bellaError, setBellaError] = useState(false);
  const [bellaReady, setBellaReady] = useState(false);

  const vibrateOk = (isFinal: boolean) => {
    try {
      // Android/Chrome: supported. iOS Safari: typically not supported (no-op).
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).vibrate(isFinal ? [25, 40, 70] : [18, 26, 18]);
      }
    } catch {
      // ignore
    }
  };

  const questions = useMemo<Question[]>(
    () => [
      {
        kind: "text",
        id: "R01",
        room: "ROOM 01 — Boiler Hall",
        q: "The Boiler Hall hums.\n\nI’m born when water learns to run.\nI drive pistons, blur windows,\nand vanish the second you swear you’ve caught me.\n\nWhat am I?",
        a: "steam",
        hintLadder: ["Think: hot water + air.", "Old engines loved this.", "Five letters, starts with S."],
      },
      {
        kind: "text",
        id: "R02",
        room: "ROOM 02 — Courtyard at Night",
        q: "Courtyard at night.\n\nI fall without a sound.\nI make streetlights louder.\nI turn footsteps into a confession.\n\nWhat am I?",
        a: "snow",
        hintLadder: ["Winter’s favorite blanket.", "Think: silent + bright + cold.", "Four letters."],
      },
      {
        kind: "mcq",
        id: "R03",
        room: "ROOM 03 — Service Corridor",
        q:
          "Three plaques. All true.\n\n1) LIBRARY is EAST of the stairwell.\n2) GREENHOUSE is NORTH of the LIBRARY.\n3) GALLERY is opposite the GREENHOUSE.\n\nFrom the stairwell, where is the GALLERY?",
        options: ["Northeast", "Northwest", "Southeast", "Southwest"],
        answerIndex: 3,
        hintLadder: ["Draw a tiny compass. Place the stairwell.", "Place LIB, then GRN, then take the opposite.", "Opposite of NE is SW."],
      },
      {
        kind: "bp_extra_letter",
        id: "R04",
        room: "ROOM 04 — Gallery Pair",
        q: "Gallery Pair.\n\nBoth paintings map to simple words.\nOne word has exactly ONE extra letter.\n\nType the extra letter.",
        answer: "N",
        hintLadder: ["Name each painting with the simplest word you can.", "Compare spellings.", "One word is the other + one letter."],
      },
      {
        kind: "text",
        id: "R05",
        room: "ROOM 05 — Music Room",
        q: "Music Room.\n\nAC/DC. Bagpipes. A very long title.\n\nName the song.",
        a: ["it's a long way to the top", "its a long way to the top", "it's a long way to the top (if you wanna rock 'n' roll)"],
        placeholder: "song title",
        showAngus: true,
        hintLadder: ["It’s famously long; most people shorten it.", "Starts: “It’s a long way…”", "You can omit the parenthetical."],
      },
      {
        kind: "mcq",
        id: "R06",
        room: "ROOM 06 — Record Shelf",
        q: "Record Shelf.\n\nThe Fixer: which song has the most plays on Spotify?",
        options: ["Ghosts Will Talk", "Smoke Show", "Your Lie", "Ugly Knots"],
        answerIndex: 1,
        showFixer: true,
        hintLadder: ["Two words.", "Starts with S.", "It’s… a compliment. Kinda."],
      },
      {
        kind: "mcq",
        id: "R06S",
        room: "ROOM 06S — Pantry Interlude",
        q: "Pantry Interlude.\n\nWhat does Connor Slappa?",
        options: ["Bass", "Bread"],
        answerIndex: 1,
        hintLadder: ["It’s not an instrument.", "Carbs win.", "Bread."],
      },
      {
        kind: "text",
        id: "R07",
        room: "ROOM 07 — Study Door",
        q:
          "A note is pinned under the lockplate:\n\nEVERY LOCK OPENS EASILY\nVERY RARELY, IT DOESN’T\nEVEN THEN, TRY AGAIN\nRIGHT ANSWERS WAIT\nYOURS IS IN THE FIRSTS\n\nType the hidden word.",
        a: ["every"],
        placeholder: "word",
        hintLadder: ["“YOURS IS IN THE FIRSTS” is literal.", "Take the first letter of each line.", "E V E R Y."],
      },
      {
        kind: "text",
        id: "R08",
        room: "ROOM 08 — West Stair",
        q: "West Stair.\n\nRiddle on the wall:\n\n“I get shorter when you add two letters to me.”\n\nWhat word am I?",
        a: ["short"],
        placeholder: "word",
        hintLadder: ["Classic wordplay riddle.", "The word becomes “shorter” when you add letters.", "What word would do that?"],
      },
      {
        kind: "text",
        id: "R09",
        room: "ROOM 09 — Blueprint Desk",
        q:
          "Blueprint Desk.\n\nOn the margin, a rule is scribbled:\n\n“Take the ONLY word in this sentence\nthat is BOTH a place and a promise.”\n\nTHE ESTATE KEEPS ITS ROOMS.\n\nType the word.",
        a: ["estate"],
        placeholder: "word",
        hintLadder: ["It’s one word in the sentence.", "It’s also the place we’ve been implying.", "Six letters."],
      },
      {
        kind: "text",
        id: "R10",
        room: "ROOM 10 — Final Lock",
        q:
          "Final Lock.\n\nTake the answer from ROOM 09.\nPut THE in front of it.\n\nType the full two-word phrase.",
        a: ["the estate"],
        placeholder: "two words",
        hintLadder: ["It’s literally an instruction.", "Two words.", "Starts with THE."],
      },
    ],
    [],
  );
  const q = questions[step];
  useEffect(() => {
    onRoomChange?.(step, q.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, q.id]);
  useEffect(() => {
    // Report progress for dramatic audio ramps, etc.
    // (idx is 0-based question index)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    onProgress?.(step, questions.length);
  }, [onProgress, step, questions.length]);
  const errorTimerRef = useRef<number | null>(null);
  const okTimerRef = useRef<number | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  function triggerWrong() {
    const quips = [
      "Not quite. Try again, rockstar.",
      "Nope. The Estate requests an encore.",
      "Close. Like a missed note, but festive.",
      "Denied. Take a breath, then hit it again.",
      "Not that one. Try the other riff.",
      "Christmas rule: you get unlimited tries.",
      "Access denied. Sleigh again.",
    ];
    setWrongMsg(quips[Math.floor(Math.random() * quips.length)]);
    setWrongPulse((n) => n + 1);
    setShowError(true);
    setRagePulse((n) => n + 1);
    setLiveMsg("Access denied");
    setTries((t) => ({ ...t, [q.id]: (t[q.id] ?? 0) + 1 }));
    onWrong?.();
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => setShowError(false), reduceMotion ? 1 : 4000);
  }

  function triggerOk() {
    setLiveMsg("Correct");
    if (reduceMotion) return;
    setOkBurst((n) => n + 1);
    if (okTimerRef.current) window.clearTimeout(okTimerRef.current);
    okTimerRef.current = window.setTimeout(() => setOkBurst(0), 420);
  }

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
      if (okTimerRef.current) window.clearTimeout(okTimerRef.current);
      if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
      if (winTimerRef.current) window.clearTimeout(winTimerRef.current);
      if (roomWinTimerRef.current) window.clearTimeout(roomWinTimerRef.current);
    };
  }, []);

  function showHintForCurrentQuestion() {
    if (reduceMotion) {
      setLiveMsg("Hint");
    } else {
      setLiveMsg("Hint");
    }
    const n = tries[q.id] ?? 0;
    const text = q.hintLadder[Math.min(q.hintLadder.length - 1, n)] ?? "Try the obvious, then simplify.";
    setHint((h) => ({ show: true, text, pulse: h.pulse + 1 }));
    if (hintTimerRef.current) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => setHint((h) => ({ ...h, show: false })), reduceMotion ? 1 : 1400);
  }

  function clearBellaRaf() {
    if (bellaRafRef.current) window.cancelAnimationFrame(bellaRafRef.current);
    bellaRafRef.current = null;
  }

  function openBella() {
    setBellaP(0);
    setBellaBoom(false);
    setBellaError(false);
    setBellaReady(false);
    setBellaShow(true);
    // Clear typed value so the next “Enter” doesn’t accidentally submit bella.
    setAnswer("");
    if (inputRef.current) inputRef.current.value = "";
  }

  useEffect(() => {
    if (!bellaShow) {
      clearBellaRaf();
      bellaHoldingRef.current = false;
      try {
        if (bellaRef.current) {
          bellaRef.current.pause();
          bellaRef.current.currentTime = 0;
          bellaRef.current.volume = 1;
        }
      } catch {
        // ignore
      }
      return;
    }
    // Best-effort play with audio; mobile browsers may still gate it.
    try {
      const v = bellaRef.current;
      if (!v) return;
      v.muted = false;
      v.volume = 1;
      void v.play().catch(() => {
        v.muted = true;
        void v.play().catch(() => undefined);
      });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bellaShow]);

  const dismissSlappaAndAdvance = () => {
    if (!slappaShow) return;
    onTap?.();
    setSlappaShow(false);
    onSlappa?.(false);
    setStep((s) => Math.min(questions.length - 1, s + 1));
  };

  useEffect(() => {
    // Desktop convenience:
    // - Type BELLA then press Enter (even on MCQ) to trigger the easter egg.
    // - Press Enter to submit (MCQ/text) without clicking.
    // - Press Escape to bail out of the Bella overlay if the browser can't play .mov.
    if (done) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;

      if (bellaShow) {
        if (k === "Escape") {
          e.preventDefault();
          setBellaShow(false);
          setBellaBoom(false);
          setBellaP(0);
        }
        return;
      }

      // Beta hotkey: press "0" to auto-answer the current room and submit.
      // (Great for QA when you don't want to keep typing.)
      if (k === "0") {
        e.preventDefault();
        if (slappaShow) {
          dismissSlappaAndAdvance();
          return;
        }
        if (!cineDone) return;
        if (q.kind === "mcq") {
          setPicked(q.answerIndex);
          submit({ pickedIndex: q.answerIndex });
          return;
        }
        if (q.kind === "bp_extra_letter") {
          setAnswer(q.answer);
          if (inputRef.current) inputRef.current.value = q.answer;
          submit({ typed: q.answer });
          return;
        }
        const exp = Array.isArray(q.a) ? q.a[0] : q.a;
        setAnswer(exp);
        if (inputRef.current) inputRef.current.value = exp;
        submit({ typed: exp });
        return;
      }

      // Maintain a short buffer for "bella" on MCQ screens.
      if (k === "Backspace") {
        bellaBufRef.current = bellaBufRef.current.slice(0, -1);
      } else if (k.length === 1) {
        bellaBufRef.current = (bellaBufRef.current + k).slice(-10);
      }
      if (bellaBufTRef.current) window.clearTimeout(bellaBufTRef.current);
      bellaBufTRef.current = window.setTimeout(() => {
        bellaBufRef.current = "";
      }, 1200);

      if (k !== "Enter") return;
      if (!cineDone || slappaShow) return;

      const buf = normalize(bellaBufRef.current);
      if (buf === "bella") {
        e.preventDefault();
        bellaBufRef.current = "";
        openBella();
        return;
      }

      // For MCQ (no input), Enter should submit.
      if (q.kind === "mcq") {
        e.preventDefault();
        // Reuse the same submit logic as the button.
        submit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, bellaShow, cineDone, slappaShow, q.kind, picked, step, answer]);

  const submit = (over?: { pickedIndex?: number | null; typed?: string }) => {
    if (done) return;
    if (!cineDone) return;
    if (slappaShow) return;
    const pickedIndex = over?.pickedIndex ?? picked;
    if (q.kind === "mcq" && pickedIndex == null) {
      triggerWrong();
      return;
    }
    // Prefer the live DOM value as a fallback (helps with mobile keyboards/autofill edge cases).
    const typed = over?.typed ?? (q.kind === "mcq" ? answer : inputRef.current?.value ?? answer);
    const norm = normalize(typed);
    if (norm === "bella") {
      openBella();
      return;
    }
    if (q.kind !== "mcq" && (norm === "help" || norm === "hint" || norm === "?" || norm === "h")) {
      showHintForCurrentQuestion();
      setAnswer("");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    // More forgiving for puzzles that may be typed with spaces.
    const typedForCheck = q.id === "R08" ? norm.replace(/\s+/g, "") : typed;
    const ok = isAnswerOk(q, typedForCheck, pickedIndex);
    if (!ok) {
      triggerWrong();
      return;
    }
    onRiddleOk?.(step, q.id);
    triggerOk();
    vibrateOk(step >= questions.length - 1);
    setAnswer("");
    if (inputRef.current) inputRef.current.value = "";
    setPicked(null);
    const advance = () => {
      if (step < questions.length - 1) {
        // Per-room victory splash (3–4s), then move on.
        const hold = Math.max(2200, Math.min(5200, roomWinHoldMs ?? (reduceMotion ? 600 : 3400)));
        const curIdx = step;
        const curId = q.id;
        roomWinDismissedRef.current = false;
        setRoomWinShow(true);
        onRoomWinStart?.(step, q.id);
        if (roomWinTimerRef.current) window.clearTimeout(roomWinTimerRef.current);
        roomWinTimerRef.current = window.setTimeout(() => {
          if (roomWinDismissedRef.current) return;
          roomWinDismissedRef.current = true;
          onRoomWinEnd?.(curIdx, curId, false);
          setRoomWinShow(false);
          setStep((s) => s + 1);
        }, reduceMotion ? 1 : hold);
      } else {
        setDone(true);
        setLiveMsg("Access granted");
        onWinStart?.();
        setWinShow(true);
        if (winTimerRef.current) window.clearTimeout(winTimerRef.current);
        winTimerRef.current = window.setTimeout(() => {
          setWinShow(false);
          onComplete?.();
        }, reduceMotion ? 900 : Math.max(2200, winHoldMs ?? 7200));
      }
    };

    if (q.id === "R06S") {
      // Easter egg: show Connor Slappa photo until the player taps to continue.
      setSlappaShow(true);
      onSlappa?.(true);
      return;
    }

    advance();
  };

  const cineLines = useMemo(() => {
    return [
      "SIGNAL: GIFT-CHANNEL",
      "SOURCE: BLUE_BOOK_PAGE_01",
      "ROUTE: /gift/reveal → /estate/access",
      "",
      "REMOTE SESSION: ESTATE-LINK",
      "AUDIO: SYNC",
      "UI WRAPPER: REWRITING…",
      "SECURITY: BARRIER DISABLED",
      "",
      "BOOT: ACCESS PANEL",
      "LOADING: snow.shader… ok",
      "LOADING: CRT.scanlines… ok",
      "LOADING: room.lockset… ok",
      "",
      "STATUS: LINKED",
      "ROOM 01: ARMING",
      "",
      "…",
    ];
  }, []);

  const logLines = useMemo(() => {
    const base = [
      "WINTER/ESTATE v1.0",
      "LINK: estate.console… ok",
      `CHALLENGE: ${questions.length} rooms`,
      "",
      `${q.room}`,
      "STATUS: READY",
      "INPUT:",
    ];
    return base;
  }, [q.room, questions.length]);

  useEffect(() => {
    // Dedicated cinematic boot before the first question, once per entry to this screen.
    if (reduceMotion) {
      setCineDone(true);
      return;
    }
    // Only show the ACCESS PANEL cinematic once (ever) — it gets annoying on repeat visits.
    try {
      if (localStorage.getItem(CINE_KEY) === "1") {
        setCineDone(true);
        return;
      }
    } catch {
      // ignore
    }

    setCineDone(false);
    onBoot?.();
    const t = window.setTimeout(() => {
      setCineDone(true);
      try {
        localStorage.setItem(CINE_KEY, "1");
      } catch {
        // ignore
      }
    }, 2600);
    return () => window.clearTimeout(t);
  }, [onBoot, reduceMotion]);

  const cineWriter = useTypewriter(cineLines, reduceMotion ? 0 : 190, !reduceMotion);
  const typewriter = useTypewriter(logLines, reduceMotion ? 0 : 70, cineDone && !reduceMotion);

  useEffect(() => {
    // One-time easter egg glitch frame during boot.
    if (reduceMotion) return;
    try {
      const seen = localStorage.getItem(EGG_KEY) === "1";
      if (seen) return;
      localStorage.setItem(EGG_KEY, "1");
      setEggShow(true);
      const t = window.setTimeout(() => setEggShow(false), 1300);
      return () => window.clearTimeout(t);
    } catch {
      // ignore
    }
  }, [reduceMotion]);

  useEffect(() => {
    if (!cineDone) return;
    // Move focus to input once the cinematic boot is out of the way.
    const t = window.setTimeout(() => inputRef.current?.focus(), reduceMotion ? 0 : 220);
    return () => window.clearTimeout(t);
  }, [cineDone, reduceMotion]);

  useEffect(() => {
    // One-time “Dark Souls” style title card (after the cinematic boot, before room 01).
    if (!cineDone || reduceMotion) return;
    try {
      if (localStorage.getItem(TITLE_KEY) === "1") return;
    } catch {
      // ignore
    }
    setTitleShow(true);
  }, [cineDone, reduceMotion]);

  return (
    <div className={`terminalScene ${winShow ? "terminalScene--win" : ""}`} role="group" aria-label="Terminal reveal">
      <div className="srOnly" aria-live="polite" aria-atomic="true">
        {liveMsg}
      </div>
      <AnimatePresence>
        {roomWinShow ? (
          <motion.div
            className="roomWinOverlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
            style={{ ["--roomWinHold" as never]: `${Math.max(2200, Math.min(5200, roomWinHoldMs ?? (reduceMotion ? 600 : 3400)))}ms` } as React.CSSProperties}
            onClick={() => {
              // Tap-to-continue fallback: if timers get clamped on some devices, user can always proceed.
              if (roomWinDismissedRef.current) return;
              roomWinDismissedRef.current = true;
              if (roomWinTimerRef.current) window.clearTimeout(roomWinTimerRef.current);
              onRoomWinEnd?.(step, q.id, true);
              setRoomWinShow(false);
              setStep((s) => s + 1);
            }}
            role="dialog"
            aria-label="Room unlocked"
          >
            <div className="roomWinOverlay__wash" />
            <motion.div
              className="roomWinOverlay__panel"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
            >
              <div className="roomWinOverlay__title">ACCESS GRANTED</div>
              <div className="roomWinOverlay__sub">ROOM UNLOCKED</div>
              <div className="roomWinOverlay__tiny">{q.room}</div>
              <div className="roomWinOverlay__tiny" style={{ marginTop: 6, opacity: 0.85 }}>
                Tap to continue
              </div>
              <div className="roomWinOverlay__bar">
                <div className="roomWinOverlay__barFill" />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
        {!cineDone ? (
          <motion.div
            className="cineBoot"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            aria-hidden="true"
          >
            <motion.div
              className="cineBoot__panel"
              initial={{ opacity: 0, scale: 0.995, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -12 }}
              transition={{ duration: 0.28 }}
            >
              <div className="cineBoot__title">ACCESS PANEL</div>
              <div className="cineBoot__sub">Hijacking the gift channel…</div>
              <div className="cineBoot__win">
                {cineWriter.out.map((l, i) => (
                  <div key={i} className="cineBoot__line">
                    {renderTermLine(l)}
                  </div>
                ))}
                <div className={`cineBoot__cursor ${cineWriter.done ? "cineBoot__cursor--idle" : ""}`} />
              </div>
            </motion.div>
            <div className="cineBoot__noise" />
            <div className="cineBoot__grid" />
          </motion.div>
        ) : null}

        {bellaShow ? (
          <motion.div
            className={`bellaOverlay ${bellaBoom ? "bellaOverlay--boom" : ""}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
            style={{ ["--p" as never]: String(bellaP) } as React.CSSProperties}
            role="dialog"
            aria-label="Bella video"
            onClick={() => {
              // If the browser blocked autoplay, a tap is a valid user gesture to start playback.
              try {
                const v = bellaRef.current;
                if (v && v.paused) {
                  void v.play().catch(() => undefined);
                }
              } catch {
                // ignore
              }
            }}
            onPointerDown={() => {
              bellaHoldingRef.current = true;
              clearBellaRaf();
              try {
                const v = bellaRef.current;
                if (v) {
                  v.muted = false;
                  void v.play().catch(() => undefined);
                }
              } catch {
                // ignore
              }
              let last = performance.now();
              const tick = (t: number) => {
                if (!bellaHoldingRef.current) return;
                const dt = Math.min(48, t - last);
                last = t;
                setBellaP((p) => {
                  const next = Math.min(1, p + dt / 1100);
                  try {
                    const v = bellaRef.current;
                    if (v) v.volume = Math.max(0.05, 1 - next * 0.95);
                  } catch {
                    // ignore
                  }
                  if (next >= 1) {
                    setBellaBoom(true);
                    window.setTimeout(() => {
                      setBellaShow(false);
                      setBellaBoom(false);
                      setBellaP(0);
                    }, reduceMotion ? 0 : 140);
                  }
                  return next;
                });
                bellaRafRef.current = window.requestAnimationFrame(tick);
              };
              bellaRafRef.current = window.requestAnimationFrame(tick);
            }}
            onPointerUp={() => {
              bellaHoldingRef.current = false;
              clearBellaRaf();
            }}
            onPointerCancel={() => {
              bellaHoldingRef.current = false;
              clearBellaRaf();
            }}
            onPointerLeave={() => {
              bellaHoldingRef.current = false;
              clearBellaRaf();
            }}
          >
            <video
              ref={bellaRef}
              className="bellaOverlay__video"
              src={BELLA_SRC}
              playsInline
              autoPlay
              preload="auto"
              onCanPlay={() => setBellaReady(true)}
              onError={() => setBellaError(true)}
            />
            <div className="bellaOverlay__hud" aria-hidden="true">
              <div className="bellaOverlay__title">BELLA</div>
              <div className="bellaOverlay__hint">
                {bellaError ? "Video unavailable here. Press Esc to return." : bellaReady ? "Tap and hold to dim the lights" : "Tap once to start • hold to dim"}
              </div>
              <div className="bellaOverlay__meter">
                <div className="bellaOverlay__meterBar" style={{ transform: `scaleX(${bellaP})` }} />
              </div>
            </div>
          </motion.div>
        ) : null}

        {titleShow ? (
          <motion.div
            className="dsTitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
            onClick={() => {
              setTitleShow(false);
              try {
                localStorage.setItem(TITLE_KEY, "1");
              } catch {
                // ignore
              }
            }}
            role="dialog"
            aria-label="Title card"
          >
            <motion.div
              className="dsTitle__panel"
              initial={{ opacity: 0, y: 8, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.22 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="dsTitle__big">PREPARE TO BE JOLLY</div>
              <div className="dsTitle__small">Tap to continue</div>
            </motion.div>
            <div className="dsTitle__vignette" aria-hidden="true" />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {slappaShow ? (
          <motion.div
            className="slappaOverlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
            role="dialog"
            aria-label="Pantry interlude. Tap to continue."
            onClick={() => {
              dismissSlappaAndAdvance();
            }}
          >
            <img className="slappaOverlay__img" src={SLAPPA_SRC} alt="" loading="eager" decoding="async" />
            <div className="slappaOverlay__wash" />
            <div className="slappaOverlay__txt">
              <div className="slappaOverlay__k">PANTRY INTERLUDE</div>
              <div className="slappaOverlay__s">Tap to continue</div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {winShow ? (
          <motion.div
            className="winOverlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
            style={{ ["--winHold" as never]: `${Math.max(2200, winHoldMs ?? 7200)}ms` } as React.CSSProperties}
            aria-hidden="true"
          >
            <div className="winOverlay__wash" />
            <div className="winOverlay__grid" />
            <div className="winOverlay__rays" />
            <div className="winOverlay__halo" />
            <motion.div
              className="winOverlay__panel"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.22 }}
            >
              <div className="winOverlay__icon" aria-hidden="true">
                <svg viewBox="0 0 64 64" className="winOverlay__lock">
                  <path
                    className="winLock__shackle"
                    d="M20 30 V22 C20 14.3 26.3 8 34 8 C41.7 8 48 14.3 48 22 V30"
                    fill="none"
                    stroke="rgba(31,255,140,0.9)"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                  <rect x="16" y="28" width="36" height="28" rx="8" fill="rgba(7,18,26,0.92)" stroke="rgba(255,215,122,0.28)" strokeWidth="2" />
                  <path d="M34 38 C32 38 30.6 39.6 30.6 41.4 C30.6 42.8 31.5 44 32.8 44.6 L32 50 H36 L35.2 44.6 C36.5 44 37.4 42.8 37.4 41.4 C37.4 39.6 36 38 34 38 Z" fill="rgba(255,215,122,0.65)" />
                </svg>
              </div>
              <div className="winOverlay__title">ACCESS GRANTED</div>
              <div className="winOverlay__sub">ROOMS UNLOCKED</div>
              <div className="winOverlay__tiny">Green lights. Warm steam. Something clicks into place…</div>
              <div className="winOverlay__bar">
                <div className="winOverlay__barFill" />
              </div>
            </motion.div>
            <div className="winOverlay__confetti">
              {Array.from({ length: reduceMotion ? 28 : 120 }).map((_, i) => (
                <span
                  key={i}
                  className={`winConf ${i % 7 === 0 ? "winConf--domino" : ""}`}
                  style={{ ["--i" as never]: i } as React.CSSProperties}
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div key={`rage-${ragePulse}`} className={`rageWash ${showError ? "rageWash--on" : ""}`} aria-hidden="true" />
      <AnimatePresence>
        {eggShow ? (
          <motion.div
            className="eggGlitch"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            aria-hidden="true"
          >
            <img
              className="eggGlitch__img"
              src={EGG_SRC}
              alt=""
              onError={() => setEggShow(false)}
              loading="eager"
              decoding="async"
            />
            <div className="eggGlitch__scan" />
            <div className="eggGlitch__noise" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showError ? (
          <motion.div
            className="terminalError"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.12 }}
            role="alert"
          >
            <motion.div
              className="terminalError__panel"
              initial={{ y: 6, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 6, scale: 0.98, opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.14 }}
            >
              ACCESS DENIED
              <div className="terminalError__sub">{wrongMsg}</div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {okBurst ? (
          <motion.div
            key={`ok-${okBurst}`}
            className="okConfetti"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            aria-hidden="true"
          >
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={i}
                className={`okConfetti__p ${i % 5 === 0 ? "okConfetti__p--domino" : ""}`}
                style={{ ["--i" as never]: i } as React.CSSProperties}
              />
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {hint.show ? (
          <motion.div
            key={`hint-${hint.pulse}`}
            className="terminalHint"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
            role="status"
            aria-live="polite"
            aria-label="Hint"
          >
            <div className="terminalHint__title">HINT</div>
            <div className="terminalHint__text">{hint.text}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {!cineDone ? (
        <div className="terminalScene__top">
          <div className="terminalBadge">
            <Terminal className="icon" aria-hidden="true" />
            <span>ACCESS PANEL</span>
          </div>
        </div>
      ) : null}

      <div className="terminalOrnaments" aria-hidden="true">
        <div className="terminalOrn terminalOrn--a" />
        <div className="terminalOrn terminalOrn--b" />
        <div className="terminalOrn terminalOrn--c" />
      </div>

      <motion.div
        className="terminalWindow"
        aria-label="Boot output"
        animate={wrongPulse ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: reduceMotion ? 0.01 : 0.28 }}
      >
        {typewriter.out.map((l, i) => (
          <div key={i} className="terminalLine">
            {renderTermLine(l)}
          </div>
        ))}
        <div className={`terminalCursor ${typewriter.done ? "terminalCursor--idle" : ""}`} aria-hidden="true" />
      </motion.div>

      <div className={`terminalRiddle ${showError ? "terminalRiddle--error" : ""} ${!cineDone ? "terminalRiddle--locked" : ""}`}>
        <div className="terminalPrompt" aria-label="Current question">
          <div className="terminalPrompt__label">{q.room}</div>
          <div className="terminalPrompt__text" role="heading" aria-level={2}>
            {q.q}
          </div>
        </div>
        <QuestionWidget qid={q.id} reduceMotion={reduceMotion} />
        {q.kind === "text" && q.showAngus ? (
          <div className="fixerCard fixerCard--angus" aria-label="Angus image">
            <img className="fixerCard__img" src={ANGUS_SRC} alt="" loading="eager" decoding="async" />
          </div>
        ) : null}
        {q.kind === "bp_extra_letter" ? (
          <div style={{ marginBottom: 10 }}>
            <GalleryPaintings />
          </div>
        ) : null}

        {q.kind === "mcq" && q.showFixer ? (
          <div className="fixerCard" aria-label="The Fixer image">
            <img className="fixerCard__img" src={FIXER_SRC} alt="" />
          </div>
        ) : null}

        <div className="terminalRiddle__row">
          {!cineDone ? (
            <div className="terminalLocked">Initializing…</div>
          ) : q.kind === "mcq" ? (
            <div className="mcqGrid" role="group" aria-label="Multiple choice answers">
              {q.options.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  className={`mcqOpt ${picked === i ? "mcqOpt--on" : ""}`}
                  disabled={done || slappaShow || titleShow}
                  onClick={() => {
                    onTap?.();
                    setPicked(i);
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            <input
              className="terminalInput"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                e.preventDefault();
                submit();
              }}
              placeholder={q.kind === "text" ? (q.placeholder ?? "type answer") : "type answer"}
              aria-label="Answer"
              ref={inputRef}
              disabled={done || slappaShow || roomWinShow || winShow || titleShow}
            />
          )}

          <button
            className="btn btn--primary"
            type="button"
            disabled={done || !cineDone || slappaShow || roomWinShow || winShow || titleShow}
            onClick={submit}
          >
            Enter
          </button>
        </div>

        <motion.div
          className={`terminalResult ${done ? "terminalResult--ok" : ""}`}
          initial={false}
          animate={done ? { scale: [1, 1.03, 1] } : { scale: 1 }}
          transition={{ duration: reduceMotion ? 0.01 : 0.22 }}
        >
          {done ? `ACCESS GRANTED — KEY: ${KEY_PHRASE}` : `${q.room} • ${step + 1}/${questions.length}`}
        </motion.div>
      </div>

    </div>
  );
}


