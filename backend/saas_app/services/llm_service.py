import os
import requests
import logging
import json
from ..core.config import settings
from .prompts import SYSTEM_PROMPT, REPORT_SYSTEM_PROMPT, generate_report_prompt

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        self.model = "openai/gpt-4o-mini"

    def generate_perfect_report(self, raw_results: dict) -> dict:
        """
        Takes raw multi-tool outputs and returns a combined, perfected NormalizedReport.
        """
        user_prompt = generate_report_prompt(raw_results)
        return self._make_request(REPORT_SYSTEM_PROMPT, user_prompt)

    def analyze_vulnerability(self, user_prompt: str) -> dict:
        return self._make_request(SYSTEM_PROMPT, user_prompt)

    def _make_request(self, system_msg: str, user_prompt: str) -> dict:
        if not self.api_key:
            return {"error": "LLM API Key missing"}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://security-saas.local", 
            "X-Title": "SecuritySaaS"
        }

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.1, # Lower temperature for better structure
            "max_tokens": 4000
        }

        try:
            resp = requests.post(self.api_url, headers=headers, json=payload, timeout=120)
            if resp.status_code == 200:
                content = resp.json()['choices'][0]['message']['content']
                # Clean JSON
                clean_content = content.strip()
                if clean_content.startswith("```json"):
                    clean_content = clean_content[7:]
                if clean_content.endswith("```"):
                    clean_content = clean_content[:-3]
                
                try:
                    return json.loads(clean_content)
                except json.JSONDecodeError:
                    logger.error(f"Failed to parse LLM JSON: {content}")
                    return {"error": "Invalid JSON response from AI", "raw": content}
            else:
                if resp.status_code == 401:
                    logger.error(f"LLM Error 401: Unauthorized. Please check if your OPENROUTER_API_KEY is valid. Response: {resp.text}")
                    return {"error": "LLM Provider Error: 401 Unauthorized. Check your API key."}
                
                logger.error(f"LLM Error {resp.status_code}: {resp.text}")
                return {"error": f"LLM Provider Error: {resp.status_code}"}
        except Exception as e:
            logger.exception("LLM Request Failed")
            return {"error": str(e)}
