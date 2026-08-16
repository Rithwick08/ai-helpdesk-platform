import asyncio
from dotenv import load_dotenv

load_dotenv()

from voice.tts.sarvam_service import generate_speech

TEST_TEXT = "I can help you reset your password. Are you an employee or a contractor?"

async def test_voice(model, speaker):
    try:
        audio_bytes, _ = await generate_speech(
            text=TEST_TEXT,
            model=model,
            speaker=speaker,
            language="en-IN",
            audio_codec="wav",
            sample_rate=22050
        )
        
        filename = f"../scratch/{model.replace(':', '_')}_{speaker}.wav"
        with open(filename, "wb") as f:
            f.write(audio_bytes)
        print(f"Saved {filename}")
    except Exception as e:
        print(f"Error for {speaker}: {e}")

async def main():
    v2_speakers = ["anushka", "abhilash", "manisha", "vidya", "arya", "karun", "hitesh"]
    v3_speakers = ["ratan", "ishita"]
    
    for spk in v2_speakers:
        await test_voice("bulbul:v2", spk)
    for spk in v3_speakers:
        await test_voice("bulbul:v3", spk)

if __name__ == "__main__":
    asyncio.run(main())
