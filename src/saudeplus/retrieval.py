"""Busca de produtos: sobreposição de termos ponderada por IDF + reforços por intenção.

Este módulo é a fronteira para o RAG: no próximo degrau, a pontuação por termos
é combinada com similaridade de embeddings.
"""
import math
import logging
import re
from threading import RLock
from dataclasses import dataclass, field
from functools import lru_cache

from . import config, data
from .intent import Intencao
from .text import norm, tokens

logger = logging.getLogger(__name__)
_EMBEDDING_BATCH_SIZE = 32
_EMBEDDING_INDEX: tuple[tuple, dict[str, list[float]]] | None = None
_EMBEDDING_LOCK = RLock()


def _detalhes_erro_api(exc: Exception) -> tuple[object, object, str | None]:
    status = getattr(exc, "status", None)
    code = getattr(exc, "code", None)
    mensagem = getattr(exc, "message", None)
    if isinstance(mensagem, str):
        mensagem = re.sub(r"AIza[0-9A-Za-z_-]{20,}", "[REDACTED]", mensagem)
        mensagem = mensagem[:300]
    return status, code, mensagem


@dataclass
class Candidato:
    prod: dict
    score: float
    base: float
    razoes: list = field(default_factory=list)


@lru_cache(maxsize=1)
def _indice():
    docs = {}
    for pid, p in data.catalogo().items():
        texto = " ".join([p["texto_busca"], p["subcategoria"].replace("-", " "), p["categoria"],
                          " ".join(p["tipo_pele"])])
        docs[pid] = set(tokens(texto))
    n = len(docs)
    df = {}
    for d in docs.values():
        for t in d:
            df[t] = df.get(t, 0) + 1
    idf = {t: math.log((n + 1) / (c + 1)) + 1 for t, c in df.items()}
    return docs, idf


@lru_cache(maxsize=1)
def _tokens_subcategoria() -> dict:
    return {sc: set(tokens(sc.replace("-", " "))) for sc in {p["subcategoria"] for p in data.catalogo().values()}}


def _alvo_explicito(consulta: set) -> dict:
    """Se o cliente nomeia o tipo de produto (ex.: 'hidratante corporal'), a subcategoria ganha reforço."""
    out = {}
    for sc, toks in _tokens_subcategoria().items():
        comuns = len(toks & consulta)
        if comuns >= 2:
            out[sc] = 1.5 * comuns
    return out


def _documentos_semanticos() -> list[tuple[str, str]]:
    return [
        (pid, f"title: {produto['nome']} | text: {' '.join([
            produto['descricao_curta'], produto['texto_busca'], produto['subcategoria'].replace('-', ' '),
            ' '.join(produto['indicado_para']), ' '.join(produto['tipo_pele']),
        ])}")
        for pid, produto in data.catalogo().items()
    ]


def _indice_semantico() -> dict[str, list[float]]:
    global _EMBEDDING_INDEX
    documentos = _documentos_semanticos()
    assinatura = tuple((pid, texto) for pid, texto in documentos)
    with _EMBEDDING_LOCK:
        if _EMBEDDING_INDEX and _EMBEDDING_INDEX[0] == assinatura:
            return _EMBEDDING_INDEX[1]

        from google.genai import types
        from .GeminiAI import _cliente

        cliente = _cliente()
        vetores = {}
        for inicio in range(0, len(documentos), _EMBEDDING_BATCH_SIZE):
            lote = documentos[inicio:inicio + _EMBEDDING_BATCH_SIZE]
            conteudos = [
                types.Content(parts=[types.Part.from_text(text=texto)])
                for _, texto in lote
            ]
            resultado = cliente.models.embed_content(
                model=config.GEMINI_EMBEDDING_MODEL,
                contents=conteudos,
                config=types.EmbedContentConfig(output_dimensionality=768),
            )
            if len(resultado.embeddings) != len(lote):
                raise ValueError("quantidade inesperada de embeddings do catálogo")
            vetores.update({pid: embedding.values for (pid, _), embedding in zip(lote, resultado.embeddings)})
        _EMBEDDING_INDEX = (assinatura, vetores)
        return vetores


def _similaridades_semanticas(consulta: str) -> dict[str, float]:
    if not config.GEMINI_API_KEY:
        return {}
    from google.genai import types
    from .GeminiAI import _cliente

    indice = _indice_semantico()
    resultado = _cliente().models.embed_content(
        model=config.GEMINI_EMBEDDING_MODEL,
        contents=f"task: search result | query: {consulta}",
        config=types.EmbedContentConfig(output_dimensionality=768),
    )
    query = resultado.embeddings[0].values
    norma_query = math.sqrt(sum(valor * valor for valor in query)) or 1.0
    similaridades = {}
    for pid, vetor in indice.items():
        norma_vetor = math.sqrt(sum(valor * valor for valor in vetor)) or 1.0
        similaridades[pid] = sum(a * b for a, b in zip(query, vetor)) / (norma_query * norma_vetor)
    return similaridades


def buscar(it: Intencao) -> list:
    docs, idf = _indice()
    consulta = set(it.tokens)
    explicito = _alvo_explicito(consulta)
    try:
        similaridades = _similaridades_semanticas(it.mensagem)
    except Exception as exc:
        status, code, detalhe = _detalhes_erro_api(exc)
        logger.warning(
            "Busca semântica indisponível; usando busca lexical (%s, status=%s, code=%s, detalhe=%s)",
            type(exc).__name__, status, code, detalhe,
        )
        similaridades = {}
    out = []
    for pid, p in data.catalogo().items():
        base = sum(idf.get(t, 0.0) for t in consulta & docs[pid])
        reforco = it.subcats_alvo.get(p["subcategoria"], 0.0) + explicito.get(p["subcategoria"], 0.0)
        similaridade = similaridades.get(pid, 0.0)
        semantico = max(0.0, similaridade - config.SEMANTIC_SCORE_THRESHOLD) * config.SEMANTIC_SCORE_WEIGHT
        score = base + reforco + semantico
        if score <= 0:
            continue
        razoes = ["similaridade_semantica"] if semantico > 0 else []
        faixa = p["faixa_etaria"]
        if it.infantil:
            if faixa == "infantil":
                score += 2.5
            elif faixa == "adulto":
                score -= 2.0
        elif faixa == "infantil":
            score -= 3.0
        tipos_prod = {norm(t) for t in p["tipo_pele"]}
        if it.tipos_pele and tipos_prod and "todos" not in tipos_prod:
            if it.tipos_pele & tipos_prod:
                score += 1.2
                razoes.append("tipo_pele")
            else:
                score -= 0.8
        if p["categoria"] == "kits" and not it.quer_kit:
            continue  # kits só aparecem quando o cliente pede kit ou presente
        if score > 0:
            out.append(Candidato(p, score, base, razoes))
    out.sort(key=lambda c: c.score, reverse=True)
    return out
