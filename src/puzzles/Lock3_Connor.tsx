import React, { useMemo, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onSolved: () => void;
};

type DialId = "d1" | "d2" | "d3";

export default function Lock3_Connor({ disabled, onSolved }: Props) {
  const options = useMemo(
    () => ({
      d1: ["C", "O", "N"],
      d2: ["O", "N", "C"],
      d3: ["N", "C", "O"],
    }),
    [],
  );

  const [idx, setIdx] = useState<Record<DialId, number>>({ d1: 0, d2: 0, d3: 0 });
  const [solved, setSolved] = useState(false);
  const solvedRef = useRef(false);

  const word = `${options.d1[idx.d1]}${options.d2[idx.d2]}${options.d3[idx.d3]}`;
  const isSolved = word === "CON";

  function spin(d: DialId) {
    if (disabled || solved) return;
    setIdx((s) => {
      const next = { ...s, [d]: (s[d] + 1) % 3 };
      const nextWord = `${options.d1[next.d1]}${options.d2[next.d2]}${options.d3[next.d3]}`;
      if (nextWord === "CON" && !solvedRef.current) {
        solvedRef.current = true;
        setSolved(true);
        onSolved();
      }
      return next;
    });
  }

  return (
    <div className="lock lock--ornament" role="group" aria-label="Lock 3: Ornament dial">
      <div className="lock__hint">Align the three rings. A name will appear.</div>

      <div className="ornament">
        <div className="ornament__cap" aria-hidden="true" />
        <div className="ornament__glass" aria-hidden="true" />

        <div className="ornament__dials" aria-label="Three dials">
          {(["d1", "d2", "d3"] as const).map((d, i) => (
            <button
              key={d}
              type="button"
              className={`dial ${isSolved ? "dial--solved" : ""}`}
              onClick={() => spin(d)}
              disabled={disabled || solved}
              aria-label={`Dial ${i + 1}`}
            >
              <span className="dial__value">{options[d][idx[d]]}</span>
            </button>
          ))}
        </div>

        <div className={`ornament__readout ${isSolved ? "ornament__readout--ok" : ""}`}>
          {word}
        </div>
      </div>
    </div>
  );
}


