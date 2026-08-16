import asyncio
import time
import os
from dotenv import load_dotenv

load_dotenv()

from voice.tts.sarvam_service import generate_speech
from voice.tts.sarvam_client import get_sarvam_client

TEST_TEXT = "I can help you reset your password. Are you an employee or a contractor?"

async def test_voice(model, speaker):
    print(f"\n--- Testing {model} + {speaker} ---")
    start = time.time()
    try:
        audio_bytes, mime = await generate_speech(
            text=TEST_TEXT,
            model=model,
            speaker=speaker,
            language="en-IN",
            audio_codec="mulaw",
            sample_rate=8000
        )
        latency = (time.time() - start) * 1000
        duration = len(audio_bytes) / 8000
        
        filename = f"../scratch/{model.replace(':', '_')}_{speaker}.mulaw"
        with open(filename, "wb") as f:
            f.write(audio_bytes)
            
        print(f"Latency: {latency:.1f} ms | Duration: {duration:.2f} s | Size: {len(audio_bytes)} bytes")
        return {"latency": latency, "duration": duration, "error": None}
    except Exception as e:
        latency = (time.time() - start) * 1000
        print(f"Error: {e}")
        return {"latency": latency, "duration": None, "error": str(e)}

async def main():
    v2_speakers = ["anushka", "abhilash", "manisha", "vidya", "arya", "karun", "hitesh"]
    v3_speakers = ["ratan", "ishita", "aditya"]
    
    results = {}
    
    for spk in v2_speakers:
        res = await test_voice("bulbul:v2", spk)
        results[f"v2_{spk}"] = res
        
    for spk in v3_speakers:
        res = await test_voice("bulbul:v3", spk)
        results[f"v3_{spk}"] = res

    print("\n\n=== SUMMARY ===")
    print(f"{'Configuration':<20} | {'Latency (ms)':<15} | {'Duration (s)':<15}")
    for key, res in results.items():
        if res["error"]:
            print(f"{key:<20} | ERROR: {res['error']}")
        else:
            print(f"{key:<20} | {res['latency']:<15.1f} | {res['duration']:<15.2f}")

if __name__ == "__main__":
    asyncio.run(main())
