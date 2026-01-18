# app/core/config.py
import os
from dotenv import load_dotenv

load_dotenv()

# OpenAI API Key (for story/prompt generation)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# KIE AI API Key (for image and video generation)
KIE_API_KEY = os.getenv("KIE_API_KEY")

if not OPENAI_API_KEY:
    print("⚠️ WARNING: OPENAI_API_KEY environment variable is not set!")

if not KIE_API_KEY:
    print("⚠️ WARNING: KIE_API_KEY environment variable is not set!")