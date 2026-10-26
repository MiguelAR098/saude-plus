"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { apiPadrao, getApiUrl, health, novaSessao, setApiUrl, getSessaoId } from "@/lib/api";
import { brl, nota, rotuloSub } from "@/lib/format";
import type { ProdutoCard } from "@/lib/types";
import { Icon } from "./Icon";
import { ProductImage } from "./ProductCard";

function Cabecalho({ titulo }: { titulo: string }) {
  const { fechar } = useApp();
  return (
    <div className="sheet-h">
      <h3>{titulo}</h3>
      <button className="icon-btn" onClick={fechar} aria-label="Fechar"><Icon name="x" /></button>
    </div>
  );
}

function Comparar({ ids, onAsk }: { ids: string[]; onAsk: (t: string) => void }) {
  const { produtos, fechar } = useApp();
  const ps = ids.map((id) => produtos[id]).filter(Boolean) as ProdutoCard[];
  if (ps.length < 2) return <Cabecalho titulo="Comparar opções" />;
  const minP = Math.min(...ps.map((p) => p.preco));
  const maxN = Math.max(...ps.map((p) => p.nota));
  const maxC = Math.max(...ps.map((p) => p.num_avaliacoes));
  const linha = (rot: string, f: (p: ProdutoCard) => React.ReactNode, win?: (p: ProdutoCard) => boolean) => (
    <tr>
      <th>{rot}</th>
      {ps.map((p) => <td key={p.id} className={win?.(p) ? "win" : ""}>{f(p)}</td>)}
    </tr>
  );
  return (
    <>
      <Cabecalho titulo="Comparar opções" />
      <div style={{ overflowX: "auto" }}>
        <table className="ctable">
          <tbody>
            <tr><th /> {ps.map((p) => <td key={p.id}><ProductImage p={p} className="cmp-img" /></td>)}</tr>
            {linha("Produto", (p) => <b>{p.nome}</b>)}
            {linha("Marca", (p) => <>{p.marca}{p.marca_propria && <><br /><span className="badge b-mp">Marca própria</span></>}</>)}
            {linha("Preço", (p) => brl(p.preco), (p) => p.preco === minP)}
            {linha("Nota", (p) => nota(p.nota), (p) => p.nota === maxN)}
            {linha("Avaliações", (p) => p.num_avaliacoes, (p) => p.num_avaliacoes === maxC)}
            {linha("Tamanho", (p) => p.tamanho)}
            {linha("Indicação", (p) => rotuloSub(p.subcategoria))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: "10px 0" }}>Dados validados pelo backend. Em verde, o melhor valor de cada linha.</p>
      <button className="btn btn-s full" onClick={() => { fechar(); onAsk("Compare " + ps.map((p) => p.nome).join(" e ")); }}>
        <Icon name="sparkle" size="s" />Pedir ao assistente para comparar
      </button>
    </>
  );
}

function Produto({ id }: { id: string }) {
  const { produtos, addCesta, cesta } = useApp();
  const p = produtos[id];
  if (!p) return null;
  return (
    <>
      <Cabecalho titulo={p.marca} />
      <ProductImage p={p} className="detail-img" />
      <h3 className="detail-name">{p.nome}</h3>
      <p className="small muted">{p.tamanho} · nota {nota(p.nota)} ({p.num_avaliacoes} avaliações){p.marca_propria ? " · marca própria" : ""}</p>
      <div className="why" style={{ marginTop: 10 }}><b>Por que indicamos:</b> {p.justificativa}</div>
      {p.avisos.length > 0 && (
        <div className="notes" style={{ marginBottom: 12 }}>
          <b><Icon name="info" size="s" /> Cuidados do produto</b>
          <ul>{p.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
        </div>
      )}
      <div className="pc-foot">
        <span className="price">{brl(p.preco)}</span>
        <button className={`btn ${cesta[p.id] ? "added" : "btn-p"}`} onClick={() => addCesta(p)}>
          <Icon name={cesta[p.id] ? "check" : "plus"} size="s" />{cesta[p.id] ? "Adicionar mais um" : "Adicionar à cesta"}
        </button>
      </div>
      <p className="note-proto">Imagem ilustrativa gerada para o protótipo.</p>
    </>
  );
}

function Farmaceutico({ resumo }: { resumo: string[] }) {
  const { fechar, avisar } = useApp();
  const [tel, setTel] = useState("");
  return (
    <>
      <Cabecalho titulo="Falar com farmacêutico" />
      <p className="muted small">Um farmacêutico retorna para tirar sua dúvida. Ele recebe um resumo da conversa, sem você precisar repetir.</p>
      {resumo.length > 0 && <div className="why" style={{ marginTop: 12 }}><b>Resumo enviado:</b>{resumo.map((t) => <span key={t}><br />“{t}”</span>)}</div>}
      <label className="field">Telefone para retorno<input value={tel} onChange={(e) => setTel(e.target.value)} type="tel" inputMode="tel" placeholder="(81) 90000-0000" autoComplete="tel" /></label>
      <button className="btn btn-p full" style={{ marginTop: 12 }} onClick={() => { if (tel.replace(/\D/g, "").length < 10) { avisar("Informe um telefone com DDD"); return; } fechar(); avisar("Retorno solicitado (simulação)"); }}>
        <Icon name="phone" size="s" />Pedir retorno
      </button>
      <p className="small muted" style={{ marginTop: 12 }}>Central fictícia 0800 000 0000. Em emergência, ligue 192.</p>
    </>
  );
}

function Ajustes({ onStatus, onNovaConversa }: { onStatus: () => void; onNovaConversa: () => void }) {
  const { fechar, avisar } = useApp();
  const [url, setUrl] = useState(getApiUrl());
  const [estado, setEstado] = useState("…");
  useEffect(() => { health(getApiUrl()).then((h) => setEstado(`online · ${h.produtos ?? "?"} produtos · v${h.versao ?? "?"}`)).catch(() => setEstado("sem resposta")); }, []);
  return (
    <>
      <Cabecalho titulo="Conexão com a API" />
      <p className="small muted">Endereço do backend FastAPI (local ou Render).</p>
      <label className="field">URL da API<input value={url} onChange={(e) => setUrl(e.target.value)} type="url" placeholder={apiPadrao} /></label>
      <div className="seg" style={{ marginTop: 12 }}>
        <button className="btn btn-p" onClick={async () => {
          setApiUrl(url.trim() || null);
          try { const h = await health(); avisar(`API conectada · ${h.produtos ?? "?"} produtos`); } catch { avisar("A API não respondeu nesse endereço"); }
          onStatus(); fechar();
        }}>Salvar e testar</button>
        <button className="btn btn-o" onClick={() => { setApiUrl(null); setUrl(apiPadrao); onStatus(); avisar("Endereço padrão restaurado"); }}>Usar padrão</button>
      </div>
      <div className="card" style={{ marginTop: 14, fontSize: 13 }}>
        <b>Status:</b> {estado}<br /><b>sessao_id:</b> <code style={{ fontSize: 11.5 }}>{getSessaoId()}</code>
      </div>
      <button className="btn btn-s full" style={{ marginTop: 12 }} onClick={() => { novaSessao(); onNovaConversa(); fechar(); avisar("Nova conversa iniciada"); }}>
        <Icon name="refresh" size="s" />Nova conversa
      </button>
      <p className="small muted" style={{ marginTop: 12 }}>No plano gratuito do Render, a API pode levar até 1 minuto para acordar.</p>
    </>
  );
}

export function SheetHost({ onAsk, onStatus, onNovaConversa }: { onAsk: (t: string) => void; onStatus: () => void; onNovaConversa: () => void }) {
  const { sheet, fechar } = useApp();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [fechar]);
  return (
    <>
      <div className={`scrim ${sheet ? "on" : ""}`} onClick={fechar} />
      <div className={`sheet ${sheet ? "on" : ""}`} role="dialog" aria-modal="true">
        <div className="grab" />
        {sheet?.tipo === "comparar" && <Comparar ids={sheet.ids} onAsk={onAsk} />}
        {sheet?.tipo === "produto" && <Produto id={sheet.id} />}
        {sheet?.tipo === "farmaceutico" && <Farmaceutico resumo={sheet.resumo} />}
        {sheet?.tipo === "ajustes" && <Ajustes onStatus={onStatus} onNovaConversa={onNovaConversa} />}
      </div>
    </>
  );
}
