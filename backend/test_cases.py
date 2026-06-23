import asyncio
import json
import os
from unittest.mock import patch

# Mock all external dependencies before importing main
import sys
from unittest.mock import MagicMock, AsyncMock

sys.modules['torch'] = MagicMock()
sys.modules['torchaudio'] = MagicMock()
sys.modules['faster_whisper'] = MagicMock()
sys.modules['transformers'] = MagicMock()
sys.modules['numpy'] = MagicMock()
sys.modules['psutil'] = MagicMock()
sys.modules['uvicorn'] = MagicMock()

# We need actual fastapi WebSocket exception to catch it
class WebSocketDisconnect(Exception):
    pass
sys.modules['fastapi'] = MagicMock()
sys.modules['fastapi.middleware'] = MagicMock()
sys.modules['fastapi.middleware.cors'] = MagicMock()
sys.modules['fastapi.responses'] = MagicMock()
sys.modules['fastapi'].WebSocketDisconnect = WebSocketDisconnect
sys.modules['fastapi'].WebSocket = MagicMock()

# Make the websocket decorator pass through the function untouched
def pass_through(*args, **kwargs):
    def decorator(func):
        return func
    return decorator

fastapi_mock = MagicMock()
fastapi_mock.websocket = pass_through
fastapi_mock.get = pass_through
fastapi_mock.post = pass_through
sys.modules['fastapi'].FastAPI = lambda *args, **kwargs: fastapi_mock
sys.modules['fastapi'].APIRouter = lambda *args, **kwargs: fastapi_mock

sys.modules['pydantic'] = MagicMock()
sys.modules['sqlalchemy'] = MagicMock()
sys.modules['sqlalchemy.orm'] = MagicMock()

# Mock database imports to prevent database.py from throwing errors about sqlalchemy
sys.modules['database'] = MagicMock()

# Mock VAD
mock_vad = MagicMock()
sys.modules['webrtcvad'] = MagicMock(Vad=lambda x: mock_vad)

import main

class MockWebsocket:
    def __init__(self):
        self.sent_messages = []
        self.receive_queue = asyncio.Queue()
        self.accepted = False
        self.closed = False

    async def accept(self):
        self.accepted = True

    async def send_text(self, data):
        self.sent_messages.append({"type": "text", "data": data})
        print(f"[WS SENT] {data}")

    async def send_bytes(self, data):
        self.sent_messages.append({"type": "bytes", "length": len(data)})
        print(f"[WS SENT BYTES] length: {len(data)}")

    async def receive_bytes(self):
        data = await self.receive_queue.get()
        if data is None:
            from fastapi import WebSocketDisconnect
            raise WebSocketDisconnect()
        return data

async def run_tests():
    # Setup mocks
    main.run_whisper = MagicMock(return_value="xin chào")
    main.run_gemma = MagicMock(return_value="CHAO_HOI")
    main.vad = mock_vad
    
    print("="*50)
    print("TEST 1: Normal Case (Short speech 2s, then silence)")
    print("="*50)
    ws1 = MockWebsocket()
    
    # 2 seconds of speech = ~66 frames of 30ms (960 bytes each)
    # Then 1 second of silence = ~33 frames
    frames1 = [(True, b'\x01' * 960) for _ in range(66)] + [(False, b'\x00' * 960) for _ in range(33)]
    
    async def feed_data(ws, frames):
        for is_speech, data in frames:
            mock_vad.is_speech.return_value = is_speech
            await ws.receive_queue.put(data)
            await asyncio.sleep(0.001)
        await ws.receive_queue.put(None) # trigger disconnect
        
    task1 = asyncio.create_task(main.websocket_voice_agent(ws1))
    await feed_data(ws1, frames1)
    await task1
    
    thinking_msgs = [m for m in ws1.sent_messages if m.get("type") == "text" and "THINKING" in m.get("data", "")]
    assert len(thinking_msgs) >= 1, "Failed Test 1: No THINKING state"
    print("✅ TEST 1 PASSED")
    
    
    print("\n" + "="*50)
    print("TEST 2: Long Speech Case (Speech for 16 seconds)")
    print("="*50)
    ws2 = MockWebsocket()
    
    # 16 seconds of speech = ~533 frames of 30ms
    frames2 = [(True, b'\x01' * 960) for _ in range(533)]
    
    task2 = asyncio.create_task(main.websocket_voice_agent(ws2))
    await feed_data(ws2, frames2)
    await task2
    
    thinking_msgs = [m for m in ws2.sent_messages if m.get("type") == "text" and "THINKING" in m.get("data", "")]
    assert len(thinking_msgs) >= 1, "Failed Test 2: No THINKING state"
    print("✅ TEST 2 PASSED")
    
    
    print("\n" + "="*50)
    print("TEST 3: Missing Audio Case")
    print("="*50)
    # Call get_prerecorded_audio with an intent that doesn't exist
    wav_bytes = main.get_prerecorded_audio("INTENT_DOES_NOT_EXIST")
    assert len(wav_bytes) == 32000, f"Failed Test 3: Expected 32000 bytes, got {len(wav_bytes)}"
    print("✅ TEST 3 PASSED")

if __name__ == "__main__":
    asyncio.run(run_tests())
