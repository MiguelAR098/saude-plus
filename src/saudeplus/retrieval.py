"""Busca de produtos: sobreposição de termos ponderada por IDF + reforços por intenção.

Este módulo é a fronteira para o RAG: no próximo degrau, a pontuação por termos
é combinada com similaridade de embeddings.
"""
import math
from dataclasses import dataclass, field
from functools import lru_cache

from . import data
from .intent import Intencao
from .text import norm, tokens


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


def buscar(it: Intencao) -> list:
    docs, idf = _indice()
    consulta = set(it.tokens)
    explicito = _alvo_explicito(consulta)
    out = []
    for pid, p in data.catalogo().items():
        base = sum(idf.get(t, 0.0) for t in consulta & docs[pid])
        reforco = it.subcats_alvo.get(p["subcategoria"], 0.0) + explicito.get(p["subcategoria"], 0.0)
        score = base + reforco
        if score <= 0:
            continue
        razoes = []
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
