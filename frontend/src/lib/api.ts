import { demoRecomendar } from "./demo";
import type { HealthResponse, RecommendResponse } from "./types";

/** Com NEXT_PUBLIC_DEMO_FALLBACK=1, se a API não responder, o app usa o modo demonstração no navegador. */
export const DEMO_FALLBACK = process.env.NEXT_PUBLIC_DEMO_FALLBACK === "1";

const PADRAO = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const CHAVE_API = "saudeplus_api_url";
const CHAVE_SESSAO = "saudeplus_sessao_id";

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

/** URL da API: a salva nos ajustes do app tem prioridade sobre a variável de ambiente. */
export function getApiUrl(): string {
  try {
    return (localStorage.getItem(CHAVE_API) || PADRAO).replace(/\/+$/, "");
  } catch {
    return PADRAO;
  }
}

export function setApiUrl(url: string | null): void {
  try {
    if (url) localStorage.setItem(CHAVE_API, url.replace(/\/+$/, ""));
    else localStorage.removeItem(CHAVE_API);
  } catch {
    /* armazenamento indisponível: segue com o padrão */
  }
}

export const apiPadrao = PADRAO;

function novoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "sess-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

/** sessao_id enviado à API para manter o contexto entre mensagens (expira no backend). */
export function getSessaoId(): string {
  try {
    let id = sessionStorage.getItem(CHAVE_SESSAO);
    if (!id) {
      id = novoId();
      sessionStorage.setItem(CHAVE_SESSAO, id);
    }
    return id;
  } catch {
    return novoId();
  }
}

export function novaSessao(): string {
  const id = novoId();
  try {
    sessionStorage.setItem(CHAVE_SESSAO, id);
  } catch {
    /* ignora */
  }
  return id;
}

async function comTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

export async function health(base = getApiUrl()): Promise<HealthResponse> {
  const r = await comTimeout((signal) => fetch(`${base}/health`, { signal, cache: "no-store" }), 8000);
  if (!r.ok) throw new ApiError(`health ${r.status}`, r.status);
  return r.json();
}

/** POST /recommend. Timeout longo: o Render gratuito pode levar ~1 min para acordar e a Gemini responde em segundos. */
export async function recomendar(mensagem: string, sessaoId = getSessaoId()): Promise<RecommendResponse> {
  const base = getApiUrl();
  let r: Response;
  try {
    r = await comTimeout(
      (signal) =>
        fetch(`${base}/recommend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensagem: mensagem.slice(0, 500), sessao_id: sessaoId }),
          signal,
        }),
      DEMO_FALLBACK ? 8000 : 70000,
    );
  } catch (e) {
    if (DEMO_FALLBACK) {
      return { ...demoRecomendar(mensagem.slice(0, 500), sessaoId), debug: { origem: "demo" } };
    }
    const abort = e instanceof DOMException && e.name === "AbortError";
    throw new ApiError(abort ? "O servidor demorou para responder." : "Não consegui falar com o servidor.");
  }
  if (r.status === 422) throw new ApiError("Não entendi a mensagem. Pode escrever de outro jeito?", 422);
  if (!r.ok) throw new ApiError(`O servidor respondeu com erro (${r.status}).`, r.status);
  const data = (await r.json()) as RecommendResponse;
  return {
    ...data,
    produtos: data.produtos ?? [],
    ficou_de_fora: data.ficou_de_fora ?? [],
    avisos: data.avisos ?? [],
  };
}
