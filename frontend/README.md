# SaúdePlus · Front-end (Next.js + TypeScript)

App mobile-first que consome a API FastAPI do projeto (`src/saudeplus`).

## Rodar local

```bash
# 1) API (na raiz do repositório)
pip install -r src/requirements.txt
uvicorn saudeplus.main:app --app-dir src --reload        # http://127.0.0.1:8000

# 2) Front (em outro terminal)
cd frontend
cp .env.example .env.local                               # NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm install
npm run dev                                              # http://localhost:3000
```

## Como o front fala com a API

| Chamada | Uso |
| --- | --- |
| `GET /health` | Indicador Online/Offline no topo e teste nos ajustes |
| `POST /recommend` `{ mensagem, sessao_id }` | Toda mensagem do assistente. O `sessao_id` fica no `sessionStorage` e mantém o contexto (follow-ups e comparação via Gemini) |

Os tipos de `src/lib/types.ts` espelham `src/saudeplus/schemas.py`. Se o contrato mudar no backend, atualize os dois.
Cada `tipo` de resposta tem uma tela: `recomendacao` (cards, kit, orçamento, o que ficou de fora), `clarificacao`,
`bloqueio_restrito`, `bloqueio_emergencia` (botões 192/188) e `recusa_adversarial`.

A URL da API pode ser trocada pelo próprio app (ícone de ajustes), útil para apontar para o Render sem novo build.

## Imagens dos produtos

`public/assets/produtos/<id>.png` corresponde ao campo `imagem` do catálogo (`assets/produtos/prod-0001.png`).
Como o catálogo é sintético, as imagens são **embalagens ilustrativas** geradas por `scripts/gerar_imagens.py`
(formato pelo tipo de produto, cor pela marca, nome e tamanho no rótulo). Não usamos fotos nem ativos de marca da empresa do desafio (D-01).
Se o catálogo mudar: `pip install playwright && python -m playwright install chromium && npm run imagens`.

## Funcionalidades

- Assistente com texto ou voz (Web Speech API, pt-BR)
- Cards com imagem, justificativa, avaliação, cuidados do produto e selo de marca própria
- Comparação de 2 a 5 produtos (tabela local + pedido de comparação à IA)
- Kit em 1 toque, barra de orçamento e "o que deixei de fora"
- Unidades próximas com geolocalização (unidades simuladas; em produção, API de lojas)
- Cesta, retirada na unidade escolhida ou entrega por CEP, Pix/cartão simulados
- Passagem para o farmacêutico com resumo da conversa

## Deploy

- **API no Render:** use o `render.yaml` da raiz (ou Build `pip install -r src/requirements.txt`, Start
  `uvicorn saudeplus.main:app --app-dir src --host 0.0.0.0 --port $PORT`). Variáveis: `GEMINI_API_KEY` e
  `SAUDEPLUS_CORS=https://<seu-front>.vercel.app`.
- **Front na Vercel:** Root Directory `frontend`, framework Next.js, variável `NEXT_PUBLIC_API_URL=https://<sua-api>.onrender.com`.
- **GitHub Pages (alternativa):** `NEXT_PUBLIC_BASE_PATH=/<repo> npm run build` e publicar a pasta `out/`.
