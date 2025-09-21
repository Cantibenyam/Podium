from __future__ import annotations

from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, HTTPException

from app.schemas.room import (
    CreateRoomRequest,
    CreateRoomResponse,
    RoomState,
)


router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=CreateRoomResponse, status_code=201)
async def create_room(_: CreateRoomRequest | None = None) -> CreateRoomResponse:
    # For MVP: generate an ID, return it without persistence (RoomManager will handle later)
    room_id = str(uuid.uuid4())
    return CreateRoomResponse(id=room_id, createdAt=datetime.now(timezone.utc))


@router.get("/{roomId}/state", response_model=RoomState)
async def get_room_state(roomId: str) -> RoomState:
    # MVP: return empty room state; real state will come from RoomManager later
    if not roomId:
        raise HTTPException(status_code=404, detail="Room not found")
    return RoomState(
        roomId=roomId,
        bots=[],
        transcript="",
        updatedAt=datetime.now(timezone.utc),
    )


