import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb } from '../db.js';

const JWT_SECRET =
  process.env.JWT_SECRET || 'racket-club-local-dev-secret-change-in-production';
const TOKEN_TTL_HOURS = 24;

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(usuarioId) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
  const payload = { sub: usuarioId, exp: Math.floor(expiresAt.getTime() / 1000) };
  const token = jwt.sign(payload, JWT_SECRET);
  const tokenHash = hashToken(token);

  db.prepare(
    `INSERT INTO sesiones (usuario_id, token_hash, expires_at) VALUES (?, ?, ?)`
  ).run(usuarioId, tokenHash, expiresAt.toISOString());

  return { token, expiresAt: expiresAt.toISOString() };
}

export function revokeSession(token) {
  const db = getDb();
  db.prepare('DELETE FROM sesiones WHERE token_hash = ?').run(hashToken(token));
}

export function login(username, password) {
  const db = getDb();
  const user = db
    .prepare(
      `SELECT u.*, r.nombre AS rol_nombre, r.es_sistema AS rol_es_sistema
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.username = ? COLLATE NOCASE AND u.activo = 1`
    )
    .get(username.trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return null;
  }

  const loginAnterior = user.ultimo_login ?? null;
  db.prepare(
    `UPDATE usuarios
     SET login_anterior = ultimo_login,
         ultimo_login = datetime('now','localtime')
     WHERE id = ?`
  ).run(user.id);
  user.login_anterior = loginAnterior;
  user.ultimo_login = db
    .prepare(`SELECT ultimo_login FROM usuarios WHERE id = ?`)
    .get(user.id).ultimo_login;

  const permisos = db
    .prepare(
      `SELECT p.codigo FROM permisos p
       JOIN rol_permisos rp ON rp.permiso_id = p.id
       WHERE rp.rol_id = ?`
    )
    .all(user.rol_id)
    .map((r) => r.codigo);

  const session = createSession(user.id);

  return {
    token: session.token,
    expiresAt: session.expiresAt,
    user: mapUser(user, permisos),
  };
}

export function mapUser(row, permisos = []) {
  return {
    id: row.id,
    username: row.username,
    nombre: row.nombre,
    activo: Boolean(row.activo),
    rolId: row.rol_id,
    rolNombre: row.rol_nombre,
    rolEsSistema: Boolean(row.rol_es_sistema),
    permisos,
    ultimoLogin: row.ultimo_login ?? null,
    loginAnterior: row.login_anterior ?? null,
  };
}

export function getUserById(id) {
  const db = getDb();
  const user = db
    .prepare(
      `SELECT u.*, r.nombre AS rol_nombre, r.es_sistema AS rol_es_sistema
       FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?`
    )
    .get(id);
  if (!user) return null;

  const permisos = db
    .prepare(
      `SELECT p.codigo FROM permisos p
       JOIN rol_permisos rp ON rp.permiso_id = p.id WHERE rp.rol_id = ?`
    )
    .all(user.rol_id)
    .map((r) => r.codigo);

  return mapUser(user, permisos);
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado.' });
  }

  const token = header.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }

  const db = getDb();
  const session = db
    .prepare(
      `SELECT s.*, u.activo FROM sesiones s
       JOIN usuarios u ON u.id = s.usuario_id
       WHERE s.token_hash = ? AND s.expires_at > datetime('now')`
    )
    .get(hashToken(token));

  if (!session || !session.activo) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }

  const user = getUserById(payload.sub);
  if (!user) return res.status(401).json({ error: 'Usuario no encontrado.' });

  req.user = user;
  req.token = token;
  next();
}

export function requirePermission(...codigos) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado.' });
    const has = codigos.some((c) => req.user.permisos.includes(c));
    if (!has) {
      return res.status(403).json({ error: 'No tiene permiso para esta acción.' });
    }
    next();
  };
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const db = getDb();
      const session = db
        .prepare(
          `SELECT 1 FROM sesiones WHERE token_hash = ? AND expires_at > datetime('now')`
        )
        .get(hashToken(token));
      if (session) {
        req.user = getUserById(payload.sub);
        req.token = token;
      }
    } catch {
      /* ignore */
    }
  }
  next();
}
