import { Plus, Trash2 } from 'lucide-react';
import type { ColumnaTabla, Estado, Ubicacion } from '../types';
import type { CustomFilter, SystemFilters } from '../utils/inventoryFilters';
import { createCustomFilter } from '../utils/inventoryFilters';

const filterInputClass =
  'w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500';

interface Props {
  systemFilters: SystemFilters;
  customFilters: CustomFilter[];
  customProperties: ColumnaTabla[];
  estados: Estado[];
  ubicaciones: Ubicacion[];
  onSystemChange: (next: SystemFilters) => void;
  onCustomChange: (next: CustomFilter[]) => void;
}

export default function InventoryFiltersPanel({
  systemFilters,
  customFilters,
  customProperties,
  estados,
  ubicaciones,
  onSystemChange,
  onCustomChange,
}: Props) {
  const usedCustomCodigos = new Set(customFilters.map((f) => f.codigo));
  const canAddCustom = customProperties.some((p) => !usedCustomCodigos.has(p.codigo));

  const addCustomFilter = () => {
    const nextProp = customProperties.find((p) => !usedCustomCodigos.has(p.codigo));
    if (!nextProp) return;
    onCustomChange([...customFilters, createCustomFilter(nextProp.codigo)]);
  };

  const updateCustom = (id: string, patch: Partial<CustomFilter>) => {
    onCustomChange(customFilters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeCustom = (id: string) => {
    onCustomChange(customFilters.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
          Filtros del sistema
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FilterField label="TID">
            <input
              value={systemFilters.tid}
              onChange={(e) => onSystemChange({ ...systemFilters, tid: e.target.value })}
              placeholder="Contiene…"
              className={filterInputClass}
            />
          </FilterField>
          <FilterField label="Estado">
            <select
              value={systemFilters.estadoId === 'all' ? '' : systemFilters.estadoId}
              onChange={(e) =>
                onSystemChange({
                  ...systemFilters,
                  estadoId: e.target.value ? Number(e.target.value) : 'all',
                })
              }
              className={filterInputClass}
            >
              <option value="">Todos</option>
              {estados.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Ubicación">
            <select
              value={systemFilters.ubicacionId === 'all' ? '' : systemFilters.ubicacionId}
              onChange={(e) =>
                onSystemChange({
                  ...systemFilters,
                  ubicacionId: e.target.value ? Number(e.target.value) : 'all',
                })
              }
              className={filterInputClass}
            >
              <option value="">Todas</option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Fecha registro">
            <input
              value={systemFilters.fechaRegistro}
              onChange={(e) =>
                onSystemChange({ ...systemFilters, fechaRegistro: e.target.value })
              }
              placeholder="Ej. 2024-06 o contiene…"
              className={filterInputClass}
            />
          </FilterField>
          <FilterField label="Fecha baja">
            <input
              value={systemFilters.fechaBaja}
              onChange={(e) => onSystemChange({ ...systemFilters, fechaBaja: e.target.value })}
              placeholder="Ej. 2024-06 o contiene…"
              className={filterInputClass}
            />
          </FilterField>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide m-0">
            Filtros personalizados
          </p>
          {canAddCustom && (
            <button
              type="button"
              onClick={addCustomFilter}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg cursor-pointer hover:bg-violet-100"
            >
              <Plus size={12} />
              Agregar filtro
            </button>
          )}
        </div>

        {customProperties.length === 0 ? (
          <p className="text-xs text-slate-400 m-0">
            No hay propiedades personalizadas configuradas. Créelas en Configuración → Gestionar
            propiedades de activos.
          </p>
        ) : customFilters.length === 0 ? (
          <p className="text-xs text-slate-400 m-0">
            Pulse «Agregar filtro» para filtrar por una propiedad personalizada.
          </p>
        ) : (
          <div className="space-y-2">
            {customFilters.map((cf) => {
              const prop = customProperties.find((p) => p.codigo === cf.codigo);
              return (
                <div
                  key={cf.id}
                  className="flex flex-wrap items-end gap-2 p-3 bg-violet-50/50 border border-violet-100 rounded-lg"
                >
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Propiedad
                    </label>
                    <select
                      value={cf.codigo}
                      onChange={(e) => updateCustom(cf.id, { codigo: e.target.value })}
                      className={filterInputClass}
                    >
                      {customProperties.map((p) => (
                        <option
                          key={p.codigo}
                          value={p.codigo}
                          disabled={
                            p.codigo !== cf.codigo && usedCustomCodigos.has(p.codigo)
                          }
                        >
                          {p.etiqueta}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-[2] min-w-[160px]">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                      Valor
                    </label>
                    <input
                      type={
                        prop?.tipo === 'numero'
                          ? 'number'
                          : prop?.tipo === 'fecha'
                            ? 'date'
                            : 'text'
                      }
                      value={cf.value}
                      onChange={(e) => updateCustom(cf.id, { value: e.target.value })}
                      placeholder="Contiene o coincide…"
                      className={filterInputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCustom(cf.id)}
                    title="Quitar filtro"
                    className="p-2 text-slate-400 hover:text-red-600 cursor-pointer mb-0.5"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
