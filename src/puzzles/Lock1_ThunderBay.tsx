import { motion } from "framer-motion";
import React, { useMemo, useState } from "react";

type Props = {
  disabled?: boolean;
  onSolved: () => void;
  onWrong?: () => void;
};

type StampId = "thunderBay" | "toronto" | "estate";

export default function Lock1_ThunderBay({ disabled, onSolved, onWrong }: Props) {
  const [picked, setPicked] = useState<StampId | null>(null);
  const [solved, setSolved] = useState(false);
  const [wrongPulse, setWrongPulse] = useState(0);

  type ClueKey = "month" | "ring" | "waves";
  const [answers, setAnswers] = useState<Record<ClueKey, string>>({
    month: "",
    ring: "",
    waves: "",
  });

  const stamps = useMemo(
    () =>
      [
        {
          id: "toronto" as const,
          title: "Toronto",
          subtitle: "Ontario",
          hint: "CITY",
          // Puzzle features (for display; solve is gated by clues)
          month: "FEB",
          ring: "TOR",
          waves: "3",
        },
        {
          id: "thunderBay" as const,
          title: "Thunder Bay",
          subtitle: "Ontario",
          hint: "ROUTE",
          month: "DEC",
          ring: "TB",
          waves: "5",
        },
        {
          id: "estate" as const,
          title: "The Estate",
          subtitle: "North Wing",
          hint: "MYSTERY",
          month: "OCT",
          ring: "EST",
          waves: "7",
        },
      ] as const,
    [],
  );

  const correct = useMemo(() => ({ month: "DEC", ring: "TB", waves: "5" } as const), []);
  const allCluesCorrect =
    answers.month === correct.month && answers.ring === correct.ring && answers.waves === correct.waves;

  function wrong() {
    onWrong?.();
    setWrongPulse((n) => n + 1);
    window.setTimeout(() => setPicked(null), 520);
  }

  function choose(id: StampId) {
    if (disabled || solved) return;
    setPicked(id);
    if (!allCluesCorrect) {
      wrong();
      return;
    }
    if (id !== "thunderBay") {
      wrong();
      return;
    }
  }

  return (
    <div className="lock lock--postcard" role="group" aria-label="Lock 1: Postmark">
      <div className="lock__hint">Deduce the postmark. Then stamp it.</div>

      <div className="postcard">
        <div className="postcard__paper" aria-hidden="true" />

        <div className="postcard__grid">
          <div className="postcard__left" aria-label="Clues">
            <motion.div
              className="clueCard"
              animate={wrongPulse ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.32 }}
            >
              <div className="clueCard__title">Postmark clues</div>
              <div className="clueCard__sub">Match all three. Then choose the stamp.</div>

              <div className="clueRow">
                <div className="clueRow__label">Month</div>
                <div className="clueRow__opts" role="radiogroup" aria-label="Month clue">
                  {(["DEC", "FEB", "OCT"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`clueOpt ${answers.month === v ? "clueOpt--on" : ""}`}
                      onClick={() => setAnswers((s) => ({ ...s, month: v }))}
                      disabled={disabled || solved}
                      aria-pressed={answers.month === v}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="clueRow">
                <div className="clueRow__label">Ring letters</div>
                <div className="clueRow__opts" role="radiogroup" aria-label="Ring letters clue">
                  {(["TB", "TOR", "EST"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`clueOpt ${answers.ring === v ? "clueOpt--on" : ""}`}
                      onClick={() => setAnswers((s) => ({ ...s, ring: v }))}
                      disabled={disabled || solved}
                      aria-pressed={answers.ring === v}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="clueRow">
                <div className="clueRow__label">Waves</div>
                <div className="clueRow__opts" role="radiogroup" aria-label="Waves clue">
                  {(["3", "5", "7"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={`clueOpt ${answers.waves === v ? "clueOpt--on" : ""}`}
                      onClick={() => setAnswers((s) => ({ ...s, waves: v }))}
                      disabled={disabled || solved}
                      aria-pressed={answers.waves === v}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`clueCard__status ${allCluesCorrect ? "clueCard__status--ok" : ""}`}>
                {allCluesCorrect ? "Clues match. Choose the stamp." : "—"}
              </div>
            </motion.div>
          </div>

          <div className="postcard__right" aria-label="Stamps side">
            <div className="stamps" role="group" aria-label="Postmarks">
              {stamps.map((s) => {
                const isPicked = picked === s.id;
                const isCorrect = s.id === "thunderBay";
                const isSolved = solved && isCorrect;
                const isWrongPicked = isPicked && !isSolved && (wrongPulse > 0) && (!allCluesCorrect || !isCorrect);
                return (
                  <motion.button
                    key={s.id}
                    type="button"
                    className={`stamp ${isPicked ? "stamp--picked" : ""} ${
                      isSolved ? "stamp--solved" : ""
                    } ${isWrongPicked ? "stamp--wrong" : ""} ${allCluesCorrect && isCorrect ? "stamp--ready" : ""}`}
                    onClick={() => choose(s.id)}
                    disabled={disabled || solved}
                    aria-label={`Postmark: ${s.title}`}
                    whileHover={disabled || solved ? undefined : { y: -1 }}
                    whileTap={disabled || solved ? undefined : { scale: 0.99 }}
                  >
                    <div className="stamp__frame" aria-hidden="true" />
                    <div className="stamp__meta">
                      <div className="stamp__hint">{s.hint}</div>
                      <div className="stamp__title">{s.title}</div>
                      <div className="stamp__sub">{s.subtitle}</div>
                      <div className="stamp__facts" aria-hidden="true">
                        <span className="stampFact">{s.month}</span>
                        <span className="stampFact">{s.ring}</span>
                        <span className="stampFact">{s.waves} waves</span>
                      </div>
                    </div>
                    <div className={`stamp__ink ${isPicked ? "stamp__ink--down" : ""}`} aria-hidden="true">
                      <div className="stamp__inkText">{allCluesCorrect ? "STAMP" : "INSPECT"}</div>
                      <div className="stamp__inkRing" />
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="postcard__whisper" aria-hidden="true">
              {allCluesCorrect ? "You’ve narrowed it down. Stamp with confidence." : "Use the clues. Don’t guess."}
            </div>

            <button
              className={`btn btn--primary iconBtn postcard__stampBtn ${
                picked === "thunderBay" && allCluesCorrect ? "" : "btn--disabled"
              }`}
              type="button"
              disabled={disabled || solved || !(picked === "thunderBay" && allCluesCorrect)}
              onClick={() => {
                if (disabled || solved) return;
                if (!(picked === "thunderBay" && allCluesCorrect)) {
                  wrong();
                  return;
                }
                setSolved(true);
                onSolved();
              }}
            >
              Stamp down
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


