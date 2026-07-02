import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Server,
  Smartphone,
} from 'lucide-react';
import { api } from '../api/client';

interface Props {
  refreshKey?: number;
  /** Ocupa toda la altura del contenedor padre (panel lateral). */
  fillHeight?: boolean;
}

export default function ReaderAllowListSection({ refreshKey = 0, fillHeight = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<{
    reader: { version: number; tids: string[]; count: number; updatedAt?: number | null };
    dbTids: string[];
    onlyInDb: string[];
    onlyInReader: string[];
    inSync: boolean;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.syncAllowList();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la lista del lector');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const readerTids = data?.reader.tids ?? [];

  const filteredTids = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return readerTids;
    return readerTids.filter((tid) => tid.includes(q));
  }, [readerTids, query]);

  const listClass = fillHeight
    ? 'flex-1 min-h-0 overflow-y-auto divide-y divide-slate-50'
    : 'max-h-80 overflow-y-auto divide-y divide-slate-50';

  return (
    <section
      className={`bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden ${
        fillHeight ? 'flex flex-col h-full min-h-0' : ''
      }`}
    >
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-slate-900 m-0">Comparar listas</h2>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Etiquetas en esta computadora vs. etiquetas en el lector de la puerta
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
      </div>

      <div className={fillHeight ? 'flex flex-col flex-1 min-h-0' : ''}>
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200 flex gap-2 shrink-0">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading && !data ? (
          <div className="p-8 flex items-center justify-center gap-2 text-slate-500 text-sm flex-1">
            <Loader2 className="w-4 h-4 animate-spin" />
            Consultando etiquetas…
          </div>
        ) : data ? (
          <>
            <div className="px-6 py-4 grid grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-100 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Smartphone size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 m-0 truncate">En esta PC</p>
                  <p className="text-base font-bold text-slate-900 m-0">{data.dbTids.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white border border-slate-100 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                  <Server size={14} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 m-0 truncate">En el lector</p>
                  <p className="text-base font-bold text-slate-900 m-0">{readerTids.length}</p>
                </div>
              </div>
              <div
                className={`flex items-center gap-2 p-2.5 rounded-lg border min-w-0 ${
                  data.inSync
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                {data.inSync ? (
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 m-0">Estado</p>
                  <p
                    className={`text-xs font-bold m-0 truncate ${
                      data.inSync ? 'text-emerald-800' : 'text-amber-900'
                    }`}
                  >
                    {data.inSync ? 'Coincide' : 'Diferencias'}
                  </p>
                </div>
              </div>
            </div>

            {!data.inSync && (
              <div className="px-6 py-3 grid grid-cols-1 gap-2 border-b border-slate-100 shrink-0">
                {data.onlyInDb.length > 0 && (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <p className="text-xs font-semibold text-amber-900 m-0">
                      Solo en esta PC ({data.onlyInDb.length})
                    </p>
                    <p className="text-[11px] text-amber-800 m-0 mt-0.5">
                      Sincronizá para enviarlas al lector.
                    </p>
                  </div>
                )}
                {data.onlyInReader.length > 0 && (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <p className="text-xs font-semibold text-amber-900 m-0">
                      Solo en el lector ({data.onlyInReader.length})
                    </p>
                    <p className="text-[11px] text-amber-800 m-0 mt-0.5">
                      Sincronizá para actualizar la lista del lector.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="px-6 py-3 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar etiqueta…"
                  className="w-full pl-9 pr-3 py-2 text-sm font-mono border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              {query && (
                <p className="text-xs text-slate-500 mt-2 m-0">
                  {filteredTids.length} de {readerTids.length} coincidencias
                </p>
              )}
            </div>

            {readerTids.length === 0 ? (
              <p className="p-6 text-sm text-slate-400 m-0">
                El lector no tiene etiquetas cargadas. Usá &quot;Sincronizar ahora&quot; para enviarlas.
              </p>
            ) : filteredTids.length === 0 ? (
              <p className="p-6 text-sm text-slate-400 m-0">Ninguna etiqueta coincide con la búsqueda.</p>
            ) : (
              <ul className={listClass}>
                {filteredTids.map((tid) => (
                  <li
                    key={tid}
                    className="px-6 py-2.5 font-mono text-xs text-slate-800 hover:bg-slate-50"
                  >
                    {tid}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}
