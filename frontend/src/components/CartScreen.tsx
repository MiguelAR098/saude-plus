"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { brl, km } from "@/lib/format";
import { Icon } from "./Icon";
import { ProductImage } from "./ProductCard";

const frete = (subtotal: number) => (subtotal >= 99 ? 0 : 9.9);

export function CartScreen({ ativo }: { ativo: boolean }) {
  const { cesta, mudarQtd, limparCesta, unidade, irPara, avisar } = useApp();
  const [entrega, setEntrega] = useState<"retirada" | "entrega">("retirada");
  const [pagamento, setPagamento] = useState<"pix" | "cartao">("pix");
  const [cep, setCep] = useState("");
  const [pedido, setPedido] = useState<{ codigo: string; total: number; onde: string; pag: string } | null>(null);

  const linhas = Object.values(cesta);
  const subtotal = +linhas.reduce((a, l) => a + l.produto.preco * l.qtd, 0).toFixed(2);
  const valorFrete = entrega === "entrega" ? frete(subtotal) : 0;

  const finalizar = () => {
    if (entrega === "retirada" && !unidade) { avisar("Escolha a unidade de retirada"); irPara("stores"); return; }
    if (entrega === "entrega" && cep.replace(/\D/g, "").length !== 8) { avisar("Informe um CEP com 8 dígitos"); return; }
    const codigo = "SP-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    setPedido({
      codigo,
      total: subtotal + valorFrete,
      onde: entrega === "retirada" && unidade ? `Retire em ${unidade.nome} a partir de 1 hora.` : "Entrega estimada em até 2 dias úteis.",
      pag: pagamento === "pix" ? "Pix aprovado" : "Cartão aprovado",
    });
    limparCesta();
  };

  return (
    <section className={`screen ${ativo ? "on" : ""}`} aria-label="Cesta">
      {pedido ? (
        <div className="done">
          <div className="ib"><Icon name="check" size="l" /></div>
          <h1>Pedido confirmado</h1>
          <p className="muted" style={{ marginTop: 8 }}>{pedido.pag} · {brl(pedido.total)}</p>
          <div className="code">{pedido.codigo}</div>
          <p>{pedido.onde}</p>
          <p className="small muted" style={{ margin: "6px 0 20px" }}>Rastreio simulado: {pedido.codigo}-BR</p>
          <button className="btn btn-p" onClick={() => { setPedido(null); irPara("home"); }}>Voltar ao início</button>
        </div>
      ) : !linhas.length ? (
        <div className="done">
          <div className="ib blue"><Icon name="bag" size="l" /></div>
          <h1>Sua cesta está vazia</h1>
          <p className="muted" style={{ margin: "8px 0 18px" }}>Conte ao assistente o que você precisa e adicione em 1 toque.</p>
          <button className="btn btn-p" onClick={() => irPara("chat")}><Icon name="chat" size="s" />Falar com o assistente</button>
        </div>
      ) : (
        <>
          <h1>Cesta</h1>
          <div className="card" style={{ marginTop: 12 }}>
            {linhas.map(({ produto: p, qtd }) => (
              <div key={p.id} className="ci">
                <ProductImage p={p} />
                <div><b>{p.nome}</b><span className="small muted">{brl(p.preco)}</span></div>
                <div className="qty">
                  <button onClick={() => mudarQtd(p.id, -1)} aria-label="Diminuir"><Icon name={qtd === 1 ? "trash" : "minus"} size="s" /></button>
                  <span>{qtd}</span>
                  <button onClick={() => mudarQtd(p.id, 1)} aria-label="Aumentar"><Icon name="plus" size="s" /></button>
                </div>
              </div>
            ))}
          </div>

          <h2>Como receber</h2>
          <div className="seg">
            <button className={`opt ${entrega === "retirada" ? "on" : ""}`} onClick={() => setEntrega("retirada")}>
              <Icon name="store" /><span><b>Retirar na loja</b><small>{unidade ? `${unidade.nome} · ${km(unidade.km)} km` : "Escolha a unidade"}</small></span>
            </button>
            <button className={`opt ${entrega === "entrega" ? "on" : ""}`} onClick={() => setEntrega("entrega")}>
              <Icon name="truck" /><span><b>Entrega</b><small>{subtotal >= 99 ? "Frete grátis" : `Frete ${brl(9.9)}`}</small></span>
            </button>
          </div>
          {entrega === "retirada" && !unidade && (
            <button className="btn btn-s full" style={{ marginTop: 10 }} onClick={() => irPara("stores")}><Icon name="pin" size="s" />Encontrar unidade próxima</button>
          )}
          {entrega === "entrega" && (
            <label className="field">CEP<input value={cep} onChange={(e) => setCep(e.target.value)} inputMode="numeric" maxLength={9} placeholder="00000-000" autoComplete="postal-code" /></label>
          )}

          <h2>Pagamento (simulado)</h2>
          <div className="seg">
            <button className={`opt ${pagamento === "pix" ? "on" : ""}`} onClick={() => setPagamento("pix")}><Icon name="qr" /><span><b>Pix</b><small>Aprovação na hora</small></span></button>
            <button className={`opt ${pagamento === "cartao" ? "on" : ""}`} onClick={() => setPagamento("cartao")}><Icon name="card" /><span><b>Cartão</b><small>Simulado</small></span></button>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="sum"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
            <div className="sum"><span>{entrega === "entrega" ? "Frete" : "Retirada"}</span><span>{valorFrete ? brl(valorFrete) : "Grátis"}</span></div>
            <div className="sum t"><span>Total</span><span>{brl(subtotal + valorFrete)}</span></div>
          </div>
          <button className="btn btn-g full finish" onClick={finalizar}><Icon name="check" />Finalizar pedido simulado</button>
          <p className="note-proto">Nenhum pagamento real é feito. Pedido apenas para demonstração.</p>
        </>
      )}
    </section>
  );
}
