import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { ADMIN_ROLE_NAME, ADMIN_USERNAME } from '../constants/permissions.js';

const router = Router();

router.use(authMiddleware);

function isSystemAdminUser(user) {
  return (
    String(user?.username || '').localeCompare(ADMIN_USERNAME, undefined, {
      sensitivity: 'accent',
    }) === 0
  );
}

router.get('/', requirePermission('usuarios.ver', 'usuarios.gestionar'), (_req, res) => {
  const rows = getDb()
    .prepare(
      `SELECT u.id, u.username, u.nombre, u.activo, u.rol_id, u.created_at,
              r.nombre AS rol_nombre
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
       ORDER BY u.username`
    )
    .all();
  res.json(rows.map(mapUsuario));
});

router.post('/', requirePermission('usuarios.gestionar'), (req, res) => {
  const { username, password, nombre, rolId } = req.body ?? {};
  if (!username?.trim() || !password || !rolId) {
    return res.status(400).json({ error: 'Usuario, contraseña y rol son obligatorios.' });
  }
  if (isSystemAdminUser({ username: username.trim() })) {
    return res.status(400).json({
      error: `El usuario "${ADMIN_USERNAME}" es reservado del sistema.`,
    });
  }
  const db = getDb();
  const rol = db.prepare('SELECT id FROM roles WHERE id = ?').get(rolId);
  if (!rol) return res.status(400).json({ error: 'Rol no válido.' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const r = db
      .prepare(
        `INSERT INTO usuarios (username, password_hash, nombre, rol_id)
         VALUES (?, ?, ?, ?)`
      )
      .run(username.trim(), hash, nombre?.trim() ?? username.trim(), rolId);
    const user = db
      .prepare(
        `SELECT u.id, u.username, u.nombre, u.activo, u.rol_id, u.created_at, r.nombre AS rol_nombre
         FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?`
      )
      .get(r.lastInsertRowid);
    res.status(201).json(mapUsuario(user));
  } catch (e) {
    if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'El nombre de usuario ya existe.' });
    }
    throw e;
  }
});

router.patch('/:id', requirePermission('usuarios.gestionar'), (req, res) => {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Usuario no encontrado.' });

  const { nombre, rolId, activo, password } = req.body ?? {};
  const systemUser = isSystemAdminUser(cur);

  if (systemUser && activo === false) {
    return res.status(400).json({
      error: 'El usuario Administrador del sistema no puede desactivarse.',
    });
  }
  if (systemUser && rolId !== undefined && Number(rolId) !== cur.rol_id) {
    return res.status(400).json({
      error: 'No se puede cambiar el rol del usuario Administrador del sistema.',
    });
  }

  if (rolId !== undefined) {
    const rol = db.prepare('SELECT id FROM roles WHERE id = ?').get(rolId);
    if (!rol) return res.status(400).json({ error: 'Rol no válido.' });
  }

  if (activo === false && cur.id === req.user.id) {
    return res.status(400).json({ error: 'No puede desactivar su propia cuenta.' });
  }

  const updates = [];
  const params = [];
  if (nombre !== undefined) {
    updates.push('nombre = ?');
    params.push(nombre.trim());
  }
  if (rolId !== undefined) {
    updates.push('rol_id = ?');
    params.push(rolId);
  }
  if (activo !== undefined) {
    updates.push('activo = ?');
    params.push(activo ? 1 : 0);
  }
  if (password) {
    updates.push('password_hash = ?');
    params.push(bcrypt.hashSync(password, 10));
  }
  updates.push("updated_at = datetime('now','localtime')");
  params.push(req.params.id);

  if (updates.length > 1) {
    db.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const user = db
    .prepare(
      `SELECT u.id, u.username, u.nombre, u.activo, u.rol_id, u.created_at, r.nombre AS rol_nombre
       FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?`
    )
    .get(req.params.id);
  res.json(mapUsuario(user));
});

router.delete('/:id', requirePermission('usuarios.gestionar'), (req, res) => {
  const db = getDb();
  const cur = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.params.id);
  if (!cur) return res.status(404).json({ error: 'Usuario no encontrado.' });
  if (isSystemAdminUser(cur)) {
    return res.status(400).json({
      error: 'El usuario Administrador del sistema no puede eliminarse.',
    });
  }
  if (cur.id === req.user.id) {
    return res.status(400).json({ error: 'No puede eliminar su propia cuenta.' });
  }

  const adminRole = db.prepare('SELECT id FROM roles WHERE nombre = ?').get(ADMIN_ROLE_NAME);
  if (cur.rol_id === adminRole?.id) {
    const admins = db
      .prepare('SELECT COUNT(*) AS n FROM usuarios WHERE rol_id = ? AND activo = 1')
      .get(adminRole.id).n;
    if (admins <= 1) {
      return res.status(400).json({ error: 'Debe existir al menos un administrador activo.' });
    }
  }

  db.prepare('DELETE FROM usuarios WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

function mapUsuario(row) {
  return {
    id: row.id,
    username: row.username,
    nombre: row.nombre,
    activo: Boolean(row.activo),
    rolId: row.rol_id,
    rolNombre: row.rol_nombre,
    createdAt: row.created_at,
    esSistema: isSystemAdminUser(row),
  };
}

export default router;
