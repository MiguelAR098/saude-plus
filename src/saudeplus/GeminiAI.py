"""Agente Gemini com acesso limitado ao recomendador local."""
import re
import json
from typing import Callable

from google import genai
from pydantic import BaseModel, Field, field_validator

from . import config, data, guardrails, intent
from .schemas import RecommendResponse
from .text import tokens

_NECESSIDADES = {rotulo: subcats for rotulo, _, subcats in intent.LEXICO}
_TIPOS_PELE = {"seca", "oleosa", "mista", "sensivel", "normal"}
_PRESCRITIVO = re.compile(r"\b(tome|use|experimente|aplique)\b", re.IGNORECASE)


class _ArgumentosBusca(BaseModel):
	necessidades: list[str] = Field(default_factory=list, max_length=8)
	termos_busca: list[str] = Field(default_factory=list, max_length=12)
	orcamento: float | None = Field(default=None, gt=0, le=1_000_000)
	infantil: bool = False
	tipos_pele: list[str] = Field(default_factory=list, max_length=5)
	barato: bool = False
	quer_kit: bool = False

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
	mensagem: str = Field(min_length=1, max_length=240)


class _ArgumentosComparacao(BaseModel):
	produto_ids: list[str] = Field(min_length=2, max_length=5)


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
	"Você é um agente de descoberta de produtos de cuidados pessoais. Use a ferramenta "
	"buscar_produtos_catalogo para toda solicitação relacionada a produtos. Extraia apenas "
	"necessidades de consumo, nunca diagnostique nem recomende medicamentos. A ferramenta "
	"é a fonte autoritativa de produtos, disponibilidade, preços e orçamento. Não invente "
	"itens, preços, alegações ou orientações clínicas. O contexto anterior contém somente "
	"preferências resumidas e IDs previamente recomendados: use preferências apenas para completar "
	"follow-ups curtos, e IDs somente para comparar opções já recomendadas; valores explícitos na "
	"mensagem atual sempre prevalecem."
)

_INSTRUCOES_RESUMO = (
	"Escreva em português uma mensagem breve de apresentação ou comparação. Use somente os dados "
	"retornados pelas ferramentas. Não invente produtos, preços, benefícios ou alegações clínicas e "
	"não dê instruções de uso. Se comparar opções, limite-se a nome, marca, preço, avaliação e "
	"categoria presentes nos dados."
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
	it.orcamento = intent._orcamento(mensagem) or dados.orcamento
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


def recomendar(
	mensagem: str,
	executar_busca: Callable[[intent.Intencao], RecommendResponse],
	contexto: dict | None = None,
) -> RecommendResponse:
	"""Delega interpretação ao Gemini e execução da busca ao backend local."""
	cliente = _cliente()
	entrada = json.dumps({"mensagem_atual": mensagem, "contexto_anterior": contexto or {}}, ensure_ascii=False)
	interacao = cliente.interactions.create(
		model=config.GEMINI_MODEL,
		input=entrada,
		system_instruction=_INSTRUCOES,
		tools=[_FERRAMENTA_BUSCA],
		generation_config={
			"thinking_level": "low",
			"tool_choice": {"allowed_tools": {"mode": "any", "tools": [_FERRAMENTA_BUSCA["name"]]}},
		},
		store=False,
	)
	chamadas = [etapa for etapa in interacao.steps if etapa.type == "function_call"]
	if len(chamadas) != 1 or chamadas[0].name != _FERRAMENTA_BUSCA["name"]:
		raise ValueError("O agente não solicitou exatamente uma busca válida")

	chamada = chamadas[0]
	intencao = _montar_intencao(mensagem, chamada.arguments)
	resposta = executar_busca(intencao)
	if resposta.tipo != "recomendacao":
		return resposta

	historico = [{"type": "user_input", "content": [{"type": "text", "text": entrada}]}]
	historico.extend(etapa.model_dump(mode="json") for etapa in interacao.steps)
	historico.append({
		"type": "function_result",
		"name": chamada.name,
		"call_id": chamada.id,
		"result": [{"type": "text", "text": resposta.model_dump_json(exclude={"debug"})}],
	})
	comparacao = cliente.interactions.create(
		model=config.GEMINI_MODEL,
		input=historico,
		system_instruction=_INSTRUCOES_RESUMO,
		tools=[_FERRAMENTA_COMPARACAO],
		generation_config={
			"thinking_level": "low",
			"tool_choice": {"allowed_tools": {"mode": "auto", "tools": [_FERRAMENTA_COMPARACAO["name"]]}},
		},
		response_format={
			"type": "text",
			"mime_type": "application/json",
			"schema": _TextoAgente.model_json_schema(),
		},
		store=False,
	)
	chamadas_comparacao = [etapa for etapa in comparacao.steps if etapa.type == "function_call"]
	if len(chamadas_comparacao) > 1:
		raise ValueError("o agente solicitou comparações demais")
	if chamadas_comparacao:
		chamada_comparacao = chamadas_comparacao[0]
		if chamada_comparacao.name != _FERRAMENTA_COMPARACAO["name"]:
			raise ValueError("o agente solicitou uma ferramenta desconhecida")
		dados_comparacao = _comparar_produtos(
			chamada_comparacao.arguments.get("produto_ids", []), resposta, contexto
		)
		historico.extend(etapa.model_dump(mode="json") for etapa in comparacao.steps)
		historico.append({
			"type": "function_result",
			"name": chamada_comparacao.name,
			"call_id": chamada_comparacao.id,
			"result": [{"type": "text", "text": json.dumps(dados_comparacao, ensure_ascii=False)}],
		})
		final = cliente.interactions.create(
			model=config.GEMINI_MODEL,
			input=historico,
			system_instruction=_INSTRUCOES_RESUMO,
			tools=[_FERRAMENTA_COMPARACAO],
			generation_config={"thinking_level": "low", "tool_choice": "none"},
			response_format={
				"type": "text",
				"mime_type": "application/json",
				"schema": _TextoAgente.model_json_schema(),
			},
			store=False,
		)
	else:
		final = comparacao
	texto = _TextoAgente.model_validate_json(final.output_text).mensagem.strip()
	if not texto or _PRESCRITIVO.search(texto) or guardrails.contem_restrito(texto):
		raise ValueError("A mensagem final do agente não passou pela validação")
	resposta.mensagem = texto
	return resposta
