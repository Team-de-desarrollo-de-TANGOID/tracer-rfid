import type { Activo, ColumnaTabla } from '../types';
import { getActivoPropiedadValor } from './activoProps';
import { TID_CODIGO } from '../constants/columnaCodigos';

/** Campos de sistema disponibles como filtros fijos. */
export const SYSTEM_FILTER_CODIGOS = [
  TID_CODIGO,
  'estado',
  'ubicacion',
  'fecha_registro',
  'fecha_baja',
] as const;

export interface SystemFilters {
  tid: string;
  estadoId: number | 'all';
  ubicacionId: number | 'all';
  fechaRegistro: string;
  fechaBaja: string;
}

export interface CustomFilter {
  id: string;
  codigo: string;
  value: string;
}

export const EMPTY_SYSTEM_FILTERS: SystemFilters = {
  tid: '',
  estadoId: 'all',
  ubicacionId: 'all',
  fechaRegistro: '',
  fechaBaja: '',
};

export function countActiveFilters(
  system: SystemFilters,
  custom: CustomFilter[]
): number {
  let n = 0;
  if (system.tid) n++;
  if (system.estadoId !== 'all') n++;
  if (system.ubicacionId !== 'all') n++;
  if (system.fechaRegistro) n++;
  if (system.fechaBaja) n++;
  n += custom.filter((f) => f.codigo && f.value.trim()).length;
  return n;
}

function contains(haystack: string | null | undefined, needle: string): boolean {
  if (!needle.trim()) return true;
  return (haystack ?? '').toLowerCase().includes(needle.trim().toLowerCase());
}

export function matchesInventoryFilters(
  activo: Activo,
  system: SystemFilters,
  custom: CustomFilter[],
  columnasCatalog: ColumnaTabla[]
): boolean {
  const tid = (activo.tid ?? activo.epc ?? '').toUpperCase();
  if (system.tid && !tid.toLowerCase().includes(system.tid.toLowerCase())) return false;
  if (system.estadoId !== 'all' && activo.estadoId !== system.estadoId) return false;
  if (system.ubicacionId !== 'all' && activo.ubicacionId !== system.ubicacionId) return false;
  if (!contains(activo.fecha, system.fechaRegistro)) return false;
  if (!contains(activo.fechaBaja ?? '', system.fechaBaja)) return false;

  for (const cf of custom) {
    if (!cf.codigo || !cf.value.trim()) continue;
    const col = columnasCatalog.find((c) => c.codigo === cf.codigo);
    if (!col) continue;
    const val = getActivoPropiedadValor(activo, col);
    if (!contains(val, cf.value)) return false;
  }

  return true;
}

export function getCustomFilterProperties(columnas: ColumnaTabla[]): ColumnaTabla[] {
  return columnas.filter((c) => c.esCustom && !c.oculta);
}

export function createCustomFilter(codigo: string): CustomFilter {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, codigo, value: '' };
}
