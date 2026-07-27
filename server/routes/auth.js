import { Router } from 'express';
import { login, revokeSession, authMiddleware } from '../middleware/auth.js';
import { getDb } from '../db.js';
import { clearMonitorSession } from '../services/monitorSession.js';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos.' });
  }
  const result = login(username, password);
  if (!result) return res.status(401).json({ error: 'Credenciales incorrectas.' });
  res.json(result);
});

router.post('/logout', authMiddleware, (req, res) => {
  clearMonitorSession(req.user.id);
  revokeSession(req.token);
  res.json({ ok: true });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

router.get('/permisos-catalog', authMiddleware, (_req, res) => {
  const rows = getDb()
    .prepare('SELECT codigo, nombre, modulo FROM permisos ORDER BY modulo, codigo')
    .all();
  res.json(rows);
});

export default router;
