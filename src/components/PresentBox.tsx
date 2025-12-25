import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

type Props = {
  reduceMotion: boolean;
  onOpened: () => void;
  onEmptyBeat?: () => void;
  onClick?: () => void;
  onTapLoot?: (info: { clicks: number; required: number; progress: number; finalTap: boolean }) => void;
  onHackBeat?: () => void;
  onWink?: () => void;
};

type Domino = {
  p: THREE.Vector3;
  v: THREE.Vector3;
  r: THREE.Euler;
  w: THREE.Vector3;
  life: number;
  hue: number;
};

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function useIsPortrait() {
  const [portrait, setPortrait] = useState(true);
  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight >= window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return portrait;
}

function ThreePresentScene(opts: {
  opened: boolean;
  openT: number;
  burst: boolean;
  reduceMotion: boolean;
  charge: number;
  impulseAt: number;
  tapSeed: number;
  tapCount: number;
  onBurstDone: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const lid = useRef<THREE.Group>(null);
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const boxMat = useRef<THREE.MeshStandardMaterial>(null);
  const ribbonMat = useRef<THREE.MeshStandardMaterial>(null);
  const ribbonMat2 = useRef<THREE.MeshStandardMaterial>(null);
  const lidMat = useRef<THREE.MeshStandardMaterial>(null);
  const lidRibbonMat = useRef<THREE.MeshStandardMaterial>(null);
  const dominos = useRef<Domino[]>([]);
  const inst = useRef<THREE.InstancedMesh>(null);
  const instMat = useMemo(() => new THREE.Matrix4(), []);
  const instColor = useMemo(() => new THREE.Color(), []);
  const portrait = useIsPortrait();

  const tileCount = opts.reduceMotion ? 64 : 260;
  const gravity = opts.reduceMotion ? 4.5 : 7.5;
  const drag = opts.reduceMotion ? 0.985 : 0.98;

  useEffect(() => {
    if (!opts.burst) return;
    const origin = new THREE.Vector3(0, 0.55, 0);
    dominos.current = Array.from({ length: tileCount }).map((_, i) => {
      const a = (i / tileCount) * Math.PI * 2;
      const cone = 0.45 + Math.random() * 0.55;
      const dir = new THREE.Vector3(Math.cos(a) * cone, 1.2 + Math.random() * 0.8, Math.sin(a) * cone).normalize();
      const speed = opts.reduceMotion ? 2.4 + Math.random() * 1.2 : 3.2 + Math.random() * 2.2;
      const v = dir.multiplyScalar(speed);
      const p = origin.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2));
      const r = new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const w = new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9);
      const hue = (i % 10) / 10;
      return { p, v, r, w, life: 1.6 + Math.random() * 0.8, hue };
    });
    // End burst after a beat.
    const t = window.setTimeout(() => opts.onBurstDone(), opts.reduceMotion ? 450 : 1100);
    return () => window.clearTimeout(t);
  }, [opts.burst, opts.onBurstDone, opts.reduceMotion, tileCount]);

  useFrame((state, dt) => {
    const g = group.current;
    const l = lid.current;
    const c = cam.current;
    if (!g || !l || !c) return;

    const t = easeOutCubic(clamp01(opts.openT));
    const charge = clamp01(opts.charge);
    const nowT = state.clock.elapsedTime;
    const impulse = opts.impulseAt ? clamp01(1 - (performance.now() - opts.impulseAt) / 380) : 0;
    const aggro = opts.opened ? 1 : clamp01(0.22 + charge * 0.78);
    const tapW = opts.reduceMotion ? 0 : clamp01(opts.tapCount / 6);
    const tapKick = opts.reduceMotion ? 0 : impulse * (0.04 + tapW * 0.08);
    const seed = opts.tapSeed % 12;

    // Camera framing: portrait = closer.
    const baseZ = portrait ? 2.4 : 3.0;
    // Cinematic: a tiny pre-pop dolly-in and “ribbon tension” beat near the end.
    const tension = opts.opened || opts.reduceMotion ? 0 : Math.pow(clamp01((charge - 0.78) / 0.22), 1.4);
    const punch = opts.opened ? 0.6 : 0.12 * tension;
    const camBob = opts.reduceMotion ? 0 : Math.sin(nowT * (1.2 + aggro * 2.8)) * (0.015 + aggro * 0.02);
    const shake = opts.reduceMotion ? 0 : impulse * (0.02 + aggro * 0.03);
    c.position.set(
      (opts.reduceMotion ? 0 : Math.sin(nowT * 3.2) * 0.01) + (Math.random() - 0.5) * shake,
      (portrait ? 1.05 : 0.95) + camBob + (Math.random() - 0.5) * shake,
      baseZ - punch * t + (opts.reduceMotion ? 0 : Math.cos(nowT * 2.2) * 0.01),
    );
    c.lookAt(0, 0.55, 0);

    // Idle float and slight rotation for life.
    const idle = opts.reduceMotion ? 0 : Math.sin(nowT * (1.4 + aggro * 2.2)) * (0.02 + aggro * 0.03);
    const idle2 = opts.reduceMotion ? 0 : Math.cos(nowT * (1.1 + aggro * 1.8)) * (0.01 + aggro * 0.02);
    const dir = seed % 2 === 0 ? 1 : -1;
    g.rotation.y = (opts.opened ? 0.2 : 0.52) + idle + impulse * (0.06 + tapW * 0.05) * dir;
    g.rotation.x = (opts.opened ? -0.05 : -0.12) + idle2 - impulse * (0.03 + tapW * 0.04);
    g.position.y = 0.15 + (opts.reduceMotion ? 0 : Math.sin(nowT * (1.6 + aggro * 2.4)) * (0.015 + aggro * 0.02));
    const scale = 1 + tapKick + tapW * 0.03;
    g.scale.setScalar(scale);

    // Lid hinge: rotate around back edge. Add a brief “tension” shimmy before it pops.
    const jitter = opts.opened || opts.reduceMotion ? 0 : Math.sin(nowT * (10 + aggro * 18)) * (0.01 + aggro * 0.02);
    const tensionShimmy = opts.opened || opts.reduceMotion ? 0 : Math.sin(nowT * 22) * (0.03 * tension);
    l.rotation.x = -t * (Math.PI * 0.85) + jitter + tensionShimmy;

    // Per-tap “personality” shift: cycle ribbon tones and warm the box a touch as it wakes up.
    const palette = ["#ffd77a", "#d0243d", "#1f8f54", "#67d3ff"];
    const rib = palette[seed % palette.length];
    const rib2 = palette[(seed + 1) % palette.length];
    const warm = 0.12 + tapW * 0.22;
    if (ribbonMat.current) ribbonMat.current.color.set(rib);
    if (ribbonMat2.current) ribbonMat2.current.color.set(rib2);
    if (lidRibbonMat.current) lidRibbonMat.current.color.set(rib);
    if (boxMat.current) boxMat.current.color.set(new THREE.Color("#0b2430").lerp(new THREE.Color("#102b34"), warm));
    if (lidMat.current) lidMat.current.color.set(new THREE.Color("#2c1d0b").lerp(new THREE.Color("#3b260b"), warm * 0.75));

    // Domino confetti simulation
    const list = dominos.current;
    const mesh = inst.current;
    if (mesh && list.length) {
      for (let i = list.length - 1; i >= 0; i--) {
        const d = list[i];
        d.life -= dt;
        if (d.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        d.v.y -= gravity * dt;
        d.v.multiplyScalar(Math.pow(drag, dt * 60));
        d.p.addScaledVector(d.v, dt);
        d.r.x += d.w.x * dt;
        d.r.y += d.w.y * dt;
        d.r.z += d.w.z * dt;
      }

      const n = Math.min(mesh.count, list.length);
      for (let i = 0; i < mesh.count; i++) {
        if (i >= n) {
          instMat.identity().makeScale(0, 0, 0);
          mesh.setMatrixAt(i, instMat);
          mesh.setColorAt?.(i, instColor.setRGB(0, 0, 0));
          continue;
        }
        const d = list[i];
        const s = clamp01(d.life / 1.4);
        instMat
          .compose(d.p, new THREE.Quaternion().setFromEuler(d.r), new THREE.Vector3(1, 1, 1).multiplyScalar(0.55 + (1 - s) * 0.25));
        mesh.setMatrixAt(i, instMat);
        // blueprint cyan + gold + holiday specks
        const palette = [
          new THREE.Color("#67d3ff"),
          new THREE.Color("#ffd77a"),
          new THREE.Color("#d0243d"),
          new THREE.Color("#1f8f54"),
        ];
        const col = palette[Math.floor((d.hue * 1000) % palette.length)];
        mesh.setColorAt?.(i, instColor.copy(col).multiplyScalar(0.85 + (1 - s) * 0.25));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <perspectiveCamera ref={cam} makeDefault fov={portrait ? 45 : 40} near={0.1} far={30} />

      <ambientLight intensity={0.55 + (opts.reduceMotion ? 0 : opts.charge * 0.1)} color="#67d3ff" />
      <directionalLight
        intensity={1.05 + (opts.reduceMotion ? 0 : opts.charge * 0.4)}
        position={[2.2, 3.2, 1.6]}
        color="#ffd77a"
      />
      <directionalLight
        intensity={0.85 + (opts.reduceMotion ? 0 : opts.charge * 0.25)}
        position={[-2.4, 2.4, -2.0]}
        color="#67d3ff"
      />

      {/* Nice baseline env without heavy HDR */}
      <Environment preset="city" />

      <group ref={group} position={[0, 0.15, 0]}>
        {/* Box */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.4, 1.0, 1.1]} />
          <meshStandardMaterial ref={boxMat} color="#0b2430" metalness={0.35} roughness={0.55} />
        </mesh>

        {/* Ribbon vertical */}
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.16, 1.02, 1.12]} />
          <meshStandardMaterial ref={ribbonMat} color="#ffd77a" metalness={0.75} roughness={0.25} />
        </mesh>
        {/* Ribbon horizontal */}
        <mesh position={[0, 0.14, 0]} castShadow>
          <boxGeometry args={[1.42, 0.16, 1.12]} />
          <meshStandardMaterial ref={ribbonMat2} color="#ffd77a" metalness={0.75} roughness={0.25} />
        </mesh>

        {/* Lid group with hinge at back edge */}
        <group ref={lid} position={[0, 0.5, -0.55]}>
          <group position={[0, 0, 0.55]}>
            <mesh castShadow>
              <boxGeometry args={[1.52, 0.24, 1.2]} />
              <meshStandardMaterial ref={lidMat} color="#2c1d0b" metalness={0.25} roughness={0.55} />
            </mesh>
            {/* Lid ribbon */}
            <mesh position={[0, 0.02, 0]} castShadow>
              <boxGeometry args={[0.18, 0.26, 1.22]} />
              <meshStandardMaterial ref={lidRibbonMat} color="#ffd77a" metalness={0.75} roughness={0.25} />
            </mesh>
          </group>
        </group>

        {/* The Fixer cameo tag (subtle) */}
        <mesh position={[0.42, -0.35, 0.57]} rotation={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.55, 0.16, 0.02]} />
          <meshStandardMaterial color="#061018" metalness={0.25} roughness={0.7} emissive="#0b2a35" emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* Domino confetti: instanced thin tiles */}
      <instancedMesh ref={inst} args={[undefined as never, undefined as never, tileCount]} frustumCulled={false}>
        <boxGeometry args={[0.18, 0.34, 0.04]} />
        <meshStandardMaterial metalness={0.45} roughness={0.35} vertexColors />
      </instancedMesh>
    </>
  );
}

export default function PresentBox({ reduceMotion, onOpened, onEmptyBeat, onClick, onTapLoot, onHackBeat, onWink }: Props) {
  const [opened, setOpened] = useState(false);
  const [clicks, setClicks] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [burst, setBurst] = useState(false);
  const [burstDone, setBurstDone] = useState(false);
  const [tapBurst, setTapBurst] = useState(0);
  const [shakePulse, setShakePulse] = useState(0);
  const [impulseAt, setImpulseAt] = useState(0);
  const [tapSeed, setTapSeed] = useState(0);
  const [hackPulse, setHackPulse] = useState(0);
  const [hackShow, setHackShow] = useState(false);
  const [hackReady, setHackReady] = useState(false);
  const [emptyShow, setEmptyShow] = useState(false);
  const [webglLost, setWebglLost] = useState(false);
  const [winkShow, setWinkShow] = useState(false);
  const winkSeenRef = useRef(false);
  const winkTimerRef = useRef<number | null>(null);
  const hackReadyTimerRef = useRef<number | null>(null);
  const emptyTimerRef = useRef<number | null>(null);
  const hijackTimerRef = useRef<number | null>(null);

  const required = reduceMotion ? 1 : 3;
  const progress = Math.min(1, clicks / required);
  useEffect(() => {
    if (opened || reduceMotion) return;
    const t = window.setInterval(() => setPulse((n) => n + 1), 260);
    return () => window.clearInterval(t);
  }, [opened, reduceMotion]);

  useEffect(() => {
    try {
      winkSeenRef.current = localStorage.getItem("egg_present_wink_v1") === "1";
    } catch {
      // ignore
    }
    return () => {
      if (winkTimerRef.current) window.clearTimeout(winkTimerRef.current);
      if (hackReadyTimerRef.current) window.clearTimeout(hackReadyTimerRef.current);
      if (emptyTimerRef.current) window.clearTimeout(emptyTimerRef.current);
      if (hijackTimerRef.current) window.clearTimeout(hijackTimerRef.current);
    };
  }, []);

  const continueAfterHack = () => {
    if (!hackShow) return;
    if (!hackReady) return;
    setHackShow(false);
    setHackReady(false);
    window.setTimeout(() => onOpened(), reduceMotion ? 220 : 820);
  };

  const openT = opened ? 1 : 0;
  const dpr = useMemo(() => {
    const raw = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    // Keep it a bit conservative for mobile GPU stability.
    return Math.max(1, Math.min(1.25, raw));
  }, []);

  return (
    <div className="presentScene" role="group" aria-label="Gift reveal">
      <div className="presentScene__kicker">Merry Christmas</div>
      <div className="presentScene__title">Open your gift</div>
      <div className="presentScene__sub">Click the box {reduceMotion ? "once" : "three times"} to pop it open.</div>

      <div className="presentStage">
        <motion.button
          type="button"
          className={`presentBtn ${opened ? "presentBtn--opened" : ""}`}
          style={{ ["--loot" as never]: String(progress), ["--clicks" as never]: String(clicks) } as React.CSSProperties}
          animate={
            reduceMotion
              ? { x: 0, y: 0, rotate: 0 }
              : shakePulse
                ? { x: [0, -6, 7, -5, 4, 0], y: [0, 2, -2, 1, 0], rotate: [0, -0.6, 0.7, -0.4, 0.2, 0] }
                : { x: 0, y: 0, rotate: 0 }
          }
          transition={{ duration: reduceMotion ? 0.01 : 0.26 }}
          onPointerDown={() => {
            if (opened || hackShow) return;
            if (reduceMotion) return;
            if (winkSeenRef.current) return;
            if (winkTimerRef.current) window.clearTimeout(winkTimerRef.current);
            winkTimerRef.current = window.setTimeout(() => {
              if (opened || hackShow) return;
              winkSeenRef.current = true;
              try {
                localStorage.setItem("egg_present_wink_v1", "1");
              } catch {
                // ignore
              }
              setWinkShow(true);
              onWink?.();
              window.setTimeout(() => setWinkShow(false), 1400);
            }, 650);
          }}
          onPointerUp={() => {
            if (winkTimerRef.current) window.clearTimeout(winkTimerRef.current);
          }}
          onPointerCancel={() => {
            if (winkTimerRef.current) window.clearTimeout(winkTimerRef.current);
          }}
          onPointerLeave={() => {
            if (winkTimerRef.current) window.clearTimeout(winkTimerRef.current);
          }}
          onClick={() => {
            if (opened && !hackShow) return;
            if (hackShow) {
              continueAfterHack();
              return;
            }
            onClick?.();
            setImpulseAt(performance.now());
            setTapSeed((s) => s + 1);
            setClicks((n) => {
              const next = n + 1;
              const nextProgress = Math.min(1, next / required);
              const finalTap = next >= required;
              onTapLoot?.({ clicks: next, required, progress: nextProgress, finalTap });
              if (!finalTap) {
                setTapBurst((x) => x + 1);
                setShakePulse((x) => x + 1);
              }
              if (next >= required) {
                // Pop it open NOW (epic), then hit a suspenseful “empty” beat,
                // then hijack shortly after.
                setOpened(true);
                setBurstDone(false);
                setBurst(true);

                if (emptyTimerRef.current) window.clearTimeout(emptyTimerRef.current);
                emptyTimerRef.current = window.setTimeout(() => {
                  setEmptyShow(true);
                  onEmptyBeat?.();
                }, reduceMotion ? 120 : 880);

                if (hijackTimerRef.current) window.clearTimeout(hijackTimerRef.current);
                hijackTimerRef.current = window.setTimeout(() => {
                  setHackPulse((x) => x + 1);
                  setHackShow(true);
                  setHackReady(false);
                  onHackBeat?.();
                  if (hackReadyTimerRef.current) window.clearTimeout(hackReadyTimerRef.current);
                  hackReadyTimerRef.current = window.setTimeout(() => setHackReady(true), reduceMotion ? 80 : 980);
                }, reduceMotion ? 420 : 2500);
              }
              return next;
            });
          }}
          aria-label={opened ? "Gift opened" : "Open the gift"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              (e.currentTarget as HTMLButtonElement).click();
            }
          }}
        >
          <div className={`presentCanvasWrap ${hackShow ? "presentCanvasWrap--hack" : ""}`} aria-hidden="true">
            {!webglLost ? (
              <Canvas
                className="presentCanvas"
                dpr={dpr}
                gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
                onCreated={({ gl }) => {
                  const el = gl.domElement;
                  const onLost = (e: Event) => {
                    // Prevent default so the browser may restore; we’ll also show a fallback.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (e as any).preventDefault?.();
                    setWebglLost(true);
                  };
                  el.addEventListener("webglcontextlost", onLost as EventListener, { passive: false } as AddEventListenerOptions);
                }}
              >
                <ThreePresentScene
                  opened={opened}
                  openT={opened ? 1 : openT}
                  burst={burst && !burstDone}
                  reduceMotion={reduceMotion}
                  charge={progress}
                  impulseAt={impulseAt}
                  tapSeed={tapSeed}
                  tapCount={clicks}
                  onBurstDone={() => setBurstDone(true)}
                />
              </Canvas>
            ) : (
              <div className="presentFallback" aria-hidden="true">
                <div className="presentFallback__box" />
                <div className="presentFallback__text">Graphics reset — tap to continue</div>
              </div>
            )}
          </div>
          <div
            key={`hack-${hackPulse}`}
            className={`hackOverlay ${hackShow ? "hackOverlay--on" : ""}`}
            aria-hidden="true"
          >
            <div className="hackOverlay__frame" />
            <div className="hackOverlay__lines">
              {[
                "REMOTE SESSION: ESTATE-LINK",
                "SIGNAL HIJACK DETECTED",
                "AUDIO CLOCK: OVERRIDE",
                "PATCHING UI…",
                "DIVERTING TO ACCESS PANEL…",
                "ACCESS GRANTED",
              ].map((l, i) => (
                <div key={i} className="hackLine" style={{ ["--d" as never]: `${i * 0.14}s` } as React.CSSProperties}>
                  {l}
                </div>
              ))}
              <div className={`hackCta ${hackReady ? "hackCta--on" : ""}`}>Tap to continue</div>
            </div>
          </div>

          <AnimatePresence>
            {emptyShow ? (
              <motion.div
                className={`emptyOverlay ${hackShow ? "emptyOverlay--persist" : ""}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.22 }}
                aria-hidden="true"
              >
                <div className="emptyOverlay__panel">
                  <div className="emptyOverlay__k">REVEAL</div>
                  <div className="emptyOverlay__t">…EMPTY.</div>
                  <div className="emptyOverlay__s">For a moment, nothing happens.</div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <AnimatePresence>
            {winkShow ? (
              <motion.div
                className="winkOverlay"
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: reduceMotion ? 0.01 : 0.18 }}
                aria-hidden="true"
              >
                <div className="winkOverlay__title">ESTATE CAM</div>
                <div className="winkOverlay__msg">Hi Christine &amp; Chuck. Merry Christmas.</div>
                <div className="winkOverlay__tiny">You found a hidden room.</div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div className="presentBtn__hud" aria-hidden="true">
            <div className="lootRing" />
            <div className="presentMeter">
              <div className="presentMeter__bar" style={{ transform: `scaleX(${progress})` }} />
            </div>
            <div className="presentMeter__text">
              {hackShow
                ? "OVERRIDE…"
                : emptyShow
                  ? "…EMPTY"
                  : opened
                    ? "OPENED"
                    : progress < 0.34
                      ? "TAP"
                      : progress < 0.67
                        ? "TAP AGAIN"
                        : "ONE MORE"}
            </div>
          </div>

          <span
            className={`sparkFlash ${impulseAt ? "sparkFlash--on" : ""}`}
            style={{ opacity: opened ? 0 : 1 }}
            aria-hidden="true"
          />
        </motion.button>

        <AnimatePresence>
          {tapBurst ? (
            <motion.div
              key={`tb-${tapBurst}`}
              className="tapBurst"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.2 }}
              aria-hidden="true"
            >
              {Array.from({ length: reduceMotion ? 10 : 26 }).map((_, i) => (
                <span key={i} className="tapBurst__p" style={{ ["--i" as never]: i } as React.CSSProperties} />
              ))}
            </motion.div>
          ) : null}
          {opened ? (
            <motion.div
              className="confettiBurst"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* keep a light 2D sparkle burst on top */}
              {Array.from({ length: reduceMotion ? 18 : 56 }).map((_, i) => (
                <span key={i} className="confetti" style={{ ["--i" as never]: i } as React.CSSProperties} />
              ))}
              {/* extra burst layer: “ribbon scraps / hats” for perceived epic */}
              {Array.from({ length: reduceMotion ? 10 : 26 }).map((_, i) => (
                <span key={`h-${i}`} className="confettiHat" style={{ ["--i" as never]: i } as React.CSSProperties} />
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}


