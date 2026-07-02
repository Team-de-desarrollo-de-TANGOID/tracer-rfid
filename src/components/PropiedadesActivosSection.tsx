import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import {
  ListTree,
  Lock,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  X,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api/client';
import type { ColumnaTabla, TipoPropiedad } from '../types';
import { ALTA_EXCLUDED_CODIGOS } from '../utils/activoAlta';
import { TIPOS_PROPIEDAD, getTipoPropiedadMeta } from '../constants/propiedadTipos';
import { parseListaOpciones } from '../utils/propiedadLista';

interface Props {
  onChanged: () => void;
  onFlash: (msg: string) => void;
}

interface PropiedadFormState {
  etiqueta: string;
  tipo: TipoPropiedad;
  obligatoriaAlta: boolean;
  editable: boolean;
  listaOpciones: string[];
  listaMultiple: boolean;
}

const EMPTY_FORM: PropiedadFormState = {
  etiqueta: '',
  tipo: 'texto',
  obligatoriaAlta: false,
  editable: true,
  listaOpciones: [],
  listaMultiple: false,
};

function puedeConfigurarObligatoria(p: ColumnaTabla) {
  return !p.oculta && !ALTA_EXCLUDED_CODIGOS.has(p.codigo);
}

function ListaOpcionesEditor({
  opciones,
  onChange,
  inputClass,
}: {
  opciones: string[];
  onChange: (next: string[]) => void;
  inputClass: string;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const val = draft.trim();
    if (!val || opciones.includes(val)) return;
    onChange([...opciones, val]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Nueva opción…"
          className={inputClass}
        />
        <button
          type="button"
          disabled={!draft.trim()}
          onClick={add}
          className="shrink-0 px-2.5 py-1.5 bg-slate-800 text-white rounded-md text-xs font-medium cursor-pointer disabled:opacity-40"
        >
          +
        </button>
      </div>
      {opciones.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {opciones.map((opt) => (
            <span
              key={opt}
              className="inline-flex items-center gap-0.5 pl-2 pr-0.5 py-0.5 rounded bg-slate-100 text-[11px] text-slate-700"
            >
              {opt}
              <button
                type="button"
                onClick={() => onChange(opciones.filter((o) => o !== opt))}
                className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-red-500 cursor-pointer"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 m-0">Mínimo 2 opciones.</p>
      )}
    </div>
  );
}

const TABLE_COL_COUNT = 8;
const COL_TIPO_LAYOUT = 'hidden sm:table-cell text-center align-middle px-1';
const COL_CREADA_LAYOUT = 'hidden md:table-cell text-center align-middle px-1 truncate';
const COL_USOS_LAYOUT = 'text-center align-middle';
const COL_CHECK_LAYOUT = 'text-center align-middle';
const COL_ACTIONS_LAYOUT = 'text-center align-middle p-0 pr-1';

const COL_TIPO = `${COL_TIPO_LAYOUT} text-[11px]`;
const COL_CREADA = `${COL_CREADA_LAYOUT} text-[11px]`;
const COL_USOS = `${COL_USOS_LAYOUT} text-[11px] font-mono tabular-nums`;
const COL_CHECK = COL_CHECK_LAYOUT;
const COL_ACTIONS = COL_ACTIONS_LAYOUT;

const HEADER_CELL =
  'py-1.5 text-[10px] font-semibold text-slate-500 tracking-wide font-sans normal-case';
const HEADER_SECTION = `${HEADER_CELL} text-left pl-3 text-slate-600`;
const HEADER_COL = HEADER_CELL;

function PropiedadTableColGroup() {
  return (
    <colgroup>
      <col style={{ width: '50%' }} />
      <col style={{ width: '7%' }} />
      <col style={{ width: '11%' }} />
      <col style={{ width: '6%' }} />
      <col style={{ width: '7%' }} />
      <col style={{ width: '7%' }} />
      <col style={{ width: '7%' }} />
      <col style={{ width: '5%' }} />
    </colgroup>
  );
}

function PropiedadSectionHeaderRow({ title, count }: { title: string; count: number }) {
  return (
    <tr className="bg-slate-100 border-b border-slate-200">
      <td className={HEADER_SECTION}>{title} ({count})</td>
      <td className={`${COL_TIPO_LAYOUT} ${HEADER_COL}`}>Tipo</td>
      <td className={`${COL_CREADA_LAYOUT} ${HEADER_COL}`}>Creada por</td>
      <td className={`${COL_USOS_LAYOUT} ${HEADER_COL}`} title="Veces utilizada">
        Usos
      </td>
      <td className={`${COL_CHECK_LAYOUT} ${HEADER_COL}`} title="Obligatoria en alta">
        Obligatorio
      </td>
      <td className={`${COL_CHECK_LAYOUT} ${HEADER_COL}`} title="Editable en activos">
        Editable
      </td>
      <td className={`${COL_CHECK_LAYOUT} ${HEADER_COL}`} title="Disponible para utilizar">
        Utilizar
      </td>
      <td className={`${COL_ACTIONS_LAYOUT} ${HEADER_COL}`}>Acciones</td>
    </tr>
  );
}

function CheckCell({
  checked,
  disabled,
  title,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  title: string;
  onChange?: () => void;
}) {
  return (
    <div className="flex justify-center px-0.5" title={title}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => {
          e.stopPropagation();
          onChange?.();
        }}
        onClick={(e) => e.stopPropagation()}
        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
      />
    </div>
  );
}

function PropiedadRow({
  propiedad,
  expanded,
  onToggle,
  onToggleObligatoria,
  onToggleEditable,
  onToggleUtilizar,
  onEdit,
  onDelete,
}: {
  propiedad: ColumnaTabla;
  expanded: boolean;
  onToggle: () => void;
  onToggleObligatoria: (p: ColumnaTabla) => void;
  onToggleEditable: (p: ColumnaTabla) => void;
  onToggleUtilizar: (p: ColumnaTabla) => void;
  onEdit: (p: ColumnaTabla) => void;
  onDelete: (p: ColumnaTabla) => void;
}) {
  const meta = getTipoPropiedadMeta(propiedad.tipo);
  const Icon = meta.icon;
  const opciones = parseListaOpciones(propiedad.listaOpciones);
  const canObligatoria = puedeConfigurarObligatoria(propiedad);
  const canEditFlags = !propiedad.esSistema;

  return (
    <Fragment>
      <tr
        className={`border-b border-slate-100 transition-colors ${
          expanded ? 'bg-blue-50/60' : 'bg-white hover:bg-slate-50'
        } ${propiedad.oculta ? 'opacity-60' : ''}`}
      >
          <td className="p-0 align-middle">
            <button
              type="button"
              onClick={onToggle}
              className="w-full min-w-0 flex items-center gap-2 px-3 py-2 text-left text-sm cursor-pointer"
            >
              <ChevronRight
                size={14}
                className={`shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
              />
              <Icon size={14} className="shrink-0 text-slate-400" />
              <span className="font-medium text-slate-800 truncate min-w-0 flex-1">
                {propiedad.etiqueta}
              </span>
              {propiedad.esSistema && (
                <span title="Sistema" className="shrink-0 text-amber-600">
                  <Lock size={11} />
                </span>
              )}
            </button>
          </td>

          <td className={`${COL_TIPO} text-slate-500`}>{meta.label}</td>

          <td className={`${COL_CREADA} text-slate-600`} title={propiedad.creadoPor}>
            {propiedad.creadoPor ?? '—'}
          </td>

          <td className={`${COL_USOS} text-slate-700`}>{propiedad.vecesUtilizada ?? 0}</td>

          <td className={COL_CHECK}>
            <CheckCell
              checked={Boolean(propiedad.obligatoriaAlta)}
              disabled={!canObligatoria}
              title="Obligatoria en alta"
              onChange={canObligatoria ? () => onToggleObligatoria(propiedad) : undefined}
            />
          </td>
          <td className={COL_CHECK}>
            <CheckCell
              checked={Boolean(propiedad.editable)}
              disabled={!canEditFlags}
              title="Editable en activos"
              onChange={canEditFlags ? () => onToggleEditable(propiedad) : undefined}
            />
          </td>
          <td className={COL_CHECK}>
            <CheckCell
              checked={!propiedad.oculta}
              disabled={propiedad.esSistema}
              title="Disponible para utilizar"
              onChange={!propiedad.esSistema ? () => onToggleUtilizar(propiedad) : undefined}
            />
          </td>

          <td className={COL_ACTIONS}>
            {!propiedad.esSistema ? (
              <div className="flex items-center justify-end gap-0.5">
                <button
                  type="button"
                  onClick={() => onEdit(propiedad)}
                  title="Editar"
                  className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-white/80 cursor-pointer"
                >
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(propiedad)}
                  title="Eliminar"
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-white/80 cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ) : null}
          </td>
        </tr>

        {expanded && (
          <tr className="border-b border-slate-100 bg-white">
            <td colSpan={TABLE_COL_COUNT} className="p-0">
              <div className="ml-7 mr-3 py-2 border-l-2 border-slate-200 pl-3">
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px] m-0">
                  <dt className="text-slate-400">Código</dt>
                  <dd className="font-mono text-slate-700 m-0">{propiedad.codigo}</dd>
                  <dt className="text-slate-400 sm:hidden">Tipo</dt>
                  <dd className="text-slate-700 m-0 sm:hidden">{meta.label}</dd>
                  <dt className="text-slate-400 md:hidden">Creada por</dt>
                  <dd className="text-slate-700 m-0 md:hidden">{propiedad.creadoPor ?? '—'}</dd>
                  {propiedad.tipo === 'lista' && (
                    <>
                      <dt className="text-slate-400">Lista</dt>
                      <dd className="text-slate-700 m-0">
                        {propiedad.listaMultiple ? 'Varios valores' : 'Un valor'}
                        {opciones.length > 0 && (
                          <span className="text-slate-500"> · {opciones.join(' · ')}</span>
                        )}
                      </dd>
                    </>
                  )}
                </dl>
                {propiedad.esSistema && (
                  <p className="m-0 mt-2 text-[11px] text-amber-700/90 flex items-center gap-1">
                    <Lock size={11} />
                    No editable ni eliminable
                  </p>
                )}
              </div>
            </td>
          </tr>
        )}
    </Fragment>
  );
}

export default function PropiedadesActivosSection({ onChanged, onFlash }: Props) {
  const [propiedades, setPropiedades] = useState<ColumnaTabla[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<PropiedadFormState>(EMPTY_FORM);
  const [editing, setEditing] = useState<ColumnaTabla | null>(null);
  const [editForm, setEditForm] = useState<PropiedadFormState>(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const inputClass =
    'w-full py-1.5 px-2.5 border border-slate-200 rounded-md text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-400';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPropiedades(await api.getPropiedadesActivo());
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error al cargar propiedades');
    } finally {
      setLoading(false);
    }
  }, [onFlash]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    await load();
    onChanged();
  };

  const { sistema, personalizadas } = useMemo(() => {
    const sys: ColumnaTabla[] = [];
    const custom: ColumnaTabla[] = [];
    for (const p of propiedades) {
      if (p.esSistema) sys.push(p);
      else custom.push(p);
    }
    return { sistema: sys, personalizadas: custom };
  }, [propiedades]);

  const buildPayload = (state: PropiedadFormState) => {
    const payload = {
      etiqueta: state.etiqueta.trim(),
      tipo: state.tipo,
      editable: state.editable,
      obligatoriaAlta: state.obligatoriaAlta,
    };
    if (state.tipo === 'lista') {
      return {
        ...payload,
        listaOpciones: state.listaOpciones,
        listaMultiple: state.listaMultiple,
      };
    }
    return payload;
  };

  const validateForm = (state: PropiedadFormState): string | null => {
    if (!state.etiqueta.trim()) return 'El nombre de la propiedad es obligatorio.';
    if (state.tipo === 'lista' && state.listaOpciones.length < 2) {
      return 'Agregá al menos 2 opciones para la lista.';
    }
    return null;
  };

  const createPropiedad = async () => {
    const err = validateForm(form);
    if (err) {
      onFlash(err);
      return;
    }
    setSaving(true);
    try {
      await api.createPropiedadActivo(buildPayload(form));
      setForm(EMPTY_FORM);
      setShowCreate(false);
      onFlash('Propiedad creada');
      await refresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (p: ColumnaTabla) => {
    setEditing(p);
    setEditForm({
      etiqueta: p.etiqueta,
      tipo: p.tipo ?? 'texto',
      obligatoriaAlta: Boolean(p.obligatoriaAlta),
      editable: Boolean(p.editable),
      listaOpciones: parseListaOpciones(p.listaOpciones),
      listaMultiple: Boolean(p.listaMultiple),
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const err = validateForm(editForm);
    if (err) {
      onFlash(err);
      return;
    }
    setSaving(true);
    try {
      await api.updatePropiedadActivo(editing.id, buildPayload(editForm));
      setEditing(null);
      onFlash('Propiedad actualizada');
      await refresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const toggleObligatoria = async (p: ColumnaTabla) => {
    if (!puedeConfigurarObligatoria(p)) return;
    try {
      await api.updatePropiedadActivo(p.id, { obligatoriaAlta: !p.obligatoriaAlta });
      await refresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const toggleEditable = async (p: ColumnaTabla) => {
    if (p.esSistema) return;
    try {
      await api.updatePropiedadActivo(p.id, { editable: !p.editable });
      await refresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const toggleUtilizar = async (p: ColumnaTabla) => {
    if (p.esSistema) return;
    try {
      await api.updatePropiedadActivo(p.id, { oculta: !p.oculta });
      onFlash(p.oculta ? 'Propiedad habilitada para utilizar' : 'Propiedad deshabilitada');
      await refresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const removePropiedad = async (p: ColumnaTabla) => {
    if (!confirm(`¿Eliminar «${p.etiqueta}»? Los datos guardados en activos no se borran.`)) return;
    try {
      await api.deletePropiedadActivo(p.id);
      if (expandedId === p.id) setExpandedId(null);
      onFlash('Propiedad eliminada');
      await refresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderFormFields = (
    state: PropiedadFormState,
    setState: (s: PropiedadFormState) => void,
    options: { canChangeTipo?: boolean; formKey?: string } = {}
  ) => {
    const { canChangeTipo = true, formKey = 'new' } = options;
    return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Nombre</label>
          <input
            value={state.etiqueta}
            onChange={(e) => setState({ ...state, etiqueta: e.target.value })}
            placeholder="Marca, Talle…"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Tipo</label>
          <select
            value={state.tipo}
            disabled={!canChangeTipo}
            onChange={(e) => {
              const tipo = e.target.value as TipoPropiedad;
              setState({
                ...state,
                tipo,
                listaOpciones: tipo === 'lista' ? state.listaOpciones : [],
                listaMultiple: tipo === 'lista' ? state.listaMultiple : false,
              });
            }}
            className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed`}
          >
            {TIPOS_PROPIEDAD.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          {!canChangeTipo && (
            <p className="text-[10px] text-slate-400 m-0 mt-1">El tipo no puede cambiarse en esta propiedad.</p>
          )}
        </div>
      </div>

      {state.tipo === 'lista' && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 space-y-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase m-0">Opciones</p>
          <ListaOpcionesEditor
            opciones={state.listaOpciones}
            onChange={(listaOpciones) => setState({ ...state, listaOpciones })}
            inputClass={inputClass}
          />
          <div className="flex gap-3 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`lista-mode-${formKey}`}
                checked={!state.listaMultiple}
                onChange={() => setState({ ...state, listaMultiple: false })}
              />
              Un valor
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`lista-mode-${formKey}`}
                checked={state.listaMultiple}
                onChange={() => setState({ ...state, listaMultiple: true })}
              />
              Varios
            </label>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={state.obligatoriaAlta}
            onChange={(e) => setState({ ...state, obligatoriaAlta: e.target.checked })}
          />
          Obligatoria en alta
        </label>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={state.editable}
            onChange={(e) => setState({ ...state, editable: e.target.checked })}
          />
          Editable
        </label>
      </div>
    </div>
    );
  };

  return (
    <section className="md:col-span-2 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 m-0">
          <ListTree size={16} className="text-blue-600" />
          Propiedades de activos
        </h2>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold cursor-pointer"
        >
          <Plus size={14} />
          {showCreate ? 'Cerrar' : 'Nueva'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          {renderFormFields(form, setForm, { formKey: 'new' })}
          <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setForm(EMPTY_FORM);
              }}
              className="px-3 py-1.5 text-xs text-slate-600 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void createPropiedad()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Crear
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex justify-center text-slate-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse">
              <PropiedadTableColGroup />
              <tbody>
                {personalizadas.length === 0 && !showCreate ? (
                  <tr>
                    <td
                      colSpan={TABLE_COL_COUNT}
                      className="px-3 py-6 text-center text-xs text-slate-500 border-b border-slate-100"
                    >
                      Sin propiedades personalizadas. Usá «Nueva» para agregar campos propios.
                    </td>
                  </tr>
                ) : personalizadas.length > 0 ? (
                  <>
                    <PropiedadSectionHeaderRow title="Personalizadas" count={personalizadas.length} />
                    {personalizadas.map((p) => (
                      <PropiedadRow
                        key={p.id}
                        propiedad={p}
                        expanded={expandedId === p.id}
                        onToggle={() => toggleExpanded(p.id)}
                        onToggleObligatoria={toggleObligatoria}
                        onToggleEditable={toggleEditable}
                        onToggleUtilizar={toggleUtilizar}
                        onEdit={openEdit}
                        onDelete={removePropiedad}
                      />
                    ))}
                  </>
                ) : null}

                {sistema.length > 0 && (
                  <>
                    <PropiedadSectionHeaderRow title="Sistema" count={sistema.length} />
                    <tr className="bg-amber-50/60 border-b border-slate-100">
                      <td
                        colSpan={TABLE_COL_COUNT}
                        className="px-3 py-2 text-[11px] text-slate-600"
                      >
                        <span className="inline-flex items-start gap-1.5 leading-snug">
                          <Lock size={12} className="shrink-0 mt-px text-amber-600" />
                          Las propiedades del sistema no pueden modificarse ni eliminarse.
                        </span>
                      </td>
                    </tr>
                    {sistema.map((p) => (
                      <PropiedadRow
                        key={p.id}
                        propiedad={p}
                        expanded={expandedId === p.id}
                        onToggle={() => toggleExpanded(p.id)}
                        onToggleObligatoria={toggleObligatoria}
                        onToggleEditable={toggleEditable}
                        onToggleUtilizar={toggleUtilizar}
                        onEdit={openEdit}
                        onDelete={removePropiedad}
                      />
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-sm text-slate-900 m-0 mb-3">Editar «{editing.etiqueta}»</h2>
            {renderFormFields(editForm, setEditForm, {
              formKey: 'edit',
              canChangeTipo: Boolean(editing.esCustom),
            })}
            <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 text-xs text-slate-600 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveEdit()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 size={12} className="animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
