from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.rooms import router as rooms_router
from app.api.broadcast import router as broadcast_router
from app.ws.manager import ConnectionManager
from app.ws.routes import router as ws_router

app = FastAPI(title="Podium Backend", version="0.1.0")

# Load settings once and attach to app.state for easy access
settings = get_settings()
app.state.settings = settings
app.state.ws_manager = ConnectionManager()

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
app.include_router(ws_router)

