import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('inventario.ver', 'config.ubicaciones'), (_req, res) => {
  res.json(
    getDb()
      .prepare('SELECT * FROM ubicaciones WHERE activo = 1 ORDER BY orden, nombre')
      .all()
      .map(mapUbicacion)
  );
});

router.get('/all', requirePermission('config.ubicaciones'), (_req, res) => {
  res.json(
    getDb()
      .prepare('SELECT * FROM ubicaciones ORDER BY orden, nombre')
      .all()
      .map(mapUbicacion)
  );
});

router.post('/', requirePermission('config.ubicaciones'), (req, res) => {
  const { nombre, tipo, descripcion } = req.body ?? {};
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido.' });
  const db = getDb();
  const orden = db.prepare('SELECT COALESCE(MAX(orden),0)+1 AS o FROM ubicaciones').get().o;
  try {
    const r = db
      .prepare(
        'INSERT INTO ubicaciones (nombre, tipo, descripcion, orden) VALUES (?, ?, ?, ?)'
      )
      .run(nombre.trim(), tipo ?? 'general', descripcion?.trim() ?? '', orden);
    res.status(201).json(mapUbicacion(db.prepare('SELECT * FROM ubicaciones WHERE id = ?').get(r.lastInsertRowid)));
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ubicación duplicada.' });
    }
    throw e;
  }
});

router.patch('/:id', requirePermission('config.ubicaciones'), (req, res) => {
  const { nombre, tipo, descripcion, activo, orden } = req.body ?? {};
  const db = getDb();
  const cur = db.prepare('SELECT * FROM ubicaciones WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Ubicación no encontrada.' });

  db.prepare(
    'UPDATE ubicaciones SET nombre = ?, tipo = ?, descripcion = ?, activo = ?, orden = ? WHERE id = ?'
  ).run(
    nombre?.trim() ?? cur.nombre,
    tipo ?? cur.tipo,
    descripcion !== undefined ? descripcion.trim() : (cur.descripcion ?? ''),
    activo !== undefined ? (activo ? 1 : 0) : cur.activo,
    orden ?? cur.orden,
    req.params.id
  );

  res.json(mapUbicacion(db.prepare('SELECT * FROM ubicaciones WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', requirePermission('config.ubicaciones'), (req, res) => {
  const db = getDb();
  const used = db.prepare('SELECT COUNT(*) AS n FROM activos WHERE ubicacion_id = ?').get(req.params.id).n;
  if (used > 0) {
    return res.status(400).json({ error: `No se puede eliminar: ${used} activo(s) en esta ubicación.` });
  }
  db.prepare('DELETE FROM ubicaciones WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

function mapUbicacion(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    descripcion: row.descripcion ?? '',
    activo: Boolean(row.activo),
    orden: row.orden,
  };
}

export default router;
