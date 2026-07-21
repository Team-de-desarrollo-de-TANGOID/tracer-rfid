import type { Activo, ColumnaTabla } from '../types';
import { getActivoPropiedadValor } from './activoProps';
export type SortDir = 'asc' | 'desc';

function compareValues(a: string, b: string, dir: SortDir): number {
  const va = a.trim().toLowerCase();
  const vb = b.trim().toLowerCase();
  const cmp = va.localeCompare(vb, 'es', { numeric: true, sensitivity: 'base' });
  if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
  return 0;
}

export function compareActivoByColumn(
  a: Activo,
  b: Activo,
  col: ColumnaTabla,
  dir: SortDir
): number {
  return compareValues(getActivoPropiedadValor(a, col), getActivoPropiedadValor(b, col), dir);
}

export function sortActivos(
  items: Activo[],
  col: ColumnaTabla | undefined,
  dir: SortDir
): Activo[] {
  if (!col) return items;
  return [...items].sort((a, b) => compareActivoByColumn(a, b, col, dir));
}

export function findColumna(codigo: string | null, columnas: ColumnaTabla[]) {
  if (!codigo) return undefined;
  return columnas.find((c) => c.codigo === codigo);
}
