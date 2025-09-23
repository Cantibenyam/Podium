from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import random
import time

from app.core.config import get_settings
from app.api.rooms import router as rooms_router
from app.api.broadcast import router as broadcast_router
from app.api.events import router as events_router
from app.ws.manager import ConnectionManager
from app.ws.routes import router as ws_router
from app.events.bus import EventBus
from app.api.webhooks import router as webhooks_router
from app.services.transcript_buffer import TranscriptBuffer
from app.state.room_manager import RoomManager
from app.core import registry

app = FastAPI(title="Podium Backend", version="0.1.0")

settings = get_settings()
app.state.settings = settings
app.state.ws_manager = ConnectionManager()
app.state.event_bus = EventBus()
app.state.transcript_buffer = TranscriptBuffer(max_interval_s=1.0, flush_on_interval=False)
app.state.room_manager = RoomManager()
registry.bind(app)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}

app.include_router(rooms_router)
app.include_router(broadcast_router)
app.include_router(events_router)
app.include_router(webhooks_router)
app.include_router(ws_router)

async def _on_bot_reaction(payload: dict) -> None:
    room_id = payload.get("roomId")
    if not room_id:
        return
    print(f"[ws] broadcasting reaction room={room_id} bot={payload.get('botId')}")
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "reaction", "payload": payload},
    )

app.state.event_bus.subscribe("bot:reaction", _on_bot_reaction)

async def _on_transcript_chunk(payload: dict) -> None:


    room_id = payload.get("roomId")
    text_chunk = payload.get("text", "")

    app.state.room_manager.append_transcript(room_id, text_chunk)
    await app.state.ws_manager.broadcast_json(
        room_id, {"event": "transcript", "payload": payload}
    )

    # coach = app.state.room_manager.get_coach_in_room(room_id)
    # if coach:
    #     coach.accumulate_transcript(text_chunk)
    
    bots_in_room = app.state.room_manager.get_service_bots_in_room(room_id)


    async def generate_and_publish_reactions():
        # Fire-and-forget per-bot with individual timeouts; publish as each finishes
        async def one_bot_react(bot):
            try:
                start = asyncio.get_event_loop().time()
                reaction = await asyncio.wait_for(bot.generateReaction(text_chunk), timeout=8.0)
            except asyncio.TimeoutError:
                print(f"[bot] reaction TIMEOUT room={room_id} bot={bot.id}")
                reaction = {
                    "emoji_unicode": "U+23F3",  # hourglass
                    "micro_phrase": "Thinking",
                    "score_delta": 0,
                }
            except Exception as e:
                print(f"[bot] reaction ERROR room={room_id} bot={bot.id} err={e}")
                reaction = {
                    "emoji_unicode": "U+2753",  # question mark
                    "micro_phrase": "Hmm",
                    "score_delta": 0,
                }
            if reaction:
                elapsed = asyncio.get_event_loop().time() - start
                print(f"[bot] reaction ready room={room_id} bot={bot.id} in {elapsed:.2f}s")
                # Probabilistic gating + per-bot cooldown
                now = time.monotonic()
                should_react = True
                try:
                    last_ts = bot.state.lastReactionTs  # type: ignore[attr-defined]
                    cooldown = getattr(bot.state, 'cooldownSeconds', 3.0)
                    prob = getattr(bot.state, 'reactionProbability', 0.6)
                    if now - last_ts < cooldown:
                        should_react = False
                    elif random.random() > prob:
                        should_react = False
                except Exception:
                    should_react = True

                if should_react:
                    bot.state.lastReactionTs = now  # type: ignore[attr-defined]
                    print(f"[bot] publishing reaction room={room_id} bot={bot.id}")
                    await app.state.event_bus.publish(
                        "bot:reaction",
                        {"roomId": room_id, "botId": bot.id, "reaction": reaction},
                    )
                else:
                    print(f"[bot] reaction suppressed room={room_id} bot={bot.id}")
            else:
                print(f"[bot] NO REACTION room={room_id} bot={bot.id}")

        for bot in bots_in_room:
            print(f"[bot] start reaction room={room_id} bot={bot.id}")
            asyncio.create_task(one_bot_react(bot))

    
    asyncio.create_task(generate_and_publish_reactions())

app.state.event_bus.subscribe("transcript:chunk", _on_transcript_chunk)

async def _on_bot_join(payload: dict) -> None:
    room_id = payload.get("roomId")
    bot = payload.get("bot")
    if not room_id or not bot:
        return
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "join", "payload": {"bot": bot}},
    )

async def _on_bot_leave(payload: dict) -> None:
    room_id = payload.get("roomId")
    bot_id = payload.get("botId")
    if not room_id or not bot_id:
        return
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "leave", "payload": {"botId": bot_id}},
    )

app.state.event_bus.subscribe("bot:join", _on_bot_join)
app.state.event_bus.subscribe("bot:leave", _on_bot_leave)

async def _on_coach_feedback(payload: dict) -> None:
    room_id = payload.get("roomId")
    if not room_id:
        return
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "coach_feedback", "payload": payload},
    )

app.state.event_bus.subscribe("coach:feedback", _on_coach_feedback)