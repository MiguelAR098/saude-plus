"""Agente Gemini com acesso limitado ao recomendador local."""
import re
import json
from typing import Callable

from google import genai
from pydantic import BaseModel, Field, field_validator

from . import config, data, guardrails, intent
from .schemas import RecommendResponse
from .text import brl, norm, tokens

_NECESSIDADES = {rotulo: subcats for rotulo, _, subcats in intent.LEXICO}
_TIPOS_PELE = {"seca", "oleosa", "mista", "sensivel", "normal"}
_PRESCRITIVO = re.compile(r"\b(tome|use|experimente|aplique)\b", re.IGNORECASE)
_MAIS_BARATO = re.compile(r"\b(mais barato|mais barata|menor preco|custa menos|mais em conta|menor valor)\b")
_MAIS_CARO = re.compile(r"\b(mais caro|mais cara|maior preco|custa mais|maior valor)\b")
_MELHOR_AVALIACAO = re.compile(r"\b(melhor avaliacao|maior nota|mais bem avaliado|melhor nota)\b")
_MAIS_INDICADO = re.compile(r"\b(mais indicado|mais indicada|melhor para|mais adequado|mais adequada)\b")
_COMPARAR_EXPLICITO = re.compile(r"\b(compare|comparar|comparacao|diferenca entre)\b")
_REFERENCIA_SESSAO = re.compile(
	r"\b(qual deles|qual delas|qual desses|qual dessas|entre eles|entre elas|desses produtos|"
	r"dessas opcoes|esses produtos|essas opcoes|comparar|compare|tem diferenca)\b"
)


class _ArgumentosBusca(BaseModel):
	necessidades: list[str] = Field(default_factory=list, max_length=8)
	termos_busca: list[str] = Field(default_factory=list, max_length=12)
	orcamento: float | None = Field(default=None, gt=0, le=1_000_000)
	infantil: bool = False
	tipos_pele: list[str] = Field(default_factory=list, max_length=5)
	barato: bool = False
	quer_kit: bool = False

	@field_validator("orcamento", mode="before")
	@classmethod
	def zero_significa_sem_orcamento(cls, valor):
		return None if valor == 0 or valor == "" else valor

	@field_validator("necessidades")
	@classmethod
	def necessidades_conhecidas(cls, valores: list[str]) -> list[str]:
		if any(valor not in _NECESSIDADES for valor in valores):
			raise ValueError("necessidade desconhecida")
		return list(dict.fromkeys(valores))

	@field_validator("tipos_pele")
	@classmethod
	def tipos_conhecidos(cls, valores: list[str]) -> list[str]:
		if any(valor not in _TIPOS_PELE for valor in valores):
			raise ValueError("tipo de pele desconhecido")
		return list(dict.fromkeys(valores))

	@field_validator("termos_busca")
	@classmethod
	def termos_limitados(cls, valores: list[str]) -> list[str]:
		if any(len(valor) > 40 for valor in valores):
			raise ValueError("termo de busca muito longo")
		return valores


class _TextoAgente(BaseModel):
	mensagem: str = Field(min_length=1, max_length=500)


class _ArgumentosComparacao(BaseModel):
	produto_ids: list[str] = Field(min_length=2, max_length=5)


class _ArgumentosPergunta(BaseModel):
	pergunta: str = Field(min_length=1, max_length=300)
	produto_ids: list[str] = Field(default_factory=list, max_length=5)


_FERRAMENTA_BUSCA = {
	"type": "function",
	"name": "buscar_produtos_catalogo",
	"description": "Interpreta a necessidade e consulta produtos disponíveis no catálogo local.",
	"parameters": {
		"type": "object",
		"properties": {
			"necessidades": {"type": "array", "items": {"type": "string", "enum": list(_NECESSIDADES)}},
			"termos_busca": {"type": "array", "items": {"type": "string"}},
			"orcamento": {"type": "number"},
			"infantil": {"type": "boolean"},
			"tipos_pele": {"type": "array", "items": {"type": "string", "enum": sorted(_TIPOS_PELE)}},
			"barato": {"type": "boolean"},
			"quer_kit": {"type": "boolean"},
		},
		"required": ["necessidades", "termos_busca", "infantil", "tipos_pele", "barato", "quer_kit"],
	},
}

_FERRAMENTA_PERGUNTA = {
	"type": "function",
	"name": "consultar_produtos_da_sessao",
	"description": "Busca dados factuais dos produtos recomendados nesta conversa para responder uma dúvida sem recomendar novamente.",
	"parameters": {
		"type": "object",
		"properties": {
			"pergunta": {"type": "string"},
			"produto_ids": {"type": "array", "items": {"type": "string"}, "maxItems": 5},
		},
		"required": ["pergunta", "produto_ids"],
	},
}

_FERRAMENTA_COMPARACAO = {
	"type": "function",
	"name": "comparar_opcoes",
	"description": "Compara produtos retornados pela busca ou recomendação anterior da sessão.",
	"parameters": {
		"type": "object",
		"properties": {
			"produto_ids": {
				"type": "array",
				"items": {"type": "string"},
				"minItems": 2,
				"maxItems": 5,
			},
		},
		"required": ["produto_ids"],
	},
}

_INSTRUCOES = (
	"Você é um assistente de descoberta de produtos de cuidados pessoais. Escolha uma única ação: "
	"buscar_produtos_catalogo para uma nova necessidade de compra; comparar_opcoes para comparar "
	"produtos recomendados nesta conversa; consultar_produtos_da_sessao para responder uma pergunta "
	"factual sobre esses produtos sem recomendá-los de novo. Nunca diagnostique nem recomende medicamentos. "
	"O backend é a fonte autoritativa para catálogo, preços, estoque e orçamento. Não invente informações "
	"nem faça alegações clínicas. O contexto anterior contém preferências resumidas e produtos recomendados; "
	"use-o para resolver referências como 'esse' ou 'qual deles'. Valores explícitos na mensagem atual prevalecem."
)

_INSTRUCOES_RESUMO = (
	"Responda à pergunta atual em português, sem repetir automaticamente a recomendação. Use somente "
	"os dados retornados pelo backend e o contexto fornecido. Compare quando solicitado; para outra dúvida, "
	"responda apenas se os dados disponíveis sustentarem a resposta. Se faltar informação ou a pergunta "
	"for clínica, diga isso claramente e oriente a procurar um profissional. Não invente produtos, preços, "
	"benefícios ou alegações clínicas e não dê instruções de uso."
)

_CLIENTE: genai.Client | None = None


def _cliente() -> genai.Client:
	global _CLIENTE
	if not config.GEMINI_API_KEY:
		raise RuntimeError("GEMINI_API_KEY não configurada")
	if _CLIENTE is None:
		_CLIENTE = genai.Client(api_key=config.GEMINI_API_KEY)
	return _CLIENTE


def _montar_intencao(mensagem: str, argumentos: dict) -> intent.Intencao:
	dados = _ArgumentosBusca.model_validate(argumentos)
	it = intent.Intencao(mensagem=mensagem)
	it.orcamento = intent._orcamento(mensagem)
	it.infantil = dados.infantil
	it.tipos_pele = set(dados.tipos_pele)
	it.barato = dados.barato
	it.quer_kit = dados.quer_kit
	it.necessidades = dados.necessidades
	for necessidade in dados.necessidades:
		for subcategoria, peso in _NECESSIDADES[necessidade].items():
			it.subcats_alvo[subcategoria] = it.subcats_alvo.get(subcategoria, 0.0) + peso
	it.tokens = list(dict.fromkeys(tokens(" ".join(dados.termos_busca))))
	termos_genericos = set(intent.GENERICOS_STEM)
	it.genericos = [termo for termo in tokens(mensagem) if termo in termos_genericos]
	it.sem_necessidade = not it.necessidades and not it.tokens
	return it


def _comparar_produtos(
	produto_ids: list[str],
	resposta: RecommendResponse,
	contexto: dict | None = None,
) -> list[dict]:
	argumentos = _ArgumentosComparacao(produto_ids=produto_ids)
	selecionados = {produto.id: produto for produto in resposta.produtos}
	ids_anteriores = set((contexto or {}).get("produto_ids", []))
	resultado = []
	for produto_id in argumentos.produto_ids:
		if produto_id in selecionados:
			produto = selecionados[produto_id]
			resultado.append({
				"id": produto.id,
				"nome": produto.nome,
				"marca": produto.marca,
				"categoria": produto.subcategoria,
				"preco": produto.preco,
				"nota": produto.nota,
				"tamanho": produto.tamanho,
			})
			continue
		produto = data.catalogo().get(produto_id)
		if produto_id not in ids_anteriores or not produto or not produto["estoque_simulado"]:
			raise ValueError("comparação contém produto fora da sessão ou indisponível")
		resultado.append({
			"id": produto["id"],
			"nome": produto["nome"],
			"marca": produto["marca"],
			"categoria": produto["subcategoria"],
			"preco": produto["preco"],
			"nota": produto["nota"],
			"tamanho": produto["tamanho"],
		})
	return resultado


def _consultar_produtos(
	argumentos: dict,
	resposta: RecommendResponse,
	contexto: dict | None = None,
) -> dict:
	dados = _ArgumentosPergunta.model_validate(argumentos)
	ids_sessao = set((contexto or {}).get("produto_ids", []))
	ids_resposta = {produto.id for produto in resposta.produtos}
	ids_solicitados = dados.produto_ids or list((contexto or {}).get("produto_ids", []))
	if not ids_solicitados:
		return {"pergunta": dados.pergunta, "produtos": [], "observacao": "Não há produtos anteriores nesta sessão."}
	produtos = []
	for produto_id in ids_solicitados:
		if produto_id not in ids_sessao and produto_id not in ids_resposta:
			raise ValueError("consulta contém produto fora da sessão")
		produto = data.catalogo().get(produto_id)
		if not produto:
			raise ValueError("produto não existe no catálogo")
		produtos.append({
			"id": produto["id"],
			"nome": produto["nome"],
			"marca": produto["marca"],
			"categoria": produto["subcategoria"],
			"preco": produto["preco"],
			"nota": produto["nota"],
			"tamanho": produto["tamanho"],
			"descricao": produto["descricao_curta"],
			"indicado_para": produto["indicado_para"],
			"tipo_pele": produto["tipo_pele"],
			"ingredientes": produto["ingredientes_chave"],
			"alertas": produto["alertas"],
			"contraindicacoes": produto["contraindicacoes"],
			"disponivel": produto["estoque_simulado"],
		})
	return {"pergunta": dados.pergunta, "produtos": produtos}


def _responder_comparacao_simples(mensagem: str, contexto: dict | None) -> RecommendResponse | None:
	consulta = norm(mensagem)
	ids_mencionados = _ids_produtos_mencionados(consulta)
	comparacao_por_metrica = bool(
		_MAIS_BARATO.search(consulta) or _MAIS_CARO.search(consulta) or _MELHOR_AVALIACAO.search(consulta)
		or _MAIS_INDICADO.search(consulta)
	)
	if len(ids_mencionados) >= 2 and (_COMPARAR_EXPLICITO.search(consulta) or comparacao_por_metrica):
		ids = ids_mencionados
	elif comparacao_por_metrica and _REFERENCIA_SESSAO.search(consulta):
		ids = (contexto or {}).get("produto_ids", [])
	elif _COMPARAR_EXPLICITO.search(consulta) and contexto:
		ids = (contexto or {}).get("produto_ids", [])
	else:
		return None
	if len(ids) < 2:
		return None

	produtos = _detalhes_catalogo(ids)
	if len(produtos) < 2:
		return None
	if _MAIS_BARATO.search(consulta):
		produto = min(produtos, key=lambda item: item["preco"])
		mensagem_resposta = f"O mais barato é {produto['nome']} por {brl(produto['preco'])}."
	elif _MAIS_CARO.search(consulta):
		produto = max(produtos, key=lambda item: item["preco"])
		mensagem_resposta = f"O mais caro é {produto['nome']} por {brl(produto['preco'])}."
	elif _MELHOR_AVALIACAO.search(consulta):
		produto = max(produtos, key=lambda item: item["nota"])
		mensagem_resposta = f"A maior avaliação é de {produto['nome']}, com nota {produto['nota']:.1f}."
	elif _MAIS_INDICADO.search(consulta):
		mensagem_resposta = _resumir_adequacao(produtos, consulta)
	elif _COMPARAR_EXPLICITO.search(consulta):
		mensagem_resposta = _resumir_comparacao(produtos, consulta)
	else:
		return None
	return RecommendResponse(tipo="resposta", mensagem=mensagem_resposta)


def _ids_produtos_mencionados(consulta: str) -> list[str]:
	"""Resolve nomes completos citados pelo usuário sem pedir IDs ao modelo."""
	candidatos = []
	for produto_id, produto in data.catalogo().items():
		nome = norm(produto["nome"])
		if not nome:
			continue
		padrao = re.compile(rf"(?<!\w){re.escape(nome)}(?!\w)")
		for match in padrao.finditer(consulta):
			candidatos.append((len(nome), match.start(), match.end(), produto_id))

	selecionados = []
	for _, inicio, fim, produto_id in sorted(candidatos, key=lambda item: (-item[0], item[1])):
		if any(inicio < outro_fim and fim > outro_inicio for outro_inicio, outro_fim, _ in selecionados):
			continue
		selecionados.append((inicio, fim, produto_id))
	return [produto_id for _, _, produto_id in sorted(selecionados)]


def _detalhes_catalogo(produto_ids: list[str]) -> list[dict]:
	produtos = data.catalogo()
	return [
		{
			"id": produtos[produto_id]["id"],
			"nome": produtos[produto_id]["nome"],
			"marca": produtos[produto_id]["marca"],
			"categoria": produtos[produto_id]["subcategoria"],
			"preco": produtos[produto_id]["preco"],
			"nota": produtos[produto_id]["nota"],
			"tamanho": produtos[produto_id]["tamanho"],
			"indicado_para": produtos[produto_id]["indicado_para"],
			"ingredientes": produtos[produto_id]["ingredientes_chave"],
			"alertas": produtos[produto_id]["alertas"],
			"contraindicacoes": produtos[produto_id]["contraindicacoes"],
		}
		for produto_id in produto_ids
		if produto_id in produtos
	]


def _resumir_comparacao(produtos: list[dict], consulta: str) -> str:
	indicacoes = [set(produto["indicado_para"]) for produto in produtos]
	comuns = set.intersection(*indicacoes) if indicacoes else set()
	partes = []
	if comuns:
		partes.append("Todos constam como indicados para " + ", ".join(sorted(comuns)) + ".")

	termos_consulta = set(tokens(consulta))
	for produto in produtos:
		especificas = set(produto["indicado_para"]) - comuns
		correspondencias = [
			indicacao for indicacao in especificas
			if termos_consulta & set(tokens(indicacao))
		]
		if correspondencias:
			partes.append(f"{produto['nome']} também lista {', '.join(sorted(correspondencias))}.")
			partes.append(
				f"Se esse for seu critério, {produto['nome']} é o mais alinhado às indicações cadastradas; "
				"isso não significa superioridade clínica."
			)

	partes.append("Comparação do catálogo: " + "; ".join(
		f"{produto['nome']} custa {brl(produto['preco'])} ({_preco_por_100ml(produto)}), "
		f"tem {produto['tamanho']} e nota {produto['nota']:.1f}/5"
		for produto in produtos
	) + ".")
	if len(comuns) == 0 or all(set(produto["indicado_para"]) == comuns for produto in produtos):
		partes.append("Pelas indicações cadastradas, não há um vencedor geral; depende do critério que você prioriza.")
	return " ".join(partes)


def _resumir_adequacao(produtos: list[dict], consulta: str) -> str:
	termos_consulta = set(tokens(consulta)) - {"shampoo", "produto", "produtos", "compare", "comparar", "indicado", "indicada", "adequado", "adequada"}
	correspondencias = {
		produto["id"]: [
			indicacao for indicacao in produto["indicado_para"]
			if termos_consulta & set(tokens(indicacao))
		]
		for produto in produtos
	}
	melhor = max((len(itens) for itens in correspondencias.values()), default=0)
	if melhor:
		vencedores = [produto for produto in produtos if len(correspondencias[produto["id"]]) == melhor]
		if len(vencedores) == 1:
			produto = vencedores[0]
			return (
				f"Pelas indicações cadastradas, {produto['nome']} corresponde melhor ao critério "
				f"{', '.join(correspondencias[produto['id']])}. Isso compara apenas o catálogo; "
				"não determina superioridade clínica."
			)
	indicacoes_comuns = set.intersection(*(set(produto["indicado_para"]) for produto in produtos))
	if indicacoes_comuns:
		return (
			f"Pelas indicações cadastradas, ambos atendem a {', '.join(sorted(indicacoes_comuns))}. "
			"O catálogo não fornece base suficiente para declarar um deles clinicamente superior."
		)
	return "O catálogo não tem informações suficientes para afirmar qual é mais indicado."


def _preco_por_100ml(produto: dict) -> str:
	volume = re.search(r"(\d+(?:[.,]\d+)?)\s*ml\b", norm(produto["tamanho"]))
	if not volume:
		return "volume não informado"
	ml = float(volume.group(1).replace(",", "."))
	if ml <= 0:
		return "volume não informado"
	return f"{brl(produto['preco'] * 100 / ml)} por 100 ml"


def responder_comparacao(mensagem: str, contexto: dict | None = None) -> RecommendResponse | None:
	"""Resolve comparações claras no catálogo antes de chamar o agente ou o fallback."""
	return _responder_comparacao_simples(mensagem, contexto)


def _gerar_resposta(
	cliente: genai.Client,
	entrada: str,
	interacao: object,
	nome_ferramenta: str,
	call_id: str,
	resultado_ferramenta: dict | list,
	resposta: RecommendResponse,
	contexto: dict | None,
	permitir_comparacao: bool = False,
) -> RecommendResponse:
	historico = [{"type": "user_input", "content": [{"type": "text", "text": entrada}]}]
	historico.extend(etapa.model_dump(mode="json") for etapa in interacao.steps)
	historico.append({
		"type": "function_result",
		"name": nome_ferramenta,
		"call_id": call_id,
		"result": [{"type": "text", "text": json.dumps(resultado_ferramenta, ensure_ascii=False)}],
	})
	kwargs = {
		"model": config.GEMINI_MODEL,
		"input": historico,
		"system_instruction": _INSTRUCOES_RESUMO,
		"generation_config": {"thinking_level": "low", "tool_choice": "none"},
		"response_format": {
			"type": "text",
			"mime_type": "application/json",
			"schema": _TextoAgente.model_json_schema(),
		},
		"store": False,
	}
	final = cliente.interactions.create(**kwargs)
	texto = _TextoAgente.model_validate_json(final.output_text).mensagem.strip()
	if not texto or _PRESCRITIVO.search(texto) or guardrails.contem_restrito(texto):
		raise ValueError("A resposta conversacional não passou pela validação")
	resposta.mensagem = texto
	return resposta


def recomendar(
	mensagem: str,
	executar_busca: Callable[[intent.Intencao], RecommendResponse],
	contexto: dict | None = None,
) -> RecommendResponse:
	"""Delega interpretação ao Gemini e execução da busca ao backend local."""
	cliente = _cliente()
	entrada = json.dumps({"mensagem_atual": mensagem, "contexto_anterior": contexto or {}}, ensure_ascii=False)
	consulta = norm(mensagem)
	seguir_sessao = bool(contexto and contexto.get("produto_ids") and _REFERENCIA_SESSAO.search(consulta))
	ferramentas = (
		[_FERRAMENTA_COMPARACAO, _FERRAMENTA_PERGUNTA]
		if seguir_sessao
		else [_FERRAMENTA_BUSCA, _FERRAMENTA_COMPARACAO, _FERRAMENTA_PERGUNTA]
	)
	interacao = cliente.interactions.create(
		model=config.GEMINI_MODEL,
		input=entrada,
		system_instruction=_INSTRUCOES,
		tools=ferramentas,
		generation_config={
			"thinking_level": "low",
			"tool_choice": {"allowed_tools": {"mode": "any", "tools": [ferramenta["name"] for ferramenta in ferramentas]}},
		},
		store=False,
	)
	chamadas = [etapa for etapa in interacao.steps if etapa.type == "function_call"]
	if len(chamadas) != 1:
		raise ValueError("O agente não solicitou exatamente uma ferramenta válida")

	chamada = chamadas[0]
	if chamada.name == _FERRAMENTA_BUSCA["name"]:
		intencao = _montar_intencao(mensagem, chamada.arguments)
		resposta = executar_busca(intencao)
		if resposta.tipo != "recomendacao":
			return resposta
		resultado = resposta.model_dump(exclude={"debug"})
	elif chamada.name == _FERRAMENTA_COMPARACAO["name"]:
		resposta = RecommendResponse(tipo="resposta", mensagem="")
		resultado = _comparar_produtos(chamada.arguments.get("produto_ids", []), resposta, contexto)
	elif chamada.name == _FERRAMENTA_PERGUNTA["name"]:
		resposta = RecommendResponse(tipo="resposta", mensagem="")
		resultado = _consultar_produtos(chamada.arguments, resposta, contexto)
		if not resultado["produtos"]:
			mensagem_fallback = "Ainda não há produtos nesta conversa para eu comparar ou esclarecer. Conte o que você procura primeiro."
			return RecommendResponse(tipo="clarificacao", mensagem=mensagem_fallback, pergunta=mensagem_fallback)
	else:
		raise ValueError("O agente solicitou uma ferramenta desconhecida")

	return _gerar_resposta(
		cliente=cliente,
		entrada=entrada,
		interacao=interacao,
		nome_ferramenta=chamada.name,
		call_id=chamada.id,
		resultado_ferramenta=resultado,
		resposta=resposta,
		contexto=contexto,
	)
