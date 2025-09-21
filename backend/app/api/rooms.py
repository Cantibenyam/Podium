from __future__ import annotations

from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, HTTPException, Request, Depends

from app.schemas.room import (
    CreateRoomRequest,
    CreateRoomResponse,
    RoomState,
    Bot,
)
from app.events.bus import EventBus


router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=CreateRoomResponse, status_code=201)
async def create_room(_: CreateRoomRequest | None = None) -> CreateRoomResponse:
    # For MVP: generate an ID, return it without persistence (RoomManager will handle later)
    room_id = str(uuid.uuid4())
    return CreateRoomResponse(id=room_id, createdAt=datetime.now(timezone.utc))


@router.get("/{roomId}/state", response_model=RoomState)
async def get_room_state(roomId: str, request: Request) -> RoomState:
    if not roomId:
        raise HTTPException(status_code=404, detail="Room not found")
    state = request.app.state.room_manager.get_room_state(roomId)  # type: ignore[attr-defined]
    return RoomState(**state)


def get_bus(request: Request) -> EventBus:
    return request.app.state.event_bus  # type: ignore[attr-defined]


@router.post("/{roomId}/bots", response_model=Bot, status_code=201)
async def add_bot(
    roomId: str,
    bot: Bot,
    request: Request,
    bus: EventBus = Depends(get_bus),
) -> Bot:
    request.app.state.room_manager.add_bot_to_room(roomId, bot)  # type: ignore[attr-defined]
    await bus.publish("bot:join", {"roomId": roomId, "bot": bot.model_dump()})
    return bot


@router.delete("/{roomId}/bots/{botId}", status_code=204)
async def remove_bot(
    roomId: str,
    botId: str,
    request: Request,
    bus: EventBus = Depends(get_bus),
) -> None:
    request.app.state.room_manager.remove_bot_from_room(roomId, botId)  # type: ignore[attr-defined]
    await bus.publish("bot:leave", {"roomId": roomId, "botId": botId})
    return None


@router.get("/{roomId}/transcript")
async def get_transcript_window(roomId: str, request: Request, windowSeconds: int = 60) -> dict:
    text = request.app.state.room_manager.get_transcript_window(roomId, windowSeconds)  # type: ignore[attr-defined]
    return {"roomId": roomId, "windowSeconds": windowSeconds, "text": text}


