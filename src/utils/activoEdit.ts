import type { Activo, ColumnaTabla, Estado } from '../types';
import { esEstadoDeBaja, estadoEstaHabilitado } from './estadoOperativo';

/** Requiere motivo al pasar a un estado de baja formal. */
export function estadoRequiereMotivoBaja(estado: Estado | undefined): boolean {
  return esEstadoDeBaja(estado);
}

/** Motivo de baja editable solo si el activo fue dado de baja formalmente. */
export function activoPermiteEditarMotivoBaja(item: Activo): boolean {
  return Boolean(item.fechaBaja);
}

export function canEditColumnInQuickMode(
  col: ColumnaTabla,
  item: Activo,
  opts: { canEdit: boolean; canChangeEstado: boolean; isQuickEditRow: boolean }
): boolean {
  if (!opts.isQuickEditRow || !col.editable) return false;
  switch (col.codigo) {
    case 'estado':
      return opts.canChangeEstado;
    case 'motivo_baja':
      return opts.canEdit && activoPermiteEditarMotivoBaja(item);
    case 'ubicacion':
    case 'descripcion':
    case 'codigo_interno':
      return opts.canEdit;
    default:
      return opts.canEdit && Boolean(col.esCustom);
  }
}

export const PERMISO_EDICION_RAPIDA = 'activos.edicion_rapida';
export const PERMISO_EDITAR = 'activos.editar';
export const PERMISO_CAMBIAR_ESTADO = 'activos.cambiar_estado';
export const PERMISO_VER_HISTORIAL = 'activos.ver_historial';

/** @deprecated use esEstadoDeBaja */
export function isEstadoDeBaja(estado: Estado | undefined): boolean {
  return esEstadoDeBaja(estado);
}

/** @deprecated use estadoEstaHabilitado */
export function isEstadoHabilitado(estado: Estado | undefined): boolean {
  return estadoEstaHabilitado(estado);
}
