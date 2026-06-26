import type { ColumnaTabla } from '../types';

/** Máximo de columnas visibles simultáneas en tablas de inventario/auditoría. */
export const MAX_VISIBLE_TABLE_COLUMNS = 7;

export function toggleColumnVisibility(draft: string[], codigo: string): string[] {
  if (draft.includes(codigo)) {
    return draft.filter((c) => c !== codigo);
  }
  if (draft.length >= MAX_VISIBLE_TABLE_COLUMNS) return draft;
  return [...draft, codigo];
}

export function clampVisibleColumns(
  columnas: string[],
  max = MAX_VISIBLE_TABLE_COLUMNS
): string[] {
  return columnas.slice(0, max);
}

export const DEFAULT_INVENTORY_COLUMNS: ColumnaTabla[] = [
  { id: 1, codigo: 'epc', etiqueta: 'TID (RFID)', orden: 1, visibleDefault: true, editable: false },
  { id: 2, codigo: 'sku', etiqueta: 'SKU', orden: 2, visibleDefault: true, editable: false },
  { id: 3, codigo: 'estado', etiqueta: 'Estado', orden: 3, visibleDefault: true, editable: true },
  { id: 4, codigo: 'fecha_registro', etiqueta: 'Fecha registro', orden: 7, visibleDefault: true, editable: false },
];
