"""Contrato da API (mesmo formato que o front vai consumir)."""
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

Tipo = Literal["recomendacao", "clarificacao", "bloqueio_restrito", "bloqueio_emergencia", "recusa_adversarial"]


class RecommendRequest(BaseModel):
    mensagem: str = Field(max_length=500)
    sessao_id: Optional[str] = None  # reservado para memória de conversa (próximo degrau)

    @field_validator("mensagem")
    @classmethod
    def nao_vazia(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("mensagem vazia")
        return v


class ProdutoCard(BaseModel):
    id: str
    nome: str
    marca: str
    categoria: str
    subcategoria: str
    tamanho: str
    preco: float
    nota: float
    num_avaliacoes: int
    imagem: str
    marca_propria: bool
    justificativa: str
    avisos: list[str] = []


class ForaDaLista(BaseModel):
    produto_id: str
    nome: str
    motivo: str


class Kit(BaseModel):
    produto_ids: list[str]
    subtotal: float


class RecommendResponse(BaseModel):
    tipo: Tipo
    mensagem: str
    produtos: list[ProdutoCard] = []
    ficou_de_fora: list[ForaDaLista] = []
    kit: Optional[Kit] = None
    avisos: list[str] = []
    pergunta: Optional[str] = None
    oferecer_farmaceutico: bool = False
    orcamento: Optional[float] = None
    total: Optional[float] = None
    debug: Optional[dict] = None
