"use client";

import { generateBot, generateReaction, type Bot } from "@/lib/mockAudience";
import {
  motion,
  PanInfo,
  useAnimationControls,
  useReducedMotion,
} from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type WalkingAudienceProps = {
  count?: number;
  className?: string;
};

function Walker({
  bot,
  pathWidth,
  slow,
  directionRight,
}: {
  bot: Bot;
  pathWidth: number;
  slow: boolean;
  directionRight: boolean;
}) {
  const prefersReduced = useReducedMotion();
  const travel = Math.max(0, pathWidth - 48);
  const duration = useMemo(
    () => (slow ? 40 : 16) + Math.random() * (slow ? 25 : 12),
    [slow]
  );

  const [showSpeech, setShowSpeech] = useState(false);
  const [phrase, setPhrase] = useState<string>("");

  useEffect(() => {
    if (prefersReduced) return;
    let cancelled = false;
    let hideTimer: number | undefined;
    let showTimer: number | undefined;

    const schedule = () => {
      const delay = 6000 + Math.random() * 8000; // less frequent
      showTimer = window.setTimeout(() => {
        if (cancelled) return;
        const r = generateReaction();
        setPhrase(`${r.emoji} ${r.phrase}`);
        setShowSpeech(true);
        hideTimer = window.setTimeout(() => {
          if (cancelled) return;
          setShowSpeech(false);
          schedule();
        }, 1200);
      }, delay);
    };

    schedule();
    return () => {
      cancelled = true;
      if (showTimer) window.clearTimeout(showTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, [prefersReduced]);

  if (prefersReduced) {
    return (
      <div className="absolute bottom-2">
        <span className="text-2xl md:text-3xl select-none">{bot.avatar}</span>
      </div>
    );
  }

  return (
    <motion.div
      className="absolute bottom-2 will-change-transform"
      initial={{ x: directionRight ? 0 : travel }}
      animate={{ x: directionRight ? [0, travel, 0] : [travel, 0, travel] }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: "center" }}
    >
      <motion.div
        animate={{ y: [0, 0, -6, 0, 0] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatDelay: 1.2,
          ease: "easeInOut",
        }}
        className="relative"
        style={{ willChange: "transform" }}
      >
        <span
          className="text-3xl md:text-5xl select-none inline-block"
          style={{ transform: `scaleX(${directionRight ? 1 : -1})` }}
        >
          {bot.avatar}
        </span>
        <motion.div
          initial={false}
          animate={showSpeech ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-card text-card-foreground border px-2 py-1 text-md whitespace-nowrap shadow"
          style={{ willChange: "opacity, transform" }}
        >
          {phrase}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default function WalkingAudience({
  count = 12,
  className,
}: WalkingAudienceProps) {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const slow = true;
  const [walkers, setWalkers] = useState<
    Array<{ bot: Bot; directionRight: boolean }>
  >([]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const update = () => {
      const w = containerRef.current?.clientWidth ?? window.innerWidth;
      setWidth(w);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    let timer: number | undefined;
    const spawnNext = () => {
      if (cancelled) return;
      setWalkers((prev) => {
        if (prev.length >= count) return prev;
        const next = {
          bot: generateBot(),
          directionRight: Math.random() < 0.5,
        };
        return [...prev, next];
      });
      const delay = 300 + Math.random() * 400; // 300ms - 700ms
      timer = window.setTimeout(() => {
        if (cancelled) return;
        spawnNext();
      }, delay);
    };
    spawnNext();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [mounted, count]);

  if (!mounted) return null; // avoid SSR/CSR mismatch

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none fixed bottom-0 left-0 right-0 z-20 md:h-24 overflow-hidden ${
        className ?? ""
      }`}
    >
      <div className="relative h-full w-full">
        {walkers.map((w, index) => (
          <Walker
            key={`${w.bot.id}-${index}`}
            bot={w.bot}
            pathWidth={width}
            slow={slow}
            directionRight={w.directionRight}
          />
        ))}
      </div>
    </div>
  );
}

// Walkable stage with autonomous random walking bots
export function WalkableStage({
  bots,
  className,
  speed = 90,
  padding = 24,
}: {
  bots: Bot[];
  className?: string;
  speed?: number; // px per second
  padding?: number; // keep bots away from edges
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const update = () => {
      const rect = stageRef.current?.getBoundingClientRect();
      setStageSize({ width: rect?.width ?? 0, height: rect?.height ?? 0 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      ref={stageRef}
      className={`relative w-full h-[60vh] md:h-[68vh] rounded-lg border bg-card/40 overflow-hidden ${
        className ?? ""
      }`}
      aria-label="Stage"
    >
      {bots.map((bot) => (
        <AutonomousBot
          key={bot.id}
          bot={bot}
          stageRef={stageRef}
          stageSize={stageSize}
          speed={speed}
          padding={padding}
        />
      ))}
    </div>
  );
}

function AutonomousBot({
  bot,
  stageRef,
  stageSize,
  speed,
  padding,
}: {
  bot: Bot;
  stageRef: React.RefObject<HTMLDivElement | null>;
  stageSize: { width: number; height: number };
  speed: number;
  padding: number;
}) {
  const prefersReduced = useReducedMotion();
  const controls = useAnimationControls();
  const [moving, setMoving] = useState(false);
  const [facingRight, setFacingRight] = useState(true);
  const draggingRef = useRef(false);
  const posRef = useRef<{ x: number; y: number }>({
    x: Math.random() * Math.max(1, stageSize.width - padding * 2) + padding,
    y: Math.random() * Math.max(1, stageSize.height - padding * 2) + padding,
  });
  const [resumeCounter, setResumeCounter] = useState(0);

  // Helper to clamp inside the stage
  const clampPoint = useCallback(
    (x: number, y: number) => {
      const maxX = Math.max(padding, stageSize.width - padding);
      const maxY = Math.max(padding, stageSize.height - padding);
      return {
        x: Math.min(Math.max(x, padding), maxX),
        y: Math.min(Math.max(y, padding), maxY),
      };
    },
    [stageSize.width, stageSize.height, padding]
  );

  // Movement loop
  useEffect(() => {
    if (prefersReduced) return;
    let cancelled = false;

    async function loop() {
      // If dragging, wait and retry
      if (draggingRef.current || cancelled) return;

      // Pick a random target
      const targetRaw = {
        x: Math.random() * Math.max(1, stageSize.width - padding * 2) + padding,
        y:
          Math.random() * Math.max(1, stageSize.height - padding * 2) + padding,
      };
      const target = clampPoint(targetRaw.x, targetRaw.y);

      const from = posRef.current;
      const dx = target.x - from.x;
      const dy = target.y - from.y;
      const distance = Math.hypot(dx, dy);
      const duration = Math.max(0.001, distance / speed);

      setMoving(true);
      setFacingRight(dx >= 0);
      try {
        await controls.start({
          x: target.x,
          y: target.y,
          transition: { duration, ease: "linear" },
        });
      } catch {
        // animation stopped (e.g., drag start)
      }
      posRef.current = target;
      setMoving(false);

      if (cancelled) return;
      // tiny pause before next target
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 250));
      if (!draggingRef.current && !cancelled) loop();
    }

    // Initialize position and start loop
    controls.set(posRef.current);
    loop();

    return () => {
      cancelled = true;
      controls.stop();
    };
    // re-run when stage size changes or rerunRef toggled
  }, [
    stageSize.width,
    stageSize.height,
    speed,
    clampPoint,
    controls,
    prefersReduced,
    resumeCounter,
  ]);

  const onDragStart = () => {
    draggingRef.current = true;
    controls.stop();
    setMoving(false);
  };

  const onDragEnd = (
    _evt: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    draggingRef.current = false;
    // Update pos from transform, then resume loop by nudging ref
    const rect = stageRef.current?.getBoundingClientRect();
    const stageLeft = rect?.left ?? 0;
    const stageTop = rect?.top ?? 0;
    const x = info.point.x - stageLeft;
    const y = info.point.y - stageTop;
    const clamped = clampPoint(x, y);
    posRef.current = clamped;
    controls.set(clamped);
    setResumeCounter((c) => c + 1);
  };

  if (prefersReduced) {
    return (
      <div
        className="absolute"
        style={{ left: posRef.current.x, top: posRef.current.y }}
      >
        <span className="text-4xl select-none">{bot.avatar}</span>
      </div>
    );
  }

  return (
    <motion.div
      className="absolute will-change-transform cursor-grab active:cursor-grabbing"
      drag
      dragConstraints={stageRef}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      dragElastic={0.1}
      dragMomentum={false}
      animate={controls}
      initial={false}
      style={{ x: 0, y: 0, transformOrigin: "center" }}
      aria-label={bot.name}
    >
      <motion.div
        key={moving ? "walk" : "idle"}
        animate={
          moving
            ? { y: [0, -4, 0, -2, 0], rotateZ: [-2, 2, -2, 2, -2] }
            : { scale: [1, 1.03, 1] }
        }
        transition={
          moving
            ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" }
            : { duration: 2.0, repeat: Infinity, ease: "easeInOut" }
        }
        className="relative"
        style={{ willChange: "transform" }}
      >
        <span
          className="text-5xl md:text-6xl select-none inline-block"
          style={{ transform: `scaleX(${facingRight ? 1 : -1})` }}
        >
          {bot.avatar}
        </span>
      </motion.div>
    </motion.div>
  );
}
