import os
import json
import random
from typing import List, Dict, Optional
from openai import AsyncOpenAI, APIError
from openai.types.chat import ChatCompletionMessageParam
from .bot import Bot, BotPersona, BotState

async def _call_openai_api(messages: List[ChatCompletionMessageParam], timeout: int = 30) -> Optional[str]:
    if not os.getenv('OPENAI_API_KEY'):
        print("❌ ERROR: OPENAI_API_KEY environment variable not set.")
        return None
        
    client = AsyncOpenAI()
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.8,
            timeout=timeout
        )
        return response.choices[0].message.content
        
    except (APIError, KeyError, IndexError) as e:
        print(f"Failed to extract content from API response: {e}")
        return None

async def generatePersonaPool(topic: str = "Public Speaking", count: int = 10) -> List[Dict]:
    prompt = f"""
    Generate a list of exactly {count} diverse audience personas for a presentation on "{topic}".
    Your response MUST be a single, valid JSON array containing exactly {count} JSON objects.
    Do not write any text before or after the JSON array.
    Each object must have the following keys and adhere EXACTLY to the specified data types and allowed values:
    - "name": string
    - "stance": string (must be one of "supportive", "skeptical", or "curious")
    - "domain": string (must be one of "tech", "design", or "finance")
    - "snark": float (a JSON number between 0.0 and 1.0)
    - "politeness": float (a JSON number between 0.0 and 1.0)
    """
    messages: List[ChatCompletionMessageParam] = [{"role": "user", "content": prompt}]
    
    content_string = await _call_openai_api(messages)
    
    if content_string:
        try:
            data = json.loads(content_string)
            if isinstance(data, list):
                return data
            if isinstance(data, dict):
                for value in data.values():
                    if isinstance(value, list):
                        return value
            print(f"⚠️ Failed to find a list of personas in the API's JSON response.")

        except json.JSONDecodeError as e:
            print(f"Failed to parse persona pool JSON: {e}")

    print("⚠️ Using fallback persona pool.")
    return [
        {"name": "Engaged Student", "stance": "supportive", "domain": "tech", "snark": 0.1, "politeness": 0.8},
        {"name": "Critical Thinker", "stance": "skeptical", "domain": "finance", "snark": 0.3, "politeness": 0.6},
        {"name": "Curious Designer", "stance": "curious", "domain": "design", "snark": 0.1, "politeness": 0.9}
    ]

def createBotFromPool(persona_pool: list) -> Optional[Bot]:
    if not persona_pool:
        return None
    try:
        random_persona_dict = random.choice(persona_pool)

        persona = BotPersona(**random_persona_dict)
        state = BotState()
        return Bot(personality=persona, state=state)
    except Exception as e:
        print(f"Error creating bot from pool: {e}")
        return None