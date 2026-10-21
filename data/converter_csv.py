#!/usr/bin/env python3
"""Converte data/produtos.csv em data/produtos.json e valida os dados.

Uso:
    python data/converter_csv.py                      # usa data/produtos.csv
    python data/converter_csv.py caminho/arquivo.csv  # outro arquivo

Sai com código 1 se houver erros. Só grava o JSON quando tudo estiver válido.
"""
import csv
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

DATA = Path(__file__).parent
CATEGORIAS = {"pele", "cabelo", "higiene", "bebe", "bem-estar", "kits"}
OBRIGATORIOS = ["id", "nome", "marca", "categoria", "preco", "nota", "nivel_risco",
                "descricao_curta", "indicado_para", "origem_dado", "data_coleta"]
LISTAS = ["indicado_para", "tipo_pele", "ingredientes_chave", "alertas",
          "contraindicacoes", "equivalentes"]


def norm(texto: str) -> str:
    """Minúsculas e sem acento, para comparar nomes."""
    t = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def como_lista(valor: str) -> list:
    return [x.strip() for x in valor.split(";") if x.strip()]


def como_bool(valor: str) -> bool:
    return norm(valor.strip()) in {"sim", "true", "1", "s", "x"}


def termos_restritos() -> list:
    arq = DATA / "restritos.json"
    if not arq.exists():
        return []
    itens = json.loads(arq.read_text(encoding="utf-8")).get("itens", [])
    termos = []
    for it in itens:
        termos.append(it["nome_generico"])
        termos.extend(it.get("nomes_comerciais", []))
    return [norm(t) for t in termos]


def main() -> int:
    origem = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA / "produtos.csv"
    if not origem.exists():
        print(f"Arquivo não encontrado: {origem}")
        return 1

    with origem.open(encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.DictReader(f))

    erros, avisos, produtos = [], [], []
    ids = [l.get("id", "").strip() for l in linhas]
    repetidos = {i for i, n in Counter(ids).items() if n > 1 and i}
    restritos = termos_restritos()

    for n, l in enumerate(linhas, start=2):  # linha 1 é o cabeçalho
        pid = l.get("id", "").strip() or f"(linha {n})"

        def erro(msg):
            erros.append(f"linha {n} [{pid}]: {msg}")

        for campo in OBRIGATORIOS:
            if not l.get(campo, "").strip():
                erro(f"campo obrigatório vazio: {campo}")
        if not re.fullmatch(r"prod-\d{4}", l.get("id", "").strip()):
            erro("id fora do padrão prod-0001")
        if l.get("id", "").strip() in repetidos:
            erro("id repetido")
        if l.get("categoria", "").strip() not in CATEGORIAS:
            erro(f"categoria inválida (use: {', '.join(sorted(CATEGORIAS))})")
        if l.get("nivel_risco", "").strip() != "livre":
            erro("nivel_risco deve ser 'livre' (medicamentos não entram nesta base)")
        if "EXEMPLO" in l.get("origem_dado", "").upper() or "(EXEMPLO)" in l.get("nome", "").upper():
            avisos.append(f"linha {n} [{pid}]: ainda é linha de EXEMPLO, apague antes da entrega")

        try:
            preco = float(l["preco"].replace(",", "."))
            if preco <= 0:
                erro("preco deve ser maior que zero")
        except (ValueError, KeyError):
            preco = None
            erro("preco inválido")
        try:
            nota = float(l["nota"].replace(",", "."))
            if not 0 <= nota <= 5:
                erro("nota deve estar entre 0 e 5")
        except (ValueError, KeyError):
            nota = None
            erro("nota inválida")
        try:
            num_av = int(l.get("num_avaliacoes", "").strip() or 0)
        except ValueError:
            num_av = 0
            erro("num_avaliacoes deve ser inteiro")

        texto_checagem = norm(" ".join([l.get("nome", ""), l.get("descricao_curta", ""),
                                         l.get("ingredientes_chave", "")]))
        for t in restritos:
            if re.search(rf"\b{re.escape(t)}\b", texto_checagem):
                erro(f"contém nome de medicamento restrito ({t}); remover da base")
        if not l.get("imagem", "").strip():
            avisos.append(f"linha {n} [{pid}]: sem imagem")

        p = {
            "id": l.get("id", "").strip(),
            "nome": l.get("nome", "").strip(),
            "marca": l.get("marca", "").strip(),
            "categoria": l.get("categoria", "").strip(),
            "subcategoria": l.get("subcategoria", "").strip(),
            "tamanho": l.get("tamanho", "").strip(),
            "preco": preco,
            "nota": nota,
            "num_avaliacoes": num_av,
            "imagem": l.get("imagem", "").strip(),
            "estoque_simulado": como_bool(l.get("estoque_simulado", "")),
            "descricao_curta": l.get("descricao_curta", "").strip(),
            "faixa_etaria": l.get("faixa_etaria", "").strip(),
            "nivel_risco": l.get("nivel_risco", "").strip(),
            "marca_propria": como_bool(l.get("marca_propria", "")),
            "origem_dado": l.get("origem_dado", "").strip(),
            "data_coleta": l.get("data_coleta", "").strip(),
        }
        for campo in LISTAS:
            p[campo] = como_lista(l.get(campo, ""))
        texto_busca = l.get("texto_busca", "").strip() or " ".join(
            [p["nome"], p["marca"], p["descricao_curta"], " ".join(p["indicado_para"]),
             " ".join(p["ingredientes_chave"]), " ".join(p["tipo_pele"])])
        p["texto_busca"] = texto_busca
        produtos.append(p)

    existentes = {p["id"] for p in produtos}
    for p in produtos:
        for eq in p["equivalentes"]:
            if eq not in existentes:
                erros.append(f"[{p['id']}]: equivalente inexistente ({eq})")
            if eq == p["id"]:
                erros.append(f"[{p['id']}]: produto não pode ser equivalente de si mesmo")

    for a in avisos:
        print("AVISO:", a)
    if erros:
        print(f"\n{len(erros)} erro(s) encontrado(s):")
        for e in erros:
            print(" -", e)
        print("\nJSON não gerado. Corrija a planilha e rode de novo.")
        return 1

    saida = DATA / "produtos.json"
    saida.write_text(json.dumps(produtos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nOK: {len(produtos)} produtos gravados em {saida}")
    for cat, qtd in sorted(Counter(p["categoria"] for p in produtos).items()):
        print(f"  {cat}: {qtd}")
    print(f"  marca própria: {sum(p['marca_propria'] for p in produtos)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
