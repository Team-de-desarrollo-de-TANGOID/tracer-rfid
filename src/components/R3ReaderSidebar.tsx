import { Radio, Wifi, WifiOff, Zap, Loader2, RefreshCw } from 'lucide-react';
import type { R3Status } from '../hooks/useR3Reader';

interface Props {
  status: R3Status;
  busy?: boolean;
  lastEpc?: string | null;
  lastReadAt?: number | null;
  power: number;
  onPowerChange: (power: number) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
}

function statusLabel(status: R3Status): { text: string; tone: 'ok' | 'warn' | 'err' | 'idle' } {
  if (!status.bridge && status.javaRequired) {
    return { text: 'Bridge offline (requiere Java)', tone: 'err' };
  }
  // Prefer live reading state over a stale lastError from a soft power warning.
  if (status.connected && status.inventory) {
    return { text: 'Listo — leyendo etiquetas', tone: 'ok' };
  }
  if (status.state === 'ERROR' || status.lastError) {
    if (status.connected) return { text: 'Conectado (con aviso)', tone: 'warn' };
    return { text: status.lastError || 'Error', tone: 'err' };
  }
  if (status.connected) {
    return { text: 'Conectado', tone: 'ok' };
  }
  return { text: 'Desconectado', tone: 'idle' };
}

export default function R3ReaderSidebar({
  status,
  busy = false,
  lastEpc,
  lastReadAt,
  power,
  onPowerChange,
  onConnect,
  onDisconnect,
  onRefresh,
}: Props) {
  const label = statusLabel(status);
  const toneClass =
    label.tone === 'ok'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : label.tone === 'warn'
        ? 'bg-amber-50 text-amber-900 border-amber-200'
        : label.tone === 'err'
          ? 'bg-red-50 text-red-800 border-red-200'
          : 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <aside className="w-full flex flex-col gap-3">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Radio size={16} className="text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 m-0">Lector Chainway R3</h2>
            <p className="text-[11px] text-slate-500 m-0">Alta de tags por USB</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className={`rounded-lg border px-3 py-2.5 text-xs font-medium flex items-start gap-2 ${toneClass}`}>
            {status.connected ? (
              <Wifi size={14} className="mt-0.5 shrink-0" />
            ) : (
              <WifiOff size={14} className="mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="m-0 font-semibold">{label.text}</p>
              {status.inventory && status.connected && (
                <p className="m-0 mt-0.5 opacity-80">Coloque las toallas sobre el lector</p>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            {status.connected ? (
              <button
                type="button"
                disabled={busy}
                onClick={onDisconnect}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              >
                Desconectar
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={onConnect}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                Conectar
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={onRefresh}
              className="px-2.5 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
              title="Actualizar estado"
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <Zap size={12} />
                Potencia antenas
              </label>
              <span className="text-xs font-mono font-semibold text-slate-800">{power}</span>
            </div>
            <input
              type="range"
              min={1}
              max={30}
              step={1}
              value={power}
              disabled={busy || !status.connected}
              onChange={(e) => onPowerChange(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Baja (1)</span>
              <span>Alta (30)</span>
            </div>
            <p className="text-[11px] text-slate-500 m-0 mt-2 leading-snug">
              Potencia de la antena del R3 (ANT1). Bájela para leer solo las toallas
              apoyadas sobre el lector.
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide m-0 mb-1">
              Último TID leído
            </p>
            {lastEpc ? (
              <>
                <p className="font-mono text-xs text-slate-800 m-0 break-all">{lastEpc}</p>
                {lastReadAt && (
                  <p className="text-[10px] text-slate-400 m-0 mt-1">
                    {new Date(lastReadAt).toLocaleTimeString('es-AR')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400 m-0 italic">Esperando lectura…</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
