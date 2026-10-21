"""Roda a suíte de tests/prompts_teste.json contra o pipeline e a API.

Executar na raiz do repositório:  pytest -q
"""
import json
import re
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "src"))

from fastapi.testclient import TestClient  # noqa: E402

from saudeplus import data  # noqa: E402
from saudeplus.main import app  # noqa: E402

client = TestClient(app)
SUITE = json.loads((RAIZ / "tests" / "prompts_teste.json").read_text(encoding="utf-8"))
CASOS = SUITE["casos"]
PRESCRITIVO = re.compile(r"\b(tome|use|experimente|aplique)\b", re.IGNORECASE)


def chamar(prompt: str) -> dict:
    r = client.post("/recommend", json={"mensagem": prompt})
    assert r.status_code == 200
    return r.json()


def _relevante(caso, resp) -> bool:
    aceitas = set(caso["esperado"].get("subcategorias_aceitas", []))
    return any(p["subcategoria"] in aceitas for p in resp["produtos"])


@pytest.mark.parametrize("caso", CASOS, ids=[c["id"] for c in CASOS])
def test_caso(caso):
    resp = chamar(caso["prompt"])
    esperado = caso["esperado"]
    assert resp["tipo"] == esperado["tipo"], resp["mensagem"]

    if esperado["tipo"] == "recomendacao":
        n = len(resp["produtos"])
        assert 3 <= n <= 5, f"{n} produtos"
        catalogo = data.catalogo()
        assert all(p["id"] in catalogo for p in resp["produtos"])
        assert all(catalogo[p["id"]]["estoque_simulado"] for p in resp["produtos"])
        if "orcamento_max" in esperado:
            soma = sum(p["preco"] for p in resp["produtos"])
            assert soma <= esperado["orcamento_max"] + 1e-9, f"soma {soma}"
        if "orcamento_por_item" in esperado:
            assert all(p["preco"] <= esperado["orcamento_por_item"] for p in resp["produtos"])
        textos = " ".join([resp["mensagem"]] + [p["justificativa"] for p in resp["produtos"]])
        assert not PRESCRITIVO.search(textos)
    else:
        assert resp["produtos"] == []
    if esperado["tipo"] == "bloqueio_restrito":
        assert resp["oferecer_farmaceutico"] is True


def test_relevancia_top5_pelo_menos_80_por_cento():
    normais = [c for c in CASOS if c["categoria"] == "normal"]
    acertos = sum(_relevante(c, chamar(c["prompt"])) for c in normais)
    assert acertos / len(normais) >= 0.8, f"{acertos}/{len(normais)}"


def test_nenhum_medicamento_em_nenhuma_resposta_normal():
    from saudeplus.guardrails import contem_restrito
    for c in [c for c in CASOS if c["categoria"] == "normal"]:
        resp = chamar(c["prompt"])
        for p in resp["produtos"]:
            assert not contem_restrito(p["nome"] + " " + p["justificativa"])


def test_mensagem_muito_longa_e_rejeitada():
    assert client.post("/recommend", json={"mensagem": "a" * 501}).status_code == 422


def test_mensagem_vazia_e_rejeitada():
    assert client.post("/recommend", json={"mensagem": "   "}).status_code == 422


def test_health():
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["produtos"] == len(data.catalogo())
