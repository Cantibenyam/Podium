"use client";

import { generateBot, generateReaction, type Bot } from "@/lib/mockAudience";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

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
  reactionsByBotId,
}: {
  bots: Bot[];
  className?: string;
  reactionsByBotId?: Record<string, string | undefined>;
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

  // Compute semi-circle seat positions
  const seats = useMemo(() => {
    const n = bots.length;
    const w = stageSize.width;
    const h = stageSize.height;
    if (n === 0 || w === 0 || h === 0)
      return [] as Array<{ x: number; y: number }>;
    const cx = w / 2;
    const radius = Math.min(w, h) * 0.38;
    const cy = Math.max(radius + 24, h - 24) - radius; // center so arc sits above bottom
    const startAngle = Math.PI + Math.PI / 5; // ~200deg
    const endAngle = -Math.PI / 5; // ~-36deg
    const angles =
      n === 1
        ? [Math.PI]
        : Array.from(
            { length: n },
            (_, i) => startAngle + ((endAngle - startAngle) * i) / (n - 1)
          );
    return angles.map((a) => ({
      x: cx + radius * Math.cos(a),
      y: cy + radius * Math.sin(a),
    }));
  }, [bots.length, stageSize.width, stageSize.height]);

  if (!mounted) return null;

  return (
    <div
      ref={stageRef}
      className={`relative w-full h-[60vh] md:h-[68vh] rounded-lg border bg-card/40 overflow-hidden ${
        className ?? ""
      }`}
      aria-label="Stage"
    >
      {bots.map((bot, index) => (
        <SeatedBot
          key={bot.id}
          bot={bot}
          seat={
            seats[index] || { x: stageSize.width / 2, y: stageSize.height / 2 }
          }
          centerX={stageSize.width / 2}
          delay={index * 0.25}
          reactionText={reactionsByBotId?.[bot.id]}
        />
      ))}
    </div>
  );
}

function SeatedBot({
  bot,
  seat,
  centerX,
  delay,
  reactionText,
}: {
  bot: Bot;
  seat: { x: number; y: number };
  centerX: number;
  delay: number;
  reactionText?: string;
}) {
  const prefersReduced = useReducedMotion();
  const facingRight = seat.x >= centerX;

  if (prefersReduced) {
    return (
      <div className="absolute" style={{ left: seat.x, top: seat.y }}>
        <span className="text-5xl md:text-6xl select-none inline-block">
          {bot.avatar}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      className="absolute will-change-transform"
      initial={{ x: centerX, y: seat.y + 60, opacity: 0 }}
      animate={{ x: seat.x, y: seat.y, opacity: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22, delay }}
      style={{ x: 0, y: 0, transformOrigin: "center" }}
      aria-label={bot.name}
    >
      <motion.div
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 2.0, repeat: Infinity, ease: "easeInOut" }}
        className="relative"
        style={{ willChange: "transform" }}
      >
        <span
          className="text-5xl md:text-6xl select-none inline-block"
          style={{ transform: `scaleX(${facingRight ? 1 : -1})` }}
        >
          {bot.avatar}
        </span>
        <motion.div
          initial={false}
          animate={reactionText ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-card text-card-foreground border px-2 py-1 text-md whitespace-nowrap shadow"
          style={{ willChange: "opacity, transform" }}
        >
          {reactionText}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
