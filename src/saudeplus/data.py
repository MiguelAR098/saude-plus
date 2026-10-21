"""Carregamento dos arquivos de data/ (lidos uma única vez)."""
import json
from functools import lru_cache

from . import config


def _ler(nome: str):
    return json.loads((config.DATA / nome).read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def catalogo() -> dict:
    return {p["id"]: p for p in _ler("produtos.json")}


@lru_cache(maxsize=1)
def restritos() -> dict:
    return _ler("restritos.json")


@lru_cache(maxsize=1)
def emergencia() -> dict:
    return _ler("termos_emergencia.json")
