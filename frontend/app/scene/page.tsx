"use client";

import { AudioRecorderWithVisualizer } from "@/components/voice";
import { WalkableStage } from "@/components/walkers";
import type { Bot as AudienceBot } from "@/lib/mockAudience";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export default function ScenePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // No mock data; bots come from server state and ws join/leave events
  const [roomId] = useState<string | null>(searchParams.get("roomId"));
  const [logs, setLogs] = useState<string[]>([]);
  const [, setBotNames] = useState<Record<string, string>>({});
  const botNamesRef = useRef<Record<string, string>>({});
  const [chat, setChat] = useState<
    {
      type: "transcript" | "reaction";
      senderId: string;
      senderName: string;
      text: string;
      emoji?: string;
    }[]
  >([]);
  const [serverBots, setServerBots] = useState<AudienceBot[]>([]);
  const [showStage, setShowStage] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);
  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_BACKEND_URL as string,
    []
  );
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

  // Guard: require roomId present
  useEffect(() => {
    if (!roomId) {
      router.replace("/");
    }
  }, [roomId, router]);

  // Open websocket when room is ready
  useEffect(() => {
    if (!roomId || !wsBase) return;
    const wsUrl = `${wsBase}/ws/rooms/${roomId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    const add = (msg: string) =>
      setLogs((prev) => [msg, ...prev].slice(0, 200));
    const toEmoji = (unicodeLike?: string): string | undefined => {
      if (!unicodeLike) return undefined;
      // Expect format like "U+1F914"; support multiple codepoints separated by spaces
      try {
        const parts = unicodeLike
          .split(/\s+/)
          .map((p) => p.replace(/^U\+/, ""))
          .filter(Boolean);
        const codePoints = parts.map((h) => parseInt(h, 16));
        return String.fromCodePoint(...codePoints);
      } catch {
        return undefined;
      }
    };
    ws.onopen = () => add(`[ws] connected: ${wsUrl}`);
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(String(evt.data));
        add(`[event] ${data.event} ${JSON.stringify(data.payload)}`);
        const eventType = data?.event as string;
        const payload = data?.payload ?? {};
        if (eventType === "join" && payload.bot) {
          const bot = payload.bot as { id: string; name?: string };
          setBotNames((prev) => ({ ...prev, [bot.id]: bot.name || bot.id }));
          botNamesRef.current = {
            ...botNamesRef.current,
            [bot.id]: bot.name || bot.id,
          };
          // reflect in stage bots collection
          const stageBot = payload.bot as {
            id: string;
            name: string;
            avatar?: string;
          };
          setServerBots((prev) => {
            if (prev.some((b) => b.id === stageBot.id)) return prev;
            return [
              ...prev,
              {
                id: stageBot.id,
                name: stageBot.name,
                avatar: stageBot.avatar || "🤖",
              },
            ];
          });
        } else if (eventType === "leave" && payload.botId) {
          const id = payload.botId as string;
          setBotNames((prev) => {
            const next = { ...prev } as Record<string, string>;
            delete next[id];
            return next;
          });
          const nextRef = { ...botNamesRef.current } as Record<string, string>;
          delete nextRef[id];
          botNamesRef.current = nextRef;
          setServerBots((prev) => prev.filter((b) => b.id !== id));
        } else if (eventType === "transcript" && payload.text) {
          setChat((prev) => [
            ...prev,
            {
              type: "transcript",
              senderId: "you",
              senderName: "You",
              text: String(payload.text),
            },
          ]);
        } else if (
          eventType === "reaction" &&
          payload.botId &&
          payload.reaction
        ) {
          const botId = String(payload.botId);
          const name = botNamesRef.current[botId] || botId;
          const text = String(payload.reaction?.micro_phrase || "").trim();
          const emoji = toEmoji(String(payload.reaction?.emoji_unicode || ""));
          if (text) {
            setChat((prev) => [
              ...prev,
              {
                type: "reaction",
                senderId: botId,
                senderName: name,
                text,
                emoji,
              },
            ]);
          }
        }
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

  // Fetch initial room state (bots) from server
  useEffect(() => {
    if (!roomId || !apiBase) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/rooms/${roomId}/state`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          bots?: Array<{ id: string; name: string; avatar?: string }>;
        };
        if (cancelled) return;
        const bots: Array<{ id: string; name: string; avatar?: string }> =
          Array.isArray(data?.bots) ? data.bots : [];
        setServerBots(
          bots.map((b) => ({
            id: b.id,
            name: b.name,
            avatar: b.avatar || "🤖",
          }))
        );
        const names: Record<string, string> = {};
        for (const b of bots) names[b.id] = b.name;
        setBotNames(names);
        botNamesRef.current = names;
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, apiBase]);
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
      <main className="row-start-1 col-start-2 relative">
        {/* Toggle button */}
        <button
          className="absolute top-2 left-2 z-50 inline-flex items-center justify-center rounded-md border bg-card text-card-foreground px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
          onClick={() => setShowStage((s) => !s)}
        >
          {showStage ? "Show Logs" : "Show Stage"}
        </button>

        {showStage ? (
          <WalkableStage bots={serverBots} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 h-full">
            <div className="rounded-md border bg-card text-card-foreground p-3 h-full">
              <div className="font-medium mb-2">Chat</div>
              <div className="h-[70vh] overflow-auto text-sm space-y-2">
                {chat.map((m, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {m.senderName} {m.emoji ? ` ${m.emoji}` : ""}
                      </div>
                      <div className="whitespace-pre-wrap break-words">
                        {m.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md border bg-card text-card-foreground p-3 h-full">
              <div className="font-medium mb-2">Backend events</div>
              <div className="h-[70vh] overflow-auto text-xs font-mono space-y-1">
                {logs.map((l, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words">
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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
