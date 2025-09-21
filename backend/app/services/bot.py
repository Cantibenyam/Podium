import os
import json
import uuid
from typing import List, Tuple, Literal
from pydantic import BaseModel, Field
from openai import AsyncOpenAI, APIError
from openai.types.chat import ChatCompletionMessageParam

class BotPersona(BaseModel):
    name: str
    stance: Literal["supportive", "skeptical", "curious"]
    domain: Literal["tech", "design", "finance"]
    snark: float
    politeness: float

class BotState(BaseModel):
    engagementScore: float = 10.0
    present: bool = True
    memory: List[str] = Field(default_factory=list)
    engagementHistory: List[Tuple[float, float]] = Field(default_factory=list)

def create_system_prompt(bot):
    return f"""You are an audience member with stance: {bot.personality.stance}, domain: {bot.personality.domain}.

React to the speech with a JSON object containing:
- "emoji_unicode": emoji code (like "U+1F610")
- "micro_phrase": short phrase (max 3 words)
- "score_delta": number from -5 to +5

Example: {{"emoji_unicode": "U+1F610", "micro_phrase": "Interesting point", "score_delta": 1}}"""

class Bot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    personality: BotPersona
    state: BotState

    async def generateReaction(self, transcript_chunk: str):
        if not os.getenv('OPENAI_API_KEY'):
            print(f"❌ ERROR: OPENAI_API_KEY not set for bot {self.id}")
            return None

        client = AsyncOpenAI()
        system_prompt = create_system_prompt(self)
        
        messages: List[ChatCompletionMessageParam] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": transcript_chunk}
        ]

        try:
            response = await client.chat.completions.create(
                model="gpt-5-nano-2025-08-07",
                messages=messages,
                response_format={"type": "json_object"},
                temperature=1.0
            )
            
            content_string = response.choices[0].message.content
            if not content_string:
                return None
            
            return json.loads(content_string)

        except (APIError, KeyError, IndexError, json.JSONDecodeError) as e:
            print(f"Failed to parse or extract content for bot {self.id}: {e}")
            return None