import asyncio
import websockets

async def test():
    try:
        async with websockets.connect("ws://localhost:8000/telephony/media") as ws:
            print("Connected!")
            await ws.close()
    except Exception as e:
        print(f"Exception: {e}")

asyncio.run(test())
