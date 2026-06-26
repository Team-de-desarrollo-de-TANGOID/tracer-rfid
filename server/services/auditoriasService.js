import { getDb } from '../db.js';

function enrichAuditTids(tids) {
  const db = getDb();
  const unique = [...new Set(tids.map((t) => String(t).trim().toUpperCase()).filter(Boolean))];
  const known = new Set(
    db.prepare('SELECT epc FROM activos').all().map((r) => r.epc.toUpperCase())
  );

  return unique.map((tid) => ({
    tid,
    epc: tid,
    registrado: known.has(tid),
  }));
}

function mapAuditoriaRow(row) {
  return {
    id: row.id,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    totalLeidos: row.total_leidos,
    totalRegistrados: row.total_registrados,
    totalDesconocidos: row.total_desconocidos,
    usuarioId: row.usuario_id,
    usuarioNombre: row.usuario_nombre ?? null,
    usuarioUsername: row.usuario_username ?? null,
    notas: row.notas ?? '',
  };
}

function mapDetalleRow(row) {
  return {
    id: row.id,
    tid: row.epc,
    epc: row.epc,
    registrado: Boolean(row.registrado),
    activoId: row.activo_id,
    sku: row.sku ?? null,
    estado: row.estado ?? null,
    estadoColor: row.estado_color ?? null,
    ubicacion: row.ubicacion ?? null,
  };
}

export function saveAuditoria({ tids, usuarioId, fechaInicio, notas = '' }) {
  const enriched = enrichAuditTids(tids);
  if (enriched.length === 0) {
    throw new Error('Debe incluir al menos un TID leído.');
  }

  const db = getDb();
  const registrados = enriched.filter((t) => t.registrado).length;
  const inicio = fechaInicio || new Date().toISOString().slice(0, 19).replace('T', ' ');

  const auditResult = db
    .prepare(
      `INSERT INTO auditorias (fecha_inicio, fecha_fin, total_leidos, total_registrados, total_desconocidos, usuario_id, notas)
       VALUES (?, datetime('now','localtime'), ?, ?, ?, ?, ?)`
    )
    .run(
      inicio,
      enriched.length,
      registrados,
      enriched.length - registrados,
      usuarioId,
      String(notas ?? '').trim()
    );

  const auditId = auditResult.lastInsertRowid;
  const insertDet = db.prepare(
    'INSERT INTO auditoria_detalle (auditoria_id, epc, activo_id, registrado) VALUES (?, ?, ?, ?)'
  );

  for (const t of enriched) {
    const activo = db.prepare('SELECT id FROM activos WHERE epc = ? COLLATE NOCASE').get(t.tid);
    insertDet.run(auditId, t.tid, activo?.id ?? null, t.registrado ? 1 : 0);
  }

  return {
    id: auditId,
    tags: enriched,
    total: enriched.length,
    registrados,
    desconocidos: enriched.length - registrados,
  };
}

export function listAuditorias({ limit = 100 } = {}) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.*, u.nombre AS usuario_nombre, u.username AS usuario_username
       FROM auditorias a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       ORDER BY datetime(a.fecha_fin) DESC, a.id DESC
       LIMIT ?`
    )
    .all(limit);
  return rows.map(mapAuditoriaRow);
}

export function getAuditoriaById(id) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT a.*, u.nombre AS usuario_nombre, u.username AS usuario_username
       FROM auditorias a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.id = ?`
    )
    .get(id);

  if (!row) return null;

  const detalle = db
    .prepare(
      `SELECT d.id, d.auditoria_id, d.epc, d.activo_id, d.registrado,
              s.codigo AS sku, e.nombre AS estado, e.color AS estado_color,
              COALESCE(ub.nombre, act.ubicacion, '') AS ubicacion
       FROM auditoria_detalle d
       LEFT JOIN activos act ON act.id = d.activo_id
       LEFT JOIN skus s ON s.id = act.sku_id
       LEFT JOIN estados e ON e.id = act.estado_id
       LEFT JOIN ubicaciones ub ON ub.id = act.ubicacion_id
       WHERE d.auditoria_id = ?
       ORDER BY d.id`
    )
    .all(id);

  return {
    ...mapAuditoriaRow(row),
    detalle: detalle.map(mapDetalleRow),
  };
}

export { enrichAuditTids };
