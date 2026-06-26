import { getDb } from '../db.js';
import { parseExtra } from './propiedadesService.js';

const activoSelect = `
  SELECT a.id, a.epc, a.sku_id, a.estado_id, a.ubicacion_id, a.ubicacion,
         a.descripcion, a.codigo_interno, a.fecha_registro, a.fecha_baja, a.motivo_baja,
         a.propiedades_extra,
         s.codigo AS sku_codigo, e.nombre AS estado_nombre, e.color AS estado_color,
         e.es_activo, e.permite_salida,
         ub.nombre AS ubicacion_nombre
  FROM activos a
  JOIN skus s ON s.id = a.sku_id
  JOIN estados e ON e.id = a.estado_id
  LEFT JOIN ubicaciones ub ON ub.id = a.ubicacion_id
`;

export function mapActivo(row) {
  let propiedadesExtra = parseExtra(row.propiedades_extra);
  return {
    id: row.id,
    tid: row.epc,
    epc: row.epc,
    sku: row.sku_codigo,
    skuId: row.sku_id,
    estado: row.estado_nombre,
    estadoId: row.estado_id,
    estadoColor: row.estado_color,
    esActivo: Boolean(row.es_activo),
    permiteSalida: Boolean(row.permite_salida),
    fecha: row.fecha_registro,
    fechaBaja: row.fecha_baja,
    motivoBaja: row.motivo_baja,
    ubicacion: row.ubicacion_nombre || row.ubicacion || '',
    ubicacionId: row.ubicacion_id,
    descripcion: row.descripcion,
    codigoInterno: row.codigo_interno,
    propiedadesExtra,
  };
}

export function getActivoById(id) {
  return getDb().prepare(`${activoSelect} WHERE a.id = ?`).get(id);
}

export { activoSelect };
