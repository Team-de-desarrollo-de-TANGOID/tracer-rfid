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
} from 'lucide-react';
import { api } from '../api/client';
import ActivoAltaFields from './ActivoAltaFields';
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

interface Props {
  skus: Sku[];
  estados: Estado[];
  ubicaciones: Ubicacion[];
  columnasConfig?: InventarioColumnasConfig | null;
  demoMode?: boolean;
  onCreated: () => void;
  onGoToInventario: () => void;
}

const WIZARD_STEPS = [
  { id: 1, label: 'Etiquetas', short: 'Etiquetas RFID' },
  { id: 2, label: 'Datos', short: 'Datos del activo' },
  { id: 3, label: 'Confirmar', short: 'Confirmar alta' },
] as const;

const PANEL_TRANSITION = { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const };

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
    <div className="flex items-center gap-0 mb-6">
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
              className={`flex flex-col items-center gap-1.5 min-w-0 group ${
                reachable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <span
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                  done
                    ? 'bg-emerald-500 text-white group-hover:ring-4 group-hover:ring-emerald-100'
                    : active
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : reachable
                        ? 'bg-slate-300 text-slate-600 group-hover:bg-slate-400'
                        : 'bg-slate-200 text-slate-400'
                }`}
              >
                {done ? <Check size={15} strokeWidth={3} /> : step.id}
              </span>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide truncate max-w-[5rem] text-center ${
                  active ? 'text-blue-700' : done ? 'text-emerald-700' : 'text-slate-400'
                }`}
              >
                {step.label}
              </span>
            </button>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${
                  step.id < current ? 'bg-emerald-400' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-3 border-b border-slate-100 last:border-0">
      <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0 sm:w-36">
        {label}
      </dt>
      <dd className="text-sm text-slate-800 m-0 min-w-0 flex-1">{value}</dd>
    </div>
  );
}

function PanelCard({
  title,
  subtitle,
  children,
  footer,
  contentClassName = 'max-w-xl',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div className="flex flex-col bg-white border border-[#e2e8f0] rounded-xl shadow-sm">
      <div className="px-6 py-5 border-b border-slate-100 shrink-0 text-center">
        <h2 className="text-lg font-bold text-slate-900 m-0">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 m-0 mt-1">{subtitle}</p>}
      </div>
      <div className="p-6 flex justify-center overflow-visible">
        <div className={`w-full ${contentClassName} mx-auto`}>{children}</div>
      </div>
      {footer && (
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">{footer}</div>
      )}
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

  const resetWizard = () => {
    setActiveStep(1);
    setConfirmChecked(false);
    setTidsLote([]);
    setLoteInput('');
    clearFeedback();
    resetDatos();
  };

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

  const addLoteTids = (incoming: string[]) => {
    const { merged, added } = mergeTids(tidsLote, incoming);
    setTidsLote(merged);
    if (added > 0) clearFeedback();
    return added;
  };

  const handleAddLoteInput = () => {
    const parsed = parseTidsFromText(loteInput);
    if (parsed.length === 0) return;
    addLoteTids(parsed);
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
      setSuccess(result.mensaje);
      onCreated();
      if (result.errores.length > 0) {
        setLoteErrores(result.errores);
        setTidsLote(result.errores.map((e) => e.epc));
        setActiveStep(1);
        setConfirmChecked(false);
      } else {
        resetWizard();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'w-full py-2.5 px-3.5 border border-slate-200 rounded-xl text-sm font-form bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-shadow';
  const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5';

  const navFooter = (back?: { label: string; onClick: () => void }, next?: ReactNode) => (
    <div className="flex flex-wrap gap-3 justify-between items-center">
      {back ? (
        <button
          type="button"
          onClick={back.onClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white cursor-pointer"
        >
          <ArrowLeft size={16} />
          {back.label}
        </button>
      ) : (
        <span />
      )}
      {next}
    </div>
  );

  const buildStepPanel = (step: number) => {
    switch (step) {
      case 1:
        return (
          <PanelCard
            title={WIZARD_STEPS[0].short}
            subtitle="Agregá una o más etiquetas con los mismos datos de activo"
            footer={navFooter(
              undefined,
              <button
                type="button"
                disabled={!tagsReady}
                onClick={confirmTagsStep}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer"
              >
                Continuar
                <ArrowRight size={16} />
              </button>
            )}
          >
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
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
                        addLoteTids(parsed);
                        setLoteInput('');
                      }
                    }}
                    placeholder="Ingresá el TID y presioná Agregar…"
                    className={`${fieldClass} pl-10 font-mono`}
                  />
                </div>
                <button
                  type="button"
                  disabled={submitting || !loteInput.trim()}
                  onClick={handleAddLoteInput}
                  className="shrink-0 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-xl text-sm font-semibold cursor-pointer"
                >
                  Agregar
                </button>
              </div>
              {tidsLote.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {tidsLote.map((t, i) => (
                    <div
                      key={t}
                      className="flex items-center justify-between px-4 py-2 hover:bg-slate-50 group text-sm"
                    >
                      <span className="font-mono text-slate-800 truncate">
                        <span className="text-slate-400 mr-2">{i + 1}.</span>
                        {t}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTidsLote((prev) => prev.filter((x) => x !== t))}
                        className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center m-0 py-6 border border-dashed border-slate-200 rounded-xl">
                  Todavía no hay etiquetas cargadas
                </p>
              )}
            </div>
          </PanelCard>
        );

      case 2:
        return (
          <PanelCard
            contentClassName="max-w-2xl"
            title={WIZARD_STEPS[1].short}
            subtitle="Completá SKU, estado, ubicación y demás propiedades del activo"
            footer={navFooter(
              { label: 'Etiquetas', onClick: () => setActiveStep(1) },
              <button
                type="button"
                onClick={confirmDatosStep}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold cursor-pointer"
              >
                Ir a confirmación
                <ArrowRight size={16} />
              </button>
            )}
          >
            {!tagsReady ? (
              <p className="text-sm text-slate-400 m-0 text-center">
                Completá las etiquetas en el paso anterior.
              </p>
            ) : columnasLoading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin shrink-0" />
                Cargando propiedades del activo…
              </div>
            ) : (
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
            )}
          </PanelCard>
        );

      case 3:
        return (
          <PanelCard
            contentClassName="max-w-2xl"
            title={WIZARD_STEPS[2].short}
            subtitle="Revisá todos los datos antes de registrar en el inventario"
            footer={navFooter(
              { label: 'Datos del activo', onClick: () => setActiveStep(2) },
              <button
                type="button"
                disabled={!canSubmit}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-sm font-bold cursor-pointer shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Registrando…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Confirmar alta
                  </>
                )}
              </button>
            )}
          >
            <div className="space-y-6">
              <section className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide m-0">
                    Etiquetas RFID
                  </h3>
                </div>
                <dl className="px-4 m-0">
                  <SummaryRow
                    label="Cantidad"
                    value={`${tidsLote.length} etiqueta${tidsLote.length === 1 ? '' : 's'}`}
                  />
                  <SummaryRow
                    label="Listado"
                    value={
                      <ul className="m-0 p-0 list-none space-y-1 max-h-36 overflow-y-auto">
                        {tidsLote.map((t, i) => (
                          <li key={t} className="font-mono text-xs text-slate-700 flex gap-2">
                            <span className="text-slate-400 shrink-0">{i + 1}.</span>
                            <span className="break-all">{t}</span>
                          </li>
                        ))}
                      </ul>
                    }
                  />
                </dl>
              </section>

              <section className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide m-0">
                    Propiedades del activo
                  </h3>
                </div>
                <dl className="px-4 m-0">
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

              <label className="flex items-start gap-3 p-4 rounded-xl border-2 border-slate-200 bg-slate-50/80 cursor-pointer has-checked:border-emerald-300 has-checked:bg-emerald-50/50">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <span className="text-sm text-slate-700">
                  <strong className="text-slate-900">Confirmo el alta.</strong> Revisé los datos y
                  autorizo el registro de {tidsLote.length} activo
                  {tidsLote.length === 1 ? '' : 's'} en el inventario.
                </span>
              </label>

              {!confirmChecked && (
                <p className="text-xs text-slate-500 m-0 flex items-center justify-center gap-1.5">
                  <AlertCircle size={13} />
                  Marcá la casilla de confirmación para habilitar el registro.
                </p>
              )}
            </div>
          </PanelCard>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8fafc]">
      <header className="px-8 py-5 bg-white border-b border-[#e2e8f0] shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0f172a] m-0">Agregar activos</h1>
            <p className="text-[13px] text-[#64748b] mt-1 m-0">
              Completá el asistente paso a paso. Revisá todo antes de confirmar el alta.
            </p>
          </div>
          {registradosSesion > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              <Check size={13} />
              {registradosSesion} en esta sesión
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col p-6 md:p-8 overflow-hidden">
        <div className="max-w-4xl w-full mx-auto flex flex-col flex-1 min-h-0">
          <WizardStepper
            current={activeStep}
            maxReachable={maxReachableStep}
            onStepClick={goToStep}
          />

          {(error || success || loteErrores.length > 0) && (
            <div className="space-y-2 mb-4 shrink-0">
              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex gap-3 items-start">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <p className="m-0">{error}</p>
                </div>
              )}
              {success && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-sm flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-3 items-center">
                    <Check size={18} className="shrink-0" />
                    <p className="m-0 font-medium">{success}</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={resetWizard}
                      className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Cargar otro
                    </button>
                    <button
                      type="button"
                      onClick={onGoToInventario}
                      className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                    >
                      Ver inventario
                    </button>
                  </div>
                </div>
              )}
              {loteErrores.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-amber-900 text-sm">
                  <p className="font-semibold m-0 mb-2">
                    {loteErrores.length} etiqueta{loteErrores.length === 1 ? '' : 's'} con error:
                  </p>
                  <ul className="m-0 pl-4 space-y-1 list-disc font-mono text-xs">
                    {loteErrores.map((item) => (
                      <li key={item.epc}>
                        {item.epc} — {item.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={PANEL_TRANSITION}
              >
                {buildStepPanel(activeStep)}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
