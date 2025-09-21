from __future__ import annotations

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Request

from app.ws.manager import ConnectionManager


router = APIRouter()


def get_manager(websocket: WebSocket) -> ConnectionManager:
    # Access the globally created manager from app.state in main.py
    return websocket.app.state.ws_manager  # type: ignore[attr-defined]


@router.websocket("/ws/rooms/{roomId}")
async def websocket_room_endpoint(
    websocket: WebSocket,
    roomId: str,
    manager: ConnectionManager = Depends(get_manager),
) -> None:
    await manager.connect(roomId, websocket)
    try:
        # Optional: greet the client
        await websocket.send_json({"event": "ready", "payload": {"roomId": roomId}})
        # Echo loop for now; later we may handle client->server messages
        while True:
            _ = await websocket.receive_text()
            # No-op; server is primarily broadcasting to client in MVP
    except WebSocketDisconnect:
        manager.disconnect(roomId, websocket)


