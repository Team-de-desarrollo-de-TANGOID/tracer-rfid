export const TID_CODIGO = 'tid';
export const LEGACY_TID_CODIGO = 'epc';

export function isTidCodigo(codigo) {
  return codigo === TID_CODIGO || codigo === LEGACY_TID_CODIGO;
}

export function normalizeColumnaCodigo(codigo) {
  return codigo === LEGACY_TID_CODIGO ? TID_CODIGO : codigo;
}
