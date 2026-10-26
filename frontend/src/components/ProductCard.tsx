"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { brl, grupo, nota, publico } from "@/lib/format";
import type { ProdutoCard } from "@/lib/types";
import { ICONE_GRUPO, Icon, Star } from "./Icon";

export function ProductImage({ p, className = "" }: { p: ProdutoCard; className?: string }) {
  const [falhou, setFalhou] = useState(false);
  const g = grupo(p.subcategoria);
  if (falhou || !p.imagem) {
    return (
      <div className={`thumb g-${g} ${className}`}>
        <Icon name={ICONE_GRUPO[g]} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`thumb ${className}`} src={publico(p.imagem)} alt={`Embalagem ilustrativa de ${p.nome}`} loading="lazy" onError={() => setFalhou(true)} />
  );
}

export function ProductCard({ p }: { p: ProdutoCard }) {
  const { cesta, addCesta, comparar, alternarComparar, abrir } = useApp();
  const naCesta = !!cesta[p.id];
  const avisos = p.avisos.filter(Boolean);
  return (
    <article className="pc">
      <button className="pc-img" onClick={() => abrir({ tipo: "produto", id: p.id })} aria-label={`Ver detalhes de ${p.nome}`}>
        <ProductImage p={p} />
      </button>
      <div>
        <div className="pc-name">{p.nome}</div>
        <div className="pc-sub">
          {p.marca} · {p.tamanho} ·{" "}
          <span className="stars">
            <Star />
            {nota(p.nota)}
          </span>
          <span>({p.num_avaliacoes})</span>
          {p.marca_propria && <span className="badge b-mp">Marca própria</span>}
        </div>
        <div className="why">
          <b>Por que indicamos:</b> {p.justificativa}
        </div>
        <div className="pc-foot">
          <span className="price">{brl(p.preco)}</span>
          <button className={`btn ${naCesta ? "added" : "btn-p"}`} onClick={() => addCesta(p)}>
            <Icon name={naCesta ? "check" : "plus"} size="s" />
            {naCesta ? "Na cesta" : "Adicionar"}
          </button>
        </div>
      </div>
      {avisos.length > 0 && (
        <details className="pc-warn">
          <summary>
            <Icon name="info" size="s" /> Cuidados do produto ({avisos.length})
          </summary>
          <ul>
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}
      <label className="cmp">
        <input type="checkbox" checked={comparar.has(p.id)} onChange={() => alternarComparar(p.id)} /> Comparar
      </label>
    </article>
  );
}
