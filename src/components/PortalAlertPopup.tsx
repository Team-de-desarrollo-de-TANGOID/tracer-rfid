import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ShieldAlert, X } from 'lucide-react';
import { api } from '../api/client';
import type { PortalAlertPayload, PortalDeteccion } from '../types';
import { formatFechaHora, nowInAppTzSql } from '../utils/datetime';

interface Props {
  enabled: boolean;
}

function tidKey(d: PortalDeteccion) {
  return String(d.tid || '').toUpperCase();
}

/** Una fila por TID (última lectura gana). */
function dedupeBatchByTid(batch: PortalDeteccion[]) {
  const map = new Map<string, PortalDeteccion>();
  for (const det of batch) {
    const key = tidKey(det);
    if (key) map.set(key, det);
  }
  return [...map.values()];
}

function detectadoAtMs(det: PortalDeteccion): number {
  const v = det.detectadoAt;
  if (!v) return Date.now();
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? '00'}-03:00`);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  const parsed = Date.parse(v);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

/** Quita etiquetas que dejaron de reportarse (sin alerta dentro del seenTimeout del lector). */
function pruneUnreportedTags(
  detecciones: PortalDeteccion[],
  lastReportByTid: Map<string, number>,
  staleAfterMs: number,
  now = Date.now()
) {
  return detecciones.filter((det) => {
    const key = tidKey(det);
    if (!key) return false;
    const last = lastReportByTid.get(key);
    if (last == null) return false;
    return now - last <= staleAfterMs;
  });
}

function markTagReports(
  batch: PortalDeteccion[],
  lastReportByTid: Map<string, number>,
  now = Date.now()
) {
  for (const det of batch) {
    const key = tidKey(det);
    if (!key) continue;
    const at = detectadoAtMs(det);
    lastReportByTid.set(key, Math.max(at, now));
  }
}

/** Agrega etiquetas nuevas o actualiza las ya visibles en el modal. */
function mergeAccumulateByTid(existing: PortalDeteccion[], incoming: PortalDeteccion[]) {
  const map = new Map<string, PortalDeteccion>();
  for (const det of existing) {
    const key = tidKey(det);
    if (key) map.set(key, det);
  }
  for (const det of incoming) {
    const key = tidKey(det);
    if (key) map.set(key, det);
  }
  return [...map.values()];
}

export default function PortalAlertPopup({ enabled }: Props) {
  const [alert, setAlert] = useState<PortalAlertPayload | null>(null);
  const [portalAlertsEnabled, setPortalAlertsEnabled] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef(nowInAppTzSql(-60_000));
  const tagLastReportRef = useRef<Map<string, number>>(new Map());
  const seenTimeoutSecRef = useRef(5);

  const staleAfterMs = () => (seenTimeoutSecRef.current + 2) * 1000;

  const dismiss = useCallback(() => {
    setDetailsOpen(false);
    tagLastReportRef.current.clear();
    setAlert(null);
  }, []);

  const applyPrune = useCallback((detecciones: PortalDeteccion[]) => {
    return pruneUnreportedTags(detecciones, tagLastReportRef.current, staleAfterMs());
  }, []);

  const showAlert = useCallback((payload: PortalAlertPayload) => {
    if (!portalAlertsEnabled) return;
    const raw = payload.detecciones?.length
      ? payload.detecciones
      : payload.deteccion
        ? [payload.deteccion]
        : [];
    const batch = dedupeBatchByTid(raw);
    if (batch.length === 0) return;

    markTagReports(batch, tagLastReportRef.current);

    for (const det of batch) {
      if (det.detectadoAt && det.detectadoAt > lastSeenRef.current) {
        lastSeenRef.current = det.detectadoAt;
      }
    }

    setAlert((prev) => {
      const merged = prev
        ? mergeAccumulateByTid(prev.detecciones ?? [], batch)
        : batch;
      const detecciones = applyPrune(merged);
      return {
        ...payload,
        detecciones,
        deteccion: detecciones[0] ?? batch[0],
        count: detecciones.length,
        totalEnPeriodo: payload.totalEnPeriodo ?? prev?.totalEnPeriodo,
      };
    });
  }, [portalAlertsEnabled, applyPrune]);

  useEffect(() => {
    if (!portalAlertsEnabled) setAlert(null);
  }, [portalAlertsEnabled]);

  useEffect(() => {
    const refreshAlertsSetting = () => {
      api
        .getPortalUiSettings()
        .then((r) => {
          setPortalAlertsEnabled(r.portalAlertsEnabled ?? true);
          if (r.portalDedupeSec > 0) seenTimeoutSecRef.current = r.portalDedupeSec;
        })
        .catch(() => {});
    };
    refreshAlertsSetting();
    const timer = setInterval(refreshAlertsSetting, 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!enabled || !portalAlertsEnabled) return;

    const controller = new AbortController();
    api.subscribePortalAlerts({
      signal: controller.signal,
      getSince: () => lastSeenRef.current,
      onAlert: (payload) => {
        console.log('[PortalAlert] alert recibida', payload);
        showAlert(payload);
      },
      onError: (msg) => {
        console.warn('[PortalAlert] stream error:', msg);
      },
      onClose: () => {
        console.log('[PortalAlert] stream cerrado, reintentando…');
      },
    });

    return () => controller.abort();
  }, [enabled, portalAlertsEnabled, showAlert]);

  // Respaldo si el SSE se cae en silencio (proxy, reinicio del servidor, pestaña inactiva).
  useEffect(() => {
    if (!enabled || !portalAlertsEnabled) return;

    const poll = async () => {
      try {
        const from = lastSeenRef.current;
        const { items } = await api.getDashboardDetecciones({ from, limit: 30 });
        const fresh = dedupeBatchByTid(
          items.filter((d) => d.detectadoAt > from)
        );
        if (!fresh.length) return;
        const newest = fresh.reduce((a, b) => (a.detectadoAt > b.detectadoAt ? a : b));
        lastSeenRef.current = newest.detectadoAt;
        showAlert({
          kind: fresh.length > 1 ? 'denied_batch' : 'denied',
          count: fresh.length,
          detecciones: fresh,
          deteccion: fresh[0],
          replay: true,
        });
      } catch {
        /* servidor no disponible */
      }
    };

    const id = setInterval(poll, 12_000);
    return () => clearInterval(id);
  }, [enabled, portalAlertsEnabled, showAlert]);

  // Quita del modal etiquetas que el lector ya no vuelve a reportar.
  useEffect(() => {
    if (!enabled || !portalAlertsEnabled) return;

    const id = setInterval(() => {
      setAlert((prev) => {
        if (!prev) return null;
        const pruned = pruneUnreportedTags(
          prev.detecciones ?? [],
          tagLastReportRef.current,
          staleAfterMs()
        );
        if (pruned.length === (prev.detecciones?.length ?? 0)) return prev;
        return {
          ...prev,
          detecciones: pruned,
          deteccion: pruned[0] ?? prev.deteccion,
          count: pruned.length,
        };
      });
    }, 500);

    return () => clearInterval(id);
  }, [enabled, portalAlertsEnabled]);

  const items: PortalDeteccion[] =
    alert?.detecciones ?? (alert?.deteccion ? [alert.deteccion] : []);
  const totalLeidos = items.length;
  const totalHoy = alert?.totalEnPeriodo;

  useEffect(() => {
    if (!alert || items.length === 0 || !detailsOpen) return;
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [alert, items.length, detailsOpen]);

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
          role="presentation"
        >
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
            aria-hidden
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative w-full max-w-2xl max-h-[min(90vh,820px)] flex flex-col rounded-2xl border-2 border-red-300 bg-white shadow-2xl shadow-red-950/30 overflow-hidden"
            role="alertdialog"
            aria-modal="true"
            aria-live="polite"
            aria-labelledby="portal-alert-title"
            aria-describedby="portal-alert-desc"
          >
            <div className="bg-red-600 px-6 py-5 flex items-start justify-between gap-4 text-white shrink-0">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-red-500/40 flex items-center justify-center shrink-0">
                  <ShieldAlert size={28} />
                </div>
                <div className="min-w-0">
                  <p id="portal-alert-title" className="text-lg font-bold m-0 tracking-tight">
                    Salida no autorizada
                  </p>
                  <p id="portal-alert-desc" className="text-sm text-red-100 m-0 mt-1">
                    Se detectaron etiquetas no autorizadas en el portal
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismiss}
                className="p-2 rounded-lg hover:bg-red-500 cursor-pointer shrink-0"
                aria-label="Cerrar"
              >
                <X size={22} />
              </button>
            </div>

            <div className="px-6 py-8 text-center border-b border-red-100 bg-red-50/80 shrink-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-red-700 m-0 mb-2">
                Toallas distintas detectadas
              </p>
              <motion.p
                key={totalLeidos}
                initial={{ scale: 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.2 }}
                className="text-6xl sm:text-7xl font-black text-red-600 tabular-nums leading-none m-0"
              >
                {totalLeidos}
              </motion.p>
              <p className="text-sm text-slate-600 m-0 mt-3">
                {totalLeidos === 0
                  ? 'Ninguna etiqueta en el campo de lectura'
                  : totalLeidos === 1
                    ? '1 etiqueta distinta en esta alerta'
                    : `${totalLeidos} etiquetas distintas en esta alerta`}
              </p>
              {totalHoy != null && totalHoy > 0 && (
                <p className="text-xs text-slate-500 m-0 mt-2">
                  Total hoy en el club:{' '}
                  <span className="font-semibold text-slate-700">{totalHoy}</span>
                  <span className="text-slate-400"> · máx. 1 por etiqueta cada 2 h</span>
                </p>
              )}
            </div>

            <div className="border-b border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setDetailsOpen((open) => !open)}
                aria-expanded={detailsOpen}
                aria-controls="portal-alert-details"
                className="w-full px-6 py-3 flex items-center justify-between gap-3 bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer text-left"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Detalle de etiquetas ({items.length})
                </span>
                <ChevronDown
                  size={18}
                  className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                    detailsOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden
                />
              </button>
              {detailsOpen && (
                <div
                  id="portal-alert-details"
                  className="max-h-[min(40vh,320px)] overflow-y-auto border-t border-slate-100"
                >
                  <div className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <p className="px-6 py-8 text-sm text-slate-500 text-center m-0">
                        Las etiquetas salieron del portal o dejaron de leerse.
                      </p>
                    ) : (
                      items.map((det) => (
                      <div
                        key={`tid-${tidKey(det)}`}
                        className="px-6 py-4 space-y-2 text-sm"
                      >
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500 shrink-0">TID</span>
                          <span className="font-mono font-semibold text-slate-900 text-right break-all">
                            {det.tid}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Detectado</span>
                          <span className="font-mono text-slate-600">
                            {formatFechaHora(det.detectadoAt)}
                          </span>
                        </div>
                        {det.sku && (
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">SKU</span>
                            <span className="font-medium text-slate-800">{det.sku}</span>
                          </div>
                        )}
                        {det.estado && (
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-500">Estado</span>
                            <span
                              className="font-semibold"
                              style={{ color: det.estadoColor || '#64748b' }}
                            >
                              {det.estado}
                            </span>
                          </div>
                        )}
                        {!det.activoId && (
                          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 m-0">
                            Etiqueta no registrada en inventario.
                          </p>
                        )}
                      </div>
                    ))
                    )}
                  </div>
                  <div ref={listEndRef} />
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-white shrink-0">
              <button
                type="button"
                onClick={dismiss}
                className="w-full py-3 rounded-xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 cursor-pointer"
              >
                Aceptar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
