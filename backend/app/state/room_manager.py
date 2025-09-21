from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, Deque, Tuple

from app.schemas.room import Bot


@dataclass
class Room:
    id: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    bots: Dict[str, Bot] = field(default_factory=dict)
    # store (timestamp, text)
    transcript: Deque[Tuple[datetime, str]] = field(default_factory=lambda: deque(maxlen=1000))


class RoomManager:
    """In-memory state for active rooms (single user/process)."""

    def __init__(self) -> None:
        self._rooms: Dict[str, Room] = {}

    def ensure_room(self, room_id: str) -> Room:
        room = self._rooms.get(room_id)
        if room is None:
            room = Room(id=room_id)
            self._rooms[room_id] = room
        return room

    def add_bot_to_room(self, room_id: str, bot: Bot) -> None:
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

    def get_room_state(self, room_id: str) -> dict:
        room = self.ensure_room(room_id)
        return {
            "roomId": room.id,
            "bots": list(room.bots.values()),
            "transcript": self.get_transcript_window(room_id, seconds=60),
            "updatedAt": room.updated_at,
        }


