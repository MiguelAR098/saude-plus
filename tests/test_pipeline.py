"""Roda a suíte de tests/prompts_teste.json contra o pipeline e a API.

Executar na raiz do repositório:  pytest -q
"""
import json
import re
import sys
from types import SimpleNamespace
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "src"))

from fastapi.testclient import TestClient  # noqa: E402

from saudeplus import data  # noqa: E402
from saudeplus import GeminiAI, config, intent, pipeline, retrieval, session_context  # noqa: E402
from saudeplus.main import app  # noqa: E402

client = TestClient(app)
SUITE = json.loads((RAIZ / "tests" / "prompts_teste.json").read_text(encoding="utf-8"))
CASOS = SUITE["casos"]
PRESCRITIVO = re.compile(r"\b(tome|use|experimente|aplique)\b", re.IGNORECASE)


@pytest.fixture(autouse=True)
def impedir_chamadas_reais_gemini(monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "")


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


def test_contexto_da_sessao_aplica_preferencias_em_followup():
    sessao_id = "sessao-teste-001"

    primeira = pipeline.recomendar("Quero hidratante para pele seca até R$ 80", sessao_id=sessao_id)
    segunda = pipeline.recomendar("algo mais barato", sessao_id=sessao_id)

    contexto = session_context.obter(sessao_id)
    assert primeira.tipo == "recomendacao"
    assert segunda.tipo == "recomendacao"
    assert contexto["necessidades"] == ["pele seca"]
    assert contexto["orcamento"] == 80
    assert contexto["barato"] is True
    assert all(produto.preco <= 80 for produto in segunda.produtos)


def test_agente_mapeia_intencao_para_motor_local():
    it = GeminiAI._montar_intencao("Quero algo para pele seca até R$ 80", {
        "necessidades": ["pele seca"],
        "termos_busca": ["hidratante", "ressecamento"],
        "orcamento": 100,
        "infantil": False,
        "tipos_pele": ["seca"],
        "barato": False,
        "quer_kit": False,
    })

    assert it.orcamento == 80
    assert it.tipos_pele == {"seca"}
    assert it.subcats_alvo["hidratante-corporal-seca"] == 3
    assert "hidratante" in it.tokens


def test_agente_rejeita_intencao_desconhecida():
    with pytest.raises(ValueError):
        GeminiAI._montar_intencao("Quero um produto", {
            "necessidades": ["diagnosticar doença"],
            "termos_busca": [],
            "infantil": False,
            "tipos_pele": [],
            "barato": False,
            "quer_kit": False,
        })


def test_busca_semantica_recupera_sem_coincidencia_lexical(monkeypatch):
    monkeypatch.setattr(retrieval, "_similaridades_semanticas", lambda _: {"prod-0001": 0.9})
    consulta = intent.Intencao(mensagem="expressão sem palavras do catálogo", tokens=["xylophonezz"])

    candidatos = retrieval.buscar(consulta)

    assert candidatos[0].prod["id"] == "prod-0001"
    assert "similaridade_semantica" in candidatos[0].razoes


def test_busca_semantica_falhando_mantem_busca_lexical(monkeypatch):
    def falhar(_):
        raise TimeoutError("serviço indisponível")

    monkeypatch.setattr(retrieval, "_similaridades_semanticas", falhar)

    candidatos = retrieval.buscar(intent.interpretar("hidratante para pele seca"))

    assert candidatos
    assert candidatos[0].prod["subcategoria"] == "hidratante-corporal-seca"


def test_comparacao_usa_apenas_ids_da_busca():
    resposta = pipeline._recomendar_com_intencao(
        "hidratante para pele seca", intent.interpretar("hidratante para pele seca")
    )
    ids = [produto.id for produto in resposta.produtos[:2]]

    comparacao = GeminiAI._comparar_produtos(ids, resposta)

    assert [produto["id"] for produto in comparacao] == ids
    with pytest.raises(ValueError):
        GeminiAI._comparar_produtos([ids[0], "produto-inventado"], resposta)


def test_comparacao_permite_ids_da_recomendacao_anterior_da_sessao():
    resposta = pipeline._recomendar_com_intencao(
        "hidratante para pele seca", intent.interpretar("hidratante para pele seca")
    )
    ids_anteriores = ["prod-0001", "prod-0002"]

    comparacao = GeminiAI._comparar_produtos(ids_anteriores, resposta, {"produto_ids": ids_anteriores})

    assert [produto["id"] for produto in comparacao] == ids_anteriores


def test_bloqueio_de_entrada_acontece_antes_do_agente(monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "chave-de-teste")
    monkeypatch.setattr(GeminiAI, "recomendar", lambda *_: pytest.fail("agente não deveria ser chamado"))

    resposta = pipeline.recomendar("O que posso tomar para dor de cabeça?")

    assert resposta.tipo == "bloqueio_restrito"


def test_pipeline_usa_fallback_local_se_agente_falhar(monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "chave-de-teste")
    monkeypatch.setattr(GeminiAI, "recomendar", lambda *_: (_ for _ in ()).throw(TimeoutError()))

    resposta = pipeline.recomendar("Quero hidratante para pele seca")

    assert resposta.tipo == "recomendacao"
    assert 3 <= len(resposta.produtos) <= 5


def test_agente_executa_busca_local_e_redige_resumo(monkeypatch):
    class Etapa:
        type = "function_call"
        name = "buscar_produtos_catalogo"
        id = "call-1"
        arguments = {
            "necessidades": ["pele seca"],
            "termos_busca": ["hidratante", "pele seca"],
            "orcamento": 80,
            "infantil": False,
            "tipos_pele": ["seca"],
            "barato": False,
            "quer_kit": False,
        }

        def model_dump(self, mode):
            return {"type": self.type, "name": self.name, "id": self.id, "arguments": self.arguments}

    class ClienteFalso:
        def __init__(self):
            self.chamadas = []
            self.interactions = self

        def create(self, **kwargs):
            self.chamadas.append(kwargs)
            if len(self.chamadas) == 1:
                return SimpleNamespace(steps=[Etapa()])
            return SimpleNamespace(
                steps=[],
                output_text='{"mensagem":"Encontrei opções para pele seca."}',
            )

    cliente = ClienteFalso()
    monkeypatch.setattr(config, "GEMINI_API_KEY", "chave-de-teste")
    monkeypatch.setattr(GeminiAI, "_cliente", lambda: cliente)
    monkeypatch.setattr(retrieval, "_similaridades_semanticas", lambda _: {})

    resposta = GeminiAI.recomendar(
        "Quero hidratante para pele seca até R$ 80",
        lambda it: pipeline._recomendar_com_intencao("Quero hidratante para pele seca até R$ 80", it),
    )

    assert resposta.tipo == "recomendacao"
    assert resposta.produtos
    assert resposta.mensagem == "Encontrei opções para pele seca."
    assert len(cliente.chamadas) == 2
    assert all(chamada["store"] is False for chamada in cliente.chamadas)


@pytest.mark.parametrize(
    ("nome_ferramenta", "pergunta", "resposta_final"),
    [
        ("comparar_opcoes", "Qual desses custa menos?", "O produto A custa menos."),
        ("consultar_produtos_da_sessao", "Qual deles tem a melhor avaliação?", "O produto B tem a melhor avaliação."),
    ],
)
def test_followup_responde_sem_fazer_nova_busca(monkeypatch, nome_ferramenta, pergunta, resposta_final):
    class Etapa:
        type = "function_call"
        name = nome_ferramenta
        id = "call-followup"
        arguments = {"produto_ids": ["prod-0001", "prod-0002"]}
        if nome_ferramenta == "consultar_produtos_da_sessao":
            arguments["pergunta"] = pergunta

        def model_dump(self, mode):
            return {"type": self.type, "name": self.name, "id": self.id, "arguments": self.arguments}

    class ClienteFalso:
        def __init__(self):
            self.chamadas = []
            self.interactions = self

        def create(self, **kwargs):
            self.chamadas.append(kwargs)
            if len(self.chamadas) == 1:
                return SimpleNamespace(steps=[Etapa()])
            return SimpleNamespace(steps=[], output_text=json.dumps({"mensagem": resposta_final}))

    cliente = ClienteFalso()
    monkeypatch.setattr(config, "GEMINI_API_KEY", "chave-de-teste")
    monkeypatch.setattr(GeminiAI, "_cliente", lambda: cliente)

    resposta = GeminiAI.recomendar(
        pergunta,
        lambda _: pytest.fail("follow-up não deve iniciar nova busca"),
        contexto={"produto_ids": ["prod-0001", "prod-0002"]},
    )

    assert resposta.tipo == "resposta"
    assert resposta.produtos == []
    assert resposta.mensagem == resposta_final
    assert len(cliente.chamadas) == 2
