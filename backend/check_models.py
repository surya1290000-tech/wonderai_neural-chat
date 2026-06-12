import os
from dotenv import load_dotenv, find_dotenv
from google import genai

# Force load the .env file
load_dotenv(find_dotenv())

# Debug: Check if the key is actually loaded
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Error: GEMINI_API_KEY is not set!")
else:
    print("API Key found. Initializing client...")
    # Initialize the client explicitly if needed
    client = genai.Client(api_key=api_key)

    print("Available models:")
    for m in client.models.list():
        print(m.name)