"""Justificativas por produto, geradas por modelo de texto (linguagem informativa, sem prescrição)."""
from .intent import Intencao
from .text import brl, norm, tokens


def _nota(v: float) -> str:
    return f"{v:.1f}".replace(".", ",")


def justificar(c, it: Intencao, adequados: dict) -> str:
    p = c.prod
    q = set(it.tokens)
    tags = [t for t in p["indicado_para"] if q & set(tokens(t))]
    if not tags:
        tags = p["indicado_para"][:2]
    partes = [f"Indicado para {', '.join(tags[:3])}."]

    tipos = {norm(t) for t in p["tipo_pele"]}
    comuns = sorted(it.tipos_pele & tipos)
    if comuns:
        partes.append(f"Serve para pele {comuns[0].replace('sensivel', 'sensível')}.")

    pares = [a for a in adequados.get(p["subcategoria"], []) if a.prod["id"] != p["id"]]
    if it.barato and pares and p["preco"] <= min(a.prod["preco"] for a in pares):
        partes.append(f"Menor preço entre as opções adequadas ({brl(p['preco'])}).")
    elif p["marca_propria"]:
        mais_caros = [a for a in pares if not a.prod["marca_propria"] and a.prod["preco"] > p["preco"]]
        if mais_caros:
            ref = min(mais_caros, key=lambda a: a.prod["preco"])
            dif = ref.prod["preco"] - p["preco"]
            partes.append(f"Marca própria: mesma finalidade que {ref.prod['nome']} por {brl(dif)} a menos.")
    partes.append(f"Avaliação {_nota(p['nota'])} ({p['num_avaliacoes']} avaliações).")
    return " ".join(partes)
