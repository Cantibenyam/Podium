from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import random

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
app.state.transcript_buffer = TranscriptBuffer(max_interval_s=1.0)
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
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "reaction", "payload": payload},
    )

app.state.event_bus.subscribe("bot:reaction", _on_bot_reaction)

async def _on_transcript_chunk(payload: dict) -> None:
    room_id = payload.get("roomId")
    text_chunk = payload.get("text", "")
    if not room_id or not text_chunk:
        return

    app.state.room_manager.append_transcript(room_id, text_chunk)
    await app.state.ws_manager.broadcast_json(
        room_id, {"event": "transcript", "payload": payload}
    )

    coach = app.state.room_manager.get_coach_in_room(room_id)
    if coach:
        coach.accumulate_transcript(text_chunk)
    
    bots_in_room = app.state.room_manager.get_service_bots_in_room(room_id)
    async def generate_and_publish_reactions():
        tasks = [bot.generateReaction(text_chunk) for bot in bots_in_room]
        reactions = await asyncio.gather(*tasks)
        for i, reaction in enumerate(reactions):
            if reaction:
                # Stagger reactions to make them feel more natural
                await asyncio.sleep(0.5 + random.random())
                await app.state.event_bus.publish(
                    "bot:reaction",
                    {"roomId": room_id, "botId": bots_in_room[i].id, "reaction": reaction},
                )
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