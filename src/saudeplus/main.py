"""API do SaúdePlus.

Rodar (na raiz do repositório):
    uvicorn saudeplus.main:app --app-dir src --reload
Documentação interativa: http://127.0.0.1:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__, config, data, pipeline
from .schemas import RecommendRequest, RecommendResponse

app = FastAPI(title="SaúdePlus API", version=__version__,
              description="Protótipo de descoberta guiada e compra responsável. Dados sintéticos.")
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"status": "ok", "versao": __version__, "produtos": len(data.catalogo())}


@app.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest) -> RecommendResponse:
    return pipeline.recomendar(req.mensagem, debug=config.DEBUG)
