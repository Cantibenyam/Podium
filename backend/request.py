


import httpx
import os
import json

# We assume your Bot models and create_system_prompt function are defined

def createSystemPrompt(bot):
    """Creates the system prompt for a given bot's persona."""
    return f"""
    You are an AI audience member with the following persona:
    - Stance: {bot.personality.stance}
    - Domain: {bot.personality.domain}
    - Snark Level (0-1): {bot.personality.snark}
    - Politeness: {bot.personality.politeness}

    You are listening to a public speech. Based on the last few sentences of the speech, provide a reaction.

    Your response MUST be a single, valid JSON object. Do not include any other text or explanations. The JSON object must have the following keys: "emoji_unicode", "micro_phrase", and "intensity".

    Example:
    {{
    "emoji_unicode": "U+1F914",
    "micro_phrase": "Not sure yet.",
    "intensity": 0
    }}
    """

def generateBotReaction(bot, transcript_chunk):
    """
    Generates a reaction from a bot by calling the OpenRouter API.
    """
    system_prompt = create_system_prompt(bot)
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": transcript_chunk}
    ]

    try:
        response = httpx.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
            },
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
        print(f"API request failed: {e}")
        return None
    except (json.JSONDecodeError, KeyError) as e:
        print(f"Failed to parse API response: {e}")
        return None