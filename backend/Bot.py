import httpx
import os
import json
import asyncio
import random
import uuid
from typing import List
from pydantic import BaseModel, Field

# --- 1. MODELS (from Step 1, unchanged) ---
class BotPersona(BaseModel):
    name: str
    stance: str
    domain: str
    snark: float
    politeness: float

class BotState(BaseModel):
    engagementScore: float = 10.0
    present: bool = True
    memory: List[str] = Field(default_factory=list)

# --- 2. UPDATED PROMPT ---
def create_system_prompt(bot):
    """
    Creates the system prompt, now asking for an engagement score delta.
    """
    return f"""
    You are an AI audience member with the following persona:
        - Stance: {bot.personality.stance}
        - Domain: {bot.personality.domain}
        - Snark Level (0-1): {bot.personality.snark}
        - Politeness: {bot.personality.politeness}

    Based on the provided transcript chunk, you must return a JSON object with your reaction. The JSON must contain three keys:
    1. "emoji_unicode": A single emoji for your reaction.
    2. "micro_phrase": A short phrase (3 words max).
    3. "score_delta": An integer from -5 to +5, representing how much this chunk of text changed your engagement. A negative number means you are less interested, positive means more interested.

    Example:
    {{
    "emoji_unicode": "U+1F610",
    "micro_phrase": "Getting to the point.",
    "score_delta": 2
    }}
    """

# --- 3. REFACTORED BOT CLASS ---
class Bot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    personality: BotPersona
    state: BotState

    def generateReaction(self, transcript_chunk: str):
        """
        This is now a METHOD of the Bot class.
        It generates a reaction by calling the OpenRouter API.
        """
        system_prompt = create_system_prompt(self) # Uses 'self'
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": transcript_chunk}
        ]

        try:
            response = httpx.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}"},
                json={
                    "model": "google/gemma-7b-it:free",
                    "messages": messages
                },
                timeout=10
            )
            response.raise_for_status()
            
            api_response_json = response.json()
            content_string = api_response_json['choices'][0]['message']['content']
            reaction_json = json.loads(content_string)
            
            return reaction_json

        except httpx.RequestError as e:
            print(f"API request failed for bot {self.id}: {e}")
            return None
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Failed to parse API response for bot {self.id}: {e}")
            return None

# --- 4. UPDATED BOT CYCLE ---
async def runBotCycle(bot, session):
    """
    The thinking loop, now updated to use the new bot method and engagement logic.
    """
    while bot.state.present:
        try:
            await asyncio.sleep(random.uniform(6, 10))
            transcript_chunk = session.getTranscriptWindow(seconds=60)
            if not transcript_chunk:
                continue

            # Call the generateReaction METHOD on the bot instance
            reaction_data = bot.generateReaction(transcript_chunk)
            
            if reaction_data:
                # Update engagement score using the LLM's output
                score_delta = reaction_data.get("score_delta", 0)
                bot.state.engagementScore += score_delta
                
                # Broadcast the visible reaction parts to the frontend
                session.broadcastReaction(bot.id, reaction_data)

            # Check if the bot should leave
            if bot.state.engagementScore < -30:
                bot.state.present = False
                session.removeBot(bot.id)

        except Exception as e:
            print(f"Error in bot cycle for {bot.id}: {e}")
            bot.state.present = False
            session.removeBot(bot.id)