"""Configuração central. Valores podem ser trocados por variáveis de ambiente."""
import os
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
DATA = Path(os.getenv("SAUDEPLUS_DATA", RAIZ / "data"))
DEBUG = os.getenv("SAUDEPLUS_DEBUG", "0") == "1"
CORS_ORIGINS = [o.strip() for o in os.getenv("SAUDEPLUS_CORS", "*").split(",") if o.strip()]

MIN_PRODUTOS = 3
MAX_PRODUTOS = 5
MIN_SCORE = 2.5  # abaixo disso a busca é considerada fraca e a IA pergunta
