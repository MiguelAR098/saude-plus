"""Seleção de 3 a 5 produtos: relevância, custo-benefício, orçamento e marca própria como desempate."""
from dataclasses import dataclass, field
from statistics import median

from .config import MAX_PRODUTOS, MIN_PRODUTOS
from .intent import Intencao
from .text import brl


@dataclass
class Selecao:
    escolhidos: list = field(default_factory=list)       # [Candidato]
    modo: str = "vazio"                                   # rotina | opcoes | vazio
    fora: list = field(default_factory=list)              # [(produto, motivo)]
    adequados: dict = field(default_factory=dict)         # subcategoria -> [Candidato]
    total: float = 0.0
    preco_minimo: float = 0.0                             # usado quando nada cabe no orçamento


def _ranquear(lista: list, it: Intencao) -> list:
    """Ordena os candidatos adequados de UMA subcategoria."""
    if it.barato:
        return sorted(lista, key=lambda c: (c.prod["preco"], -c.score))
    pm = median(c.prod["preco"] for c in lista)

    def rank(c):
        valor = c.prod["nota"] / 5.0 - 0.5 * (c.prod["preco"] / pm)
        r = c.score + 1.5 * valor
        if c.prod["marca_propria"] and c.prod["preco"] <= pm:  # desempate, nunca imposição
            r += 0.4
        return r

    return sorted(lista, key=rank, reverse=True)


def selecionar(cands: list, it: Intencao) -> Selecao:
    sel = Selecao()
    em_estoque = [c for c in cands if c.prod["estoque_simulado"]]
    if not em_estoque:
        return sel
    topo_geral = cands[0].score
    topo = em_estoque[0].score
    pool = [c for c in em_estoque if c.score >= 0.45 * topo][:60]

    por_sub = {}
    for c in pool:
        por_sub.setdefault(c.prod["subcategoria"], []).append(c)
    melhor = {s: max(x.score for x in lst) for s, lst in por_sub.items()}
    subs = sorted(melhor, key=melhor.get, reverse=True)
    subs = [s for s in subs if melhor[s] >= 0.6 * topo][:MAX_PRODUTOS]

    sel.adequados = {s: [c for c in por_sub[s] if c.score >= 0.7 * melhor[s]] for s in subs}
    ranqueados = {s: _ranquear(sel.adequados[s], it) for s in subs}
    com_orc = it.orcamento is not None
    # pedido de kit/presente = alternativas (kits já são pacotes); caso contrário, rotina quando há 3+ necessidades
    if it.quer_kit:
        sel.modo = "opcoes"
    else:
        sel.modo = "rotina" if (len(subs) >= 3 or (com_orc and len(subs) >= 2)) else "opcoes"
    soma_orcamento = com_orc and sel.modo == "rotina"

    if sel.modo == "rotina":
        escolhidos = [ranqueados[s][0] for s in subs]
        if soma_orcamento:
            escolhidos = _ajustar_orcamento(escolhidos, subs, sel, it)
        sel.escolhidos = escolhidos
    else:
        elegiveis = {s: [c for c in ranqueados[s] if not com_orc or c.prod["preco"] <= it.orcamento] for s in subs}
        limite = 4 if len(subs) == 1 else MAX_PRODUTOS
        escolhidos, i = [], 0
        while len(escolhidos) < limite:
            achou = False
            for s in subs:
                if i < len(elegiveis[s]) and len(escolhidos) < limite:
                    escolhidos.append(elegiveis[s][i])
                    achou = True
            if not achou:
                break
            i += 1
        sel.escolhidos = escolhidos

    # backfill: garante o mínimo de opções quando houver candidatos adequados fora das subcategorias escolhidas
    if 0 < len(sel.escolhidos) < MIN_PRODUTOS and sel.modo == "opcoes":
        usados = {c.prod["id"] for c in sel.escolhidos}
        for c in pool:
            if c.prod["id"] not in usados and (not com_orc or c.prod["preco"] <= it.orcamento):
                sel.escolhidos.append(c)
                usados.add(c.prod["id"])
                if len(sel.escolhidos) >= MIN_PRODUTOS:
                    break

    sel.total = round(sum(c.prod["preco"] for c in sel.escolhidos), 2)
    sel.preco_minimo = min((c.prod["preco"] for c in pool), default=0.0)

    # --- o que ficou de fora e por quê
    ids = {c.prod["id"] for c in sel.escolhidos}
    for s in subs:
        escolhido = next((c for c in sel.escolhidos if c.prod["subcategoria"] == s), None)
        if not escolhido:
            continue
        for c in ranqueados[s]:
            if c.prod["id"] in ids:
                continue
            if c.prod["preco"] > escolhido.prod["preco"]:
                motivo = f"mesma finalidade de {escolhido.prod['nome']}, com preço maior ({brl(c.prod['preco'])})"
            else:
                motivo = f"mesma finalidade de {escolhido.prod['nome']}, com relevância e avaliação menores para o seu pedido"
            sel.fora.append((c.prod, motivo))
            break
    for c in cands:
        if not c.prod["estoque_simulado"] and c.score >= 0.7 * topo_geral:
            alt = next((e for e in sel.escolhidos if e.prod["subcategoria"] == c.prod["subcategoria"]), None)
            if alt:
                sel.fora.append((c.prod, f"indisponível no momento; alternativa disponível: {alt.prod['nome']}"))
    return sel


def _ajustar_orcamento(escolhidos: list, subs: list, sel: Selecao, it: Intencao) -> list:
    orc = it.orcamento
    soma = lambda L: sum(c.prod["preco"] for c in L)
    if soma(escolhidos) <= orc:
        return escolhidos
    # 1) trocar por opções adequadas mais baratas, começando pelas de menor prioridade
    for i in reversed(range(len(escolhidos))):
        mais_barato = min(sel.adequados[subs[i]], key=lambda c: c.prod["preco"])
        if mais_barato.prod["preco"] < escolhidos[i].prod["preco"]:
            escolhidos[i] = mais_barato
        if soma(escolhidos) <= orc:
            return escolhidos
    # 2) remover itens de menor prioridade até caber
    while soma(escolhidos) > orc and len(escolhidos) > 1:
        removido = escolhidos.pop()
        sel.fora.append((removido.prod, "deixado de fora para caber no orçamento informado"))
    return escolhidos if soma(escolhidos) <= orc else []
