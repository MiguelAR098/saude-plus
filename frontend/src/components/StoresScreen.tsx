"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { km } from "@/lib/format";
import { CENTRO_PADRAO, obterPosicao, unidadesProximas } from "@/lib/unidades";
import { Icon } from "./Icon";

export function StoresScreen({ ativo }: { ativo: boolean }) {
  const { unidades, setUnidades, unidade, setUnidade, avisar } = useApp();
  const [carregando, setCarregando] = useState(false);
  const [padrao, setPadrao] = useState(false);

  const localizar = async () => {
    setCarregando(true);
    const pos = await obterPosicao();
    const lista = unidadesProximas(pos ?? CENTRO_PADRAO);
    setPadrao(!pos);
    setUnidades(lista);
    setUnidade(lista[0]);
    setCarregando(false);
    avisar(pos ? "Localização encontrada" : "Sem permissão de localização. Mostrando o centro do Recife.");
  };

  const max = unidades.length ? Math.max(...unidades.map((u) => Math.hypot(u.dx, u.dy))) * 1.15 : 1;

  return (
    <section className={`screen ${ativo ? "on" : ""}`} aria-label="Lojas">
      <h1>Unidades próximas</h1>
      <p className="muted small intro">
        {!unidades.length
          ? "Use sua localização para ver as unidades mais perto e retirar o pedido na loja."
          : padrao
            ? "Sem acesso à sua localização, mostramos unidades a partir do centro do Recife."
            : "Unidades ordenadas pela distância da sua localização."}
      </p>
      <button className={`btn full ${unidades.length ? "btn-o" : "btn-p"}`} onClick={localizar} disabled={carregando}>
        <Icon name={unidades.length ? "refresh" : "nav"} size="s" />
        {carregando ? "Localizando…" : unidades.length ? "Atualizar localização" : "Usar minha localização"}
      </button>

      {unidades.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="radar" aria-hidden="true">
            <div className="me" />
            {unidades.map((u, i) => (
              <div key={u.id} className={`pin ${unidade?.id === u.id ? "sel" : ""}`} style={{ left: `${50 + (u.dx / max) * 46}%`, top: `${50 - (u.dy / max) * 44}%` }}>
                <span>{i + 1}</span>
                <Icon name="pin" />
              </div>
            ))}
            <span className="lbl">Você está no centro</span>
          </div>
          <div className="card">
            {unidades.map((u, i) => (
              <div key={u.id} className="store">
                <div className="d">{km(u.km)}<small>km</small></div>
                <div className="info">
                  <b>{i + 1}. {u.nome}</b>
                  <span className="small"><span className="open">{u.h24 ? "Aberta 24h" : "Aberta até 22h"}</span> · retirada em 1h</span>
                </div>
                <button className={`btn pick ${unidade?.id === u.id ? "added" : "btn-s"}`} onClick={() => { setUnidade(u); avisar("Unidade de retirada escolhida"); }}>
                  {unidade?.id === u.id ? <><Icon name="check" size="s" />Escolhida</> : "Retirar aqui"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="note-proto">Unidades simuladas a partir da sua posição. Em produção, viriam da API de lojas da rede.</p>
    </section>
  );
}
