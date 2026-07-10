import os
import logging
from groq import Groq
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(env_path, override=True)

logger = logging.getLogger(__name__)

class AIClient:
    def __init__(self):
        # Load keys in priority order: KEY_1, KEY_2, KEY_3... and legacy KEY
        potential_keys = []
        
        # Load numbered keys (1 to 10 for safety)
        for i in range(1, 11):
            key = os.getenv(f"GROQ_API_KEY_{i}")
            if key:
                potential_keys.append(key)
                
        # Add legacy key last
        legacy_key = os.getenv("GROQ_API_KEY")
        if legacy_key:
            potential_keys.append(legacy_key)
            
        self.keys = [k for k in potential_keys if k and k.strip()]
        
        if not self.keys:
            # Fallback for local development if no keys are found
            self.keys = ["missing_key"]
            
        self.active_key_index = 0
        self.current_client = Groq(api_key=self.keys[self.active_key_index])
        logger.info(f"Using Groq API key #{self.active_key_index + 1}")

    def _is_rate_limit(self, e: Exception) -> bool:
        """Generic rate limit detection to support any provider."""
        error_name = e.__class__.__name__.lower()
        if "ratelimit" in error_name or "429" in error_name:
            return True
        if hasattr(e, "status_code") and e.status_code == 429:
            return True
        return False

    def chat(self, model, messages, temperature=0.2):
        while True:
            try:
                result = self.current_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=temperature
                )
                # If we get here, the request succeeded
                return result
            except Exception as e:
                if not self._is_rate_limit(e):
                    # Not a rate limit error, raise immediately without retrying
                    raise
                    
                # It's a rate limit error. Can we failover?
                if self.active_key_index + 1 < len(self.keys):
                    logger.warning(f"Groq key #{self.active_key_index + 1} exhausted.")
                    
                    # Switch to next key
                    self.active_key_index += 1
                    logger.info(f"Switching to key #{self.active_key_index + 1}.")
                    self.current_client = Groq(api_key=self.keys[self.active_key_index])
                    # The loop will now retry automatically with the new client
                else:
                    logger.error("All configured API keys have been exhausted due to rate limiting.")
                    raise # Raise the rate limit exception to be handled by the caller

client = AIClient()