import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { MAX_VISIBLE_TABLE_COLUMNS } from '../constants/inventoryColumns';
import type { InventarioColumnasConfig } from '../types';

interface Props {
  open: boolean;
  columnasConfig: InventarioColumnasConfig;
  draftColumnas: string[];
  onClose: () => void;
  onToggle: (codigo: string) => void;
  onMove: (codigo: string, dir: -1 | 1) => void;
  onSave: () => void;
}

export default function ColumnPickerModal({
  open,
  columnasConfig,
  draftColumnas,
  onClose,
  onToggle,
  onMove,
  onSave,
}: Props) {
  if (!open) return null;

  const atMax = draftColumnas.length >= MAX_VISIBLE_TABLE_COLUMNS;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="font-bold text-slate-800 m-0">Columnas visibles</h2>
            <p className="text-xs text-slate-500 m-0 mt-1">
              {draftColumnas.length} de {MAX_VISIBLE_TABLE_COLUMNS} columnas seleccionadas
            </p>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>
        {atMax && (
          <div className="mx-4 mt-3 px-3 py-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
            Límite alcanzado. Desmarque una columna para agregar otra.
          </div>
        )}
        <div className="p-4 overflow-y-auto flex-1 space-y-1">
          {draftColumnas.map((codigo) => {
            const col = columnasConfig.columnas.find((c) => c.codigo === codigo);
            if (!col) return null;
            return (
              <div key={codigo} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50">
                <input type="checkbox" checked onChange={() => onToggle(codigo)} className="cursor-pointer" />
                <span className="flex-1 text-sm">{col.etiqueta}</span>
                <button type="button" onClick={() => onMove(codigo, -1)} className="p-1 cursor-pointer text-slate-400 hover:text-slate-600">
                  <ChevronUp size={14} />
                </button>
                <button type="button" onClick={() => onMove(codigo, 1)} className="p-1 cursor-pointer text-slate-400 hover:text-slate-600">
                  <ChevronDown size={14} />
                </button>
              </div>
            );
          })}
          {columnasConfig.columnas
            .filter((c) => !draftColumnas.includes(c.codigo))
            .map((col) => (
              <div
                key={col.codigo}
                className={`flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 ${atMax ? 'opacity-50' : 'opacity-60'}`}
              >
                <input
                  type="checkbox"
                  checked={false}
                  disabled={atMax}
                  onChange={() => onToggle(col.codigo)}
                  className="cursor-pointer disabled:cursor-not-allowed"
                  title={atMax ? `Máximo ${MAX_VISIBLE_TABLE_COLUMNS} columnas` : undefined}
                />
                <span className="flex-1 text-sm">{col.etiqueta}</span>
              </div>
            ))}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 cursor-pointer">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={draftColumnas.length === 0}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
