import { useMemo, useState } from 'react';
import { Trash2, Package, Tags, MapPin, Pencil, ListTree, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import CollapsibleAddForm from './CollapsibleAddForm';
import PropiedadesActivosSection from './PropiedadesActivosSection';
import type { Estado, Sku, Ubicacion } from '../types';
import {
  TIPO_OPERATIVO,
  estadoEstaDeshabilitado,
  estadoEstaHabilitado,
  labelTipoOperativo,
  tipoOperativoFromEstado,
} from '../utils/estadoOperativo';

type CatalogSection = 'sku' | 'estados' | 'ubicaciones' | 'propiedades';

interface Props {
  estados: Estado[];
  skus: Sku[];
  ubicaciones: Ubicacion[];
  onRefresh: () => void;
  onRefreshColumnas: () => Promise<void>;
  permissions: { sku: boolean; estados: boolean; ubicaciones: boolean; propiedades: boolean };
  onFlash: (text: string) => void;
}

const SECTION_META: Record<
  CatalogSection,
  { label: string; description: string; icon: typeof Package }
> = {
  sku: {
    label: 'SKUs',
    description: 'Códigos de producto para clasificar los activos del inventario.',
    icon: Package,
  },
  estados: {
    label: 'Estados',
    description: 'Estados operativos de los activos (activo, baja, en reparación, etc.).',
    icon: Tags,
  },
  ubicaciones: {
    label: 'Ubicaciones',
    description: 'Lugares físicos donde pueden encontrarse los activos.',
    icon: MapPin,
  },
  propiedades: {
    label: 'Propiedades',
    description: 'Campos personalizados visibles en el inventario y altas.',
    icon: ListTree,
  },
};

function MenuButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Package;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
        active
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-slate-700 hover:bg-slate-100'
      }`}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="flex-1 text-sm font-medium truncate">{label}</span>
      {count != null && (
        <span
          className={`text-xs font-mono px-1.5 py-0.5 rounded-full flex-shrink-0 ${
            active ? 'bg-blue-500 text-white' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {count}
        </span>
      )}
      <ChevronRight
        size={14}
        className={`flex-shrink-0 ${active ? 'text-blue-200' : 'text-slate-400'}`}
      />
    </button>
  );
}

export default function ConfigActivosTab({
  estados,
  skus,
  ubicaciones,
  onRefresh,
  onRefreshColumnas,
  permissions,
  onFlash,
}: Props) {
  const [activeSection, setActiveSection] = useState<CatalogSection | null>(null);
  const [newSku, setNewSku] = useState('');
  const [newSkuDesc, setNewSkuDesc] = useState('');
  const [newEstado, setNewEstado] = useState('');
  const [newUbicacion, setNewUbicacion] = useState('');
  const [newUbicacionDesc, setNewUbicacionDesc] = useState('');
  const [editingEstado, setEditingEstado] = useState<Estado | null>(null);
  const [editingUbicacion, setEditingUbicacion] = useState<Ubicacion | null>(null);

  const menuItems = useMemo(() => {
    const items: { id: CatalogSection; count?: number }[] = [];
    if (permissions.sku) items.push({ id: 'sku', count: skus.length });
    if (permissions.estados) items.push({ id: 'estados', count: estados.length });
    if (permissions.ubicaciones) items.push({ id: 'ubicaciones', count: ubicaciones.length });
    if (permissions.propiedades) items.push({ id: 'propiedades' });
    return items;
  }, [permissions, skus.length, estados.length, ubicaciones.length]);

  const activeMeta = activeSection ? SECTION_META[activeSection] : null;

  const addSku = async (close: () => void) => {
    if (!newSku.trim()) return;
    try {
      await api.createSku(newSku, newSkuDesc);
      setNewSku('');
      setNewSkuDesc('');
      onFlash('SKU agregado');
      onRefresh();
      close();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const addEstado = async (close: () => void) => {
    if (!newEstado.trim()) return;
    try {
      await api.createEstado({
        nombre: newEstado,
        tipoOperativo: TIPO_OPERATIVO.HABILITADO,
        permiteSalida: false,
      });
      setNewEstado('');
      onFlash('Estado agregado');
      onRefresh();
      close();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const saveEstado = async () => {
    if (!editingEstado) return;
    try {
      await api.updateEstado(editingEstado.id, {
        nombre: editingEstado.nombre,
        color: editingEstado.color,
        tipoOperativo: tipoOperativoFromEstado(editingEstado),
        permiteSalida: Boolean(editingEstado.permite_salida ?? editingEstado.permiteSalida),
        orden: editingEstado.orden,
      });
      setEditingEstado(null);
      onFlash('Estado actualizado');
      onRefresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const removeEstado = async (id: number) => {
    try {
      await api.deleteEstado(id);
      onRefresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const addUbicacion = async (close: () => void) => {
    if (!newUbicacion.trim()) return;
    try {
      await api.createUbicacion(newUbicacion, undefined, newUbicacionDesc);
      setNewUbicacion('');
      setNewUbicacionDesc('');
      onFlash('Ubicación agregada');
      onRefresh();
      close();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const saveUbicacion = async () => {
    if (!editingUbicacion) return;
    try {
      await api.updateUbicacion(editingUbicacion.id, {
        nombre: editingUbicacion.nombre,
        tipo: editingUbicacion.tipo,
        descripcion: editingUbicacion.descripcion,
        activo: editingUbicacion.activo,
      });
      setEditingUbicacion(null);
      onFlash('Ubicación actualizada');
      onRefresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  const removeUbicacion = async (id: number) => {
    try {
      await api.deleteUbicacion(id);
      onRefresh();
    } catch (e) {
      onFlash(e instanceof Error ? e.message : 'Error');
    }
  };

  if (menuItems.length === 0) {
    return (
      <p className="text-sm text-slate-500">No tiene permisos para configurar propiedades de activos.</p>
    );
  }

  return (
    <>
      <div className="h-full min-h-0 flex flex-col lg:flex-row gap-6">
        {/* Menú de opciones */}
        <nav className="lg:w-56 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 m-0 mb-3 px-1">
            Elegí qué administrar
          </p>
          <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-sm space-y-0.5">
            {menuItems.map(({ id, count }) => {
              const meta = SECTION_META[id];
              return (
                <MenuButton
                  key={id}
                  active={activeSection === id}
                  onClick={() => setActiveSection(id)}
                  icon={meta.icon}
                  label={meta.label}
                  count={count}
                />
              );
            })}
          </div>
        </nav>

        {/* Panel de la sección activa */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {!activeSection ? (
            <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-white/60 px-8">
              <Package size={32} className="text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600 m-0">Seleccioná una opción</p>
              <p className="text-xs text-slate-400 m-0 mt-1 max-w-xs">
                Elegí del menú qué querés administrar: SKUs, estados, ubicaciones o campos personalizados.
              </p>
            </div>
          ) : activeSection === 'sku' ? (
            <section className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                  <Package size={18} className="text-blue-600" />
                  {activeMeta?.label}
                </h2>
                <p className="text-sm text-slate-500 m-0 mt-1">{activeMeta?.description}</p>
              </div>
              <ul className="space-y-2 mb-4 max-h-[min(420px,50vh)] overflow-y-auto">
                {skus.length === 0 ? (
                  <li className="text-sm text-slate-400 py-4 text-center">No hay SKUs cargados.</li>
                ) : (
                  skus.map((s) => (
                    <li
                      key={s.id}
                      className="text-sm flex justify-between gap-4 border-b border-slate-50 pb-2"
                    >
                      <span className="font-mono font-semibold text-slate-800">{s.codigo}</span>
                      <span className="text-slate-500 text-xs text-right">{s.descripcion}</span>
                    </li>
                  ))
                )}
              </ul>
              <CollapsibleAddForm label="Agregar SKU">
                {(close) => (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        placeholder="Código SKU"
                        value={newSku}
                        onChange={(e) => setNewSku(e.target.value)}
                        className="flex-1 min-w-[120px] py-2 px-3 border rounded-lg text-sm bg-white"
                      />
                      <input
                        placeholder="Descripción"
                        value={newSkuDesc}
                        onChange={(e) => setNewSkuDesc(e.target.value)}
                        className="flex-1 min-w-[120px] py-2 px-3 border rounded-lg text-sm bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => addSku(close)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Guardar SKU
                    </button>
                  </>
                )}
              </CollapsibleAddForm>
            </section>
          ) : activeSection === 'estados' ? (
            <section className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                  <Tags size={18} className="text-blue-600" />
                  {activeMeta?.label}
                </h2>
                <p className="text-sm text-slate-500 m-0 mt-1">{activeMeta?.description}</p>
              </div>
              <ul className="space-y-2 mb-4 max-h-[min(420px,50vh)] overflow-y-auto">
                {estados.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between text-sm border-b border-slate-50 pb-2"
                  >
                    <div>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ backgroundColor: `${e.color}22`, color: e.color }}
                      >
                        {e.nombre}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          estadoEstaHabilitado(e)
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {labelTipoOperativo(tipoOperativoFromEstado(e))}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {(e.permite_salida ?? e.permiteSalida) ? ' · permite salida' : ''}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingEstado({ ...e })}
                        className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      {!(e.es_sistema ?? e.esSistema) && (
                        <button
                          type="button"
                          onClick={() => removeEstado(e.id)}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <CollapsibleAddForm label="Agregar estado">
                {(close) => (
                  <>
                    <input
                      placeholder="Nuevo estado"
                      value={newEstado}
                      onChange={(e) => setNewEstado(e.target.value)}
                      className="w-full py-2 px-3 border rounded-lg text-sm bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => addEstado(close)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Guardar estado
                    </button>
                  </>
                )}
              </CollapsibleAddForm>
            </section>
          ) : activeSection === 'ubicaciones' ? (
            <section className="bg-white border border-[#e2e8f0] rounded-xl p-6 shadow-sm">
              <div className="mb-5">
                <h2 className="text-base font-bold text-slate-900 m-0 flex items-center gap-2">
                  <MapPin size={18} className="text-blue-600" />
                  {activeMeta?.label}
                </h2>
                <p className="text-sm text-slate-500 m-0 mt-1">{activeMeta?.description}</p>
              </div>
              <ul className="space-y-2 mb-4 max-h-[min(420px,50vh)] overflow-y-auto">
                {ubicaciones.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between text-sm border-b border-slate-50 pb-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            u.activo
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-slate-50 text-slate-400 line-through'
                          }`}
                        >
                          {u.nombre}
                        </span>
                        <span className="text-[10px] text-slate-400">{u.tipo}</span>
                      </div>
                      {u.descripcion && (
                        <p className="text-xs text-slate-500 m-0 mt-0.5 truncate">{u.descripcion}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingUbicacion({ ...u })}
                        className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeUbicacion(u.id)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <CollapsibleAddForm label="Agregar ubicación">
                {(close) => (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      <input
                        placeholder="Nombre"
                        value={newUbicacion}
                        onChange={(e) => setNewUbicacion(e.target.value)}
                        className="flex-1 min-w-[140px] py-2 px-3 border rounded-lg text-sm bg-white"
                      />
                      <input
                        placeholder="Descripción breve"
                        value={newUbicacionDesc}
                        onChange={(e) => setNewUbicacionDesc(e.target.value)}
                        className="flex-1 min-w-[160px] py-2 px-3 border rounded-lg text-sm bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => addUbicacion(close)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Guardar ubicación
                    </button>
                  </>
                )}
              </CollapsibleAddForm>
            </section>
          ) : (
            <PropiedadesActivosSection
              onFlash={onFlash}
              onChanged={async () => {
                await onRefreshColumnas();
              }}
            />
          )}
        </div>
      </div>

      {editingEstado && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-slate-800 m-0">Editar estado</h2>
            <input
              value={editingEstado.nombre}
              onChange={(e) => setEditingEstado({ ...editingEstado, nombre: e.target.value })}
              className="w-full py-2 px-3 border rounded-lg text-sm"
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">Color</label>
              <input
                type="color"
                value={editingEstado.color}
                onChange={(e) => setEditingEstado({ ...editingEstado, color: e.target.value })}
                className="cursor-pointer"
              />
            </div>
            <div>
              <span className="block text-sm font-semibold text-slate-700 mb-2">Tipo operativo</span>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="tipoOperativo"
                    checked={estadoEstaHabilitado(editingEstado)}
                    onChange={() =>
                      setEditingEstado({
                        ...editingEstado,
                        tipoOperativo: TIPO_OPERATIVO.HABILITADO,
                        es_activo: 1,
                        esActivo: true,
                      })
                    }
                  />
                  <span>
                    <strong>Habilitada</strong>
                    <span className="text-slate-500 text-xs block">
                      El activo se considera operativo en inventario y sincronización.
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="tipoOperativo"
                    checked={estadoEstaDeshabilitado(editingEstado)}
                    onChange={() =>
                      setEditingEstado({
                        ...editingEstado,
                        tipoOperativo: TIPO_OPERATIVO.DESHABILITADO,
                        es_activo: 0,
                        esActivo: false,
                      })
                    }
                  />
                  <span>
                    <strong>Deshabilitada</strong>
                    <span className="text-slate-500 text-xs block">
                      El activo se considera desactivado (ej. baja, fuera de servicio).
                    </span>
                  </span>
                </label>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(editingEstado.permite_salida ?? editingEstado.permiteSalida)}
                onChange={(e) =>
                  setEditingEstado({ ...editingEstado, permite_salida: e.target.checked ? 1 : 0 })
                }
              />
              Permite salida por puerta (autorizada)
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingEstado(null)}
                className="px-4 py-2 text-sm cursor-pointer text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEstado}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
      {editingUbicacion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-bold text-slate-800 m-0">Editar ubicación</h2>
            <input
              value={editingUbicacion.nombre}
              onChange={(e) =>
                setEditingUbicacion({ ...editingUbicacion, nombre: e.target.value })
              }
              placeholder="Nombre"
              className="w-full py-2 px-3 border rounded-lg text-sm"
            />
            <textarea
              value={editingUbicacion.descripcion}
              onChange={(e) =>
                setEditingUbicacion({ ...editingUbicacion, descripcion: e.target.value })
              }
              placeholder="Descripción breve"
              rows={2}
              className="w-full py-2 px-3 border rounded-lg text-sm resize-none"
            />
            <select
              value={editingUbicacion.tipo}
              onChange={(e) =>
                setEditingUbicacion({ ...editingUbicacion, tipo: e.target.value })
              }
              className="w-full py-2 px-3 border rounded-lg text-sm"
            >
              <option value="general">General</option>
              <option value="almacen">Almacén</option>
              <option value="vestuario">Vestuario</option>
              <option value="cancha">Cancha</option>
              <option value="lavanderia">Lavandería</option>
            </select>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={editingUbicacion.activo}
                onChange={(e) =>
                  setEditingUbicacion({ ...editingUbicacion, activo: e.target.checked })
                }
              />
              Activa (disponible en altas e inventario)
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingUbicacion(null)}
                className="px-4 py-2 text-sm cursor-pointer text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveUbicacion}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
