import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { api } from '../api/client';

interface Props {
  refreshKey?: number;
}

export default function ReaderAllowListSection({ refreshKey = 0 }: Props) {
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
      setError(e instanceof Error ? e.message : 'Error al cargar lista del lector');
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

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800 m-0">Tags autorizados en el lector</h2>
          <p className="text-xs text-slate-500 m-0 mt-0.5">
            Lista actual en la User App del FX9600
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Actualizar lista
        </button>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="p-8 flex items-center justify-center gap-2 text-slate-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando tags del lector…
        </div>
      ) : data ? (
        <>
          <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-slate-50 bg-slate-50/50">
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
              {readerTids.length} TID en lector · v{data.reader.version}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
              {data.dbTids.length} TID en PC
            </span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                data.inSync ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {data.inSync ? 'En sync' : 'Desincronizado'}
            </span>
          </div>

          {!data.inSync && (
            <div className="px-6 py-3 grid sm:grid-cols-2 gap-3 border-b border-slate-100">
              {data.onlyInDb.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs">
                  <p className="font-semibold m-0 mb-1">Solo en PC ({data.onlyInDb.length})</p>
                  <p className="font-mono m-0 text-amber-900 break-all line-clamp-3">
                    {data.onlyInDb.join(', ')}
                  </p>
                </div>
              )}
              {data.onlyInReader.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs">
                  <p className="font-semibold m-0 mb-1">Solo en lector ({data.onlyInReader.length})</p>
                  <p className="font-mono m-0 text-amber-900 break-all line-clamp-3">
                    {data.onlyInReader.join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="px-6 py-3 border-b border-slate-100">
            <div className="relative max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar TID…"
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
            <p className="p-6 text-sm text-slate-400 m-0">Lista vacía — sincronice desde la PC.</p>
          ) : filteredTids.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 m-0">Ningún TID coincide con la búsqueda.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-slate-50">
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
  );
}
