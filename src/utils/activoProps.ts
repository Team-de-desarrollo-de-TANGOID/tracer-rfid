import type { Activo, ColumnaTabla } from '../types';
import { isTidCodigo } from '../constants/columnaCodigos';

/** Valor de una propiedad/columna del activo (sistema, mapeada o custom). */
export function getActivoPropiedadValor(item: Activo, col: ColumnaTabla | string): string {
  const codigo = typeof col === 'string' ? col : col.codigo;
  if (isTidCodigo(codigo)) {
    return item.tid ?? item.epc ?? '';
  }
  switch (codigo) {
    case 'sku':
      return item.sku ?? '';
    case 'estado':
      return item.estado ?? '';
    case 'ubicacion':
      return item.ubicacion ?? '';
    case 'descripcion':
      return item.descripcion ?? '';
    case 'codigo_interno':
      return item.codigoInterno ?? '';
    case 'fecha_registro':
      return item.fecha ?? '';
    case 'fecha_baja':
      return item.fechaBaja ?? '';
    case 'motivo_baja':
      return item.motivoBaja ?? '';
    default:
      return item.propiedadesExtra?.[codigo] ?? '';
  }
}

export function isColumnaCustom(col: ColumnaTabla): boolean {
  return Boolean(col.esCustom);
}
