"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp, type Aba } from "@/context/AppContext";
import { DEMO_FALLBACK, health } from "@/lib/api";
import { km } from "@/lib/format";
import { CartScreen } from "./CartScreen";
import { ChatScreen } from "./ChatScreen";
import { HomeScreen } from "./HomeScreen";
import { Icon, type IconName } from "./Icon";
import { SheetHost } from "./Sheets";
import { StoresScreen } from "./StoresScreen";

const ABAS: [Aba, IconName, string][] = [["home", "home", "Início"], ["chat", "chat", "Assistente"], ["stores", "pin", "Lojas"], ["cart", "bag", "Cesta"]];

export function AppShell() {
  const { aba, irPara, cesta, unidade, abrir, toast, pedirMensagem } = useApp();
  const [online, setOnline] = useState<boolean | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const itens = Object.values(cesta).reduce((a, l) => a + l.qtd, 0);

  const verificar = useCallback(() => {
    setOnline(null);
    health().then(() => setOnline(true)).catch(() => setOnline(false));
  }, []);
  useEffect(() => { verificar(); }, [verificar]);

  // No PC, o app aparece numa moldura de celular que escala para caber na altura da janela.
  useEffect(() => {
    const ajustar = () => {
      const r = document.documentElement;
      if (innerWidth < 600) { r.style.removeProperty("--s"); return; }
      r.style.setProperty("--s", Math.max(0.68, Math.min(1, (innerHeight - 44) / 800)).toFixed(3));
    };
    ajustar();
    addEventListener("resize", ajustar);
    return () => removeEventListener("resize", ajustar);
  }, []);

  return (
    <div className="stage">
      <aside className="side">
        <span className="tag">MVP · Squad 6</span>
        <h2>SaúdePlus, do pedido à cesta pelo celular</h2>
        <p>Front em Next.js + TypeScript consumindo a API FastAPI do projeto: <code>POST /recommend</code> com <code>sessao_id</code> para manter o contexto da conversa.</p>
        <p>As recomendações, bloqueios de segurança e comparações vêm do backend (regras locais + Gemini quando configurada).</p>
        <p className="small muted">Produtos, preços, avaliações e unidades são fictícios. Imagens ilustrativas.</p>
      </aside>

      <div className="phonebox">
        <div className="app">
          <header className="top">
            <div className="top-row">
              <div className="brand"><span className="brand-mark"><Icon name="plus" size="s" /></span>SaúdePlus</div>
              <span className="sp" />
              <button className="status" onClick={() => abrir({ tipo: "ajustes" })} aria-label="Status da API">
                <i className={`dot ${online ? "on" : online === false ? "off" : ""}`} />
                <span>{online === null ? "Conectando" : online ? "Online" : DEMO_FALLBACK ? "Demo" : "Offline"}</span>
              </button>
              <button className="icon-btn" onClick={() => abrir({ tipo: "ajustes" })} aria-label="Ajustes"><Icon name="sliders" /></button>
            </div>
            <button className="loc" onClick={() => irPara("stores")}>
              <Icon name="pin" size="s" />
              {unidade ? <>Retirada: <b>{unidade.nome}</b> · {km(unidade.km)} km</> : "Ver unidades perto de você"}
            </button>
          </header>

          <main>
            <HomeScreen ativo={aba === "home"} />
            <ChatScreen ativo={aba === "chat"} resetKey={resetKey} />
            <StoresScreen ativo={aba === "stores"} />
            <CartScreen ativo={aba === "cart"} />
          </main>

          <nav className="tabs" aria-label="Navegação">
            {ABAS.map(([id, ic, rotulo]) => (
              <button key={id} className={`tab ${aba === id ? "on" : ""}`} onClick={() => irPara(id)} aria-current={aba === id ? "page" : undefined}>
                <Icon name={ic} />
                {rotulo}
                {id === "cart" && itens > 0 && <i className="n">{itens}</i>}
              </button>
            ))}
          </nav>

          <SheetHost onAsk={pedirMensagem} onStatus={verificar} onNovaConversa={() => setResetKey((k) => k + 1)} />
          <div className={`toast ${toast ? "on" : ""}`} role="status">{toast}</div>
        </div>
      </div>
    </div>
  );
}
