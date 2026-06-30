import os
from dotenv import load_dotenv

load_dotenv()

CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
).split(",")

CORS_HEADERS = {
    "Access-Control-Allow-Origin": CORS_ORIGINS[0],
    "Access-Control-Allow-Credentials": "true",
}
