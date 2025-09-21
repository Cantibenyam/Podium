from __future__ import annotations
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, Deque, Tuple, Optional

from app.services.bot import Bot as ServiceBot
from app.services.coach import MegaKnight
from app.schemas.room import Bot as SchemaBot, Persona as SchemaPersona

@dataclass
class Room:
    id: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    bots: Dict[str, ServiceBot] = field(default_factory=dict)
    coach: Optional[MegaKnight] = None
    transcript: Deque[Tuple[datetime, str]] = field(default_factory=lambda: deque(maxlen=1000))

class RoomManager:
    def __init__(self) -> None:
        self._rooms: Dict[str, Room] = {}

    def ensure_room(self, room_id: str) -> Room:
        room = self._rooms.get(room_id)
        if room is None:
            room = Room(id=room_id)
            self._rooms[room_id] = room
        return room

    def add_coach_to_room(self, room_id: str, coach: MegaKnight):
        room = self.ensure_room(room_id)
        room.coach = coach

    def get_coach_in_room(self, room_id: str) -> Optional[MegaKnight]:
        room = self.ensure_room(room_id)
        return room.coach

    def add_bot_to_room(self, room_id: str, bot: ServiceBot) -> None:
        room = self.ensure_room(room_id)
        room.bots[bot.id] = bot
        room.updated_at = datetime.now(timezone.utc)

    def remove_bot_from_room(self, room_id: str, bot_id: str) -> None:
        room = self.ensure_room(room_id)
        room.bots.pop(bot_id, None)
        room.updated_at = datetime.now(timezone.utc)

    def append_transcript(self, room_id: str, text: str) -> None:
        room = self.ensure_room(room_id)
        room.transcript.append((datetime.now(timezone.utc), text))
        room.updated_at = datetime.now(timezone.utc)

    def get_transcript_window(self, room_id: str, seconds: int) -> str:
        room = self.ensure_room(room_id)
        if not room.transcript:
            return ""
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=seconds)
        chunks: list[str] = []
        for ts, txt in room.transcript:
            if ts >= cutoff:
                chunks.append(txt)
        return " ".join(chunks).strip()

    def get_service_bots_in_room(self, room_id: str) -> list[ServiceBot]:
        room = self.ensure_room(room_id)
        return list(room.bots.values())

    def get_room_state(self, room_id: str) -> dict:
        room = self.ensure_room(room_id)
        api_bots = [
            SchemaBot(
                id=bot.id,
                name=bot.personality.name,
                avatar="🤖",
                persona=SchemaPersona(
                    stance=bot.personality.stance,
                    domain=bot.personality.domain,
                )
            ) for bot in room.bots.values()
        ]
        
        return {
            "roomId": room.id,
            "bots": api_bots,
            "transcript": self.get_transcript_window(room_id, seconds=60),
            "updatedAt": room.updated_at,
        }