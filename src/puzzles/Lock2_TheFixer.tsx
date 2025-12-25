import React, { useMemo, useRef, useState } from "react";

type Props = {
  disabled?: boolean;
  onSolved: () => void;
};

type SliderId = "a" | "b" | "c";

export default function Lock2_TheFixer({ disabled, onSolved }: Props) {
  const target = useMemo(() => ({ a: 7, b: 2, c: 5 }), []);
  const [vals, setVals] = useState<Record<SliderId, number>>({ a: 0, b: 0, c: 0 });
  const [solved, setSolved] = useState(false);
  const solvedRef = useRef(false);

  const okA = vals.a === target.a;
  const okB = vals.b === target.b;
  const okC = vals.c === target.c;
  const all = okA && okB && okC;

  function set(id: SliderId, v: number) {
    if (disabled || solved) return;
    setVals((s) => {
      const next = { ...s, [id]: v };
      const nextAll = next.a === target.a && next.b === target.b && next.c === target.c;
      if (nextAll && !solvedRef.current) {
        solvedRef.current = true;
        setSolved(true);
        onSolved();
      }
      return next;
    });
  }

  return (
    <div className="lock lock--deck" role="group" aria-label="Lock 2: Tape deck">
      <div className="lock__hint">Tune the deck until all three lamps glow.</div>

      <div className="deck">
        <div className="deck__face">
          <div className="deck__topRow">
            <div className="deck__label">THE FIXER</div>
            <div className="deck__lights" aria-label="Indicator lamps">
              <div className={`lamp ${okA ? "lamp--on" : ""}`} aria-label="Lamp 1" />
              <div className={`lamp ${okB ? "lamp--on" : ""}`} aria-label="Lamp 2" />
              <div className={`lamp ${okC ? "lamp--on" : ""}`} aria-label="Lamp 3" />
            </div>
          </div>

          <div className="deck__window" aria-hidden="true">
            <div className="tape">
              <div className="tape__reel tape__reel--left" />
              <div className="tape__reel tape__reel--right" />
              <div className="tape__strip" />
            </div>
            <div className="deck__glow" />
          </div>

          <div className="deck__sliders" aria-label="Three sliders">
            {(["a", "b", "c"] as const).map((id, i) => (
              <div key={id} className="slider">
                <div className="slider__cap" aria-hidden="true" />
                <input
                  className="slider__input"
                  type="range"
                  min={0}
                  max={9}
                  step={1}
                  value={vals[id]}
                  onChange={(e) => set(id, Number(e.target.value))}
                  disabled={disabled || solved}
                  aria-label={`Slider ${i + 1}`}
                />
                <div className="slider__ticks" aria-hidden="true" />
                <div className="slider__readout" aria-label={`Slider ${i + 1} value`}>
                  {vals[id]}
                </div>
              </div>
            ))}
          </div>

          <div className="deck__bottomRow">
            <div className="deck__sig" aria-hidden="true">
              THE ESTATE LISTENS
            </div>
            <div className={`deck__status ${all ? "deck__status--ok" : ""}`}>
              {all ? "SIGNAL LOCKED" : "SIGNAL DRIFT"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


