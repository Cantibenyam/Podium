from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.rooms import router as rooms_router
from app.api.broadcast import router as broadcast_router
from app.api.events import router as events_router
from app.ws.manager import ConnectionManager
from app.ws.routes import router as ws_router
from app.events.bus import EventBus

app = FastAPI(title="Podium Backend", version="0.1.0")

# Load settings once and attach to app.state for easy access
settings = get_settings()
app.state.settings = settings
app.state.ws_manager = ConnectionManager()
app.state.event_bus = EventBus()

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
app.include_router(ws_router)

# Bridge: when a bot reaction is published on the event bus, broadcast over WS
async def _on_bot_reaction(payload: dict) -> None:
    room_id = payload.get("roomId")
    if not room_id:
        return
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "reaction", "payload": payload},
    )

# Subscribe once at import time (sufficient for single-process dev server)
app.state.event_bus.subscribe("bot:reaction", _on_bot_reaction)

