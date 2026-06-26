import type { Estado } from '../types';

/** Tipos operativos internos de un estado de activo. */
export const TIPO_OPERATIVO = {
  HABILITADO: 'habilitado',
  DESHABILITADO: 'deshabilitado',
} as const;

export type TipoOperativoEstado =
  (typeof TIPO_OPERATIVO)[keyof typeof TIPO_OPERATIVO];

export const TIPO_OPERATIVO_LABELS: Record<TipoOperativoEstado, string> = {
  [TIPO_OPERATIVO.HABILITADO]: 'Habilitada',
  [TIPO_OPERATIVO.DESHABILITADO]: 'Deshabilitada',
};

export function estadoEstaHabilitado(estado: Estado | undefined): boolean {
  if (!estado) return false;
  if (estado.tipoOperativo) return estado.tipoOperativo === TIPO_OPERATIVO.HABILITADO;
  return Boolean(estado.esActivo ?? estado.es_activo);
}

export function estadoEstaDeshabilitado(estado: Estado | undefined): boolean {
  return !estadoEstaHabilitado(estado);
}

export function tipoOperativoFromEstado(estado: Estado): TipoOperativoEstado {
  if (estado.tipoOperativo) return estado.tipoOperativo;
  return estadoEstaHabilitado(estado) ? TIPO_OPERATIVO.HABILITADO : TIPO_OPERATIVO.DESHABILITADO;
}

export function labelTipoOperativo(tipo: TipoOperativoEstado): string {
  return TIPO_OPERATIVO_LABELS[tipo];
}

/** Estado de baja formal (requiere motivo, registra fecha de baja). */
export function esEstadoDeBaja(estado: Estado | undefined): boolean {
  if (!estado) return false;
  return estado.codigo === 'BAJA';
}
