import requests
import time
import json

BASE_URL = "http://127.0.0.1:8000"

def run_test():
    # --- Part 1: Create a Room ---
    print("\n▶️ 1. Creating a new room...")
    try:
        response = requests.post(f"{BASE_URL}/rooms")
        response.raise_for_status()
        room_data = response.json()
        room_id = room_data.get("id")
        print(room_id)
        if not room_id:
            print("❌ ERROR: Could not get Room ID from server.")
            return
        print(f"✅ Room created with ID: {room_id}\n")
    except requests.exceptions.RequestException as e:
        print(f"❌ ERROR: Could not connect to the server at {BASE_URL}. Is it running?")
        print(e)
        return

    # --- Part 2: Connect WebSocket Client ---
    print("▶️ 2. Open your browser's developer console NOW.")
    print("   Paste the following command into the console and press Enter:\n")
    print("\033[1;33m") # Start yellow text
    print(f"const ws = new WebSocket('ws://127.0.0.1:8000/ws/rooms/{room_id}'); ws.onmessage = (e) => console.log(JSON.parse(e.data));")
    print("\033[0m") # Reset text color
    input("\nPress [Enter] in this terminal after you have connected the WebSocket client...")

    # --- Part 3: Add Bots ---
    print("\n▶️ 3. Adding 3 bots to the room...")
    try:
        for _ in range(3):
            requests.post(f"{BASE_URL}/rooms/{room_id}/bots")
        print("✅ Bots added. Check your browser console for 'join' events.")
        time.sleep(2)
    except requests.exceptions.RequestException as e:
        print(f"❌ ERROR: Failed to add bots. {e}")
        return

    # --- Part 4: Simulate Speech ---
    print("\n▶️ 4. Simulating a speech by sending transcript chunks...")
    print("   (Watch the browser console for 'transcript' and 'reaction' events)")
    try:
        speech_parts = [
            "Good morning everyone. Today we are going to discuss our quarterly results.",
            "As you can see, we have exceeded our targets in every key metric.",
            "This success is a testament to the hard work of every single person on this team."
        ]
        for part in speech_parts:
            payload = {"roomId": room_id, "text": part}
            requests.post(f"{BASE_URL}/webhooks/deepgram", json=payload)
            print(f"   - Sent: '{part}'")
            time.sleep(5) # Wait for AI reactions
        print("✅ Speech simulation complete.")
        time.sleep(2)
    except requests.exceptions.RequestException as e:
        print(f"❌ ERROR: Failed to send transcript. {e}")
        return

    # --- Part 5: Get Coach Feedback ---
    print("\n▶️ 5. Ending the session and requesting final feedback from the coach...")
    try:
        requests.post(f"{BASE_URL}/rooms/{room_id}/feedback")
        print("✅ Feedback requested. Check your browser console for the 'coach_feedback' event.\n")
    except requests.exceptions.RequestException as e:
        print(f"❌ ERROR: Failed to request feedback. {e}")
        return
        
    print("🎉 Test Finished!")

if __name__ == "__main__":
    run_test()