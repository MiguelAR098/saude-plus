"use client";

import { createContext, useCallback, useContext, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import type { CartLine, ProdutoCard, Unidade } from "@/lib/types";

export type Aba = "home" | "chat" | "stores" | "cart";
export type Sheet =
  | { tipo: "comparar"; ids: string[] }
  | { tipo: "produto"; id: string }
  | { tipo: "farmaceutico"; resumo: string[] }
  | { tipo: "ajustes" }
  | null;

type CartState = Record<string, CartLine>;
type CartAction = { t: "add"; p: ProdutoCard } | { t: "qtd"; id: string; delta: number } | { t: "limpar" };

function cartReducer(s: CartState, a: CartAction): CartState {
  switch (a.t) {
    case "add": {
      const atual = s[a.p.id];
      return { ...s, [a.p.id]: { produto: a.p, qtd: (atual?.qtd ?? 0) + 1 } };
    }
    case "qtd": {
      const atual = s[a.id];
      if (!atual) return s;
      const qtd = atual.qtd + a.delta;
      const novo = { ...s };
      if (qtd <= 0) delete novo[a.id];
      else novo[a.id] = { ...atual, qtd };
      return novo;
    }
    case "limpar":
      return {};
  }
}

interface Ctx {
  aba: Aba;
  irPara: (a: Aba) => void;
  cesta: CartState;
  addCesta: (p: ProdutoCard, silencioso?: boolean) => void;
  mudarQtd: (id: string, delta: number) => void;
  limparCesta: () => void;
  produtos: Record<string, ProdutoCard>;
  registrar: (ps: ProdutoCard[]) => void;
  comparar: Set<string>;
  alternarComparar: (id: string) => void;
  limparComparar: () => void;
  unidade: Unidade | null;
  setUnidade: (u: Unidade | null) => void;
  unidades: Unidade[];
  setUnidades: (u: Unidade[]) => void;
  sheet: Sheet;
  abrir: (s: Sheet) => void;
  fechar: () => void;
  toast: string;
  avisar: (t: string) => void;
  pedirMensagem: (t: string) => void;
  mensagemPendente: string | null;
  consumirPendente: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [aba, setAba] = useState<Aba>("home");
  const [cesta, dispatch] = useReducer(cartReducer, {});
  const [produtos, setProdutos] = useState<Record<string, ProdutoCard>>({});
  const [comparar, setComparar] = useState<Set<string>>(new Set());
  const [unidade, setUnidade] = useState<Unidade | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState("");
  const [mensagemPendente, setPendente] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const avisar = useCallback((t: string) => {
    setToast(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 2400);
  }, []);

  const addCesta = useCallback((p: ProdutoCard, silencioso?: boolean) => {
    dispatch({ t: "add", p });
    if (!silencioso) avisar("Adicionado à cesta");
  }, [avisar]);

  const registrar = useCallback((ps: ProdutoCard[]) => {
    setProdutos((atual) => ({ ...atual, ...Object.fromEntries(ps.map((p) => [p.id, p])) }));
  }, []);

  const alternarComparar = useCallback((id: string) => {
    setComparar((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else if (novo.size >= 5) { avisar("Compare até 5 produtos"); return atual; }
      else novo.add(id);
      return novo;
    });
  }, [avisar]);

  const valor = useMemo<Ctx>(() => ({
    aba,
    irPara: setAba,
    cesta,
    addCesta,
    mudarQtd: (id, delta) => dispatch({ t: "qtd", id, delta }),
    limparCesta: () => dispatch({ t: "limpar" }),
    produtos,
    registrar,
    comparar,
    alternarComparar,
    limparComparar: () => setComparar(new Set()),
    unidade,
    setUnidade,
    unidades,
    setUnidades,
    sheet,
    abrir: setSheet,
    fechar: () => setSheet(null),
    toast,
    avisar,
    pedirMensagem: (t) => { setPendente(t); setAba("chat"); },
    mensagemPendente,
    consumirPendente: () => setPendente(null),
  }), [aba, cesta, addCesta, produtos, registrar, comparar, alternarComparar, unidade, unidades, sheet, toast, avisar, mensagemPendente]);

  return <AppCtx.Provider value={valor}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fora do AppProvider");
  return c;
}
