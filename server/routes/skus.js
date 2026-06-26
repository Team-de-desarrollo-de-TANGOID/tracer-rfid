import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requirePermission('inventario.ver', 'config.sku'), (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM skus WHERE activo = 1 ORDER BY codigo').all());
});

router.get('/all', requirePermission('config.sku'), (_req, res) => {
  res.json(getDb().prepare('SELECT * FROM skus ORDER BY codigo').all());
});

router.post('/', requirePermission('config.sku'), (req, res) => {
  const { codigo, descripcion } = req.body ?? {};
  if (!codigo?.trim()) return res.status(400).json({ error: 'Código SKU requerido.' });
  try {
    const r = getDb()
      .prepare('INSERT INTO skus (codigo, descripcion) VALUES (?, ?)')
      .run(codigo.trim().toUpperCase(), descripcion ?? '');
    res.status(201).json(getDb().prepare('SELECT * FROM skus WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'SKU duplicado.' });
    }
    throw e;
  }
});

router.patch('/:id', requirePermission('config.sku'), (req, res) => {
  const { descripcion, activo } = req.body ?? {};
  const db = getDb();
  if (descripcion !== undefined) {
    db.prepare('UPDATE skus SET descripcion = ? WHERE id = ?').run(descripcion, req.params.id);
  }
  if (activo !== undefined) {
    db.prepare('UPDATE skus SET activo = ? WHERE id = ?').run(activo ? 1 : 0, req.params.id);
  }
  res.json(db.prepare('SELECT * FROM skus WHERE id = ?').get(req.params.id));
});

export default router;
