import { useEffect, useMemo, useState } from 'react';
import { Tag, AlertCircle, Check, ScanLine, Layers, X } from 'lucide-react';
import { api } from '../api/client';
import ScanTidsModal from './ScanTidsModal';
import ActivoAltaFields from './ActivoAltaFields';
import type { ColumnaTabla, Estado, InventarioColumnasConfig, Sku, SidebarTab, Ubicacion } from '../types';
import { estadoEstaHabilitado } from '../utils/estadoOperativo';
import {
  buildCreateActivoPayload,
  getAltaActivoFields,
  initAltaFieldValues,
} from '../utils/activoAlta';

type AltaModo = 'individual' | 'lote';

interface Props {
  skus: Sku[];
  estados: Estado[];
  ubicaciones: Ubicacion[];
  columnasConfig?: InventarioColumnasConfig | null;
  onCreated: () => void;
  setCurrentTab: (tab: SidebarTab) => void;
}

export default function AddAssetView({
  skus,
  estados,
  ubicaciones,
  columnasConfig = null,
  onCreated,
  setCurrentTab,
}: Props) {
  const ubicacionesActivas = ubicaciones.filter((u) => u.activo);

  const [modo, setModo] = useState<AltaModo>('individual');
  const [tid, setTid] = useState('');
  const [tidsLote, setTidsLote] = useState<string[]>([]);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [columnasCatalogo, setColumnasCatalogo] = useState<ColumnaTabla[]>([]);
  const [skuId, setSkuId] = useState(skus[0]?.id ?? 0);
  const [estadoId, setEstadoId] = useState(
    estados.find((e) => estadoEstaHabilitado(e))?.id ?? estados[0]?.id ?? 0
  );
  const [ubicacionId, setUbicacionId] = useState(ubicacionesActivas[0]?.id ?? 0);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const altaFields = useMemo(
    () => getAltaActivoFields(columnasCatalogo),
    [columnasCatalogo]
  );

  useEffect(() => {
    const fromConfig = columnasConfig?.columnas;
    if (fromConfig?.length) {
      setColumnasCatalogo(fromConfig);
      return;
    }
    let cancelled = false;
    api
      .getPropiedadesAlta()
      .then((cols) => {
        if (!cancelled) setColumnasCatalogo(cols);
      })
      .catch(() => {
        if (!cancelled) setColumnasCatalogo([]);
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
    if (skus[0] && !skuId) setSkuId(skus[0].id);
  }, [skus, skuId]);

  useEffect(() => {
    if (!altaFields.some((f) => f.codigo === 'descripcion')) return;
    const sku = skus.find((s) => s.id === skuId);
    if (!sku) return;
    setFieldValues((prev) => {
      if (prev.descripcion) return prev;
      return { ...prev, descripcion: sku.descripcion };
    });
  }, [altaFields, skuId, skus]);

  const handleSkuChange = (id: number) => {
    setSkuId(id);
    const sku = skus.find((s) => s.id === id);
    if (sku && altaFields.some((f) => f.codigo === 'descripcion')) {
      setFieldValues((prev) => ({
        ...prev,
        descripcion: sku.descripcion,
      }));
    }
  };

  const buildPayload = (epc: string) =>
    buildCreateActivoPayload(
      epc,
      skuId,
      estadoId,
      ubicacionId,
      fieldValues,
      columnasCatalogo,
      skus
    );

  const resetForm = () => {
    setFieldValues(initAltaFieldValues(altaFields));
    const sku = skus.find((s) => s.id === skuId);
    if (sku && altaFields.some((f) => f.codigo === 'descripcion')) {
      setFieldValues((prev) => ({ ...prev, descripcion: sku.descripcion }));
    }
  };

  const handleSubmitIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!tid.trim()) {
      setError('El TID de la etiqueta es obligatorio.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createActivo(buildPayload(tid.trim()));
      setSuccess('¡Activo registrado correctamente!');
      onCreated();
      setTimeout(() => {
        setSuccess(null);
        setTid('');
        resetForm();
        setCurrentTab('inventario');
      }, 1200);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al registrar';
      setError(
        msg.includes('Ya existe') || msg.includes('409')
          ? `${msg} Revise el inventario o use otro TID.`
          : msg
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitLote = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (tidsLote.length === 0) {
      setError('Escanee al menos una etiqueta para el lote.');
      return;
    }
    setSubmitting(true);
    try {
      const { epc: _epc, ...common } = buildPayload(tidsLote[0]);
      const result = await api.createActivosLote({
        epcs: tidsLote,
        ...common,
      });
      setSuccess(result.mensaje);
      onCreated();
      setTidsLote([]);
      resetForm();
      if (result.errores.length === 0) {
        setTimeout(() => {
          setSuccess(null);
          setCurrentTab('inventario');
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar el lote');
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass =
    'w-full py-2.5 px-3.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400 transition-shadow';
  const labelClass = 'block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5';

  const datosComunes = (
    <ActivoAltaFields
      fields={altaFields}
      skuId={skuId}
      estadoId={estadoId}
      ubicacionId={ubicacionId}
      fieldValues={fieldValues}
      skus={skus}
      estados={estados}
      ubicaciones={ubicaciones}
      disabled={!!success || submitting}
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <header className="px-8 py-6 bg-white/80 backdrop-blur border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 m-0 tracking-tight">Alta de activo</h1>
          <p className="text-sm text-slate-500 mt-1 m-0">
            Asocie etiquetas RFID (TID) a un SKU — individual o por lote. Ingrese los TID manualmente.
          </p>
        </div>
      </header>

      <div className="p-6 md:p-8 flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setModo('individual')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-all ${
                modo === 'individual'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Individual
            </button>
            <button
              type="button"
              onClick={() => setModo('lote')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer transition-all flex items-center gap-2 ${
                modo === 'lote' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers size={15} />
              Por lote
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex gap-3 items-start">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-800 text-sm flex gap-3 items-center">
              <Check size={18} />
              {success}
            </div>
          )}

          {modo === 'individual' ? (
            <form onSubmit={handleSubmitIndividual} className="space-y-6">
              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
                <h2 className="text-sm font-bold text-slate-800 m-0 flex items-center gap-2">
                  <Tag size={16} className="text-blue-500" />
                  Identificación RFID
                </h2>
                <div>
                  <label className={labelClass}>TID de la etiqueta *</label>
                  <div className="relative">
                    <Tag
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      required
                      disabled={!!success || submitting}
                      value={tid}
                      onChange={(e) => setTid(e.target.value)}
                      placeholder="E280119420000F6A1C5A6014"
                      className={`${fieldClass} pl-10 font-mono`}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2 m-0">
                    Ingrese el TID leído con el lector RFID.
                  </p>
                </div>
              </section>

              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
                <h2 className="text-sm font-bold text-slate-800 m-0 mb-5">Datos del activo</h2>
                {datosComunes}
              </section>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={!!success || submitting}
                  onClick={() => setCurrentTab('inventario')}
                  className="px-6 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!!success || submitting}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 shadow-sm shadow-blue-600/20 transition-colors"
                >
                  {submitting ? 'Registrando…' : 'Registrar activo'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitLote} className="space-y-6">
              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 m-0 flex items-center gap-2">
                      <ScanLine size={16} className="text-blue-500" />
                      Etiquetas del lote
                    </h2>
                    <p className="text-xs text-slate-500 m-0 mt-1">
                      Escanee todas las etiquetas y confirme antes de registrar.
                    </p>
                  </div>
                  {tidsLote.length > 0 && (
                    <span className="shrink-0 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-bold font-mono">
                      {tidsLote.length} TID{tidsLote.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setScanModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 shadow-sm shadow-blue-600/20 transition-colors"
                >
                  <ScanLine size={18} />
                  Agregar etiquetas
                </button>

                {tidsLote.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                      {tidsLote.map((t, i) => (
                        <div
                          key={t}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs text-slate-400 font-mono w-6">{i + 1}</span>
                            <span className="font-mono text-sm text-slate-800 truncate">{t}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTidsLote((prev) => prev.filter((x) => x !== t))}
                            className="p-1.5 text-slate-300 hover:text-red-500 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs text-slate-500">
                        {tidsLote.length} etiqueta{tidsLote.length !== 1 ? 's' : ''} listas
                      </span>
                      <button
                        type="button"
                        onClick={() => setTidsLote([])}
                        className="text-xs text-red-600 hover:underline cursor-pointer"
                      >
                        Vaciar lista
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
                <h2 className="text-sm font-bold text-slate-800 m-0 mb-5">
                  Datos comunes del lote
                </h2>
                {datosComunes}
              </section>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setCurrentTab('inventario')}
                  className="px-6 py-3 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || tidsLote.length === 0}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 shadow-sm shadow-blue-600/20 transition-colors"
                >
                  {submitting
                    ? 'Registrando lote…'
                    : `Registrar lote (${tidsLote.length} etiqueta${tidsLote.length !== 1 ? 's' : ''})`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <ScanTidsModal
        open={scanModalOpen}
        mockEnabled={false}
        onClose={() => setScanModalOpen(false)}
        onConfirm={(tids) => setTidsLote(tids)}
      />
    </div>
  );
}
