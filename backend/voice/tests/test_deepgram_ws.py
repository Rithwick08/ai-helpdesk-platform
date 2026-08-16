import asyncio
import os
import wave
from deepgram import AsyncDeepgramClient
from deepgram.listen.v1.types.listen_v1results import ListenV1Results
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(override=True)
api_key = os.getenv("DEEPGRAM_API_KEY", "")

async def main():
    if not api_key:
        print("No API key")
        return
        
    client = AsyncDeepgramClient(api_key=api_key)
    
    audio_path = Path("voice/tests/sarvam_output.wav")
    if not audio_path.exists():
        print("Audio not found")
        return
        
    with wave.open(str(audio_path), "rb") as wf:
        audio_bytes = wf.readframes(wf.getnframes())
        
    # the audio is 22050 Hz or 16000 Hz maybe?
    # Actually, we will just say encoding="linear16" for WAV bytes.
    # Deepgram can auto-detect if we don't specify, but let's test.
    print(f"Read {len(audio_bytes)} bytes")
    
    transcript_accum = ""
    
    async def listen_loop(socket):
        nonlocal transcript_accum
        try:
            async for message in socket:
                if isinstance(message, ListenV1Results):
                    if message.is_final:
                        t = message.channel.alternatives[0].transcript
                        if t:
                            print(f"Final: {t}")
                            transcript_accum += t + " "
                else:
                    print(f"Received other: {type(message)}")
        except Exception as e:
            print("Listen loop error:", e)

    try:
        # Just use smart_format=True
        async with client.listen.v1.connect(model="nova-3", smart_format=True) as socket:
            print("Connected")
            task = asyncio.create_task(listen_loop(socket))
            
            # Send chunks
            chunk_size = 4096
            for i in range(0, len(audio_bytes), chunk_size):
                await socket.send_media(audio_bytes[i:i+chunk_size])
                await asyncio.sleep(0.01)
                
            print("Sending finalize")
            await socket.send_finalize()
            # Wait a bit for final transcript
            await asyncio.sleep(2.0)
            print("Sending close stream")
            await socket.send_close_stream()
            
            await task
            
            print(f"Total transcript: {transcript_accum}")
            
    except Exception as e:
        print("Connect failed:", e)

if __name__ == "__main__":
    asyncio.run(main())
