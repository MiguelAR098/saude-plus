"""Contexto conversacional efêmero, limitado a preferências de compra."""
from collections import OrderedDict
from threading import RLock
from time import monotonic

from . import config
from .intent import Intencao
from .schemas import RecommendResponse

_STORE: OrderedDict[str, tuple[float, dict]] = OrderedDict()
_LOCK = RLock()


def obter(sessao_id: str | None) -> dict | None:
    if not sessao_id:
        return None
    agora = monotonic()
    with _LOCK:
        for chave, (expira, _) in list(_STORE.items()):
            if expira <= agora:
                del _STORE[chave]
        registro = _STORE.get(sessao_id)
        if registro is None:
            return None
        _STORE.move_to_end(sessao_id)
        return registro[1].copy()


def salvar(
    sessao_id: str | None,
    intencao: Intencao,
    resposta: RecommendResponse,
    contexto_anterior: dict | None = None,
) -> None:
    if not sessao_id or config.SESSION_CONTEXT_TTL_SECONDS <= 0:
        return
    dados = {
        "necessidades": intencao.necessidades[:8],
        "termos_busca": intencao.tokens[:12],
        "orcamento": intencao.orcamento,
        "infantil": intencao.infantil,
        "tipos_pele": sorted(intencao.tipos_pele)[:5],
        "barato": intencao.barato,
        "quer_kit": intencao.quer_kit,
        "produto_ids": [produto.id for produto in resposta.produtos[:5]] or list(
            (contexto_anterior or {}).get("produto_ids", [])[:5]
        ),
    }
    with _LOCK:
        _STORE[sessao_id] = (monotonic() + config.SESSION_CONTEXT_TTL_SECONDS, dados)
        _STORE.move_to_end(sessao_id)
        while len(_STORE) > max(1, config.SESSION_CONTEXT_MAX_SESSIONS):
            _STORE.popitem(last=False)


def combinar(intencao: Intencao, contexto: dict | None) -> Intencao:
    """Completa uma pergunta curta com os slots de compra anteriores."""
    if not contexto:
        return intencao
    if not intencao.necessidades:
        intencao.necessidades = list(contexto.get("necessidades", []))
        if intencao.necessidades:
            contexto_texto = " ".join([
                *intencao.necessidades,
                *contexto.get("termos_busca", []),
            ])
            intencao.mensagem = f"{contexto_texto} {intencao.mensagem}"
            from .intent import LEXICO

            mapa = {rotulo: subcategorias for rotulo, _, subcategorias in LEXICO}
            for necessidade in intencao.necessidades:
                for subcategoria, peso in mapa.get(necessidade, {}).items():
                    intencao.subcats_alvo[subcategoria] = intencao.subcats_alvo.get(subcategoria, 0.0) + peso
    if not intencao.tokens:
        intencao.tokens = list(contexto.get("termos_busca", []))
    if intencao.orcamento is None:
        intencao.orcamento = contexto.get("orcamento")
    intencao.infantil = intencao.infantil or contexto.get("infantil", False)
    if not intencao.tipos_pele:
        intencao.tipos_pele = set(contexto.get("tipos_pele", []))
    intencao.barato = intencao.barato or contexto.get("barato", False)
    intencao.quer_kit = intencao.quer_kit or contexto.get("quer_kit", False)
    intencao.sem_necessidade = not intencao.necessidades and not intencao.tokens
    return intencao