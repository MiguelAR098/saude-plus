"""Configuração central. Valores podem ser trocados por variáveis de ambiente."""
import os
from pathlib import Path

from dotenv import load_dotenv

RAIZ = Path(__file__).resolve().parents[2]
load_dotenv(RAIZ / ".env")

DATA = Path(os.getenv("SAUDEPLUS_DATA", RAIZ / "data"))
DEBUG = os.getenv("SAUDEPLUS_DEBUG", "0") == "1"
CORS_ORIGINS = [o.strip() for o in os.getenv("SAUDEPLUS_CORS", "*").split(",") if o.strip()]
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2")
SESSION_CONTEXT_TTL_SECONDS = int(os.getenv("SESSION_CONTEXT_TTL_SECONDS", "1800"))
SESSION_CONTEXT_MAX_SESSIONS = int(os.getenv("SESSION_CONTEXT_MAX_SESSIONS", "1000"))
SEMANTIC_SCORE_THRESHOLD = float(os.getenv("SEMANTIC_SCORE_THRESHOLD", "0.35"))
SEMANTIC_SCORE_WEIGHT = float(os.getenv("SEMANTIC_SCORE_WEIGHT", "8.0"))

MIN_PRODUTOS = 3
MAX_PRODUTOS = 5
MIN_SCORE = 2.5  # abaixo disso a busca é considerada fraca e a IA pergunta
