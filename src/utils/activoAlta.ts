import type { ColumnaTabla, Sku } from '../types';

/** Propiedades que no se capturan en el alta (automáticas o en otra sección). */
export const ALTA_EXCLUDED_CODIGOS = new Set([
  'epc',
  'fecha_registro',
  'fecha_baja',
  'motivo_baja',
]);

export function getAltaActivoFields(columnas: ColumnaTabla[] | undefined): ColumnaTabla[] {
  if (!columnas?.length) return [];
  return columnas
    .filter((c) => !c.oculta && !ALTA_EXCLUDED_CODIGOS.has(c.codigo))
    .sort((a, b) => a.orden - b.orden);
}

export function initAltaFieldValues(fields: ColumnaTabla[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const col of fields) {
    if (!['sku', 'estado', 'ubicacion'].includes(col.codigo)) {
      values[col.codigo] = '';
    }
  }
  return values;
}

export interface CreateActivoPayload {
  epc: string;
  skuId: number;
  estadoId: number;
  ubicacionId?: number;
  descripcion?: string;
  codigoInterno?: string;
  propiedadesExtra?: Record<string, string>;
}

export function buildCreateActivoPayload(
  epc: string,
  skuId: number,
  estadoId: number,
  ubicacionId: number | undefined,
  fieldValues: Record<string, string>,
  columnas: ColumnaTabla[],
  skus: Sku[]
): CreateActivoPayload {
  const body: CreateActivoPayload = {
    epc,
    skuId,
    estadoId,
    ubicacionId: ubicacionId || undefined,
  };

  const propiedadesExtra: Record<string, string> = {};
  const fields = getAltaActivoFields(columnas);

  for (const col of fields) {
    const val = fieldValues[col.codigo]?.trim() ?? '';
    if (!val) continue;

    switch (col.codigo) {
      case 'sku':
      case 'estado':
      case 'ubicacion':
        break;
      case 'descripcion':
        body.descripcion = val;
        break;
      case 'codigo_interno':
        body.codigoInterno = val;
        break;
      default:
        if (col.esCustom) {
          propiedadesExtra[col.codigo] = val;
        }
        break;
    }
  }

  if (!body.descripcion) {
    const sku = skus.find((s) => s.id === skuId);
    if (sku?.descripcion) body.descripcion = sku.descripcion;
  }

  if (Object.keys(propiedadesExtra).length > 0) {
    body.propiedadesExtra = propiedadesExtra;
  }

  return body;
}
