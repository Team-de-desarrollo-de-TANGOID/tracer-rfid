import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import {
  ShieldAlert,
  RefreshCw,
  Loader2,
  TrendingDown,
  TrendingUp,
  Minus,
  Clock,
  Tag,
  AlertTriangle,
  CalendarRange,
  RotateCcw,
} from 'lucide-react';
import { api } from '../api/client';
import type { DashboardData, DashboardPeriod } from '../types';
import { formatFechaHora } from '../utils/datetime';
import { PermAction } from './PermAction';
import { P } from '../constants/permissions';

const PERIOD_OPTIONS: { id: DashboardPeriod; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'ayer', label: 'Ayer' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'mes_anterior', label: 'Mes anterior' },
  { id: 'personalizado', label: 'Personalizado' },
];

function defaultCustomRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export default function DashboardView() {
  const [period, setPeriod] = useState<DashboardPeriod>('hoy');
  const [customDraft, setCustomDraft] = useState(defaultCustomRange);
  const [customApplied, setCustomApplied] = useState<{ from: string; to: string } | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (period === 'personalizado' && !customApplied) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await api.getDashboard({
        period,
        ...(period === 'personalizado' && customApplied
          ? { from: customApplied.from, to: customApplied.to }
          : {}),
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar dashboard');
    } finally {
      setLoading(false);
    }
  }, [period, customApplied]);

  useEffect(() => {
    setLoading(true);
    load();
    if (period === 'personalizado' && !customApplied) return undefined;
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load, period, customApplied]);

  const selectPeriod = (id: DashboardPeriod) => {
    setPeriod(id);
    if (id === 'personalizado' && !customApplied) {
      const draft = defaultCustomRange();
      setCustomDraft(draft);
      setCustomApplied(draft);
    }
  };

  const applyCustomRange = () => {
    if (!customDraft.from || !customDraft.to) {
      setError('Seleccione fecha desde y hasta.');
      return;
    }
    if (customDraft.from > customDraft.to) {
      setError('La fecha «desde» no puede ser posterior a «hasta».');
      return;
    }
    setError(null);
    setCustomApplied({ ...customDraft });
    setLoading(true);
  };

  const handleResetContador = async () => {
    if (period === 'personalizado' && !customApplied) {
      setError('Aplique un rango personalizado antes de reiniciar.');
      return;
    }
    try {
      setResetting(true);
      setError(null);
      const res = await api.resetDashboardDetecciones({
        period,
        ...(period === 'personalizado' && customApplied
          ? { from: customApplied.from, to: customApplied.to }
          : {}),
      });
      setConfirmReset(false);
      await load();
      if (res.message) {
        setSuccessMsg(res.message);
        setTimeout(() => setSuccessMsg(null), 5000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reiniciar contador');
    } finally {
      setResetting(false);
    }
  };

  const portal = data?.portal;
  const total = portal?.salidasDenegadas ?? 0;
  const prev = portal?.salidasPeriodoAnterior ?? 0;
  const delta = total - prev;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc] min-h-0">
      <header className="shrink-0 px-5 py-3 border-b border-[#e2e8f0] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-red-50 text-red-600">
              <ShieldAlert size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[#0f172a] m-0">Portal de salida</h1>
              <p className="text-xs text-[#64748b] m-0">Toallas no autorizadas detectadas</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-[#f1f5f9] rounded-lg p-0.5">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectPeriod(opt.id)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md cursor-pointer transition-colors ${
                    period === opt.id
                      ? 'bg-white text-[#0f172a] shadow-sm'
                      : 'text-[#64748b] hover:text-[#0f172a]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <PermAction
              permission={P.dashboardReiniciarContador}
              onClick={() => setConfirmReset(true)}
              disabled={resetting || (period === 'personalizado' && !customApplied)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer disabled:opacity-60"
              lockedClassName="border-slate-200 bg-white text-slate-500"
            >
              {resetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              Reiniciar contador
            </PermAction>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                load();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-[#e2e8f0] bg-white text-[#475569] hover:bg-[#f8fafc] cursor-pointer"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Actualizar
            </button>
          </div>
        </div>

        {period === 'personalizado' && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase text-slate-500">
              Desde
              <input
                type="date"
                value={customDraft.from}
                onChange={(e) => setCustomDraft((d) => ({ ...d, from: e.target.value }))}
                className="px-2 py-1.5 text-sm font-normal normal-case rounded-lg border border-slate-200 bg-white text-slate-800"
              />
            </label>
            <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase text-slate-500">
              Hasta
              <input
                type="date"
                value={customDraft.to}
                onChange={(e) => setCustomDraft((d) => ({ ...d, to: e.target.value }))}
                className="px-2 py-1.5 text-sm font-normal normal-case rounded-lg border border-slate-200 bg-white text-slate-800"
              />
            </label>
            <button
              type="button"
              onClick={applyCustomRange}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer"
            >
              <CalendarRange size={14} />
              Aplicar
            </button>
          </div>
        )}

        {data?.range && (
          <p className="text-[11px] text-[#94a3b8] mt-2 m-0">
            {data.range.label}: {formatFechaHora(data.range.from)} — {formatFechaHora(data.range.to)}
          </p>
        )}
      </header>

      <div className="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-hidden">
        {error && (
          <div className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {successMsg}
          </div>
        )}

        {/* Métrica compacta */}
        <section className="shrink-0 bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-stretch divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
            <div className="flex items-center gap-3 px-4 py-3 sm:min-w-[140px] bg-red-50/50">
              {loading && !data ? (
                <Loader2 size={28} className="animate-spin text-red-400" />
              ) : (
                <motion.span
                  key={`${period}-${total}-${customApplied?.from}`}
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1 }}
                  className="text-4xl font-black text-red-600 tabular-nums leading-none"
                >
                  {total}
                </motion.span>
              )}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 m-0 leading-tight">
                  Toallas
                </p>
                <p className="text-[10px] text-slate-500 m-0">1 / etiqueta / 2 h</p>
              </div>
            </div>
            <MiniStat
              icon={<ComparisonIcon delta={delta} />}
              label={`vs. ${portal?.periodoAnteriorLabel ?? 'anterior'}`}
              value={
                delta === 0 ? (
                  <span className="text-slate-600">= {prev}</span>
                ) : delta > 0 ? (
                  <span className="text-red-600">+{delta} ({prev})</span>
                ) : (
                  <span className="text-emerald-600">{delta} ({prev})</span>
                )
              }
            />
            <MiniStat
              icon={<Clock size={15} className="text-slate-500" />}
              label="Última"
              value={
                portal?.ultimaDeteccionAt ? (
                  <span className="font-mono text-[11px]">{formatFechaHora(portal.ultimaDeteccionAt)}</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )
              }
            />
            <MiniStat
              icon={<AlertTriangle size={15} className="text-amber-500" />}
              label="Sin inventario"
              value={
                <span className={portal?.noRegistradas ? 'text-amber-700' : 'text-slate-600'}>
                  {portal?.noRegistradas ?? 0}
                </span>
              }
            />
          </div>
        </section>

        {/* Tabla — ocupa el resto de la pantalla */}
        <section className="flex-1 min-h-0 bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden flex flex-col">
          <div className="shrink-0 px-4 py-2 border-b border-[#e2e8f0] flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold text-[#0f172a] m-0">Detalle de detecciones</h2>
              <p className="text-[10px] text-[#64748b] m-0">
                {portal?.ultimasDetecciones?.length ?? 0} en el período
              </p>
            </div>
            <Tag size={16} className="text-[#94a3b8] shrink-0" />
          </div>
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f8fafc] sticky top-0 z-10">
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#64748b]">
                  <th className="px-3 py-2 font-bold">Fecha / hora</th>
                  <th className="px-3 py-2 font-bold">TID</th>
                  <th className="px-3 py-2 font-bold">SKU</th>
                  <th className="px-3 py-2 font-bold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(portal?.ultimasDetecciones ?? []).map((d) => (
                  <tr key={d.id} className="border-t border-[#f1f5f9] hover:bg-[#fafbfc]">
                    <td className="px-3 py-2 font-mono text-[11px] text-[#475569] whitespace-nowrap">
                      {formatFechaHora(d.detectadoAt)}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-[#0f172a] break-all max-w-[180px]">
                      {d.tid}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#475569]">{d.sku ?? '—'}</td>
                    <td className="px-3 py-2">
                      {d.estado ? (
                        <span
                          className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
                          style={{
                            color: d.estadoColor || '#64748b',
                            backgroundColor: `${d.estadoColor || '#64748b'}18`,
                          }}
                        >
                          {d.estado}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 font-medium">
                          <AlertTriangle size={10} />
                          No registrada
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && (portal?.ultimasDetecciones?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center">
                      <ShieldAlert size={24} className="text-emerald-300 mx-auto mb-2" />
                      <p className="text-xs font-medium text-slate-600 m-0">
                        Sin salidas no autorizadas en este período
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {confirmReset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 m-0">Reiniciar contador del período</h2>
            <p className="text-sm text-slate-600 m-0">
              Se eliminarán todas las detecciones de toallas no autorizadas del período actual
              {data?.range ? ` (${data.range.label})` : ''}. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleResetContador()}
                disabled={resetting}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 cursor-pointer disabled:opacity-60"
              >
                {resetting ? 'Reiniciando…' : 'Confirmar reinicio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp size={15} className="text-red-500" />;
  if (delta < 0) return <TrendingDown size={15} className="text-emerald-500" />;
  return <Minus size={15} className="text-slate-400" />;
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex-1 min-w-[100px] px-3 py-2 flex items-center gap-2">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500 m-0 truncate">
          {label}
        </p>
        <div className="text-xs font-semibold mt-0.5 truncate">{value}</div>
      </div>
    </div>
  );
}
