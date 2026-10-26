/** Espelho do contrato da API (src/saudeplus/schemas.py). Mantenha os dois em sincronia. */

export type Tipo =
  | "recomendacao"
  | "clarificacao"
  | "bloqueio_restrito"
  | "bloqueio_emergencia"
  | "recusa_adversarial";

export interface RecommendRequest {
  mensagem: string; // até 500 caracteres
  sessao_id?: string | null; // 8 a 128 caracteres
}

export interface ProdutoCard {
  id: string;
  nome: string;
  marca: string;
  categoria: string;
  subcategoria: string;
  tamanho: string;
  preco: number;
  nota: number;
  num_avaliacoes: number;
  imagem: string;
  marca_propria: boolean;
  justificativa: string;
  avisos: string[];
}

export interface ForaDaLista {
  produto_id: string;
  nome: string;
  motivo: string;
}

export interface Kit {
  produto_ids: string[];
  subtotal: number;
}

export interface RecommendResponse {
  tipo: Tipo;
  mensagem: string;
  produtos: ProdutoCard[];
  ficou_de_fora: ForaDaLista[];
  kit: Kit | null;
  avisos: string[];
  pergunta: string | null;
  oferecer_farmaceutico: boolean;
  orcamento: number | null;
  total: number | null;
  debug?: Record<string, unknown> | null;
}

export interface HealthResponse {
  status: string;
  versao?: string;
  produtos?: number;
}

export type ChatItem =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "bot"; resp: RecommendResponse }
  | { id: string; role: "error"; text: string; retry: string };

export interface CartLine {
  produto: ProdutoCard;
  qtd: number;
}

export interface Unidade {
  id: string;
  nome: string;
  lat: number;
  lng: number;
  dx: number;
  dy: number;
  km: number;
  h24: boolean;
}
