import { useEffect, useState } from 'react';
import { CloudUpload, Loader2, Shield, History } from 'lucide-react';
import { api } from '../api/client';

interface Props {
  onSynced: () => void;
  canSync?: boolean;
}

export default function SyncView({ onSynced, canSync = true }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ total: number; mensaje: string } | null>(null);
  const [history, setHistory] = useState<
    { id: number; fecha: string; total_enviados: number; mensaje: string }[]
  >([]);
  const [config, setConfig] = useState<Record<string, string>>({});

  const loadMeta = async () => {
    const [h, c] = await Promise.all([api.syncHistory(), api.getConfig()]);
    setHistory(h);
    setConfig(c);
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await api.sync();
      setResult(res);
      await loadMeta();
      onSynced();
    } catch (e) {
      setResult({ total: 0, mensaje: e instanceof Error ? e.message : 'Error de sincronización' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <header className="px-8 py-6 bg-white border-b border-[#e2e8f0]">
        <h1 className="text-2xl font-bold text-[#0f172a] m-0">Sincronización local</h1>
        <p className="text-[13px] text-[#64748b] mt-1 m-0">
          Envía la lista de TID autorizados al lector FX9600 de la puerta (User App, modo demo).
        </p>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-6 max-w-3xl">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Shield size={22} />
            </div>
            <div className="text-sm text-slate-600 space-y-1">
              <p>
                <strong>Arquitectura híbrida (producción):</strong> esta PC mantiene el inventario en
                SQLite. Al sincronizar, la lista de etiquetas activas se actualiza en la aplicación
                embebida del FX9600 para que la puerta opere con la PC apagada.
              </p>
              <p className="text-xs text-slate-400 font-mono">
                FX9600: {config.fx9600_ip ?? '192.168.1.100'} · Usuario:{' '}
                {config.fx9600_user ?? 'admin'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={syncing || !canSync}
            onClick={handleSync}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm cursor-pointer disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <CloudUpload size={20} />
            )}
            {syncing ? 'Sincronizando con lector de puerta…' : 'Sincronizar lista autorizada (demo)'}
          </button>

          {result && (
            <div
              className={`p-4 rounded-lg text-sm ${
                result.total >= 0 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50'
              }`}
            >
              <strong>{result.total}</strong> etiqueta(s) — {result.mensaje}
            </div>
          )}

          {config.ultima_sync && (
            <p className="text-xs text-slate-500">Última sincronización: {config.ultima_sync}</p>
          )}
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-[#0f172a] font-bold text-sm">
            <History size={18} />
            Historial reciente
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400">Sin sincronizaciones previas.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="text-xs border-b border-slate-100 pb-2 text-slate-600"
                >
                  <span className="font-mono text-slate-800">{h.fecha}</span> — {h.total_enviados}{' '}
                  tags — {h.mensaje}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
