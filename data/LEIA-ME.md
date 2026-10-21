# Como preencher a base de produtos

## Estado atual

A base inicial **já está pronta**: `produtos.csv` (149 produtos sintéticos) e `produtos.json` (gerado e validado). O trabalho agora é **revisar e ajustar**, não começar do zero:

1. Abrir `produtos.csv` no Google Sheets e revisar nomes, preços e notas.
2. Conferir os itens Dauf `a-confirmar` (veja `FONTES.md`).
3. Conferir `restritos.json` e `termos_emergencia.json` nas fontes oficiais (dupla conferência).
4. Rodar `python data/converter_csv.py` depois de qualquer alteração.

## Fluxo para novos produtos

1. Importar `produtos_modelo.csv` no Google Sheets e **apagar as 4 linhas de exemplo** (todas têm `EXEMPLO_APAGAR`).
2. Preencher uma linha por produto.
3. Baixar como CSV e salvar como `data/produtos.csv`.
4. Rodar `python data/converter_csv.py`. O script valida tudo e gera `data/produtos.json`.
5. Corrigir os erros apontados e rodar de novo até aparecer **OK**.
6. Registrar as fontes em `FONTES.md`.

## Regras de preenchimento

| Campo | Regra |
| --- | --- |
| `id` | `prod-0001`, `prod-0002`... sem repetir |
| `categoria` | `pele`, `cabelo`, `higiene`, `bebe`, `bem-estar` ou `kits` |
| `preco` | Ponto como separador decimal (`24.9`), sem "R$" |
| `nota` | De 0 a 5 |
| `estoque_simulado`, `marca_propria` | `sim` ou `não` |
| Campos de lista | Separar por **ponto e vírgula**: `pele seca;inverno;pele que descasca` |
| `equivalentes` | IDs de produtos que servem para o mesmo fim, separados por `;`. Todos precisam existir |
| `nivel_risco` | Sempre `livre`. **Medicamento não entra nesta base** |
| `texto_busca` | Pode ficar vazio: o script monta com nome, marca, descrição e indicações |
| `origem_dado` e `data_coleta` | Obrigatórios em todas as linhas |

## Metas de cobertura

- 120 a 150 produtos, distribuídos nas categorias combinadas.
- Para cada necessidade (ex.: "pele seca"), de **3 a 5 produtos** com marcas e preços diferentes.
- Onde a marca própria existir, cadastrar **pelo menos um produto dela e um de outra marca**, para a comparação de custo-benefício ser real.
- Cadastrar apenas produtos que existem no catálogo público. Não inventar produtos de nenhuma marca.

## O que o script bloqueia

- Campos obrigatórios vazios, `id` repetido ou fora do padrão
- Categoria inválida, preço ou nota inválidos
- `nivel_risco` diferente de `livre`
- Nome de medicamento de `restritos.json` aparecendo no nome, na descrição ou nos ingredientes
- Equivalente que não existe na base

Avisos (não bloqueiam): linhas de exemplo ainda presentes e produtos sem imagem.

## Outros arquivos desta pasta

- `restritos.json`: lista de bloqueio de medicamentos (a IA reconhece e recusa). Rascunho, precisa ser conferido nas fontes oficiais.
- `termos_emergencia.json`: termos que interrompem a recomendação e orientam atendimento médico.
- `FONTES.md`: registro de onde veio cada dado.
