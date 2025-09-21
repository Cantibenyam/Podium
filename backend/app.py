import Bot.py
import asyncio


def main():


def runSpawner (session):
    for i in range (10):
        new_bot = createBotFromPool()
        session.addBot(new_bot)
        asyncio.create_task(runBotCycle(new_bot, session))

import json
import httpx
import os
import random

# We assume your Bot models are defined elsewhere

def generatePersonaPool(topic: str = "Flying Cars are Bad", count: int = 10):
    """
    Uses an LLM to generate a pool of potential bot personas based on a topic.
    """
    prompt = f"""
    You are a creative director casting an audience for a tech presentation.
    The topic of the presentation is: "{topic}"

    Your task is to generate a list of {count} diverse and realistic audience personas. Some should be supportive, some skeptical, some neutral. They should come from different professional domains relevant to the topic.

    You MUST return a single, valid JSON array. Each element in the array must be an object with the following keys and value types:
    - "name": str (e.g., "Skeptical Engineer")
    - "stance": str ("supportive", "skeptical", or "neutral")
    - "domain": str (e.g., "finance", "product", "marketing")
    - "snark": float (a value between 0.0 and 1.0)
    - "politeness": float (a value between 0.0 and 1.0)

    Do not include any other text or explanations in your response.
    """
    
    try:
        response = httpx.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}"},
            json={
                "model": "openai/gpt-3.5-turbo", # A model good at creative generation
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=30 # Allow more time for a larger generation
        )
        response.raise_for_status()
        
        persona_list = response.json()['choices'][0]['message']['content']
        return json.loads(persona_list)

    except Exception as e:
        print(f"Failed to generate persona pool: {e}")
        # Return a fallback list of generic personas on failure
        return [
            {"name": "Neutral Attendee", "stance": "neutral", "domain": "general", "snark": 0.2, "politeness": 0.6},
            {"name": "Supportive Colleague", "stance": "supportive", "domain": "general", "snark": 0.1, "politeness": 0.8}
        ]

# We assume your Bot, BotPersona, and BotState classes are defined

def createBotFromPool(persona_pool: list):
    """
    Randomly selects a persona from the pool and creates a new Bot instance.
    """
    # Pick a random persona dictionary from the list
    random_persona_dict = random.choice(persona_pool)
    
    # Create the Pydantic model instances
    persona = BotPersona(**random_persona_dict)
    state = BotState()
    
    # Create and return the final Bot object
    return Bot(personality=persona, state=state)