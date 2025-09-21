from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings

app = FastAPI(title="Podium Backend", version="0.1.0")

# Load settings once and attach to app.state for easy access
settings = get_settings()
app.state.settings = settings

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

