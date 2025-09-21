"use client";

import { AudioRecorderWithVisualizer } from "@/components/voice";
// import { WalkableStage } from "@/components/walkers";
// import { seedBots } from "@/lib/mockAudience";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export default function ScenePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // const seedParam = Number(searchParams.get("seed"));
  // const seed = Number.isFinite(seedParam) ? seedParam : 42;
  // const bots = useMemo(() => seedBots(6, 12, seed), [seed]);
  const [roomId, setRoomId] = useState<string | null>(
    searchParams.get("roomId")
  );
  const [logs, setLogs] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_BACKEND_URL || "", []);
  const wsBase = useMemo(() => {
    if (!apiBase) return "";
    try {
      const url = new URL(apiBase);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return url.origin;
    } catch {
      return "";
    }
  }, [apiBase]);

  // Create room if not present
  useEffect(() => {
    let cancelled = false;
    async function ensureRoom() {
      if (roomId || !apiBase) return;
      try {
        const res = await fetch(`${apiBase}/rooms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!res.ok) throw new Error(`Create room failed: ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setRoomId(data.id);
          // Add roomId to URL without losing current params
          const params = new URLSearchParams(
            Array.from(searchParams.entries())
          );
          params.set("roomId", data.id);
          router.replace(`/scene?${params.toString()}`);
        }
      } catch (err) {
        setLogs((l) => [
          `[error] ${String(
            err
          )}. Set NEXT_PUBLIC_BACKEND_URL and CORS on backend.`,
          ...l,
        ]);
      }
    }
    ensureRoom();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, apiBase]);

  // Open websocket when room is ready
  useEffect(() => {
    if (!roomId || !wsBase) return;
    const wsUrl = `${wsBase}/ws/rooms/${roomId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    const add = (msg: string) =>
      setLogs((prev) => [msg, ...prev].slice(0, 200));
    ws.onopen = () => add(`[ws] connected: ${wsUrl}`);
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(String(evt.data));
        add(`[event] ${data.event} ${JSON.stringify(data.payload)}`);
      } catch {
        add(`[message] ${String(evt.data)}`);
      }
    };
    ws.onerror = () => add(`[ws] error`);
    ws.onclose = () => add(`[ws] closed`);
    return () => {
      try {
        ws.close();
      } catch {}
      wsRef.current = null;
    };
  }, [roomId, wsBase]);
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
        {/* Temporarily hidden while wiring backend -> frontend events */}
        {/* <WalkableStage bots={bots} /> */}
        <div className="rounded-md border bg-card text-card-foreground p-3 h-full">
          <div className="font-medium mb-2">Backend events</div>
          <div className="h-[50vh] overflow-auto text-xs font-mono space-y-1">
            {logs.map((l, i) => (
              <div key={i} className="whitespace-pre-wrap break-words">
                {l}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Voice visualization + transcript (bottom) */}
      <footer className="col-span-2">
        <div className="rounded-xl py-3 px-4 flex items-center justify-center text-sm ">
          <div className="w-full max-w-5xl mx-auto">
            <AudioRecorderWithVisualizer
              roomId={roomId || undefined}
              apiBase={apiBase}
            />
          </div>
        </div>
      </footer>
    </div>
  );
}
