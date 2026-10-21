"""Utilidades de texto: normalização, tokenização e busca de frases."""
import re
import unicodedata

STOP = frozenset("""
a o as os um uma uns umas de do da dos das em no na nos nas por para pra com sem sobre entre ate e ou mas que se ao aos
eu me meu minha meus minhas voce voces seu sua seus suas nosso nossa ele ela eles elas isso isto esse essa esses essas
este esta quero queria preciso precisa gostaria vou vai tenho tem temos ter ser estar estou sao foi ha ja tambem muito
muita muitos muitas mais menos qual quais como onde quando quanto quem porque pois entao so apenas ainda depois antes
tudo todo toda todos todas cada me indica indique indicar recomenda recomende recomendar mostra mostre ajuda ajudar
comprar compra comprei achar acho procuro procurar real reais r fazer faco fiquei estou
""".split())


def norm(texto: str) -> str:
    """Minúsculas, sem acento, só letras e números separados por espaço."""
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def stem(tok: str) -> str:
    """Remove plural simples. Não é um stemmer completo."""
    if len(tok) > 4 and tok.endswith("oes"):
        return tok[:-3] + "ao"
    if len(tok) > 4 and tok.endswith("s") and not tok.endswith("ss"):
        return tok[:-1]
    return tok


def tokens(texto: str, remover_stop: bool = True) -> list:
    """Tokens normalizados e com plural removido."""
    out = []
    for t in norm(texto).split():
        if t.isdigit() or (remover_stop and t in STOP):
            continue
        out.append(stem(t))
    return out


def tem_frase(texto_norm: str, frase_norm: str) -> bool:
    return f" {frase_norm} " in f" {texto_norm} "


def gatilho(texto_norm: str, toks_norm: list, g: str) -> bool:
    """Gatilho 'abc*' casa prefixo de palavra; senão, casa a frase inteira."""
    if g.endswith("*"):
        pre = g[:-1]
        return any(t.startswith(pre) for t in toks_norm)
    return tem_frase(texto_norm, g)


def brl(v: float) -> str:
    s = f"{v:,.2f}"
    return "R$ " + s.replace(",", "X").replace(".", ",").replace("X", ".")
