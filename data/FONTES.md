# Fontes dos dados

Registro da origem de tudo que está em `data/` e `tests/` (exigência do Definition of Done: só dados públicos ou sintéticos, com origem registrada).

> **Resumo honesto:** a base de produtos é **sintética**. Nomes de variantes, preços, notas, número de avaliações e estoque foram criados para o protótipo. Marcas de terceiros são **fictícias**. A marca própria **Dauf** é real, mas os produtos Dauf desta base são sintéticos e inspirados nas linhas públicas da marca. Nada aqui representa preço ou item real do e-commerce.

## Produtos (`produtos.csv` → `produtos.json`)

- Gerada em 2026-10-20, com apoio de IA, e **revisada pelo time antes do uso**.
- Total: 151 produtos, dos quais 49 da marca Dauf.
- Valores de `origem_dado`:
  - `sintetico-marca-ficticia`: produto de marca fictícia.
  - `sintetico+linha-dauf-confirmada`: produto Dauf sintético, em linha que a página pública da marca confirma (31 itens).
  - `sintetico+linha-dauf-a-confirmar`: produto Dauf sintético, em linha **ainda não confirmada** no catálogo público (18 itens). Conferir antes do pitch e, se a linha não existir, trocar a marca ou remover.
- Distribuição por categoria:

| Categoria | Produtos |
| --- | --- |
| bebe | 19 |
| bem-estar | 23 |
| cabelo | 22 |
| higiene | 31 |
| kits | 7 |
| pele | 49 |

### Fontes consultadas

| Fonte | O que foi usado | Data | Observações |
| --- | --- | --- | --- |
| Página pública da marca Dauf (https://www.paguemenos.com.br/marca-dauf) | Linhas da marca: protetores solares (hidratantes e oil free), limpeza facial e demaquilantes, depilação (Dauf Depil), higiene, primeiros socorros e kits presenteáveis | 2026-10-20 | Usada só para decidir **quais linhas** têm produtos Dauf na base |
| Notícias públicas sobre a marca própria da rede | Contexto: marca de higiene, beleza, vitaminas e primeiros socorros | 2026-10-20 | Suplementos da marca ficaram **fora** da base (alegações de saúde) |

### O que ainda precisa ser feito pelo time

- [ ] Para os itens `a-confirmar`, conferir no catálogo público se a linha existe.
- [ ] (Opcional) Substituir produtos sintéticos por itens reais do catálogo público, com preço e nota da coleta, mantendo `origem_dado=catalogo-publico`.
- [ ] Trocar as imagens de `assets/produtos/` por placeholders ou imagens próprias (não usar imagens da empresa em material público).
- [ ] Conferir se os termos de uso do site permitem qualquer coleta automática. Preferir coleta manual.

## Medicamentos restritos (`restritos.json`)

- Rascunho gerado com apoio de IA, **sem consulta às fontes oficiais**.
- A classificação de cada item (controlado, tarjado, uso restrito ou isento de prescrição) precisa ser conferida por **duas pessoas** nas fontes abaixo.

| Fonte oficial a consultar | Para conferir | Conferido por | Data |
| --- | --- | --- | --- |
| Anvisa: lista de medicamentos isentos de prescrição | Classe `mip` | | |
| Portaria SVS/MS 344/98 e atualizações | Classe `controlado` | | |
| Bulário / consulta pública da Anvisa | Classes `tarjado` e `uso_restrito` | | |

## Termos de emergência (`termos_emergencia.json`)

- Rascunho gerado com apoio de IA, com base em sinais de alerta comuns de materiais públicos de saúde.
- As respostas padrão devem ser **aprovadas por uma pessoa do squad**, com atenção especial à categoria `crise-saude-mental`.
- Contatos citados: SAMU 192 e CVV 188 (conferir se continuam válidos antes do pitch).

| Revisado por | Data | Observações |
| --- | --- | --- |
| | | |

## Suíte de testes (`tests/prompts_teste.json`)

- 45 casos (20 normais, 8 ambíguos, 8 de saúde/restritos, 9 adversariais), criados pelo squad com apoio de IA.
- Todos os prompts são fictícios. Nenhum dado pessoal.

## Imagens

| Origem | Uso permitido | Observações |
| --- | --- | --- |
| Placeholders ou imagens próprias | Protótipo e demo | Não usar imagens nem o logo da empresa em material público |

## Histórico de alterações

| Data | Quem | O que mudou |
| --- | --- | --- |
| 2026-10-20 | Squad 6 (com apoio de IA) | Base inicial: 149 produtos (+2 de conforto para dormir em 2026-10-20, ids prod-0150 e prod-0151), 54 restritos, 8 categorias de emergência, 45 casos de teste |
