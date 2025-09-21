"use client";

import { AudioRecorderWithVisualizer } from "@/components/voice";
import { generateReaction, seedBots } from "@/lib/mockAudience";
import { useEffect, useMemo, useRef, useState } from "react";

export default function ScenePage() {
  const bots = useMemo(() => seedBots(6, 12), []);
  const [activeReactions, setActiveReactions] = useState<
    Record<string, number>
  >({});
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    function schedule() {
      const delay = Math.floor(800 + Math.random() * 600);
      timerRef.current = window.setTimeout(() => {
        if (bots.length > 0) {
          const bot = bots[Math.floor(Math.random() * bots.length)];
          setActiveReactions((prev) => ({ ...prev, [bot.id]: Date.now() }));
        }
        schedule();
      }, delay);
    }
    schedule();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [bots]);

  return (
    <div className="min-h-screen overflow-hidden grid grid-rows-[auto_1fr_auto] grid-cols-[80px_1fr] gap-3 p-4 md:grid-cols-[110px_1fr] md:gap-4 md:p-5">
      {/* Timer (top, centered) */}
      <header className="col-span-2 flex items-center justify-center">
        <div className="rounded-xl border bg-card text-card-foreground px-5 py-2 text-sm font-medium">
          Timer: 00:00
        </div>
      </header>

      {/* Coach bubble (left) */}
      <aside className="row-start-2 col-start-1 flex items-center justify-center">
        <div
          className="size-20 rounded-full border bg-card text-card-foreground flex items-center justify-center text-xs font-medium"
          aria-label="Coach"
        >
          Coach
        </div>
      </aside>

      {/* Audience grid (center) */}
      <main className="row-start-2 col-start-2">
        <div className="mx-auto max-w-[1400px] grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
          {bots.map((bot) => {
            const reactedAt = activeReactions[bot.id];
            const justReacted = reactedAt && Date.now() - reactedAt < 1400;
            const bubble = justReacted ? generateReaction() : null;
            return (
              <div
                key={bot.id}
                className="relative aspect-square rounded-lg border bg-card p-2 sm:p-3 flex flex-col items-center justify-center text-xs text-muted-foreground gap-1.5"
                aria-label={`Audience slot for ${bot.name}`}
              >
                <div
                  className={`text-5xl sm:text-6xl ${
                    justReacted ? "animate-pop-bounce" : ""
                  }`}
                  aria-hidden
                >
                  {bot.avatar}
                </div>
                <div className="font-medium text-foreground/80 text-[13px] sm:text-sm">
                  {bot.name}
                </div>
                {bubble && (
                  <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border bg-popover text-popover-foreground px-2.5 py-1.5 text-[12px] sm:text-xm shadow-sm animate-float-up">
                    <span className="mr-1" aria-hidden>
                      {bubble.emoji}
                    </span>
                    {bubble.phrase}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Voice visualization (bottom) */}
      <footer className="col-span-2">
        <div className="rounded-xl border bg-card h-24 flex items-center justify-center text-sm text-muted-foreground">
          <div className="w-full max-w-4xl px-3">
            <AudioRecorderWithVisualizer />
          </div>
        </div>
      </footer>
    </div>
  );
}
