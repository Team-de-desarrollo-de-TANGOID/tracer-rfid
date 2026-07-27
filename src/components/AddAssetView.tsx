import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Tag,
  AlertCircle,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  History,
  Ban,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../api/client';
import ActivoAltaFields from './ActivoAltaFields';
import R3ReaderSidebar from './R3ReaderSidebar';
import { useR3Reader } from '../hooks/useR3Reader';
import type { ColumnaTabla, Estado, InventarioColumnasConfig, Sku, Ubicacion } from '../types';
import {
  ALTA_FALLBACK_COLUMNS,
  buildCreateActivoPayload,
  datosAltaCompletos,
  getAltaActivoFields,
  getCamposObligatoriosAltaFaltantes,
  initAltaFieldValues,
} from '../utils/activoAlta';
import { mergeTids, parseTidsFromText } from '../utils/tidInput';
import { formatListaValorDisplay } from '../utils/propiedadLista';
import { formatFecha, formatHora } from '../utils/datetime';

type HistorialCarga = {
  id: number;
  fecha: string;
  usuarioId: number | null;
  usuarioNombre: string;
  cantidad: number;
  errores: number;
};

interface Props {
  skus: Sku[];
  estados: Estado[];
  ubicaciones: Ubicacion[];
  columnasConfig?: InventarioColumnasConfig | null;
  onCreated: () => void;
  onGoToInventario: () => void;
}

const WIZARD_STEPS = [
  { id: 1, label: 'Etiquetas', short: 'Etiquetas RFID' },
  { id: 2, label: 'Datos', short: 'Datos del activo' },
  { id: 3, label: 'Confirmar', short: 'Confirmar alta' },
] as const;

const PANEL_TRANSITION = { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const };

function WizardStepper({
  current,
  maxReachable,
  onStepClick,
}: {
  current: number;
  maxReachable: number;
  onStepClick: (step: number) => void;
}) {
  return (
    <nav className="flex items-center gap-1 sm:gap-2" aria-label="Pasos del alta">
      {WIZARD_STEPS.map((step, i) => {
        const done = step.id < current;
        const active = step.id === current;
        const reachable = step.id <= maxReachable;
        return (
          <div key={step.id} className="flex items-center flex-1 min-w-0 last:flex-none">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onStepClick(step.id)}
              className={`flex items-center gap-2 min-w-0 rounded-lg px-2 py-1.5 transition-colors ${
                reachable ? 'cursor-pointer hover:bg-slate-100' : 'cursor-default'
              } ${active ? 'bg-blue-50' : ''}`}
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-blue-600 text-white'
                      : reachable
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-slate-100 text-slate-400'
                }`}
              >
                {done ? <Check size={13} strokeWidth={3} /> : step.id}
              </span>
              <span
                className={`hidden sm:block text-xs font-semibold truncate ${
                  active ? 'text-blue-700' : done ? 'text-emerald-700' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </button>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-1 sm:mx-2 transition-colors ${
                  step.id < current ? 'bg-emerald-400' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-1 sm:gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <dt className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-slate-800 m-0 min-w-0">{value}</dd>
    </div>
  );
}

function FeedbackBanner({
  error,
  success,
  loteErrores,
  onDismiss,
  onLoadAnother,
  onGoToInventario,
}: {
  error: string | null;
  success: string | null;
  loteErrores: { epc: string; error: string }[];
  onDismiss: () => void;
  onLoadAnother: () => void;
  onGoToInventario: () => void;
}) {
  if (!error && !success && loteErrores.length === 0) return null;

  const isSuccess = Boolean(success) && !error && loteErrores.length === 0;
  const isDupOnly =
    loteErrores.length > 0 &&
    loteErrores.every((e) => /ya está en el sistema/i.test(e.error));

  const tone = isSuccess
    ? {
        wrap: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        icon: <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />,
        title: 'Alta registrada',
      }
    : isDupOnly
      ? {
          wrap: 'bg-amber-50 border-amber-200 text-amber-950',
          icon: <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />,
          title: 'Etiquetas ya registradas',
        }
      : {
          wrap: 'bg-red-50 border-red-200 text-red-900',
          icon: <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />,
          title: 'No se pudo completar el alta',
        };

  const message = success || error;

  return (
    <div className={`rounded-xl border px-4 py-3 ${tone.wrap}`}>
      <div className="flex gap-3 items-start">
        {tone.icon}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="m-0 text-sm font-semibold">{tone.title}</p>
            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 p-0.5 rounded text-current/50 hover:text-current cursor-pointer border-0 bg-transparent"
              aria-label="Cerrar aviso"
            >
              <X size={15} />
            </button>
          </div>
          {message && <p className="m-0 mt-1 text-sm leading-snug opacity-90">{message}</p>}

          {loteErrores.length > 0 && (
            <div className="mt-2.5 rounded-lg bg-white/70 border border-black/5 overflow-hidden">
              <p className="m-0 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-70 border-b border-black/5">
                {loteErrores.length} etiqueta{loteErrores.length === 1 ? '' : 's'}
              </p>
              <ul className="m-0 p-0 list-none max-h-28 overflow-y-auto divide-y divide-black/5">
                {loteErrores.map((item) => (
                  <li
                    key={item.epc}
                    className="px-3 py-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs"
                  >
                    <span className="font-mono break-all">{item.epc}</span>
                    <span className="opacity-60">— {item.error}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isSuccess && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onLoadAnother}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer border-0"
              >
                Cargar otro lote
              </button>
              <button
                type="button"
                onClick={onGoToInventario}
                className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white/80 text-emerald-800 text-xs font-semibold hover:bg-white cursor-pointer"
              >
                Ver inventario
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AddAssetView({
  skus,
  estados,
  ubicaciones,
  columnasConfig = null,
  onCreated,
  onGoToInventario,
}: Props) {
  const ubicacionesActivas = ubicaciones.filter((u) => u.activo);
  const tidInputRef = useRef<HTMLInputElement>(null);

  const [activeStep, setActiveStep] = useState(1);
  const [confirmChecked, setConfirmChecked] = useState(false);

  const [tidsLote, setTidsLote] = useState<string[]>([]);
  const [loteInput, setLoteInput] = useState('');
  const [columnasCatalogo, setColumnasCatalogo] = useState<ColumnaTabla[]>(ALTA_FALLBACK_COLUMNS);
  const [columnasLoading, setColumnasLoading] = useState(true);
  const [skuId, setSkuId] = useState(0);
  const [estadoId, setEstadoId] = useState(0);
  const [ubicacionId, setUbicacionId] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loteErrores, setLoteErrores] = useState<{ epc: string; error: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [registradosSesion, setRegistradosSesion] = useState(0);
  const [historialCargas, setHistorialCargas] = useState<HistorialCarga[]>([]);
  const [historialLoading, setHistorialLoading] = useState(true);
  const [power, setPower] = useState(15);
  const powerTimerRef = useRef<number | null>(null);

  const loadHistorialCargas = useCallback(async () => {
    try {
      const rows = await api.getHistorialCargas();
      setHistorialCargas(rows);
    } catch {
      /* silencioso: el historial no bloquea el alta */
    } finally {
      setHistorialLoading(false);
    }
  }, []);

  const addLoteTids = useCallback((incoming: string[]) => {
    setTidsLote((prev) => {
      const { merged, added } = mergeTids(prev, incoming);
      if (added > 0) {
        setError(null);
        setSuccess(null);
        setLoteErrores([]);
      }
      return merged;
    });
  }, []);

  const {
    status: r3Status,
    busy: r3Busy,
    lastEpc,
    lastReadAt,
    refreshStatus,
    connect,
    disconnect,
    setAntennaPower,
    forgetTids,
  } = useR3Reader({
    active: activeStep === 1 && !submitting,
    onEpcs: (epcs) => {
      addLoteTids(epcs);
      setLoteInput('');
    },
  });

  const removeLoteTid = useCallback(
    (tid: string) => {
      setTidsLote((prev) => prev.filter((x) => x !== tid));
      void forgetTids(tid);
    },
    [forgetTids]
  );

  useEffect(() => {
    if (r3Status.power?.ant1) setPower(r3Status.power.ant1);
  }, [r3Status.power?.ant1]);

  const handlePowerChange = (value: number) => {
    setPower(value);
    if (powerTimerRef.current) window.clearTimeout(powerTimerRef.current);
    powerTimerRef.current = window.setTimeout(() => {
      void setAntennaPower(value).catch(() => undefined);
    }, 450);
  };

  const altaFields = useMemo(
    () => getAltaActivoFields(columnasCatalogo),
    [columnasCatalogo]
  );

  const selectedSku = skus.find((s) => s.id === skuId);
  const selectedEstado = estados.find((e) => e.id === estadoId);
  const selectedUbicacion = ubicacionesActivas.find((u) => u.id === ubicacionId);

  const tagsReady = tidsLote.length > 0;

  const datosReady = useMemo(
    () =>
      datosAltaCompletos(columnasCatalogo, {
        skuId,
        estadoId,
        ubicacionId,
        fieldValues,
      }),
    [columnasCatalogo, skuId, estadoId, ubicacionId, fieldValues]
  );

  const canSubmit =
    tagsReady && datosReady && confirmChecked && activeStep === 3 && !submitting;

  const maxReachableStep = !tagsReady ? 1 : !datosReady ? 2 : 3;

  const focusTidInput = useCallback(() => {
    requestAnimationFrame(() => tidInputRef.current?.focus());
  }, []);

  useEffect(() => {
    const fromConfig = columnasConfig?.columnas;
    if (fromConfig?.length) {
      setColumnasCatalogo(fromConfig);
      setColumnasLoading(false);
      return;
    }
    let cancelled = false;
    setColumnasLoading(true);
    api
      .getPropiedadesAlta()
      .then((cols) => {
        if (!cancelled) {
          setColumnasCatalogo(cols.length > 0 ? cols : ALTA_FALLBACK_COLUMNS);
          setColumnasLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setColumnasCatalogo(ALTA_FALLBACK_COLUMNS);
          setColumnasLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [columnasConfig]);

  useEffect(() => {
    if (altaFields.length === 0) return;
    setFieldValues((prev) => {
      const next = initAltaFieldValues(altaFields);
      for (const col of altaFields) {
        if (prev[col.codigo] !== undefined) {
          next[col.codigo] = prev[col.codigo];
        }
      }
      return next;
    });
  }, [altaFields]);

  useEffect(() => {
    if (activeStep === 1) focusTidInput();
  }, [activeStep, focusTidInput]);

  useEffect(() => {
    if (activeStep !== 3) setConfirmChecked(false);
  }, [activeStep]);

  useEffect(() => {
    void loadHistorialCargas();
  }, [loadHistorialCargas]);

  const handleSkuChange = (id: number) => {
    setSkuId(id);
  };

  const buildPayload = (epc: string) =>
    buildCreateActivoPayload(
      epc,
      skuId,
      estadoId,
      ubicacionId,
      fieldValues,
      columnasCatalogo
    );

  const getFieldDisplayValue = useCallback(
    (col: ColumnaTabla): ReactNode => {
      switch (col.codigo) {
        case 'sku':
          return selectedSku ? (
            <span>
              <span className="font-semibold">{selectedSku.codigo}</span>
              <span className="text-slate-500"> — {selectedSku.descripcion}</span>
            </span>
          ) : (
            '—'
          );
        case 'estado':
          return selectedEstado ? (
            <span
              className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-semibold"
              style={{
                backgroundColor: `${selectedEstado.color}18`,
                color: selectedEstado.color,
              }}
            >
              {selectedEstado.nombre}
            </span>
          ) : (
            '—'
          );
        case 'ubicacion':
          return selectedUbicacion ? (
            <span>
              {selectedUbicacion.nombre}
              {selectedUbicacion.descripcion && (
                <span className="text-slate-500"> — {selectedUbicacion.descripcion}</span>
              )}
            </span>
          ) : (
            '—'
          );
        default: {
          const val = fieldValues[col.codigo]?.trim();
          if (col.tipo === 'lista') {
            const display = formatListaValorDisplay(val ?? '', col);
            return display ? (
              <span>{display}</span>
            ) : (
              <span className="text-slate-400 italic">Sin valor</span>
            );
          }
          return val ? (
            <span className={col.codigo === 'codigo_interno' ? 'font-mono' : ''}>{val}</span>
          ) : (
            <span className="text-slate-400 italic">Sin valor</span>
          );
        }
      }
    },
    [fieldValues, selectedEstado, selectedSku, selectedUbicacion]
  );

  const resetDatos = () => {
    setSkuId(0);
    setEstadoId(0);
    setUbicacionId(0);
    setFieldValues(initAltaFieldValues(altaFields));
  };

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
    setLoteErrores([]);
  };

  const resetFormData = () => {
    setTidsLote((prev) => {
      if (prev.length) void forgetTids(prev);
      return [];
    });
    setActiveStep(1);
    setConfirmChecked(false);
    setLoteInput('');
    resetDatos();
  };

  const resetWizard = () => {
    resetFormData();
    clearFeedback();
  };

  const handleCancelAlta = () => {
    if (submitting) return;
    resetWizard();
    focusTidInput();
  };

  const canCancelAlta =
    !submitting &&
    (activeStep > 1 ||
      tidsLote.length > 0 ||
      loteInput.trim().length > 0 ||
      skuId > 0 ||
      estadoId > 0 ||
      ubicacionId > 0 ||
      Object.values(fieldValues).some((v) => v?.trim()) ||
      loteErrores.length > 0 ||
      Boolean(error) ||
      Boolean(success));

  const goToStep = (step: number) => {
    if (step > maxReachableStep) return;
    setActiveStep(step);
    clearFeedback();
  };

  const confirmTagsStep = () => {
    if (!tagsReady) {
      setError('Agregá al menos una etiqueta.');
      return;
    }
    clearFeedback();
    setActiveStep(2);
  };

  const confirmDatosStep = () => {
    const missing = getCamposObligatoriosAltaFaltantes(columnasCatalogo, {
      skuId,
      estadoId,
      ubicacionId,
      fieldValues,
    });
    if (missing.length > 0) {
      setError(`Completá los campos obligatorios: ${missing.join(', ')}.`);
      return;
    }
    clearFeedback();
    setActiveStep(3);
  };

  const addLoteTidsFromInput = (incoming: string[]) => {
    const { merged, added } = mergeTids(tidsLote, incoming);
    setTidsLote(merged);
    if (added > 0) clearFeedback();
    return added;
  };

  const handleAddLoteInput = () => {
    const parsed = parseTidsFromText(loteInput);
    if (parsed.length === 0) return;
    addLoteTidsFromInput(parsed);
    setLoteInput('');
    focusTidInput();
  };

  const handleSubmit = async () => {
    if (!confirmChecked) return;
    clearFeedback();
    if (tidsLote.length === 0) {
      setError('Agregá al menos una etiqueta.');
      setActiveStep(1);
      focusTidInput();
      return;
    }
    setSubmitting(true);
    try {
      const { epc: _epc, ...common } = buildPayload(tidsLote[0]);
      const result = await api.createActivosLote({
        epcs: tidsLote,
        ...common,
      });
      const creados = result.creados?.length ?? result.total;
      setRegistradosSesion((n) => n + creados);
      onCreated();
      void loadHistorialCargas();
      if (result.errores.length > 0) {
        setSuccess(null);
        setError(result.mensaje);
        setLoteErrores(result.errores);
        setTidsLote(result.errores.map((e) => e.epc));
        setActiveStep(1);
        setConfirmChecked(false);
      } else {
        resetFormData();
        setLoteErrores([]);
        setError(null);
        setSuccess(result.mensaje);
      }
    } catch (err) {
      const errores =
        err &&
        typeof err === 'object' &&
        'errores' in err &&
        Array.isArray((err as { errores?: unknown }).errores)
          ? (err as { errores: { epc: string; error: string }[] }).errores
          : null;
      setSuccess(null);
      setError(err instanceof Error ? err.message : 'Error al registrar');
      if (errores && errores.length > 0) {
        setLoteErrores(errores);
        setTidsLote(errores.map((e) => e.epc));
        setActiveStep(1);
        setConfirmChecked(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'w-full py-2.5 px-3.5 border border-slate-200 rounded-lg text-sm font-form bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-shadow';
  const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5';

  const stepMeta = WIZARD_STEPS[activeStep - 1];

  const footerActions = (back?: { label: string; onClick: () => void }, next?: ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {back ? (
          <button
            type="button"
            onClick={back.onClick}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            <ArrowLeft size={15} />
            {back.label}
          </button>
        ) : null}
        <button
          type="button"
          disabled={!canCancelAlta}
          onClick={handleCancelAlta}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-35 disabled:pointer-events-none cursor-pointer"
        >
          <Ban size={14} />
          Cancelar
        </button>
      </div>
      {next}
    </div>
  );

  const primaryBtn =
    'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-40 border-0';

  const renderStepBody = (step: number) => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Tag
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  ref={tidInputRef}
                  disabled={submitting}
                  value={loteInput}
                  onChange={(e) => setLoteInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLoteInput();
                    }
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text');
                    const parsed = parseTidsFromText(text);
                    if (parsed.length > 1) {
                      e.preventDefault();
                      addLoteTidsFromInput(parsed);
                      setLoteInput('');
                    }
                  }}
                  placeholder="Escanee con el R3 o escriba el TID…"
                  className={`${fieldClass} pl-10 font-mono`}
                />
              </div>
              <button
                type="button"
                disabled={submitting || !loteInput.trim()}
                onClick={handleAddLoteInput}
                className="shrink-0 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-lg text-sm font-semibold cursor-pointer border-0"
              >
                Agregar
              </button>
            </div>

            {tidsLote.length > 0 ? (
              <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50/40">
                <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-white border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-600">
                    {tidsLote.length} etiqueta{tidsLote.length === 1 ? '' : 's'} en el lote
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const all = [...tidsLote];
                      setTidsLote([]);
                      void forgetTids(all);
                    }}
                    className="text-xs text-slate-400 hover:text-red-600 font-medium cursor-pointer bg-transparent border-0"
                  >
                    Eliminar todas
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white">
                  {tidsLote.map((t, i) => (
                    <div
                      key={t}
                      className="flex items-center justify-between gap-2 px-3.5 py-2 hover:bg-slate-50 group text-sm"
                    >
                      <span className="font-mono text-slate-800 truncate min-w-0">
                        <span className="text-slate-400 mr-2 tabular-nums">{i + 1}.</span>
                        {t}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeLoteTid(t)}
                        className="p-1 text-slate-300 hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer bg-transparent border-0 shrink-0"
                        aria-label="Quitar etiqueta"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center">
                <Tag size={22} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500 m-0">Todavía no hay etiquetas en el lote</p>
                <p className="text-xs text-slate-400 m-0 mt-1">
                  Conectá el R3 o cargá TIDs manualmente
                </p>
              </div>
            )}
          </div>
        );

      case 2:
        if (!tagsReady) {
          return <p className="text-sm text-slate-400 m-0">Completá las etiquetas en el paso anterior.</p>;
        }
        if (columnasLoading) {
          return (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-10">
              <Loader2 size={16} className="animate-spin shrink-0" />
              Cargando propiedades del activo…
            </div>
          );
        }
        return (
          <ActivoAltaFields
            fields={altaFields}
            skuId={skuId}
            estadoId={estadoId}
            ubicacionId={ubicacionId}
            fieldValues={fieldValues}
            skus={skus}
            estados={estados}
            ubicaciones={ubicaciones}
            disabled={submitting}
            onSkuId={handleSkuChange}
            onEstadoId={setEstadoId}
            onUbicacionId={setUbicacionId}
            onFieldValue={(codigo, value) =>
              setFieldValues((prev) => ({ ...prev, [codigo]: value }))
            }
            fieldClass={fieldClass}
            labelClass={labelClass}
          />
        );

      case 3:
        return (
          <div className="space-y-4">
            <section className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide m-0">
                  Etiquetas RFID
                </h3>
                <span className="text-xs font-semibold text-slate-700 tabular-nums">
                  {tidsLote.length}
                </span>
              </div>
              <ul className="m-0 p-0 list-none max-h-40 overflow-y-auto divide-y divide-slate-100">
                {tidsLote.map((t, i) => (
                  <li key={t} className="px-3.5 py-2 font-mono text-xs text-slate-700 flex gap-2">
                    <span className="text-slate-400 shrink-0 tabular-nums">{i + 1}.</span>
                    <span className="break-all">{t}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide m-0">
                  Propiedades del activo
                </h3>
              </div>
              <dl className="px-3.5 m-0">
                {altaFields.length === 0 ? (
                  <SummaryRow label="Propiedades" value="Valores por defecto del sistema" />
                ) : (
                  altaFields.map((col) => (
                    <SummaryRow
                      key={col.codigo}
                      label={col.etiqueta}
                      value={getFieldDisplayValue(col)}
                    />
                  ))
                )}
              </dl>
            </section>

            <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50/80 cursor-pointer has-checked:border-emerald-400 has-checked:bg-emerald-50/60">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-sm text-slate-700 leading-snug">
                <strong className="text-slate-900">Confirmo el alta.</strong> Autorizo el registro
                de {tidsLote.length} activo{tidsLote.length === 1 ? '' : 's'} en el inventario.
              </span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  const renderStepFooter = (step: number) => {
    switch (step) {
      case 1:
        return footerActions(
          undefined,
          <button
            type="button"
            disabled={!tagsReady}
            onClick={confirmTagsStep}
            className={`${primaryBtn} bg-blue-600 hover:bg-blue-700 text-white`}
          >
            Continuar
            <ArrowRight size={15} />
          </button>
        );
      case 2:
        return footerActions(
          { label: 'Etiquetas', onClick: () => setActiveStep(1) },
          <button
            type="button"
            onClick={confirmDatosStep}
            className={`${primaryBtn} bg-blue-600 hover:bg-blue-700 text-white`}
          >
            Ir a confirmación
            <ArrowRight size={15} />
          </button>
        );
      case 3:
        return footerActions(
          { label: 'Datos', onClick: () => setActiveStep(2) },
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className={`${primaryBtn} bg-emerald-600 hover:bg-emerald-700 text-white`}
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Registrando…
              </>
            ) : (
              <>
                <ShieldCheck size={15} />
                Confirmar alta
              </>
            )}
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f1f5f9]">
      <div className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 m-0 tracking-tight">Agregar activos</h1>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              Alta por lote · paso {activeStep} de {WIZARD_STEPS.length}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {registradosSesion > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                <Check size={12} />
                {registradosSesion} en esta sesión
              </span>
            )}
            {canCancelAlta && (
              <button
                type="button"
                onClick={handleCancelAlta}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                <Ban size={12} />
                Cancelar alta
              </button>
            )}
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-5 md:px-8 pb-3">
          <WizardStepper
            current={activeStep}
            maxReachable={maxReachableStep}
            onStepClick={goToStep}
          />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 md:px-8 py-5 md:py-6 space-y-5">
        <FeedbackBanner
          error={error}
          success={success}
          loteErrores={loteErrores}
          onDismiss={clearFeedback}
          onLoadAnother={() => {
            clearFeedback();
            focusTidInput();
          }}
          onGoToInventario={onGoToInventario}
        />

        <div className="flex flex-col lg:flex-row gap-5 items-start">
          <div className="flex-1 min-w-0 w-full">
            <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-base font-bold text-slate-900 m-0">{stepMeta.short}</h2>
                <p className="text-sm text-slate-500 m-0 mt-0.5">
                  {activeStep === 1 &&
                    'Agregá una o más etiquetas que compartirán los mismos datos de activo.'}
                  {activeStep === 2 &&
                    'Completá SKU, estado, ubicación y las propiedades requeridas.'}
                  {activeStep === 3 && 'Revisá el resumen y confirmá el registro en inventario.'}
                </p>
              </div>

              <div className="px-5 py-5">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={PANEL_TRANSITION}
                  >
                    {renderStepBody(activeStep)}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/80">
                {renderStepFooter(activeStep)}
              </div>
            </section>
          </div>

          <div className="w-full lg:w-72 shrink-0 lg:sticky lg:top-[7.5rem]">
            <R3ReaderSidebar
              status={r3Status}
              busy={r3Busy}
              lastEpc={lastEpc}
              lastReadAt={lastReadAt}
              power={power}
              onPowerChange={handlePowerChange}
              onConnect={() => void connect().catch(() => undefined)}
              onDisconnect={() => void disconnect()}
              onRefresh={() => void refreshStatus()}
            />
          </div>
        </div>

        <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <History size={15} className="text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900 m-0">Historial de cargas</h2>
          </div>
          {historialLoading ? (
            <p className="px-5 py-5 text-sm text-slate-400 m-0 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              Cargando historial…
            </p>
          ) : historialCargas.length === 0 ? (
            <p className="px-5 py-5 text-sm text-slate-400 m-0">
              Todavía no hay altas por lote registradas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-bold text-slate-500 uppercase tracking-wide bg-slate-50">
                    <th className="px-5 py-2.5 font-bold">Fecha</th>
                    <th className="px-5 py-2.5 font-bold">Hora</th>
                    <th className="px-5 py-2.5 font-bold">Usuario</th>
                    <th className="px-5 py-2.5 font-bold text-right">Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {historialCargas.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-5 py-2.5 text-slate-700 whitespace-nowrap">
                        {formatFecha(row.fecha)}
                      </td>
                      <td className="px-5 py-2.5 text-slate-700 font-mono text-xs whitespace-nowrap">
                        {formatHora(row.fecha)}
                      </td>
                      <td className="px-5 py-2.5 text-slate-800">{row.usuarioNombre}</td>
                      <td className="px-5 py-2.5 text-right font-semibold text-slate-900 tabular-nums">
                        {row.cantidad}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
