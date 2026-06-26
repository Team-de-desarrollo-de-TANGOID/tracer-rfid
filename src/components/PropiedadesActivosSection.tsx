import { useCallback, useEffect, useState } from 'react';
import { ListTree, Lock, Pencil, Trash2, EyeOff, Eye, Plus, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import CollapsibleAddForm from './CollapsibleAddForm';
import type { ColumnaTabla, TipoPropiedad } from '../types';

interface Props {
  onChanged: () => void;
  onFlash: (msg: string) => void;
}

export default function PropiedadesActivosSection({ onChanged, onFlash }: Props) {
  const [propiedades, setPropiedades] = useState<ColumnaTabla[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ColumnaTabla | null>(null);
  const [newEtiqueta, setNewEtiqueta] = useState('');
  const [newTipo, setNewTipo] = useState<TipoPropiedad>('texto');
  const [saving, setSaving] = useState(false);

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

  const addPropiedad = async (close: () => void) => {
    if (!newEtiqueta.trim()) return;
    try {
      await api.createPropiedadActivo({
        etiqueta: newEtiqueta.trim(),
        tipo: newTipo,
        editable: true,
        visibleDefault: false,
      });
      setNewEtiqueta('');
      setNewTipo('texto');
      onFlash('Propiedad creada');
      close();
      await refresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.updatePropiedadActivo(editing.id, {
        etiqueta: editing.etiqueta,
        editable: editing.editable,
        visibleDefault: editing.visibleDefault,
        tipo: editing.tipo,
      });
      setEditing(null);
      onFlash('Propiedad actualizada');
      await refresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const toggleOculta = async (p: ColumnaTabla) => {
    try {
      await api.updatePropiedadActivo(p.id, { oculta: !p.oculta });
      onFlash(p.oculta ? 'Propiedad visible de nuevo' : 'Propiedad oculta');
      await refresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const removePropiedad = async (p: ColumnaTabla) => {
    if (p.enUso) {
      onFlash('En uso: use «Ocultar» en lugar de eliminar.');
      return;
    }
    if (!confirm(`¿Eliminar la propiedad «${p.etiqueta}»?`)) return;
    try {
      await api.deletePropiedadActivo(p.id);
      onFlash('Propiedad eliminada');
      await refresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <section className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm md:col-span-2">
      <div className="flex items-center gap-2 font-bold text-[#0f172a] mb-1">
        <ListTree size={18} />
        Gestionar propiedades de activos
      </div>
      <p className="text-xs text-slate-500 m-0 mb-4">
        TID, SKU, estado, ubicación y fechas son del sistema y no se pueden modificar. El resto puede
        renombrarse, ocultarse o ampliarse con nuevas propiedades.
      </p>

      {loading ? (
        <div className="py-8 flex justify-center text-slate-400">
          <Loader2 size={24} className="animate-spin" />
        </div>
      ) : (
        <ul className="space-y-2 mb-4 max-h-72 overflow-y-auto">
          {propiedades.map((p) => (
            <li
              key={p.id}
              className={`flex items-center justify-between text-sm border-b border-slate-50 pb-2 ${
                p.oculta ? 'opacity-60' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800">{p.etiqueta}</span>
                  <span className="text-[10px] font-mono text-slate-400">{p.codigo}</span>
                  {p.esSistema && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-bold">
                      <Lock size={10} /> Sistema
                    </span>
                  )}
                  {p.esCustom && (
                    <span className="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded font-bold">
                      Personalizada
                    </span>
                  )}
                  {p.oculta && (
                    <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      Oculta
                    </span>
                  )}
                  {p.enUso && !p.esSistema && (
                    <span className="text-[10px] text-blue-600">En uso</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 m-0 mt-0.5">
                  {p.editable ? 'Editable en activos' : 'Solo lectura'}
                  {p.tipo && p.tipo !== 'texto' ? ` · tipo ${p.tipo}` : ''}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {!p.esSistema && (
                  <button
                    type="button"
                    onClick={() => setEditing({ ...p })}
                    title="Editar"
                    className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                  >
                    <Pencil size={14} />
                  </button>
                )}
                {!p.esSistema && (
                  <button
                    type="button"
                    onClick={() => toggleOculta(p)}
                    title={p.oculta ? 'Mostrar' : 'Ocultar'}
                    className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {p.oculta ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                )}
                {!p.esSistema && !p.enUso && (
                  <button
                    type="button"
                    onClick={() => removePropiedad(p)}
                    title="Eliminar"
                    className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <CollapsibleAddForm label="Añadir propiedad">
        {(close) => (
          <>
            <div className="flex gap-2 flex-wrap">
              <input
                placeholder="Nombre de la propiedad (ej. Marca)"
                value={newEtiqueta}
                onChange={(e) => setNewEtiqueta(e.target.value)}
                className="flex-1 min-w-[160px] py-2 px-3 border rounded-lg text-sm bg-white"
              />
              <select
                value={newTipo}
                onChange={(e) => setNewTipo(e.target.value as TipoPropiedad)}
                className="py-2 px-3 border rounded-lg text-sm bg-white"
              >
                <option value="texto">Texto</option>
                <option value="numero">Número</option>
                <option value="fecha">Fecha</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => addPropiedad(close)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              <Plus size={14} />
              Crear propiedad
            </button>
          </>
        )}
      </CollapsibleAddForm>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-slate-800 m-0">Editar propiedad</h2>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                Etiqueta
              </label>
              <input
                value={editing.etiqueta}
                onChange={(e) => setEditing({ ...editing, etiqueta: e.target.value })}
                className="w-full py-2 px-3 border rounded-lg text-sm"
              />
            </div>
            {editing.esCustom && (
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Tipo de dato
                </label>
                <select
                  value={editing.tipo ?? 'texto'}
                  onChange={(e) =>
                    setEditing({ ...editing, tipo: e.target.value as TipoPropiedad })
                  }
                  className="w-full py-2 px-3 border rounded-lg text-sm"
                >
                  <option value="texto">Texto</option>
                  <option value="numero">Número</option>
                  <option value="fecha">Fecha</option>
                </select>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editing.editable}
                onChange={(e) => setEditing({ ...editing, editable: e.target.checked })}
              />
              Permitir edición en activos
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editing.visibleDefault}
                onChange={(e) => setEditing({ ...editing, visibleDefault: e.target.checked })}
              />
              Visible por defecto en tabla (nuevos usuarios)
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm cursor-pointer text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
