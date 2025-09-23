from __future__ import annotations

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Request
import json

from app.ws.manager import ConnectionManager
from app.events.bus import EventBus


router = APIRouter()


def get_manager(websocket: WebSocket) -> ConnectionManager:
    # Access the globally created manager from app.state in main.py
    return websocket.app.state.ws_manager  # type: ignore[attr-defined]


def get_bus(websocket: WebSocket) -> EventBus:
    return websocket.app.state.event_bus  # type: ignore[attr-defined]


@router.websocket("/ws/rooms/{roomId}")
async def websocket_room_endpoint(
    websocket: WebSocket,
    roomId: str,
    manager: ConnectionManager = Depends(get_manager),
    bus: EventBus = Depends(get_bus),
) -> None:
    await manager.connect(roomId, websocket)
    try:
        # Optional: greet the client
        await websocket.send_json({"event": "ready", "payload": {"roomId": roomId}})
        # Client->server messages: handle client_transcript (room-aware)
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception:
                continue
            event = data.get("event")
            payload = data.get("payload") or {}
            if event == "client_transcript":
                text = payload.get("text")
                if isinstance(text, str) and text.strip():
                    flushed, chunk = websocket.app.state.transcript_buffer.append(roomId, text.strip())  # type: ignore[attr-defined]
                    if flushed and chunk:
                        await websocket.app.state.event_bus.publish(  # type: ignore[attr-defined]
                            "transcript:chunk", {"roomId": roomId, "text": chunk}
                        )
    except WebSocketDisconnect:
        manager.disconnect(roomId, websocket)


