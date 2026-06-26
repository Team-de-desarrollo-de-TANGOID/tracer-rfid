import { getDb } from '../db.js';

/** Simula lectura del lector USB R3 (alta / auditoría). */
export function simulateTagBatch(count = 12) {
  const db = getDb();
  const known = db
    .prepare(
      `SELECT a.epc FROM activos a
       JOIN estados e ON e.id = a.estado_id
       WHERE e.nombre != 'Baja'
       ORDER BY RANDOM() LIMIT ?`
    )
    .all(Math.min(count, 8))
    .map((r) => r.epc);

  const extra = Math.max(0, count - known.length);
  const unknown = [];
  for (let i = 0; i < extra; i++) {
    unknown.push(`E200DEMO${Date.now().toString().slice(-6)}${i}`);
  }

  return [...known, ...unknown].slice(0, count);
}

/** Genera un TID simulado (lectura real del tag). */
export function simulateSingleTid() {
  const hex = Array.from({ length: 12 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0')
  )
    .join('')
    .toUpperCase();
  return `E280${hex}`;
}

/** @deprecated usar simulateSingleTid */
export function simulateSingleTag() {
  return simulateSingleTid();
}

/** Simula lectura masiva de etiquetas nuevas (alta por lote). */
export function simulateNewTagBatch(count = 12) {
  const db = getDb();
  const known = new Set(
    db.prepare('SELECT epc FROM activos').all().map((r) => r.epc.toUpperCase())
  );
  const tags = [];
  let attempts = 0;
  const max = Math.min(count, 200);
  while (tags.length < max && attempts < max * 5) {
    attempts += 1;
    const tid = `E280${Date.now().toString().slice(-5)}${Math.floor(Math.random() * 1e4)
      .toString()
      .padStart(4, '0')}`;
    const upper = tid.toUpperCase();
    if (!known.has(upper) && !tags.some((t) => t.toUpperCase() === upper)) {
      tags.push(upper);
    }
  }
  return tags;
}

/** Simula una lectura durante auditoría (mezcla tags conocidos y desconocidos). */
export function simulateAuditRead() {
  const db = getDb();
  if (Math.random() < 0.7) {
    const row = db.prepare('SELECT epc FROM activos ORDER BY RANDOM() LIMIT 1').get();
    if (row) return row.epc.toUpperCase();
  }
  return simulateSingleTid();
}
export async function simulateFx9600Sync(usuarioId = null) {
  const db = getDb();
  const tags = db
    .prepare(
      `SELECT a.id, a.epc FROM activos a
       JOIN estados e ON e.id = a.estado_id
       WHERE e.es_activo = 1 AND e.permite_salida = 0`
    )
    .all();

  const start = Date.now();
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
  const duracion = Date.now() - start;

  const total = tags.length;
  const mensaje =
    total === 0
      ? 'Sin etiquetas activas para sincronizar (modo demo).'
      : `Lista autorizada actualizada en lector FX9600 (${total} TID, modo demo).`;

  const version =
    (db.prepare('SELECT COALESCE(MAX(version),0)+1 AS v FROM sync_log').get().v) || 1;

  db.prepare(
    `INSERT INTO sync_log (fecha, total_enviados, exito, mensaje, duracion_ms, version)
     VALUES (datetime('now','localtime'), ?, 1, ?, ?, ?)`
  ).run(total, mensaje, duracion, version);

  db.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES ('ultima_sync', datetime('now','localtime'))`).run();

  if (usuarioId) {
    const { registrarEvento } = await import('./eventosService.js');
    registrarEvento({
      epc: 'SYNC-BATCH',
      tipo: 'SYNC_ENVIADO',
      usuarioId,
      origen: 'sistema',
      metadata: { version, total, epcs: tags.map((t) => t.epc), modo: 'demo' },
      notas: mensaje,
    });
  }

  return { total, mensaje, modo: 'demo', version, duracionMs: duracion };
}
