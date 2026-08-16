import asyncio
import base64
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
    
    async def listen():
        try:
            async for msg in socket:
                try:
                    t = msg.channel.alternatives[0].transcript
                    print("Received transcript:", repr(t), "final:", msg.is_final)
                except Exception as e:
                    print("Msg missing transcript", e)
        except Exception as e:
            print("listen error:", e)

    asyncio.create_task(listen())
    
    # Read a sample mulaw file
    with open("debug_twilio.wav", "rb") as f:
        # Skip wav header
        f.read(44)
        audio = f.read()
    
    # Send chunks of audio
    chunk_size = 160
    for i in range(0, len(audio), chunk_size):
        await socket.send_media(audio[i:i+chunk_size])
        await asyncio.sleep(0.02)
        
    print("Done sending audio. Finalizing.")
    await socket.send_finalize()
    await asyncio.sleep(2)
    
    await ctx.__aexit__(None, None, None)

asyncio.run(test())
