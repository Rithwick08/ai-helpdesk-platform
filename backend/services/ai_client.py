from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()


class AIClient:

    def __init__(self):

        self.keys = [

            os.getenv("GROQ_API_KEY_1"),

            os.getenv("GROQ_API_KEY_2"),

            os.getenv("GROQ_API_KEY_3")

        ]

        self.keys = [k for k in self.keys if k]

    def chat(
        self,
        model,
        messages,
        temperature=0.2
    ):

        last_error = None

        for key in self.keys:

            try:

                client = Groq(api_key=key)

                return client.chat.completions.create(

                    model=model,

                    messages=messages,

                    temperature=temperature

                )

            except Exception as e:

                print(f"Groq key failed: {key[:8]}...")

                last_error = e

        raise last_error


client = AIClient()