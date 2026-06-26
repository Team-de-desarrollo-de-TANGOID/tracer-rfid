import { Router } from 'express';
import { login, revokeSession, authMiddleware } from '../middleware/auth.js';

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
  revokeSession(req.token);
  res.json({ ok: true });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

export default router;
