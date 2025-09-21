from __future__ import annotations
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, HTTPException, Request, Depends

from app.schemas.room import (
    CreateRoomRequest,
    CreateRoomResponse,
    RoomState,
    Bot as SchemaBot,
    Persona as SchemaPersona,
)
from app.events.bus import EventBus
from app.services.bot_spawner import createBotFromPool, generatePersonaPool
from app.services.coach import create_megaknight_coach

router = APIRouter(prefix="/rooms", tags=["rooms"])

@router.post("", response_model=CreateRoomResponse, status_code=201)
async def create_room(request: Request, _: CreateRoomRequest | None = None) -> CreateRoomResponse:
    room_id = str(uuid.uuid4())
    
    coach = create_megaknight_coach()
    request.app.state.room_manager.add_coach_to_room(room_id, coach)
    
    for i in range(10):
        await add_bot(room_id, request, bus = request.app.state.event_bus) 

    return CreateRoomResponse(id=room_id, createdAt=datetime.now(timezone.utc))

@router.get("/{roomId}/state", response_model=RoomState)
async def get_room_state(roomId: str, request: Request) -> RoomState:
    if not roomId:
        raise HTTPException(status_code=404, detail="Room not found")
    state = request.app.state.room_manager.get_room_state(roomId)
    return RoomState(**state)

def get_bus(request: Request) -> EventBus:
    return request.app.state.event_bus

@router.post("/{roomId}/bots", response_model=SchemaBot, status_code=201)
async def add_bot(
    roomId: str,
    request: Request,
    bus: EventBus = Depends(get_bus),
) -> SchemaBot:
    persona_pool = await generatePersonaPool(topic="AI Presentations", count=1)
    new_bot_instance = createBotFromPool(persona_pool)

    if not new_bot_instance:
        raise HTTPException(status_code=500, detail="Failed to create a new bot.")

    request.app.state.room_manager.add_bot_to_room(roomId, new_bot_instance)

    bot_for_api = SchemaBot(
        id=new_bot_instance.id,
        name=new_bot_instance.personality.name,
        avatar="🤖",
        persona=SchemaPersona(
            stance=new_bot_instance.personality.stance,
            domain=new_bot_instance.personality.domain,
        )
    )
    
    await bus.publish("bot:join", {"roomId": roomId, "bot": bot_for_api.model_dump()})
    return bot_for_api

@router.delete("/{roomId}/bots/{botId}", status_code=204)
async def remove_bot(
    roomId: str,
    botId: str,
    request: Request,
    bus: EventBus = Depends(get_bus),
) -> None:
    request.app.state.room_manager.remove_bot_from_room(roomId, botId)
    await bus.publish("bot:leave", {"roomId": roomId, "botId": botId})
    return None

@router.post("/{roomId}/feedback", status_code=202)
async def get_final_feedback(roomId: str, request: Request, bus: EventBus = Depends(get_bus)) -> dict:
    room_manager = request.app.state.room_manager
    coach = room_manager.get_coach_in_room(roomId)
    
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found for this room.")
    
    feedback = await coach.generate_end_session_feedback()

    if feedback:
        await bus.publish(
            "coach:feedback",
            {"roomId": roomId, "coachId": coach.id, "feedback": feedback}
        )
        return {"status": "feedback_generation_queued"}
    
    raise HTTPException(status_code=500, detail="Failed to generate feedback.")

@router.get("/{roomId}/transcript")
async def get_transcript_window(roomId: str, request: Request, windowSeconds: int = 60) -> dict:
    text = request.app.state.room_manager.get_transcript_window(roomId, windowSeconds)
    return {"roomId": roomId, "windowSeconds": windowSeconds, "text": text}