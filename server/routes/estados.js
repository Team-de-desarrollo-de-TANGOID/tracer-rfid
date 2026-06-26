import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  TIPO_OPERATIVO,
  esActivoFromTipoOperativo,
  resolveTipoOperativo,
  tipoOperativoFromRow,
} from '../constants/estadoOperativo.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('inventario.ver', 'config.estados'), (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM estados ORDER BY orden, nombre').all().map(mapEstado));
});

router.post('/', requirePermission('config.estados'), (req, res) => {
  const { nombre, color, esActivo, permiteSalida, codigo, tipoOperativo, habilitado } = req.body ?? {};
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido.' });

  const db = getDb();
  const orden = db.prepare('SELECT COALESCE(MAX(orden),0)+1 AS o FROM estados').get().o;
  const codigoVal = codigo?.trim().toUpperCase() || nombre.trim().toUpperCase().replace(/\s+/g, '_');
  const tipo = resolveTipoOperativo({ tipoOperativo, esActivo, habilitado }, { es_activo: 1 });
  const esActivoVal = esActivoFromTipoOperativo(tipo);

  try {
    const r = db
      .prepare(
        `INSERT INTO estados (codigo, nombre, color, es_activo, permite_salida, orden)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        codigoVal,
        nombre.trim(),
        color ?? '#64748b',
        esActivoVal ? 1 : 0,
        permiteSalida ? 1 : 0,
        orden
      );
    res.status(201).json(mapEstado(db.prepare('SELECT * FROM estados WHERE id = ?').get(r.lastInsertRowid)));
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Estado duplicado (nombre o código).' });
    }
    throw e;
  }
});

router.patch('/:id', requirePermission('config.estados'), (req, res) => {
  const { nombre, color, esActivo, permiteSalida, orden, codigo, tipoOperativo, habilitado } =
    req.body ?? {};
  const db = getDb();
  const cur = db.prepare('SELECT * FROM estados WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Estado no encontrado.' });

  const tipo = resolveTipoOperativo({ tipoOperativo, esActivo, habilitado }, cur);
  const esActivoVal = esActivoFromTipoOperativo(tipo);

  db.prepare(
    `UPDATE estados SET
      codigo = ?, nombre = ?, color = ?, es_activo = ?, permite_salida = ?, orden = ?
     WHERE id = ?`
  ).run(
    codigo?.trim().toUpperCase() ?? cur.codigo,
    nombre?.trim() ?? cur.nombre,
    color ?? cur.color,
    esActivoVal ? 1 : 0,
    permiteSalida !== undefined ? (permiteSalida ? 1 : 0) : cur.permite_salida,
    orden ?? cur.orden,
    req.params.id
  );

  res.json(mapEstado(db.prepare('SELECT * FROM estados WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', requirePermission('config.estados'), (req, res) => {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM estados WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Estado no encontrado.' });
  if (cur.es_sistema) {
    return res.status(400).json({ error: 'No se puede eliminar un estado de sistema.' });
  }

  const used = db.prepare('SELECT COUNT(*) AS n FROM activos WHERE estado_id = ?').get(req.params.id).n;
  if (used > 0) {
    return res.status(400).json({ error: `No se puede eliminar: ${used} activo(s) usan este estado.` });
  }

  db.prepare('DELETE FROM estados WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

function mapEstado(row) {
  const tipoOperativo = tipoOperativoFromRow(row);
  return {
    id: row.id,
    codigo: row.codigo,
    nombre: row.nombre,
    color: row.color,
    es_activo: row.es_activo,
    esActivo: Boolean(row.es_activo),
    tipoOperativo,
    habilitado: tipoOperativo === TIPO_OPERATIVO.HABILITADO,
    permite_salida: row.permite_salida,
    permiteSalida: Boolean(row.permite_salida),
    orden: row.orden,
    es_sistema: row.es_sistema,
    esSistema: Boolean(row.es_sistema),
  };
}

export default router;
