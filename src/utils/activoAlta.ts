import type { ColumnaTabla } from '../types';
import { TID_CODIGO, LEGACY_TID_CODIGO } from '../constants/columnaCodigos';
import { listaValorTieneContenido } from './propiedadLista';

/** Columnas mínimas si el catálogo aún no cargó o la API falló. */
export const ALTA_FALLBACK_COLUMNS: ColumnaTabla[] = [
  { id: -2, codigo: 'sku', etiqueta: 'SKU', orden: 2, visibleDefault: true, editable: false, obligatoriaAlta: true },
  { id: -3, codigo: 'estado', etiqueta: 'Estado', orden: 3, visibleDefault: true, editable: true, obligatoriaAlta: true },
  { id: -4, codigo: 'ubicacion', etiqueta: 'Ubicación', orden: 4, visibleDefault: true, editable: true, obligatoriaAlta: false },
  { id: -5, codigo: 'descripcion', etiqueta: 'Descripción', orden: 5, visibleDefault: true, editable: true, obligatoriaAlta: false },
  { id: -6, codigo: 'codigo_interno', etiqueta: 'Código interno', orden: 6, visibleDefault: false, editable: true, obligatoriaAlta: false },
];

/** Propiedades que no se capturan en el alta (automáticas o en otra sección). */
export const ALTA_EXCLUDED_CODIGOS = new Set([
  TID_CODIGO,
  LEGACY_TID_CODIGO,
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
  columnas: ColumnaTabla[]
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

  if (Object.keys(propiedadesExtra).length > 0) {
    body.propiedadesExtra = propiedadesExtra;
  }

  return body;
}

export function getValorCampoAlta(
  col: ColumnaTabla,
  values: {
    skuId: number;
    estadoId: number;
    ubicacionId: number;
    fieldValues: Record<string, string>;
  }
): string {
  switch (col.codigo) {
    case 'sku':
      return values.skuId > 0 ? String(values.skuId) : '';
    case 'estado':
      return values.estadoId > 0 ? String(values.estadoId) : '';
    case 'ubicacion':
      return values.ubicacionId > 0 ? String(values.ubicacionId) : '';
    default:
      if (col.tipo === 'lista') {
        const raw = values.fieldValues[col.codigo] ?? '';
        return listaValorTieneContenido(raw, Boolean(col.listaMultiple)) ? raw : '';
      }
      return values.fieldValues[col.codigo]?.trim() ?? '';
  }
}

export function getCamposObligatoriosAlta(columnas: ColumnaTabla[]): ColumnaTabla[] {
  return getAltaActivoFields(columnas).filter((c) => c.obligatoriaAlta);
}

export function getCamposObligatoriosAltaFaltantes(
  columnas: ColumnaTabla[],
  values: {
    skuId: number;
    estadoId: number;
    ubicacionId: number;
    fieldValues: Record<string, string>;
  }
): string[] {
  return getCamposObligatoriosAlta(columnas)
    .filter((col) => !getValorCampoAlta(col, values))
    .map((col) => col.etiqueta);
}

export function datosAltaCompletos(
  columnas: ColumnaTabla[],
  values: {
    skuId: number;
    estadoId: number;
    ubicacionId: number;
    fieldValues: Record<string, string>;
  }
): boolean {
  return getCamposObligatoriosAltaFaltantes(columnas, values).length === 0;
}
