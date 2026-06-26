import { useEffect, useState } from 'react';
import {
  X,
  Calendar,
  User,
  CheckCircle,
  AlertCircle,
  Loader2,
  ScanLine,
  FileText,
} from 'lucide-react';
import { api } from '../api/client';
import type { Activo, AuditoriaCompleta } from '../types';

interface Props {
  auditoriaId: number | null;
  open: boolean;
  onClose: () => void;
  activos?: Activo[];
  canGoToInventario?: boolean;
  onGoToRecord?: (activo: Activo) => void;
}

export default function AuditoriaDetalleModal({
  auditoriaId,
  open,
  onClose,
  activos = [],
  canGoToInventario = false,
  onGoToRecord,
}: Props) {
  const [data, setData] = useState<AuditoriaCompleta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !auditoriaId) {
      setData(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getAuditoria(auditoriaId)
      .then((a) => {
        if (!cancelled) setData(a);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, auditoriaId]);

  if (!open) return null;

  const activoById = new Map(activos.map((a) => [a.id, a]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[88vh] overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 m-0 flex items-center gap-2">
              <ScanLine size={18} className="text-violet-600" />
              Auditoría guardada
              {data && <span className="text-slate-400 font-mono text-sm">#{data.id}</span>}
            </h2>
            {data && (
              <p className="text-xs text-slate-500 m-0 mt-1">
                {data.fechaInicio} → {data.fechaFin}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && (
            <div className="flex flex-col items-center py-12 text-slate-400 gap-3">
              <Loader2 size={28} className="animate-spin text-violet-400" />
              <p className="text-sm m-0">Cargando auditoría…</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
              {error}
            </div>
          )}

          {data && !loading && (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <MetaCard
                  label="Etiquetas leídas"
                  value={String(data.totalLeidos)}
                  icon={<ScanLine size={14} />}
                />
                <MetaCard
                  label="En inventario"
                  value={String(data.totalRegistrados)}
                  icon={<CheckCircle size={14} />}
                  valueClass="text-emerald-600"
                />
                <MetaCard
                  label="No registradas"
                  value={String(data.totalDesconocidos)}
                  icon={<AlertCircle size={14} />}
                  valueClass="text-amber-600"
                />
                <MetaCard
                  label="Usuario"
                  value={data.usuarioNombre || data.usuarioUsername || '—'}
                  icon={<User size={14} />}
                  small
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <Calendar size={14} className="text-slate-400 shrink-0" />
                  <span>
                    <strong className="text-slate-800">Inicio:</strong> {data.fechaInicio}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <Calendar size={14} className="text-slate-400 shrink-0" />
                  <span>
                    <strong className="text-slate-800">Fin / guardado:</strong> {data.fechaFin}
                  </span>
                </div>
              </div>

              {data.notas && (
                <div className="p-3 bg-violet-50 border border-violet-100 rounded-lg text-sm text-slate-700 flex gap-2">
                  <FileText size={16} className="text-violet-500 shrink-0 mt-0.5" />
                  <span>{data.notas}</span>
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase">
                        TID
                      </th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase">
                        Resultado
                      </th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase">
                        SKU / Estado
                      </th>
                      <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase">
                        Ubicación
                      </th>
                      {canGoToInventario && (
                        <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase w-28" />
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.detalle.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-xs">{row.tid}</td>
                        <td className="px-4 py-2.5">
                          {row.registrado ? (
                            <span className="text-emerald-700 text-xs font-semibold">En inventario</span>
                          ) : (
                            <span className="text-amber-700 text-xs font-semibold">No registrado</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">
                          {row.registrado ? (
                            <span>
                              {row.sku ?? '—'}
                              {row.estado && (
                                <span
                                  className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold"
                                  style={{
                                    backgroundColor: `${row.estadoColor ?? '#64748b'}22`,
                                    color: row.estadoColor ?? '#64748b',
                                  }}
                                >
                                  {row.estado}
                                </span>
                              )}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">
                          {row.ubicacion || '—'}
                        </td>
                        {canGoToInventario && (
                          <td className="px-4 py-2.5">
                            {row.activoId && activoById.has(row.activoId) && onGoToRecord && (
                              <button
                                type="button"
                                onClick={() => {
                                  const activo = activoById.get(row.activoId!);
                                  if (activo) {
                                    onGoToRecord(activo);
                                    onClose();
                                  }
                                }}
                                className="text-[11px] font-semibold text-violet-700 hover:underline cursor-pointer"
                              >
                                Ir a registro
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaCard({
  label,
  value,
  icon,
  valueClass = 'text-slate-900',
  small = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClass?: string;
  small?: boolean;
}) {
  return (
    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50/80">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase mb-1">
        {icon}
        {label}
      </div>
      <div className={`${small ? 'text-sm font-semibold' : 'text-xl font-mono font-bold'} ${valueClass} truncate`}>
        {value}
      </div>
    </div>
  );
}
