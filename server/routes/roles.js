import { Router } from 'express';
import { getDb } from '../db.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { ADMIN_ROLE_NAME } from '../constants/permissions.js';

const router = Router();

router.use(authMiddleware);

router.get('/permisos', requirePermission('roles.gestionar'), (_req, res) => {
  const rows = getDb()
    .prepare('SELECT id, codigo, nombre, modulo FROM permisos ORDER BY modulo, nombre')
    .all();
  res.json(rows);
});

router.get('/', requirePermission('roles.gestionar'), (_req, res) => {
  const db = getDb();
  const roles = db.prepare('SELECT * FROM roles ORDER BY es_sistema DESC, nombre').all();
  const permMap = db
    .prepare(
      `SELECT rp.rol_id, p.codigo FROM rol_permisos rp
       JOIN permisos p ON p.id = rp.permiso_id`
    )
    .all();

  res.json(
    roles.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion,
      esSistema: Boolean(r.es_sistema),
      createdAt: r.created_at,
      permisos: permMap.filter((p) => p.rol_id === r.id).map((p) => p.codigo),
      usuariosCount: db
        .prepare('SELECT COUNT(*) AS n FROM usuarios WHERE rol_id = ?')
        .get(r.id).n,
    }))
  );
});

router.post('/', requirePermission('roles.gestionar'), (req, res) => {
  const { nombre, descripcion, permisos = [] } = req.body ?? {};
  if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre del rol requerido.' });

  const db = getDb();
  try {
    const r = db
      .prepare('INSERT INTO roles (nombre, descripcion) VALUES (?, ?)')
      .run(nombre.trim(), descripcion?.trim() ?? '');
    setRolePermissions(db, r.lastInsertRowid, permisos);
    res.status(201).json(getRoleById(db, r.lastInsertRowid));
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ya existe un rol con ese nombre.' });
    }
    throw e;
  }
});

router.patch('/:id', requirePermission('roles.gestionar'), (req, res) => {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Rol no encontrado.' });

  const { nombre, descripcion, permisos } = req.body ?? {};
  if (cur.es_sistema && nombre && nombre.trim() !== cur.nombre) {
    return res.status(400).json({ error: 'No se puede renombrar el rol de sistema.' });
  }

  if (nombre !== undefined || descripcion !== undefined) {
    db.prepare('UPDATE roles SET nombre = ?, descripcion = ? WHERE id = ?').run(
      nombre?.trim() ?? cur.nombre,
      descripcion?.trim() ?? cur.descripcion,
      req.params.id
    );
  }

  if (permisos !== undefined) {
    setRolePermissions(db, req.params.id, permisos);
  }

  res.json(getRoleById(db, req.params.id));
});

router.delete('/:id', requirePermission('roles.gestionar'), (req, res) => {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Rol no encontrado.' });
  if (cur.es_sistema) {
    return res.status(400).json({ error: 'No se puede eliminar el rol de sistema.' });
  }

  const used = db.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE rol_id = ?').get(req.params.id).n;
  if (used > 0) {
    return res.status(400).json({ error: `No se puede eliminar: ${used} usuario(s) tienen este rol.` });
  }

  db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

function setRolePermissions(db, rolId, codigos) {
  db.prepare('DELETE FROM rol_permisos WHERE rol_id = ?').run(rolId);
  if (!codigos?.length) return;

  const valid = db
    .prepare(`SELECT id, codigo FROM permisos WHERE codigo IN (${codigos.map(() => '?').join(',')})`)
    .all(...codigos);

  const insert = db.prepare('INSERT INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?)');
  for (const p of valid) insert.run(rolId, p.id);
}

function getRoleById(db, id) {
  const r = db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
  const permisos = db
    .prepare(
      `SELECT p.codigo FROM permisos p
       JOIN rol_permisos rp ON rp.permiso_id = p.id WHERE rp.rol_id = ?`
    )
    .all(id)
    .map((p) => p.codigo);
  return {
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion,
    esSistema: Boolean(r.es_sistema),
    createdAt: r.created_at,
    permisos,
    usuariosCount: db.prepare('SELECT COUNT(*) AS n FROM usuarios WHERE rol_id = ?').get(id).n,
  };
}

export default router;
