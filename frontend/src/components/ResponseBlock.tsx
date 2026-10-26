"use client";

import { useApp } from "@/context/AppContext";
import { brl } from "@/lib/format";
import type { RecommendResponse } from "@/lib/types";
import { Icon } from "./Icon";
import { ProductCard } from "./ProductCard";

function Chips({ itens, onPick }: { itens: string[]; onPick: (t: string) => void }) {
  return (
    <div className="chips">
      {itens.map((t) => (
        <button key={t} className="chip ghost" onClick={() => onPick(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}

export function ResponseBlock({ r, onAsk, resumo }: { r: RecommendResponse; onAsk: (t: string) => void; resumo: string[] }) {
  const { addCesta, produtos, avisar, abrir } = useApp();
  const farmaceutico = (rotulo = "Falar com farmacêutico", cls = "btn-o") => (
    <button className={`btn ${cls}`} onClick={() => abrir({ tipo: "farmaceutico", resumo })}>
      <Icon name="phone" size="s" />
      {rotulo}
    </button>
  );

  const meta = (
    <div className="meta">
      <Icon name="sparkle" size="s" /> {r.debug && (r.debug as { origem?: string }).origem === "demo" ? "SaúdePlus · modo demonstração (API offline)" : "SaúdePlus"}
    </div>
  );

  if (r.tipo === "bloqueio_emergencia") {
    const cvv = r.mensagem.includes("188");
    return (
      <div className="block">
        {meta}
        <div className="alert a-emerg" role="alert">
          <h3>
            <Icon name="alert" /> Procure atendimento agora
          </h3>
          <p>{r.mensagem}</p>
          <div className="a-row">
            <a className="btn btn-o" href="tel:192">
              <Icon name="phone" size="s" />
              Ligar 192 (SAMU)
            </a>
            {cvv && (
              <a className="btn btn-o" href="tel:188">
                <Icon name="heart" size="s" />
                Ligar 188 (CVV)
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (r.tipo === "bloqueio_restrito") {
    return (
      <div className="block">
        {meta}
        <div className="alert a-restr">
          <h3>
            <Icon name="shield" /> Aqui eu não posso indicar
          </h3>
          <p>{r.mensagem}</p>
          <div className="a-row">{farmaceutico("Falar com farmacêutico", "btn-p")}</div>
        </div>
      </div>
    );
  }

  if (r.tipo === "recusa_adversarial") {
    return (
      <div className="block">
        {meta}
        <div className="alert a-adv">
          <h3>
            <Icon name="shieldc" /> Regras iguais para todos
          </h3>
          <p>{r.mensagem}</p>
          {r.oferecer_farmaceutico && <div className="a-row">{farmaceutico()}</div>}
        </div>
      </div>
    );
  }

  if (r.tipo === "clarificacao") {
    return (
      <div className="block">
        {meta}
        <div className="msg bot">{r.pergunta || r.mensagem}</div>
        <Chips itens={["Para o rosto", "Para o corpo", "Para o cabelo", "Para o bebê"]} onPick={onAsk} />
      </div>
    );
  }

  // recomendacao
  const levarKit = () => {
    r.kit?.produto_ids.forEach((id) => {
      const p = produtos[id] || r.produtos.find((x) => x.id === id);
      if (p) addCesta(p, true);
    });
    avisar("Kit adicionado à cesta");
  };
  const pct = r.orcamento && r.total != null ? Math.min(100, Math.round((r.total / r.orcamento) * 100)) : null;

  return (
    <div className="block">
      {meta}
      <div className="msg bot">{r.mensagem}</div>
      {pct !== null && r.orcamento && r.total != null && (
        <div className="budget">
          <b>{brl(r.total)}</b> de {brl(r.orcamento)} do seu orçamento
          <div className="bar">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {r.produtos.map((p) => (
        <ProductCard key={p.id} p={p} />
      ))}
      {r.kit && r.kit.produto_ids.length >= 2 && (
        <div className="kit">
          <span style={{ flex: 1 }}>
            <b>Kit completo · {brl(r.kit.subtotal)}</b>
            <span className="small muted">{r.kit.produto_ids.length} itens em 1 toque</span>
          </span>
          <button className="btn btn-p" onClick={levarKit}>
            <Icon name="bag" size="s" />
            Levar kit
          </button>
        </div>
      )}
      {r.ficou_de_fora.length > 0 && (
        <details className="out">
          <summary>
            O que deixei de fora ({r.ficou_de_fora.length}) <Icon name="chev" size="s" />
          </summary>
          <ul>
            {r.ficou_de_fora.map((f) => (
              <li key={f.produto_id}>
                <b>{f.nome}</b>
                {f.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}
      {r.avisos.length > 0 && (
        <div className="notes">
          <b>
            <Icon name="info" size="s" /> Bom saber
          </b>
          <ul>
            {r.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {r.oferecer_farmaceutico && <div className="a-row">{farmaceutico()}</div>}
      <Chips
        itens={["Quero opções mais baratas", ...(r.produtos.length >= 2 ? ["Compare as duas primeiras opções"] : []), "É para criança"]}
        onPick={onAsk}
      />
    </div>
  );
}
