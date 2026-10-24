"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { ApiError, recomendar } from "@/lib/api";
import type { ChatItem } from "@/lib/types";
import { Icon } from "./Icon";
import { ResponseBlock } from "./ResponseBlock";

const SUGESTOES = ["Pele seca que descasca no frio, até R$ 120", "Rotina facial para pele oleosa", "Kit de banho para meu filho até R$ 60", "Protetor solar para praia"];

type SR = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

export function ChatScreen({ ativo, resetKey }: { ativo: boolean; resetKey: number }) {
  const { registrar, comparar, abrir, limparComparar, mensagemPendente, consumirPendente, avisar } = useApp();
  const [itens, setItens] = useState<ChatItem[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [gravando, setGravando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const rec = useRef<SR | null>(null);
  const textoRef = useRef("");
  textoRef.current = texto;

  useEffect(() => { setItens([]); }, [resetKey]);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [itens, ocupado]);
  useEffect(() => {
    const el = campo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [texto]);

  const enviar = useCallback(async (msg?: string) => {
    const t = (msg ?? textoRef.current).trim().slice(0, 500);
    if (!t || ocupado) return;
    setTexto("");
    setItens((xs) => [...xs, { id: crypto.randomUUID?.() ?? String(Date.now()), role: "user", text: t }]);
    setOcupado(true);
    try {
      const r = await recomendar(t);
      registrar(r.produtos);
      setItens((xs) => [...xs, { id: String(Date.now()) + "b", role: "bot", resp: r }]);
    } catch (e) {
      const m = e instanceof ApiError ? e.message : "Algo deu errado.";
      setItens((xs) => [...xs, { id: String(Date.now()) + "e", role: "error", text: m, retry: t }]);
    } finally {
      setOcupado(false);
    }
  }, [ocupado, registrar]);

  useEffect(() => {
    if (mensagemPendente && ativo) {
      consumirPendente();
      void enviar(mensagemPendente);
    }
  }, [mensagemPendente, ativo, consumirPendente, enviar]);

  useEffect(() => { if (ativo) campo.current?.focus({ preventScroll: true }); }, [ativo]);

  const resumo = itens.filter((i) => i.role === "user").slice(-3).map((i) => (i as { text: string }).text);

  const voz = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!Ctor) { avisar("Seu navegador não suporta ditado por voz"); return; }
    if (rec.current) { rec.current.stop(); return; }
    const r = new Ctor();
    r.lang = "pt-BR";
    r.interimResults = true;
    r.onresult = (ev) => setTexto(Array.from(ev.results).map((x) => x[0].transcript).join(""));
    r.onend = () => { setGravando(false); rec.current = null; if (textoRef.current.trim()) void enviar(); };
    r.onerror = () => avisar("Não consegui ouvir. Tente de novo ou digite.");
    rec.current = r;
    setGravando(true);
    r.start();
  };

  return (
    <section className={`screen chat ${ativo ? "on" : ""}`} aria-label="Assistente">
      <div className="thread-scroll" style={comparar.size > 0 ? { paddingBottom: 80 } : undefined}>
        <div className="thread">
          {itens.length === 0 && (
            <div className="empty">
              <div className="ib"><Icon name="sparkle" /></div>
              <b className="empty-t">Pode falar do seu jeito</b>
              <p className="small">Diga o que quer resolver, para quem é e quanto quer gastar.</p>
              <div className="chips center">
                {SUGESTOES.map((s) => (
                  <button key={s} className="chip ghost" onClick={() => enviar(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {itens.map((i) =>
            i.role === "user" ? (
              <div key={i.id} className="msg user">{i.text}</div>
            ) : i.role === "bot" ? (
              <ResponseBlock key={i.id} r={i.resp} onAsk={enviar} resumo={resumo} />
            ) : (
              <div key={i.id} className="alert a-adv">
                <h3><Icon name="alert" /> {i.text}</h3>
                <p className="small muted">Verifique se a API está no ar (ícone de ajustes) e tente de novo.</p>
                <div className="a-row"><button className="btn btn-s" onClick={() => enviar(i.retry)}><Icon name="refresh" size="s" />Tentar de novo</button></div>
              </div>
            ),
          )}
          {ocupado && <div className="msg bot typing" aria-label="Carregando"><i /><i /><i /></div>}
          <div ref={fim} />
        </div>
      </div>

      {comparar.size > 0 && (
        <div className="cmpbar">
          <span>{comparar.size === 1 ? "1 selecionado · escolha mais um" : `${comparar.size} selecionados`}</span>
          <button className="btn btn-s" disabled={comparar.size < 2} onClick={() => abrir({ tipo: "comparar", ids: [...comparar] })}>Comparar</button>
          <button className="icon-btn light" onClick={limparComparar} aria-label="Limpar seleção"><Icon name="x" /></button>
        </div>
      )}

      <form className="composer" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        <textarea
          ref={campo}
          rows={1}
          maxLength={500}
          value={texto}
          placeholder="Escreva o que você precisa…"
          aria-label="Mensagem"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
        />
        <button type="button" className={`round m ${gravando ? "rec" : ""}`} onClick={voz} aria-label="Falar"><Icon name="mic" /></button>
        <button type="submit" className="round p" disabled={!texto.trim() || ocupado} aria-label="Enviar"><Icon name="send" /></button>
        {texto.length > 400 && <span className="count">{texto.length}/500</span>}
      </form>
    </section>
  );
}
