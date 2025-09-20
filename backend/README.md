# Backend: AI Audience Orchestrator

This backend is a Python [FastAPI](https://fastapi.tiangolo.com/) application responsible for managing the AI audience, processing transcription data, and communicating with the frontend via WebSockets.

## Architecture & Data Flow

The application is designed to be real-time and event-driven. The core data flow is as follows:

1.  **Audio Processing (Client-side):** The frontend client captures the user's audio and streams it directly to [Deepgram](https://deepgram.com/).
2.  **Transcription Webhook:** Deepgram performs real-time transcription and sends the transcript data to a webhook endpoint on this backend server.
3.  **AI Orchestration:** The backend receives the transcript. An **Orchestrator** module manages the state of the "room" and the AI "bots".
    -   A **Spawner** component decides when bots should join or leave based on engagement metrics (e.g., topic relevance, speaker's pace).
    -   Each **Bot** is an independent AI agent with its own persona and a short-term memory (a 60-second sliding window of the transcript).
4.  **LLM Interaction:** Each bot makes calls to an LLM (via [OpenRouter](https://openrouter.ai/)) to generate reactions (emojis and short phrases) based on its persona and the incoming transcript.
5.  **Real-time Feedback:** The generated reactions are broadcast back to the frontend client over a WebSocket connection.

## API Contract

### HTTP Endpoints

#### `POST /webhooks/deepgram`

-   **Description:** This endpoint receives transcription results from Deepgram.
-   **Body:** The shape of the body will be determined by the Deepgram API. It typically includes transcription text, timestamps, and other metadata.

### WebSocket Communication

-   **Endpoint:** `WS /rooms/{roomId}`
-   **Description:** The primary communication channel for sending real-time events from the server to the client.

#### Server-to-Client Messages

The server will send JSON-formatted messages to the client. Each message will have an `event` type and a `payload`.

-   **`event: 'join'`**
    -   **Description:** Sent when a new bot joins the room.
    -   **Payload:** `{ "bot": Bot }`

-   **`event: 'leave'`**
    -   **Description:** Sent when a bot leaves the room.
    -   **Payload:** `{ "botId": "string" }`

-   **`event: 'reaction'`**
    -   **Description:** Sent when a bot has a reaction to the speech.
    -   **Payload:** `{ "botId": "string", "reaction": { "emoji": "string", "phrase": "string" } }`

### Data Models

```json
// The main Bot object, used in the 'join' event
{
  "id": "string",
  "name": "string",
  "avatar": "string (e.g., '🤖')",
  "persona": {
    "stance": "'supportive' | 'skeptical' | 'curious'",
    "domain": "'tech' | 'design' | 'finance'"
  }
}
```

## Setup

1.  **Install Dependencies:**
    ```bash
    # requirements.txt will be created in a future step
    # pip install -r requirements.txt
    ```

2.  **Environment Variables:**
    Create a `.env` file in this directory by copying the example file:
    ```bash
    cp .env.example .env
    ```
    Then, fill in the required API keys in the new `.env` file.

    -   `DEEPGRAM_API_KEY`: Your API key for the Deepgram service.
    -   `OPENROUTER_API_KEY`: Your API key for the OpenRouter service.
