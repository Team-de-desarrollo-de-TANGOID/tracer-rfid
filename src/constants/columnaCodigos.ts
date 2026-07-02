export const TID_CODIGO = 'tid';
export const LEGACY_TID_CODIGO = 'epc';

export function isTidCodigo(codigo: string): boolean {
  return codigo === TID_CODIGO || codigo === LEGACY_TID_CODIGO;
}

export function normalizeColumnaCodigo(codigo: string): string {
  return codigo === LEGACY_TID_CODIGO ? TID_CODIGO : codigo;
}
