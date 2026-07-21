import { getDb } from '../db.js';
import { activoSelect, mapActivo } from './activosService.js';
import { registrarEvento } from './eventosService.js';
import { formatInstantInAppTz, nowInAppTz } from '../utils/appTimezone.js';
import { normalizeTid, tidsEquivalent } from '../utils/tid.js';

/** Misma etiqueta no suma dos veces al total dentro de este lapso (métricas / dashboard). */
export const PORTAL_INCIDENT_DEDUPE_HOURS = 2;

const DEDUPE_HOURS_SQL = `-${PORTAL_INCIDENT_DEDUPE_HOURS} hours`;

function parseAppTzSql(value) {
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const d = new Date(
    `${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '12'}:${m[5] ?? '00'}:${m[6] ?? '00'}-03:00`
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function hoursBeforeAppTzSql(atSql, hours = PORTAL_INCIDENT_DEDUPE_HOURS) {
  const base = parseAppTzSql(atSql) || new Date();
  return formatInstantInAppTz(new Date(base.getTime() - hours * 3_600_000));
}

/** Excluye re-lecturas del mismo TID dentro de la ventana de deduplicación. */
function incidentOnlySql(alias = 'd1') {
  return `
    AND NOT EXISTS (
      SELECT 1 FROM portal_detecciones d2
      WHERE d2.tid = ${alias}.tid
        AND d2.tipo = ${alias}.tipo
        AND d2.detectado_at < ${alias}.detectado_at
        AND datetime(d2.detectado_at) >= datetime(${alias}.detectado_at, '${DEDUPE_HOURS_SQL}')
    )`;
}
function findActivoByTid(tid) {
  const db = getDb();
  const needle = normalizeTid(tid);
  if (!needle) return null;

  const exact = db
    .prepare(`${activoSelect} WHERE UPPER(TRIM(a.epc)) = ?`)
    .get(needle);
  if (exact) return mapActivo(exact);

  // FX9600 puede reportar el TID con 00 de padding; en DB puede estar sin ellos (o al revés).
  const candidates = db
    .prepare(
      `${activoSelect}
       WHERE UPPER(TRIM(a.epc)) LIKE ? OR ? LIKE (UPPER(TRIM(a.epc)) || '%')`
    )
    .all(`${needle}%`, needle);
  for (const row of candidates) {
    if (tidsEquivalent(row.epc, needle)) return mapActivo(row);
  }
  return null;
}

export function insertDeteccionPuerta({
  tid,
  antena = null,
  rssi = null,
  eventoLectorId = null,
  detectadoAt,
  tipo = 'SALIDA_DENEGADA',
}) {
  const normalizedTid = normalizeTid(tid);
  const db = getDb();

  const at = detectadoAt || nowInAppTz();
  const cutoff = hoursBeforeAppTzSql(at);

  const recentDup = db
    .prepare(
      `SELECT id FROM portal_detecciones
       WHERE tid = ? AND tipo = ?
         AND detectado_at >= ?`
    )
    .get(normalizedTid, tipo, cutoff);
  if (recentDup) return null;
  if (eventoLectorId != null) {
    const exists = db
      .prepare(
        `SELECT id FROM portal_detecciones
         WHERE evento_lector_id = ? AND detectado_at >= datetime(?, '-1 hour')`
      )
      .get(eventoLectorId, at);
    if (exists) return null;
  }

  const activo = findActivoByTid(normalizedTid);

  const result = db
    .prepare(
      `INSERT INTO portal_detecciones (
        tid, activo_id, tipo, antena, rssi, evento_lector_id, detectado_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      normalizedTid,
      activo?.id ?? null,
      tipo,
      antena,
      rssi,
      eventoLectorId,
      at
    );

  if (activo) {
    registrarEvento({
      activoId: activo.id,
      epc: normalizedTid,
      tipo: 'SALIDA_DENEGADA',
      origen: 'portal',
      metadata: { antena, rssi, eventoLectorId },
      notas: 'Salida denegada en portal de entrada/salida',
    });
  }

  return mapDeteccion(
    db
      .prepare(
        `SELECT d.*, s.codigo AS sku, e.nombre AS estado, e.color AS estado_color, a.ubicacion
         FROM portal_detecciones d
         LEFT JOIN activos a ON a.id = d.activo_id
         LEFT JOIN skus s ON s.id = a.sku_id
         LEFT JOIN estados e ON e.id = a.estado_id
         WHERE d.id = ?`
      )
      .get(result.lastInsertRowid)
  );
}

/** Detección para el modal (sin persistir en DB). */
export function buildDeteccionAlerta({
  tid,
  antena = null,
  rssi = null,
  eventoLectorId = null,
  detectadoAt,
}) {
  const normalizedTid = normalizeTid(tid);
  const activo = findActivoByTid(normalizedTid);
  const at = detectadoAt || nowInAppTz();

  return {
    id: -(Date.now() % 2_000_000_000),
    tid: normalizedTid,
    activoId: activo?.id ?? null,
    tipo: 'SALIDA_DENEGADA',
    antena,
    rssi,
    eventoLectorId,
    detectadoAt: at,
    createdAt: at,
    sku: activo?.sku ?? null,
    estado: activo?.estado ?? null,
    estadoColor: activo?.estadoColor ?? null,
    ubicacion: activo?.ubicacion ?? null,
  };
}

function mapDeteccion(row) {
  if (!row) return null;
  return {
    id: row.id,
    tid: row.tid,
    activoId: row.activo_id,
    tipo: row.tipo,
    antena: row.antena,
    rssi: row.rssi,
    eventoLectorId: row.evento_lector_id,
    detectadoAt: row.detectado_at,
    createdAt: row.created_at,
    sku: row.sku ?? null,
    estado: row.estado ?? null,
    estadoColor: row.estado_color ?? null,
    ubicacion: row.ubicacion ?? null,
  };
}

export function listDetecciones({
  from,
  to,
  limit = 200,
  offset = 0,
  tipo = 'SALIDA_DENEGADA',
  incidentsOnly = true,
} = {}) {
  const db = getDb();
  const alias = incidentsOnly ? 'd1' : 'd';
  let sql = `
    SELECT ${alias}.*, s.codigo AS sku, e.nombre AS estado, e.color AS estado_color, a.ubicacion
    FROM portal_detecciones ${alias}
    LEFT JOIN activos a ON a.id = ${alias}.activo_id
    LEFT JOIN skus s ON s.id = a.sku_id
    LEFT JOIN estados e ON e.id = a.estado_id
    WHERE 1=1`;
  const params = [];

  if (tipo) {
    sql += ` AND ${alias}.tipo = ?`;
    params.push(tipo);
  }
  if (from) {
    sql += ` AND ${alias}.detectado_at >= ?`;
    params.push(from);
  }
  if (to) {
    sql += ` AND ${alias}.detectado_at <= ?`;
    params.push(to);
  }
  if (incidentsOnly) {
    sql += incidentOnlySql(alias);
  }
  sql += ` ORDER BY ${alias}.detectado_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(sql).all(...params).map(mapDeteccion);
}

export function countDetecciones({ from, to, tipo = 'SALIDA_DENEGADA', incidentsOnly = true } = {}) {
  const db = getDb();
  if (!incidentsOnly) {
    let sql = 'SELECT COUNT(*) AS n FROM portal_detecciones WHERE 1=1';
    const params = [];
    if (tipo) {
      sql += ' AND tipo = ?';
      params.push(tipo);
    }
    if (from) {
      sql += ' AND detectado_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND detectado_at <= ?';
      params.push(to);
    }
    return db.prepare(sql).get(...params).n;
  }

  let sql = `
    SELECT COUNT(*) AS n FROM portal_detecciones d1
    WHERE 1=1`;
  const params = [];
  if (tipo) {
    sql += ' AND d1.tipo = ?';
    params.push(tipo);
  }
  if (from) {
    sql += ' AND d1.detectado_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND d1.detectado_at <= ?';
    params.push(to);
  }
  sql += incidentOnlySql('d1');
  return db.prepare(sql).get(...params).n;
}

export function countDeteccionesNoRegistradas({ from, to, tipo = 'SALIDA_DENEGADA' } = {}) {
  const db = getDb();
  let sql = `
    SELECT COUNT(*) AS n FROM portal_detecciones d1
    WHERE d1.activo_id IS NULL`;
  const params = [];
  if (tipo) {
    sql += ' AND d1.tipo = ?';
    params.push(tipo);
  }
  if (from) {
    sql += ' AND d1.detectado_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND d1.detectado_at <= ?';
    params.push(to);
  }
  sql += incidentOnlySql('d1');
  return db.prepare(sql).get(...params).n;
}

export function listDeteccionesPorDia({ from, to, tipo = 'SALIDA_DENEGADA' } = {}) {
  const db = getDb();
  let sql = `
    SELECT substr(d1.detectado_at, 1, 10) AS fecha, COUNT(*) AS cantidad
    FROM portal_detecciones d1
    WHERE 1=1`;
  const params = [];
  if (tipo) {
    sql += ' AND d1.tipo = ?';
    params.push(tipo);
  }
  if (from) {
    sql += ' AND d1.detectado_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND d1.detectado_at <= ?';
    params.push(to);
  }
  sql += incidentOnlySql('d1');
  sql += ' GROUP BY substr(d1.detectado_at, 1, 10) ORDER BY fecha ASC';
  return db.prepare(sql).all(...params).map((row) => ({
    fecha: row.fecha,
    cantidad: row.cantidad,
  }));
}

/** Elimina detecciones del portal en un rango (reinicio de contador). */
export function deleteDeteccionesInRange({ from, to, tipo = 'SALIDA_DENEGADA' } = {}) {
  const db = getDb();
  let sql = 'DELETE FROM portal_detecciones WHERE 1=1';
  const params = [];
  if (tipo) {
    sql += ' AND tipo = ?';
    params.push(tipo);
  }
  if (from) {
    sql += ' AND detectado_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND detectado_at <= ?';
    params.push(to);
  }
  const result = db.prepare(sql).run(...params);
  return result.changes;
}
