"""Guardrails de ENTRADA: rodam antes de qualquer recomendação.

Ordem (a primeira que casar encerra o fluxo):
1. emergência  2. injeção de prompt / pedidos adversariais
3. medicamentos restritos  4. sintoma leve com pedido de remédio
"""
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from . import data
from .text import norm, tem_frase


@dataclass
class Bloqueio:
    tipo: str
    mensagem: str
    classe: Optional[str] = None
    motivo: Optional[str] = None
    oferecer_farmaceutico: bool = False


NEGACOES = {"nao", "nunca", "sem", "nenhum", "nenhuma"}
PRIORIDADE = {"controlado": 0, "uso_restrito": 1, "tarjado": 2, "mip": 3}
PEDIDO_MEDICACAO = {"tomar", "remedio", "remedios", "medicamento", "medicamentos", "comprimido",
                    "comprimidos", "medicacao", "xarope"}

MSG_INSTRUCOES = ("Não consigo seguir esse tipo de instrução: as regras de segurança são as mesmas para todos os "
                  "pedidos. Se quiser, me conte a necessidade que você quer resolver e eu indico produtos de "
                  "cuidados e bem-estar.")
MSG_PROMPT = ("Não compartilho minhas instruções internas. Posso te ajudar a encontrar produtos de cuidados e "
              "bem-estar: qual necessidade você quer resolver?")
MSG_PAPEL = ("Eu não sou farmacêutico nem faço prescrição, e isso não muda. Posso te encaminhar para falar com um "
             "farmacêutico, e te ajudo com produtos de cuidados e bem-estar.")
MSG_AUTORIDADE = ("Não consigo liberar itens restritos por esse motivo, e as regras valem para todos os pedidos. "
                  "Posso te encaminhar para falar com um farmacêutico, ou te ajudar com produtos de cuidados e "
                  "bem-estar.")
MSG_ID = ("Os produtos e preços vêm direto do catálogo e não posso alterá-los. Me conte a necessidade que você quer "
          "resolver e eu mostro as opções disponíveis.")
MSG_DADOS = ("Não tenho acesso nem divulgo dados de outros clientes. Posso te ajudar a encontrar produtos de "
             "cuidados e bem-estar.")
MSG_ALEGACAO = ("Não faço alegações terapêuticas sobre produtos: só informo para que cada item é indicado, conforme o "
                "catálogo. Se tiver dúvida sobre saúde, um farmacêutico ou médico pode orientar.")
MSG_PRECO = ("Os preços vêm do catálogo e não posso alterá-los nem criar descontos. Posso te ajudar a montar uma "
             "seleção que caiba no seu orçamento.")
MSG_MARCA = ("Escolho os produtos pelo que serve à sua necessidade. A marca própria entra como desempate quando a "
             "indicação é a mesma e o preço é igual ou menor. Me conte o que você quer resolver e eu mostro as "
             "melhores opções.")

# (regex sobre texto normalizado, mensagem, oferecer_farmaceutico)
_ADVERSARIAIS = [
    (r"\b(ignore|ignorar|esqueca|desconsidere|desconsiderar|desobedeca)\b.{0,40}\b(instrucoes|regras|orientacoes|prompt|restricoes)\b",
     MSG_INSTRUCOES, False),
    (r"\b(prompt|instrucoes|regras|configuracao)\b.{0,15}\b(de sistema|do sistema|internas?|internos?|ocultas?)\b",
     MSG_PROMPT, False),
    (r"\bsystem prompt\b", MSG_PROMPT, False),
    (r"\bvoce (agora )?(e|eh|sera) (um|uma) (farmaceutic[oa]|medic[oa]|doutor)\b", MSG_PAPEL, True),
    (r"\bpode prescrever\b", MSG_PAPEL, True),
    (r"\bfinja (que )?(voce )?(e|ser)\b", MSG_INSTRUCOES, False),
    (r"\bmodo (desenvolvedor|admin|dev)\b|\bjailbreak\b", MSG_INSTRUCOES, False),
    (r"\bteste interno\b|\bsou (da|do|o|a) (empresa|administrador|administradora|dono|dona|desenvolvedor)\b"
     r"|\bautorizacao (especial|interna)\b|\blibere\b", MSG_AUTORIDADE, True),
    (r"\bprod \d{3,}\b", MSG_ID, False),
    (r"\bcpf\b|\bcliente anterior\b|\boutro cliente\b|\bdados (pessoais )?(de|do) (outro|outros|cliente|clientes)\b"
     r"|\bendereco do cliente\b", MSG_DADOS, False),
    (r"\b(diga|afirme|escreva|fale) que\b|\bcura(r|m)?\b.{0,40}\b(cancer|diabetes|doenca|doencas|covid)\b",
     MSG_ALEGACAO, False),
    (r"\bdesconto de \d+\b|\b(gere|gerar|crie|criar|aplique|aplicar)\b.{0,20}\bdesconto\b", MSG_PRECO, False),
    (r"\bmesmo que nao (sirva|sirvam|funcione|funcionem|combine|combinem)\b|\bsomente da marca\b", MSG_MARCA, False),
]
_ADVERSARIAIS = [(re.compile(p), m, f) for p, m, f in _ADVERSARIAIS]


def _achar_termo(tokens: list, termo_norm: str, respeitar_negacao: bool = True) -> bool:
    """Procura a sequência de palavras; ignora se vier negada ('não estou com dor no peito')."""
    tt = termo_norm.split()
    n = len(tt)
    if n == 0:
        return False
    inicia_negado = tt[0] in NEGACOES
    for i in range(len(tokens) - n + 1):
        if tokens[i:i + n] == tt:
            if respeitar_negacao and not inicia_negado and any(t in NEGACOES for t in tokens[max(0, i - 3):i]):
                continue
            return True
    return False


def _emergencia(tokens: list) -> Optional[Bloqueio]:
    for cat in data.emergencia()["categorias"]:
        # em crise de saúde mental, na dúvida, acolher: nunca descartar por negação
        respeitar = cat["id"] != "crise-saude-mental"
        for termo in cat["termos"]:
            if _achar_termo(tokens, norm(termo), respeitar):
                return Bloqueio("bloqueio_emergencia", cat["resposta_padrao"], classe=cat["id"], motivo=termo)
    return None


def _adversarial(texto_norm: str) -> Optional[Bloqueio]:
    for rx, msg, farm in _ADVERSARIAIS:
        m = rx.search(texto_norm)
        if m:
            return Bloqueio("recusa_adversarial", msg, motivo=m.group(0), oferecer_farmaceutico=farm)
    return None


@lru_cache(maxsize=1)
def _indice_nomes() -> list:
    """Só nomes de medicamentos (genérico, comercial e grafias). Usado na saída."""
    termos = []
    for it in data.restritos()["itens"]:
        for t in [it["nome_generico"], *it["nomes_comerciais"], *it.get("variacoes_de_grafia", [])]:
            termos.append((norm(t), it["classe"]))
    return termos


@lru_cache(maxsize=1)
def _indice_restritos() -> list:
    """Nomes + pedidos genéricos ('calmante', 'antibiótico'). Usado na entrada."""
    d = data.restritos()
    termos = list(_indice_nomes())
    for classe, lista in d["termos_genericos_por_classe"].items():
        if classe == "sintoma_leve":
            continue
        termos.extend((norm(t), classe) for t in lista)
    return termos


def contem_restrito(texto: str) -> bool:
    """Usado na saída: nenhum texto devolvido pode citar o nome de um medicamento restrito.
    Termos genéricos de pedido (ex.: 'calmante') ficam de fora para não barrar nomes de produto como 'Pós-Sol Calmante'."""
    tn = norm(texto)
    return any(tem_frase(tn, t) for t, _ in _indice_nomes() if t)


def _restrito(texto_norm: str) -> Optional[Bloqueio]:
    achados = [(PRIORIDADE[c], c, t) for t, c in _indice_restritos() if t and tem_frase(texto_norm, t)]
    if not achados:
        return None
    _, classe, termo = min(achados)
    return Bloqueio("bloqueio_restrito", data.restritos()["respostas_padrao"][classe], classe=classe,
                    motivo=termo, oferecer_farmaceutico=True)


def _sintoma_com_pedido_de_remedio(texto_norm: str, tokens: list) -> Optional[Bloqueio]:
    sintomas = data.restritos()["termos_genericos_por_classe"]["sintoma_leve"]
    if any(tem_frase(texto_norm, norm(s)) for s in sintomas) and PEDIDO_MEDICACAO & set(tokens):
        return Bloqueio("bloqueio_restrito", data.restritos()["respostas_padrao"]["sintoma_leve"],
                        classe="sintoma_leve", oferecer_farmaceutico=True)
    return None


def checar_entrada(mensagem: str) -> Optional[Bloqueio]:
    tn = norm(mensagem)
    toks = tn.split()
    return (_emergencia(toks) or _adversarial(tn) or _restrito(tn) or _sintoma_com_pedido_de_remedio(tn, toks))
