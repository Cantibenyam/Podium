from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import random
import time

from app.core.config import get_settings
from app.api.rooms import router as rooms_router
from app.api.broadcast import router as broadcast_router
from app.api.events import router as events_router
from app.ws.manager import ConnectionManager
from app.ws.routes import router as ws_router
from app.events.bus import EventBus
from app.api.webhooks import router as webhooks_router
from app.services.transcript_buffer import TranscriptBuffer
from app.services.bot import Bot
from app.state.room_manager import RoomManager
from app.core import registry
from typing import Optional
from app.services.reaction_config import (
    CATEGORIES,
    EMOJI,
    TEMPLATES,
    ESCALATE_ON_QUESTION_STANCES,
    STAGE2_TIMEOUT_S,
    DEFAULT_PHRASE,
    choose_emoji_phrase,
    score_text,
    map_score_to_bucket,
    get_phrases,
)

app = FastAPI(title="Podium Backend", version="0.1.0")

settings = get_settings()
app.state.settings = settings
app.state.ws_manager = ConnectionManager()
app.state.event_bus = EventBus()
app.state.transcript_buffer = TranscriptBuffer(max_interval_s=7.0, flush_on_interval=True)
app.state.room_manager = RoomManager()
registry.bind(app)

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
app.include_router(webhooks_router)
app.include_router(ws_router)

async def _on_bot_reaction(payload: dict) -> None:
    room_id = payload.get("roomId")
    if not room_id:
        return
    print(f"[ws] broadcasting reaction room={room_id} bot={payload.get('botId')}")
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "reaction", "payload": payload},
    )

app.state.event_bus.subscribe("bot:reaction", _on_bot_reaction)

async def _on_transcript_chunk(payload: dict) -> None:
    room_id = payload.get("roomId")
    text_chunk = payload.get("text", "")
    flush_meta = payload.get("flush_meta") or {}

    app.state.room_manager.append_transcript(room_id, text_chunk)
    await app.state.ws_manager.broadcast_json(
        room_id, {"event": "transcript", "payload": payload}
    )

    bots_in_room = app.state.room_manager.get_service_bots_in_room(room_id)

    def stage1_react(bot: Bot, text: str, fm: dict) -> dict:
        is_question = bool(fm.get("question"))
        is_exclaim = bool(fm.get("exclaim"))
        stutters = int(fm.get("stutter_count") or 0)
        rhet = bool(fm.get("rhetorical_pause"))

        cat: Optional[str] = app.state.room_manager.get_category(room_id)
        stance = getattr(bot.personality, "stance", "supportive")
        domain = getattr(bot.personality, "domain", "tech")

        score = score_text(text, cat, stance, domain, is_question, is_exclaim)
        bucket = map_score_to_bucket(score, is_question)

        if stance == "supportive" and bucket == "neutral":
            bucket = "positive"
        elif stance == "skeptical" and bucket == "neutral":
            bucket = "curious"
        if stutters > 0:
            bucket = "positive" if stance == "supportive" else "curious"
        if rhet and bucket in ("neutral", "curious"):
            bucket = "anticipation"

        emoji, phrase, delta = choose_emoji_phrase(bucket, stance, domain, stutters, rhet)
        # ensure phrase variance; rotate within available phrases deterministically
        if phrase:
            phrases = get_phrases(stance, bucket, domain)
            if len(phrases) > 1:
                # pick next phrase based on recent history length to avoid repeats
                idx = (len(getattr(bot.state, "recentEmojis", [])) or 0) % len(phrases)
                phrase = phrases[idx]
        # anti-repetition LRU (size 5)
        recent = getattr(bot.state, "recentEmojis", [])
        if emoji in recent and len(recent) > 0:
            emoji = recent[-1]
        recent = (recent + [emoji])[-5:]
        bot.state.recentEmojis = recent  # type: ignore[attr-defined]

        return {"emoji_unicode": emoji, "micro_phrase": phrase, "score_delta": delta}

    async def generate_and_publish_reactions():
        async def one_bot_react(bot):
            try:

                
                start = asyncio.get_event_loop().time()
                stance = getattr(bot.personality, "stance", "supportive")
                is_question = bool(flush_meta.get("question"))
                # suppression: 30% chance to ignore entirely
                if random.random() < getattr(__import__('app.services.reaction_config', fromlist=['FIRE_SUPPRESSION_PROB']), 'FIRE_SUPPRESSION_PROB', 0.30):
                    reaction = None
                else:
                    # base: allowed only on questions for certain stances
                    escalate_allowed = is_question and (stance in ESCALATE_ON_QUESTION_STANCES)
                    # bias: additional 30% push toward Stage-2 when allowed
                    bias = getattr(__import__('app.services.reaction_config', fromlist=['STAGE2_BIAS_PROB']), 'STAGE2_BIAS_PROB', 0.30)
                    escalate = (random.random() < 0.5) or (escalate_allowed and random.random() < bias)

                    if escalate and escalate_allowed:
                        try:
                            reaction = await asyncio.wait_for(
                                bot.generateReaction(text_chunk), timeout=STAGE2_TIMEOUT_S
                            )
                            if reaction is None:
                                reaction = stage1_react(bot, text_chunk, flush_meta)
                        except Exception:
                            reaction = stage1_react(bot, text_chunk, flush_meta)
                    else:
                        reaction = stage1_react(bot, text_chunk, flush_meta)

                prob_boost = 0.15 if int(flush_meta.get("stutter_count") or 0) > 0 and stance == "supportive" else 0.0
                cooldown = getattr(bot.state, 'cooldownSeconds', 3.0)
                prob = min(1.0, max(0.0, getattr(bot.state, 'reactionProbability', 0.6) + prob_boost))
            except asyncio.TimeoutError:
                print(f"[bot] reaction TIMEOUT room={room_id} bot={bot.id}")
                reaction = {
                    "emoji_unicode": "⏳",
                    "micro_phrase": "Thinking",
                    "score_delta": 0,
                }
            except Exception as e:
                print(f"[bot] reaction ERROR room={room_id} bot={bot.id} err={e}")
                reaction = {
                    "emoji_unicode": "❓",
                    "micro_phrase": "Hmm",
                    "score_delta": 0,
                }
            if reaction:
                elapsed = asyncio.get_event_loop().time() - start
                print(f"[bot] reaction ready room={room_id} bot={bot.id} in {elapsed:.2f}s")
                now = time.monotonic()
                should_react = True
                try:
                    last_ts = bot.state.lastReactionTs  # type: ignore[attr-defined]
                    cooldown = getattr(bot.state, 'cooldownSeconds', 3.0)
                    prob = locals().get('prob', getattr(bot.state, 'reactionProbability', 0.6))
                    if now - last_ts < cooldown:
                        should_react = False
                    elif random.random() > prob:
                        should_react = False
                except Exception:
                    should_react = True

                if should_react:
                    bot.state.lastReactionTs = now  # type: ignore[attr-defined]
                    print(f"[bot] publishing reaction room={room_id} bot={bot.id}")
                    # emit debug events about decision path
                    await app.state.ws_manager.broadcast_json(
                        room_id,
                        {"event": "reaction_debug", "payload": {
                            "roomId": room_id,
                            "botId": bot.id,
                            "decision": {
                                "is_question": bool(flush_meta.get("question")),
                                "escalate_question": escalate_question if 'escalate_question' in locals() else False,
                                "escalated": escalate if 'escalate' in locals() else False,
                                "timeout_s": STAGE2_TIMEOUT_S if ('escalate' in locals() and escalate) else 0,
                            },
                            "reaction": reaction,
                        }}
                    )
                    await app.state.event_bus.publish(
                        "bot:reaction",
                        {"roomId": room_id, "botId": bot.id, "reaction": reaction},
                    )
                else:
                    print(f"[bot] reaction suppressed room={room_id} bot={bot.id}")
            else:
                print(f"[bot] NO REACTION room={room_id} bot={bot.id}")

        for bot in bots_in_room:
            print(f"[bot] start reaction room={room_id} bot={bot.id}")
            asyncio.create_task(one_bot_react(bot))

    asyncio.create_task(generate_and_publish_reactions())

app.state.event_bus.subscribe("transcript:chunk", _on_transcript_chunk)

async def _on_bot_join(payload: dict) -> None:
    room_id = payload.get("roomId")
    bot = payload.get("bot")
    if not room_id or not bot:
        return
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "join", "payload": {"bot": bot}},
    )

async def _on_bot_leave(payload: dict) -> None:
    room_id = payload.get("roomId")
    bot_id = payload.get("botId")
    if not room_id or not bot_id:
        return
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "leave", "payload": {"botId": bot_id}},
    )

app.state.event_bus.subscribe("bot:join", _on_bot_join)
app.state.event_bus.subscribe("bot:leave", _on_bot_leave)

async def _on_coach_feedback(payload: dict) -> None:
    room_id = payload.get("roomId")
    if not room_id:
        return
    await app.state.ws_manager.broadcast_json(
        room_id,
        {"event": "coach_feedback", "payload": payload},
    )

app.state.event_bus.subscribe("coach:feedback", _on_coach_feedback)