from __future__ import annotations

import time
from dataclasses import dataclass


@dataclass
class BufferState:
    text: str
    last_flush_s: float


class TranscriptBuffer:
    """Collects transcript pieces and flushes them in chunks.

    Simple heuristics for MVP:
    - Flush if buffer contains a sentence terminator (. ! ?) OR
    - Flush if more than max_interval_s elapsed since last flush
    """

    def __init__(self, max_interval_s: float = 2.0) -> None:
        self.max_interval_s = max_interval_s
        self._room_to_state: dict[str, BufferState] = {}

    def append(self, room_id: str, piece: str) -> tuple[bool, str]:
        now = time.monotonic()
        state = self._room_to_state.get(room_id)
        if state is None:
            state = BufferState(text="", last_flush_s=now)
            self._room_to_state[room_id] = state
        # Accumulate
        state.text = (state.text + " " + piece).strip()

        should_flush = False
        if any(state.text.endswith(ch) for ch in (".", "!", "?")):
            should_flush = True
        elif now - state.last_flush_s >= self.max_interval_s:
            should_flush = True

        if should_flush and state.text:
            chunk = state.text
            state.text = ""
            state.last_flush_s = now
            return True, chunk

        return False, ""


