/** Máximo de columnas visibles simultáneas en tablas de inventario/auditoría. */
export const MAX_VISIBLE_TABLE_COLUMNS = 7;

export function clampVisibleColumns(columnas, max = MAX_VISIBLE_TABLE_COLUMNS) {
  return columnas.slice(0, max);
}
