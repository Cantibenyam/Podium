"use client";

import { AudioRecorderWithVisualizer } from "@/components/voice";
import { WalkableStage } from "@/components/walkers";
import { seedBots } from "@/lib/mockAudience";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function ScenePage() {
  const searchParams = useSearchParams();
  const seedParam = Number(searchParams.get("seed"));
  const seed = Number.isFinite(seedParam) ? seedParam : 42;
  const bots = useMemo(() => seedBots(6, 12, seed), [seed]);
  // reactions handled inside walkers speech bubbles; grid logic removed

  return (
    <div className="h-full min-h-0 overflow-hidden grid grid-rows-[1fr_auto] grid-cols-[80px_1fr] gap-3 p-4 md:grid-cols-[110px_1fr] md:gap-4 md:p-5">
      {/* Coach bubble (left) */}
      <aside className="row-start-1 col-start-1 flex items-center justify-center">
        <div
          className="size-20 rounded-full border bg-card text-card-foreground flex items-center justify-center text-xs font-medium"
          aria-label="Coach"
        >
          Coach
        </div>
      </aside>

      {/* Walkable stage (center) */}
      <main className="row-start-1 col-start-2">
        <WalkableStage bots={bots} />
      </main>

      {/* Voice visualization + transcript (bottom) */}
      <footer className="col-span-2">
        <div className="rounded-xl py-3 px-4 flex items-center justify-center text-sm ">
          <div className="w-full max-w-5xl mx-auto">
            <AudioRecorderWithVisualizer />
          </div>
        </div>
      </footer>
    </div>
  );
}
