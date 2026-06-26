/** Tipos operativos internos de un estado de activo. */
export const TIPO_OPERATIVO = {
  HABILITADO: 'habilitado',
  DESHABILITADO: 'deshabilitado',
};

export const TIPO_OPERATIVO_LABELS = {
  [TIPO_OPERATIVO.HABILITADO]: 'Habilitada',
  [TIPO_OPERATIVO.DESHABILITADO]: 'Deshabilitada',
};

export function tipoOperativoFromRow(row) {
  return row?.es_activo ? TIPO_OPERATIVO.HABILITADO : TIPO_OPERATIVO.DESHABILITADO;
}

export function esActivoFromTipoOperativo(tipo) {
  return tipo !== TIPO_OPERATIVO.DESHABILITADO;
}

export function resolveTipoOperativo(body, fallbackRow) {
  if (body?.tipoOperativo === TIPO_OPERATIVO.HABILITADO) return TIPO_OPERATIVO.HABILITADO;
  if (body?.tipoOperativo === TIPO_OPERATIVO.DESHABILITADO) return TIPO_OPERATIVO.DESHABILITADO;
  if (body?.esActivo !== undefined) {
    return body.esActivo ? TIPO_OPERATIVO.HABILITADO : TIPO_OPERATIVO.DESHABILITADO;
  }
  if (body?.habilitado !== undefined) {
    return body.habilitado ? TIPO_OPERATIVO.HABILITADO : TIPO_OPERATIVO.DESHABILITADO;
  }
  return tipoOperativoFromRow(fallbackRow);
}

export function estadoEstaHabilitado(estado) {
  if (!estado) return false;
  if (estado.tipoOperativo) return estado.tipoOperativo === TIPO_OPERATIVO.HABILITADO;
  return Boolean(estado.es_activo ?? estado.esActivo);
}

export function estadoEstaDeshabilitado(estado) {
  return !estadoEstaHabilitado(estado);
}

/** Estado de baja formal (requiere motivo, registra fecha de baja). */
export function esEstadoDeBaja(estado) {
  if (!estado) return false;
  return estado.codigo === 'BAJA';
}
