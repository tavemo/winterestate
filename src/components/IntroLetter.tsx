import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Feather, Gift } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  onBegin: () => void;
  onFirstGesture?: () => void;
  onSealBreak?: () => void;
  onPageTurn?: () => void;
  onUiTap?: () => void;
};

const baseUrl = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
const asset = (p: string) => `${baseUrl}${p.replace(/^\//, "")}`;
const CONNOR_SRC = asset("/easter/connor.jpeg");

function BlueprintSvg() {
  // Simple “estate blueprint” line-draw (no external assets).
  return (
    <svg
      className="blueprintSvg"
      viewBox="0 0 900 520"
      role="img"
      aria-label="Estate blueprint drawing"
    >
      <path
        className="bpStroke bpStroke--slow"
        d="M70 410 L70 120 L340 120 L340 170 L520 170 L520 120 L830 120 L830 410 L560 410 L560 330 L420 330 L420 410 Z"
      />
      <path className="bpStroke" d="M340 120 L340 410" />
      <path className="bpStroke" d="M520 120 L520 410" />
      <path className="bpStroke" d="M420 330 L560 330" />
      <path className="bpStroke" d="M110 160 L200 160 L200 210 L110 210 Z" />
      <path className="bpStroke" d="M700 160 L790 160 L790 210 L700 210 Z" />
      <path className="bpStroke" d="M110 280 L200 280 L200 330 L110 330 Z" />
      <path className="bpStroke" d="M700 280 L790 280 L790 330 L700 330 Z" />

      {/* Doorways */}
      <path className="bpStroke bpStroke--thin" d="M340 250 L360 250" />
      <path className="bpStroke bpStroke--thin" d="M520 250 L540 250" />
      <path className="bpStroke bpStroke--thin" d="M420 410 L420 390" />
      <path className="bpStroke bpStroke--thin" d="M560 410 L560 390" />
    </svg>
  );
}

export default function IntroLetter({ onBegin, onFirstGesture, onSealBreak, onPageTurn, onUiTap }: Props) {
  const [view, setView] = useState<"envelope" | "letter">("envelope");
  const [sealBroken, setSealBroken] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const [writeOn, setWriteOn] = useState(false);
  const [skipWrite, setSkipWrite] = useState(false);
  const [page, setPage] = useState(0);
  const [psOpen, setPsOpen] = useState(false);
  const [idleLoop, setIdleLoop] = useState(true);
  const psSeenRef = useRef(false);
  const firstGestureRef = useRef(false);

  const stage = useMemo(() => {
    if (!sealBroken) return "sealed";
    if (!unfolded) return "opening";
    return "open";
  }, [sealBroken, unfolded]);

  useEffect(() => {
    if (!sealBroken) return;
    const t = window.setTimeout(() => setUnfolded(true), 520);
    return () => window.clearTimeout(t);
  }, [sealBroken]);

  useEffect(() => {
    if (stage !== "open") return;
    const t = window.setTimeout(() => setWriteOn(true), 260);
    return () => window.clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    // Reset skip when returning to envelope / re-opening.
    setSkipWrite(false);
    setPage(0);
    setIdleLoop(true);
  }, [view]);

  useEffect(() => {
    if (stage !== "open") return;
    try {
      psSeenRef.current = localStorage.getItem("egg_ps_seen_v1") === "1";
    } catch {
      // ignore
    }
  }, [stage]);

  const beginEnabled = stage === "open" && page >= 2;

  return (
    <motion.div
      className="intro intro--letter"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="introLetterWrap">
        <div className="introBackdrop" aria-hidden="true">
          <BlueprintSvg />
        </div>

        <AnimatePresence mode="wait">
          {view === "envelope" ? (
            <motion.div
              key="envelope"
              className={`envelopeScene ${idleLoop ? "envelopeScene--idle" : ""}`}
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.32 }}
              onPointerDown={() => {
                if (firstGestureRef.current) return;
                firstGestureRef.current = true;
                setIdleLoop(false);
                onFirstGesture?.();
              }}
            >
              <div className={`envelope ${sealBroken ? "envelope--opening" : ""}`} aria-label="Envelope">
                <div className="envelope__body" aria-hidden="true">
                  <div className="envelope__back" />
                  <div className="envelope__paper" />
                  <div className="envelope__front" />
                  <div className="envelope__flap" />
                  <div className="envelope__shadow" />
                </div>
                <button
                  className={`seal seal--envelope ${sealBroken ? "seal--broken seal--blue" : ""}`}
                  type="button"
                  onClick={() => {
                    if (sealBroken) return;
                    if (!firstGestureRef.current) {
                      firstGestureRef.current = true;
                      setIdleLoop(false);
                      onFirstGesture?.();
                    }
                    onSealBreak?.();
                    setSealBroken(true);
                    const rm = document.body.classList.contains("reduce-motion");
                    window.setTimeout(() => setView("letter"), rm ? 1 : 1050);
                  }}
                  aria-label="Break the wax seal"
                  title="Break the seal"
                >
                  <span className="seal__wax" aria-hidden="true" />
                  <span className="seal__mark" aria-hidden="true">
                    E
                  </span>
                </button>
            </div>
              <div className="envelopeFine">Tap the seal</div>
            </motion.div>
          ) : null}

          {view === "letter" ? (
            <motion.div
              key="letter"
              className={`letter letter--${stage}`}
              role="group"
              aria-label="A letter"
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.35 }}
              onPointerDown={() => {
                if (firstGestureRef.current) return;
                firstGestureRef.current = true;
                onFirstGesture?.();
              }}
            >
              <div className="blueBookMotif" aria-hidden="true">
                <div className="blueBookMotif__spine" />
                <div className="blueBookMotif__bookmark" />
              </div>
              <div className="letter__top">
                <div className="letter__meta">
                  <div className="letter__kicker">Merry Christmas</div>
                  <div className="letter__sub">To Christine &amp; Chuck</div>
            </div>
          </div>

          <div className="letter__paper">
                <div className="letterPager" aria-label="Letter pages">
                  <div className="letterPager__dots" aria-hidden="true">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className={`letterDot ${page === i ? "letterDot--on" : ""}`} />
                    ))}
                  </div>
                  <div className="letterPager__count">{page + 1}/3</div>
                </div>

                <div
                  className={`letter__content ${writeOn && !skipWrite ? "letter__content--write" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={writeOn && !skipWrite ? "Tap to reveal this page" : "Note"}
                  onClick={() => {
                    if (writeOn && !skipWrite) {
                      setSkipWrite(true);
                      return;
                    }
                    // If already revealed, a tap advances the page.
                    if (writeOn) {
                      setPage((p) => Math.min(2, p + 1));
                      setSkipWrite(false);
                      return;
                    }
                  }}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && writeOn && !skipWrite) {
                      e.preventDefault();
                      setSkipWrite(true);
                    }
                  }}
                >
                  {page === 2 ? (
                    <div className="connorCard" aria-label="Connor">
                      <div className="connorCard__frame" aria-hidden="true" />
                      <img className="connorCard__img" src={CONNOR_SRC} alt="Connor" loading="eager" decoding="async" />
                      <div className="connorCard__cap">
                        Connor <span className="connorCard__cap2">Group Project Manager</span>
                      </div>
                    </div>
                  ) : null}
                  {(
                    [
                      [
                        { node: "Christine & Chuck," },
                        { node: "", gap: true },
                        {
                          node: (
                            <span>
                              Merry <span className="inkRed">Christmas</span>.
                            </span>
                          ),
                        },
                        { node: "", gap: true },
                        {
                          node: (
                            <span>
                              Thank you for coming down and spending the holidays with us. We’re truly{" "}
                              <span className="inkGold">grateful</span> you made the trip. We <span className="inkGreen">love</span> having you here.
                            </span>
                          ),
                        },
                      ],
                      [
                        {
                          node: (
                            <span>
                              We left you a <span className="inkGold">gift</span> that’s also a little <span className="inkBlue">puzzle</span>. A few clues. A few taps. A small payoff.
                            </span>
                          ),
                        },
                        { node: "", gap: true },
                        {
                          node: (
                            <span>
                              Page one sent you here.
                            </span>
                          ),
                        },
                        {
                          node: (
                            <span>
                              If the room suddenly feels a little more <span className="inkGreen">merry</span> than it should, don’t worry. That’s normal. Probably.
                            </span>
                          ),
                        },
                      ],
                      [
                        {
                          node: (
                            <span>
                              Connor is here with us too, which makes this officially a group project. Connor, you’ve been promoted to{" "}
                              <span className="inkGold">Group Project Manager</span> and <span className="inkGold">Chief Gift Inspector</span>.{" "}
                              <span className="inkRed">Merry Christmas</span>.
                            </span>
                          ),
                        },
                        { node: "", gap: true },
                        { node: "Take your time. If something feels like it might open, it probably does. If you miss one, no big deal. Just try again." },
                        { node: "When you’re ready, open your gift." },
                        { node: "", gap: true },
                        { node: "With love," },
                        { node: "Chris & Nicole" },
                      ],
                    ][page] as Array<{ node: React.ReactNode; gap?: boolean }>
                  ).map((line, i) => (
                    <div
                      key={`${page}-${i}`}
                      className={`handLine ${line.gap ? "handLine--gap" : ""}`}
                      style={{ ["--d" as never]: `${i * 0.32}s` } as React.CSSProperties}
                    >
                      <span className="handLine__ink">{line.node}</span>
                      {!line.gap ? <span className="handLine__stroke" aria-hidden="true" /> : null}
              </div>
                  ))}
              </div>

                {page >= 2 ? (
                  <div className="letter__utilityRow" aria-label="Extras">
                    <div className="letter__hintRow" aria-label="What’s inside">
                <span className="chip">
                  <Feather className="chip__icon" aria-hidden="true" />
                        Letter
                </span>
                <span className="chip">
                  <Gift className="chip__icon" aria-hidden="true" />
                        Gift
                </span>
              </div>

                    <button
                      className={`psTab ${psOpen ? "psTab--open" : ""}`}
                      type="button"
                      onClick={() => {
                        onUiTap?.();
                        setPsOpen((v) => {
                          const next = !v;
                          if (next && !psSeenRef.current) {
                            psSeenRef.current = true;
                            try {
                              localStorage.setItem("egg_ps_seen_v1", "1");
                            } catch {
                              // ignore
                            }
                          }
                          return next;
                        });
                      }}
                      aria-expanded={psOpen}
                    >
                      P.S.
                      {!psSeenRef.current ? <span className="psSpark" aria-hidden="true" /> : null}
                    </button>
                  </div>
                ) : null}

                <AnimatePresence>
                  {psOpen ? (
                    <motion.div
                      className="psPopoverBackdrop"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: writeOn ? 0.16 : 0.01 }}
                        onClick={() => {
                          onUiTap?.();
                          setPsOpen(false);
                        }}
                      role="dialog"
                      aria-label="Postscript"
                    >
                      <motion.div
                        className="psPopover"
                        initial={{ opacity: 0, y: 10, scale: 0.99 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.99 }}
                        transition={{ duration: writeOn ? 0.18 : 0.01 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="psPopover__top">
                          <div className="psNote__title">P.S.</div>
                            <button
                              className="psClose"
                              type="button"
                              onClick={() => {
                                onUiTap?.();
                                setPsOpen(false);
                              }}
                              aria-label="Close P.S."
                            >
                            Close
                          </button>
                        </div>
                        {[
                          "We’re really happy you’re here.",
                          "Thank you for making the trip. It means a lot.",
                          "Love you both.",
                        ].map((line, i) => (
                          <div
                            key={i}
                            className="handLine handLine--ps"
                            style={{ ["--d" as never]: `${(9 + i) * 0.34}s` } as React.CSSProperties}
                          >
                            <span className="handLine__ink">{line}</span>
                            <span className="handLine__stroke" aria-hidden="true" />
              </div>
                        ))}
                        <div className="psDoodle" aria-hidden="true">
                          <span className="psHeart" />
                          <span className="psDomino" />
            </div>
                      </motion.div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
          </div>

          <div className="letter__bottom">
                {page < 2 ? (
            <button
                    className="btn btn--primary iconBtn"
              type="button"
                    onClick={() => {
                      onPageTurn?.();
                      setPage((p) => Math.min(2, p + 1));
                      setSkipWrite(false);
                    }}
                  >
                    <ChevronRight className="icon" aria-hidden="true" />
                    Next page
            </button>
                ) : (
            <button
              className={`btn btn--primary iconBtn ${beginEnabled ? "" : "btn--disabled"}`}
              type="button"
              disabled={!beginEnabled}
              onClick={onBegin}
            >
              <ChevronRight className="icon" aria-hidden="true" />
                    Open your gift
            </button>
                )}
          </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="introLetterFine">Postmarked: The Estate • Winter Cycle</div>
      </div>
    </motion.div>
  );
}


