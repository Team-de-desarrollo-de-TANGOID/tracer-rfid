import { getDb } from '../db.js';

export function registrarEvento({
  activoId = null,
  epc,
  tipo,
  estadoAnteriorId = null,
  estadoNuevoId = null,
  ubicacionAnterior = null,
  ubicacionNueva = null,
  usuarioId = null,
  origen = 'manual',
  metadata = {},
  notas = '',
}) {
  const db = getDb();
  return db
    .prepare(
      `INSERT INTO eventos_activo (
        activo_id, epc, tipo, estado_anterior_id, estado_nuevo_id,
        ubicacion_anterior, ubicacion_nueva, usuario_id, origen, metadata, notas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      activoId,
      epc.toUpperCase(),
      tipo,
      estadoAnteriorId,
      estadoNuevoId,
      ubicacionAnterior,
      ubicacionNueva,
      usuarioId,
      origen,
      JSON.stringify(metadata),
      notas
    );
}

export function getHistorialActivo(activoId, limit = 50) {
  const db = getDb();
  return db
    .prepare(
      `SELECT e.*,
              ea.nombre AS estado_anterior, en.nombre AS estado_nuevo,
              u.nombre AS usuario_nombre
       FROM eventos_activo e
       LEFT JOIN estados ea ON ea.id = e.estado_anterior_id
       LEFT JOIN estados en ON en.id = e.estado_nuevo_id
       LEFT JOIN usuarios u ON u.id = e.usuario_id
       WHERE e.activo_id = ?
       ORDER BY e.id DESC LIMIT ?`
    )
    .all(activoId, limit)
    .map(mapEvento);
}

function mapEvento(row) {
  return {
    id: row.id,
    activoId: row.activo_id,
    epc: row.epc,
    tipo: row.tipo,
    estadoAnterior: row.estado_anterior,
    estadoNuevo: row.estado_nuevo,
    ubicacionAnterior: row.ubicacion_anterior,
    ubicacionNueva: row.ubicacion_nueva,
    usuarioNombre: row.usuario_nombre,
    origen: row.origen,
    metadata: JSON.parse(row.metadata || '{}'),
    notas: row.notas,
    createdAt: row.created_at,
  };
}

export { mapEvento };
