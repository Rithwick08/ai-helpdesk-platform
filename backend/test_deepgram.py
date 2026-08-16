import asyncio
from voice.stt.deepgram_client import get_deepgram_client
from voice.stt.deepgram_service import DEEPGRAM_MODEL, DEEPGRAM_LANGUAGE

async def test():
    client = get_deepgram_client()
    ctx = client.listen.v1.connect(
        model=DEEPGRAM_MODEL,
        language=DEEPGRAM_LANGUAGE,
        encoding="mulaw",
        sample_rate=8000,
        interim_results=True,
    )
    socket = await ctx.__aenter__()
    print("Socket type:", type(socket))
    print("Connected.")
    
    # We will send a bit of dummy audio
    await socket.send_media(b"\x00" * 1600)
    await socket.send_finalize()
    
    async for message in socket:
        print("Message type:", type(message))
        print("Message content:", message)
        break
    await ctx.__aexit__(None, None, None)

asyncio.run(test())
