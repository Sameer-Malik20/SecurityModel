import os
import requests
import logging
import json
from enum import Enum
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class LLMProvider(str, Enum):
    OPENROUTER = "openrouter"
    OPENAI = "openai"

class LLMClient:
    """
    Provider-agnostic LLM client.
    Currently defaults to OpenRouter.
    """
    
    def __init__(self, provider: LLMProvider = LLMProvider.OPENROUTER, model: str = "openai/gpt-4o"):
        self.provider = provider
        # OpenRouter model ID (e.g., Llama 3 or Gemini)
        self.model = model
        
        # Correctly get the key from surroundings or environment
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        
        if not self.api_key:
            logger.warning("OPENROUTER_API_KEY is not set. LLM features will fail.")

    def chat_completion(self, system_prompt: str, user_prompt: str, temperature: float = 0.2) -> Dict[str, Any]:
        """
        Sends a request to the LLM.
        """
        if not self.api_key:
            return {"error": "Missing API Key", "content": None}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://security-scanner-pro.local", # Required by OpenRouter
            "X-Title": "SecurityScannerPro"
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": temperature,
            "max_tokens": 2000
        }

        try:
            logger.info(f"Sending request to {self.model} via {self.provider}")
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=60)
            
            if response.status_code == 200:
                data = response.json()
                content = data['choices'][0]['message']['content']
                return {
                    "content": content,
                    "usage": data.get("usage", {}),
                    "error": None
                }
            else:
                logger.error(f"LLM API Error {response.status_code}: {response.text}")
                return {"error": f"API Error: {response.status_code}", "content": None}
                
        except Exception as e:
            logger.exception("LLM Request Failed")
            return {"error": str(e), "content": None}
