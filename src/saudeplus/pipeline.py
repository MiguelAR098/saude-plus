"""Orquestra o fluxo: guardrails de entrada → intenção → busca → seleção → justificativa → guardrails de saída."""
import re
import logging

from pydantic import ValidationError

from . import config, data, guardrails, intent, justify, retrieval, selection, session_context
from .schemas import ForaDaLista, Kit, ProdutoCard, RecommendResponse
from .text import brl

logger = logging.getLogger(__name__)
_PRESCRITIVO = re.compile(r"\b(tome|use|experimente|aplique)\b", re.IGNORECASE)
MSG_FALHA = "Não consegui montar uma recomendação segura agora. Pode reformular o que você quer resolver?"


def _pergunta(it, mensagem: str = "") -> RecommendResponse:
    p = intent.pergunta_de_clarificacao(it)
    return RecommendResponse(tipo="clarificacao", mensagem=p, pergunta=p)


def _perguntar_orcamento() -> RecommendResponse:
    pergunta = "Qual é o seu orçamento máximo para esses produtos?"
    return RecommendResponse(tipo="clarificacao", mensagem=pergunta, pergunta=pergunta)


def _responder_saudacao() -> RecommendResponse:
    mensagem = "Oi! Como posso ajudar hoje? Me conte o que você está procurando."
    return RecommendResponse(tipo="clarificacao", mensagem=mensagem, pergunta=mensagem)


def _card(c, it, sel) -> ProdutoCard:
    p = c.prod
    return ProdutoCard(
        id=p["id"], nome=p["nome"], marca=p["marca"], categoria=p["categoria"], subcategoria=p["subcategoria"],
        tamanho=p["tamanho"], preco=p["preco"], nota=p["nota"], num_avaliacoes=p["num_avaliacoes"],
        imagem=p["imagem"], marca_propria=p["marca_propria"],
        justificativa=justify.justificar(c, it, sel.adequados),
        avisos=[*p["alertas"], *p["contraindicacoes"]])


def _validar_saida(resp: RecommendResponse) -> None:
    """Guardrail de saída: só catálogo real, sem medicamento restrito, sem linguagem prescritiva."""
    cat = data.catalogo()
    textos = [resp.mensagem]
    for p in resp.produtos:
        if p.id not in cat:
            raise ValueError(f"id inexistente: {p.id}")
        textos += [p.nome, p.justificativa, *p.avisos]
    textos += [f.motivo for f in resp.ficou_de_fora] + resp.avisos
    for t in textos:
        if guardrails.contem_restrito(t):
            raise ValueError("texto cita medicamento restrito")
        if _PRESCRITIVO.search(t):
            raise ValueError("linguagem prescritiva")


def recomendar(mensagem: str, debug: bool = False, sessao_id: str | None = None) -> RecommendResponse:
    bloqueio = guardrails.checar_entrada(mensagem)
    if bloqueio:
        resp = RecommendResponse(tipo=bloqueio.tipo, mensagem=bloqueio.mensagem,
                                 oferecer_farmaceutico=bloqueio.oferecer_farmaceutico)
        if debug:
            resp.debug = {"classe": bloqueio.classe, "motivo": bloqueio.motivo}
        return resp

    if intent.eh_saudacao(mensagem):
        return _responder_saudacao()

    contexto = session_context.obter(sessao_id)
    orcamento_informado = (
        intent._orcamento(mensagem) is not None
        or bool(contexto and contexto.get("orcamento_informado", False))
    )
    from . import GeminiAI

    comparacao = GeminiAI.responder_comparacao(mensagem, contexto)
    if comparacao is not None:
        return comparacao

    intencao_usada = None

    def executar_busca(it: intent.Intencao) -> RecommendResponse:
        nonlocal intencao_usada
        intencao_usada = session_context.combinar(it, contexto)
        return _recomendar_com_intencao(mensagem, intencao_usada, debug)

    if config.GEMINI_API_KEY:
        try:
            resposta = GeminiAI.recomendar(mensagem, executar_busca, contexto=contexto)
        except ValidationError as exc:
            erros = [
                {"loc": ".".join(str(parte) for parte in erro["loc"]), "type": erro["type"]}
                for erro in exc.errors(include_input=False, include_context=False)
            ]
            logger.warning("Agente Gemini rejeitou dados estruturados: %s", erros)
        except Exception as exc:
            logger.warning("Agente Gemini indisponível; usando interpretação local (%s)", type(exc).__name__)
        else:
            if intencao_usada is not None:
                session_context.salvar(
                    sessao_id, intencao_usada, resposta, contexto,
                    orcamento_informado=orcamento_informado,
                )
            return resposta

    intencao_usada = session_context.combinar(intent.interpretar(mensagem), contexto)
    resposta = _recomendar_com_intencao(mensagem, intencao_usada, debug)
    session_context.salvar(
        sessao_id, intencao_usada, resposta, contexto,
        orcamento_informado=orcamento_informado,
    )
    return resposta


def _recomendar_com_intencao(mensagem: str, it: intent.Intencao, debug: bool = False) -> RecommendResponse:
    if it.sem_necessidade:
        return _pergunta(it)
    if it.orcamento is None:
        resposta = _perguntar_orcamento()
        return resposta
    cands = retrieval.buscar(it)
    if not cands or cands[0].score < config.MIN_SCORE:
        return _pergunta(it)

    sel = selection.selecionar(cands, it)
    if not sel.escolhidos:
        if it.orcamento is not None and sel.preco_minimo:
            msg = (f"Não encontrei opções adequadas dentro de {brl(it.orcamento)}: a mais barata que atende ao seu "
                   f"pedido custa {brl(sel.preco_minimo)}. Quer ajustar o orçamento ou priorizar um item?")
            return RecommendResponse(tipo="clarificacao", mensagem=msg, pergunta=msg, orcamento=it.orcamento)
        return _pergunta(it)

    produtos = [_card(c, it, sel) for c in sel.escolhidos]
    fora = [ForaDaLista(produto_id=p["id"], nome=p["nome"], motivo=m) for p, m in sel.fora[:4]]
    kit = None
    if sel.modo == "rotina" and len(produtos) >= 2:
        kit = Kit(produto_ids=[p.id for p in produtos], subtotal=sel.total)

    nec = ", ".join(it.necessidades[:3]) or "o que você descreveu"
    msg = f"Separei {len(produtos)} {'opção' if len(produtos) == 1 else 'opções'} para {nec}."
    if kit:
        msg += f" O kit completo soma {brl(sel.total)}"
        msg += f", dentro do seu orçamento de {brl(it.orcamento)}." if it.orcamento else "."
    if fora:
        msg += " Veja abaixo o que deixei de fora e por quê."
    avisos = list(dict.fromkeys(a for c in sel.escolhidos for a in c.prod["alertas"]))

    resp = RecommendResponse(tipo="recomendacao", mensagem=msg, produtos=produtos, ficou_de_fora=fora, kit=kit,
                             avisos=avisos, orcamento=it.orcamento, total=sel.total)
    if debug:
        resp.debug = {"modo": sel.modo, "necessidades": it.necessidades, "tokens": it.tokens,
                      "scores": {c.prod["id"]: round(c.score, 2) for c in sel.escolhidos}}
    try:
        _validar_saida(resp)
    except ValueError:
        return RecommendResponse(tipo="clarificacao", mensagem=MSG_FALHA, pergunta=MSG_FALHA)
    return resp
