import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  CloudUpload,
  History,
  Loader2,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { api } from '../api/client';
import ReaderAllowListSection from './ReaderAllowListSection';

interface Props {
  onSynced: () => void;
  canSync?: boolean;
  canViewAllowList?: boolean;
  onOpenConfig?: () => void;
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <span className="font-medium text-slate-800 text-right break-all">{value}</span>
    </div>
  );
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
  const showComparePanel = canViewAllowList && !demoMode;

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
        error: e instanceof Error ? e.message : 'No se pudo consultar el lector',
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
        error: e instanceof Error ? e.message : 'No se pudo consultar el lector',
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
        mensaje: e instanceof Error ? e.message : 'No se pudo completar la sincronización',
        warning: true,
      });
    } finally {
      setSyncing(false);
    }
  };

  const hasReaderConfig = demoMode || Boolean(config.fx9600_ip?.trim());
  const connected = Boolean(readerStatus?.connected);
  const appPort = config.fx9600_app_port ?? '8765';
  const readerTagCount = readerStatus?.appStatus?.count;

  const statusLabel = statusLoading
    ? 'Verificando…'
    : connected
      ? 'Conectado'
      : 'Sin conexión';

  const statusClass = statusLoading
    ? 'bg-amber-50 text-amber-800 border-amber-200'
    : connected
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : 'bg-red-50 text-red-800 border-red-200';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <header className="px-8 py-6 bg-white border-b border-[#e2e8f0] shrink-0">
        <h1 className="text-2xl font-bold text-[#0f172a] m-0">Sincronizar puerta</h1>
        <p className="text-[13px] text-[#64748b] mt-1 m-0">
          Enviá al lector de la puerta la lista de etiquetas autorizadas para ingresar.
        </p>
      </header>

      <div className="flex-1 min-h-0 flex flex-col p-8 overflow-hidden">
        <div
          className={`flex-1 min-h-0 grid gap-6 ${
            showComparePanel
              ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]'
              : 'grid-cols-1 max-w-2xl'
          }`}
        >
          {/* Columna izquierda */}
          <div className="min-h-0 overflow-y-auto space-y-6 pr-1">
            <section className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <ArrowRightLeft size={16} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-slate-900 m-0">Enviar etiquetas al lector</h2>
                    {!demoMode && (
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border mt-1 ${statusClass}`}
                      >
                        {statusLoading ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : connected ? (
                          <Wifi size={11} />
                        ) : (
                          <WifiOff size={11} />
                        )}
                        {statusLabel}
                      </span>
                    )}
                  </div>
                </div>

                {!demoMode && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={refreshReaderStatus}
                      disabled={statusLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
                    >
                      <RefreshCw size={13} className={statusLoading ? 'animate-spin' : ''} />
                      Actualizar
                    </button>
                    {onOpenConfig && (
                      <button
                        type="button"
                        onClick={onOpenConfig}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <Settings size={13} />
                        Configurar
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="p-5 space-y-4">
                {demoMode ? (
                  <div className="p-3 rounded-lg text-sm bg-amber-50 text-amber-900 border border-amber-200">
                    <p className="font-semibold m-0">Modo demostración</p>
                    <p className="m-0 mt-1 text-xs">
                      La sincronización funciona con un lector simulado, sin hardware real.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-2">
                    <SummaryRow
                      label="Estado"
                      value={
                        statusLoading
                          ? 'Verificando…'
                          : connected && readerTagCount != null
                            ? `Conectado · ${readerTagCount} etiqueta${readerTagCount === 1 ? '' : 's'} en el lector`
                            : connected
                              ? 'Conectado'
                              : 'Sin conexión'
                      }
                    />
                    <SummaryRow
                      label="Lector"
                      value={
                        config.fx9600_ip
                          ? `${config.fx9600_ip}:${appPort}`
                          : 'No configurado'
                      }
                    />
                    {!statusLoading && !connected && readerStatus?.error && (
                      <p className="text-xs text-red-700 m-0 pt-2">{readerStatus.error}</p>
                    )}
                  </div>
                )}

                {!demoMode && !hasReaderConfig && (
                  <div className="p-4 rounded-lg text-sm bg-amber-50 text-amber-900 border border-amber-200 flex gap-3">
                    <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-semibold m-0">Falta configurar el lector</p>
                      <p className="m-0 mt-1">
                        Antes de sincronizar, indicá la dirección del lector en configuración.
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
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-lg bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 space-y-2">
                  <p className="m-0 font-medium text-slate-800">¿Qué hace esta acción?</p>
                  <ul className="m-0 pl-4 space-y-1 list-disc">
                    <li>Toma todas las etiquetas activas del inventario en esta computadora.</li>
                    <li>Reemplaza por completo la lista que tiene el lector de la puerta.</li>
                    <li>Incluye altas, bajas y desactivaciones — el lector queda igual que acá.</li>
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={syncing || !canSync || (!demoMode && !hasReaderConfig)}
                  onClick={handleSync}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm cursor-pointer disabled:opacity-60 shadow-sm"
                >
                  {syncing ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <CloudUpload size={20} />
                  )}
                  {syncing ? 'Enviando etiquetas…' : 'Sincronizar ahora'}
                </button>

                {result && (
                  <div
                    className={`p-4 rounded-lg text-sm flex gap-3 ${
                      result.warning
                        ? 'bg-amber-50 text-amber-900 border border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {result.warning ? (
                      <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                    )}
                    <div>
                      {result.total > 0 && (
                        <p className="font-semibold m-0">
                          {result.total} etiqueta{result.total === 1 ? '' : 's'} enviada
                          {result.total === 1 ? '' : 's'}
                        </p>
                      )}
                      <p className="m-0 mt-0.5">{result.mensaje}</p>
                    </div>
                  </div>
                )}

                {config.ultima_sync && (
                  <p className="text-xs text-slate-500 m-0 text-center">
                    Última sincronización: {config.ultima_sync}
                  </p>
                )}
              </div>
            </section>

            <section className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                <History size={18} className="text-slate-600" />
                <h2 className="text-sm font-bold text-slate-900 m-0">Historial de sincronizaciones</h2>
              </div>
              <div className="p-6">
                {history.length === 0 ? (
                  <p className="text-sm text-slate-400 m-0">Todavía no hay sincronizaciones registradas.</p>
                ) : (
                  <ul className="space-y-3 m-0 p-0 list-none">
                    {history.map((h) => (
                      <li
                        key={h.id}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                      >
                        <span className="font-mono text-slate-800 text-xs">{h.fecha}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-medium text-slate-700">
                          {h.total_enviados} etiqueta{h.total_enviados === 1 ? '' : 's'}
                        </span>
                        <span className="text-slate-500 text-xs w-full sm:w-auto">{h.mensaje}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          {/* Columna derecha — comparar listas */}
          {showComparePanel && (
            <div className="min-h-0 flex flex-col overflow-hidden">
              <ReaderAllowListSection refreshKey={listRefreshKey} fillHeight />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
