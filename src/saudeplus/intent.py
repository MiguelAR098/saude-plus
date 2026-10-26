"""Interpretação de intenção por regras (sem LLM).

No próximo degrau o LLM assume esta etapa, mantendo a mesma saída (Intencao) e
usando estas regras como fallback.
"""
import re
from dataclasses import dataclass, field
from typing import Optional

from .text import gatilho, norm, stem, tokens

GENERICOS = {"pele", "cabelo", "creme", "produto", "algo", "coisa", "protecao", "rotina", "promocao", "filho",
             "filha", "bom", "boa", "melhor", "ideal", "cuidado", "uso", "tipo", "item", "loja", "oferta",
             "desconto", "opcao", "necessario", "algum", "alguma", "tem", "bebe", "criancas", "crianca", "presente",
             "presentear", "kit"}
GENERICOS_STEM = {stem(g) for g in GENERICOS}

INFANTIL = {"bebe", "nenem", "crianca", "criancas", "filho", "filha", "infantil", "infantis", "kids", "menino",
            "menina", "neto", "neta", "sobrinho", "sobrinha"}
TIPOS_PELE = {"seca": "seca", "oleosa": "oleosa", "oleoso": "oleosa", "mista": "mista", "sensivel": "sensivel",
              "sensiveis": "sensivel", "normal": "normal"}
BARATO = ["barato", "baratinho", "economico", "economizar", "menor preco", "custo beneficio"]
_SAUDACAO = re.compile(r"^(oi|ola|bom dia|boa tarde|boa noite|e ai|tudo bem)( tudo bem| como vai)?$")

# (rótulo, gatilhos, {subcategoria: reforço}). Gatilho com * casa prefixo de palavra.
LEXICO = [
    ("pele seca", ["pele seca", "resseca*", "descasc*", "repuxand*"],
     {"hidratante-corporal-seca": 3, "hidratante-facial": 2}),
    ("frio e inverno", ["inverno", "frio"],
     {"hidratante-corporal-seca": 1, "protetor-labial": 1, "hidratante-maos": 1, "hidratante-facial": 0.5}),
    ("rotina facial", ["rotina facial", "skincare", "skin care", "rosto", "facial", "cuidar do rosto"],
     {"limpeza-facial": 2.5, "hidratante-facial": 2.5, "protetor-solar-facial": 2.5, "serum": 1,
      "hidratante-corporal-seca": -6, "hidratante-corporal-diario": -6}),
    ("manchas na pele", ["mancha*", "melasma", "uniformizar"],
     {"serum": 3, "protetor-solar-facial": 2, "hidratante-facial": 0.5}),
    ("proteção solar", ["protetor solar", "protecao solar", "filtro solar", "fps", "bloqueador"],
     {"protetor-solar-facial": 2, "protetor-solar-corporal": 2, "protetor-solar-infantil": 2}),
    ("praia ou piscina", ["praia", "piscina", "litoral"],
     {"protetor-solar-corporal": 2, "protetor-solar-infantil": 2, "pos-sol": 1.5, "repelente": 1,
      "kit-viagem": 1, "protetor-solar-facial": -2}),
    ("viagem", ["viagem", "viajar", "viajo", "viajando"],
     {"kit-viagem": 1.5, "repelente": 1.5, "protetor-solar-corporal": 1, "protetor-solar-infantil": 1}),
    ("pós-sol", ["pos sol", "tempo no sol", "muito sol", "exposicao ao sol", "queimei no sol"], {"pos-sol": 4}),
    ("caspa", ["caspa*", "descamacao"], {"shampoo-anticaspa": 4}),
    ("cabelos cacheados", ["cacheado*", "cacho*", "frizz", "crespo*"],
     {"cachos": 3, "leave-in": 1.5, "mascara-capilar": 1.5, "condicionador": 1}),
    ("primeiros socorros", ["primeiros socorros", "curativo*", "machucado*", "ferimento*", "arranhao*"],
     {"curativos": 2, "algodao-gaze": 2, "alcool": 2, "termometro": 1.5, "kit-primeiros-socorros": 2}),
    ("higiene bucal", ["bucal", "dente*", "dental", "escovar", "higiene da boca"],
     {"creme-dental": 2, "escova-dental": 2, "fio-dental": 2, "enxaguante-bucal": 2, "kit-higiene-bucal": 1.5,
      "creme-dental-infantil": 1}),
    ("mãos", ["mao", "maos"], {"hidratante-maos": 4}),
    ("lábios", ["labio*", "labial"], {"protetor-labial": 4}),
    ("banho", ["banho", "banhar"],
     {"sabonete-infantil": 2, "shampoo-infantil": 2, "hidratante-infantil": 1.5, "kit-cuidados-infantis": 1.5,
      "sabonete-liquido": 1, "lenco-umedecido": 0.5}),
    ("desodorante", ["desodorante*", "antitranspirante*", "suor"], {"desodorante": 4}),
    ("depilação", ["depila*", "cera depilatoria", "barbear", "barba", "raspar"], {"depilacao": 4}),
    ("repelente", ["repelente*", "mosquito*", "inseto*", "pernilongo*", "trilha"], {"repelente": 4}),
    ("termômetro", ["termometro*", "medir a temperatura"], {"termometro": 4}),
    ("conforto para dormir", ["dormir", "sono", "barulho*", "barulhent*"], {"conforto-sono": 4}),
    ("presente", ["presente*", "presentear"],
     {"kit-banho-corpo": 4, "kit-rotina-facial": 3.5, "hidratante-facial": 3, "hidratante-corporal-seca": 3,
      "protetor-labial": 2.5, "hidratante-maos": 2.5}),
    ("higiene íntima", ["absorvente*", "menstrua*"], {"absorvente": 4}),
    ("limpeza do rosto", ["demaquilante*", "maquiagem", "agua micelar"], {"demaquilante": 3, "limpeza-facial": 1}),
]


@dataclass
class Intencao:
    mensagem: str
    orcamento: Optional[float] = None
    infantil: bool = False
    tipos_pele: set = field(default_factory=set)
    subcats_alvo: dict = field(default_factory=dict)
    necessidades: list = field(default_factory=list)
    barato: bool = False
    quer_kit: bool = False
    tokens: list = field(default_factory=list)        # tokens específicos (para a busca)
    genericos: list = field(default_factory=list)     # palavras genéricas detectadas
    sem_necessidade: bool = False                     # nada específico: perguntar


def _orcamento(msg: str) -> Optional[float]:
    t = msg.lower()
    m = re.search(r"r\$\s*(\d{1,4}(?:[.,]\d{1,2})?)", t) or re.search(r"\b(\d{1,4}(?:[.,]\d{1,2})?)\s*reais\b", t)
    if not m:
        return None
    s = m.group(1)
    s = s.replace(".", "").replace(",", ".") if "," in s else s
    try:
        v = float(s)
    except ValueError:
        return None
    return v if v > 0 else None


def eh_saudacao(mensagem: str) -> bool:
    return bool(_SAUDACAO.fullmatch(norm(mensagem)))


def interpretar(mensagem: str) -> Intencao:
    tn = norm(mensagem)
    toks_norm = tn.split()
    it = Intencao(mensagem=mensagem)
    it.orcamento = _orcamento(mensagem)
    it.infantil = bool(INFANTIL & set(toks_norm))
    it.tipos_pele = {TIPOS_PELE[t] for t in toks_norm if t in TIPOS_PELE}
    it.barato = any(b in tn for b in BARATO)
    it.quer_kit = "kit" in toks_norm or "presente" in tn

    for rotulo, gatilhos, subcats in LEXICO:
        if any(gatilho(tn, toks_norm, g) for g in gatilhos):
            it.necessidades.append(rotulo)
            for sc, peso in subcats.items():
                it.subcats_alvo[sc] = it.subcats_alvo.get(sc, 0.0) + peso

    todos = tokens(mensagem)
    it.genericos = [t for t in todos if t in GENERICOS_STEM]
    it.tokens = [t for t in todos if t not in GENERICOS_STEM]
    it.sem_necessidade = not it.necessidades and not it.tokens
    return it


def pergunta_de_clarificacao(it: Intencao) -> str:
    g = set(it.genericos)
    if "promocao" in g or "oferta" in g or "desconto" in g:
        return ("Eu ajudo a encontrar produtos pela sua necessidade, e não por promoções. "
                "O que você quer resolver hoje (por exemplo, hidratação, proteção solar, cabelo ou higiene bucal)?")
    if g & {"filho", "filha", "bebe", "crianca", "criancas"}:
        return ("Para quem você quer ajudar: qual a idade da criança e o que você quer resolver "
                "(banho, proteção solar, higiene bucal, hidratação)?")
    if "pele" in g:
        return ("O que você quer resolver na pele (hidratação, proteção solar, manchas, limpeza) "
                "e qual é o seu tipo de pele (seca, oleosa, mista, sensível)?")
    if "cabelo" in g:
        return "O que você quer resolver no cabelo (caspa, ressecamento, frizz, cachos)?"
    if "creme" in g:
        return "Esse creme é para qual finalidade e região: rosto, corpo, mãos ou bebê?"
    if "protecao" in g:
        return "Proteção contra o quê: sol, insetos ou outra necessidade?"
    if "rotina" in g:
        return "Rotina de quê: cuidados com o rosto, o corpo ou o cabelo?"
    return ("Me conte a necessidade que você quer resolver (por exemplo, hidratação, proteção solar, cabelo, "
            "higiene bucal) e para quem é.")
