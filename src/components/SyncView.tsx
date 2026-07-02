import { useCallback, useEffect, useState } from 'react';
import {
  CloudUpload,
  Loader2,
  History,
  Wifi,
  WifiOff,
  Settings,
  Circle,
} from 'lucide-react';
import { api } from '../api/client';
import ReaderAllowListSection from './ReaderAllowListSection';

interface Props {
  onSynced: () => void;
  canSync?: boolean;
  canViewAllowList?: boolean;
  onOpenConfig?: () => void;
}

export default function SyncView({
  onSynced,
  canSync = true,
  canViewAllowList = true,
  onOpenConfig,
}: Props) {
  const [syncing, setSyncing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [result, setResult] = useState<{ total: number; mensaje: string; warning?: boolean } | null>(
    null
  );
  const [history, setHistory] = useState<
    { id: number; fecha: string; total_enviados: number; mensaje: string }[]
  >([]);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [readerStatus, setReaderStatus] = useState<{
    connected?: boolean;
    error?: string;
    appStatus?: { count?: number; version?: number };
  } | null>(null);

  const demoMode = config.demo_mode === 'true';

  const loadMeta = useCallback(async () => {
    const [h, c] = await Promise.all([api.syncHistory(), api.getConfig()]);
    setHistory(h);
    setConfig(c);
    if (c.demo_mode === 'true') {
      setReaderStatus(null);
      setStatusLoading(false);
      return;
    }
    setStatusLoading(true);
    try {
      setReaderStatus(await api.syncStatus());
    } catch (e) {
      setReaderStatus({
        connected: false,
        error: e instanceof Error ? e.message : 'No se pudo consultar la User App API',
      });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const refreshReaderStatus = async () => {
    if (demoMode) return;
    setStatusLoading(true);
    try {
      setReaderStatus(await api.syncStatus());
    } catch (e) {
      setReaderStatus({
        connected: false,
        error: e instanceof Error ? e.message : 'No se pudo consultar la User App API',
      });
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await api.sync();
      setResult({
        total: res.total,
        mensaje: res.inventoryWarning ? `${res.mensaje} — ${res.inventoryWarning}` : res.mensaje,
        warning: Boolean(res.warning || res.inventoryWarning),
      });
      await loadMeta();
      await refreshReaderStatus();
      setListRefreshKey((k) => k + 1);
      onSynced();
    } catch (e) {
      setResult({
        total: 0,
        mensaje: e instanceof Error ? e.message : 'Error de sincronización',
        warning: true,
      });
    } finally {
      setSyncing(false);
    }
  };

  const hasReaderConfig = demoMode || Boolean(config.fx9600_ip?.trim());
  const connected = Boolean(readerStatus?.connected);
  const appPort = config.fx9600_app_port ?? '8765';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <header className="px-8 py-6 bg-white border-b border-[#e2e8f0] shrink-0">
        <h1 className="text-2xl font-bold text-[#0f172a] m-0">Sincronizar puerta</h1>
        <p className="text-[13px] text-[#64748b] mt-1 m-0">
          Envía la lista autorizada de TIDs a la User App del lector FX9600.
        </p>
      </header>

      <div className="p-8 flex-1 overflow-y-auto space-y-6 max-w-4xl">
        {!demoMode && (
          <div
            className={`rounded-xl border p-4 flex flex-wrap items-center gap-4 ${
              connected
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-3 flex-1 min-w-[200px]">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  connected ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}
              >
                {statusLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : connected ? (
                  <Wifi size={20} />
                ) : (
                  <WifiOff size={20} />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 m-0 flex items-center gap-2">
                  <Circle
                    size={8}
                    className={`fill-current ${connected ? 'text-emerald-500' : 'text-red-500'}`}
                  />
                  {statusLoading
                    ? 'Consultando lector…'
                    : connected
                      ? 'User App API conectada'
                      : 'User App API sin respuesta'}
                </p>
                <p className="text-xs text-slate-600 m-0 mt-0.5">
                  {config.fx9600_ip ? (
                    <>
                      <span className="font-mono">{config.fx9600_ip}</span>
                      <span className="text-slate-400"> · </span>
                      API :{appPort}
                      {readerStatus?.appStatus?.count != null && (
                        <>
                          <span className="text-slate-400"> · </span>
                          {readerStatus.appStatus.count} TID · v{readerStatus.appStatus.version}
                        </>
                      )}
                    </>
                  ) : (
                    'IP del lector no configurada'
                  )}
                </p>
                {!statusLoading && !connected && readerStatus?.error && (
                  <p className="text-xs text-red-700 m-0 mt-1">{readerStatus.error}</p>
                )}
              </div>
            </div>
            {onOpenConfig && (
              <button
                type="button"
                onClick={onOpenConfig}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-slate-300 bg-white rounded-lg hover:bg-slate-50 cursor-pointer shadow-sm"
              >
                <Settings size={16} />
                Configurar
              </button>
            )}
          </div>
        )}

        {demoMode && (
          <div className="p-4 rounded-xl text-sm bg-amber-50 text-amber-900 border border-amber-200">
            Modo demo activo — sin lector físico.
          </div>
        )}

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm space-y-4">
          {!demoMode && !hasReaderConfig && (
            <div className="p-3 rounded-lg text-sm bg-amber-50 text-amber-900 border border-amber-200">
              Configure la IP y puerto de la User App API antes de sincronizar.
              {onOpenConfig && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={onOpenConfig}
                    className="font-semibold underline cursor-pointer"
                  >
                    Ir a configuración
                  </button>
                </>
              )}
            </div>
          )}

          <p className="text-sm text-slate-600 m-0">
            La sincronización es <strong>completa</strong>: reemplaza la lista en el lector con los
            TIDs activos del inventario (incluye bajas y desactivados).
          </p>

          <button
            type="button"
            disabled={syncing || !canSync || (!demoMode && !hasReaderConfig)}
            onClick={handleSync}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm cursor-pointer disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <CloudUpload size={20} />
            )}
            {syncing ? 'Sincronizando…' : 'Sincronizar lista autorizada'}
          </button>

          {result && (
            <div
              className={`p-4 rounded-lg text-sm ${
                result.warning
                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {result.total > 0 && <strong>{result.total}</strong>}
              {result.total > 0 && ' etiqueta(s) — '}
              {result.mensaje}
            </div>
          )}

          {config.ultima_sync && (
            <p className="text-xs text-slate-500 m-0">Última sincronización: {config.ultima_sync}</p>
          )}
        </div>

        {canViewAllowList && !demoMode && (
          <ReaderAllowListSection refreshKey={listRefreshKey} />
        )}

        <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-[#0f172a] font-bold text-sm">
            <History size={18} />
            Historial de sincronización
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400 m-0">Sin sincronizaciones previas.</p>
          ) : (
            <ul className="space-y-2 m-0 p-0 list-none">
              {history.map((h) => (
                <li key={h.id} className="text-xs border-b border-slate-100 pb-2 text-slate-600">
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
