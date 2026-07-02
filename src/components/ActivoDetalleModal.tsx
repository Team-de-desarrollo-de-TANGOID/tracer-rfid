import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  X,
  Package,
  History,
  ArrowRightLeft,
  Tag,
  MapPin,
  Calendar,
  User,
  Loader2,
  CircleDot,
  Pencil,
  Check,
} from 'lucide-react';
import { api } from '../api/client';
import { getAllEditableColumns } from './ActivoTableCell';
import { activoPermiteEditarMotivoBaja, estadoRequiereMotivoBaja } from '../utils/activoEdit';
import { esEstadoDeBaja, estadoEstaHabilitado } from '../utils/estadoOperativo';
import { getActivoPropiedadValor } from '../utils/activoProps';
import { formatListaValorDisplay } from '../utils/propiedadLista';
import PropiedadListaField from './PropiedadListaField';
import type { Activo, ColumnaTabla, Estado, EventoActivo, InventarioColumnasConfig, Ubicacion } from '../types';

type TabId = 'datos' | 'historial' | 'movimientos';

interface Props {
  activo: Activo | null;
  open: boolean;
  onClose: () => void;
  estados?: Estado[];
  ubicaciones?: Ubicacion[];
  columnasConfig?: InventarioColumnasConfig | null;
  canEdit?: boolean;
  canChangeEstado?: boolean;
  onUpdateActivo?: (
    id: number,
    body: Partial<{
      descripcion: string;
      ubicacionId: number;
      codigoInterno: string;
      motivoBaja: string;
      propiedadesExtra: Record<string, string>;
    }>
  ) => Promise<void>;
  onUpdateEstado?: (id: number, estadoId: number, motivoBaja?: string) => Promise<void>;
  onSaved?: () => void;
}

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'datos', label: 'Datos', icon: <Package size={15} /> },
  { id: 'historial', label: 'Historial', icon: <History size={15} /> },
  { id: 'movimientos', label: 'Movimientos', icon: <ArrowRightLeft size={15} /> },
];

const TIPO_LABELS: Record<string, string> = {
  ALTA: 'Alta en sistema',
  CAMBIO_ESTADO: 'Cambio de estado',
  CAMBIO_UBICACION: 'Cambio de ubicación',
  BAJA: 'Baja del activo',
  ELIMINACION: 'Eliminación',
  SYNC_ENVIADO: 'Sincronización con lector',
};

const TIPO_COLORS: Record<string, string> = {
  ALTA: 'bg-emerald-100 text-emerald-700',
  CAMBIO_ESTADO: 'bg-blue-100 text-blue-700',
  CAMBIO_UBICACION: 'bg-violet-100 text-violet-700',
  BAJA: 'bg-amber-100 text-amber-700',
  ELIMINACION: 'bg-red-100 text-red-700',
  SYNC_ENVIADO: 'bg-slate-100 text-slate-700',
};

const fieldClass =
  'w-full py-2 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

function labelTipo(tipo: string) {
  return TIPO_LABELS[tipo] ?? tipo.replace(/_/g, ' ');
}

export default function ActivoDetalleModal({
  activo,
  open,
  onClose,
  estados = [],
  ubicaciones = [],
  columnasConfig = null,
  canEdit = false,
  canChangeEstado = false,
  onUpdateActivo,
  onUpdateEstado,
  onSaved,
}: Props) {
  const [tab, setTab] = useState<TabId>('datos');
  const [eventos, setEventos] = useState<EventoActivo[]>([]);
  const [loading, setLoading] = useState(false);
  const [slideDirection, setSlideDirection] = useState(1);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [estadoId, setEstadoId] = useState(0);
  const [ubicacionId, setUbicacionId] = useState(0);
  const [descripcion, setDescripcion] = useState('');
  const [codigoInterno, setCodigoInterno] = useState('');
  const [motivoBaja, setMotivoBaja] = useState('');
  const [customProps, setCustomProps] = useState<Record<string, string>>({});

  const allEditableFields = useMemo(
    () => getAllEditableColumns(columnasConfig?.columnas),
    [columnasConfig]
  );
  const canFullEdit =
    (canEdit || canChangeEstado) &&
    allEditableFields.length > 0 &&
    onUpdateActivo &&
    onUpdateEstado;

  const changeTab = (next: TabId) => {
    const prevIdx = TABS.findIndex((t) => t.id === tab);
    const nextIdx = TABS.findIndex((t) => t.id === next);
    setSlideDirection(nextIdx >= prevIdx ? 1 : -1);
    setTab(next);
    setEditing(false);
  };

  useEffect(() => {
    if (!open || !activo) {
      setEventos([]);
      setTab('datos');
      setSlideDirection(1);
      setEditing(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .getHistorial(activo.id)
      .then((h) => {
        if (!cancelled) setEventos(h);
      })
      .catch(() => {
        if (!cancelled) setEventos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, activo?.id]);

  useEffect(() => {
    if (!activo) return;
    setEstadoId(activo.estadoId);
    setUbicacionId(activo.ubicacionId ?? ubicaciones[0]?.id ?? 0);
    setDescripcion(activo.descripcion ?? '');
    setCodigoInterno(activo.codigoInterno ?? '');
    setMotivoBaja(activo.motivoBaja ?? '');
    setCustomProps({ ...(activo.propiedadesExtra ?? {}) });
  }, [activo, ubicaciones]);

  const movimientos = useMemo(
    () =>
      eventos.filter(
        (e) => e.tipo === 'CAMBIO_UBICACION' || (e.tipo === 'ALTA' && e.ubicacionNueva)
      ),
    [eventos]
  );

  const startEditing = () => {
    if (!activo) return;
    setEstadoId(activo.estadoId);
    setUbicacionId(activo.ubicacionId ?? ubicaciones[0]?.id ?? 0);
    setDescripcion(activo.descripcion ?? '');
    setCodigoInterno(activo.codigoInterno ?? '');
    setMotivoBaja(activo.motivoBaja ?? '');
    setCustomProps({ ...(activo.propiedadesExtra ?? {}) });
    setEditing(true);
  };

  const handleSaveFull = async () => {
    if (!activo || !onUpdateActivo || !onUpdateEstado) return;
    setSaving(true);
    try {
      const fieldCodes = new Set(allEditableFields.map((f) => f.codigo));
      const nuevoEstado = estados.find((e) => e.id === estadoId);
      const cambiandoABaja =
        fieldCodes.has('estado') &&
        canChangeEstado &&
        estadoId !== activo.estadoId &&
        estadoRequiereMotivoBaja(nuevoEstado);

      if (fieldCodes.has('estado') && canChangeEstado && estadoId !== activo.estadoId) {
        await onUpdateEstado(
          activo.id,
          estadoId,
          cambiandoABaja ? motivoBaja.trim() || undefined : undefined
        );
      }
      const patch: Parameters<NonNullable<Props['onUpdateActivo']>>[1] = {};
      if (fieldCodes.has('ubicacion') && canEdit && ubicacionId !== activo.ubicacionId) {
        patch.ubicacionId = ubicacionId;
      }
      if (fieldCodes.has('descripcion') && canEdit) patch.descripcion = descripcion;
      if (fieldCodes.has('codigo_interno') && canEdit) patch.codigoInterno = codigoInterno;
      if (
        fieldCodes.has('motivo_baja') &&
        canEdit &&
        activoPermiteEditarMotivoBaja(activo) &&
        motivoBaja !== (activo.motivoBaja ?? '')
      ) {
        patch.motivoBaja = motivoBaja;
      }
      const customCols = allEditableFields.filter((f) => f.esCustom);
      const propPatch: Record<string, string> = {};
      for (const col of customCols) {
        const prev = activo.propiedadesExtra?.[col.codigo] ?? '';
        const next = customProps[col.codigo] ?? '';
        if (next !== prev) propPatch[col.codigo] = next;
      }
      if (Object.keys(propPatch).length > 0) {
        patch.propiedadesExtra = propPatch;
      }
      if (Object.keys(patch).length > 0) {
        await onUpdateActivo(activo.id, patch);
      }
      onSaved?.();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !activo) return null;

  const tid = activo.tid ?? activo.epc ?? '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 m-0">Detalle del activo</h2>
            <p className="text-xs font-mono text-slate-500 m-0 mt-1 truncate">{tid}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-4 gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => changeTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 -mb-px cursor-pointer whitespace-nowrap transition-all duration-200 ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.icon}
              {t.label}
              {t.id === 'historial' && eventos.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-slate-100 text-slate-600 font-bold">
                  {eventos.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="h-[min(52vh,520px)] overflow-y-auto p-6">
          <TabPanel tabKey={loading && tab !== 'datos' ? `loading-${tab}` : tab} direction={slideDirection}>
            {loading && tab !== 'datos' ? (
              <div className="h-full min-h-[min(46vh,480px)] flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 size={28} className="animate-spin text-blue-400" />
                <p className="text-sm m-0">Cargando información…</p>
              </div>
            ) : (
              <>
                {tab === 'datos' && (
                  <TabDatos
                    activo={activo}
                    tid={tid}
                    editing={editing}
                    canFullEdit={!!canFullEdit}
                    allEditableFields={allEditableFields}
                    estados={estados}
                    ubicaciones={ubicaciones}
                    canEdit={canEdit}
                    canChangeEstado={canChangeEstado}
                    estadoId={estadoId}
                    ubicacionId={ubicacionId}
                    descripcion={descripcion}
                    codigoInterno={codigoInterno}
                    motivoBaja={motivoBaja}
                    customProps={customProps}
                    saving={saving}
                    onStartEdit={startEditing}
                    onCancelEdit={() => setEditing(false)}
                    onSave={handleSaveFull}
                    onEstadoId={setEstadoId}
                    onUbicacionId={setUbicacionId}
                    onDescripcion={setDescripcion}
                    onCodigoInterno={setCodigoInterno}
                    onMotivoBaja={setMotivoBaja}
                    onCustomProp={(codigo, value) =>
                      setCustomProps((prev) => ({ ...prev, [codigo]: value }))
                    }
                  />
                )}
                {tab === 'historial' && <TabHistorial eventos={eventos} />}
                {tab === 'movimientos' && <TabMovimientos movimientos={movimientos} />}
              </>
            )}
          </TabPanel>
        </div>
      </div>
    </div>
  );
}

function TabPanel({
  tabKey,
  direction,
  children,
}: {
  tabKey: string;
  direction: number;
  children: ReactNode;
}) {
  return (
    <div
      key={tabKey}
      className="animate-tab-in min-h-[min(46vh,480px)]"
      style={{ ['--tab-from-x' as string]: `${direction * 14}px` }}
    >
      {children}
    </div>
  );
}

function TabDatos({
  activo,
  tid,
  editing,
  canFullEdit,
  allEditableFields,
  estados,
  ubicaciones,
  canEdit,
  canChangeEstado,
  estadoId,
  ubicacionId,
  descripcion,
  codigoInterno,
  motivoBaja,
  customProps,
  saving,
  onStartEdit,
  onCancelEdit,
  onSave,
  onEstadoId,
  onUbicacionId,
  onDescripcion,
  onCodigoInterno,
  onMotivoBaja,
  onCustomProp,
}: {
  activo: Activo;
  tid: string;
  editing: boolean;
  canFullEdit: boolean;
  allEditableFields: ColumnaTabla[];
  estados: Estado[];
  ubicaciones: Ubicacion[];
  canEdit: boolean;
  canChangeEstado: boolean;
  estadoId: number;
  ubicacionId: number;
  descripcion: string;
  codigoInterno: string;
  motivoBaja: string;
  customProps: Record<string, string>;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onEstadoId: (v: number) => void;
  onUbicacionId: (v: number) => void;
  onDescripcion: (v: string) => void;
  onCodigoInterno: (v: string) => void;
  onMotivoBaja: (v: string) => void;
  onCustomProp: (codigo: string, value: string) => void;
}) {
  const fieldCodes = new Set(allEditableFields.map((f) => f.codigo));
  const labelClass = 'text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5';
  const nuevoEstado = estados.find((e) => e.id === estadoId);
  const cambiandoABaja =
    fieldCodes.has('estado') &&
    canChangeEstado &&
    estadoId !== activo.estadoId &&
    esEstadoDeBaja(nuevoEstado);
  const showMotivoBaja =
    fieldCodes.has('motivo_baja') &&
    ((canEdit && activoPermiteEditarMotivoBaja(activo)) || cambiandoABaja);

  if (editing) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-500 m-0">
          Edición completa — incluye campos no visibles en la tabla del inventario.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <ReadOnlyField label="TID (RFID)" value={<span className="font-mono">{tid}</span>} icon={<Tag size={14} />} />
          <ReadOnlyField label="SKU" value={activo.sku} icon={<Package size={14} />} />
          {fieldCodes.has('estado') && canChangeEstado && (
            <div className="sm:col-span-2">
              <label className={labelClass}>Estado</label>
              <select value={estadoId} onChange={(e) => onEstadoId(Number(e.target.value))} className={fieldClass}>
                {estados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          {fieldCodes.has('ubicacion') && canEdit && (
            <div>
              <label className={labelClass}>Ubicación</label>
              <select value={ubicacionId} onChange={(e) => onUbicacionId(Number(e.target.value))} className={fieldClass}>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          {fieldCodes.has('descripcion') && canEdit && (
            <div>
              <label className={labelClass}>Descripción</label>
              <input value={descripcion} onChange={(e) => onDescripcion(e.target.value)} className={fieldClass} />
            </div>
          )}
          {fieldCodes.has('codigo_interno') && canEdit && (
            <div>
              <label className={labelClass}>Código interno</label>
              <input
                value={codigoInterno}
                onChange={(e) => onCodigoInterno(e.target.value)}
                className={`${fieldClass} font-mono`}
              />
            </div>
          )}
          {showMotivoBaja && (
            <div className="sm:col-span-2">
              <label className={labelClass}>
                {cambiandoABaja ? 'Motivo de baja (requerido al dar de baja)' : 'Motivo de baja'}
              </label>
              <input value={motivoBaja} onChange={(e) => onMotivoBaja(e.target.value)} className={fieldClass} />
            </div>
          )}
          {allEditableFields
            .filter((f) => f.esCustom && canEdit)
            .map((col) => (
              <div key={col.codigo}>
                <label className={labelClass}>{col.etiqueta}</label>
                {col.tipo === 'lista' ? (
                  <PropiedadListaField
                    col={col}
                    value={customProps[col.codigo] ?? ''}
                    onChange={(v) => onCustomProp(col.codigo, v)}
                  />
                ) : (
                  <input
                    type={col.tipo === 'numero' ? 'number' : col.tipo === 'fecha' ? 'date' : 'text'}
                    value={customProps[col.codigo] ?? ''}
                    onChange={(e) => onCustomProp(col.codigo, e.target.value)}
                    className={fieldClass}
                  />
                )}
              </div>
            ))}
          <ReadOnlyField label="Fecha de registro" value={activo.fecha} icon={<Calendar size={14} />} />
          <ReadOnlyField label="Fecha de baja" value={activo.fechaBaja || '—'} icon={<Calendar size={14} />} />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onCancelEdit} className="px-4 py-2 text-sm text-slate-600 cursor-pointer">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Guardar cambios
          </button>
        </div>
      </div>
    );
  }

  const rows: { label: string; value: ReactNode; icon?: ReactNode }[] = [
    { label: 'TID (RFID)', value: <span className="font-mono">{tid}</span>, icon: <Tag size={14} /> },
    { label: 'SKU', value: activo.sku, icon: <Package size={14} /> },
    {
      label: 'Estado',
      value: (
        <span
          className="inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full"
          style={{ backgroundColor: `${activo.estadoColor}22`, color: activo.estadoColor }}
        >
          {activo.estado}
        </span>
      ),
      icon: <CircleDot size={14} />,
    },
    { label: 'Ubicación', value: activo.ubicacion || '—', icon: <MapPin size={14} /> },
    { label: 'Descripción', value: activo.descripcion || '—' },
    { label: 'Código interno', value: activo.codigoInterno || '—' },
    { label: 'Fecha de registro', value: activo.fecha, icon: <Calendar size={14} /> },
    { label: 'Fecha de baja', value: activo.fechaBaja || '—', icon: <Calendar size={14} /> },
    ...(activo.fechaBaja ? [{ label: 'Motivo de baja', value: activo.motivoBaja || '—' }] : []),
    ...allEditableFields
      .filter((f) => f.esCustom)
      .map((col) => {
        const raw = getActivoPropiedadValor(activo, col);
        const value =
          col.tipo === 'lista' ? formatListaValorDisplay(raw, col) || '—' : raw || '—';
        return { label: col.etiqueta, value };
      }),
    { label: 'Permite salida', value: activo.permiteSalida ? 'Sí' : 'No' },
    {
      label: 'Tipo operativo',
      value: activo.esActivo ? (
        <span className="text-emerald-600 font-semibold">Habilitada</span>
      ) : (
        <span className="text-slate-500 font-semibold">Deshabilitada</span>
      ),
    },
  ];

  return (
    <div>
      {canFullEdit && (
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={onStartEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer text-slate-700"
          >
            <Pencil size={13} />
            Editar registro
          </button>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
              {row.icon}
              {row.label}
            </div>
            <div className="text-sm text-slate-800">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase mb-1">
        {icon}
        {label}
      </div>
      <div className="text-sm text-slate-600">{value}</div>
    </div>
  );
}

function TabHistorial({ eventos }: { eventos: EventoActivo[] }) {
  if (eventos.length === 0) {
    return <EmptyState message="Sin eventos registrados para este activo." />;
  }

  return (
    <div className="space-y-3">
      {eventos.map((ev) => (
        <div key={ev.id} className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <span
              className={`inline-flex px-2 py-0.5 text-[11px] font-bold rounded-md ${TIPO_COLORS[ev.tipo] ?? 'bg-slate-100 text-slate-600'}`}
            >
              {labelTipo(ev.tipo)}
            </span>
            <span className="text-xs text-slate-400 shrink-0">{ev.createdAt}</span>
          </div>

          {ev.estadoAnterior && ev.estadoNuevo && (
            <p className="text-sm text-slate-600 m-0 mt-2">
              Estado: <strong>{ev.estadoAnterior}</strong> → <strong>{ev.estadoNuevo}</strong>
            </p>
          )}
          {ev.estadoNuevo && !ev.estadoAnterior && (
            <p className="text-sm text-slate-600 m-0 mt-2">
              Estado inicial: <strong>{ev.estadoNuevo}</strong>
            </p>
          )}
          {ev.ubicacionAnterior && ev.ubicacionNueva && (
            <p className="text-sm text-slate-600 m-0 mt-1">
              Ubicación: <strong>{ev.ubicacionAnterior}</strong> → <strong>{ev.ubicacionNueva}</strong>
            </p>
          )}
          {ev.ubicacionNueva && !ev.ubicacionAnterior && (
            <p className="text-sm text-slate-600 m-0 mt-1">
              Ubicación: <strong>{ev.ubicacionNueva}</strong>
            </p>
          )}
          {ev.notas && <p className="text-xs text-slate-500 m-0 mt-2 italic">{ev.notas}</p>}

          <div className="flex flex-wrap gap-3 mt-2 text-[11px] text-slate-400">
            {ev.usuarioNombre && (
              <span className="flex items-center gap-1">
                <User size={11} />
                {ev.usuarioNombre}
              </span>
            )}
            <span className="capitalize">Origen: {ev.origen}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabMovimientos({ movimientos }: { movimientos: EventoActivo[] }) {
  if (movimientos.length === 0) {
    return <EmptyState message="Sin movimientos de ubicación registrados." />;
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase">Fecha</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase">Origen</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase w-8" />
            <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase">Destino</th>
            <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase">Usuario</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {movimientos.map((ev) => (
            <tr key={ev.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{ev.createdAt}</td>
              <td className="px-4 py-3 text-slate-600">{ev.ubicacionAnterior || '—'}</td>
              <td className="px-2 py-3 text-slate-300">
                <ArrowRightLeft size={14} />
              </td>
              <td className="px-4 py-3 font-medium text-slate-800">{ev.ubicacionNueva || '—'}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{ev.usuarioNombre || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full min-h-[min(46vh,480px)] flex flex-col items-center justify-center text-slate-400">
      <History size={32} className="mb-3 opacity-40" />
      <p className="text-sm m-0">{message}</p>
    </div>
  );
}
