import requests
import os

def call_llm(prompt):
    response = requests.post(
        os.getenv("LLM_API_URL"),
        json={"prompt": prompt}
    )
    return response.json()
